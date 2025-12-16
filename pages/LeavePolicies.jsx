// src/pages/LeavePolicies.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { createPageUrl } from '@/utils';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Calendar,
  Clock,
  RefreshCw,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";

import { canActAsAdmin } from '@/components/utils/permissions';
import { recalculateAllBalancesForEntity } from '@/components/utils/leaveAccrual';
import {
  checkNESCompliance,
  checkSinglePolicyCompliance,
  getHighestSeverityForPolicy
} from '@/components/utils/leavePolicyCompliance';
import NESCompliancePanel from '@/components/leave/NESCompliancePanel';
import PageHelpTrigger from '@/components/assistant/PageHelpTrigger';
import ErrorState from '@/components/common/ErrorState';

const LEAVE_TYPE_LABELS = {
  annual: 'Annual Leave',
  personal: "Personal/Carer\'s Leave",
  sick: 'Sick Leave',
  long_service: 'Long Service Leave',
  parental: 'Parental Leave',
  compassionate: 'Compassionate Leave',
  other: 'Other',
};

const LEAVE_TYPE_COLORS = {
  annual: 'bg-blue-100 text-blue-700',
  personal: 'bg-purple-100 text-purple-700',
  sick: 'bg-red-100 text-red-700',
  long_service: 'bg-amber-100 text-amber-700',
  parental: 'bg-pink-100 text-pink-700',
  compassionate: 'bg-gray-100 text-gray-700',
  other: 'bg-slate-100 text-slate-700',
};

const EMPLOYMENT_TYPE_LABELS = {
  any: 'All Types',
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  casual: 'Casual',
  contractor: 'Contractor',
};

//
// Helper: build NES default policy payloads (shape expected by LeavePolicy.create)
//

function buildNESAnnualFTPolicy(entityId) {
  return {
    entity_id: entityId,
    code: 'ANNUAL_FT_AU',
    name: 'NES Annual Leave (Full-Time, AU)',
    country: 'AU',
    leave_type: 'annual',
    employment_type_scope: 'full_time',
    accrual_unit: 'weeks_per_year',
    accrual_rate: 4,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    max_carryover_hours: null,
    min_service_years_before_accrual: null,
    accrual_rate_after_threshold: null,
    service_includes_prior_entities: true,
    is_system: true,
    is_default: true,
    is_active: true,
    notes: 'NES minimum 4 weeks annual leave for full-time employees in Australia.',
  };
}

function buildNESAnnualPTPolicy(entityId) {
  return {
    entity_id: entityId,
    code: 'ANNUAL_PT_AU',
    name: 'NES Annual Leave (Part-Time, AU)',
    country: 'AU',
    leave_type: 'annual',
    employment_type_scope: 'part_time',
    accrual_unit: 'weeks_per_year',
    accrual_rate: 4,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    max_carryover_hours: null,
    min_service_years_before_accrual: null,
    accrual_rate_after_threshold: null,
    service_includes_prior_entities: true,
    is_system: true,
    is_default: false,
    is_active: true,
    notes: 'NES minimum 4 weeks annual leave for part-time employees in Australia.',
  };
}

function buildNESPersonalFTPolicy(entityId) {
  return {
    entity_id: entityId,
    code: 'PERSONAL_FT_AU',
    name: 'NES Personal/Carer\'s Leave (Full-Time, AU)',
    country: 'AU',
    leave_type: 'personal',
    employment_type_scope: 'full_time',
    accrual_unit: 'days_per_year',
    accrual_rate: 10,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    max_carryover_hours: null,
    min_service_years_before_accrual: null,
    accrual_rate_after_threshold: null,
    service_includes_prior_entities: true,
    is_system: true,
    is_default: true,
    is_active: true,
    notes: 'NES minimum 10 days personal/carer\'s leave for full-time employees in Australia.',
  };
}

function buildNESPersonalPTPolicy(entityId) {
  return {
    entity_id: entityId,
    code: 'PERSONAL_PT_AU',
    name: 'NES Personal/Carer\'s Leave (Part-Time, AU)',
    country: 'AU',
    leave_type: 'personal',
    employment_type_scope: 'part_time',
    accrual_unit: 'days_per_year',
    accrual_rate: 10,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    max_carryover_hours: null,
    min_service_years_before_accrual: null,
    accrual_rate_after_threshold: null,
    service_includes_prior_entities: true,
    is_system: true,
    is_default: false,
    is_active: true,
    notes: 'NES minimum 10 days personal/carer\'s leave for part-time employees in Australia.',
  };
}

