import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Network,
  Calendar,
  Settings,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Briefcase,
  UserPlus,
  UserMinus,
  Clock,
  Loader2,
} from 'lucide-react';
import { logApiError, logPerf } from '@/components/utils/logger';
import ErrorState from '@/components/common/ErrorState';
import {
  getDisplayFirstName,
  getDisplayName,
  getInitials,
} from '@/components/utils/displayName';

const UpcomingTimeOffCard = React.lazy(() => import('@/components/home/UpcomingTimeOffCard'));

import { getPublicHolidaysInRange } from '@/components/utils/publicHolidays';
import { calculateChargeableLeave } from '@/components/utils/LeaveEngine';
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  isAfter,
  isBefore,
} from 'date-fns';

import { useAppConfig } from '@/components/providers/ConfigProvider';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { useTenantApi } from '@/components/utils/useTenantApi';
import IntroTourOverlay from '@/components/onboarding/IntroTourOverlay';

/**
 * Helper: pick the first API endpoint that exists (handles registry key mismatches)
 */
function pickEndpoint(api, candidates = []) {
  if (!api) return null;
  for (const key of candidates) {
    if (api[key]) return api[key];
  }
  return null;
}

/**
 * Helper: safe filter/list wrappers
 */
async function safeFilter(endpoint, where = {}) {
  if (!endpoint?.filter) return [];
  try {
    const res = await endpoint.filter(where);
    return Array.isArray(res) ? res : [];
  } catch (e) {
    console.warn('[Home] safeFilter failed:', e);
    return [];
  }
}

