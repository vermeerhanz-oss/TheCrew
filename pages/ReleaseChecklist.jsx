import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import ErrorState from '@/components/common/ErrorState';
import { Loader2 } from 'lucide-react';

export default function ReleaseChecklist() {
  const [context, setContext] = useState(null);
  
  useEffect(() => {
    const load = async () => {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);
    };
    load();
  }, []);

  const { isAllowed, isLoading } = useRequirePermission(context, 'canManageCompanySettings', {
    requireAdminMode: true,
    redirectTo: 'Home'
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAllowed) {
    return null; 
  }

  const sections = [
    {
      title: "Leave & Approvals",
      items: [
        "Create leave for yourself.",
        "Approve leave as manager.",
        "Recall approved leave.",
        "Check Leave Calendar shows it correctly.",
        "Run Leave Accrual Report for the current FY and export CSV."
      ]
    },
    {
      title: "Onboarding",
      items: [
        "Create a new onboarding template.",
        "Start onboarding for a new hire.",
        "Complete at least one onboarding task."
      ]
    },
    {
      title: "Policies & Staffing Rules",
      items: [
        "Create a new policy and assign it.",
        "Create or edit a staffing rule and confirm warnings show on leave creation."
      ]
    },
    {
      title: "Notifications",
      items: [
        "Trigger a leave request and confirm a bell notification appears for the manager."
      ]
    },
    {
      title: "AI Assistant",
      items: [
        "Ask “Explain this page and how to use it” on Leave Calendar and Onboarding pages."
      ]
    }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Release Checklist – FoundersCreW</h1>
        <p className="text-gray-500 mt-1">Use this before each publish to run a quick smoke test across critical flows.</p>
      </div>

      <div className="grid gap-6">
        {sections.map((section, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <Checkbox id={`section-${idx}-item-${i}`} />
                    <Label 
                      htmlFor={`section-${idx}-item-${i}`} 
                      className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 pt-0.5"
                    >
                      {item}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}