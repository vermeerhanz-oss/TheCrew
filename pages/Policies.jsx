import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';
import { FileText, Check, ExternalLink, Loader2 } from 'lucide-react';
import { canAcknowledgePolicy, canViewDocument } from '@/components/utils/permissions';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';

export default function Policies() {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId || null;
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledging, setAcknowledging] = useState(null);

  const loadData = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const emps = await api.employees.filter({ entity_id: tenantId, email: currentUser.email });
      
      if (emps.length === 0) {
        // No employee found
        setIsLoading(false);
        return;
      }

      const emp = emps[0];
      setEmployee(emp);

      // Company-wide policies only (no employee_id)
      const allDocs = await api.documents.filter({ entity_id: tenantId });
      const companyPolicies = allDocs.filter(doc => 
        !doc.employee_id && canViewDocument(currentUser, doc, null, emp)
      );

      const acks = await api.policyAcknowledgements.filter({ entity_id: tenantId, employee_id: emp.id });

      setPolicies(companyPolicies);
      setAcknowledgements(acks);
    } catch (error) {
      console.error('Error loading policies:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcknowledge = async (policy) => {
    // Permission check before acknowledging
    if (!canAcknowledgePolicy(user, policy, employee)) {
      console.error("Permission denied to acknowledge this policy");
      return;
    }

    setAcknowledging(policy.id);
    try {
      await api.policyAcknowledgements.create({
        entity_id: tenantId,
        employee_id: employee.id,
        document_id: policy.id,
        acknowledged_at: new Date().toISOString(),
      });
      await loadData();
    } catch (error) {
      console.error('Error acknowledging policy:', error);
    } finally {
      setAcknowledging(null);
    }
  };

  const isAcknowledged = (policyId) => acknowledgements.some(a => a.document_id === policyId);
  const getAckDate = (policyId) => {
    const ack = acknowledgements.find(a => a.document_id === policyId);
    return ack ? format(new Date(ack.acknowledged_at), 'dd MMM yyyy') : null;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState onRetry={loadData} />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6">
        <EmptyState 
          title="No employee profile" 
          description="We couldn't find an employee profile linked to your account." 
          icon={FileText}
        />
      </div>
    );
  }

  const pendingPolicies = policies.filter(p => !isAcknowledged(p.id));
  const acknowledgedPolicies = policies.filter(p => isAcknowledged(p.id));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Company Policies</h1>

      {pendingPolicies.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Pending Acknowledgement</h2>
          <div className="space-y-4">
            {pendingPolicies.map((policy) => (
              <Card key={policy.id} className="border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">{policy.title}</p>
                        {policy.description && (
                          <p className="text-sm text-gray-500 mt-1">{policy.description}</p>
                        )}
                        <a
                          href={policy.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2"
                        >
                          View document <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    {canAcknowledgePolicy(user, policy, employee) && (
                      <Button
                        onClick={() => handleAcknowledge(policy)}
                        disabled={acknowledging === policy.id}
                      >
                        {acknowledging === policy.id ? 'Processing...' : 'I Acknowledge'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {acknowledgedPolicies.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Acknowledged</h2>
          <Card>
            <CardContent className="p-0 divide-y divide-gray-200">
              {acknowledgedPolicies.map((policy) => (
                <div key={policy.id} className="px-4 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-gray-900">{policy.title}</p>
                      <p className="text-xs text-gray-500">Acknowledged on {getAckDate(policy.id)}</p>
                    </div>
                  </div>
                  <a
                    href={policy.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {policies.length === 0 && (
        <EmptyState 
          title="No policies found" 
          description="There are no policies requiring your acknowledgement at this time." 
          icon={Check}
        />
      )}
    </div>
  );
}