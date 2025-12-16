// src/components/admin/MigrationAuditorCard.jsx
import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Globe } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTenantApi } from "@/components/utils/useTenantApi";
import { createAuditSession, summarizeSession, sleep, safeListScopeCheck } from "@/components/utils/migrationAuditor";

// Update this list over time (start small)
const DEFAULT_ROUTES = [
  "/",
  "/employees",
  "/onboardingmanage",
  "/offboardingmanage",
  "/adminutilities",
  "/documents",
  "/myleave",
];

export default function MigrationAuditorCard() {
  const api = useTenantApi();
  const navigate = useNavigate();
  const location = useLocation();

  const [busy, setBusy] = useState(false);
  const [lastRouteReport, setLastRouteReport] = useState(null);
  const [lastScopeReport, setLastScopeReport] = useState(null);

  const entityId = api?.entityId || null;

  const routes = useMemo(() => DEFAULT_ROUTES, []);

  const runRouteSweep = async () => {
    setBusy(true);
    setLastRouteReport(null);

    const session = createAuditSession();
    session.addNote(`Route sweep starting; from=${location.pathname}`);

    try {
      const startPath = location.pathname;

      const perRoute = [];
      for (const path of routes) {
        session.addNote(`Navigate: ${path}`);
        navigate(path);
        // allow route render + data loaders
        await sleep(900);

        // snapshot and reset noise per route by starting a new session chunk
        const snap = session.snapshot();
        const summary = summarizeSession(snap);

        perRoute.push({
          route: path,
          ok: summary.ok,
          counts: summary.counts,
          topFetchFails: summary.topFetchFails,
          topConsoleErrors: summary.topConsoleErrors,
          topWindowErrors: summary.topWindowErrors,
          topRejections: summary.topRejections,
        });
      }

      // Navigate back
      navigate(startPath);
      await sleep(300);

      const overallOk = perRoute.every((r) => r.ok);

      setLastRouteReport({
        ok: overallOk,
        ranAt: new Date().toISOString(),
        entityId,
        perRoute,
      });
    } finally {
      session.stop();
      setBusy(false);
    }
  };

  const runScopeSweep = async () => {
    setBusy(true);
    setLastScopeReport(null);

    if (!api) {
      setLastScopeReport({ ok: false, ranAt: new Date().toISOString(), results: [{ name: "api-present", ok: false, detail: "useTenantApi() returned null" }] });
      setBusy(false);
      return;
    }
    if (!api.entityId) {
      setLastScopeReport({ ok: false, ranAt: new Date().toISOString(), results: [{ name: "entity-scope", ok: false, detail: "api.entityId is missing" }] });
      setBusy(false);
      return;
    }

    const results = [];

    // Add safe checks here. IMPORTANT: do NOT create rows (avoid false failures).
    results.push(await safeListScopeCheck({ name: "employees.list", listFn: () => api.employees.list(), apiEntityId: api.entityId }));
    results.push(await safeListScopeCheck({ name: "departments.list", listFn: () => api.departments.list(), apiEntityId: api.entityId }));
    results.push(await safeListScopeCheck({ name: "locations.list", listFn: () => api.locations.list(), apiEntityId: api.entityId }));

    // Offboarding scoped entities
    if (api.employeeOffboardings?.list) {
      results.push(await safeListScopeCheck({ name: "employeeOffboardings.list", listFn: () => api.employeeOffboardings.list(), apiEntityId: api.entityId }));
    }
    if (api.employeeOffboardingTasks?.list) {
      results.push(await safeListScopeCheck({ name: "employeeOffboardingTasks.list", listFn: () => api.employeeOffboardingTasks.list(), apiEntityId: api.entityId }));
    }

    // Templates (these often don’t include entity_id on rows; safeListScopeCheck only enforces if entity_id exists)
    if (api.offboardingTemplates?.list) {
      results.push(await safeListScopeCheck({ name: "offboardingTemplates.list", listFn: () => api.offboardingTemplates.list(), apiEntityId: api.entityId }));
    }
    if (api.onboardingTemplates?.list) {
      results.push(await safeListScopeCheck({ name: "onboardingTemplates.list", listFn: () => api.onboardingTemplates.list(), apiEntityId: api.entityId }));
    }

    const ok = results.every((r) => r.ok);

    setLastScopeReport({
      ok,
      ranAt: new Date().toISOString(),
      entityId: api.entityId,
      results,
    });

    setBusy(false);
  };

  const StatusPill = ({ ok }) => (
    ok ? (
      <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> PASS</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" /> FAIL</Badge>
    )
  );

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold">Migration Auditor</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Systematically checks multi-tenant migration: route errors + scoped list results.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              entityId: <span className="font-mono">{entityId || "—"}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={runScopeSweep} disabled={busy} variant="outline">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Scope Sweep
            </Button>
            <Button onClick={runRouteSweep} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Route Sweep
            </Button>
          </div>
        </div>

        {/* Scope report */}
        {lastScopeReport && (
          <div className="border rounded-lg p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Scope Sweep <span className="text-xs text-slate-500 ml-2">{lastScopeReport.ranAt}</span>
              </div>
              <StatusPill ok={lastScopeReport.ok} />
            </div>

            <div className="space-y-2">
              {lastScopeReport.results.map((r) => (
                <div key={r.name} className="flex items-start justify-between gap-3 text-sm">
                  <div className="font-mono">{r.name}</div>
                  <div className="text-right">
                    <StatusPill ok={r.ok} />
                    <div className="text-xs text-slate-500 mt-1">{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Route report */}
        {lastRouteReport && (
          <div className="border rounded-lg p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Route Sweep <span className="text-xs text-slate-500 ml-2">{lastRouteReport.ranAt}</span>
              </div>
              <StatusPill ok={lastRouteReport.ok} />
            </div>

            <div className="space-y-2">
              {lastRouteReport.perRoute.map((r) => (
                <div key={r.route} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm">{r.route}</div>
                    <StatusPill ok={r.ok} />
                  </div>

                  <div className="text-xs text-slate-500 mt-2">
                    errors={r.counts.consoleErrors}, window={r.counts.windowErrors}, rejects={r.counts.rejections}, fetchFails={r.counts.fetchFails}
                  </div>

                  {!r.ok && r.topFetchFails?.length > 0 && (
                    <div className="mt-2 text-xs">
                      <div className="font-medium text-slate-700">Top fetch failures:</div>
                      <ul className="list-disc list-inside text-slate-600">
                        {r.topFetchFails.slice(0, 3).map((f, idx) => (
                          <li key={idx}>
                            {f.status} {f.method} {f.url}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-slate-500">
          Tip: keep Route Sweep small at first (6–10 routes). Add more routes once the first set is stable.
        </div>
      </CardContent>
    </Card>
  );
}
