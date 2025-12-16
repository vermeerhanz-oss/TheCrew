/**
 * ScopeDebugBadge.jsx
 * 
 * Dev-only floating badge showing scope errors count.
 * Clickable to view recent errors with stack traces.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getScopeAuditSummary, clearScopeAudit } from '@/components/utils/scopeAudit';

export default function ScopeDebugBadge() {
  const [summary, setSummary] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Poll for updates
    const interval = setInterval(() => {
      const current = getScopeAuditSummary();
      setSummary(current);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!summary || summary.totalErrors === 0) {
    return null;
  }

  return (
    <>
      {/* Badge */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-full shadow-lg hover:bg-red-700 transition-colors"
      >
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          Scope Errors: {summary.totalErrors}
        </span>
      </button>

      {/* Error Panel */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-50" 
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-20 right-4 w-96 max-h-[70vh] bg-white rounded-lg shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Scope Errors</h3>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    clearScopeAudit();
                    setSummary(null);
                    setIsOpen(false);
                  }}
                  variant="ghost"
                  size="sm"
                >
                  Clear
                </Button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b bg-gray-50">
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-gray-600">Total Errors:</span>
                  <span className="ml-2 font-semibold text-red-600">{summary.totalErrors}</span>
                </div>
                <div>
                  <span className="text-gray-600">Unique Offenders:</span>
                  <span className="ml-2 font-semibold text-amber-600">{summary.uniqueOffenders}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {summary.recentErrors?.map((error, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 text-xs">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono font-medium text-red-600">
                      {error.entityName}.{error.method}
                    </span>
                    <span className="text-gray-500 text-[10px]">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-gray-600">
                    <div>
                      <span className="font-medium">Scope:</span>
                      <pre className="mt-1 text-[10px] bg-white p-1 rounded border">
                        {JSON.stringify(error.scopeInfo, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {error.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        Stack trace
                      </summary>
                      <pre className="mt-1 text-[9px] bg-white p-2 rounded border overflow-x-auto">
                        {error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}