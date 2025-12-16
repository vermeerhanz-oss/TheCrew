import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Calendar, User, FileText, Shield, Users, Download, File, Upload, RefreshCw, Trash2, Link as LinkIcon } from 'lucide-react';
import TemplateDocumentViewer from '@/components/documents/TemplateDocumentViewer';
import { ConfirmDeleteDialog } from '@/components/common/ConfirmDeleteDialog';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import AcknowledgementsListDialog from '@/components/policies/AcknowledgementsListDialog';
import { toast } from 'sonner';

const Policy = base44.entities.Policy;

export default function PolicyDetail() {
  const [policy, setPolicy] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [context, setContext] = useState(null);
  const [ackStats, setAckStats] = useState({ total: 0, acknowledged: 0 });
  const [showAckDialog, setShowAckDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);
      
      if (id) {
        let pol = null;
        try {
            // Try get first
            pol = await Policy.get(id); 
        } catch (e) {
            // Fallback to filter
            const policies = await Policy.filter({id: id});
            if (policies.length > 0) pol = policies[0];
        }

        if (pol) {
            setPolicy(pol);
            
            // Load stats if acknowledgement is required
            if (pol.requires_acknowledgement) {
                loadAckStats(pol.id);
            }
        }
      }
    } catch (error) {
      console.error("Error loading policy", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAckStats = async (policyId) => {
    try {
        const [employees, acks] = await Promise.all([
            base44.entities.Employee.filter({ status: 'active' }),
            base44.entities.PolicyAcknowledgement.filter({ policy_id: policyId })
        ]);
        setAckStats({
            total: employees.length,
            acknowledged: acks.length
        });
    } catch (e) {
        console.error("Failed to load stats", e);
    }
  };

  const handleToggleAcknowledgement = async (enabled) => {
    if (!policy) return;
    try {
        await Policy.update(policy.id, { requires_acknowledgement: enabled });
        setPolicy(prev => ({ ...prev, requires_acknowledgement: enabled }));
        if (enabled) {
            loadAckStats(policy.id);
            toast.success("Acknowledgement requirement enabled");
        } else {
            toast.success("Acknowledgement requirement disabled");
        }
    } catch (error) {
        console.error("Failed to update policy", error);
        toast.error("Failed to update policy settings");
    }
  };

  const { isAllowed } = useRequirePermission(context, 'canManagePolicies', {
     requireAdminMode: true
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const updatedPolicy = await Policy.update(policy.id, {
        file_url,
        file_name: file.name,
        file_mime_type: file.type,
        file_size_bytes: file.size,
        has_uploaded_file: true
      });
      
      setPolicy(updatedPolicy);
      toast.success("Document uploaded successfully");
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Failed to upload document");
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleRemoveFile = async () => {
    try {
      const updatedPolicy = await Policy.update(policy.id, {
        file_url: null,
        file_name: null,
        file_mime_type: null,
        file_size_bytes: null,
        has_uploaded_file: false
      });
      setPolicy(updatedPolicy);
      toast.success("Document removed");
      setShowRemoveConfirm(false);
    } catch (error) {
        console.error("Remove failed", error);
        toast.error("Failed to remove document");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Policy not found.</p>
        <Link to={createPageUrl('PolicyLibrary')}>
          <Button variant="outline" className="mt-4">Back to Library</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to={createPageUrl('PolicyLibrary')}>
            <Button variant="ghost" size="sm" className="mb-2 pl-0 hover:bg-transparent hover:text-blue-600">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Library
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{policy.name}</h1>
            <Badge variant={policy.is_active ? "default" : "secondary"}>
              {policy.is_active ? 'Active' : 'Archived'}
            </Badge>
          </div>
          <p className="text-gray-500 mt-1">{policy.description}</p>
        </div>
        
        {/* Future edit actions */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Metadata Sidebar */}
        <div className="space-y-4">
          {isAllowed && (
            <Card className="bg-indigo-50 border-indigo-100">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ack-toggle" className="font-medium text-indigo-900 cursor-pointer">Require Acknowledgement</Label>
                  <Switch 
                    id="ack-toggle" 
                    checked={policy.requires_acknowledgement}
                    onCheckedChange={handleToggleAcknowledgement}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="mandatory-toggle" className="font-medium text-indigo-900 cursor-pointer">Mandatory for All</Label>
                  <Switch 
                    id="mandatory-toggle" 
                    checked={policy.is_mandatory}
                    onCheckedChange={async (checked) => {
                        await Policy.update(policy.id, { is_mandatory: checked });
                        setPolicy(prev => ({ ...prev, is_mandatory: checked }));
                        toast.success(checked ? "Policy marked as mandatory" : "Policy no longer mandatory");
                    }}
                  />
                </div>
                
                {policy.requires_acknowledgement && (
                  <div className="pt-2 border-t border-indigo-200/50 space-y-3">
                    <p className="text-xs text-indigo-800">
                      When enabled, active employees will see this policy in their self-service portal and will be asked to accept it.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-white rounded p-2">
                        <div className="text-lg font-bold text-green-600">{ackStats.acknowledged}</div>
                        <div className="text-xs text-gray-500">Accepted</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-lg font-bold text-amber-600">{ackStats.total - ackStats.acknowledged}</div>
                        <div className="text-xs text-gray-500">Pending</div>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      onClick={() => setShowAckDialog(true)}
                    >
                      <Users className="h-3 w-3 mr-2" />
                      View Status
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Type</p>
                <div className="flex items-center gap-2 mt-1">
                  <Shield className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">{policy.type || 'Standard'}</span>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Category</p>
                <div className="flex items-center gap-2 mt-1">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">{policy.category || 'General'}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Effective Date</p>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">
                    {policy.effective_date ? format(new Date(policy.effective_date), 'MMM d, yyyy') : '—'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Owner</p>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">{policy.owner || '—'}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Mandatory</p>
                <div className="mt-1">
                  {policy.is_mandatory ? (
                    <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Yes</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500">No</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          
          {/* Template Display */}
          {policy.template_id ? (
            <Card className="bg-indigo-50 border-indigo-100">
              <CardContent className="p-6">
                 <div className="flex items-start gap-4 mb-4">
                    <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                       <LinkIcon className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                       <h3 className="font-semibold text-indigo-900">Linked to Document</h3>
                       <p className="text-sm text-indigo-700 mt-1">
                         This policy is sourced from a standardized document. Updates to the document version will need to be synced manually (coming soon).
                       </p>
                       {policy.template_version_label && (
                         <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-200 mt-2">
                           Version: {policy.template_version_label}
                         </Badge>
                       )}
                    </div>
                 </div>
                 <TemplateDocumentViewer templateId={policy.template_id} />
              </CardContent>
            </Card>
          ) : policy.has_uploaded_file ? (
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <File className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Policy Document</h3>
                    <div className="text-sm text-gray-500 mt-1 space-y-1">
                      <p>This policy is managed as an uploaded document.</p>
                      {(policy.file_size_bytes || policy.file_name) && (
                        <p className="font-medium text-gray-700">
                          {policy.file_name} 
                          {policy.file_size_bytes && ` • ${(policy.file_size_bytes / 1024 / 1024).toFixed(2)} MB`}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <a href={policy.file_url} target="_blank" rel="noopener noreferrer" download>
                        <Button className="gap-2">
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </a>
                      
                      {isAllowed && (
                        <>
                          <div className="relative">
                            <input
                              type="file"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={handleFileUpload}
                              accept=".pdf,.doc,.docx,.txt"
                              disabled={isUploading}
                            />
                            <Button variant="outline" disabled={isUploading} className="gap-2">
                              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              Replace document
                            </Button>
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            onClick={() => setShowRemoveConfirm(true)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                    {isAllowed && (
                      <p className="text-xs text-gray-400 mt-2">
                        Uploading a new document replaces the existing file and will be shown to employees going forward.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : isAllowed ? (
            <Card className="bg-slate-50 border-slate-200 border-dashed">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <Upload className="h-8 w-8 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Policy Document</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      You can upload a PDF or Word version of this policy. Employees will be able to download and acknowledge this document.
                    </p>
                    <div className="mt-4 relative inline-block">
                      <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.txt"
                        disabled={isUploading}
                      />
                      <Button variant="outline" disabled={isUploading} className="gap-2">
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Upload document
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="min-h-[500px]">
            <CardContent className="p-8">
              {policy.has_uploaded_file && policy.content && (
                <div className="mb-6 pb-6 border-b border-gray-100">
                   <h3 className="text-sm font-bold uppercase text-gray-500 mb-2">Summary / Notes</h3>
                   <div className="prose prose-slate max-w-none prose-sm">
                     <ReactMarkdown>{policy.content}</ReactMarkdown>
                   </div>
                </div>
              )}
              
              {!policy.has_uploaded_file && policy.content ? (
                <article className="prose prose-slate max-w-none">
                  <ReactMarkdown>{policy.content}</ReactMarkdown>
                </article>
              ) : !policy.has_uploaded_file && !policy.content ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No content available for this policy.</p>
                </div>
              ) : null}
              
              {policy.has_uploaded_file && !policy.content && (
                 <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">Please review the uploaded document above.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AcknowledgementsListDialog 
        open={showAckDialog} 
        onOpenChange={setShowAckDialog} 
        policy={policy} 
      />

      <ConfirmDeleteDialog 
        open={showRemoveConfirm}
        onCancel={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemoveFile}
        title="Remove document?"
        description="Removing this document will mean employees can no longer download it. Any previous acknowledgements will remain recorded. Are you sure?"
        confirmLabel="Remove Document"
      />
    </div>
  );
}