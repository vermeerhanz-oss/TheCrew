import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ArrowLeft,
  Pencil,
  Trash2,
  ChevronRight,
  Loader2,
  ClipboardList,
  FileText
} from 'lucide-react';
import OnboardingTemplateWizard from '@/components/onboarding/OnboardingTemplateWizard';
import QuickOnboardingTemplateWizard from '@/components/onboarding/QuickOnboardingTemplateWizard';
import { toast } from 'sonner';

export default function OnboardingTemplatesSettings() {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId;

  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [taskCount, setTaskCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardTemplateId, setWizardTemplateId] = useState(null);
  const [wizardMode, setWizardMode] = useState('quick'); // 'quick' | 'advanced'

  useEffect(() => {
    if (tenantId && api) {
      loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (selectedTemplate) {
      loadTaskCount(selectedTemplate.id);
    } else {
      setTaskCount(0);
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    if (!api?.onboardingTemplates) {
      console.error('[OnboardingTemplates] API not ready');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.onboardingTemplates.list();
      const list = data || [];
      setTemplates(list);

      if (list.length === 0) {
        setSelectedTemplate(null);
        return;
      }

      // Keep current selection if it still exists, otherwise pick first
      setSelectedTemplate(prev =>
        prev && list.find(t => t.id === prev.id) ? prev : list[0]
      );
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load onboarding templates');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTaskCount = async (templateId) => {
    if (!api?.onboardingTaskTemplates) return;
    
    try {
      const tasks = await api.onboardingTaskTemplates.filter({ template_id: templateId });
      setTaskCount(tasks.length);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTaskCount(0);
    }
  };

  // NEW TEMPLATE → Quick wizard
  const handleCreate = () => {
    setWizardTemplateId(null);
    setWizardMode('quick');
    setShowWizard(true);
  };

  // EDIT TEMPLATE → Advanced wizard
  const handleEdit = (template) => {
    setWizardTemplateId(template.id);
    setWizardMode('advanced');
    setShowWizard(true);
  };

  const handleDelete = async (template) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    if (!api?.onboardingTemplates || !api?.onboardingTaskTemplates) {
      toast.error('API not ready');
      return;
    }

    try {
      const tasks = await api.onboardingTaskTemplates.filter({ template_id: template.id });
      for (const task of tasks) {
        await api.onboardingTaskTemplates.delete(task.id);
      }

      await api.onboardingTemplates.delete(template.id);

      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate(null);
      }

      await loadTemplates();
      toast.success('Template deleted');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  // Called by both Quick and Advanced wizards after save
  // QuickOnboardingTemplateWizard now calls onSuccess(template.id)
  const handleWizardSuccess = async (templateId) => {
    console.log('[OnboardingTemplates] Wizard success, reloading templates');
    await loadTemplates();

    if (templateId && api?.onboardingTemplates) {
      try {
        const fresh = await api.onboardingTemplates.get(templateId);
        setSelectedTemplate(fresh);
      } catch (e) {
        console.error('Error refreshing selected template:', e);
      }
    }

    // Close wizard and reset mode back to quick for next "New"
    setShowWizard(false);
    setWizardMode('quick');
    setWizardTemplateId(null);
  };

  // Shared handler for Dialog open/close from both wizards
  const handleWizardOpenChange = (open) => {
    setShowWizard(open);
    if (!open) {
      // Reset for next time
      setWizardMode('quick');
      setWizardTemplateId(null);
    }
  };

  // Triggered when user clicks "Use Advanced Editor" inside Quick wizard
  // Here we just switch mode; advanced wizard will open with a "new" template
  const handleSwitchToAdvanced = () => {
    setWizardMode('advanced');
    // keep showWizard = true so the advanced wizard replaces the quick one
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('OnboardingDashboard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding Templates</h1>
          <p className="text-gray-500">
            Create reusable onboarding checklists for each role or department.
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
                    Create your first onboarding template to streamline new hire setup.
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
                          ? 'border-indigo-500 bg-indigo-50'
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
                            {template.meta?.role && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-gray-500 font-normal"
                              >
                                {template.meta.role}
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
                  <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-indigo-600" />
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
                    <div className="text-sm text-gray-500 mb-1">Department</div>
                    <div className="font-medium text-gray-900">
                      {selectedTemplate.department || 'None'}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Role Title</div>
                    <div className="font-medium text-gray-900">
                      {selectedTemplate.meta?.role || 'Any'}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Tasks</div>
                    <div className="font-medium text-gray-900">
                      {taskCount} configured
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-3 pt-4">
                  <Button
                    onClick={() => handleEdit(selectedTemplate)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Template
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                    onClick={() => handleDelete(selectedTemplate)}
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
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleCreate}
                >
                  Create New Template
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Wizard: Quick vs Advanced */}
      {wizardMode === 'advanced' ? (
        <OnboardingTemplateWizard
          open={showWizard}
          onOpenChange={handleWizardOpenChange}
          templateId={wizardTemplateId}
          onSuccess={handleWizardSuccess}
        />
      ) : (
        <QuickOnboardingTemplateWizard
          open={showWizard}
          onOpenChange={handleWizardOpenChange}
          onSuccess={handleWizardSuccess}
          onSwitchToAdvanced={handleSwitchToAdvanced}
        />
      )}
    </div>
  );
}