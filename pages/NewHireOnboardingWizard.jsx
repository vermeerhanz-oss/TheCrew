import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2, UserPlus, Check } from 'lucide-react';

import WizardStepper from '@/components/onboarding/wizard/WizardStepper';
import StepPersonalDetails from '@/components/onboarding/wizard/StepPersonalDetails';
import StepEmploymentSetup from '@/components/onboarding/wizard/StepEmploymentSetup';
import StepCompensation from '@/components/onboarding/wizard/StepCompensation';
import StepOnboardingPlan from '@/components/onboarding/wizard/StepOnboardingPlan';

import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { createNewHireFromWizard, validateStep } from '@/components/utils/newHireOnboardingHelpers';
import { createTenantScopedApi } from '@/components/utils/tenantApi';

const TOTAL_STEPS = 4;

export default function NewHireOnboardingWizard() {
  const navigate = useNavigate();

  // Auth & permissions
  const [userContext, setUserContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [errors, setErrors] = useState({});

  // Wizard data
  const [wizardData, setWizardData] = useState({
    personal: {},
    employment: { employment_type: 'full_time', hours_per_week: 38, fte: 1.0 },
    compensation: { pay_type: 'salary', currency: 'AUD', pay_frequency: 'monthly' },
    contract: {},
    onboarding: { policy_ids: [] },
  });

  // Reference data
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [entities, setEntities] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [contractTemplates, setContractTemplates] = useState([]);

  // Load reference data
  useEffect(() => {
    async function loadData() {
      try {
        const ctx = await getCurrentUserEmployeeContext();
        setUserContext(ctx);

        // Check permissions
        if (!ctx.permissions?.canManageOnboarding) {
          toast.error('You do not have permission to create new hires.');
          navigate(createPageUrl('Home'));
          return;
        }

        // Create a tenant-scoped API instance using the current user's tenant
        const tenantId = ctx.tenantId || ctx.employee?.entity_id || null;
        const api = createTenantScopedApi(tenantId);

        // Prefer using context collections if they exist to avoid duplicate calls
        const ctxEmployees = ctx.employees || [];
        const ctxDepartments = ctx.departments || [];
        const ctxLocations = ctx.locations || [];
        const ctxEntities = ctx.entities || [];

        // Load remaining reference data (tenant-scoped)
        const [
          agreementList,
          templateList,
          policyList,
          docTemplateList,
          // Fallback to API for core collections only if context did not provide them
          empListFallback,
          deptListFallback,
          locListFallback,
          entityListFallback,
        ] = await Promise.all([
          api.employmentAgreements?.list({ is_active: true }) ?? Promise.resolve([]),
          api.onboardingTemplates?.list({ active: true }) ?? Promise.resolve([]),
          api.policies?.list({ is_active: true }) ?? Promise.resolve([]),
          api.documentTemplates
            ? api.documentTemplates.list({ is_active: true }).catch(() => [])
            : Promise.resolve([]),
          ctxEmployees.length === 0
            ? api.employees?.list({ status: 'active' }) ?? Promise.resolve([])
            : Promise.resolve([]),
          ctxDepartments.length === 0
            ? api.departments?.list() ?? Promise.resolve([])
            : Promise.resolve([]),
          ctxLocations.length === 0
            ? api.locations?.list() ?? Promise.resolve([])
            : Promise.resolve([]),
          ctxEntities.length === 0
            ? api.entities?.list({ status: 'active' }) ?? Promise.resolve([])
            : Promise.resolve([]),
        ]);

        const finalEmployees = ctxEmployees.length > 0 ? ctxEmployees : empListFallback;
        const finalDepartments = ctxDepartments.length > 0 ? ctxDepartments : deptListFallback;
        const finalLocations = ctxLocations.length > 0 ? ctxLocations : locListFallback;
        const finalEntities = ctxEntities.length > 0 ? ctxEntities : entityListFallback;

        setEmployees(finalEmployees);
        setDepartments(finalDepartments);
        setLocations(finalLocations);
        setEntities(finalEntities);
        setAgreements(agreementList);
        setTemplates(templateList);
        setPolicies(policyList);
        setContractTemplates(docTemplateList);

        // Auto-select default entity if only one
        if (finalEntities.length === 1) {
          setWizardData((prev) => ({
            ...prev,
            employment: { ...prev.employment, entity_id: finalEntities[0].id },
          }));
        }

        // Auto-select default onboarding template
        const defaultTemplate = templateList.find((t) => t.is_default);
        if (defaultTemplate) {
          setWizardData((prev) => ({
            ...prev,
            onboarding: {
              ...prev.onboarding,
              onboarding_template_id: defaultTemplate.id,
            },
          }));
        }

        // Auto-select mandatory policies
        const mandatoryPolicies = policyList.filter((p) => p.is_mandatory);
        if (mandatoryPolicies.length > 0) {
          setWizardData((prev) => ({
            ...prev,
            onboarding: {
              ...prev.onboarding,
              policy_ids: mandatoryPolicies.map((p) => p.id),
            },
          }));
        }
      } catch (error) {
        console.error('Error loading wizard data:', error);
        toast.error('Failed to load wizard data');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [navigate]);

  const handleDataChange = (newData) => {
    setWizardData(newData);
    setErrors({});
  };

  const handleNext = () => {
    const validation = validateStep(currentStep, wizardData);

    if (!validation.isValid) {
      setErrors(validation.errors);
      toast.error('Please fix the errors before continuing');
      return;
    }

    setErrors({});
    setCompletedSteps((prev) =>
      prev.includes(currentStep) ? prev : [...prev, currentStep]
    );

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate final step
    const validation = validateStep(currentStep, wizardData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createNewHireFromWizard(wizardData);

      if (result.success) {
        toast.success('New hire created and onboarding started!');
        navigate(createPageUrl('EmployeeProfile') + `?id=${result.employee_id}`);
      } else {
        toast.error(result.error || 'Failed to create new hire');
      }
    } catch (error) {
      console.error('Error creating new hire:', error);
      toast.error('Failed to create new hire. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-gray-500">Loading wizard...</p>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepPersonalDetails
            data={wizardData}
            onChange={handleDataChange}
            errors={errors}
            employees={employees}
            departments={departments}
            locations={locations}
          />
        );
      case 2:
        return (
          <StepEmploymentSetup
            data={wizardData}
            onChange={handleDataChange}
            errors={errors}
            entities={entities}
            agreements={agreements}
          />
        );
      case 3:
        return (
          <StepCompensation
            data={wizardData}
            onChange={handleDataChange}
            errors={errors}
            contractTemplates={contractTemplates}
          />
        );
      case 4:
        return (
          <StepOnboardingPlan
            data={wizardData}
            onChange={handleDataChange}
            templates={templates}
            policies={policies}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Hire Onboarding</h1>
            <p className="text-gray-500">
              Create an employee record and start their onboarding
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <WizardStepper currentStep={currentStep} completedSteps={completedSteps} />

      {/* Step Content */}
      <div className="mb-8">{renderStep()}</div>

      {/* Navigation Buttons */}
      <Card>
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex gap-3">
              {currentStep < TOTAL_STEPS ? (
                <Button onClick={handleNext} disabled={isSubmitting}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Create Employee &amp; Start Onboarding
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
