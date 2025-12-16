import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTenantApi } from '@/components/utils/useTenantApi';

export default function WhsWizard({ onCancel, onSuccess }) {
  const api = useTenantApi();
  const [data, setData] = useState({
    title: "Work Health & Safety Policy",
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

## Commitment
The Company is committed to providing a safe and healthy working environment for all workers, visitors, and contractors.

## Responsibilities
- **Management:** Ensure safe systems of work and provide necessary training.
- **Workers:** Take reasonable care for their own safety and comply with WHS instructions.

## Consultation
We will consult with workers on matters that affect their health and safety.

${data.customContent}

## Emergency Procedures
In the event of an emergency, all workers must follow the directions of wardens and emergency services.
`;

      await api.policies.create({
        name: data.title,
        type: 'WHS',
        category: 'Workplace Health & Safety',
        description: 'Generated WHS Policy',
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
        <h2 className="text-xl font-bold">Work Health & Safety Policy</h2>
        <p className="text-gray-500">Create a standard WHS policy.</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Policy Title</Label>
          <Input value={data.title} onChange={e => setData({...data, title: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Owner</Label>
            <Input value={data.owner} onChange={e => setData({...data, owner: e.target.value})} placeholder="e.g. Safety Officer" />
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
            placeholder="Add specific safety details..."
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