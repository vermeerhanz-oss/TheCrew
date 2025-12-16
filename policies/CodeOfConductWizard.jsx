import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { generateCodeOfConductContent } from './generateCodeOfConductContent';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowRight, Check, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

const STEPS = [
  { id: 'basics', title: 'Basics' },
  { id: 'respectful', title: 'Respectful Workplace' },
  { id: 'conduct', title: 'Professional Conduct' },
  { id: 'reporting', title: 'Reporting' },
  { id: 'preview', title: 'Preview & Generate' }
];

const APPLIES_TO_OPTIONS = [
  'Employees',
  'Contractors',
  'Volunteers',
  'Interns',
  'Management'
];

const INITIAL_DATA = {
  basics: {
    policyTitle: "Code of Conduct & Workplace Behaviour Policy",
    appliesTo: ['Employees', 'Management'],
    companyCoreValues: "",
    policyOwner: "",
    effectiveDate: format(new Date(), 'yyyy-MM-dd'),
    entityName: ""
  },
  respectfulWorkplace: {
    zeroToleranceConfirmed: false,
    socialMediaGuidelines: "",
    includeWHSClause: true,
  },
  professionalConduct: {
    confidentialityConfirmed: false,
    conflictsProcess: "",
    includeITUseGuidelines: true,
  },
  reportingAndConsequences: {
    primaryReportingContact: "",
    alternativeReportingContact: "",
    consequencesConfirmed: false,
  }
};

