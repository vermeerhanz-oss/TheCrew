import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTenantApi } from '@/components/utils/useTenantApi';

export default function AntiHarassmentWizard({ onCancel, onSuccess }) {
  const api = useTenantApi();
  const [data, setData] = useState({
    title: "Anti-Discrimination & Harassment Policy",
    owner: "",
    effectiveDate: format(new Date(), 'yyyy-MM-dd'),
    customContent: ""
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const content = `# ${data.title}
      
**Effective Date:** ${data.effectiveDate}
**Owner:** ${data.owner}

## Purpose
The purpose of this policy is to ensure that all employees are treated with dignity and respect, and are able to work in an environment free from discrimination, harassment, and bullying.

## Scope
This policy applies to all employees, contractors, and visitors.

## Policy Statement
The Company does not tolerate discrimination or harassment of any kind. We are committed to a workplace where everyone is treated fairly and with respect.

${data.customContent}

## Reporting
Any incidents should be reported immediately to ${data.owner || 'Management'}.
`;

      await api.policies.create({
        name: data.title,
        type: 'ANTI_HARASSMENT',
        category: 'HR',
        description: 'Generated Anti-Discrimination & Harassment Policy',
        content: content,
        owner: data.owner,
        effective_date: data.effectiveDate,
        is_active: true,
        is_mandatory: true,
      });

      toast.success("Policy created successfully!");
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Failed to create policy", error);
      toast.error("Failed to create policy.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Anti-Discrimination & Harassment Policy</h2>
        <p className="text-gray-500">Create a standard policy to ensure a respectful workplace.</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Policy Title</Label>
          <Input value={data.title} onChange={e => setData({...data, title: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Owner</Label>
            <Input value={data.owner} onChange={e => setData({...data, owner: e.target.value})} placeholder="e.g. HR Manager" />
          </div>
          <div>
            <Label>Effective Date</Label>
            <Input type="date" value={data.effectiveDate} onChange={e => setData({...data, effectiveDate: e.target.value})} />
          </div>
        </div>
        <div>
          <Label>Additional Clauses (Optional)</Label>
          <Textarea 
            value={data.customContent} 
            onChange={e => setData({...data, customContent: e.target.value})}
            placeholder="Add specific details about your organization's stance..."
            rows={5}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleGenerate} disabled={isGenerating || !data.title}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Generate Policy
        </Button>
      </div>
    </div>
  );
}