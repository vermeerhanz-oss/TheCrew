import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const toYMD = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Loader2, CalendarDays } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO,
  isToday,
  getYear,
} from 'date-fns';
import { getPublicHolidaysInRange, resolveCalendarForEmployee } from '@/components/utils/publicHolidays';
import { getLeaveHistoryForEmployee } from '@/components/utils/LeaveEngine';
import { subscribeToLeaveCache } from '@/components/utils/leaveEngineCache';
import CalendarLegend from './CalendarLegend';
import CalendarFilters from './CalendarFilters';
import CalendarDayCell from './CalendarDayCell';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function InteractiveLeaveCalendar({
  employee,
  teamLeaveRequests,
  employeesMap = {},
  isTeamCalendar = false,
  onRequestLeave,
  entityId,
  stateRegion,
  departments = [],
  publicHolidays: propPublicHolidays,
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [fetchedHolidays, setFetchedHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  const publicHolidays = propPublicHolidays || fetchedHolidays;
  console.log('PUBLIC HOLIDAYS PROP', publicHolidays);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to cache invalidation for auto-refresh
  useEffect(() => {
    const unsubscribe = subscribeToLeaveCache(() => {
      setRefreshKey(prev => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Navigation handlers with useCallback
  const handlePrevYear = useCallback(() => setYear(y => y - 1), []);
  const handleNextYear = useCallback(() => setYear(y => y + 1), []);
  const goToToday = useCallback(() => setYear(getYear(new Date())), []);

  // Load data when year or refresh key changes
  useEffect(() => {
    loadYearData();
  }, [employee?.id, year, teamLeaveRequests, isTeamCalendar, refreshKey]);

  const loadYearData = async () => {
    setIsLoading(true);
    try {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      let requests = [];
      if (isTeamCalendar && teamLeaveRequests) {
        // Team calendar: use pre-fetched data
        requests = teamLeaveRequests.filter((req) => {
          if (req.status !== 'approved' && req.status !== 'pending') return false;
          return req.end_date >= yearStart && req.start_date <= yearEnd;
        });
      } else if (employee) {
        // Personal calendar: fetch own leave
        const history = await getLeaveHistoryForEmployee(employee.id);
        requests = history.filter((req) => {
          if (req.status !== 'approved' && req.status !== 'pending') return false;
          return req.end_date >= yearStart && req.start_date <= yearEnd;
        });
      }
      setLeaveRequests(requests);

      // Fetch public holidays if not provided via props
      if (!propPublicHolidays) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        const effEntityId = entityId || employee?.entity_id;
        
        // Try to resolve calendar ID from employee
        let calendarId = null;
        if (employee?.id) {
          calendarId = await resolveCalendarForEmployee(employee.id);
        }

        console.log('[HOLIDAY DEBUG] Resolved calendar lookup:', {
          employeeId: employee?.id,
          entityId,
          effEntityId,
          stateRegion: stateRegion || employee?.state,
          year
        });

        console.log('[HOLIDAY DEBUG] Resolved calendar lookup:', {
          employeeId: employee?.id,
          entityId: effEntityId,
          stateRegion: stateRegion || employee?.state,
          year
        });

        // Filtered call matching the new signature
        const holidays = await getPublicHolidaysInRange({
          entityId: effEntityId,
          region: stateRegion || employee?.state,
          startDate,
          endDate
        });
        
        console.log('[HOLIDAY DEBUG] Calendar received holidays for year', year, holidays);
        setFetchedHolidays(holidays);
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter leave requests based on current filters
  const filteredLeaveRequests = useMemo(() => {
    return leaveRequests.filter(req => {
      // Status filter
      if (statusFilter === 'approved' && req.status !== 'approved') return false;
      if (statusFilter === 'pending' && req.status !== 'pending') return false;
      
      // Department filter (team calendar only)
      if (isTeamCalendar && departmentFilter !== 'all') {
        const emp = employeesMap[req.employee_id];
        if (!emp || emp.department_id !== departmentFilter) return false;
      }
      
      // Employee filter
      if (employeeFilter.length > 0) {
        if (!employeeFilter.includes(req.employee_id)) return false;
      }
      
      return true;
    });
  }, [leaveRequests, statusFilter, departmentFilter, employeeFilter, isTeamCalendar, employeesMap]);

  // Build unified events-by-day map
  const holidayYMDs = React.useMemo(() => {
    if (!publicHolidays || publicHolidays.length === 0) return [];
    const list = [];
    for (const ph of publicHolidays) {
      // IMPORTANT: use the actual date field from the PublicHoliday entity.
      // If the field is not called `date`, replace `ph.date` with the correct field
      // (for example `ph.holiday_date` or similar).
      const ymd = toYMD(ph.date);
      if (ymd) list.push(ymd);
    }
    console.log('[DEBUG] publicHolidays YMDs for year', year, list);
    return list;
  }, [publicHolidays, year]);

  const eventsByDay = useMemo(() => {
    const map = new Map();

    // 1. ALWAYS add public holidays
    publicHolidays.forEach(holiday => {
      const dayKey = holiday.date; // format: yyyy-MM-dd
      const existing = map.get(dayKey) || [];
      map.set(dayKey, [...existing, {
        id: `holiday-${holiday.id || holiday.date}`,
        kind: 'holiday',
        status: 'public_holiday',
        label: holiday.name || 'Public holiday',
        original: holiday
      }]);
    });

    // 2. Add filtered leave requests
    filteredLeaveRequests.forEach(req => {
      const start = parseISO(req.start_date);
      const end = parseISO(req.end_date);
      const isSingleDay = req.start_date === req.end_date;
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayKey = format(d, 'yyyy-MM-dd');
        const existing = map.get(dayKey) || [];
        
        map.set(dayKey, [...existing, {
          ...req,
          kind: 'leave',
          isHalfDay: isSingleDay && (req.partial_day_type === 'half_am' || req.partial_day_type === 'half_pm'),
          partialDayType: req.partial_day_type || 'full',
        }]);
      }
    });

    return map;
  }, [filteredLeaveRequests, publicHolidays]);

  useEffect(() => {
    console.log('EVENTS BY DAY KEYS', Array.from(eventsByDay.keys()));
  }, [eventsByDay]);

  // Get unique employees for filter dropdown
  const visibleEmployees = useMemo(() => {
    if (!isTeamCalendar) return [];
    const empIds = new Set(leaveRequests.map(r => r.employee_id));
    return Object.values(employeesMap).filter(e => empIds.has(e.id));
  }, [isTeamCalendar, leaveRequests, employeesMap]);

  const hasActiveFilters = statusFilter !== 'all' || departmentFilter !== 'all' || employeeFilter.length > 0;

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setDepartmentFilter('all');
    setEmployeeFilter([]);
  }, []);

  const handleDayClick = useCallback((dateStr) => {
    setSelectedDay(dateStr);
  }, []);

  const handleClosePopover = useCallback(() => {
    setSelectedDay(null);
  }, []);

  const handleRequestLeaveClick = useCallback((dateStr) => {
    setSelectedDay(null);
    if (onRequestLeave) {
      onRequestLeave(dateStr);
    }
  }, [onRequestLeave]);

  const isDebug = process.env.NODE_ENV === 'development' || base44.config?.SHOW_DEBUG_BANNERS === true;

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm text-gray-500">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isDebug && (
        <div className="mb-2 rounded-md bg-purple-50 px-3 py-2 text-[11px] text-purple-800">
          <div className="font-semibold">DEBUG – Holidays loaded for {year}:</div>
          {holidayYMDs.length === 0 ? (
            <div>None</div>
          ) : (
            <div className="break-words">
              {holidayYMDs.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Year navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={handlePrevYear} disabled={isLoading}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {year - 1}
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{year}</h2>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            <CalendarDays className="h-4 w-4 mr-1" />
            Today
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleNextYear} disabled={isLoading}>
          {year + 1}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg px-4 py-3">
        <CalendarLegend showHalfDay={true} />
      </div>

      {/* Filters (team calendar only) */}
      {isTeamCalendar && (
        <CalendarFilters
          departments={departments}
          employees={visibleEmployees}
          selectedDepartment={departmentFilter}
          onDepartmentChange={setDepartmentFilter}
          selectedStatus={statusFilter}
          onStatusChange={setStatusFilter}
          selectedEmployees={employeeFilter}
          onEmployeeChange={setEmployeeFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {/* Personal calendar status filter */}
      {!isTeamCalendar && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Show:</span>
          <div className="flex gap-1">
            {['all', 'approved', 'pending'].map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={statusFilter === status ? 'bg-indigo-600' : ''}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MONTHS.map((monthName, monthIndex) => (
          <MonthGrid
            key={`${year}-${monthIndex}`}
            year={year}
            month={monthIndex}
            monthName={monthName}
            eventsByDay={eventsByDay}
            onDayClick={handleDayClick}
            selectedDay={selectedDay}
            isTeamCalendar={isTeamCalendar}
            employeesMap={employeesMap}
            onRequestLeave={handleRequestLeaveClick}
            onClosePopover={handleClosePopover}
            holidayYMDs={holidayYMDs}
          />
        ))}
      </div>
    </div>
  );
}

// Memoized month grid component
const MonthGrid = React.memo(function MonthGrid({
  year,
  month,
  monthName,
  eventsByDay,
  onDayClick,
  selectedDay,
  isTeamCalendar,
  employeesMap,
  onRequestLeave,
  onClosePopover,
  holidayYMDs,
}) {
  const firstDay = startOfMonth(new Date(year, month));
  const lastDay = endOfMonth(new Date(year, month));
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });

  const startDayOfWeek = getDay(firstDay);
  const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  return (
    <Card className="overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 border-b">
        <h3 className="font-semibold text-gray-700 text-sm">{monthName}</h3>
      </div>
      <CardContent className="p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_HEADERS.map((day, idx) => (
            <div key={idx} className="text-center text-[10px] text-gray-400 font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: offset }).map((_, idx) => (
            <div key={`empty-${idx}`} className="aspect-square" />
          ))}

          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const events = eventsByDay.get(dateStr) || [];
            
            // Filter to find holiday and leaves
            const holidayEvent = events.find(e => e.kind === 'holiday');
            const holiday = holidayEvent ? (holidayEvent.original || { name: holidayEvent.label }) : null;
            
            const leaves = events.filter(e => e.kind !== 'holiday');
            const isSelected = selectedDay === dateStr;

            const dayYMD = toYMD(day);
            const isPublicHoliday = !!dayYMD && holidayYMDs?.includes(dayYMD);

            return (
              <CalendarDayCell
                key={dateStr}
                date={day}
                leaves={leaves}
                holiday={holiday}
                isPublicHoliday={isPublicHoliday}
                isTeamCalendar={isTeamCalendar}
                employeesMap={employeesMap}
                isSelected={isSelected}
                onSelect={onDayClick}
                onClose={onClosePopover}
                onRequestLeave={onRequestLeave}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});