export default function LeavePolicies() {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId || null;

  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [entities, setEntities] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedEntityId, setSelectedEntityId] = useState('all');

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState({ processed: 0, total: 0 });
  const [recalcComplete, setRecalcComplete] = useState(false);

  const [hideSystemPolicies, setHideSystemPolicies] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [showComplianceWarning, setShowComplianceWarning] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    country: 'AU',
    leave_type: 'annual',
    employment_type_scope: 'any',
    accrual_unit: 'days_per_year',
    accrual_rate: 20,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    max_carryover_hours: null,
    min_service_years_before_accrual: null,
    accrual_rate_after_threshold: null,
    service_includes_prior_entities: true,
    is_default: false,
    is_active: true,
    notes: '',
  });

  const isAdminMode = canActAsAdmin(user, preferences);

  //
  // Load data on mount / tenant change / navigation
  //
  useEffect(() => {
    if (!tenantId) {
      console.warn('[LeavePolicies] No tenantId, skipping initial load.');
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[LeavePolicies] tenantId:', tenantId);

        const [currentUser, prefs, rawPolicies, allEntities] = await Promise.all([
          base44.auth.me(),
          api.userPreferences?.filter({ user_id: employeeCtx?.user?.id }) || Promise.resolve([]),
          api.leavePolicies?.list() || Promise.resolve([]),
          api.entities?.list() || Promise.resolve([]),
        ]);

        // DEBUG_REMOVE: Log fetched policies
        console.log('[LeavePolicies] Raw policies from API:', rawPolicies?.length ?? 0);
        console.log('[LeavePolicies] Sample policies:', (rawPolicies || []).slice(0, 5).map(p => ({ id: p.id, name: p.name, isActive: p.is_active, leaveType: p.leave_type })));
        console.log('[LeavePolicies] Entities from API:', allEntities);

        setUser(currentUser);
        setPreferences(prefs[0] || { acting_mode: 'admin' });
        setEntities(allEntities || []);

        let effectivePolicies = Array.isArray(rawPolicies) ? [...rawPolicies] : [];

        // If no policies at all, attempt to create NES defaults for the first entity
        if (effectivePolicies.length === 0 && allEntities && allEntities.length > 0) {
          const firstEntity = allEntities[0];
          const entityId = firstEntity.id;
          console.log('[LeavePolicies] Creating NES defaults for entityId:', entityId);

          // Build payloads
          const nesPayloads = [
            buildNESAnnualFTPolicy(entityId),
            buildNESAnnualPTPolicy(entityId),
            buildNESPersonalFTPolicy(entityId),
            buildNESPersonalPTPolicy(entityId),
          ];

          // Create them one by one via the tenant-scoped API
          const created = [];
          for (const payload of nesPayloads) {
            console.log('[LeavePolicies] Creating NES policy payload:', payload);
            try {
              const createdPolicy = await api.leavePolicies?.create(payload);
              console.log('[LeavePolicies] Created NES policy:', createdPolicy);
              if (createdPolicy) {
                created.push(createdPolicy);
              }
            } catch (err) {
              console.error('[LeavePolicies] Error creating NES policy:', err, payload);
            }
          }

          // Merge created policies into effective list
          effectivePolicies = [...effectivePolicies, ...created];
          console.log('[LeavePolicies] Policies after inline NES creation:', effectivePolicies);
        }

        setPolicies(effectivePolicies);

        if (allEntities.length > 0 && selectedEntityId === 'all') {
          setSelectedEntityId(allEntities[0].id);
        }

        console.log('[LeavePolicies] Final effective policies count:', effectivePolicies.length);
      } catch (err) {
        console.error('[LeavePolicies] Error loading policies/entities:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, window.location.pathname]); // CRITICAL FIX: reload on navigation back to page

  //
  // NES compliance
  //
  const complianceIssues = useMemo(() => {
    return checkNESCompliance(policies);
  }, [policies]);

  const getPolicySeverity = (policyId) =>
    getHighestSeverityForPolicy(policyId, complianceIssues);

  //
  // Dialog open / edit
  //
  const handleOpenDialog = (policy = null) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        name: policy.name || '',
        country: policy.country || 'AU',
        leave_type: policy.leave_type || 'annual',
        employment_type_scope: policy.employment_type_scope || 'any',
        accrual_unit: policy.accrual_unit || 'days_per_year',
        accrual_rate: policy.accrual_rate ?? 0,
        standard_hours_per_day: policy.standard_hours_per_day ?? 7.6,
        hours_per_week_reference: policy.hours_per_week_reference ?? 38,
        max_carryover_hours: policy.max_carryover_hours ?? null,
        min_service_years_before_accrual: policy.min_service_years_before_accrual ?? null,
        accrual_rate_after_threshold: policy.accrual_rate_after_threshold ?? null,
        service_includes_prior_entities: policy.service_includes_prior_entities !== false,
        is_default: policy.is_default || false,
        is_active: policy.is_active !== false,
        notes: policy.notes || '',
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        name: '',
        country: 'AU',
        leave_type: 'annual',
        employment_type_scope: 'any',
        accrual_unit: 'days_per_year',
        accrual_rate: 20,
        standard_hours_per_day: 7.6,
        hours_per_week_reference: 38,
        max_carryover_hours: null,
        min_service_years_before_accrual: null,
        accrual_rate_after_threshold: null,
        service_includes_prior_entities: true,
        is_default: false,
        is_active: true,
        notes: '',
      });
    }
    setShowDialog(true);
  };

  //
  // Save / validate
  //
  const doSave = async (payload, overriding = false) => {
    setIsSaving(true);
    try {
      // DEBUG_REMOVE: Log before save
      console.log('[LeavePolicies] Saving policy:', { editing: !!editingPolicy, payload });
      
      if (editingPolicy) {
        const updated = await api.leavePolicies?.update(editingPolicy.id, payload);
        console.log('[LeavePolicies] Updated policy:', updated);
        setPolicies(prev =>
          prev.map(p => (p.id === editingPolicy.id ? updated : p))
        );
      } else {
        const created = await api.leavePolicies?.create(payload);
        console.log('[LeavePolicies] Created policy:', created);
        
        // DEBUG_REMOVE: Verify persistence
        const freshList = await api.leavePolicies.list().catch(() => []);
        console.log('[LeavePolicies] Policy count after create:', freshList.length);
        
        if (created) {
          setPolicies(prev => [...prev, created]);
        }
      }

      setShowDialog(false);
      setShowComplianceWarning(false);
      setPendingSaveData(null);
      setEditingPolicy(null);
    } catch (err) {
      console.error('[LeavePolicies] Error saving policy:', err);
      // leave policies as-is; error surfaced in console
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (forceOverride = false) => {
    const payload = {
      ...formData,
      accrual_rate: parseFloat(formData.accrual_rate) || 0,
      standard_hours_per_day: parseFloat(formData.standard_hours_per_day) || 7.6,
      hours_per_week_reference: parseFloat(formData.hours_per_week_reference) || 38,
      max_carryover_hours: formData.max_carryover_hours
        ? parseFloat(formData.max_carryover_hours)
        : null,
      min_service_years_before_accrual: formData.min_service_years_before_accrual
        ? parseFloat(formData.min_service_years_before_accrual)
        : null,
      accrual_rate_after_threshold: formData.accrual_rate_after_threshold
        ? parseFloat(formData.accrual_rate_after_threshold)
        : null,
    };

    if (!forceOverride) {
      const policyToCheck = { ...payload, id: editingPolicy?.id || 'new' };
      const issues = checkSinglePolicyCompliance(policyToCheck);
      const hasErrors = issues.some(i => i.severity === 'error');

      if (hasErrors) {
        setPendingSaveData(payload);
        setShowComplianceWarning(true);
        return;
      }
    }

    await doSave(payload, forceOverride);
  };

  //
  // Delete
  //
  const handleDelete = async (policyId) => {
    try {
      await api.leavePolicies?.delete(policyId);
      setPolicies(prev => prev.filter(p => p.id !== policyId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('[LeavePolicies] Error deleting policy:', err);
    }
  };

  const isSystemPolicy = (policy) => policy?.is_system === true;

  //
  // Batch recalc
  //
  const handleBatchRecalculate = async () => {
    setIsRecalculating(true);
    setRecalcComplete(false);
    setRecalcProgress({ processed: 0, total: 0 });

    try {
      await recalculateAllBalancesForEntity(
        (selectedEntityId === 'all' ? null : selectedEntityId) || null,
        (progress) => setRecalcProgress(progress)
      );
      setRecalcComplete(true);
    } catch (err) {
      console.error('[LeavePolicies] Error recalculating balances:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  //
  // Loading / access states
  //
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
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!isAdminMode) {
    return (
      <div className="p-6">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <p className="text-yellow-700">
              You don&apos;t have permission to manage leave policies.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  //
  // Derived views
  //
  const systemPolicies = policies.filter(p => p.is_system && p.country === 'AU');
  const companyPolicies = policies.filter(p => !p.is_system);

  const groupedPolicies = companyPolicies.reduce((acc, policy) => {
    if (!acc[policy.leave_type]) acc[policy.leave_type] = [];
    acc[policy.leave_type].push(policy);
    return acc;
  }, {});

  //
  // Render
  //
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Leave Policies</h1>
            <PageHelpTrigger />
          </div>
          <p className="text-gray-500 mt-1">
            Configure leave accrual rates and entitlements
          </p>
        </div>
        <Link to={createPageUrl('LeavePolicyNew')}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Button>
        </Link>
      </div>

      <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 border border-slate-200">
        <p className="text-xs sm:text-sm text-slate-600">
          Configure how different leave types behave under NES and your internal policies.
          These settings control accrual rules, who is eligible (full-time, part-time, casual),
          and how balances appear in reports.
        </p>
      </div>

      {policies.length === 0 ? (
        <div
          className="p-6 text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200"
          data-tutorial="leave-policies-table"
        >
          No leave policies found. Add a policy to get started.
        </div>
      ) : (
        <>
          {/* Batch Recalculation */}
          <Card data-tutorial="leave-policies-table">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-gray-400" />
                    Recalculate Leave Balances
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Recalculate all leave balances for employees in an entity. Use this after
                    policy changes or corrections.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-end gap-4">
                {entities.length > 1 && (
                  <div className="flex-1 max-w-xs">
                    <Label className="text-sm text-gray-500">Entity</Label>
                    <Select
                      value={selectedEntityId}
                      onValueChange={setSelectedEntityId}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All entities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Entities</SelectItem>
                        {entities
                          .filter(e => e.id)
                          .map(e => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.abbreviation || e.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  onClick={handleBatchRecalculate}
                  disabled={isRecalculating}
                  variant="outline"
                >
                  {isRecalculating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isRecalculating ? 'Recalculating...' : 'Recalculate All'}
                </Button>
              </div>

              {isRecalculating && recalcProgress.total > 0 && (
                <div className="mt-4">
                  <Progress
                    value={(recalcProgress.processed / recalcProgress.total) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Processing {recalcProgress.processed} of {recalcProgress.total} employees...
                  </p>
                </div>
              )}

              {recalcComplete && (
                <div className="mt-4 flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Successfully recalculated {recalcProgress.processed} employee balances.
                </div>
              )}
            </CardContent>
          </Card>

          {/* NES Compliance Panel */}
          <NESCompliancePanel issues={complianceIssues} isLoading={isLoading} />

          {/* Disclaimer */}
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Configurable Settings – Not Legal Advice</p>
                  <p className="mt-1">
                    This system provides configurable leave and entitlement settings. It does not
                    provide legal advice, award interpretation, or compliance verification. You
                    are responsible for configuring these policies to comply with your
                    jurisdiction, awards, enterprise agreements, and applicable legislation
                    (e.g. National Employment Standards). Please consult your HR/legal advisors.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System NES Policies */}
          {systemPolicies.length > 0 && !hideSystemPolicies && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Badge className="bg-indigo-100 text-indigo-700">System</Badge>
                      NES Default Policies (Australia)
                    </CardTitle>
                    <CardDescription className="mt-1">
                      These are the National Employment Standards minimum entitlements. They
                      are used as defaults when no custom policy is assigned.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemPolicies.map(policy => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-indigo-50/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{policy.name}</p>
                          <Badge
                            variant="outline"
                            className="text-xs bg-indigo-100 text-indigo-700 border-indigo-200"
                          >
                            NES
                          </Badge>
                          {policy.is_default && (
                            <Badge variant="outline" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {policy.accrual_rate}{' '}
                            {policy.accrual_unit === 'days_per_year'
                              ? 'days'
                              : policy.accrual_unit === 'weeks_per_year'
                              ? 'weeks'
                              : 'hours'}
                            /year
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {EMPLOYMENT_TYPE_LABELS[policy.employment_type_scope] || 'All Types'}
                          </Badge>
                          <Badge className={LEAVE_TYPE_COLORS[policy.leave_type]}>
                            {LEAVE_TYPE_LABELS[policy.leave_type]}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(policy)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Company Policies Header */}
          <div className="flex items-center justify-between pt-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Company Leave Policies</h2>
              <p className="text-sm text-gray-500">
                Custom policies for Awards, EBAs, or company-specific arrangements
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hide-system"
                checked={hideSystemPolicies}
                onCheckedChange={setHideSystemPolicies}
              />
              <Label
                htmlFor="hide-system"
                className="text-sm text-gray-600 cursor-pointer flex items-center gap-1.5"
              >
                {hideSystemPolicies ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                Hide system NES policies
              </Label>
            </div>
          </div>

          {/* Company Policies by type */}
          {Object.keys(LEAVE_TYPE_LABELS).map(leaveType => {
            const typePolicies = groupedPolicies[leaveType] || [];
            if (typePolicies.length === 0 && !['annual', 'personal'].includes(leaveType)) {
              return null;
            }

            return (
              <Card key={leaveType}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Badge className={LEAVE_TYPE_COLORS[leaveType]}>
                      {LEAVE_TYPE_LABELS[leaveType]}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {typePolicies.length} {typePolicies.length === 1 ? 'policy' : 'policies'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {typePolicies.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Calendar className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                      <p>No policies configured for {LEAVE_TYPE_LABELS[leaveType]}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          setFormData(f => ({ ...f, leave_type: leaveType }));
                          handleOpenDialog();
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Policy
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {typePolicies.map(policy => {
                        const severity = getPolicySeverity(policy.id);
                        const borderClass =
                          severity === 'error'
                            ? 'border-l-4 border-l-red-500'
                            : severity === 'warning'
                            ? 'border-l-4 border-l-amber-400'
                            : severity === 'info'
                            ? 'border-l-4 border-l-blue-400'
                            : '';

                        return (
                          <div
                            key={policy.id}
                            className={`flex items-center justify-between p-4 rounded-lg border ${borderClass} ${
                              policy.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {severity === 'error' && (
                                  <AlertTriangle
                                    className="h-4 w-4 text-red-500"
                                    title="NES compliance issue"
                                  />
                                )}
                                {severity === 'warning' && (
                                  <AlertTriangle
                                    className="h-4 w-4 text-amber-500"
                                    title="Configuration warning"
                                  />
                                )}
                                <p className="font-medium text-gray-900">{policy.name}</p>
                                {policy.is_default && (
                                  <Badge variant="outline" className="text-xs">
                                    Default
                                  </Badge>
                                )}
                                {!policy.is_active && (
                                  <Badge variant="secondary" className="text-xs">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {policy.accrual_rate}{' '}
                                  {policy.accrual_unit === 'days_per_year'
                                    ? 'days'
                                    : policy.accrual_unit === 'weeks_per_year'
                                    ? 'weeks'
                                    : 'hours'}
                                  /year
                                </span>
                                <span>{policy.standard_hours_per_day}h/day</span>
                                <Badge variant="outline" className="text-xs">
                                  {EMPLOYMENT_TYPE_LABELS[policy.employment_type_scope] ||
                                    'All Types'}
                                </Badge>
                                {policy.min_service_years_before_accrual && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs text-amber-600 border-amber-300"
                                  >
                                    After {policy.min_service_years_before_accrual} yrs
                                  </Badge>
                                )}
                                {policy.country && (
                                  <span className="uppercase">{policy.country}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(policy)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {!isSystemPolicy(policy) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => setDeleteConfirm(policy)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Add/Edit Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingPolicy ? 'Edit Policy' : 'Add Leave Policy'}
                </DialogTitle>
                <DialogDescription>
                  Configure accrual rates and entitlements for this leave type.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Policy Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={e =>
                      setFormData(f => ({
                        ...f,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g. AU Default Full-Time"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Leave Type *</Label>
                    <Select
                      value={formData.leave_type}
                      onValueChange={v =>
                        setFormData(f => ({
                          ...f,
                          leave_type: v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Employment Type</Label>
                    <Select
                      value={formData.employment_type_scope}
                      onValueChange={v =>
                        setFormData(f => ({
                          ...f,
                          employment_type_scope: v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={formData.country}
                    onChange={e =>
                      setFormData(f => ({
                        ...f,
                        country: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="AU"
                    maxLength={3}
                    className="w-24"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Accrual Rate *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.accrual_rate}
                      onChange={e =>
                        setFormData(f => ({
                          ...f,
                          accrual_rate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Accrual Unit</Label>
                    <Select
                      value={formData.accrual_unit}
                      onValueChange={v =>
                        setFormData(f => ({
                          ...f,
                          accrual_unit: v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days_per_year">Days per year</SelectItem>
                        <SelectItem value="weeks_per_year">Weeks per year</SelectItem>
                        <SelectItem value="hours_per_year">Hours per year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Hours/Day</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.standard_hours_per_day}
                      onChange={e =>
                        setFormData(f => ({
                          ...f,
                          standard_hours_per_day: e.target.value,
                        }))
                      }
                    />
                    <p className="text-xs text-gray-500">For day↔hour conversion</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Hours/Week Ref</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.hours_per_week_reference}
                      onChange={e =>
                        setFormData(f => ({
                          ...f,
                          hours_per_week_reference: e.target.value,
                        }))
                      }
                    />
                    <p className="text-xs text-gray-500">For pro-rata calc</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Carryover (hrs)</Label>
                    <Input
                      type="number"
                      value={formData.max_carryover_hours || ''}
                      onChange={e =>
                        setFormData(f => ({
                          ...f,
                          max_carryover_hours: e.target.value || null,
                        }))
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                </div>

                {/* Long Service Leave specific fields */}
                {formData.leave_type === 'long_service' && (
                  <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        Long Service Leave thresholds vary by jurisdiction. Configure these
                        to match your applicable laws, awards, or enterprise agreements.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Min Service Years</Label>
                        <Input
                          type="number"
                          step="1"
                          value={formData.min_service_years_before_accrual || ''}
                          onChange={e =>
                            setFormData(f => ({
                              ...f,
                              min_service_years_before_accrual: e.target.value || null,
                            }))
                          }
                          placeholder="e.g. 7 or 10"
                        />
                        <p className="text-xs text-gray-500">
                          Years before LSL starts accruing
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Accrual After Threshold</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.accrual_rate_after_threshold || ''}
                          onChange={e =>
                            setFormData(f => ({
                              ...f,
                              accrual_rate_after_threshold: e.target.value || null,
                            }))
                          }
                          placeholder="e.g. 0.867"
                        />
                        <p className="text-xs text-gray-500">
                          Rate per year after threshold (in{' '}
                          {formData.accrual_unit.replace('_per_year', '')})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.service_includes_prior_entities}
                        onCheckedChange={v =>
                          setFormData(f => ({
                            ...f,
                            service_includes_prior_entities: v,
                          }))
                        }
                      />
                      <Label className="font-normal text-sm">
                        Count service from prior entities
                      </Label>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={e =>
                      setFormData(f => ({
                        ...f,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Internal notes about this policy..."
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_default}
                      onCheckedChange={v =>
                        setFormData(f => ({
                          ...f,
                          is_default: v,
                        }))
                      }
                    />
                    <Label className="font-normal">
                      Default policy for this leave type
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={v =>
                        setFormData(f => ({
                          ...f,
                          is_active: v,
                        }))
                      }
                    />
                    <Label className="font-normal">Active</Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSave(false)}
                  disabled={isSaving || !formData.name || !formData.accrual_rate}
                >
                  {isSaving && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  {editingPolicy ? 'Save Changes' : 'Create Policy'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Policy</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;?
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}
                >
                  Delete Policy
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Compliance Warning */}
          <Dialog
            open={showComplianceWarning}
            onOpenChange={setShowComplianceWarning}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  NES Compliance Warning
                </DialogTitle>
                <DialogDescription>
                  This policy does not meet minimum National Employment Standards requirements.
                  Are you sure you want to save it?
                </DialogDescription>
              </DialogHeader>
              <div className="py-3">
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-3">
                    <p className="text-sm text-amber-800">
                      Saving this policy may result in non-compliant leave entitlements.
                      Please review the configuration or consult your HR/legal advisors.
                    </p>
                  </CardContent>
                </Card>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowComplianceWarning(false);
                    setPendingSaveData(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (pendingSaveData) {
                      doSave(pendingSaveData, true);
                    }
                  }}
                  disabled={isSaving}
                >
                  {isSaving && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Save Anyway
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}