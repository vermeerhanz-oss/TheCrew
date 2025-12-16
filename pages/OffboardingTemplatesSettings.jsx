import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Plus,
  ArrowLeft,
  Pencil,
  Trash2,
  ChevronRight,
  Loader2,
  ClipboardList,
  FileText,
  AlertTriangle
} from 'lucide-react';
import OffboardingTemplateWizard from '@/components/offboarding/OffboardingTemplateWizard';
import QuickOffboardingTemplateWizard from '@/components/offboarding/QuickOffboardingTemplateWizard';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { toast } from 'sonner';

export default function OffboardingTemplatesSettings() {
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId;
  const api = useTenantApi();
  
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [taskCount, setTaskCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false); // Advanced wizard
  const [showQuickWizard, setShowQuickWizard] = useState(false); // Quick wizard
  const [wizardTemplateId, setWizardTemplateId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { isAllowed, isLoading: permLoading } = useRequirePermission(employeeCtx, 'canManageCompanySettings', {
    requireAdminMode: true,
    message: 'You need admin access to manage offboarding templates.',
  });

  // FIX: Reload templates when returning from wizards or on URL param change
  useEffect(() => {
    if (tenantId && isAllowed) {
      console.log('[OffboardingTemplates] API keys:', {
        templates: !!api?.offboardingTemplates,
        taskTemplates: !!api?.offboardingTaskTemplates
      });
      loadTemplates();
      
      // FIX: Check for URL param templateId and open it
      const urlParams = new URLSearchParams(window.location.search);
      const templateIdParam = urlParams.get('templateId');
      if (templateIdParam) {
        setWizardTemplateId(templateIdParam);
        setShowWizard(true);
        // Clean URL after opening
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else if (!permLoading && !isAllowed) {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isAllowed, permLoading]);

  useEffect(() => {
    if (selectedTemplate) {
      loadTaskCount(selectedTemplate.id);
    } else {
      setTaskCount(0);
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const data = await api.offboardingTemplates?.list() || [];
      const sorted = [...data].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
      setTemplates(sorted);
      if (sorted.length > 0 && !selectedTemplate) {
        setSelectedTemplate(sorted[0]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load offboarding templates');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTaskCount = async (templateId) => {
    try {
      const tasks = await api.offboardingTaskTemplates?.filter({ template_id: templateId }) || [];
      setTaskCount(tasks.length);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load template tasks');
    }
  };

  const handleCreate = () => {
    setWizardTemplateId(null);
    setShowQuickWizard(true);
  };

  const handleEdit = (template) => {
    setWizardTemplateId(template.id);
    setShowWizard(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    setIsDeleting(true);
    try {
      const tasks = await api.offboardingTaskTemplates?.filter({ template_id: deleteConfirm.id }) || [];
      for (const task of tasks) {
        await api.offboardingTaskTemplates?.delete(task.id);
      }
      await api.offboardingTemplates?.delete(deleteConfirm.id);

      if (selectedTemplate?.id === deleteConfirm.id) {
        setSelectedTemplate(null);
      }

      setDeleteConfirm(null);
      await loadTemplates();
      toast.success('Offboarding template deleted');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete offboarding template');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleWizardSuccess = async () => {
    // FIX: Force reload templates after wizard success
    console.log('[OffboardingTemplates] Wizard success, reloading templates');
    await loadTemplates();
    
    if (wizardTemplateId && selectedTemplate?.id === wizardTemplateId) {
      api.offboardingTemplates?.get(wizardTemplateId)
        .then((template) => {
          setSelectedTemplate(template);
          loadTaskCount(template.id);
        })
        .catch((err) => {
          console.error('Error refreshing template:', err);
        });
    }
  };

  if (permLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAllowed) {
    // useRequirePermission will usually show a toast or banner; we just render nothing
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('CompanySettings')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offboarding Templates</h1>
          <p className="text-gray-500">
            Create reusable offboarding checklists to ensure smooth, compliant exits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Templates</h2>
                <Button size="sm" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>

              {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ClipboardList className="h-10 w-10 text-gray-300 mb-3" />
                  <h3 className="text-gray-900 font-medium mb-1">No templates yet</h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto mb-4">
                    Create your first offboarding template to standardise employee exits.
                  </p>
                  <Button size="sm" onClick={handleCreate}>
                    Create First Template
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {template.name}
                            </span>
                            {!template.active && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2 mt-1">
                            {template.department && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-gray-500 font-normal"
                              >
                                {template.department}
                              </Badge>
                            )}
                            {template.exit_type && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-gray-500 font-normal capitalize"
                              >
                                {template.exit_type}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Template Summary */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Card>
              <CardContent className="p-8 text-center space-y-6">
                <div>
                  <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {selectedTemplate.name}
                  </h2>
                  <p className="text-gray-500 mt-1">
                    {selectedTemplate.description || 'No description provided'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Exit Type</div>
                    <div className="font-medium text-gray-900 capitalize">
                      {selectedTemplate.exit_type || 'Voluntary'}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Department</div>
                    <div className="font-medium text-gray-900">
                      {selectedTemplate.department || 'None'}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Tasks</div>
                    <div className="font-medium text-gray-900">{taskCount} configured</div>
                  </div>
                </div>

                <div className="flex justify-center gap-3 pt-4">
                  <Button onClick={() => handleEdit(selectedTemplate)} className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit Template
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                    onClick={() => setDeleteConfirm(selectedTemplate)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Select a template to view details</p>
                <Button variant="outline" className="mt-4" onClick={handleCreate}>
                  Create New Template
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <OffboardingTemplateWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        templateId={wizardTemplateId}
        onSuccess={handleWizardSuccess}
      />

      <QuickOffboardingTemplateWizard
        open={showQuickWizard}
        onOpenChange={setShowQuickWizard}
        onSuccess={handleWizardSuccess}
        onSwitchToAdvanced={() => {
          setShowQuickWizard(false);
          setTimeout(() => setShowWizard(true), 100);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Template
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This will also remove all associated tasks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}