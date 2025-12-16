import { base44 } from '@/api/base44Client';
import { getVisibleEmployeeIdsForLeave } from './permissions';

const LeaveRequest = base44.entities.LeaveRequest;
const Employee = base44.entities.Employee;
const Department = base44.entities.Department;

/**
 * Leave Calendar Helpers
 *
 * Optimized helpers for leave calendar data fetching.
 * Single query per entity type – avoids N+1 patterns on employees/departments.
 */

/**
 * Fetch all team leave for a date range in a single optimized query.
 * Returns normalized leave data with employee + department info.
 *
 * @param {Object} params
 * @param {string} params.startDate - Start date (yyyy-MM-dd)
 * @param {string} params.endDate - End date (yyyy-MM-dd)
 * @param {Object} params.user - Current user
 * @param {Object} params.currentEmployee - Current user's employee record
 * @param {Object} params.preferences - User preferences
 * @param {Array<string>} [params.statusFilter] - Statuses to include
 * @param {string} [params.departmentId] - Filter by department
 * @param {Set<string>} [params.employeeIds] - Filter by specific employees
 * @returns {Promise<{
 *   leave: Array,
 *   employees: Record<string, any>,
 *   departments: Array,
 *   visibleEmployeeIds: Set<string>
 * }>}
 */
export async function getTeamLeaveForCalendar({
  startDate,
  endDate,
  user,
  currentEmployee,
  preferences,
  statusFilter = ['approved', 'pending'],
  departmentId = null,
  employeeIds = null,
}) {
  // Fetch everything we need up-front
  const [employeesRes, leaveRes, departmentsRes] = await Promise.all([
    Employee.filter({ status: 'active' }),
    LeaveRequest.list(),
    Department.list(),
  ]);

  const allEmployees = employeesRes || [];
  const allLeave = leaveRes || [];
  const allDepartments = departmentsRes || [];

  // Permission: which employees' leave can this user see?
  const visibleIds = getVisibleEmployeeIdsForLeave(
    user,
    currentEmployee,
    preferences,
    allEmployees
  );

  // Build employee/department lookup maps
  const employeeMap = {};
  const deptMap = {};

  allEmployees.forEach((e) => {
    employeeMap[e.id] = e;
  });

  allDepartments.forEach((d) => {
    deptMap[d.id] = d;
  });

  // Filter leave requests
  const filteredLeave = allLeave.filter((req) => {
    // Status filter
    if (!statusFilter.includes(req.status)) return false;

    // Permission filter
    if (!visibleIds.has(req.employee_id)) return false;

    // Date range overlap (inclusive)
    if (req.end_date < startDate || req.start_date > endDate) return false;

    // Department filter
    if (departmentId) {
      const emp = employeeMap[req.employee_id];
      if (!emp || emp.department_id !== departmentId) return false;
    }

    // Specific employee filter
    if (employeeIds && employeeIds.size > 0) {
      if (!employeeIds.has(req.employee_id)) return false;
    }

    return true;
  });

  // Normalize leave data for UI
  const normalizedLeave = filteredLeave.map((req) => {
    const emp = employeeMap[req.employee_id];

    const employeeName = emp
      ? `${emp.preferred_name || emp.first_name} ${emp.last_name}`
      : 'Unknown';

    const deptId = emp?.department_id || null;
    const deptName = deptId ? deptMap[deptId]?.name || null : null;

    return {
      id: req.id,
      employeeId: req.employee_id,
      employeeName,
      leaveTypeId: req.leave_type_id,
      status: req.status,
      startDate: req.start_date,
      endDate: req.end_date,
      totalDays: req.total_days,
      partialDayType: req.partial_day_type || 'full',
      reason: req.reason,
      departmentId: deptId,
      departmentName: deptName,
    };
  });

  // Unique departments that have *visible* employees
  const visibleDepts = new Set();
  allEmployees.forEach((e) => {
    if (visibleIds.has(e.id) && e.department_id) {
      visibleDepts.add(e.department_id);
    }
  });

  const departments = allDepartments.filter((d) => visibleDepts.has(d.id));

  return {
    leave: normalizedLeave,
    employees: employeeMap,
    departments,
    visibleEmployeeIds: visibleIds,
  };
}

/**
 * Get personal leave for calendar display (for a single employee).
 */
export async function getPersonalLeaveForCalendar(employeeId, startDate, endDate) {
  const leave = (await LeaveRequest.filter({ employee_id: employeeId })) || [];

  return leave
    .filter((req) => {
      if (req.status !== 'approved' && req.status !== 'pending') return false;
      if (req.end_date < startDate || req.start_date > endDate) return false;
      return true;
    })
    .map((req) => ({
      id: req.id,
      employeeId: req.employee_id,
      leaveTypeId: req.leave_type_id,
      status: req.status,
      startDate: req.start_date,
      endDate: req.end_date,
      totalDays: req.total_days,
      partialDayType: req.partial_day_type || 'full',
      reason: req.reason,
    }));
}

/**
 * Build a date-indexed map of leave for fast calendar rendering.
 *
 * @param {Array} leaveRequests - Normalized leave items from getTeamLeaveForCalendar/getPersonalLeaveForCalendar
 * @returns {Record<string, Array>}
 */
export function buildLeaveDateMap(leaveRequests) {
  const dateMap = {};

  leaveRequests.forEach((leave) => {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);

    // Iterate from start to end inclusive
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      if (!dateMap[dateStr]) {
        dateMap[dateStr] = [];
      }

      const isHalfDay =
        leave.startDate === leave.endDate &&
        (leave.partialDayType === 'half_am' ||
          leave.partialDayType === 'half_pm');

      dateMap[dateStr].push({
        ...leave,
        isHalfDay,
      });
    }
  });

  return dateMap;
}
