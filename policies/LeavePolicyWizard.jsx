import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Check, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateLeavePolicyContent } from './generateLeavePolicyContent';
import { toast } from 'sonner';
import WizardStepper from '@/components/onboarding/wizard/WizardStepper';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';

const STEPS = [
  { id: 'basics', title: 'Basics' },
  { id: 'nes', title: 'NES & Award' },
  { id: 'accrual', title: 'Accrual' },
  { id: 'usage', title: 'Usage Rules' },
  { id: 'approvals', title: 'Approvals' },
  { id: 'carryover', title: 'Carryover' },
  { id: 'review', title: 'Review' }
];

const INITIAL_DATA = {
  basics: {
    policyTitle: "Leave & Time Off Policy",
    leaveCategory: "ANNUAL",
    jurisdiction: "AU",
    entityId: "all",
    appliesToEmploymentTypes: ["full_time", "part_time"],
    effectiveDate: new Date().toISOString().split('T')[0],
  },
  nesAndAward: {
    useNESMinimums: true,
    awardName: "",
    awardNotes: "",
  },
  accrual: {
    accrualModel: "PER_HOUR_WORKED",
    annualEntitlementDays: 20,
    annualEntitlementHours: 152,
    proRataForPartTime: true,
    startAfterMonths: 0,
    allowNegativeBalance: false,
    negativeBalanceLimitHours: 0,
    roundingMode: "NEAREST_0_1H",
  },
  usage: {
    minimumBlockHours: 4,
    canTakeInHours: true,
    standardNoticeDays: 14,
    allowBlackoutPeriods: false,
    blackoutNotes: "Peak season (Dec-Jan) requires 4 weeks notice.",
    publicHolidayRule: "SKIP_PUB_HOLS",
  },
  evidenceAndApprovals: {
    approverRole: "MANAGER",
    evidenceRequiredAfterDays: 2,
    evidenceNotes: "",
    escalationContact: "HR Manager",
  },
  carryoverAndCaps: {
    allowCarryover: true,
    maxCarryoverDays: 40,
    allowCashOut: false,
    cashOutConditions: "",
  },
};

