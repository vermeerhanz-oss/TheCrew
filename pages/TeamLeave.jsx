import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '@/components/ui/Card';
import LeaveStatusChip from '@/components/leave/LeaveStatusChip';
import { format } from 'date-fns';
import { Users, Loader2, AlertCircle, Plus, Clock, ShieldAlert, X, History } from 'lucide-react';
import { toast } from "sonner";
import { getDisplayName } from '@/components/utils/displayName';
import { calculateChargeableLeave } from '@/components/utils/LeaveEngine';
import { createLeaveRequest } from '@/components/utils/leaveHelpers';
import { canCancelLeaveRequest, canRecallLeaveRequest } from '@/components/utils/permissions';
import { cancelLeaveRequest } from '@/components/utils/leaveHelpers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppConfig } from '@/components/providers/ConfigProvider';
import { deduplicateLeaveTypes } from '@/components/utils/leaveTypeDropdownDedupe';

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function TeamLeave() {
  const employeeCtx = useEmployeeContext();
  const api = useTenantApi();
  const { leaveTypes: rawLeaveTypes, leavePolicies, publicHolidays, isLoading: configLoading } = useAppConfig();
  
  // Deduplicate leave types for dropdown display
  const leaveTypes = React.useMemo(() => {
    return deduplicateLeaveTypes(rawLeaveTypes);
  }, [rawLeaveTypes]);

  console.log('[TeamLeave] Config:', {
    tenantId: employeeCtx?.tenantId,
    leaveTypes: leaveTypes?.length ?? 0,
    leavePolicies: leavePolicies?.length ?? 0,
  });

  const tenantId = employeeCtx?.tenantId || null;

  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeLeaveHistory, setEmployeeLeaveHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [chargeableBreakdown, setChargeableBreakdown] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [requestToRecall, setRequestToRecall] = useState(null);
  const [isRecalling, setIsRecalling] = useState(false);

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const isAdmin = employeeCtx?.isAdmin && employeeCtx?.actingMode === 'admin';
  const isManager = employeeCtx?.employee?.is_manager === true;
  const hasAccess = isAdmin || isManager;

  useEffect(() => {
    if (!tenantId || !employeeCtx) {
      console.log('[TeamLeave] Waiting for context...');
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      // DEBUG_REMOVE: Diagnostic logging
      console.log('[TeamLeave] tenantId:', tenantId);
      
      try {
        let members = [];
        
        if (isAdmin) {
          const allEmps = await api.employees.filter({ status: 'active' });
          members = allEmps;
        } else if (isManager && employeeCtx.employee?.id) {
          const reports = await api.employees.filter({
            manager_id: employeeCtx.employee.id,
            status: 'active'
          });
          members = reports;
        }

        setTeamMembers(members);
      } catch (err) {
        console.error('[TeamLeave] Load error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [tenantId, employeeCtx?.employee?.id, isAdmin, isManager]);

  useEffect(() => {
    if (!selectedEmployeeId || !tenantId) {
      setEmployeeLeaveHistory([]);
      return;
    }
    
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const canView = teamMembers.some(e => e.id === selectedEmployeeId);
        if (!canView) {
          setEmployeeLeaveHistory([]);
          return;
        }
        
        // CRITICAL FIX: Initialize leave balances when employee selected
        const { initializeLeaveBalances } = await import('@/components/utils/leaveBalanceInit');
        await initializeLeaveBalances(selectedEmployeeId, tenantId);
        
        let requests = await api.leaveRequests.filter({ employee_id: selectedEmployeeId });
        requests = requests.filter(r => r.status !== 'cancelled');
        requests.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
        setEmployeeLeaveHistory(requests);
      } catch (err) {
        console.error('[TeamLeave] History error:', err);
        setEmployeeLeaveHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [selectedEmployeeId, tenantId, teamMembers.length]);

  useEffect(() => {
    if (!formData.start_date || !formData.end_date || !selectedEmployeeId) {
      setChargeableBreakdown(null);
      return;
    }

    const emp = teamMembers.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    calculateChargeableLeave({
      start_date: formData.start_date,
      end_date: formData.end_date,
      employee_id: selectedEmployeeId,
      employee: emp,
      preloadedHolidays: publicHolidays,
    })
      .then(breakdown => setChargeableBreakdown(breakdown))
      .catch(() => setChargeableBreakdown(null));
  }, [formData.start_date, formData.end_date, selectedEmployeeId, teamMembers, publicHolidays]);

  const getTypeName = (id) => (leaveTypes || []).find(t => t.id === id)?.name || 'Unknown';
  const getSelectedEmployee = () => teamMembers.find(e => e.id === selectedEmployeeId);

  const checkRecallPermission = (request) => {
    if (!employeeCtx) return false;
    if (request.status === 'approved') {
      return canRecallLeaveRequest(employeeCtx.user, request, employeeCtx.employee, employeeCtx.preferences);
    }
    return canCancelLeaveRequest(employeeCtx.user, request, employeeCtx.employee, employeeCtx.preferences);
  };

  const handleConfirmRecall = async () => {
    if (!requestToRecall || !selectedEmployeeId || !employeeCtx) return;
    
    setIsRecalling(true);
    const employee = getSelectedEmployee();
    
    try {
      const result = await cancelLeaveRequest(
        requestToRecall,
        employee,
        employeeCtx.user,
        employeeCtx.employee,
        employeeCtx.preferences
      );
      
      if (!result.success) {
        toast.error(`Failed to recall: ${result.error || 'Unknown error'}`);
        return;
      }
      
      toast.success('Leave request recalled.');
      setRequestToRecall(null);
      
      const requests = await api.leaveRequests.filter({ employee_id: selectedEmployeeId });
      const filtered = requests.filter(r => r.status !== 'cancelled');
      filtered.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
      setEmployeeLeaveHistory(filtered);
    } catch (err) {
      toast.error(`Failed to recall: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRecalling(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedEmployeeId || !formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setFormError('Please complete all required fields.');
      return;
    }

    const employee = getSelectedEmployee();
    if (!employee) {
      setFormError('Employee not found.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createLeaveRequest({
        employee,
        leaveTypeId: formData.leave_type_id,
        startDate: formData.start_date,
        endDate: formData.end_date,
        reason: formData.reason,
        partialDayType: 'full',
        currentUser: employeeCtx.user,
        currentEmployee: employeeCtx.employee,
        preferences: employeeCtx.preferences,
        api,
        preloadedLeaveTypes: leaveTypes,
        preloadedPolicies: leavePolicies,
        preloadedHolidays: publicHolidays,
      });

      if (!result.success) {
        const errorMessages = {
          INSUFFICIENT_BALANCE: 'This employee does not have enough leave balance.',
          OVERLAPPING_LEAVE: 'This employee already has leave booked in this period.',
          CASUAL_CANNOT_TAKE_PAID_LEAVE: 'Casual employees cannot take paid annual/personal leave.',
          NOT_AUTHORIZED: result.message || 'You are not authorized to create leave for this employee.',
          EMPLOYEE_NOT_FOUND: 'Employee not found.',
        };
        setFormError(errorMessages[result.error] || result.message || 'Failed to create leave.');
        return;
      }

      toast.success(`Leave created for ${getDisplayName(employee)}.`);
      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      setChargeableBreakdown(null);

      const requests = await api.leaveRequests.filter({ employee_id: selectedEmployeeId });
      const filtered = requests.filter(r => r.status !== 'cancelled');
      filtered.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
      setEmployeeLeaveHistory(filtered);
    } catch (err) {
      console.error('[TeamLeave] Create error:', err);
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!employeeCtx || configLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <ShieldAlert className="h-6 w-6 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800">Access Denied</h3>
                <p className="text-red-700 mt-1">
                  You need to be a manager or admin to access this page.
                </p>
                <Link to={createPageUrl('Home')}>
                  <Button variant="outline" className="mt-4">
                    Return to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // DATA VALIDATION: Show banners if leave data missing
  const hasLeaveTypes = leaveTypes && leaveTypes.length > 0;
  const hasLeavePolicies = leavePolicies && leavePolicies.length > 0;

  if (!isAdmin && teamMembers.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Team Leave</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-700">No Direct Reports</h3>
            <p className="text-gray-500 mt-2">
              You don't have any direct reports assigned yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Leave</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage leave for your team members</p>
        </div>
        {selectedEmployeeId && (
          <Button variant="outline" onClick={() => setIsHistoryOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            View Leave History
          </Button>
        )}
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

      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Employee
            </label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an employee..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {getDisplayName(emp)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-500" />
              Create Leave
            </h2>

            {!selectedEmployeeId ? (
              <div className="text-center py-6 text-gray-500">
                <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm">Select an employee to create leave on their behalf.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                  <Select
                    value={formData.leave_type_id}
                    onValueChange={(v) => setFormData({ ...formData, leave_type_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(leaveTypes || []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {chargeableBreakdown && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Chargeable days:</span>
                      <span className="font-semibold text-indigo-600">{chargeableBreakdown.chargeableDays}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={2}
                    placeholder="Add a reason..."
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.leave_type_id}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Leave Request'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!requestToRecall} onOpenChange={(open) => !open && setRequestToRecall(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {requestToRecall?.status === 'pending' ? 'Cancel leave request' : 'Recall leave request'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {requestToRecall?.status === 'pending' ? 'cancel' : 'recall'} this leave request for {getDisplayName(getSelectedEmployee())}?
              {requestToRecall?.status === 'approved' && (
                <span className="block mt-2">
                  Any approved leave for these dates will be cancelled and the leave balance will be updated.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {requestToRecall && (() => {
            const sd = safeDate(requestToRecall.start_date);
            const ed = safeDate(requestToRecall.end_date);
            return (
              <div className="py-3 px-4 bg-gray-50 rounded-lg text-sm">
                <p className="font-medium">{getTypeName(requestToRecall.leave_type_id)}</p>
                <p className="text-gray-600">
                  {sd ? format(sd, 'dd MMM') : '—'} – {ed ? format(ed, 'dd MMM yyyy') : '—'}
                </p>
              </div>
            );
          })()}
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
                `Yes, ${requestToRecall?.status === 'pending' ? 'cancel' : 'recall'} leave`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isHistoryOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-40 transition-opacity" 
            onClick={() => setIsHistoryOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Leave History</h2>
                {selectedEmployeeId && (
                  <p className="text-sm text-gray-500">
                    {getDisplayName(getSelectedEmployee())}
                  </p>
                )}
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-0">
              {historyLoading ? (
                <div className="p-10 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : employeeLeaveHistory.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No leave recorded yet for this employee.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {employeeLeaveHistory.map((req) => {
                    const sd = safeDate(req.start_date);
                    const ed = safeDate(req.end_date);
                    return (
                      <div key={req.id} className="p-5 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-gray-900">{getTypeName(req.leave_type_id)}</p>
                          <LeaveStatusChip status={req.status} size="sm" />
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          {sd ? format(sd, 'EEE, dd MMM') : '—'} – {ed ? format(ed, 'EEE, dd MMM yyyy') : '—'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {req.total_days} days
                        </p>
                        {req.reason && (
                          <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100">
                            {req.reason}
                          </div>
                        )}
                        
                        {checkRecallPermission(req) && (
                          <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRequestToRecall(req)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs"
                            >
                              {req.status === 'pending' ? 'Cancel Request' : 'Recall Leave'}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}