export default function Home() {
  const employeeCtx = useEmployeeContext();
  const api = useTenantApi();
  const { publicHolidays } = useAppConfig();

  // ✅ HARD GUARD: context not ready
  if (!employeeCtx || !employeeCtx.user) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const {
    user,
    employee,
    directReports = [],
    isAdmin: isUserAdmin = false,
    isManager: isUserManager = false,
    tenantId = null,
    userFlags = {},
  } = employeeCtx;

  // ✅ HARD GUARD: scoped API not ready yet (prevents api null issues)
  if (!api) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Optional debug: shows what keys exist on api (helps match registry)
  useEffect(() => {
    console.log('[Home] api keys:', Object.keys(api || {}).sort());
  }, [api]);

  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTutorialOverlay, setShowTutorialOverlay] = useState(false);

  const [dashboardData, setDashboardData] = useState({
    nextLeave: null,
    nextLeaveChargeable: null,
    upcomingHolidays: [],
    teamOnLeave: [],
  });

  const locations = useMemo(() => {
    const locMap = {};
    (employeeCtx?.locations || []).forEach((l) => {
      if (l?.id) locMap[l.id] = l.name;
    });
    return locMap;
  }, [employeeCtx?.locations]);

  // Auto-show tutorial overlay
  useEffect(() => {
    const hasSeenIntroTour = userFlags?.hasSeenIntroTour ?? false;
    if (!hasSeenIntroTour && !isLoading && !error) {
      const timer = setTimeout(() => setShowTutorialOverlay(true), 500);
      return () => clearTimeout(timer);
    }
  }, [userFlags, isLoading, error]);

  useEffect(() => {
    if (user && tenantId && api) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, employee, tenantId, api]);

  const loadData = async () => {
    // For brand new tenants: don’t crash / don’t spin forever
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    const perfStart = performance.now();
    setError(null);
    setIsLoading(true);

    try {
      const shouldFetchAdminData = isUserAdmin || isUserManager;
      const shouldFetchLocationData = isUserManager && (directReports?.length ?? 0) > 0;

      const employeesList = employeeCtx?.employees || [];
      const locationsList = employeeCtx?.locations || [];

      // 🔧 Resolve endpoints safely (handles registry naming mismatches)
      const leaveRequests = pickEndpoint(api, ['leaveRequests', 'leaveRequest']);
      const onboardingInstances = pickEndpoint(api, ['onboardingInstances', 'onboardingInstance']);
      const onboardingTasks = pickEndpoint(api, ['onboardingTasks', 'onboardingTask']);
      const employeeOffboardings = pickEndpoint(api, ['employeeOffboardings', 'employeeOffboarding']);
      const employeeOffboardingTasks = pickEndpoint(api, ['employeeOffboardingTasks', 'employeeOffboardingTask']);

      // Build promises (IMPORTANT: do NOT pass entity_id/tenantId — scoped api injects entity_id)
      const promises = {
        employees: Promise.resolve(shouldFetchAdminData ? employeesList : []),
        locations: Promise.resolve(shouldFetchLocationData ? locationsList : []),

        pendingLeave: shouldFetchAdminData
          ? safeFilter(leaveRequests, { status: 'pending' })
          : Promise.resolve([]),

        activeOnboarding: shouldFetchAdminData
          ? safeFilter(onboardingInstances, { status: 'active' })
          : Promise.resolve([]),

        onboardingTasks: shouldFetchAdminData
          ? safeFilter(onboardingTasks, { status: 'not_started' })
          : Promise.resolve([]),

        activeOffboarding: shouldFetchAdminData
          ? safeFilter(employeeOffboardings, { status: 'in_progress' })
          : Promise.resolve([]),

        offboardingTasks: shouldFetchAdminData
          ? safeFilter(employeeOffboardingTasks, { status: 'not_started' })
          : Promise.resolve([]),

        myLeave: employee
          ? safeFilter(leaveRequests, { employee_id: employee.id })
          : Promise.resolve([]),

        approvedLeave:
          isUserManager && (directReports?.length ?? 0) > 0
            ? safeFilter(leaveRequests, { status: 'approved' })
            : Promise.resolve([]),
      };

      const results = await Promise.all(Object.values(promises));
      const data = Object.keys(promises).reduce((acc, key, index) => {
        acc[key] = results[index] || [];
        return acc;
      }, {});

      const todoItems = [];

      const empMap = new Map((employeesList || []).map(e => [e.id, e]));

      // Leave approvals
      if (shouldFetchAdminData) {
        const pendingLeave = data.pendingLeave || [];
        const myApprovals = isUserAdmin
          ? pendingLeave
          : pendingLeave.filter((r) => r.manager_id === employee?.id);

        myApprovals.forEach((req) => {
          const requester = empMap.get(req.employee_id);
          todoItems.push({
            id: `leave-${req.id}`,
            type: 'leave',
            icon: Calendar,
            title: `Leave request from ${requester ? getDisplayFirstName(requester) : 'Employee'}`,
            subtitle: `${req.total_days} days`,
            link: createPageUrl('LeaveApprovals'),
            color: 'text-blue-600 bg-blue-50',
          });
        });
      }

      // Onboarding
      if (shouldFetchAdminData) {
        const activeOnboarding = data.activeOnboarding || [];
        const onboardingTasksArr = data.onboardingTasks || [];

        for (const inst of activeOnboarding) {
          const hire = empMap.get(inst.employee_id);
          if (isUserAdmin || hire?.manager_id === employee?.id) {
            const instTasks = onboardingTasksArr.filter((t) => t.instance_id === inst.id);
            const managerTasks = instTasks.filter((t) => t.assigned_to_role === 'MANAGER' || isUserAdmin);

            if (managerTasks.length > 0) {
              todoItems.push({
                id: `onboard-${inst.id}`,
                type: 'onboarding',
                icon: UserPlus,
                title: `Onboarding tasks for ${hire ? getDisplayFirstName(hire) : 'New hire'}`,
                subtitle: `${managerTasks.length} pending`,
                link: createPageUrl('OnboardingDetail') + `?id=${inst.id}`,
                color: 'text-green-600 bg-green-50',
              });
            }
          }
        }
      }

      // Offboarding
      if (shouldFetchAdminData) {
        const activeOffboarding = data.activeOffboarding || [];
        const offboardingTasksArr = data.offboardingTasks || [];

        for (const inst of activeOffboarding) {
          const leaver = empMap.get(inst.employee_id);
          if (isUserAdmin || leaver?.manager_id === employee?.id) {
            const instTasks = offboardingTasksArr.filter((t) => t.instance_id === inst.id);
            if (instTasks.length > 0) {
              todoItems.push({
                id: `offboard-${inst.id}`,
                type: 'offboarding',
                icon: UserMinus,
                title: `Offboarding tasks for ${leaver ? getDisplayFirstName(leaver) : 'Employee'}`,
                subtitle: `${instTasks.length} pending`,
                link: createPageUrl('Offboarding'),
                color: 'text-orange-600 bg-orange-50',
              });
            }
          }
        }
      }

      // Upcoming time off / holidays
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      let nextLeave = null;
      let nextLeaveChargeable = null;

      const myLeaveArr = data.myLeave || [];
      if (myLeaveArr.length > 0 && employee) {
        const futureLeave = myLeaveArr
          .filter((lr) =>
            (lr.status === 'approved' || lr.status === 'pending') &&
            lr.start_date >= todayStr
          )
          .sort((a, b) => a.start_date.localeCompare(b.start_date));

        if (futureLeave.length > 0) {
          nextLeave = futureLeave[0];
          nextLeaveChargeable = await calculateChargeableLeave({
            start_date: nextLeave.start_date,
            end_date: nextLeave.end_date,
            employee_id: employee.id,
            preloadedHolidays: publicHolidays,
          });
        }
      }

      const upcomingHolidays =
        employee
          ? (
              await getPublicHolidaysInRange({
                startDate: new Date(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
                entityId: employee.entity_id,
                region: employee.state,
                preloadedHolidays: publicHolidays,
              })
            ).slice(0, 3)
          : [];

      let teamOnLeave = [];
      if (isUserManager && (directReports?.length ?? 0) > 0) {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

        const reportIdsSet = new Set(directReports.map((r) => r.id));
        const reportMap = new Map(directReports.map(r => [r.id, r]));
        const approvedLeaveArr = data.approvedLeave || [];

        teamOnLeave = approvedLeaveArr
          .filter((lr) => {
            if (!reportIdsSet.has(lr.employee_id)) return false;
            const start = parseISO(lr.start_date);
            const end = parseISO(lr.end_date);
            return !(isAfter(start, weekEnd) || isBefore(end, weekStart));
          })
          .map((lr) => {
            const rep = reportMap.get(lr.employee_id);
            return {
              ...lr,
              employee_name: rep ? getDisplayFirstName(rep) : 'Unknown',
            };
          });
      }

      setTodos(todoItems);
      setDashboardData({
        nextLeave,
        nextLeaveChargeable,
        upcomingHolidays,
        teamOnLeave,
      });

    } catch (err) {
      console.error('[Home] loadData() error:', err);
      const userMsg = logApiError('Home', err);
      setError(userMsg);
    } finally {
      logPerf('Home.loadData', perfStart);
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      onboarding: 'bg-blue-100 text-blue-700',
      offboarding: 'bg-orange-100 text-orange-700',
      on_leave: 'bg-purple-100 text-purple-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const quickLinks = [
    { label: 'Employee Directory', icon: Users, page: 'Employees', color: 'from-blue-500 to-blue-600' },
    { label: 'Org Chart', icon: Network, page: 'OrgChart', color: 'from-indigo-500 to-indigo-600' },
    { label: 'Leave', icon: Calendar, page: 'MyLeave', color: 'from-green-500 to-green-600' },
    { label: 'Settings', icon: Settings, page: 'Dashboard', color: 'from-gray-500 to-gray-600', adminOnly: true },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState
          title="We couldn’t load your dashboard"
          message={error}
          onRetry={loadData}
        />
      </div>
    );
  }

  const displayName = employee
    ? getDisplayFirstName(employee)
    : user?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      {showTutorialOverlay && (
        <IntroTourOverlay
          userId={user?.id}
          onComplete={() => setShowTutorialOverlay(false)}
          onSkip={() => setShowTutorialOverlay(false)}
        />
      )}

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Welcome back, {displayName}
        </h1>
        <p className="text-gray-500 mt-1">Here's what's happening today</p>
      </div>

      {employee && (
        <React.Suspense fallback={<div className="h-48 w-full animate-pulse bg-gray-100 rounded-xl" />}>
          <UpcomingTimeOffCard
            nextLeave={dashboardData.nextLeave}
            nextLeaveChargeable={dashboardData.nextLeaveChargeable}
            upcomingHolidays={dashboardData.upcomingHolidays}
            teamOnLeave={dashboardData.teamOnLeave}
            isManager={isUserAdmin || isUserManager}
          />
        </React.Suspense>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-indigo-600" />
            Your To-Do List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todos.length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-gray-500">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>You're all caught up!</span>
            </div>
          ) : (
            <div className="space-y-3">
              {todos.map((todo) => (
                <Link
                  key={todo.id}
                  to={todo.link}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors group"
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${todo.color}`}>
                    <todo.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{todo.title}</p>
                    <p className="text-sm text-gray-500">{todo.subtitle}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {directReports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-indigo-600" />
              Your Team
              <Badge variant="secondary" className="ml-2">
                {directReports.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {directReports.map((report) => (
                <Link
                  key={report.id}
                  to={createPageUrl('EmployeeProfile') + `?id=${report.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                    {getInitials(report)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{getDisplayName(report)}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Briefcase className="h-3 w-3" />
                      <span className="truncate">{report.job_title || 'No role'}</span>
                    </div>
                    {locations[report.location_id] && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{locations[report.location_id]}</span>
                      </div>
                    )}
                  </div>
                  <Badge className={getStatusBadge(report.status)}>{report.status}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickLinks
            .filter((link) => !link.adminOnly || isUserAdmin)
            .map((link) => (
              <Link
                key={link.page}
                to={createPageUrl(link.page)}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border bg-white hover:shadow-md transition-all group"
              >
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <link.icon className="h-6 w-6 text-white" />
                </div>
                <span className="font-medium text-gray-700 text-center text-sm">{link.label}</span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
