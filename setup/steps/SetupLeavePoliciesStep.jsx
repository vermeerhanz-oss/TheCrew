import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

/**
 * SetupLeavePoliciesStep
 *
 * Used by Setup.jsx like:
 *   <SetupLeavePoliciesStep data={wizardData} setData={setWizardData} />
 *
 * It MUST:
 *   - Read from props.data (NOT wizardData directly)
 *   - Safely default when data or data.policies is undefined
 *   - Write back via setData(prev => ({ ...prev, policies: { ...prev.policies, ... } }))
 */
export default function SetupLeavePoliciesStep({ data, setData }) {
  // ✅ Safely normalise incoming state
  const policies = (data && data.policies) || {};

  const nesAnnualEnabled =
    policies.nesAnnualEnabled !== undefined ? policies.nesAnnualEnabled : true;

  const nesPersonalEnabled =
    policies.nesPersonalEnabled !== undefined ? policies.nesPersonalEnabled : true;

  const handleToggleAnnual = (value) => {
    setData((prev) => ({
      ...prev,
      policies: {
        ...(prev.policies || {}),
        nesAnnualEnabled: value,
      },
    }));
  };

  const handleTogglePersonal = (value) => {
    setData((prev) => ({
      ...prev,
      policies: {
        ...(prev.policies || {}),
        nesPersonalEnabled: value,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>NES Leave Policies</CardTitle>
          <CardDescription>
            Choose which National Employment Standards (NES) leave types you want to enable
            by default for this workspace. You can refine or add award/enterprise-level
            policies later from the Leave Policies admin page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Annual Leave toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="font-medium">Annual Leave (NES)</Label>
              <p className="text-sm text-slate-500 mt-1">
                4 weeks annual leave per year for full-time employees, pro-rated for part-time.
              </p>
            </div>
            <Switch
              checked={nesAnnualEnabled}
              onCheckedChange={handleToggleAnnual}
              aria-label="Enable NES Annual Leave"
            />
          </div>

          {/* Personal / Carer&apos;s Leave toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="font-medium">Personal / Carer&apos;s Leave (NES)</Label>
              <p className="text-sm text-slate-500 mt-1">
                10 days personal/carer&apos;s leave per year for full-time employees,
                pro-rated for part-time.
              </p>
            </div>
            <Switch
              checked={nesPersonalEnabled}
              onCheckedChange={handleTogglePersonal}
              aria-label="Enable NES Personal / Carer&apos;s Leave"
            />
          </div>

          {/* Disclaimer */}
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-xs text-amber-800">
              These presets are based on minimum National Employment Standards only and do
              not constitute legal or award interpretation. You remain responsible for
              configuring policies that comply with applicable legislation, awards, EBAs,
              and enterprise agreements.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500">
        You can always edit or add additional leave policies later under{' '}
        <strong>Company &gt; Leave Policies</strong>.
      </p>
    </div>
  );
}
