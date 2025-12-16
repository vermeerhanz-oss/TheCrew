import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import LeavePolicyWizard from '@/components/policies/LeavePolicyWizard';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';

export default function LeavePolicyNew() {
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate(createPageUrl('LeavePolicies'));
  };

  const handleSuccess = () => {
    navigate(createPageUrl('LeavePolicies'));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Leave Policies
        </Button>
      </div>
      
      <Card className="min-h-[800px]">
        <CardContent className="p-6 h-full">
          <LeavePolicyWizard 
            onCancel={handleCancel} 
            onSuccess={handleSuccess} 
          />
        </CardContent>
      </Card>
    </div>
  );
}