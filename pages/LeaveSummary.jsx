import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Calendar, ArrowLeft, Loader2, Sun, Thermometer, Clock, Users,
  Filter
} from 'lucide-react';

import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { useTenantApi } from '@/components/utils/useTenantApi';

import { calculateChargeableLeave } from '@/components/utils/LeaveEngine';
import { formatDays, safeNumber } from '@/components/utils/numberUtils';
import LeaveSummaryCharts from '@/components/reporting/LeaveSummaryCharts';
import LeaveSummaryTable from '@/components/reporting/LeaveSummaryTable';
import {
  format,
  startOfYear,
  endOfYear,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  parseISO,
  isAfter,
  isBefore,
} from 'date-fns';

const DATE_PRESETS = [
  { value: 'ytd', label: 'Year to date' },
  { value: 'last12', label: 'Last 12 months' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'custom', label: 'Custom range' },
];

const EMPLOYMENT_TYPES = [
  { value: 'all', label: 'All types' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'casual', label: 'Casual' },
  { value: 'contractor', label: 'Contractor' },
];

export default function LeaveSummary() {
  const employeeCtx = useEmployeeContext();
  const api = useTenantApi();

  const tenantId = employeeCtx?.tenantId;
  const visibleEmployeesFromCtx = employeeCtx?.visibleEmployees || [];
  const departmentsFromCtx = employeeCtx?.departments || [];
  const entitiesFromCtx = employeeCtx?.entities || [];

  // Permission check (admin-only reports)
  const { isAllowed, isLoading: permLoading } = useRequirePermission(
    employeeCtx,
    'canViewReports',
    {
      requireAdminMode: true,
      message: 'You need admin access to view reports.',
    }
  );

  // Local loading & error
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Data that this page *actually* needs to fetch
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  // Filters
  const [datePreset, setDatePreset] = useState('ytd');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [entityId, setEntityId] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [employmentType, setEmploymentType] = useState('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');

  // Computed chargeable days cache
  const [chargeableDaysMap, setChargeableDaysMap] = useState({});

  /**
   * Load only what this page needs, and do it once per tenant.
   * - Uses tenantId so we don’t hit global rate limits as badly.
   * - Reuses employees/departments/entities from context (no extra calls).
   */
  useEffect(() => {
    // Guard: wait for tenantId from context
    if (!tenantId) {
      console.log('[LeaveSummary] Waiting for tenantId...');
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        // Fetch just the pieces we don't already have in context.
        const [requests, types] = await Promise.all([
          api.leaveRequests?.filter
            ? api.leaveRequests.filter({ entity_id: tenantId })
            : api.leaveRequests?.list
            ? api.leaveRequests.list()
            : [],
          api.leaveTypes?.filter
            ? api.leaveTypes.filter({ entity_id: tenantId })
            : api.leaveTypes?.list
            ? api.leaveTypes.list()
            : [],
        ]);

      const safeRequests = requests || [];
      setLeaveRequests(safeRequests);
      setLeaveTypes(types || []);

      // Pre-calc chargeable days only for approved/pending requests.
      // NOTE: This can still be heavy on huge tenants, but we run it once per load.
      const approvedOrPending = safeRequests.filter(
        (r) => r.status === 'approved' || r.status === 'pending'
      );

      const chargeableMap = {};

      for (const req of approvedOrPending) {
        try {
          const result = await calculateChargeableLeave({
            start_date: req.start_date,
            end_date: req.end_date,
            employee_id: req.employee_id,
          });
          chargeableMap[req.id] = result.chargeableDays;
        } catch (err) {
          // Fallback to total_days if calculation fails
          chargeableMap[req.id] = req.total_days || 0;
        }
      }

      setChargeableDaysMap(chargeableMap);
      } catch (error) {
        console.error('Error loading leave summary data:', error);
        const msg =
          error?.message?.includes('Rate limit exceeded') ||
          error?.detail === 'Rate limit exceeded'
            ? 'Rate limit exceeded while loading leave summary. Please try again in a moment.'
            : 'Failed to load leave summary data.';
        setLoadError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    // ✅ STABLE DEPS: tenantId only
  }, [tenantId]);

  // Date range
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case 'ytd':
        return { start: startOfYear(now), end: now };
      case 'last12':
        return { start: subMonths(now, 12), end: now };
      case 'quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'custom':
        return {
          start: customStart ? new Date(customStart) : startOfYear(now),
          end: customEnd ? new Date(customEnd) : now,
        };
      default:
        return { start: startOfYear(now), end: now };
    }
  }, [datePreset, customStart, customEnd]);

  // Visible employees based on role & filters
  const visibleEmployees = useMemo(() => {
    let filtered = visibleEmployeesFromCtx;

    if (entityId !== 'all') {
      filtered = filtered.filter((e) => e.entity_id === entityId);
    }
    if (departmentId !== 'all') {
      filtered = filtered.filter((e) => e.department_id === departmentId);
    }
    if (employmentType !== 'all') {
      filtered = filtered.filter((e) => e.employment_type === employmentType);
    }

    return filtered;
  }, [visibleEmployeesFromCtx, entityId, departmentId, employmentType]);

  const visibleEmployeeIds = useMemo(
    () => new Set(visibleEmployees.map((e) => e.id)),
    [visibleEmployees]
  );

  // Leave type lookup
  const leaveTypeMap = useMemo(() => {
    const map = {};
    leaveTypes.forEach((lt) => {
      map[lt.id] = lt;
    });
    return map;
  }, [leaveTypes]);

  const getLeaveTypeCategory = (leaveTypeId) => {
    const lt = leaveTypeMap[leaveTypeId];
    if (!lt) return 'other';
    const code = (lt.code || lt.name || '').toLowerCase();
    if (code.includes('annual') || code.includes('holiday')) return 'annual';
    if (code.includes('personal') || code.includes('sick')) return 'personal';
    return 'other';
  };

  // Check if a leave request overlaps with the date range
  const requestOverlapsRange = (req, range) => {
    const reqStart = parseISO(req.start_date);
    const reqEnd = parseISO(req.end_date);
    return !isAfter(reqStart, range.end) && !isBefore(reqEnd, range.start);
  };

  // Filter leave requests to those in scope
  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((req) => {
      if (!visibleEmployeeIds.has(req.employee_id)) return false;
      if (!requestOverlapsRange(req, dateRange)) return false;

      if (leaveTypeFilter !== 'all') {
        const category = getLeaveTypeCategory(req.leave_type_id);
        if (leaveTypeFilter === 'annual' && category !== 'annual') return false;
        if (leaveTypeFilter === 'personal' && category !== 'personal') return false;
      }

      return true;
    });
  }, [leaveRequests, visibleEmployeeIds, dateRange, leaveTypeFilter, leaveTypeMap]);

  // Metrics (using chargeable days where available)
  const metrics = useMemo(() => {
    const approvedRequests = filteredRequests.filter((r) => r.status === 'approved');
    const pendingRequests = filteredRequests.filter((r) => r.status === 'pending');

    const annualDays = approvedRequests
      .filter((r) => getLeaveTypeCategory(r.leave_type_id) === 'annual')
      .reduce((sum, r) => {
        const chargeable = chargeableDaysMap[r.id] ?? r.total_days ?? 0;
        return sum + chargeable;
      }, 0);

    const personalDays = approvedRequests
      .filter((r) => getLeaveTypeCategory(r.leave_type_id) === 'personal')
      .reduce((sum, r) => {
        const chargeable = chargeableDaysMap[r.id] ?? r.total_days ?? 0;
        return sum + chargeable;
      }, 0);

    const employeesWithLeave = new Set(approvedRequests.map((r) => r.employee_id)).size;

    return {
      annualDays: formatDays(safeNumber(annualDays, 0)),
      personalDays: formatDays(safeNumber(personalDays, 0)),
      pendingCount: pendingRequests.length,
      employeesWithLeave,
      totalEmployees: visibleEmployees.length,
    };
  }, [filteredRequests, visibleEmployees, chargeableDaysMap]);

  // Loading / permission / error gates
  if (permLoading || !employeeCtx) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAllowed) {
    // useRequirePermission likely already surfaced a message or redirect,
    // but we can show a simple fallback.
    return (
      <div className="flex justify-center py-12 text-gray-500">
        You don’t have permission to view this report.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link to={createPageUrl('ReportingOverview')}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </Link>
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 mb-2">{loadError}</p>
            <Button onClick={loadData} className="mt-2">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to={createPageUrl('ReportingOverview')}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Leave Summary</h1>
        <p className="text-gray-500 mt-1">
          Usage, balances and trends across the team.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Date Preset */}
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger>
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom dates */}
            {datePreset === 'custom' && (
              <>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  placeholder="Start date"
                />
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  placeholder="End date"
                />
              </>
            )}

            {/* Entity */}
            {entitiesFromCtx.length > 1 && (
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {entitiesFromCtx
                    .filter((e) =>
                      visibleEmployeesFromCtx.some((emp) => emp.entity_id === e.id)
                    )
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.abbreviation || e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {/* Department */}
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departmentsFromCtx
                  .filter((d) =>
                    visibleEmployeesFromCtx.some((emp) => emp.department_id === d.id)
                  )
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Employment Type */}
            <Select value={employmentType} onValueChange={setEmploymentType}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Leave Type */}
            <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All leave types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All leave types</SelectItem>
                <SelectItem value="annual">Annual only</SelectItem>
                <SelectItem value="personal">Personal only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Showing {format(dateRange.start, 'MMM d, yyyy')} –{' '}
            {format(dateRange.end, 'MMM d, yyyy')}
          </p>
        </CardContent>
      </Card>

      {/* Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Annual Leave Taken */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Sun className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">
                Annual Leave Taken
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{metrics.annualDays}</p>
            <p className="text-sm text-gray-500">days</p>
          </CardContent>
        </Card>

        {/* Personal Leave Taken */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-rose-100 flex items-center justify-center">
                <Thermometer className="h-5 w-5 text-rose-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">
                Personal Leave Taken
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{metrics.personalDays}</p>
            <p className="text-sm text-gray-500">days</p>
          </CardContent>
        </Card>

        {/* Pending Requests */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">
                Pending Requests
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{metrics.pendingCount}</p>
            <p className="text-sm text-gray-500">awaiting approval</p>
          </CardContent>
        </Card>

        {/* Employees with Leave */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">
                Employees with Leave
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {metrics.employeesWithLeave}
              <span className="text-lg font-normal text-gray-400">
                {' '}
                of {metrics.totalEmployees}
              </span>
            </p>
            <p className="text-sm text-gray-500">employees</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      {filteredRequests.length > 0 && (
        <LeaveSummaryCharts
          filteredRequests={filteredRequests}
          chargeableDaysMap={chargeableDaysMap}
          dateRange={dateRange}
          getLeaveTypeCategory={getLeaveTypeCategory}
        />
      )}

      {/* Per-Employee Table */}
      {filteredRequests.length > 0 && (
        <LeaveSummaryTable
          filteredRequests={filteredRequests}
          chargeableDaysMap={chargeableDaysMap}
          visibleEmployees={visibleEmployees}
          departments={departmentsFromCtx}
          entities={entitiesFromCtx}
          getLeaveTypeCategory={getLeaveTypeCategory}
          leaveTypes={leaveTypes}
          canApproveLeave={employeeCtx?.permissions?.canApproveLeave || false}
        />
      )}

      {/* Empty state */}
      {filteredRequests.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              No leave found for the selected period and filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}