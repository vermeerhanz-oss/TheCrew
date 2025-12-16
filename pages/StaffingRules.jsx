import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { usePageAssistant } from '@/components/assistant/AssistantContext';
import { ConfirmDeleteDialog } from '@/components/common/ConfirmDeleteDialog';
import ErrorState from '@/components/common/ErrorState';
import { logApiError } from '@/components/utils/logger';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';

export default function StaffingRulesPage() {
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId;
  const api = useTenantApi();
  
  const [rules, setRules] = useState([]);
  const [entities, setEntities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [formData, setFormData] = useState({
    entity_id: '',
    department_id: '',
    min_active_headcount: '',
    max_concurrent_leave: '',
    is_active: true,
    notes: '',
  });

  const { isAllowed, isLoading: permLoading } = useRequirePermission(employeeCtx, 'canManageCompanySettings');

  usePageAssistant({
    contextKey: 'staffing-rules',
    systemPrompt: `
You are the FoundersCreW HRIS assistant. The user is viewing the Staffing Rules configuration page.

Your job is to:
- Explain the purpose of "Min Active Headcount" (minimum people required to work).
- Explain "Max Concurrent Leave" (limit on how many people can be away at once).
- Clarify how these rules interact with leave requests (generating warnings for managers).
- Help the user decide whether to apply rules globally, per entity, or per department.

Keep advice practical for workforce planning and coverage management.
    `,
    suggestedQuestions: [
      "What is Min Active Headcount?",
      "How does Max Concurrent Leave work?",
      "Should I set rules for each department?",
      "Will this block leave requests?"
    ]
  });

  useEffect(() => {
    if (tenantId && isAllowed) {
      loadData();
    } else if (!permLoading && !isAllowed) {
      setDataLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isAllowed, permLoading]);

  const loadData = async () => {
    if (!tenantId) return;
    
    setDataLoading(true);
    setError(null);
    setCurrentPage(1);
    
    try {
      const [rulesData, entitiesData, deptsData] = await Promise.all([
        api.staffingRules?.filter({ entity_id: tenantId }) || [],
        api.entities?.list() || [],
        api.departments?.filter({ entity_id: tenantId }) || [],
      ]);
      setRules(rulesData || []);
      setEntities(entitiesData || []);
      setDepartments(deptsData || []);
    } catch (err) {
      const userMsg = logApiError('StaffingRules', err);
      setError(userMsg);
    } finally {
      setDataLoading(false);
    }
  };

  const getEntityName = (id) => {
    if (!id) return 'All Entities';
    const entity = entities.find(e => e.id === id);
    return entity?.name || 'Unknown';
  };

  const getDepartmentName = (id) => {
    if (!id) return 'All Departments';
    const dept = departments.find(d => d.id === id);
    return dept?.name || 'Unknown';
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData({
      entity_id: '',
      department_id: '',
      min_active_headcount: '',
      max_concurrent_leave: '',
      is_active: true,
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule) => {
    setEditingRule(rule);
    setFormData({
      entity_id: rule.entity_id || '',
      department_id: rule.department_id || '',
      min_active_headcount: rule.min_active_headcount ?? '',
      max_concurrent_leave: rule.max_concurrent_leave ?? '',
      is_active: rule.is_active ?? true,
      notes: rule.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      entity_id: formData.entity_id || null,
      department_id: formData.department_id || null,
      min_active_headcount: formData.min_active_headcount ? Number(formData.min_active_headcount) : null,
      max_concurrent_leave: formData.max_concurrent_leave ? Number(formData.max_concurrent_leave) : null,
      is_active: formData.is_active,
      notes: formData.notes || null,
    };

    if (editingRule) {
      await api.staffingRules?.update(editingRule.id, payload);
      toast.success('Rule updated');
    } else {
      await api.staffingRules?.create({ ...payload, entity_id: tenantId });
      toast.success('Rule created');
    }

    setIsDialogOpen(false);
    loadData();
  };

  const handleDelete = (rule) => {
    setRuleToDelete(rule);
  };

  const confirmDeleteRule = async () => {
    if (!ruleToDelete) return;
    await api.staffingRules?.delete(ruleToDelete.id);
    toast.success('Rule deleted');
    setRuleToDelete(null);
    loadData();
  };

  if (dataLoading || permLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState 
          title="We couldn’t load staffing rules" 
          message={error} 
          onRetry={loadData} 
        />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staffing Rules</h1>
          <p className="text-gray-500 mt-1">
            Configure minimum staffing levels and maximum concurrent leave
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 border border-slate-200">
        <p className="text-xs sm:text-sm text-slate-600">
          Define staffing coverage rules to prevent understaffing. These rules trigger warnings when employees request leave that would result in coverage dropping below minimum levels or exceeding maximum concurrent leave limits.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No staffing rules configured</p>
              <p className="text-sm">Create a rule to enable staffing clash warnings</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Min Active</TableHead>
                  <TableHead>Max on Leave</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{getEntityName(rule.entity_id)}</TableCell>
                    <TableCell>{getDepartmentName(rule.department_id)}</TableCell>
                    <TableCell>
                      {rule.min_active_headcount ?? <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      {rule.max_concurrent_leave ?? <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
                      {rule.notes || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(rule)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Pagination Controls */}
          {rules.length > ITEMS_PER_PAGE && (
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, rules.length)} of {rules.length} rules
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(rules.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage >= Math.ceil(rules.length / ITEMS_PER_PAGE)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!ruleToDelete}
        title="Delete staffing rule?"
        description={
          ruleToDelete
            ? `Delete the staffing rule for ${getEntityName(ruleToDelete.entity_id)} – ${getDepartmentName(ruleToDelete.department_id)}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete rule"
        onCancel={() => setRuleToDelete(null)}
        onConfirm={confirmDeleteRule}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Staffing Rule' : 'Create Staffing Rule'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Entity</Label>
              <Select
                value={formData.entity_id || 'all'}
                onValueChange={(v) => setFormData({ ...formData, entity_id: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities (Global)</SelectItem>
                  {entities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Department</Label>
              <Select
                value={formData.department_id || 'all'}
                onValueChange={(v) => setFormData({ ...formData, department_id: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Active Headcount</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.min_active_headcount}
                  onChange={(e) => setFormData({ ...formData, min_active_headcount: e.target.value })}
                  placeholder="e.g. 3"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum staff that must be working</p>
              </div>
              <div>
                <Label>Max Concurrent Leave</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.max_concurrent_leave}
                  onChange={(e) => setFormData({ ...formData, max_concurrent_leave: e.target.value })}
                  placeholder="e.g. 2"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Max employees on leave at once</p>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes..."
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Rule is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>
              {editingRule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}