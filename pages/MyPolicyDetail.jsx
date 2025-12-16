import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Calendar, Shield, CheckCircle2, AlertCircle, File, Download } from 'lucide-react';
import TemplateDocumentViewer from '@/components/documents/TemplateDocumentViewer';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function MyPolicyDetail() {
  const [policy, setPolicy] = useState(null);
  const [acknowledgement, setAcknowledgement] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      const employees = await base44.entities.Employee.filter({ user_id: user.id });
      const emp = employees[0];
      setCurrentEmployee(emp);

      if (!emp) {
        // Not an employee
        setIsLoading(false);
        return;
      }

      // Load Policy
      const policies = await base44.entities.Policy.filter({ id: id });
      if (policies.length > 0) {
        setPolicy(policies[0]);
        
        // Check Acknowledgement
        const acks = await base44.entities.PolicyAcknowledgement.filter({ 
          policy_id: id,
          employee_id: emp.id
        });
        if (acks.length > 0) {
          setAcknowledgement(acks[0]);
          setAgreed(true);
        }
      }
    } catch (error) {
      console.error("Error loading policy", error);
      toast.error("Failed to load policy details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!agreed) return;
    if (!policy || !currentEmployee) return;

    setIsSubmitting(true);
    try {
      const newAck = await base44.entities.PolicyAcknowledgement.create({
        policy_id: policy.id,
        employee_id: currentEmployee.id,
        acknowledged_at: new Date().toISOString(),
        version_label: 'v1',
        policy_title_snapshot: policy.name,
        policy_type_snapshot: policy.type
      });

      setAcknowledgement(newAck);
      toast.success("Policy acknowledged successfully");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.8 }
      });
    } catch (error) {
      console.error("Error accepting policy", error);
      toast.error("Failed to accept policy");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Policy not found.</p>
        <Link to={createPageUrl('MyPolicies')}>
          <Button variant="outline" className="mt-4">Back to My Policies</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <Link to={createPageUrl('MyPolicies')}>
          <Button variant="ghost" size="sm" className="mb-2 pl-0 text-gray-500 hover:text-indigo-600">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Policies
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{policy.name}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                <Shield className="h-3 w-3" />
                {policy.type || 'Standard Policy'}
              </span>
              <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                <Calendar className="h-3 w-3" />
                Effective: {policy.effective_date ? format(new Date(policy.effective_date), 'MMM d, yyyy') : '—'}
              </span>
            </div>
          </div>
          {acknowledgement && (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 px-3 py-1 text-sm">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Acknowledged
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 mb-8">
        {policy.template_id ? (
          <div className="space-y-4">
             <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
               Please review the following document carefully.
             </div>
             <TemplateDocumentViewer templateId={policy.template_id} />
          </div>
        ) : policy.has_uploaded_file && (
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                  <File className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Policy Document</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    This policy is provided as a downloadable document. Please download and review it before acknowledging.
                  </p>
                </div>
                <a href={policy.file_url} target="_blank" rel="noopener noreferrer" download className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </a>
              </div>
              {(policy.file_name || policy.file_size_bytes) && (
                 <div className="mt-2 text-xs text-gray-500 sm:ml-[68px]">
                    {policy.file_name} {policy.file_size_bytes && `(${(policy.file_size_bytes / 1024 / 1024).toFixed(2)} MB)`}
                 </div>
              )}
            </CardContent>
          </Card>
        )}

        {(!policy.template_id) && (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-8 md:p-10">
            {policy.has_uploaded_file && policy.content && (
               <div className="mb-6 pb-6 border-b border-gray-100">
                  <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Summary / Notes</h4>
                  <div className="prose prose-slate max-w-none">
                    <ReactMarkdown>{policy.content}</ReactMarkdown>
                  </div>
               </div>
            )}
            
            {!policy.has_uploaded_file && policy.content ? (
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown>{policy.content}</ReactMarkdown>
              </div>
            ) : !policy.has_uploaded_file && !policy.content ? (
              <div className="text-center py-12 text-gray-400">
                <p>No content available to display.</p>
              </div>
            ) : null}
            
            {policy.has_uploaded_file && !policy.content && (
               <div className="text-center py-8 text-gray-400 italic">
                  Please refer to the downloadable document above for full policy details.
               </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* Acceptance Section - Fixed at bottom or inline? Inline for better flow on mobile */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg lg:static lg:shadow-none lg:border-0 lg:bg-transparent lg:p-0 transition-transform duration-300 ${acknowledgement ? 'translate-y-full lg:translate-y-0' : 'translate-y-0'}`}>
        {!acknowledgement ? (
          <Card className="max-w-4xl mx-auto border-indigo-100 bg-indigo-50/50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-indigo-600" />
                Acknowledgement Required
              </h3>
              <div className="flex items-start space-x-3 mb-6">
                <Checkbox 
                  id="agree" 
                  checked={agreed}
                  onCheckedChange={setAgreed}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <label htmlFor="agree" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    I confirm that I have read and understood this policy and agree to comply with it.
                  </label>
                  <p className="text-xs text-gray-500">
                    By clicking Accept, you are recording your digital signature and agreement to this policy.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleAccept} 
                  disabled={!agreed || isSubmitting}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    "Accept Policy"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-green-700 font-medium flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              You acknowledged this policy on {format(new Date(acknowledgement.acknowledged_at), 'PPPP')}
            </p>
          </div>
        )}
      </div>
      
      {/* Spacer for mobile fixed bottom */}
      {!acknowledgement && <div className="h-24 lg:h-0" />}
    </div>
  );
}