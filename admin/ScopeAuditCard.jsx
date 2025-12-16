/**
 * ScopeAuditCard.jsx
 * 
 * Admin Utilities card for running scope audits and probes.
 * Helps detect and prevent multi-tenant scoping errors.
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Download,
  Eye,
  TestTube,
  AlertTriangle,
} from 'lucide-react';
import { useScope } from '@/components/utils/useScope';
import { 
  runScopeAudit, 
  runEntityScopeProbe,
  getScopeAuditSummary,
  clearScopeAudit,
} from '@/components/utils/scopeAudit';
import { toast } from 'sonner';

export default function ScopeAuditCard() {
  const scope = useScope();
  const [isAuditing, setIsAuditing] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [probeResults, setProbeResults] = useState(null);
  const [runtimeSummary, setRuntimeSummary] = useState(null);

  const handleRunAudit = async () => {
    if (!scope.isReady || !scope.tenantId) {
      toast.error('Scope not ready. Please wait for context to load.');
      return;
    }

    setIsAuditing(true);
    setAuditResults(null);

    try {
      const results = await runScopeAudit(scope.tenantId);
      setAuditResults(results);
      toast.success(`Audit complete: ${results.length} entities checked`);
    } catch (err) {
      console.error('[ScopeAuditCard] Audit failed:', err);
      toast.error(`Audit failed: ${err.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRunProbe = async () => {
    if (!scope.isReady || !scope.tenantId) {
      toast.error('Scope not ready. Please wait for context to load.');
      return;
    }

    setIsProbing(true);
    setProbeResults(null);

    try {
      const results = await runEntityScopeProbe(scope.tenantId);
      setProbeResults(results);
      toast.success(`Probe complete: ${results.length} entities tested`);
    } catch (err) {
      console.error('[ScopeAuditCard] Probe failed:', err);
      toast.error(`Probe failed: ${err.message}`);
    } finally {
      setIsProbing(false);
    }
  };

  const handleExportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      scope: {
        tenantId: scope.tenantId,
        entityId: scope.entityId,
        userEmail: scope.userEmail,
      },
      auditResults,
      probeResults,
      runtimeSummary,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scope-audit-${scope.tenantId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Report exported');
  };

  const handleViewRuntimeErrors = () => {
    const summary = getScopeAuditSummary();
    setRuntimeSummary(summary);
    toast.info(`Runtime summary loaded: ${summary?.totalErrors ?? 0} errors`);
  };

  const handleClearRuntimeErrors = () => {
    clearScopeAudit();
    setRuntimeSummary(null);
    toast.success('Runtime audit cleared');
  };

  const criticalIssues = auditResults?.filter(r => r.scopeDiscrepancy) || [];
  const warnings = auditResults?.filter(r => r.hasUnscopedRecords) || [];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Scope Audit & Probe</h3>
            <p className="text-sm text-gray-500 mt-1">
              Detect and prevent multi-tenant scoping errors
            </p>
          </div>
          {!scope.isReady && (
            <div className="flex items-center gap-2 text-amber-600 text-xs">
              <AlertCircle className="h-4 w-4" />
              <span>Scope not ready</span>
            </div>
          )}
        </div>

        {/* Scope Status */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Tenant ID:</span>
              <span className="ml-2 font-mono text-gray-900">{scope.tenantId || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Entity ID:</span>
              <span className="ml-2 font-mono text-gray-900">{scope.entityId || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <span className={`ml-2 font-medium ${scope.isReady ? 'text-green-600' : 'text-amber-600'}`}>
                {scope.isReady ? 'Ready' : 'Loading...'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">User:</span>
              <span className="ml-2 text-gray-900">{scope.userEmail || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            onClick={handleRunAudit}
            disabled={isAuditing || !scope.isReady}
            size="sm"
          >
            {isAuditing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Auditing...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Run Scope Audit
              </>
            )}
          </Button>

          <Button
            onClick={handleRunProbe}
            disabled={isProbing || !scope.isReady}
            variant="outline"
            size="sm"
          >
            {isProbing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Probing...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Run Entity Probe
              </>
            )}
          </Button>

          <Button
            onClick={handleViewRuntimeErrors}
            variant="outline"
            size="sm"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            View Runtime Errors
          </Button>

          {(auditResults || probeResults || runtimeSummary) && (
            <Button
              onClick={handleExportReport}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>

        {/* Audit Results Summary */}
        {auditResults && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Audit Results</h4>
            
            {criticalIssues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800">
                      {criticalIssues.length} Critical Scope Issues
                    </p>
                    <ul className="text-xs text-red-700 mt-1 space-y-1">
                      {criticalIssues.slice(0, 3).map((issue, idx) => (
                        <li key={idx}>
                          <span className="font-medium">{issue.entityName}:</span> {issue.notes}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">
                      {warnings.length} Warnings (Legacy/Unscoped Records)
                    </p>
                    <ul className="text-xs text-amber-700 mt-1 space-y-1">
                      {warnings.slice(0, 3).map((warn, idx) => (
                        <li key={idx}>
                          <span className="font-medium">{warn.entityName}:</span> {warn.notes}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {criticalIssues.length === 0 && warnings.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-800">
                    All entities correctly scoped. No critical issues found.
                  </p>
                </div>
              </div>
            )}

            {/* Detailed Table */}
            <details className="mt-3">
              <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                View detailed results ({auditResults.length} entities)
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Entity</th>
                      <th className="px-2 py-1 text-right">Scoped</th>
                      <th className="px-2 py-1 text-right">Unscoped</th>
                      <th className="px-2 py-1 text-left">Suspected Fields</th>
                      <th className="px-2 py-1 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditResults.map((result, idx) => (
                      <tr key={idx} className={result.scopeDiscrepancy ? 'bg-red-50' : ''}>
                        <td className="px-2 py-1 font-medium">{result.entityName}</td>
                        <td className="px-2 py-1 text-right">{result.scopedCount}</td>
                        <td className="px-2 py-1 text-right">{result.unscopedCount}</td>
                        <td className="px-2 py-1 text-xs text-gray-500">
                          {Object.entries(result.suspectedScopeFields).map(([k, v]) => (
                            <span key={k} className={v === 'MATCH' ? 'text-green-600' : 'text-red-600'}>
                              {k}: {v}
                            </span>
                          )).reduce((prev, curr) => [prev, ', ', curr], [])}
                        </td>
                        <td className="px-2 py-1 text-xs text-gray-600">{result.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}

        {/* Probe Results */}
        {probeResults && (
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Probe Results</h4>
            <div className="space-y-2">
              {probeResults.map((result, idx) => (
                <div key={idx} className="bg-gray-50 rounded p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{result.entityName}</span>
                    <span className={`px-2 py-0.5 rounded ${
                      result.probeStatus === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                      result.probeStatus === 'ERROR' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {result.probeStatus}
                    </span>
                  </div>
                  {result.concludedScopeField && (
                    <div className="mt-1 text-gray-600">
                      Scope field: <span className="font-mono text-indigo-600">{result.concludedScopeField}</span>
                    </div>
                  )}
                  {result.notes && result.notes !== 'OK' && (
                    <div className="mt-1 text-amber-700">{result.notes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Runtime Summary */}
        {runtimeSummary && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">Runtime Errors</h4>
              <Button
                onClick={handleClearRuntimeErrors}
                variant="ghost"
                size="sm"
              >
                Clear
              </Button>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Total Errors:</span>
                  <span className="ml-2 font-semibold text-red-600">{runtimeSummary.totalErrors}</span>
                </div>
                <div>
                  <span className="text-gray-500">Unique Offenders:</span>
                  <span className="ml-2 font-semibold text-amber-600">{runtimeSummary.uniqueOffenders}</span>
                </div>
              </div>
            </div>

            {runtimeSummary.topOffenders?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Top Offenders:</p>
                <ul className="text-xs space-y-1">
                  {runtimeSummary.topOffenders.map((offender, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span className="font-mono text-gray-600">{offender.key}</span>
                      <span className="text-red-600 font-medium">{offender.count}x</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <details>
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                View recent errors ({runtimeSummary.recentErrors?.length ?? 0})
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
                {runtimeSummary.recentErrors?.map((error, idx) => (
                  <div key={idx} className="bg-white border rounded p-2 text-xs">
                    <div className="font-mono text-gray-900">
                      {error.entityName}.{error.method}
                    </div>
                    <div className="text-gray-500 mt-1">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}