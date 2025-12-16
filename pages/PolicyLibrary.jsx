import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, FileText, Loader2, Check, X, Users, ArrowLeft, Trash2, Shield, Lock, HeartHandshake, HardHat, File
} from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { ConfirmDeleteDialog } from '@/components/common/ConfirmDeleteDialog';
import CodeOfConductWizard from '@/components/policies/CodeOfConductWizard';
import AntiHarassmentWizard from '@/components/policies/AntiHarassmentWizard';
import WhsWizard from '@/components/policies/WhsWizard';
import CyberSecurityWizard from '@/components/policies/CyberSecurityWizard';

import BlankPolicyDialog from '@/components/policies/BlankPolicyDialog';
import DocumentTemplateSelect from '@/components/documents/DocumentTemplateSelect';
import { toast } from 'sonner';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { base44 } from '@/api/base44Client';

const CATEGORIES = ['HR', 'IT', 'Workplace Health & Safety', 'Finance', 'Legal', 'Operations', 'Other'];

export default function PolicyLibrary() {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  const navigate = useNavigate();
  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [policies, setPolicies] = useState([]);
  const [versions, setVersions] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [entities, setEntities] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [showNewModal, setShowNewModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedWizardType, setSelectedWizardType] = useState(null); // 'CODE_OF_CONDUCT', 'ANTI_HARASSMENT', 'WHS', 'CYBER_SECURITY'
  const [policyToDelete, setPolicyToDelete] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManagePolicies', {
    requireAdminMode: true,
    message: "You need admin access to manage policies."
  });

  useEffect(() => {
    if (employeeCtx?.tenantId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeCtx?.tenantId]);

  const loadData = async () => {
    if (!employeeCtx?.tenantId) return;
    
    setIsLoading(true);
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);

      if (!ctx.permissions?.canManagePolicies) {
        setIsLoading(false);
        return;
      }

      // 🛡️ Defensive: use fallback to base44.entities if wrapper missing
      const [pols, vers, acks, ents, emps] = await Promise.all([
        api.policies?.list ? api.policies.list() : base44.entities.Policy.filter({}),
        api.policyVersions?.list ? api.policyVersions.list() : base44.entities.PolicyVersion.filter({}),
        api.policyAcknowledgements?.list ? api.policyAcknowledgements.list() : base44.entities.PolicyAcknowledgement.filter({}),
        api.entities?.list ? api.entities.list() : base44.entities.CompanyEntity.filter({}),
        api.employees?.filter ? api.employees.filter({ status: 'active' }) : base44.entities.Employee.filter({ status: 'active' }),
      ]);

      setPolicies(pols || []);
      setVersions(vers || []);
      setAcknowledgements(acks || []);
      setEntities(ents || []);
      setEmployees(emps || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build policy data with version and acknowledgement info
  const policyData = useMemo(() => {
    return policies.map(policy => {
      const policyVersions = versions.filter(v => v.policy_id === policy.id);
      
      const publishedVersions = policyVersions.filter(v => v.is_published);
      const latestPublished = publishedVersions.sort((a, b) => b.version_number - a.version_number)[0];
      
      const latestVersionNumber = policyVersions.length > 0 
        ? Math.max(...policyVersions.map(v => v.version_number))
        : 0;

      let employeesInScope = employees;
      if (policy.entity_id) {
        employeesInScope = employees.filter(e => e.entity_id === policy.entity_id);
      }
      const totalInScope = employeesInScope.length;

      let acknowledgedCount = 0;
      if (latestPublished) {
        const versionAcks = acknowledgements.filter(a => a.version_id === latestPublished.id);
        acknowledgedCount = versionAcks.length;
      }

      const entity = entities.find(e => e.id === policy.entity_id);

      return {
        ...policy,
        latestVersionNumber,
        latestPublished,
        effectiveFrom: latestPublished?.effective_from,
        acknowledgedCount,
        totalInScope,
        entityName: entity?.name || 'All entities',
      };
    });
  }, [policies, versions, acknowledgements, entities, employees]);

  const handlePolicyCreated = (createdPolicy) => {
    setShowNewModal(false);
    setShowWizard(false);
    navigate(createPageUrl('PolicyDetail') + `?id=${createdPolicy.id}`);
  };

  const handleAttachTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      // Fetch template details via tenant API
      const tmpl = await api.documentTemplates.get(selectedTemplateId);
      
      const newPolicy = await api.policies.create({
        name: tmpl.name,
        category: 'HR',
        type: 'OTHER',
        description: tmpl.description,
        is_active: true,
        requires_acknowledgement: true,
        template_id: tmpl.id,
        template_version_label: tmpl.version_label,
        attachment_mode: 'TEMPLATE_REFERENCE',
        has_uploaded_file: true, 
        file_url: tmpl.file_url,
        file_name: tmpl.file_name,
        file_mime_type: tmpl.file_mime_type,
        file_size_bytes: tmpl.file_size_bytes
      });
      
      setShowWizard(false);
      navigate(createPageUrl('PolicyDetail') + `?id=${newPolicy.id}`);
      toast.success("Policy created from document");
    } catch (error) {
      console.error("Failed to create from template", error);
      toast.error("Failed to attach document");
    }
  };

  const handleDeletePolicy = async () => {
    if (!policyToDelete) return;
    
    try {
      await api.policies.delete(policyToDelete.id);
      
      setPolicies(prev => prev.filter(p => p.id !== policyToDelete.id));
      setPolicyToDelete(null);
      toast.success('Policy deleted successfully');
    } catch (error) {
      console.error('Error deleting policy:', error);
      toast.error('Failed to delete policy');
    }
  };

  if (isLoading || permLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to={createPageUrl('CompanySettings')}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Policy Library</h1>
          <p className="text-gray-500 mt-1">Create, update, and track company policies.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Policy Table */}
      <Card>
        <CardContent className="p-0">
          {policyData.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No policies yet. Create your first policy to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mandatory</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective From</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acknowledged</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {policyData.map(policy => (
                    <tr key={policy.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{policy.name}</p>
                          {policy.code && (
                            <p className="text-xs text-gray-500">{policy.code}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {policy.category || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {policy.entityName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {policy.country || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {policy.is_mandatory ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {policy.is_active ? (
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">Archived</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {policy.latestVersionNumber > 0 ? `v${policy.latestVersionNumber}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {policy.effectiveFrom || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {policy.latestPublished ? (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {policy.acknowledgedCount} / {policy.totalInScope}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No published version</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={createPageUrl('PolicyDetail') + `?id=${policy.id}`}>
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setPolicyToDelete(policy)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!policyToDelete}
        title="Delete policy?"
        description={policyToDelete ? `Delete the "${policyToDelete.name}" policy? This will remove it from employees and acknowledgements.` : ''}
        confirmLabel="Delete Policy"
        onCancel={() => setPolicyToDelete(null)}
        onConfirm={handleDeletePolicy}
      />

      {/* Blank Policy Dialog */}
      <BlankPolicyDialog 
        open={showNewModal} 
        onOpenChange={setShowNewModal}
        onSuccess={handlePolicyCreated}
      />

      {/* Policy Wizard Modal */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className={selectedWizardType ? "max-w-4xl h-[90vh] p-6 flex flex-col" : "sm:max-w-2xl"}>
          {!selectedWizardType ? (
            <>
              <DialogHeader>
                <DialogTitle>Create New Policy</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                <button 
                  onClick={() => setSelectedWizardType('CODE_OF_CONDUCT')}
                  className="flex flex-col items-start p-4 border rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-left"
                >
                  <div className="p-2 bg-indigo-100 rounded-lg mb-3">
                    <HeartHandshake className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Code of Conduct</h3>
                  <p className="text-sm text-gray-500 mt-1">Sets expected behaviour and workplace standards.</p>
                </button>

                <button 
                  onClick={() => setSelectedWizardType('ANTI_HARASSMENT')}
                  className="flex flex-col items-start p-4 border rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-left"
                >
                  <div className="p-2 bg-pink-100 rounded-lg mb-3">
                    <Shield className="h-6 w-6 text-pink-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Anti-Discrimination & Harassment</h3>
                  <p className="text-sm text-gray-500 mt-1">Rules for respectful, inclusive workplaces.</p>
                </button>

                <button 
                  onClick={() => setSelectedWizardType('WHS')}
                  className="flex flex-col items-start p-4 border rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-left"
                >
                  <div className="p-2 bg-orange-100 rounded-lg mb-3">
                    <HardHat className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Work Health & Safety</h3>
                  <p className="text-sm text-gray-500 mt-1">High-level WHS responsibilities.</p>
                </button>

                <button 
                  onClick={() => setSelectedWizardType('CYBER_SECURITY')}
                  className="flex flex-col items-start p-4 border rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-left"
                >
                  <div className="p-2 bg-blue-100 rounded-lg mb-3">
                    <Lock className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Cyber Security & Acceptable Use</h3>
                  <p className="text-sm text-gray-500 mt-1">Rules for using systems and data securely.</p>
                </button>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-2">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Or use a Document</h3>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <DocumentTemplateSelect 
                      category="POLICY" 
                      value={selectedTemplateId}
                      onChange={setSelectedTemplateId}
                      placeholder="Select a policy document..."
                    />
                  </div>
                  <Button 
                    onClick={handleAttachTemplate} 
                    disabled={!selectedTemplateId}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <File className="h-4 w-4 mr-2" />
                    Create from Document
                  </Button>
                </div>
              </div>

              <DialogFooter className="sm:justify-between mt-6 pt-4 border-t border-gray-100">
                <Button variant="ghost" onClick={() => setShowNewModal(true)}>
                  Create blank policy
                </Button>
                <Button variant="outline" onClick={() => setShowWizard(false)}>Cancel</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {selectedWizardType === 'CODE_OF_CONDUCT' && (
                <CodeOfConductWizard 
                  onCancel={() => setSelectedWizardType(null)}
                  onSuccess={() => {
                    setShowWizard(false);
                    setSelectedWizardType(null);
                    loadData();
                  }}
                />
              )}
              {selectedWizardType === 'ANTI_HARASSMENT' && (
                <AntiHarassmentWizard
                  onCancel={() => setSelectedWizardType(null)}
                  onSuccess={() => {
                    setShowWizard(false);
                    setSelectedWizardType(null);
                    loadData();
                  }}
                />
              )}
              {selectedWizardType === 'WHS' && (
                <WhsWizard
                  onCancel={() => setSelectedWizardType(null)}
                  onSuccess={() => {
                    setShowWizard(false);
                    setSelectedWizardType(null);
                    loadData();
                  }}
                />
              )}
              {selectedWizardType === 'CYBER_SECURITY' && (
                <CyberSecurityWizard
                  onCancel={() => setSelectedWizardType(null)}
                  onSuccess={() => {
                    setShowWizard(false);
                    setSelectedWizardType(null);
                    loadData();
                  }}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}