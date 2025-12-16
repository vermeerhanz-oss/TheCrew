import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { resetTenantBaseline } from '@/components/utils/tenantReset';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function TenantResetDialog({ open, onOpenChange, context }) {
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [options, setOptions] = useState({
    resetDepartments: true,
    resetLocations: true,
    resetLeavePolicies: true,
    resetLeaveTypes: true,
    resetOnboardingTemplates: true,
    resetOffboardingTemplates: true,
    resetEmployees: false,
    resetLeaveBalances: false,
  });

  const tenantId = context?.tenantId;
  const userEmail = context?.user?.email;

  const isConfirmed = confirmText === 'DELETE';
  const canReset = isConfirmed && !isResetting;

  const handleReset = async () => {
    if (!canReset) return;
    if (!tenantId || !userEmail) {
      toast.error('Missing tenant or user information');
      return;
    }

    setIsResetting(true);

    try {
      console.log('[TenantResetDialog] Starting tenant reset...');
      
      const result = await resetTenantBaseline(tenantId, userEmail, {
        ...options,
        dryRun: false,
      });

      console.log('[TenantResetDialog] Reset complete:', result);

      // Calculate total items deleted
      const totalDeleted = Object.values(result.deleted).reduce((sum, count) => sum + count, 0);

      toast.success(`Tenant reset complete! Deleted ${totalDeleted} items.`);
      
      // Close dialog
      onOpenChange(false);

      // Wait a moment, then redirect to setup
      setTimeout(() => {
        window.location.href = createPageUrl('Setup');
      }, 1000);

    } catch (error) {
      console.error('[TenantResetDialog] Reset failed:', error);
      toast.error('Reset failed: ' + error.message);
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Reset Tenant Setup</DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Tenant ID: {tenantId?.substring(0, 8)}...
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning Message */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-900">
                  This will delete baseline setup data for this tenant and allow a fresh setup.
                </p>
                <p className="text-sm text-red-800">
                  This action cannot be undone. All selected data will be permanently deleted.
                </p>
              </div>
            </div>
          </div>

          {/* What Will Be Deleted */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Default Actions (Recommended)</h4>
            <div className="space-y-2 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="departments"
                  checked={options.resetDepartments}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, resetDepartments: checked })
                  }
                />
                <Label htmlFor="departments" className="text-sm cursor-pointer">
                  All departments ({context?.departments?.length || 0})
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="locations"
                  checked={options.resetLocations}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, resetLocations: checked })
                  }
                />
                <Label htmlFor="locations" className="text-sm cursor-pointer">
                  All locations ({context?.locations?.length || 0})
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="leavePolicies"
                  checked={options.resetLeavePolicies}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, resetLeavePolicies: checked })
                  }
                />
                <Label htmlFor="leavePolicies" className="text-sm cursor-pointer">
                  All leave policies
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="leaveTypes"
                  checked={options.resetLeaveTypes}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, resetLeaveTypes: checked })
                  }
                />
                <Label htmlFor="leaveTypes" className="text-sm cursor-pointer">
                  All leave types
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="onboardingTemplates"
                  checked={options.resetOnboardingTemplates}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, resetOnboardingTemplates: checked })
                  }
                />
                <Label htmlFor="onboardingTemplates" className="text-sm cursor-pointer">
                  All onboarding templates
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="offboardingTemplates"
                  checked={options.resetOffboardingTemplates}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, resetOffboardingTemplates: checked })
                  }
                />
                <Label htmlFor="offboardingTemplates" className="text-sm cursor-pointer">
                  All offboarding templates
                </Label>
              </div>
            </div>
          </div>

          {/* Dangerous Options */}
          <div className="space-y-3">
            <h4 className="font-semibold text-red-900">⚠️ Dangerous Options (Use with Caution)</h4>
            <div className="space-y-2 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="employees"
                  checked={options.resetEmployees}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, resetEmployees: checked })
                  }
                />
                <Label htmlFor="employees" className="text-sm cursor-pointer text-red-900">
                  Delete all employees ({context?.employees?.length || 0}) ⚠️
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="leaveBalances"
                  checked={options.resetLeaveBalances}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, resetLeaveBalances: checked })
                  }
                />
                <Label htmlFor="leaveBalances" className="text-sm cursor-pointer text-red-900">
                  Delete all leave balances ⚠️
                </Label>
              </div>
            </div>
          </div>

          {/* What Will NOT Be Deleted */}
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">What Will NOT Be Deleted</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside bg-green-50 rounded-lg p-4">
              <li>Tenant record (CompanyEntity)</li>
              <li>User accounts / authentication</li>
              {!options.resetEmployees && <li>Employee records</li>}
              <li>Leave requests</li>
              {!options.resetLeaveBalances && <li>Leave balances</li>}
              <li>Uploaded documents</li>
              <li>Audit logs</li>
            </ul>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm font-semibold">
                Type <span className="font-mono text-red-600 bg-red-50 px-2 py-1 rounded">DELETE</span> to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
                disabled={isResetting}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isResetting}
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={!canReset}
            className="gap-2"
          >
            {isResetting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Reset Tenant Setup
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}