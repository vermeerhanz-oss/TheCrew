import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { useTenantApi } from '@/components/utils/useTenantApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Download, Filter } from 'lucide-react';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { exportToCsv } from '@/components/utils/exportCsv';
import { format } from 'date-fns';
import { getDisplayName } from '@/components/utils/displayName';
import { formatHours, formatCurrency } from '@/components/utils/numberUtils';
import { getEmployeeHourlyRate } from '@/components/utils/payUtils';
import { calculateLeaveSummaryForPeriod } from '@/components/utils/leaveHelpers';
import PageHelpTrigger from '@/components/assistant/PageHelpTrigger';
import { useAssistant } from '@/components/assistant/AssistantContext';
import ErrorState from '@/components/common/ErrorState';
import logger, { logApiError } from '@/components/utils/logger';

export default function LeaveAccrualReport() {
  const api = useTenantApi();
  const context = useEmployeeContext();
  const { openWithMessage } = useAssistant();
  const { isAllowed: isAuthorized, isLoading: permissionLoading } = useRequirePermission(context, 'canViewReports');

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const fyStart = new Date(today.getFullYear(), 6, 1); // July 1st
    if (today < fyStart) fyStart.setFullYear(today.getFullYear() - 1);
    return format(fyStart, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');

  // Data
  const [data, setData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Load initial metadata
  useEffect(() => {
    // Guard: wait for context with tenantId
    if (!context?.tenantId) {
      console.log('[LeaveAccrualReport] Waiting for tenantId...');
      return;
    }
    if (!isAuthorized) {
      return;
    }

    const loadMetadata = async () => {
      try {
        setError(null);
        const [depts, types] = await Promise.all([
          api.departments?.list ? api.departments.list() : [],
          api.leaveTypes?.list ? api.leaveTypes.list() : [],
        ]);
        setDepartments(depts || []);
        setLeaveTypes(types || []);
      } catch (err) {
        const userMsg = logApiError('LeaveAccrualReport:Meta', err);
        setError(userMsg);
      }
    };

    loadMetadata();
    // ✅ STABLE DEPS: tenantId, isAuthorized
  }, [context?.tenantId, isAuthorized]);

  // Main report runner
  const runReport = async () => {
    setIsLoading(true);
    setError(null);

    logger.info('leaveAccrualReport', 'Running report', { startDate, endDate, departmentFilter });

    try {
      // 1. Fetch Employees
      const emps = await api.employees.filter({ status: 'active' });
      setEmployees(emps);

      // 2. Fetch ALL Approved Requests + current balances
      const [requests, currentBalances] = await Promise.all([
        api.leaveRequests.filter({ status: 'approved' }, '-start_date', 10000),
        api.employeeLeaveBalances.list(),
      ]);
      // currentBalances is fetched for future use; currently not applied in this helper-based approach.

      // 3. Process Data
      const rows = [];
      const leaveTypeMap = {}; // id -> { name, code, mappedType }
      leaveTypes.forEach(t => {
        const code = (t.code || t.name || '').toLowerCase();
        const mappedType = (code.includes('personal') || code.includes('sick')) ? 'personal' : 'annual';
        leaveTypeMap[t.id] = { ...t, mappedType };
      });

      emps.forEach(emp => {
        const empRequests = requests.filter(r => r.employee_id === emp.id);

        ['annual', 'personal'].forEach(type => {
          if (leaveTypeFilter !== 'all' && leaveTypeFilter !== type) return;

          const relevantLeaveTypes = leaveTypes.filter(lt => {
            const mapping = leaveTypeMap[lt.id];
            return mapping && mapping.mappedType === type;
          });

          if (relevantLeaveTypes.length === 0) {
            return;
          }

          const primaryLeaveType = relevantLeaveTypes[0];

          const relevantRequests = empRequests.filter(r => {
            const m = leaveTypeMap[r.leave_type_id];
            return m && m.mappedType === type;
          });

          const summary = calculateLeaveSummaryForPeriod({
            employee: emp,
            leaveType: primaryLeaveType,
            periodStart: startDate,
            periodEnd: endDate,
            leaveRequests: relevantRequests,
            initialOpeningHours: 0, // starting from 0 for forward calculation
          });

          const hourlyRate = getEmployeeHourlyRate(emp);

          let isPayable = primaryLeaveType.is_payable_on_termination;
          if (isPayable === undefined) {
            isPayable = (type === 'annual');
          }

          const liability = (hourlyRate && isPayable)
            ? (summary.closing * hourlyRate)
            : null;

          rows.push({
            id: `${emp.id}-${type}`,
            employeeId: emp.id,
            name: getDisplayName(emp),
            email: emp.email,
            department: departments.find(d => d.id === emp.department_id)?.name || '—',
            employmentType: emp.employment_type || 'Full Time',
            leaveType: primaryLeaveType.name || (type === 'annual' ? 'Annual Leave' : 'Personal Leave'),
            openingBalance: summary.opening,
            accrued: summary.accrued,
            taken: summary.taken,
            closingBalance: summary.closing,
            hourlyRate: hourlyRate,
            liability: liability,
          });
        });
      });

      setData(rows);
    } catch (err) {
      const userMsg = logApiError('leaveAccrualReport', err, { phase: 'runReport' });
      setError(userMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Final table data (search + department filter)
  const tableData = useMemo(() => {
    let res = data;

    // Search by name or email
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
      );
    }

    // Department filter by employee.department_id
    if (departmentFilter !== 'all') {
      const empMap = new Map(employees.map(e => [e.id, e]));
      res = res.filter(r => {
        const e = empMap.get(r.employeeId);
        return e && e.department_id === departmentFilter;
      });
    }

    return res;
  }, [data, search, departmentFilter, employees]);

  const handleExport = () => {
    if (!tableData.length) {
      // Optionally toast here if you have toast available in this file
      // toast.error("No rows to export for the current filters");
      return;
    }

    const exportRows = tableData.map(r => ({
      'Employee Name': r.name,
      'Email': r.email,
      'Department': r.department,
      'Employment Type': r.employmentType,
      'Leave Type': r.leaveType,
      'Opening Balance': formatHours(r.openingBalance),
      'Accrued': formatHours(r.accrued),
      'Taken': formatHours(r.taken),
      'Closing Balance': formatHours(r.closingBalance),
      'Hourly Rate': r.hourlyRate ? r.hourlyRate.toFixed(2) : '-',
      'Liability': r.liability !== null ? r.liability.toFixed(2) : '-',
    }));

    exportToCsv({
      filename: 'leave_accrual_summary',
      columns: Object.keys(exportRows[0]).map(k => ({ key: k, label: k })),
      rows: exportRows,
    });
  };

  if (permissionLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState
          title="We couldn’t load the report data"
          message="Something went wrong while generating the report. Please try again."
          onRetry={data.length > 0 ? runReport : loadMetadata}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Leave Accrual Summary</h1>
            <PageHelpTrigger />
            <Button
              variant="outline"
              size="sm"
              className="ml-2 h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() =>
                openWithMessage(
                  "Explain this Leave Accrual Report in accountant terms. What do Opening, Accrued, Taken, Closing and Liability mean, and how should I use this for bookkeeping in Australia?"
                )
              }
            >
              Help for Accountants
            </Button>
          </div>
          <p className="text-gray-500 mt-1">Summary of leave accrued and utilised for each employee.</p>
        </div>
      </div>

      <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 border border-slate-200">
        <p className="text-xs sm:text-sm text-slate-600">
          <span className="font-medium">NES-compliant accruals:</span> Leave accrues progressively based on ordinary hours worked.
          Personal/Carer’s Leave does not create a monetary liability and is excluded from the liability column.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments
                    .filter(d => d.id)
                    .map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Button
                onClick={runReport}
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Filter className="h-4 w-4 mr-2" />
                )}
                Run Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions & Search */}
      {data.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV for Accountant
          </Button>
        </div>
      )}

      {/* Data Table */}
      {data.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Dept
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Leave Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Opening Balance (hrs)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Accrued (hrs)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Taken (hrs)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Closing Balance (hrs)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Hourly Rate
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Liability
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableData.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-500">{row.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{row.department}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 capitalize">{row.leaveType}</td>
                    <td className="px-6 py-4 text-sm text-right font-mono">
                      {formatHours(row.openingBalance)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono text-green-600">
                      +{formatHours(row.accrued)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono text-red-600">
                      -{formatHours(row.taken)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono font-bold">
                      {formatHours(row.closingBalance)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono text-gray-500">
                      {row.hourlyRate ? formatCurrency(row.hourlyRate) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono font-medium text-gray-900">
                      {row.liability !== null ? formatCurrency(row.liability) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        !isLoading && (
          <div className="p-6 text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No leave accrual data found for this period. Try adjusting the date range or filters.
          </div>
        )
      )}
    </div>
  );
}