import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { markSetupComplete } from '@/components/utils/setupService';
import ErrorState from '@/components/common/ErrorState';

// Sensible default departments for small founders / startups
const DEFAULT_DEPARTMENTS = [
  'Executive / Founders',
  'Engineering',
  'Product',
  'Design',
  'Sales',
  'Marketing',
  'Customer Success',
  'Operations',
  'People & HR',
  'Finance & Accounting',
];

export default function SetupDepartments() {
  const navigate = useNavigate();
  const ctx = useEmployeeContext();
  const api = useTenantApi();

  const tenantId = ctx?.tenantId || ctx?.employee?.entity_id || null;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [existingDepartments, setExistingDepartments] = useState([]);
  const [selectedNames, setSelectedNames] = useState(new Set());
  const [customName, setCustomName] = useState('');

  // ────────────────────────────────────────────────────────────────
  // Load existing departments for this tenant
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const depts = await api.departments.filter({ entity_id: tenantId });
        if (cancelled) return;

        setExistingDepartments(depts || []);

        // If there are already departments, pre-select them
        if (depts && depts.length > 0) {
          const names = new Set(depts.map(d => d.name).filter(Boolean));
          setSelectedNames(names);
        } else {
          // No departments yet → pre-select a safe starter set
          const starter = new Set(DEFAULT_DEPARTMENTS.slice(0, 4));
          setSelectedNames(starter);
        }
      } catch (err) {
        console.error('[SetupDepartments] Failed to load departments', err);
        if (!cancelled) {
          setError('We could not load your departments. Please try again.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tenantId, api]);

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────
  const toggleDepartment = (name) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAddCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    setSelectedNames(prev => new Set(prev).add(trimmed));
    setCustomName('');
  };

  const handleBack = () => {
    // Go back to previous step in Setup flow – adjust if your route differs
    navigate(createPageUrl('SetupLocations'));
  };

  const handleSkip = () => {
    // Allow founders to skip and finish later
    navigate(createPageUrl('Home'));
  };

  const handleSaveAndContinue = async () => {
    if (!tenantId) {
      setError('Missing tenant. Please refresh and try again.');
      return;
    }

    if (selectedNames.size === 0) {
      setError('Please select at least one department or choose Skip for now.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const existingByName = new Map(
        existingDepartments
          .filter(d => !!d.name)
          .map(d => [d.name.toLowerCase(), d])
      );

      // Create any new departments that don't already exist
      for (const name of selectedNames) {
        const key = name.toLowerCase();
        if (existingByName.has(key)) continue;

        await api.departments.create({
          entity_id: tenantId,
          name,
          status: 'active',
        });
      }

      // Mark bootstrap complete so AppShell stops redirecting to Setup
      await markSetupComplete(tenantId);

      // Go to dashboard / Home – intro tutorial overlay will pick up from there
      navigate(createPageUrl('Home'));
    } catch (err) {
      console.error('[SetupDepartments] Failed to save departments', err);
      setError('We couldn’t save your departments. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="p-6">
        <ErrorState
          title="We couldn’t find your company"
          message="There was an issue resolving your workspace. Please refresh the page or sign in again."
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-0">
      {/* Step header / breadcrumb */}
      <div className="mb-6">
        <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-2">
          Step 4 of 4
        </p>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          Departments
          <Sparkles className="h-5 w-5 text-indigo-500" />
        </h1>
        <p className="text-slate-500 mt-1">
          Choose the teams and organisational units in your company. 
          You can always edit these later from Company Settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Common departments</CardTitle>
          <CardDescription>
            We’ve suggested some typical teams for small, growing companies.
            Turn on the ones that make sense for you.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Suggested departments as toggle chips */}
          <div className="flex flex-wrap gap-2">
            {DEFAULT_DEPARTMENTS.map(name => {
              const selected = selectedNames.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleDepartment(name)}
                  className={
                    'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition ' +
                    (selected
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')
                  }
                >
                  {name}
                  {selected && (
                    <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom department entry */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-sm font-medium text-slate-900">
              Add your own department
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="e.g. Research, Studio, Clinics, Warehousing"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
              />
              <Button
                variant="outline"
                type="button"
                onClick={handleAddCustom}
              >
                Add
              </Button>
            </div>

            {selectedNames.size > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {[...selectedNames].map(name => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 mt-2">
              {error}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>You can change all of this later in Settings → Company → Departments.</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={isSaving}
            >
              Skip for now
            </Button>

            <Button
              type="button"
              onClick={handleSaveAndContinue}
              disabled={isSaving}
            >
              {isSaving && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save & Go to Dashboard
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
