import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  ArrowRight, Save, Loader2, FileText, Building2, Briefcase, Settings, Plus, Trash2, GripVertical
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import DocumentTemplateSelect from '@/components/documents/DocumentTemplateSelect';
import { toast } from 'sonner';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { getScopeStatus } from '@/components/utils/scopeReady';
import { debugTemplatePipeline } from '@/components/utils/templateDebug';

const STEPS = [
  { id: 1, label: "Basics", icon: FileText },
  { id: 2, label: "Context", icon: Building2 },
  { id: 3, label: "Documents", icon: Briefcase },
  { id: 4, label: "Tasks", icon: Settings },
  { id: 5, label: "Review", icon: Save },
];

export default function OffboardingTemplateWizard({ open, onOpenChange, templateId, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [entities, setEntities] = useState([]);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    exit_type: 'voluntary',
    department: 'None',
    custom_department: '',
    employment_types: ['full_time'],
    
    default_entity_id: 'Any',
    
    termination_template_id: '',
    exit_document_template_ids: [],
    
    tasks: [],
    
    automations: {
      notify_manager: true,
      notify_it: true,
    },
  });

  const employeeCtx = useEmployeeContext();
  const api = useTenantApi();
  const { scopeReady, entityId } = getScopeStatus(api, employeeCtx);

  const validateStep = (currentStep) => {
    const newErrors = {};
    let isValid = true;

    if (currentStep === 1) {
      if (!formData.name?.trim()) {
        newErrors.name = "Please enter a name for this offboarding template.";
        isValid = false;
      }
    }

    if (currentStep === 2) {
      if (!formData.default_entity_id) {
        newErrors.default_entity_id = "Please choose a default entity or select 'Any entity'.";
        isValid = false;
      }
    }

    if (currentStep === 4) {
      formData.tasks.forEach((task, index) => {
        if (!task.title?.trim()) {
          newErrors[`task_${index}_title`] = "Task title is required.";
          isValid = false;
        }
      });
    }

    setErrors(newErrors);
    return isValid;
  };

  const validateAll = () => {
    const newErrors = {};
    let isValid = true;

    if (!formData.name?.trim()) {
      newErrors.name = "Template name is required.";
      isValid = false;
    }
    if (!formData.default_entity_id) {
      newErrors.default_entity_id = "Required.";
      isValid = false;
    }

    if (formData.tasks.length === 0) {
      newErrors.general = "This template has no tasks. Please add at least one offboarding task.";
      isValid = false;
    } else {
      formData.tasks.forEach((task, index) => {
        if (!task.title?.trim()) {
          newErrors[`task_${index}_title`] = "Required.";
          isValid = false;
        }
      });
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    } else {
      toast.error("Please fix the errors before proceeding.");
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
      setStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const tenantId = employeeCtx?.tenantId || null;
      
      // AI FIX: Debug log API surface availability
      console.log('[TemplatesDebug] Offboarding API keys:', {
        offboardingTemplates: !!api?.offboardingTemplates,
        offboardingTaskTemplates: !!api?.offboardingTaskTemplates,
        departments: !!api?.departments,
      });

      if (!tenantId) {
        setDepartments([]);
        setLocations([]);
        setEntities([]);
        setLoading(false);
        return;
      }

      // AI FIX: Use context first, API fallback second
      const depts = employeeCtx?.departments?.length > 0
        ? employeeCtx.departments
        : await api?.departments?.list?.().catch(() => []) ?? [];
      
      const locs = await api?.locations?.list?.().catch(() => []) ?? [];
      const ents = await api?.entities?.filter?.({ id: employeeCtx.tenantId }).catch(() => []) ?? [];

      console.log('[OffboardingTemplateWizard] departments count:', depts?.length ?? 0);
      
      setDepartments(depts || []);
      setLocations(locs || []);
      setEntities(ents || []);

      if (templateId) {
        // FIX: Check if API exists before loading
        if (!api?.offboardingTemplates || !api?.offboardingTaskTemplates) {
          console.error('[OffboardingTemplateWizard] API not ready:', {
            templates: !!api?.offboardingTemplates,
            taskTemplates: !!api?.offboardingTaskTemplates
          });
          setFormData({
            name: '',
            description: '',
            exit_type: 'voluntary',
            department: 'None',
            custom_department: '',
            employment_types: [],
            default_entity_id: 'Any',
            termination_template_id: '',
            exit_document_template_ids: [],
            tasks: [],
            automations: { notify_manager: true, notify_it: true }
          });
          setLoading(false);
          return;
        }

        const template = await api.offboardingTemplates.get(templateId).catch(() => null);
        if (!template) {
          console.error('[OffboardingTemplateWizard] Template not found:', templateId);
          setLoading(false);
          return;
        }

        const tasks = await api.offboardingTaskTemplates.filter({ template_id: templateId }).catch(() => []) ?? [];
        
        console.log('[OffboardingTemplateWizard] Loaded template:', templateId, 'tasks count:', tasks?.length ?? 0);

        setFormData({
          name: template.name,
          description: template.description || '',
          exit_type: template.exit_type || 'voluntary',
          department: template.department || 'None',
          custom_department: template.meta?.custom_department || '',
          employment_types: template.meta?.employment_types || [template.employment_type].filter(Boolean),
          
          default_entity_id: template.meta?.default_entity_id || 'Any',
          
          termination_template_id: template.termination_template_id || '',
          exit_document_template_ids: template.exit_document_template_ids || [],
          
          tasks: tasks
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
            .map(t => ({
              ...t,
              id: t.id,
              tempId: Math.random().toString(36).substr(2, 9),
              assignee_role: t.assigned_to || t.assignee_role || 'hr',
            })),
          
          automations: template.meta?.automations || { notify_manager: true, notify_it: true },
        });
      } else {
        setFormData({
          name: '',
          description: '',
          exit_type: 'voluntary',
          department: 'None',
          custom_department: '',
          employment_types: ['full_time'],
          default_entity_id: 'Any',
          termination_template_id: '',
          exit_document_template_ids: [],
          tasks: [],
          automations: { notify_manager: true, notify_it: true },
        });
      }
    } catch (error) {
      console.error("Failed to load data", error);
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    await debugTemplatePipeline('OffboardingWizard.save', api, templateId);

    if (!validateAll()) {
      toast.error("We found a few things to fix before publishing.");
      return;
    }

    // STEP 3 GUARD: Check entityId
    if (!api?.__entityId) {
      console.error('[OffboardingTemplateWizard] Missing entityId in API scope');
      toast.error('Unable to save: tenant scope not ready');
      return;
    }

    if (!api?.offboardingTemplates) {
      console.error('[OffboardingTemplateWizard] api.offboardingTemplates is missing');
      toast.error('Template API not ready - please refresh');
      return;
    }

    setSaving(true);
    try {
      
      // AI FIX: Store UI-selected default_entity_id in meta, not entity_id (tenant scope must remain)
      const meta = {
        custom_department: formData.custom_department,
        employment_types: formData.employment_types,
        automations: formData.automations,
        default_entity_id: formData.default_entity_id === 'Any' ? null : formData.default_entity_id,
      };

      const payload = {
        name: formData.name,
        description: formData.description,
        exit_type: formData.exit_type,
        department:
          formData.department === 'Custom'
            ? formData.custom_department
            : formData.department === 'None'
              ? null
              : formData.department,
        employment_type: formData.employment_types[0] || null,
        termination_template_id: formData.termination_template_id || null,
        exit_document_template_ids: formData.exit_document_template_ids,
        meta,
      };

      let savedTemplate;
      if (templateId) {
        await api.offboardingTemplates.update(templateId, payload);
        savedTemplate = { id: templateId };
        console.log('[OffboardingTemplateWizard] Updated template:', templateId);
      } else {
        savedTemplate = await api.offboardingTemplates.create(payload);
        console.log('[OffboardingTemplateWizard] Created template:', savedTemplate?.id);
      }

      if (!savedTemplate?.id) {
        throw new Error('Template save returned no ID');
      }

      // AI FIX: Use api.offboardingTaskTemplates (tenant-scoped) not direct entity
      if (templateId) {
        const existingTasks = await api?.offboardingTaskTemplates?.filter?.({ template_id: templateId }).catch(() => []) ?? [];
        for (const t of existingTasks) {
          await api.offboardingTaskTemplates.delete(t.id);
        }
      }

      if (formData.tasks.length > 0) {
        const tasksToCreate = formData.tasks.map((t, idx) => ({
          template_id: savedTemplate.id,
          title: t.title,
          description: t.description,
          assigned_to: t.assigned_to || t.assignee_role || 'hr',
          order_index: idx,
          required: true,
        }));
        await api.offboardingTaskTemplates.bulkCreate(tasksToCreate);
        console.log('[OffboardingTemplateWizard] Bulk created', tasksToCreate.length, 'task templates');
      }

      const verifyTasks = await api.offboardingTaskTemplates.filter({ template_id: savedTemplate.id });
      await debugTemplatePipeline('OffboardingWizard.verify', api, savedTemplate.id);

      toast.success(`Template saved with ${verifyTasks.length} tasks`);
      onSuccess?.(savedTemplate.id);
      onOpenChange(false);
    } catch (error) {
      console.error('[OffboardingTemplateWizard] Save failed:', error);
      const errorDetail = error?.response?.data?.detail || error?.detail || error.message;
      toast.error(`Failed to save template: ${errorDetail}`);
    } finally {
      setSaving(false);
    }
  };

  const addTask = () => {
    setFormData(prev => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        {
          tempId: Math.random().toString(36).substr(2, 9),
          title: 'New Task',
          description: '',
          assignee_role: 'hr',
          assigned_to: 'hr',
        },
      ],
    }));
  };

  const removeTask = (index) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index),
    }));
  };

  const updateTask = (index, field, value) => {
    setFormData(prev => {
      const newTasks = [...prev.tasks];
      newTasks[index] = { ...newTasks[index], [field]: value };
      return { ...prev, tasks: newTasks };
    });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(formData.tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setFormData(prev => ({ ...prev, tasks: items }));
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl">
            {templateId ? 'Edit Offboarding Template' : 'Create Offboarding Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Stepper Sidebar */}
          <div className="w-64 bg-slate-50 border-r p-4 flex-shrink-0 overflow-y-auto">
            <div className="space-y-1">
              {STEPS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    step === s.id 
                      ? 'bg-red-100 text-red-700' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className={`p-1.5 rounded ${step === s.id ? 'bg-red-200' : 'bg-slate-200'}`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-8">
                
                {/* Step 1: Basics */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <Label>Template Name *</Label>
                        <Input 
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Voluntary Resignation - Standard"
                          className={errors.name ? "border-red-500" : ""}
                        />
                        {errors.name && (
                          <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                        )}
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea 
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Brief description..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Exit Type</Label>
                          <Select 
                            value={formData.exit_type}
                            onValueChange={(v) => setFormData({ ...formData, exit_type: v })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="voluntary">Voluntary</SelectItem>
                              <SelectItem value="involuntary">Involuntary</SelectItem>
                              <SelectItem value="redundancy">Redundancy</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Department</Label>
                          <Select 
                            value={formData.department}
                            onValueChange={(v) => setFormData({ ...formData, department: v })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="None">None</SelectItem>
                              {departments.map(d => (
                                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                              ))}
                              <SelectItem value="Custom">Custom...</SelectItem>
                            </SelectContent>
                          </Select>
                          {formData.department === 'Custom' && (
                            <Input 
                              className="mt-2"
                              placeholder="Custom department..."
                              value={formData.custom_department}
                              onChange={(e) =>
                                setFormData({ ...formData, custom_department: e.target.value })
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Context */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div>
                      <Label>Default Entity</Label>
                      <Select 
                        value={formData.default_entity_id}
                        onValueChange={(v) => setFormData({ ...formData, default_entity_id: v })}
                      >
                        <SelectTrigger className={errors.default_entity_id ? "border-red-500" : ""}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Any">Any entity</SelectItem>
                          {entities.map(e => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.default_entity_id && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.default_entity_id}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Documents */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div>
                      <Label>Termination Letter Document</Label>
                      <DocumentTemplateSelect 
                        category="OFFBOARDING"
                        value={formData.termination_template_id}
                        onChange={(v) =>
                          setFormData({ ...formData, termination_template_id: v })
                        }
                        placeholder="Select document..."
                      />
                    </div>

                    <div className="pt-4 border-t">
                      <Label>Exit Documents</Label>
                      <div className="space-y-2 mt-2">
                        {formData.exit_document_template_ids.map((id, idx) => (
                          <div key={idx} className="flex gap-2">
                            <DocumentTemplateSelect
                              category="OFFBOARDING"
                              value={id}
                              onChange={(v) => {
                                const newIds = [...formData.exit_document_template_ids];
                                newIds[idx] = v;
                                setFormData({ ...formData, exit_document_template_ids: newIds });
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newIds =
                                  formData.exit_document_template_ids.filter((_, i) => i !== idx);
                                setFormData({ ...formData, exit_document_template_ids: newIds });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setFormData(prev => ({
                              ...prev,
                              exit_document_template_ids: [
                                ...prev.exit_document_template_ids,
                                '',
                              ],
                            }))
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add Document
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Tasks */}
                {step === 4 && (
                  <div className="space-y-6 h-full flex flex-col">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Tasks</h3>
                      <Button onClick={addTask} size="sm">
                        <Plus className="h-4 w-4 mr-2" /> Add Task
                      </Button>
                    </div>

                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="off-tasks">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-3 flex-1"
                          >
                            {formData.tasks.map((task, index) => (
                              <Draggable
                                key={task.tempId || task.id}
                                draggableId={String(task.tempId || task.id)}
                                index={index}
                              >
                                {(provided) => (
                                  <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className="bg-white group"
                                  >
                                    <CardContent className="p-4 flex gap-4">
                                      <div
                                        {...provided.dragHandleProps}
                                        className="mt-2 text-gray-400 cursor-grab active:cursor-grabbing"
                                      >
                                        <GripVertical className="h-5 w-5" />
                                      </div>
                                      <div className="flex-1 grid gap-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div className="w-full">
                                            <Input 
                                              value={task.title} 
                                              onChange={(e) =>
                                                updateTask(index, 'title', e.target.value)
                                              }
                                              placeholder="Task Title"
                                              className={
                                                errors[`task_${index}_title`]
                                                  ? "border-red-500"
                                                  : ""
                                              }
                                            />
                                            {errors[`task_${index}_title`] && (
                                              <p className="text-xs text-red-500 mt-1">
                                                {errors[`task_${index}_title`]}
                                              </p>
                                            )}
                                          </div>
                                          <Select 
                                            value={task.assignee_role}
                                            onValueChange={(v) =>
                                              updateTask(index, 'assignee_role', v)
                                            }
                                          >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="hr">HR</SelectItem>
                                              <SelectItem value="manager">Manager</SelectItem>
                                              <SelectItem value="it">IT</SelectItem>
                                              <SelectItem value="employee">Employee</SelectItem>
                                              <SelectItem value="finance">Finance</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <Textarea 
                                          value={task.description}
                                          onChange={(e) =>
                                            updateTask(index, 'description', e.target.value)
                                          }
                                          placeholder="Description..."
                                          className="h-16 text-sm"
                                        />
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-400 opacity-0 group-hover:opacity-100"
                                        onClick={() => removeTask(index)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </CardContent>
                                  </Card>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                )}

                {/* Step 5: Review */}
                {step === 5 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium">Review Template</h3>

                    {Object.keys(errors).length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <h4 className="text-red-800 font-medium mb-2">
                          Please fix the following issues:
                        </h4>
                        <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                          {errors.name && <li>{errors.name}</li>}
                          {errors.default_entity_id && <li>Missing default entity</li>}
                          {errors.general && <li>{errors.general}</li>}
                          {Object.keys(errors).some(k => k.startsWith('task_')) && (
                            <li>Some tasks are missing required fields</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <Card>
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-gray-500">Name</Label>
                            <div className="font-medium">{formData.name}</div>
                          </div>
                          <div>
                            <Label className="text-gray-500">Exit Type</Label>
                            <div className="capitalize">{formData.exit_type}</div>
                          </div>
                          <div>
                            <Label className="text-gray-500">Tasks</Label>
                            <div>{formData.tasks.length} configured</div>
                          </div>
                        </div>
                        <div className="pt-4 border-t space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Notify Manager</Label>
                            <Switch 
                              checked={formData.automations.notify_manager}
                              onCheckedChange={(c) =>
                                setFormData(f => ({
                                  ...f,
                                  automations: {
                                    ...f.automations,
                                    notify_manager: !!c,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Notify IT</Label>
                            <Switch 
                              checked={formData.automations.notify_it}
                              onCheckedChange={(c) =>
                                setFormData(f => ({
                                  ...f,
                                  automations: {
                                    ...f.automations,
                                    notify_it: !!c,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-white flex-shrink-0">
          <div className="flex justify-between w-full">
            <Button
              variant="outline"
              onClick={() => (step > 1 ? setStep(step - 1) : onOpenChange(false))}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            <div className="flex gap-2">
              {step < 5 ? (
                <Button onClick={handleNext}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={saving || !scopeReady}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Publish Template
                </Button>
              )}
            </div>
          </div>

          {/* Scope readiness warning */}
          {!scopeReady && (
            <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
              <strong>Workspace is still loading.</strong> Please wait 1–2 seconds.
            </div>
          )}
        </DialogFooter>
          </DialogContent>
          </Dialog>
          );
          }