export default function CodeOfConductWizard({ onCancel, onSuccess }) {
  const api = useTenantApi();
  
  const [step, setStep] = useState(0);
  const [data, setData] = useState(INITIAL_DATA);
  const [isGenerating, setIsGenerating] = useState(false);
  const [entityName, setEntityName] = useState("");

  // Load entity defaults
  useEffect(() => {
    const loadEntity = async () => {
      if (!api) return;
      try {
        const companies = await api.companies.list();
        if (companies && companies.length > 0) {
          setEntityName(companies[0].name);
          setData(prev => ({
            ...prev,
            basics: {
              ...prev.basics,
              entityName: companies[0].name
            }
          }));
        }
      } catch (e) {
        console.error("Failed to load company info", e);
      }
    };
    loadEntity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateData = (section, field, value) => {
    setData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const content = generateCodeOfConductContent(data);

      await api.policies.create({
        name: data.basics.policyTitle,
        code: "CODE_OF_CONDUCT",
        type: "CODE_OF_CONDUCT",
        category: "HR",
        description: "Generated Code of Conduct & Workplace Behaviour Policy",
        content,
        owner: data.basics.policyOwner,
        effective_date: data.basics.effectiveDate,
        is_active: true,
        is_mandatory: true
      });

      toast.success("Code of Conduct created successfully!");
      if (onSuccess) onSuccess();

    } catch (error) {
      console.error(error);
      toast.error("Failed to create policy. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 0:
        return data.basics.policyTitle && data.basics.policyOwner && data.basics.effectiveDate;
      case 1:
        return data.respectfulWorkplace.zeroToleranceConfirmed;
      case 2:
        return true;
      case 3:
        return data.reportingAndConsequences.consequencesConfirmed;
      default:
        return true;
    }
  };

  const renderStep = () => {
    switch (step) {

      case 0:
        return (
          <div className="space-y-6">
            <div className="space-y-4">

              <div>
                <Label>Policy Title</Label>
                <Input
                  value={data.basics.policyTitle}
                  onChange={e => updateData("basics", "policyTitle", e.target.value)}
                />
              </div>

              <div>
                <Label>Applies To</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {APPLIES_TO_OPTIONS.map(opt => (
                    <div key={opt} className="flex items-center space-x-2">
                      <Checkbox
                        checked={data.basics.appliesTo.includes(opt)}
                        onCheckedChange={val => {
                          const checked = !!val;
                          const curr = data.basics.appliesTo;
                          if (checked && !curr.includes(opt)) {
                            updateData("basics", "appliesTo", [...curr, opt]);
                          } else if (!checked) {
                            updateData("basics", "appliesTo", curr.filter(i => i !== opt));
                          }
                        }}
                      />
                      <Label className="cursor-pointer">{opt}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Company Core Values</Label>
                <Textarea
                  rows={3}
                  placeholder="Integrity, Innovation, Respect..."
                  value={data.basics.companyCoreValues}
                  onChange={e => updateData("basics", "companyCoreValues", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Policy Owner</Label>
                  <Input
                    value={data.basics.policyOwner}
                    onChange={e => updateData("basics", "policyOwner", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Effective Date</Label>
                  <Input
                    type="date"
                    value={data.basics.effectiveDate}
                    onChange={e => updateData("basics", "effectiveDate", e.target.value)}
                  />
                </div>
              </div>

            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={data.respectfulWorkplace.zeroToleranceConfirmed}
                    onCheckedChange={val =>
                      updateData("respectfulWorkplace", "zeroToleranceConfirmed", !!val)
                    }
                  />
                  <div>
                    <Label className="font-medium">Confirm Zero-Tolerance Stance</Label>
                    <p className="text-sm text-gray-600">
                      I confirm this policy adopts a zero-tolerance stance on discrimination,
                      bullying, harassment, sexual harassment, and victimisation.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Protected Attributes (Australian Law)
              </h4>
              <p className="text-sm text-blue-800">
                The generated policy includes all protected attributes under Australian law:
                race, sex, age, disability, gender identity, sexual orientation, etc.
              </p>
            </div>

            <div>
              <Label>Social Media & Public Conduct</Label>
              <Textarea
                rows={4}
                value={data.respectfulWorkplace.socialMediaGuidelines}
                onChange={e =>
                  updateData("respectfulWorkplace", "socialMediaGuidelines", e.target.value)
                }
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={data.respectfulWorkplace.includeWHSClause}
                onCheckedChange={v =>
                  updateData("respectfulWorkplace", "includeWHSClause", !!v)
                }
              />
              <Label>Include clause on WHS & psychological safety.</Label>
            </div>

          </div>
        );

      case 2:
        return (
          <div className="space-y-6">

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={data.professionalConduct.confidentialityConfirmed}
                onCheckedChange={val =>
                  updateData("professionalConduct", "confidentialityConfirmed", !!val)
                }
              />
              <Label>Confirm protection of confidential information (IP, client data).</Label>
            </div>

            <div>
              <Label>Conflicts of Interest Process</Label>
              <Textarea
                rows={3}
                value={data.professionalConduct.conflictsProcess}
                onChange={e =>
                  updateData("professionalConduct", "conflictsProcess", e.target.value)
                }
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={data.professionalConduct.includeITUseGuidelines}
                onCheckedChange={val =>
                  updateData("professionalConduct", "includeITUseGuidelines", !!val)
                }
              />
              <Label>Include acceptable use guidelines for IT assets.</Label>
            </div>

          </div>
        );

      case 3:
        return (
          <div className="space-y-6">

            <div>
              <Label>Primary Reporting Contact</Label>
              <Input
                value={data.reportingAndConsequences.primaryReportingContact}
                onChange={e =>
                  updateData("reportingAndConsequences", "primaryReportingContact", e.target.value)
                }
              />
            </div>

            <div>
              <Label>Alternative / Confidential Contact</Label>
              <Input
                value={data.reportingAndConsequences.alternativeReportingContact}
                onChange={e =>
                  updateData("reportingAndConsequences", "alternativeReportingContact", e.target.value)
                }
              />
            </div>

            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={data.reportingAndConsequences.consequencesConfirmed}
                    onCheckedChange={val =>
                      updateData("reportingAndConsequences", "consequencesConfirmed", !!val)
                    }
                  />
                  <div>
                    <Label className="text-red-900 font-medium">
                      Confirm Disciplinary Consequences
                    </Label>
                    <p className="text-sm text-red-800">
                      Breaches may lead to disciplinary action, including termination.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        );

      case 4: {
        const preview = generateCodeOfConductContent(data);
        return (
          <div className="space-y-4 h-full flex flex-col">

            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900">Legal Disclaimer</AlertTitle>
              <AlertDescription>
                This is a general template and not legal advice.
              </AlertDescription>
            </Alert>

            <div className="flex-1 border rounded-md bg-white p-6 overflow-y-auto shadow-sm">
              <article className="prose prose-sm max-w-none">
                <ReactMarkdown>{preview}</ReactMarkdown>
              </article>
            </div>

          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[800px]">

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Code of Conduct Wizard</h2>
        <p className="text-gray-500">Create a workplace behaviour policy in minutes.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 px-2">
        {STEPS.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 
                ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-600' :
                  done ? 'border-green-600 bg-green-50 text-green-600' :
                    'border-gray-200 text-gray-400'}`}
              >
                {done ? <Check className="w-4 h-4" /> : <span>{i + 1}</span>}
              </div>
              <span
                className={`ml-2 text-sm hidden sm:block 
                ${active ? 'text-indigo-600' :
                  done ? 'text-green-600' : 'text-gray-400'}`}
              >
                {s.title}
              </span>

              {i < STEPS.length - 1 && (
                <div className="w-12 h-0.5 mx-4 bg-gray-200 hidden sm:block" />
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {renderStep()}
      </div>

      {/* Footer */}
      <div className="flex justify-between pt-4 border-t mt-4">
        <Button variant="outline" onClick={step === 0 ? onCancel : handleBack}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!isStepValid()}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
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
                Generating...
              </>
            ) : (
              <>
                Generate Policy <Check className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>

    </div>
  );
}