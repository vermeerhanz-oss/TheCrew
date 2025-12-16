import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { getSetupStatus } from '@/components/utils/setupService';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';

export default function SetupStatusCard() {
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId || null;
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, [tenantId]);

  async function loadStatus() {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      const setupStatus = await getSetupStatus(tenantId);
      setStatus(setupStatus);
    } catch (err) {
      console.error('Failed to load setup status:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const items = [
    { label: 'Company settings', done: status.hasCompanySettings, required: true },
    { label: 'At least one entity', done: status.hasAtLeastOneEntity, required: true },
    { label: 'At least one office location', done: status.hasAtLeastOneLocation, required: true },
    { label: 'Annual & personal leave', done: status.hasCoreLeavePolicies, required: true },
    { label: 'Departments', done: status.hasAtLeastOneDepartment, required: false },
    { label: 'Branding', done: status.hasBrandingConfigured, required: false },
  ];

  const allRequiredDone = items.filter(i => i.required).every(i => i.done);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Setup Status</CardTitle>
          {status.setupCompletedFlag ? (
            <Badge className="bg-green-100 text-green-700">Setup Complete</Badge>
          ) : allRequiredDone ? (
            <Badge className="bg-blue-100 text-blue-700">Ready to Complete</Badge>
          ) : (
            <Badge variant="secondary">In Progress</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-gray-300 flex-shrink-0" />
              )}
              <span className={`text-sm ${item.done ? 'text-gray-900' : 'text-gray-500'}`}>
                {item.label}
                {!item.required && <span className="text-xs text-gray-400 ml-1">(optional)</span>}
              </span>
            </div>
          ))}
        </div>

        {!status.setupCompletedFlag && allRequiredDone && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
              ✨ All required setup items complete! Your workspace is ready to use.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}