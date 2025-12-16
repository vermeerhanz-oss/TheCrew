import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  ExternalLink, 
  Shield, 
  ArrowRight 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const Policy = base44.entities.Policy;
const PolicyVersion = base44.entities.PolicyVersion;
const PolicyAcknowledgement = base44.entities.PolicyAcknowledgement;

export default function ProfilePoliciesSection({ employee, isOwnProfile }) {
  const [policies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (employee?.id) {
      loadPolicyData();
    }
  }, [employee?.id]);

  const loadPolicyData = async () => {
    setIsLoading(true);
    try {
      // Load active policies
      const [allPolicies, allVersions, empAcks] = await Promise.all([
        Policy.filter({ is_active: true }),
        PolicyVersion.filter({ is_published: true }),
        PolicyAcknowledgement.filter({ employee_id: employee.id }),
      ]);

      // Build acknowledgement map by policy_id
      const ackMap = {};
      for (const ack of empAcks) {
        if (!ackMap[ack.policy_id] || ack.acknowledged_at > ackMap[ack.policy_id].acknowledged_at) {
          ackMap[ack.policy_id] = ack;
        }
      }

      // Build version map by policy_id
      const versionMap = {};
      for (const v of allVersions) {
        versionMap[v.policy_id] = v;
      }

      // Combine data
      const policyList = allPolicies.map(p => ({
        ...p,
        currentVersion: versionMap[p.id] || null,
        acknowledgement: ackMap[p.id] || null,
        isAcknowledged: !!ackMap[p.id],
      }));

      // Sort: mandatory first, then by name
      policyList.sort((a, b) => {
        if (a.is_mandatory !== b.is_mandatory) return a.is_mandatory ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      setPolicies(policyList);
    } catch (error) {
      console.error('Error loading policy data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const pendingPolicies = policies.filter(p => p.requires_acknowledgement && !p.isAcknowledged);
  const acknowledgedPolicies = policies.filter(p => p.isAcknowledged);
  const otherPolicies = policies.filter(p => !p.requires_acknowledgement && !p.isAcknowledged);

  // View for Own Profile (Interactive)
  if (isOwnProfile) {
    return (
      <div className="space-y-8">
        <div className="border-b pb-4">
           <h2 className="text-lg font-semibold text-gray-900">My Policies</h2>
           <p className="text-sm text-gray-500">These policies require your review and acknowledgement. Please read each policy carefully before accepting.</p>
        </div>

        {/* Pending Action Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 bg-amber-500 rounded-full"></div>
            <h3 className="text-base font-semibold text-gray-900">Action Required</h3>
            {pendingPolicies.length > 0 && (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{pendingPolicies.length}</Badge>
            )}
          </div>
          
          {pendingPolicies.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {pendingPolicies.map(policy => (
                <Card key={policy.id} className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg">
                          <Shield className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{policy.name}</h3>
                          <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 mt-1">
                            Pending Acceptance
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">{policy.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">
                        Effective: {policy.effective_date ? format(new Date(policy.effective_date), 'MMM d, yyyy') : '—'}
                      </span>
                      <Link to={createPageUrl('MyPolicyDetail') + `?id=${policy.id}`}>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          View & Accept <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-green-50 border-green-100">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-green-900">All caught up!</h3>
                  <p className="text-green-700 text-sm">You have no pending policy acknowledgements.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* History Section */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 bg-green-500 rounded-full"></div>
            <h3 className="text-base font-semibold text-gray-900">Acknowledged</h3>
            <span className="text-gray-400 text-sm">({acknowledgedPolicies.length})</span>
          </div>

          {acknowledgedPolicies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {acknowledgedPolicies.map(policy => (
                <Card key={policy.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Accepted
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 truncate" title={policy.name}>{policy.name}</h3>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-3">
                      <Clock className="h-3 w-3" />
                      Accepted {policy.acknowledgement ? format(parseISO(policy.acknowledgement.acknowledged_at), 'MMM d, yyyy') : ''}
                    </div>
                    <Link to={createPageUrl('MyPolicyDetail') + `?id=${policy.id}`} className="block mt-4">
                      <Button variant="outline" size="sm" className="w-full">Review Policy</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic text-sm">No acknowledged policies yet.</p>
          )}
        </section>

        {/* Other Policies (Not requiring acknowledgement) */}
        {otherPolicies.length > 0 && (
           <section className="space-y-4 pt-4">
             <div className="flex items-center gap-2">
               <div className="h-6 w-1 bg-slate-300 rounded-full"></div>
               <h3 className="text-base font-semibold text-gray-900">Other Policies</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {otherPolicies.map(policy => (
                 <PolicyRow key={policy.id} policy={policy} />
               ))}
             </div>
           </section>
        )}
      </div>
    );
  }

  // Read-only view for others (Admin view)
  const mandatoryPolicies = policies.filter(p => p.is_mandatory);
  const optionalPolicies = policies.filter(p => !p.is_mandatory);
  const acknowledgedCount = policies.filter(p => p.isAcknowledged).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-900">Policy Acknowledgements</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Policies</p>
              <p className="text-2xl font-bold text-gray-900">{policies.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Acknowledged</p>
              <p className="text-2xl font-bold text-green-600">{acknowledgedCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{policies.length - acknowledgedCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mandatory Policies */}
      {mandatoryPolicies.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mandatory Policies</h3>
            <div className="divide-y divide-gray-100">
              {mandatoryPolicies.map(policy => (
                <PolicyRow key={policy.id} policy={policy} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optional Policies */}
      {optionalPolicies.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Other Policies</h3>
            <div className="divide-y divide-gray-100">
              {optionalPolicies.map(policy => (
                <PolicyRow key={policy.id} policy={policy} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {policies.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">No active policies found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PolicyRow({ policy }) {
  return (
    <div className="py-3 flex items-center justify-between">
      <div className="flex items-start gap-3">
        {policy.isAcknowledged ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
        ) : (
          <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
        )}
        <div>
          <p className="font-medium text-gray-900">{policy.name}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {policy.category && <span>{policy.category}</span>}
            {policy.currentVersion && (
              <span>v{policy.currentVersion.version_number}</span>
            )}
            {policy.currentVersion?.document_url && (
              <a 
                href={policy.currentVersion.document_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        {policy.isAcknowledged ? (
          <div>
            <Badge className="bg-green-100 text-green-700">Acknowledged</Badge>
            <p className="text-xs text-gray-400 mt-1">
              {format(parseISO(policy.acknowledgement.acknowledged_at), 'dd MMM yyyy')}
            </p>
          </div>
        ) : (
          <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
        )}
      </div>
    </div>
  );
}