export default function LeavePolicyWizard({ onCancel, onSuccess }) {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  // const tenantId = employeeCtx?.tenantId || null; // currently unused

  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState(INITIAL_DATA);
  const [entities, setEntities] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');

  useEffect(() => {
    loadEntities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live generation for preview on Review step
  useEffect(() => {
    if (currentStep === STEPS.length - 1) {
      const content = generateLeavePolicyContent(data);
      setGeneratedContent(content);
    }
  }, [currentStep, data]);

  const loadEntities = async () => {
    if (!api) return;
    try {
      const ents = await api.companyEntities.list();
      setEntities(ents || []);
    } catch (e) {
      console.error("Failed to load entities", e);
      toast.error("Failed to load entities");
    }
  };

  const updateSection = (section, field, value) => {
    setData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const updateNested = (section, field, value) => {
    updateSection(section, field, value);
  };

  const nextStep = () =>
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));

  const prevStep = () =>
    setCurrentStep(prev => Math.max(prev - 1, 0));

  // ---- Logic to Apply NES Defaults ----
  const applyNESDefaults = () => {
    const cat = data.basics.leaveCategory;
    let updates = {};

    if (cat === 'ANNUAL') {
      updates = {
        annualEntitlementDays: 20, // 4 weeks
        annualEntitlementHours: 152,
        allowCarryover: true,
        allowCashOut: false,
      };
    } else if (cat === 'PERSONAL_CARER') {
      updates = {
        annualEntitlementDays: 10,
        annualEntitlementHours: 76,
        allowCarryover: true,
        allowCashOut: false,
      };
    } else if (cat === 'FDV') {
      updates = {
        annualEntitlementDays: 10,
        annualEntitlementHours: 76,
        allowCarryover: false, // Resets yearly
        accrualModel: 'PER_YEAR',
      };
    }

    setData(prev => ({
      ...prev,
      accrual: { ...prev.accrual, ...updates },
      carryoverAndCaps: { ...prev.carryoverAndCaps, ...updates },
    }));
    toast.info("Applied NES defaults for " + cat);
  };

  const handleGenerate = async () => {
    if (!data.basics.policyTitle?.trim()) {
      toast.error("Policy title is required");
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Generate Content
      const content = generateLeavePolicyContent(data);

      // 2. Create Leave Policy Entity (Engine Config)
      const policyName = data.basics.policyTitle;
      const leaveCode =
        data.basics.leaveCategory === 'CUSTOM'
          ? 'CUSTOM_' + Date.now()
          : data.basics.leaveCategory;

      const catMap = {
        ANNUAL: 'annual',
        PERSONAL_CARER: 'personal',
        COMPASSIONATE: 'compassionate',
        FDV: 'other',
        UNPAID: 'other',
        CUSTOM: 'other',
      };

      const maxCarryoverDaysNumber = data.carryoverAndCaps.maxCarryoverDays
        ? Number(data.carryoverAndCaps.maxCarryoverDays)
        : 0;

      const leavePolicyData = {
        name: policyName,
        code: leaveCode.toLowerCase(),
        country: data.basics.jurisdiction,
        leave_type: catMap[data.basics.leaveCategory] || 'other',
        employment_type_scope: 'any',
        accrual_unit: 'hours_per_year',
        accrual_rate: Number(data.accrual.annualEntitlementHours || 0),
        standard_hours_per_day: 7.6,
        carryover_allowed: data.carryoverAndCaps.allowCarryover,
        max_carryover_hours: maxCarryoverDaysNumber
          ? maxCarryoverDaysNumber * 7.6
          : null,
        allow_negative_balance: data.accrual.allowNegativeBalance,
        requires_approval: true,
        is_active: true,
        notes: `Generated via Wizard. Award: ${data.nesAndAward.awardName || 'N/A'}`,
      };

      // DEBUG_REMOVE: Log before create
      console.log('[LeavePolicyWizard] tenantId:', employeeCtx?.tenantId);
      console.log('[LeavePolicyWizard] Creating policy payload:', leavePolicyData);
      
      const createdPolicy = await api.leavePolicies.create(leavePolicyData);
      
      // DEBUG_REMOVE: Log after create
      console.log('[LeavePolicyWizard] Created policy:', createdPolicy);
      
      // DEBUG_REMOVE: Verify policy persisted
      const freshList = await api.leavePolicies.list().catch(() => []);
      console.log('[LeavePolicyWizard] Policy count after create:', freshList.length);
      console.log('[LeavePolicyWizard] Last 5 policies:', freshList.slice(-5).map(p => ({ id: p.id, name: p.name, isActive: p.is_active })));

      // 3. Create Document Policy (Library)
      await api.policies.create({
        name: policyName,
        code: leaveCode,
        type: 'LEAVE',
        category: 'HR',
        description: `Leave policy for ${data.basics.leaveCategory}`,
        content: content,
        owner: 'HR',
        effective_date: data.basics.effectiveDate,
        entity_id: data.basics.entityId === 'all' ? null : data.basics.entityId,
        country: data.basics.jurisdiction,
        requires_acknowledgement: false,
        is_active: true,
      });

      toast.success("Leave Policy created successfully");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create policy", error);
      toast.error("Failed to create policy. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const stepsContent = [
    // Step 1: Basics
    (
      <div
        key="step-basics"
        className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300"
      >
        <div className="grid gap-4">
          <div>
            <Label>Policy Title</Label>
            <Input
              value={data.basics.policyTitle}
              onChange={(e) =>
                updateNested('basics', 'policyTitle', e.target.value)
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Leave Category</Label>
              <Select
                value={data.basics.leaveCategory}
                onValueChange={(val) =>
                  updateNested('basics', 'leaveCategory', val)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANNUAL">Annual Leave</SelectItem>
                  <SelectItem value="PERSONAL_CARER">Personal/Carer's</SelectItem>
                  <SelectItem value="COMPASSIONATE">Compassionate</SelectItem>
                  <SelectItem value="FDV">Family & Domestic Violence</SelectItem>
                  <SelectItem value="UNPAID">Unpaid Leave</SelectItem>
                  <SelectItem value="CUSTOM">Custom / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={data.basics.effectiveDate}
                onChange={(e) =>
                  updateNested('basics', 'effectiveDate', e.target.value)
                }
              />
            </div>
          </div>
          <div>
            <Label>Entity Scope</Label>
            <Select
              value={data.basics.entityId}
              onValueChange={(val) => updateNested('basics', 'entityId', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    ),

    // Step 2: NES & Award
    (
      <div
        key="step-nes"
        className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
      >
        <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="useNES"
              checked={data.nesAndAward.useNESMinimums}
              onCheckedChange={(checked) => {
                const isChecked = !!checked;
                updateNested('nesAndAward', 'useNESMinimums', isChecked);
                if (isChecked) applyNESDefaults();
              }}
            />
            <Label
              htmlFor="useNES"
              className="font-medium cursor-pointer"
            >
              Use National Employment Standards (NES) minimums
            </Label>
          </div>
          <p className="text-sm text-slate-500 ml-6">
            Checking this will pre-fill standard Australian entitlements for the
            selected leave category.
          </p>
        </div>

        <div className="space-y-3">
          <Label>Modern Award Name (Optional)</Label>
          <Input
            placeholder="e.g. Clerks - Private Sector Award 2020"
            value={data.nesAndAward.awardName}
            onChange={(e) =>
              updateNested('nesAndAward', 'awardName', e.target.value)
            }
          />
        </div>

        <div className="space-y-3">
          <Label>Award Notes</Label>
          <Textarea
            placeholder="Specific clauses or notes referenced in the policy..."
            value={data.nesAndAward.awardNotes}
            onChange={(e) =>
              updateNested('nesAndAward', 'awardNotes', e.target.value)
            }
          />
        </div>
      </div>
    ),

    // Step 3: Accrual
    (
      <div
        key="step-accrual"
        className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Accrual Model</Label>
            <Select
              value={data.accrual.accrualModel}
              onValueChange={(val) =>
                updateNested('accrual', 'accrualModel', val)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PER_HOUR_WORKED">
                  Per Hour Worked (Pro-rata)
                </SelectItem>
                <SelectItem value="PER_PAY_PERIOD">Per Pay Period</SelectItem>
                <SelectItem value="PER_YEAR">Lump Sum (Per Year)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Annual Entitlement (Days)</Label>
            <Input
              type="number"
              value={data.accrual.annualEntitlementDays}
              onChange={(e) => {
                const days = Number(e.target.value || '0');
                updateNested('accrual', 'annualEntitlementDays', days);
                updateNested('accrual', 'annualEntitlementHours', days * 7.6);
              }}
            />
            <p className="text-xs text-slate-400 mt-1">
              ≈ {data.accrual.annualEntitlementHours} hours (at 7.6h/day)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="proRata"
            checked={data.accrual.proRataForPartTime}
            onCheckedChange={(c) =>
              updateNested('accrual', 'proRataForPartTime', !!c)
            }
          />
          <Label htmlFor="proRata">Pro-rata for Part Time employees</Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="negBalance"
            checked={data.accrual.allowNegativeBalance}
            onCheckedChange={(c) =>
              updateNested('accrual', 'allowNegativeBalance', !!c)
            }
          />
          <Label htmlFor="negBalance">Allow Negative Balance</Label>
        </div>

        {data.accrual.allowNegativeBalance && (
          <div className="pl-6">
            <Label>Negative Balance Limit (Hours)</Label>
            <Input
              type="number"
              className="w-32 mt-1"
              value={data.accrual.negativeBalanceLimitHours}
              onChange={(e) =>
                updateNested(
                  'accrual',
                  'negativeBalanceLimitHours',
                  Number(e.target.value || '0')
                )
              }
            />
          </div>
        )}
      </div>
    ),

    // Step 4: Usage
    (
      <div
        key="step-usage"
        className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Minimum Block (Hours)</Label>
            <Input
              type="number"
              value={data.usage.minimumBlockHours}
              onChange={(e) =>
                updateNested('usage', 'minimumBlockHours', Number(e.target.value || '0'))
              }
            />
          </div>
          <div>
            <Label>Standard Notice (Days)</Label>
            <Input
              type="number"
              value={data.usage.standardNoticeDays}
              onChange={(e) =>
                updateNested('usage', 'standardNoticeDays', Number(e.target.value || '0'))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Public Holidays</Label>
          <Select
            value={data.usage.publicHolidayRule}
            onValueChange={(val) =>
              updateNested('usage', 'publicHolidayRule', val)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SKIP_PUB_HOLS">
                Do NOT deduct leave (Paid as Pub Hol)
              </SelectItem>
              <SelectItem value="INCLUDE_PUB_HOLS">
                Deduct leave (Count as leave day)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Checkbox
              id="blackout"
              checked={data.usage.allowBlackoutPeriods}
              onCheckedChange={(c) =>
                updateNested('usage', 'allowBlackoutPeriods', !!c)
              }
            />
            <Label htmlFor="blackout">Allow Blackout Periods</Label>
          </div>
          {data.usage.allowBlackoutPeriods && (
            <Textarea
              placeholder="Describe blackout rules (e.g. 'No leave in December')..."
              value={data.usage.blackoutNotes}
              onChange={(e) =>
                updateNested('usage', 'blackoutNotes', e.target.value)
              }
            />
          )}
        </div>
      </div>
    ),

    // Step 5: Approvals
    (
      <div
        key="step-approvals"
        className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
      >
        <div>
          <Label>Approver Role</Label>
          <Select
            value={data.evidenceAndApprovals.approverRole}
            onValueChange={(val) =>
              updateNested('evidenceAndApprovals', 'approverRole', val)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MANAGER">Direct Manager</SelectItem>
              <SelectItem value="HR">HR Manager</SelectItem>
              <SelectItem value="BOTH">Manager + HR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Require Evidence After (Days)</Label>
            <Input
              type="number"
              value={data.evidenceAndApprovals.evidenceRequiredAfterDays}
              onChange={(e) =>
                updateNested(
                  'evidenceAndApprovals',
                  'evidenceRequiredAfterDays',
                  Number(e.target.value || '0')
                )
              }
            />
          </div>
          <div>
            <Label>Escalation Contact</Label>
            <Input
              value={data.evidenceAndApprovals.escalationContact}
              onChange={(e) =>
                updateNested(
                  'evidenceAndApprovals',
                  'escalationContact',
                  e.target.value
                )
              }
            />
          </div>
        </div>

        <div>
          <Label>Evidence Notes</Label>
          <Textarea
            placeholder="Additional rules for medical certificates..."
            value={data.evidenceAndApprovals.evidenceNotes}
            onChange={(e) =>
              updateNested(
                'evidenceAndApprovals',
                'evidenceNotes',
                e.target.value
              )
            }
          />
        </div>
      </div>
    ),

    // Step 6: Carryover
    (
      <div
        key="step-carryover"
        className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
      >
        <div className="flex items-center gap-2">
          <Checkbox
            id="carryover"
            checked={data.carryoverAndCaps.allowCarryover}
            onCheckedChange={(c) =>
              updateNested('carryoverAndCaps', 'allowCarryover', !!c)
            }
          />
          <Label htmlFor="carryover">Allow Carryover to Next Year</Label>
        </div>

        {data.carryoverAndCaps.allowCarryover && (
          <div className="pl-6">
            <Label>Max Carryover (Days)</Label>
            <Input
              type="number"
              className="w-32 mt-1"
              value={data.carryoverAndCaps.maxCarryoverDays}
              onChange={(e) =>
                updateNested(
                  'carryoverAndCaps',
                  'maxCarryoverDays',
                  Number(e.target.value || '0')
                )
              }
            />
            <p className="text-xs text-slate-400">Leave blank for unlimited</p>
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Checkbox
              id="cashout"
              checked={data.carryoverAndCaps.allowCashOut}
              onCheckedChange={(c) =>
                updateNested('carryoverAndCaps', 'allowCashOut', !!c)
              }
            />
            <Label htmlFor="cashout">Allow Cashing Out Leave</Label>
          </div>
          {data.carryoverAndCaps.allowCashOut && (
            <Textarea
              placeholder="Conditions for cash out..."
              value={data.carryoverAndCaps.cashOutConditions}
              onChange={(e) =>
                updateNested(
                  'carryoverAndCaps',
                  'cashOutConditions',
                  e.target.value
                )
              }
            />
          )}
        </div>
      </div>
    ),

    // Step 7: Review
    (
      <div
        key="step-review"
        className="animate-in fade-in slide-in-from-right-4 duration-300 h-[60vh] flex flex-col"
      >
        <div className="flex items-center gap-2 mb-4 text-indigo-600 bg-indigo-50 p-3 rounded-lg">
          <Sparkles className="h-5 w-5" />
          <span className="font-medium text-sm">
            Previewing your generated policy document
          </span>
        </div>

        <Card className="flex-1 overflow-y-auto border-2 border-indigo-100">
          <CardContent className="p-8 prose prose-slate max-w-none">
            <ReactMarkdown>{generatedContent}</ReactMarkdown>
          </CardContent>
        </Card>
      </div>
    ),
  ];

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Create Leave Policy
        </h2>
        <p className="text-gray-500">
          Configure leave rules and generate a policy document.
        </p>
      </div>

      <WizardStepper steps={STEPS} currentStep={currentStep} />

      <div className="flex-1 overflow-y-auto py-6 px-1">
        {stepsContent[currentStep]}
      </div>

      <div className="flex justify-between pt-4 mt-4 border-t border-gray-100">
        <Button
          variant="outline"
          onClick={currentStep === 0 ? onCancel : prevStep}
          disabled={isGenerating}
        >
          {currentStep === 0 ? (
            'Cancel'
          ) : (
            <>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </>
          )}
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={nextStep}
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={isGenerating}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-green-600 hover:bg-green-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Policy...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Create Leave Policy
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}