import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Plus, Pencil, Trash2, Loader2, Calendar, Copy, Filter, Building2, Globe, AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { canActAsAdmin } from '@/components/utils/permissions';
import { copyHolidaysToYear } from '@/components/utils/publicHolidays';
import { usePageAssistant } from '@/components/assistant/AssistantContext';
import ErrorState from '@/components/common/ErrorState';
import { logApiError } from '@/components/utils/logger';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';

const AU_STATES = [
  { value: '', label: 'All States' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
];

export default function PublicHolidays() {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId || null;
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [entities, setEntities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterRegion, setFilterRegion] = useState('');

  // Copy dialog state
  const [copySourceYear, setCopySourceYear] = useState(new Date().getFullYear());
  const [copyTargetYear, setCopyTargetYear] = useState(new Date().getFullYear() + 1);
  const [copyEntityId, setCopyEntityId] = useState('global');

  const [formData, setFormData] = useState({
    entity_id: '',
    country: 'AU',
    state_region: '',
    date: '',
    name: '',
    is_paid: true,
    is_active: true,
  });

  usePageAssistant({
    contextKey: 'public-holidays',
    systemPrompt: `
You are the FoundersCreW HRIS assistant. The user is viewing the Public Holidays configuration page.

Your job is to:
- Explain how public holidays affect leave calculations (e.g. they are usually not deducted from annual leave balances).
- Help the user understand how to configure holidays for specific states/regions or entities.
- Clarify how to handle "substitute days" (e.g. when a holiday falls on a weekend).
- Assist with copying holidays from one year to the next.

Assume the user is an admin configuring the system for the upcoming year.
    `,
    suggestedQuestions: [
      "How do I copy holidays to next year?",
      "Do public holidays reduce annual leave?",
      "How do I add a regional holiday?",
      "What if a holiday falls on a weekend?"
    ]
  });

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const loadData = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const prefs = await api.userPreferences?.filter({ user_id: currentUser.id }) || [];
      setPreferences(prefs[0] || { acting_mode: 'admin' });

      // Use entities from context
      const allEntities = employeeCtx?.entities || [];
      
      // Fetch public holidays - note they may be global (non-tenant)
      // Use base44 directly for PublicHoliday as it's not tenant-scoped in schema
      const allHolidays = await base44.entities.PublicHoliday.list('-date');
      
      setHolidays(allHolidays || []);
      setEntities(allEntities || []);
    } catch (err) {
      const userMsg = logApiError('PublicHolidays', err);
      setError(userMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (holiday = null) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        entity_id: holiday.entity_id || '',
        country: holiday.country || 'AU',
        state_region: holiday.state_region || '',
        date: holiday.date || '',
        name: holiday.name || '',
        is_paid: holiday.is_paid !== false,
        is_active: holiday.is_active !== false,
      });
    } else {
      setEditingHoliday(null);
      setFormData({
        entity_id: filterEntity !== 'all' ? filterEntity : '',
        country: 'AU',
        state_region: filterRegion || '',
        date: '',
        name: '',
        is_paid: true,
        is_active: true,
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        entity_id: formData.entity_id || tenantId || null,
        state_region: formData.state_region || null,
        created_by_user_id: user.id,
      };

      if (editingHoliday) {
        await base44.entities.PublicHoliday.update(editingHoliday.id, payload);
      } else {
        await base44.entities.PublicHoliday.create(payload);
      }

      setShowDialog(false);
      await loadData();
    } catch (err) {
      logApiError('PublicHolidays:Save', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (holidayId) => {
    try {
      await base44.entities.PublicHoliday.delete(holidayId);
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      logApiError('PublicHolidays:Delete', err);
    }
  };

  const handleCopyYear = async () => {
    setIsCopying(true);
    try {
      const entityId = copyEntityId === 'global' ? null : copyEntityId;
      const count = await copyHolidaysToYear(copySourceYear, copyTargetYear, entityId, user.id);
      setShowCopyDialog(false);
      await loadData();
      alert(`Created ${count} holidays for ${copyTargetYear}`);
    } catch (err) {
      logApiError('PublicHolidays:Copy', err);
    } finally {
      setIsCopying(false);
    }
  };

  const getEntityName = (entityId) => {
    if (!entityId) return 'All Entities';
    const entity = entities.find(e => e.id === entityId);
    return entity?.name || 'Unknown';
  };

  // Filter holidays
  const filteredHolidays = holidays.filter(h => {
    const holidayYear = h.date ? parseInt(h.date.substring(0, 4)) : null;
    if (holidayYear !== filterYear) return false;
    
    if (filterEntity === 'global' && h.entity_id) return false;
    if (filterEntity !== 'all' && filterEntity !== 'global' && h.entity_id !== filterEntity) return false;
    
    if (filterRegion && h.state_region && h.state_region !== filterRegion) return false;
    
    return true;
  });

  // Sort by date
  filteredHolidays.sort((a, b) => a.date.localeCompare(b.date));

  const isAdminMode = canActAsAdmin(user, preferences);

  const yearOptions = [];
  for (let y = new Date().getFullYear() - 1; y <= new Date().getFullYear() + 2; y++) {
    yearOptions.push(y);
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState 
          title="We couldn’t load public holidays" 
          message={error} 
          onRetry={loadData} 
        />
      </div>
    );
  }

  if (!isAdminMode) {
    return (
      <div className="p-6">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <p className="text-yellow-700">You don't have permission to manage public holidays.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Public Holidays</h1>
          <p className="text-gray-500 mt-1">Manage public holidays by entity, region, and year</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCopyDialog(true)}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Year
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Holiday
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 border border-slate-200">
        <p className="text-xs sm:text-sm text-slate-600">
          Configure public holidays for your organization. Holidays can be global, entity-specific, or region-specific (e.g. NSW vs VIC). Correct configuration ensures accurate leave calculations and payments.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Year</Label>
              <Select value={String(filterYear)} onValueChange={v => setFilterYear(parseInt(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Entity</Label>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Holidays</SelectItem>
                  <SelectItem value="global">Global Only</SelectItem>
                  {entities.filter(e => e.id).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name || 'Unknown'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">State/Region</Label>
              <Select value={filterRegion || 'all'} onValueChange={v => setFilterRegion(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {AU_STATES.map(s => (
                    <SelectItem key={s.value || 'all'} value={s.value || 'all'}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holidays list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            Holidays ({filteredHolidays.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredHolidays.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p>No public holidays found for {filterYear}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                Add Holiday
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHolidays.map(holiday => (
                <div 
                  key={holiday.id} 
                  className={`p-4 rounded-lg border flex items-center justify-between ${
                    holiday.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center w-16">
                      <p className="text-2xl font-bold text-gray-900">
                        {format(parseISO(holiday.date), 'd')}
                      </p>
                      <p className="text-xs text-gray-500 uppercase">
                        {format(parseISO(holiday.date), 'MMM')}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{holiday.name}</p>
                        {!holiday.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        {!holiday.is_paid && (
                          <Badge variant="outline" className="text-xs">Unpaid</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        {holiday.entity_id ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {getEntityName(holiday.entity_id)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            All Entities
                          </span>
                        )}
                        {holiday.state_region && (
                          <Badge variant="outline" className="text-xs">{holiday.state_region}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(holiday)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setDeleteConfirm(holiday)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add Public Holiday'}</DialogTitle>
            <DialogDescription>
              Configure a public holiday for your organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Holiday Name *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Australia Day, Labour Day"
              />
            </div>

            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entity</Label>
                <Select 
                  value={formData.entity_id || 'global'} 
                  onValueChange={v => setFormData(f => ({ ...f, entity_id: v === 'global' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">All Entities (Global)</SelectItem>
                    {entities.filter(e => e.id).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name || 'Unknown'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>State/Region</Label>
                <Select 
                  value={formData.state_region || 'all'} 
                  onValueChange={v => setFormData(f => ({ ...f, state_region: v === 'all' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map(s => (
                      <SelectItem key={s.value || 'all'} value={s.value || 'all'}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_paid}
                  onCheckedChange={v => setFormData(f => ({ ...f, is_paid: v }))}
                />
                <Label className="font-normal">Paid Holiday</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={v => setFormData(f => ({ ...f, is_active: v }))}
                />
                <Label className="font-normal">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name || !formData.date}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingHoliday ? 'Save Changes' : 'Create Holiday'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Year Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Copy Holidays to Another Year</DialogTitle>
            <DialogDescription>
              Copy all holidays from one year to another. Dates will be adjusted to the target year.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Source Year</Label>
              <Select value={String(copySourceYear)} onValueChange={v => setCopySourceYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Year</Label>
              <Select value={String(copyTargetYear)} onValueChange={v => setCopyTargetYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entity</Label>
              <Select value={copyEntityId} onValueChange={setCopyEntityId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global Holidays Only</SelectItem>
                  {entities.filter(e => e.id).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name || 'Unknown'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Note: Some holidays may fall on different days each year (e.g. Easter). 
                Please review and adjust dates after copying.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>Cancel</Button>
            <Button onClick={handleCopyYear} disabled={isCopying || copySourceYear === copyTargetYear}>
              {isCopying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy Holidays
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Holiday</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}" on {deleteConfirm?.date ? format(parseISO(deleteConfirm.date), 'dd MMM yyyy') : ''}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteConfirm?.id)}>
              Delete Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}