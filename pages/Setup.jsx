import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Check } from 'lucide-react';
import Logo from '@/components/brand/Logo';
import { clearEmployeeContextCache } from '@/components/utils/EmployeeContext';

import SetupCompanyStep from '@/components/setup/steps/SetupCompanyStep';
import SetupEntityStep from '@/components/setup/steps/SetupEntityStep';
import SetupLocationStep from '@/components/setup/steps/SetupLocationStep';
import SetupLeavePoliciesStep from '@/components/setup/steps/SetupLeavePoliciesStep';
import SetupProfileStep from '@/components/setup/steps/SetupProfileStep';
import SetupDepartmentsStep from '@/components/setup/steps/SetupDepartmentsStep';

import { ensureDefaultAustralianLeavePolicies } from '@/components/utils/leavePolicyDefaults';

const { CompanySettings, Employee } = base44.entities;

const STEPS = [
  { id: 1, label: 'Company', component: SetupCompanyStep },
  { id: 2, label: 'Entity', component: SetupEntityStep },
  { id: 3, label: 'Location', component: SetupLocationStep },
  { id: 4, label: 'Leave', component: SetupLeavePoliciesStep },
  { id: 5, label: 'Profile', component: SetupProfileStep },
  { id: 6, label: 'Departments', component: SetupDepartmentsStep },
];

export default function Setup() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Seed wizardData with a policies object so the Leave step never hits undefined
  const [wizardData, setWizardData] = useState({
    policies: {
      nesAnnualEnabled: true,
      nesPersonalEnabled: true,
    },
  });

  useEffect(() => {
    checkSetupStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSetupStatus = async () => {
    setIsLoading(true);

    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Check for existing employee
      let emp = null;
      const empsByUserId = await Employee.filter({ user_id: currentUser.id });
      if (empsByUserId.length > 0) {
        emp = empsByUserId[0];
      } else {
        const empsByEmail = await Employee.filter({ email: currentUser.email });
        if (empsByEmail.length > 0) {
          emp = empsByEmail[0];
        }
      }

      setEmployee(emp);

      // If employee exists and has entity_id, check bootstrap
      if (emp?.entity_id) {
        const settingsArr = await CompanySettings.filter({ entity_id: emp.entity_id });
        const settings = settingsArr[0];

        if (settings?.has_completed_bootstrap === true) {
          console.log('[Setup] Bootstrap already complete, redirecting');
          window.location.href = createPageUrl('Home');
          return;
        }
      }
    } catch (err) {
      console.error('Error checking setup status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepComplete = (stepData) => {
    setWizardData((prev) => ({
      ...prev,
      ...stepData,
      // keep policies object merged rather than overwritten
      ...(stepData?.policies
        ? { policies: { ...(prev.policies || {}), ...stepData.policies } }
        : {}),
    }));

    if (currentStep < STEPS.length) {
      setCurrentStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prevStep) => prevStep - 1);
    }
  };

  const handleComplete = async () => {
    console.log('[Setup] Completing setup…');

    // --- Figure out which "tenant / entity" to attach NES policies to ---
    // Prefer entity info captured in setup, fall back to employee context.
    const entityIdFromSetup =
      wizardData?.entity_id ||
      wizardData?.entity?.id ||
      wizardData?.entities?.[0]?.id ||
      employee?.entity_id ||
      null;

    // Safely normalise policies object to avoid TypeError
    const policies = (wizardData && wizardData.policies) || {};

    const nesAnnualEnabled =
      policies.nesAnnualEnabled !== undefined ? policies.nesAnnualEnabled : true;

    const nesPersonalEnabled =
      policies.nesPersonalEnabled !== undefined ? policies.nesPersonalEnabled : true;

    try {
      if (entityIdFromSetup) {
        console.log('[Setup] Ensuring NES leave policies for entity', entityIdFromSetup, {
          nesAnnualEnabled,
          nesPersonalEnabled,
        });

        // Default helper signature is ensureDefaultAustralianLeavePolicies(tenantId)
        // If you later extend it to accept options, it will just use the second arg.
        const result = await ensureDefaultAustralianLeavePolicies(entityIdFromSetup, {
          enableAnnual: nesAnnualEnabled,
          enablePersonal: nesPersonalEnabled,
        });

        console.log('[Setup] NES policy ensure result:', result);
      } else {
        console.warn(
          '[Setup] No entity id found on completion – skipping NES policy creation'
        );
      }
    } catch (err) {
      console.error('[Setup] Failed creating NES policies during setup:', err);
      // Non-blocking: setup can still complete, NES can be fixed later.
    }

    // Clear cached context so Home reloads fresh
    clearEmployeeContextCache();

    // Mark setup as completed locally so Layout/AppShell stops forcing Setup
    try {
      localStorage.removeItem('fcw_setup_skipped');
      localStorage.setItem('fcw_setup_completed', 'true');
    } catch (e) {
      console.warn('[Setup] Failed to write local setup flag', e);
    }

    // Wait a moment for cache to clear and any backend writes to settle, then redirect
    setTimeout(() => {
      window.location.href = createPageUrl('Home');
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#020617] to-[#030712] text-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const CurrentStepComponent = STEPS[currentStep - 1]?.component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#020617] to-[#030712] text-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Logo variant="full" size="lg" darkBg={true} className="mx-auto mb-4" />
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome to FoundersCrew
          </h1>
          <p className="text-slate-300 mt-2">Let&apos;s set up your company workspace</p>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center mb-8">
          {STEPS.map((step, index) => {
            const isComplete = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-colors
                      ${isComplete ? 'bg-green-500 text-white' : ''}
                      ${isCurrent ? 'bg-indigo-500 text-white' : ''}
                      ${!isComplete && !isCurrent ? 'bg-slate-800 text-slate-400' : ''}
                    `}
                  >
                    {isComplete ? <Check className="h-5 w-5" /> : step.id}
                  </div>
                  <span
                    className={`text-sm mt-2 ${
                      isCurrent ? 'text-indigo-400 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mt-5 mx-2 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        <Card className="bg-white/95 backdrop-blur-sm text-slate-900 border-slate-200 shadow-xl">
          <CardContent className="p-8">
            {CurrentStepComponent &&
              (() => {
                const stepId = STEPS[currentStep - 1].id;

                // Special handling for the Leave step which uses data/setData props
                if (stepId === 4) {
                  return (
                    <div>
                      <CurrentStepComponent data={wizardData} setData={setWizardData} />
                      <div className="flex justify-between mt-6 pt-6 border-t">
                        <button
                          onClick={handleBack}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => handleStepComplete({})}
                          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  );
                }

                // Default behaviour for normal steps
                return (
                  <CurrentStepComponent
                    user={user}
                    wizardData={wizardData}
                    onNext={handleStepComplete}
                    onBack={handleBack}
                    onComplete={handleComplete}
                    isFirstStep={currentStep === 1}
                    isLastStep={currentStep === STEPS.length}
                  />
                );
              })()}
          </CardContent>
        </Card>

        <p className="text-center text-slate-400 text-xs mt-6">
          Step {currentStep} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}