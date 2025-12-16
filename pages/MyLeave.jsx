// src/pages/MyLeave.jsx

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

import { toast } from "sonner";
import {
  Plus,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import LeaveStatusChip from "@/components/leave/LeaveStatusChip";
import ErrorState from "@/components/common/ErrorState";

import { useTenantApi } from "@/components/utils/useTenantApi";
import { useEmployeeContext } from "@/components/utils/EmployeeContext";
import {
  getCurrentUserEmployeeContextSafe,
  loginOrRedirect,
} from "@/components/utils/authClient";

import {
  getLeaveContextForEmployee,
  calculateChargeableLeave,
  getLeaveHistoryForEmployee,
  canUserRecallLeave,
  recallLeave,
} from "@/components/utils/LeaveEngine";

import { initializeLeaveBalances } from "@/components/utils/leaveBalanceInit";
import { getLeaveBalancesForEmployee } from "@/components/utils/leaveBalanceService";
import { createLeaveRequest } from "@/components/utils/leaveHelpers";

import { formatHours, safeNumber } from "@/components/utils/numberUtils";
import { hoursToDays } from "@/components/utils/timeUtils";
import { logApiError, logPerf } from "@/components/utils/logger";
import { useAppConfig } from "@/components/providers/ConfigProvider";
import { deduplicateLeaveTypes } from "@/components/utils/leaveTypeDropdownDedupe";

export default function MyLeave() {
  const employeeCtx = useEmployeeContext();
  const api = useTenantApi();
  const location = useLocation();

  // URL params: startDate + employeeId (for on-behalf-of)
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const startDateParam = params.get("startDate");
  const targetEmployeeIdParam = params.get("employeeId");
  const prefillStartDate = startDateParam || "";

  // Global config (types + policies + holidays come from ConfigProvider)
  const { leaveTypes: rawLeaveTypes, leavePolicies, publicHolidays, isLoading: configLoading } = useAppConfig();
  
  // Deduplicate leave types for dropdown display
  const leaveTypes = useMemo(() => {
    return deduplicateLeaveTypes(rawLeaveTypes);
  }, [rawLeaveTypes]);

  // Keep latest config in refs (avoid effect dependency storms)
  const leaveTypesRef = useRef(leaveTypes);
  const leavePoliciesRef = useRef(leavePolicies);
  const publicHolidaysRef = useRef(publicHolidays);
  useEffect(() => {
    console.log('[MyLeave] Config updated:', {
      leaveTypes: leaveTypes?.length ?? 0,
      leavePolicies: leavePolicies?.length ?? 0,
    });
    leaveTypesRef.current = leaveTypes;
  }, [leaveTypes]);
  useEffect(() => {
    leavePoliciesRef.current = leavePolicies;
  }, [leavePolicies]);
  useEffect(() => {
    publicHolidaysRef.current = publicHolidays;
  }, [publicHolidays]);

  // Viewer context + target employee (self or report)
  const [userContext, setUserContext] = useState(null);
  const [targetEmployee, setTargetEmployee] = useState(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [loadingError, setLoadingError] = useState(null);

  // Leave data for the subject employee
  const [leaveContext, setLeaveContext] = useState(null);
  const [leaveBalances, setLeaveBalances] = useState(null);
  const [requests, setRequests] = useState([]);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);

  // Form/UI
  const [showForm, setShowForm] = useState(() => !!prefillStartDate);
  const [formData, setFormData] = useState(() => ({
    leave_type_id: "",
    start_date: prefillStartDate,
    end_date: prefillStartDate,
    reason: "",
    partial_day_type: "full",
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Validation
  const [leaveWarningDetails, setLeaveWarningDetails] = useState(null);
  const [chargeableBreakdown, setChargeableBreakdown] = useState(null);

  // Recall modal
  const [requestToRecall, setRequestToRecall] = useState(null);
  const [isRecalling, setIsRecalling] = useState(false);

  // History collapse
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const pendingRequests = useMemo(
    () => (requests || []).filter((r) => r.status === "pending"),
    [requests]
  );
  const historyRequests = useMemo(
    () => (requests || []).filter((r) => r.status !== "pending" && r.status !== "cancelled"),
    [requests]
  );

  const currentEmployee = userContext?.employee;
  const subjectEmployee = targetEmployee || currentEmployee;

  // Prevent strict-mode double load + hot reload repeats
  const didInitialLoadRef = useRef(false);

  const safeList = useCallback(async (resource) => {
    if (!resource) return [];
    if (typeof resource.list === "function") return resource.list();
    if (typeof resource.filter === "function") return resource.filter({});
    return [];
  }, []);

  const loadMyLeaveData = useCallback(async () => {
    const perfStart = performance.now();
    setLoadingError(null);
    setIsLoadingContext(true);

    try {
      // 1) Load viewer context (auth + tenant + employee)
      const ctx = await getCurrentUserEmployeeContextSafe();
      if (!ctx?.isAuthenticated) {
        setIsLoadingContext(false);
        return loginOrRedirect();
      }
      setUserContext(ctx);

      const tenantId = ctx?.tenantId || employeeCtx?.tenantId || null;
      if (!tenantId) {
        console.warn("[MyLeave] No tenantId yet - cannot load.");
        setLeaveBalances(null);
        setLeaveContext(null);
        setRequests([]);
        setTenantPolicies([]);
        setIsLoadingContext(false);
        return;
      }

      // 2) Determine subject employee (self or on-behalf-of)
      let employeeToUse = ctx.employee || null;

      if (targetEmployeeIdParam) {
        const emp = await api.employees.get(targetEmployeeIdParam).catch(() => null);
        if (emp) {
          const isAdminActing = ctx.isAdmin && ctx.actingMode === "admin";
          const isManager = ctx.employee?.is_manager === true;

          let canActFor = false;
          if (isAdminActing) canActFor = true;
          else if (emp.id === ctx.employee?.id) canActFor = true;
          else if (isManager) {
            if (emp.manager_id === ctx.employee.id) {
              canActFor = true;
            } else {
              const reports = await api.employees.filter({
                manager_id: ctx.employee.id,
                status: "active",
              });
              const reportIds = new Set((reports || []).map((r) => r.id));
              canActFor = reportIds.has(emp.id);
            }
          }

          if (canActFor) employeeToUse = emp;
        }
      }

      setTargetEmployee(employeeToUse);

      if (!employeeToUse) {
        setLeaveBalances(null);
        setLeaveContext(null);
        setRequests([]);
        setTenantPolicies([]);
        setIsLoadingContext(false);
        return;
      }

      // 3) Ensure leave balances exist (idempotent helper)
      await initializeLeaveBalances(api, employeeToUse.id, tenantId);

      // 4) Load balances + context + history (use ConfigProvider policies)
      const preloadedData = {
        preloadedEmployee: employeeToUse,
        preloadedLeaveTypes: leaveTypesRef.current,
        preloadedPolicies: leavePoliciesRef.current || [],
        preloadedHolidays: publicHolidaysRef.current,
      };

      const [balances, ctxLeave, history] = await Promise.all([
        getLeaveBalancesForEmployee(employeeToUse.id, undefined, preloadedData, api),
        getLeaveContextForEmployee(employeeToUse.id, leavePoliciesRef.current || [], employeeToUse),
        getLeaveHistoryForEmployee(employeeToUse.id, leaveTypesRef.current || []),
      ]);

      setLeaveBalances(balances || null);
      setLeaveContext(ctxLeave || null);
      setRequests(history || []);
      setBalanceRefreshKey((k) => k + 1);
    } catch (err) {
      const userMsg = logApiError("MyLeave", err);
      setLoadingError(userMsg);
    } finally {
      logPerf("MyLeave.loadMyLeaveData", perfStart);
      setIsLoadingContext(false);
    }
  }, [api, employeeCtx?.tenantId, safeList, targetEmployeeIdParam]);

  // ✅ Kick off load once tenantId exists (PRIMITIVES ONLY)
  useEffect(() => {
    const tenantId = employeeCtx?.tenantId;
    if (!tenantId) {
      console.log("[MyLeave] Waiting for tenantId...");
      return;
    }

    // avoid double-fire
    if (didInitialLoadRef.current && !targetEmployeeIdParam) return;
    didInitialLoadRef.current = true;

    loadMyLeaveData();
  }, [employeeCtx?.tenantId, targetEmployeeIdParam, loadMyLeaveData]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const getTypeName = (id) =>
    (leaveTypesRef.current || []).find((t) => t.id === id)?.name || "Unknown";

  const checkRecallPermission = (request) => {
    if (!userContext?.user) return false;

    const actingUser = {
      id: userContext.user.id,
      role: userContext.user.role || (userContext.isAdmin ? "admin" : "employee"),
      direct_reports: userContext.employee?.direct_reports || [],
    };

    return canUserRecallLeave(actingUser, request);
  };

  const openRecallModal = (request) => setRequestToRecall(request);

  const handleConfirmRecall = async () => {
    if (!requestToRecall || !userContext?.user || !subjectEmployee) return;
    setIsRecalling(true);

    try {
      const actingUser = {
        id: userContext.user.id,
        role: userContext.user.role || (userContext.isAdmin ? "admin" : "employee"),
        direct_reports: userContext.employee?.direct_reports || [],
      };

      const result = await recallLeave(requestToRecall.id, actingUser, {
        preloadedRequest: requestToRecall,
        preloadedEmployee: subjectEmployee,
        preloadedLeaveTypes: leaveTypesRef.current,
        preloadedPolicies: leavePoliciesRef.current,
        preloadedHolidays: publicHolidaysRef.current,
      });

      if (!result?.success) {
        toast.error(`Failed to recall leave request: ${result?.error || "Unknown error"}`);
        setRequestToRecall(null);
        return;
      }

      setRequestToRecall(null);
      toast.success("Leave request recalled successfully.");
      await loadMyLeaveData();
    } catch (err) {
      toast.error(`Failed to recall leave request: ${err?.message || "Unknown error"}`);
      setRequestToRecall(null);
    } finally {
      setIsRecalling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Chargeable days + warnings
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!formData.start_date || !formData.end_date || !subjectEmployee) {
      setChargeableBreakdown(null);
      setLeaveWarningDetails(null);
      return;
    }

    calculateChargeableLeave({
      start_date: formData.start_date,
      end_date: formData.end_date,
      employee_id: subjectEmployee.id,
      partial_day_type: formData.partial_day_type,
      employee: subjectEmployee,
      preloadedHolidays: publicHolidaysRef.current,
    }).then((breakdown) => setChargeableBreakdown(breakdown));
  }, [formData.start_date, formData.end_date, formData.partial_day_type, subjectEmployee]);

  useEffect(() => {
    if (
      !chargeableBreakdown ||
      !formData.leave_type_id ||
      !leaveContext ||
      !subjectEmployee ||
      !leaveBalances
    ) {
      setLeaveWarningDetails(null);
      return;
    }

    const chargeableDays = safeNumber(chargeableBreakdown.chargeableDays, 0);
    if (chargeableDays <= 0) {
      setLeaveWarningDetails(null);
      return;
    }

    const leaveType = (leaveTypesRef.current || []).find((t) => t.id === formData.leave_type_id);
    if (!leaveType) return setLeaveWarningDetails(null);

    const typeCode = (leaveType.code || leaveType.name || "").toLowerCase();
    let balanceKey = "annual";
    if (typeCode.includes("personal") || typeCode.includes("sick") || typeCode.includes("carer"))
      balanceKey = "personal";
    else if (typeCode.includes("long") || typeCode.includes("lsl")) balanceKey = "long_service";

    const balance = leaveBalances?.[balanceKey];
    const policy = leaveContext?.policies?.[balanceKey];
    if (!balance) return setLeaveWarningDetails(null);

    const availableHoursRaw =
      balance?.available ?? balance?.available_hours ?? balance?.availableHours ?? 0;
    const availableHours = safeNumber(availableHoursRaw, 0);

    let hoursPerDay = 7.6;
    if (Number.isFinite(policy?.standard_hours_per_day) && policy.standard_hours_per_day > 0) {
      hoursPerDay = policy.standard_hours_per_day;
    } else if (Number.isFinite(subjectEmployee?.hours_per_week) && subjectEmployee.hours_per_week > 0) {
      hoursPerDay = subjectEmployee.hours_per_week / 5;
    }

    const neededHours = safeNumber(chargeableDays * hoursPerDay, 0);
    const EPS = 0.01;
    const shouldWarn = availableHours + EPS < neededHours;

    setLeaveWarningDetails(shouldWarn ? { availableHours, neededHours } : null);
  }, [chargeableBreakdown, formData.leave_type_id, leaveContext, subjectEmployee, leaveBalances]);

  // ---------------------------------------------------------------------------
  // Submit new leave request
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!subjectEmployee || !userContext || !formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setError("Please complete all required fields");
      return;
    }

    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const result = await createLeaveRequest({
        employee: subjectEmployee,
        leaveTypeId: formData.leave_type_id,
        startDate: formData.start_date,
        endDate: formData.end_date,
        reason: formData.reason,
        partialDayType: formData.partial_day_type,
        currentUser: userContext.user,
        currentEmployee: userContext.employee,
        preferences: userContext.preferences,
        api,
        preloadedLeaveTypes: leaveTypesRef.current,
        preloadedPolicies: leavePoliciesRef.current,
        preloadedHolidays: publicHolidaysRef.current,
      });

      if (!result?.success) {
        const code = result?.error;
        if (code === "OVERLAPPING_LEAVE") {
          setError("You already have leave booked that overlaps these dates.");
        } else if (code === "PAID_LEAVE_NOT_ALLOWED_FOR_CASUAL") {
          setError("Casual employees are not eligible for paid annual/personal leave.");
        } else if (code === "PERMISSION_DENIED") {
          setError(result?.message || "Permission denied.");
        } else if (code === "HALF_DAY_MUST_BE_SINGLE_DAY") {
          setError("Half-day leave is only available for single-day requests.");
        } else {
          setError(result?.error || "Failed to submit request");
        }
        return;
      }

      setFormData({
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
        partial_day_type: "full",
      });
      setChargeableBreakdown(null);
      setShowForm(false);

      setSuccessMessage(
        result.autoApproved
          ? "Leave request created and automatically approved (no manager assigned)."
          : "Leave request submitted for manager approval."
      );

      await loadMyLeaveData();
    } catch (err) {
      setError(err?.message || "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------
  if (!employeeCtx || configLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isLoadingContext) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="p-6">
        <ErrorState title="We couldn’t load this data" message={loadingError} onRetry={loadMyLeaveData} />
      </div>
    );
  }

  if (!subjectEmployee) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My time off</h1>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800">No Employee Profile Linked</h3>
                <p className="text-yellow-700 mt-1">
                  Your user account is not linked to an employee profile. Please contact an administrator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Leave balance tile helper
  // ---------------------------------------------------------------------------
  const renderLeaveTile = (label, balanceKey) => {
    const balance = leaveBalances?.[balanceKey];
    const policy = leaveContext?.policies?.[balanceKey];

    if (!policy) {
      return (
        <Card className="shadow-sm h-full">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div>
              <h3 className="text-sm font-medium text-gray-900">{label}</h3>
              <p className="mt-6 text-sm text-gray-500 flex items-center gap-1">
                <Info className="h-4 w-4 text-gray-400" />
                No applicable policy
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const availableHoursRaw =
      balance?.available ?? balance?.available_hours ?? balance?.availableHours ?? 0;
    const availableHours = safeNumber(availableHoursRaw, 0);

    let hoursPerDay = 7.6;
    if (Number.isFinite(policy.standard_hours_per_day) && policy.standard_hours_per_day > 0) {
      hoursPerDay = policy.standard_hours_per_day;
    } else if (Number.isFinite(subjectEmployee?.hours_per_week) && subjectEmployee.hours_per_week > 0) {
      hoursPerDay = subjectEmployee.hours_per_week / 5;
    }

    const availableDays = hoursToDays(availableHours, hoursPerDay);

    return (
      <Card className="shadow-sm h-full">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div>
            <h3 className="text-sm font-medium text-gray-900">{label}</h3>
            <p className="mt-4 text-2xl font-semibold text-gray-900">{availableDays.toFixed(1)} days</p>
            <p className="text-xs text-gray-500">{availableHours.toFixed(1)} hours available</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  const hasLeaveTypes = leaveTypes && leaveTypes.length > 0;
  const hasLeavePolicies = leavePolicies && leavePolicies.length > 0;
  const isAdmin = userContext?.isAdmin && userContext?.actingMode === 'admin';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My time off</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showForm ? "Cancel" : "Request Leave"}
        </Button>
      </div>

      {/* DATA VALIDATION BANNERS */}
      {!hasLeaveTypes && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">No Leave Types Configured</h3>
                <p className="text-amber-700 text-sm mt-1">
                  This tenant has no leave types. {isAdmin ? 'Go to Admin Utilities to seed baseline data.' : 'Contact an administrator.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasLeaveTypes && !hasLeavePolicies && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">No Leave Policies Configured</h3>
                <p className="text-amber-700 text-sm mt-1">
                  Leave types exist but no policies are configured. {isAdmin ? 'Go to Admin Utilities to seed baseline data.' : 'Contact an administrator.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6">
          {successMessage}
        </div>
      )}

      {/* Recall Confirmation Modal */}
      <Dialog open={!!requestToRecall} onOpenChange={(open) => !open && setRequestToRecall(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {requestToRecall?.status === "pending" ? "Cancel leave request" : "Recall leave request"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {requestToRecall?.status === "pending" ? "cancel" : "recall"} this leave request?
              {requestToRecall?.status === "approved" && (
                <span className="block mt-2">
                  Any approved leave for these dates will be cancelled and the leave balance will be updated.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {requestToRecall && (
            <div className="py-3 px-4 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium">{getTypeName(requestToRecall.leave_type_id)}</p>
              <p className="text-gray-600">
                {requestToRecall.start_date ? format(new Date(requestToRecall.start_date), "dd MMM") : ""} –{" "}
                {requestToRecall.end_date ? format(new Date(requestToRecall.end_date), "dd MMM yyyy") : ""}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRequestToRecall(null)} disabled={isRecalling}>
              No, keep it
            </Button>
            <Button variant="destructive" onClick={handleConfirmRecall} disabled={isRecalling}>
              {isRecalling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Yes, ${requestToRecall?.status === "pending" ? "cancel" : "recall"} leave`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {leaveContext && (
        <>
          {/* Leave balances */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your leave balances</h2>
            <div key={balanceRefreshKey} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderLeaveTile("Annual Leave", "annual")}
              {renderLeaveTile("Personal/Sick Leave", "personal")}
              {renderLeaveTile("Long Service Leave", "long_service")}
            </div>

            {subjectEmployee.employment_type === "part_time" && subjectEmployee.hours_per_week && (
              <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
                <Info className="h-3 w-3" />
                {subjectEmployee.preferred_name || subjectEmployee.full_name || "This employee"} works{" "}
                {subjectEmployee.hours_per_week}h/week (~{Math.round((subjectEmployee.hours_per_week / 38) * 100)}% of
                full-time). Leave accrues pro-rata.
              </p>
            )}
          </div>

          {/* Leave request form */}
          {showForm && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-2">New Leave Request</h2>

                <div className="mb-4 text-sm text-gray-500">
                  Creating leave for{" "}
                  <span className="font-semibold">
                    {subjectEmployee?.preferred_name || subjectEmployee?.full_name}
                  </span>
                  {targetEmployeeIdParam && subjectEmployee?.id !== currentEmployee?.id && (
                    <span className="ml-2 inline-block rounded bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 align-middle">
                      on behalf of
                    </span>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                    <Select value={formData.leave_type_id} onValueChange={(v) => setFormData((p) => ({ ...p, leave_type_id: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(leaveTypesRef.current || []).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData((p) => ({ ...p, start_date: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <Input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData((p) => ({ ...p, end_date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                    <RadioGroup
                      value={formData.partial_day_type}
                      onValueChange={(v) => setFormData((p) => ({ ...p, partial_day_type: v }))}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="full" id="duration-full" />
                        <Label htmlFor="duration-full" className="cursor-pointer">
                          Full day
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="half_am" id="duration-half-am" />
                        <Label htmlFor="duration-half-am" className="cursor-pointer flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Half day (AM)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="half_pm" id="duration-half-pm" />
                        <Label htmlFor="duration-half-pm" className="cursor-pointer flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Half day (PM)
                        </Label>
                      </div>
                    </RadioGroup>

                    {(formData.partial_day_type === "half_am" || formData.partial_day_type === "half_pm") &&
                      formData.start_date &&
                      formData.end_date &&
                      formData.start_date !== formData.end_date && (
                        <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          Half-day leave is only available for single-day requests. Please choose the same start/end date.
                        </p>
                      )}
                  </div>

                  {/* Chargeable breakdown */}
                  {chargeableBreakdown && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total days in range:</span>
                        <span className="font-medium">{chargeableBreakdown.totalDays}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Weekends (excluded):</span>
                        <span className="text-gray-500">−{chargeableBreakdown.weekendCount}</span>
                      </div>
                      {chargeableBreakdown.holidayCount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Public holidays (excluded):</span>
                          <span className="text-gray-500">−{chargeableBreakdown.holidayCount}</span>
                        </div>
                      )}
                      {chargeableBreakdown.isHalfDay && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Half day:</span>
                          <span className="text-indigo-600 font-medium">
                            {chargeableBreakdown.partialDayType === "half_am" ? "Morning (AM)" : "Afternoon (PM)"}
                          </span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between">
                        <span className="font-medium">Chargeable days:</span>
                        <span className="text-lg font-bold text-indigo-600">{chargeableBreakdown.chargeableDays}</span>
                      </div>
                      {(chargeableBreakdown.holidays || []).length > 0 && (
                        <div className="text-xs text-gray-500">
                          Holidays: {(chargeableBreakdown.holidays || []).map((h) => h.name).join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Balance warning */}
                  {leaveWarningDetails && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-700 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        Insufficient leave balance. You have {formatHours(leaveWarningDetails.availableHours)} hours
                        available but need {formatHours(leaveWarningDetails.neededHours)} hours.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                    <Textarea
                      value={formData.reason}
                      onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting || !formData.leave_type_id}>
                    {isSubmitting ? "Submitting..." : "Submit Request"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <Card className="mb-6 border-indigo-100 shadow-sm">
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50/50">
                  <h2 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-indigo-500" />
                    Pending Requests
                  </h2>
                </div>

                <div className="divide-y divide-indigo-50">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="px-6 py-4 flex justify-between items-start bg-white">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {getTypeName(req.leave_type_id)}
                          {req.partial_day_type === "half_am" && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              <Clock className="h-3 w-3" /> Half day (AM)
                            </span>
                          )}
                          {req.partial_day_type === "half_pm" && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              <Clock className="h-3 w-3" /> Half day (PM)
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {req.start_date ? format(new Date(req.start_date), "dd MMM") : ""} –{" "}
                          {req.end_date ? format(new Date(req.end_date), "dd MMM yyyy") : ""} ({req.total_days}{" "}
                          {req.total_days === 0.5 ? "day" : "days"})
                        </p>
                        {req.reason && <p className="text-sm text-gray-400 mt-1">{req.reason}</p>}
                      </div>

                      <div className="flex items-center gap-3 ml-4">
                        <LeaveStatusChip status={req.status} />
                        {checkRecallPermission(req) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRecallModal(req)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leave History */}
          <Card>
            <CardContent className="p-0">
              <button
                onClick={() => setIsHistoryOpen((v) => !v)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-700">Leave History</h2>
                  <span className="text-sm text-gray-400 font-normal">({historyRequests.length})</span>
                </div>
                {isHistoryOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {isHistoryOpen && (
                <div className="border-t border-gray-100">
                  {historyRequests.length === 0 ? (
                    <p className="p-6 text-gray-500 text-center">No historical leave requests</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {historyRequests.map((req) => (
                        <div key={req.id} className="px-6 py-4 flex justify-between items-start bg-white">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {getTypeName(req.leave_type_id)}
                              {req.partial_day_type === "half_am" && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  <Clock className="h-3 w-3" /> Half day (AM)
                                </span>
                              )}
                              {req.partial_day_type === "half_pm" && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  <Clock className="h-3 w-3" /> Half day (PM)
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500">
                              {req.start_date ? format(new Date(req.start_date), "dd MMM") : ""} –{" "}
                              {req.end_date ? format(new Date(req.end_date), "dd MMM yyyy") : ""} ({req.total_days}{" "}
                              {req.total_days === 0.5 ? "day" : "days"})
                            </p>
                            {req.reason && <p className="text-sm text-gray-400 mt-1">{req.reason}</p>}
                          </div>

                          <div className="flex items-center gap-3 ml-4">
                            <LeaveStatusChip status={req.status} />
                            {checkRecallPermission(req) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openRecallModal(req)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs"
                              >
                                {req.status === "pending" ? "Cancel" : "Recall"}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}