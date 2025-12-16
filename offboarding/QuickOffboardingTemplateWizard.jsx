// src/components/offboarding/QuickOffboardingTemplateWizard.jsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Loader2, Sparkles, FileText, Plus, Trash2, Shield, Briefcase } from 'lucide-react';
import { getOffboardingDepartmentPresets } from '@/components/utils/offboardingTaskPresets';
import { getEmployeeSelectLabel } from '@/components/utils/displayName';
import DocumentTemplateSelect from '@/components/documents/DocumentTemplateSelect';
import { toast } from 'sonner';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';

// Template debug utility
import { debugTemplatePipeline } from '@/components/utils/templateDebug';

export default function QuickOffboardingTemplateWizard({
  open,
  onOpenChange,
  onSuccess,
  onSwitchToAdvanced
}) {
  const api = useTenantApi();
  const ctx = useEmployeeContext();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    departmentId: '',
    exit_type: 'voluntary',
    owner_id: '',
  });

  const [selectedTasks, setSelectedTasks] = useState([]);
  const [customTasks, setCustomTasks] = useState([]);
  const [newCustomTask, setNewCustomTask] = useState('');

  const [terminationDocId, setTerminationDocId] = useState('');
  const [exitDocIds, setExitDocIds] = useState([]);

  useEffect(() => {
    if (!open) return;

    const reset = () => {
      setFormData({ name: '', departmentId: '', exit_type: 'voluntary', owner_id: '' });
      setSelectedTasks([]);
      setCustomTasks([]);
      setNewCustomTask('');
      setTerminationDocId('');
      setExitDocIds([]);
    };

    const loadData = async () => {
      setLoading(true);
      try {
        console.log('[TemplatesDebug] Offboarding Quick Creator API keys', {
          __entityId: api?.__entityId,
          offboardingTemplates: !!api?.offboardingTemplates,
          offboardingTaskTemplates: !!api?.offboardingTaskTemplates,
          departments: !!api?.departments,
          employees: !!api?.employees,
        });

        if (!ctx?.tenantId || !api?.__entityId) {
          toast.error('Workspace not ready yet (no tenant scope).');
          setDepartments([]); setEmployees([]);
          return;
        }

        const depts = ctx?.departments?.length ? ctx.departments : await api?.departments?.list?.().catch(() => []);
        const emps  = ctx?.employees?.length ? ctx.employees   : await api?.employees?.list?.().catch(() => []);

        setDepartments(depts || []);
        setEmployees(emps || []);
      } catch (e) {
        console.error('[OffboardingQC] loadData failed', e);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    reset();
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!formData.departmentId) return setSelectedTasks([]);
    const dept = departments.find(d => d.id === formData.departmentId);
    const presets = getOffboardingDepartmentPresets(dept?.name || '') || [];
    setSelectedTasks(presets.map(t => t.id));
  }, [formData.departmentId, departments]);

  const handleAddCustomTask = () => {
    if (!newCustomTask.trim()) return;
    setCustomTasks(prev => [...prev, { id: `custom-${Date.now()}`, title: newCustomTask.trim() }]);
    setNewCustomTask('');
  };

  const handleRemoveCustomTask = (id) => setCustomTasks(prev => prev.filter(t => t.id !== id));

  const handleSubmit = async () => {
    if (!api?.__entityId || !ctx?.tenantId) return toast.error('Workspace not ready yet.');
    if (!api?.offboardingTemplates || !api?.offboardingTaskTemplates) {
      return toast.error('Template APIs not ready — refresh and try again.');
    }

    if (!formData.name.trim() || !formData.departmentId || !formData.owner_id) {
      return toast.error("Please fill in required fields (Name, Department, Owner)");
    }

    setSubmitting(true);
    try {
      const dept = departments.find(d => d.id === formData.departmentId);
      const deptName = dept?.name || '';
      if (!deptName) throw new Error('Selected department not found');

      // IMPORTANT: let tenantApi inject entity scope (do NOT set entity_id:null)
      const templatePayload = {
        name: formData.name.trim(),
        department: deptName,
        exit_type: formData.exit_type,
        employment_type: 'full_time',
        termination_template_id: terminationDocId || null,
        exit_document_template_ids: exitDocIds.filter(Boolean),
        meta: {
          primary_owner_id: formData.owner_id,
          department_id: formData.departmentId,
          default_entity_id: null,
          automations: { notify_manager: true, notify_it: true }
        }
      };

      const template = await api.offboardingTemplates.create(templatePayload);
      if (!template?.id) throw new Error('Template create returned no ID');

      const presets = getOffboardingDepartmentPresets(deptName) || [];
      const assigneeMap = { MANAGER: 'manager', HR: 'hr', IT: 'it', FINANCE: 'finance', EMPLOYEE: 'employee' };

      const tasksToCreate = [];

      presets.forEach((t) => {
        if (!selectedTasks.includes(t.id)) return;
        tasksToCreate.push({
          template_id: template.id,
          title: t.title,
          description: t.title,
          assigned_to: assigneeMap[t.owner] || 'hr', // ✅ REQUIRED FIELD
          required: true,
        });
      });

      customTasks.forEach((t) => {
        tasksToCreate.push({
          template_id: template.id,
          title: t.title,
          description: t.title,
          assigned_to: 'manager',
          required: true,
        });
      });

      tasksToCreate.forEach((t, idx) => { t.order_index = idx; });

      if (tasksToCreate.length) {
        await api.offboardingTaskTemplates.bulkCreate(tasksToCreate);
      }

      const verify = await api.offboardingTaskTemplates.filter({ template_id: template.id });
      await debugTemplatePipeline('OffboardingQC.verify', api, template.id);
      console.log('[OffboardingQC] verify scoped', { count: verify?.length || 0 });

      toast.success(`Offboarding template created with ${verify?.length || 0} tasks`);
      onSuccess?.(template.id);
      onOpenChange(false);
    } catch (e) {
      console.error('[OffboardingQC] create failed', e);
      toast.error(`Failed to create template: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const currentDept = departments.find(d => d.id === formData.departmentId);
  const currentPresets = currentDept ? (getOffboardingDepartmentPresets(currentDept.name) || []) : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && submitting) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 bg-slate-50 border-b flex-shrink-0">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Quick Creator</span>
          </div>
          <DialogTitle className="text-xl">New Offboarding Template</DialogTitle>
          <DialogDescription>Create a best-practice offboarding template in seconds.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : (
            <>
              {/* Basics */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Basics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Template Name *</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <Select value={formData.departmentId} onValueChange={(v) => setFormData({ ...formData, departmentId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select department..." /></SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Exit Type *</Label>
                    <Select value={formData.exit_type} onValueChange={(v) => setFormData({ ...formData, exit_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="voluntary">Resignation</SelectItem>
                        <SelectItem value="redundancy">Redundancy</SelectItem>
                        <SelectItem value="end_of_contract">End of contract</SelectItem>
                        <SelectItem value="involuntary">Performance termination</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Responsible Owner *</Label>
                    <Select value={formData.owner_id} onValueChange={(v) => setFormData({ ...formData, owner_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{getEmployeeSelectLabel(e, departments)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Tasks</h3>
                  <span className="text-xs text-slate-500">We’ll create these tasks relative to the last working day.</span>
                </div>

                {!formData.departmentId ? (
                  <p className="text-sm text-slate-500 italic">Select a department to view recommended tasks.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-lg p-4 border space-y-2">
                      {currentPresets.map((task) => (
                        <div key={task.id} className="flex items-start gap-2">
                          <Checkbox
                            id={`task-${task.id}`}
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={(c) =>
                              setSelectedTasks(prev => c ? [...prev, task.id] : prev.filter(id => id !== task.id))
                            }
                          />
                          <Label htmlFor={`task-${task.id}`} className="text-sm font-normal cursor-pointer leading-tight pt-0.5">
                            {task.title} <span className="text-xs text-slate-500 ml-2">({task.owner})</span>
                          </Label>
                        </div>
                      ))}
                    </div>

                    {customTasks.length > 0 && (
                      <div className="space-y-2">
                        {customTasks.map((t) => (
                          <div key={t.id} className="flex items-center justify-between bg-white border rounded px-3 py-2">
                            <span className="text-sm">{t.title}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveCustomTask(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Input
                        placeholder="Add custom task..."
                        value={newCustomTask}
                        onChange={(e) => setNewCustomTask(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTask(); } }}
                        className="text-sm"
                      />
                      <Button variant="outline" size="sm" onClick={handleAddCustomTask}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Exit Documents (optional)</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Attach Primary Exit Letter Template</Label>
                    <DocumentTemplateSelect category="OFFBOARDING" value={terminationDocId} onChange={setTerminationDocId} />
                  </div>

                  <div className="space-y-2">
                    <Label>Exit Checklists & Other Docs</Label>
                    {exitDocIds.map((id, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <DocumentTemplateSelect
                          category="OFFBOARDING"
                          value={id}
                          onChange={(v) => {
                            const next = [...exitDocIds];
                            next[idx] = v;
                            setExitDocIds(next);
                          }}
                        />
                        <Button variant="ghost" size="icon" onClick={() => setExitDocIds(ids => ids.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setExitDocIds(ids => [...ids, ''])}>
                      <Plus className="h-4 w-4 mr-2" /> Add Document
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50 flex-col sm:flex-row gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            onClick={onSwitchToAdvanced}
            disabled={submitting}
            className="text-slate-500 hover:text-slate-900 sm:mr-auto"
          >
            Use Advanced Editor
          </Button>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSubmit} disabled={submitting || loading}>
              {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>) : 'Save Template'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}