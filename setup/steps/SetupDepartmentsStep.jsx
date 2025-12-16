import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, Check, ArrowLeft } from 'lucide-react';
import {
  getNESAnnualLeaveDefaults,
  getNESPersonalLeaveDefaults,
} from '@/components/utils/leavePolicyDefaults';
import { CURRENT_BOOTSTRAP_VERSION, BASELINE_METADATA, getDepartmentBaselineKey } from '@/components/utils/bootstrapConstants';
import { seedLeaveTypesAndPolicies } from '@/components/utils/seedLeaveData';

const { Department, Employee, CompanySettings, LeavePolicy } = base44.entities;

const DEFAULT_DEPARTMENTS = [
  'Executive / Founders',
  'Engineering',
  'Product',
  'Sales',
  'Marketing',
  'People & HR',
  'Finance',
  'Operations',
];

export default function SetupDepartmentsStep({ user, wizardData, onBack, onComplete }) {
  const [selectedNames, setSelectedNames] = useState(
    new Set(DEFAULT_DEPARTMENTS.slice(0, 3))
  );
  const [customName, setCustomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const toggleDepartment = (name) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAddCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    
    console.log('[FoundersCreW][SetupDepartmentsStep] Adding custom department:', trimmed);
    
    setSelectedNames((prev) => {
      const next = new Set(prev);
      next.add(trimmed);
      return next;
    });
    setCustomName('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const entityId = wizardData.entityId;
    if (!entityId) {
      setError('Missing entity. Please go back and complete previous steps.');
      return;
    }

    if (selectedNames.size === 0) {
      setError('Please select at least one department.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1) Departments - IDEMPOTENT CREATION
      const existingDepts = await Department.filter({ entity_id: entityId });
      console.log('[SetupDepartmentsStep] Existing departments for entity:', existingDepts.length);
      
      const existingByName = new Map(
        existingDepts
          .filter((d) => !!d.name)
          .map((d) => [d.name.toLowerCase(), d])
      );

      const createdDepts = [];
      
      // Only create departments if none exist yet
      if (existingDepts.length === 0) {
        console.log('[SetupDepartmentsStep] No existing departments - creating new ones');
        for (const name of selectedNames) {
          const dept = await Department.create({
            entity_id: entityId,
            name,
            // Baseline metadata
            ...BASELINE_METADATA,
            bootstrapVersion: CURRENT_BOOTSTRAP_VERSION,
            baselineKey: getDepartmentBaselineKey(name) || `dept:${name.toLowerCase().replace(/\s+/g, '_')}`,
          });
          createdDepts.push(dept);
          console.log('[SetupDepartmentsStep] Created department:', name);
        }
      } else {
        console.log('[SetupDepartmentsStep] Departments already exist - reusing existing ones');
        // Reuse existing departments instead of creating duplicates
        for (const name of selectedNames) {
          const key = name.toLowerCase();
          if (existingByName.has(key)) {
            createdDepts.push(existingByName.get(key));
          } else {
            // Only create if this specific name doesn't exist
            const dept = await Department.create({
              entity_id: entityId,
              name,
              // Baseline metadata
              ...BASELINE_METADATA,
              bootstrapVersion: CURRENT_BOOTSTRAP_VERSION,
              baselineKey: getDepartmentBaselineKey(name) || `dept:${name.toLowerCase().replace(/\s+/g, '_')}`,
            });
            createdDepts.push(dept);
            console.log('[SetupDepartmentsStep] Created missing department:', name);
          }
        }
      }

      const defaultDept = createdDepts[0];
      const locationId = wizardData.locationId;

      // 2) Founder employee (this is the piece that links to policies)
      const empsByUserId = await Employee.filter({ user_id: user.id });
      let employee = empsByUserId[0];

      if (!employee) {
        const empsByEmail = await Employee.filter({
          email: wizardData.email || user.email,
        });
        employee = empsByEmail[0];
      }

      const baseEmployeePayload = {
        entity_id: entityId,
        location_id: locationId,
        department_id: defaultDept?.id || null,
        status: 'active',
        first_name: wizardData.firstName || employee?.first_name || user.full_name?.split(' ')[0] || 'Founder',
        last_name:
          wizardData.lastName ||
          employee?.last_name ||
          user.full_name?.split(' ').slice(1).join(' ') ||
          '',
        email: wizardData.email || employee?.email || user.email,
        job_title: wizardData.jobTitle || employee?.job_title || 'Founder',

        // 🔴 KEY: ensure employment_type matches NES policy scope
        employment_type: wizardData.employmentType || employee?.employment_type || 'full_time',
        hours_per_week: wizardData.hoursPerWeek || employee?.hours_per_week || 38,
        service_start_date: new Date().toISOString().split('T')[0],
      };
      
      console.log('[FoundersCreW][SetupDepartmentsStep] Founder employee payload:', baseEmployeePayload);

      if (employee) {
        await Employee.update(employee.id, baseEmployeePayload);
      } else {
        await Employee.create({
          user_id: user.id,
          start_date: new Date().toISOString().split('T')[0],
          ...baseEmployeePayload,
        });
      }

      // 3) Seed baseline LeaveTypes and LeavePolicies (idempotent)
      console.log('[SetupDepartmentsStep] Seeding baseline leave data...');
      
      const leaveDataResult = await seedLeaveTypesAndPolicies(entityId);
      console.log('[SetupDepartmentsStep] Leave data seeding result:', {
        typesCreated: leaveDataResult.leaveTypes.created,
        typesTotal: leaveDataResult.leaveTypes.leaveTypes.length,
        policiesCreated: leaveDataResult.leavePolicies.created,
        policiesTotal: leaveDataResult.leavePolicies.policies.length,
      });

      // 4) Legacy NES policies (for backwards compatibility with wizard options)
      console.log('[FoundersCreW][SetupDepartmentsStep] Checking wizard-configured NES policies…');

      const nesAnnualEnabled = wizardData.policies?.nesAnnualEnabled !== false;
      const nesPersonalEnabled = wizardData.policies?.nesPersonalEnabled !== false;

      const existingPolicies = await LeavePolicy.filter({ entity_id: entityId });
      const existingByCode = new Map(
        existingPolicies
          .filter((p) => !!p.code)
          .map((p) => [p.code, p])
      );

      const nesAnnualDefs = getNESAnnualLeaveDefaults();
      const nesPersonalDefs = getNESPersonalLeaveDefaults();

      const createIfMissing = async (def) => {
        if (existingByCode.has(def.code)) {
          console.log('[FoundersCreW][SetupDepartmentsStep] Policy already exists:', def.code);
          return existingByCode.get(def.code);
        }
        const payload = { entity_id: entityId, ...def };
        console.log('[FoundersCreW][SetupDepartmentsStep] Creating NES policy:', def.code);
        const created = await LeavePolicy.create(payload);
        console.log('[FoundersCreW][SetupDepartmentsStep] Created policy:', created);
        return created;
      };

      if (nesAnnualEnabled) {
        for (const def of nesAnnualDefs.list) {
          await createIfMissing(def);
        }
      }

      if (nesPersonalEnabled) {
        for (const def of nesPersonalDefs.list) {
          await createIfMissing(def);
        }
      }
      
      console.log('[FoundersCreW][SetupDepartmentsStep] NES policies setup complete');

      // 5) Set user to admin mode and grant admin role
      console.log('[SetupDepartmentsStep] Granting admin role to setup user:', user.id);
      
      const UserPreferences = base44.entities.UserPreferences;
      const existingPrefs = await UserPreferences.filter({ user_id: user.id });
      
      if (existingPrefs.length > 0) {
        await UserPreferences.update(existingPrefs[0].id, { 
          acting_mode: 'admin',
          has_seen_intro_tour: false 
        });
      } else {
        await UserPreferences.create({ 
          user_id: user.id, 
          acting_mode: 'admin',
          has_seen_intro_tour: false
        });
      }

      // Set user role to admin if not already
      if (user.role !== 'admin' && user.role !== 'owner') {
        console.log('[SetupDepartmentsStep] Setting user role to admin');
        await base44.auth.updateMe({ role: 'admin' });
      }

      // 6) Mark bootstrap complete for this entity
      console.log('[SetupDepartmentsStep] Marking bootstrap complete for entityId:', entityId);
      const existingSettings = await CompanySettings.filter({ entity_id: entityId });

      const settingsPayload = {
        has_completed_bootstrap: true,
        bootstrapVersion: CURRENT_BOOTSTRAP_VERSION,
        entity_id: entityId,
        primary_color: '#F9FAFB',
        secondary_color: '#020617',
        use_branding: false,
      };

      if (existingSettings.length > 0) {
        await CompanySettings.update(existingSettings[0].id, settingsPayload);
      } else {
        await CompanySettings.create(settingsPayload);
      }

      // 7) Set tenant-scoped localStorage flag
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(`fcw_setup_completed:${entityId}`, 'true');
          localStorage.removeItem('fcw_setup_skipped');
          console.log('[SetupDepartmentsStep] Set tenant-scoped setup completion flag');
        } catch (e) {
          console.warn('[SetupDepartmentsStep] Failed to set localStorage flag', e);
        }
      }

      console.log('[SetupDepartmentsStep] Bootstrap marked complete, calling onComplete');

      if (onComplete) {
        onComplete({ success: true });
      }
    } catch (err) {
      console.error('[SetupDepartmentsStep] Error:', err);
      setError('Could not complete setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-slate-900">Departments</h2>
        </div>
        <p className="text-slate-500 text-sm">
          Choose the teams in your company. You can always edit these later.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {/* Suggested Departments */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-3">Common departments</h3>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_DEPARTMENTS.map((name) => {
            const selected = selectedNames.has(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleDepartment(name)}
                className={`
                  inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition
                  ${
                    selected
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }
                `}
              >
                {name}
                {selected && <Check className="ml-2 h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Department */}
      <div className="pt-2 border-t">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Add your own</h3>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Research, Studio, Warehousing"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              }
            }}
            className="bg-white"
          />
          <Button type="button" variant="outline" onClick={handleAddCustom}>
            Add
          </Button>
        </div>

        {selectedNames.size > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {[...selectedNames].map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || selectedNames.size === 0}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Check className="h-4 w-4 mr-2" />
          Finish Setup
        </Button>
      </div>
    </form>
  );
}