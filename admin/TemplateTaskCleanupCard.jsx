// src/components/admin/TemplateTaskCleanupCard.jsx
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Database, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTenantApi } from "@/components/utils/useTenantApi";
import { toast } from "sonner";

export default function TemplateTaskCleanupCard() {
  const api = useTenantApi();

  const [busy, setBusy] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const runDryRun = async () => {
    setBusy(true);
    setDryRunResult(null);

    try {
      console.log("[TemplateTaskCleanup] Starting dry run...");

      // Fetch duplicate entities directly (not in scopeRegistry)
      const [onboardingDupes, offboardingDupes] = await Promise.all([
        base44.entities.OnboardingTemplateTask.list().catch(() => []),
        base44.entities.OffboardingTemplateTask.list().catch(() => []),
      ]);

      // Fetch canonical entities via tenant-scoped API
      const [onboardingCanonical, offboardingCanonical] = await Promise.all([
        api.onboardingTaskTemplates.list().catch(() => []),
        api.offboardingTaskTemplates.list().catch(() => []),
      ]);

      console.log("[TemplateTaskCleanup] Counts:", {
        onboardingDupes: onboardingDupes.length,
        offboardingDupes: offboardingDupes.length,
        onboardingCanonical: onboardingCanonical.length,
        offboardingCanonical: offboardingCanonical.length,
      });

      // Build uniqueness keys for canonical rows
      const onboardingKeys = new Set(
        onboardingCanonical.map((r) => `${r.template_id}::${r.title}`)
      );
      const offboardingKeys = new Set(
        offboardingCanonical.map((r) => `${r.template_id}::${r.title}`)
      );

      // Compute what would be migrated
      const onboardingMissing = onboardingDupes.filter(
        (r) => !onboardingKeys.has(`${r.template_id}::${r.title}`)
      );
      const offboardingMissing = offboardingDupes.filter(
        (r) => !offboardingKeys.has(`${r.template_id}::${r.title}`)
      );

      setDryRunResult({
        ok: true,
        onboarding: {
          dupes: onboardingDupes.length,
          canonical: onboardingCanonical.length,
          missing: onboardingMissing.length,
        },
        offboarding: {
          dupes: offboardingDupes.length,
          canonical: offboardingCanonical.length,
          missing: offboardingMissing.length,
        },
      });

      toast.success("Dry run complete");
    } catch (err) {
      console.error("[TemplateTaskCleanup] Dry run error:", err);
      setDryRunResult({
        ok: false,
        error: err?.message || String(err),
      });
      toast.error("Dry run failed");
    } finally {
      setBusy(false);
    }
  };

  const runMigration = async () => {
    setBusy(true);
    setShowConfirmDialog(false);

    try {
      console.log("[TemplateTaskCleanup] Starting migration...");

      // Fetch all data
      const [onboardingDupes, offboardingDupes] = await Promise.all([
        base44.entities.OnboardingTemplateTask.list().catch(() => []),
        base44.entities.OffboardingTemplateTask.list().catch(() => []),
      ]);

      const [onboardingCanonical, offboardingCanonical, onboardingTemplates, offboardingTemplates] = await Promise.all([
        api.onboardingTaskTemplates.list().catch(() => []),
        api.offboardingTaskTemplates.list().catch(() => []),
        api.onboardingTemplates.list().catch(() => []),
        api.offboardingTemplates.list().catch(() => []),
      ]);

      // Build maps
      const onboardingKeys = new Set(
        onboardingCanonical.map((r) => `${r.template_id}::${r.title}`)
      );
      const offboardingKeys = new Set(
        offboardingCanonical.map((r) => `${r.template_id}::${r.title}`)
      );

      const onboardingTemplateMap = new Map(
        onboardingTemplates.map((t) => [t.id, t])
      );
      const offboardingTemplateMap = new Map(
        offboardingTemplates.map((t) => [t.id, t])
      );

      let onboardingCopied = 0;
      let offboardingCopied = 0;
      let onboardingMarkedInactive = 0;
      let offboardingMarkedInactive = 0;

      // Migrate onboarding
      for (const dupe of onboardingDupes) {
        const key = `${dupe.template_id}::${dupe.title}`;
        if (onboardingKeys.has(key)) continue;

        const template = onboardingTemplateMap.get(dupe.template_id);
        const entity_id = dupe.entity_id || template?.entity_id || api.entityId;

        if (!entity_id) {
          console.warn("[TemplateTaskCleanup] Skipping onboarding task (no entity_id):", dupe);
          continue;
        }

        await api.onboardingTaskTemplates.create({
          entity_id,
          template_id: dupe.template_id,
          title: dupe.title,
          description: dupe.description || "",
          assignee_role: dupe.assignee_role || dupe.assigned_to || "hr",
          sort_order: dupe.sort_order ?? dupe.order_index ?? 0,
          category: dupe.category || null,
          due_offset_days: dupe.due_offset_days ?? 0,
          is_required: dupe.is_required ?? dupe.required ?? true,
          link_url: dupe.link_url || null,
          system_code: dupe.system_code || null,
          policy_id: dupe.policy_id || null,
        });

        onboardingCopied++;
        onboardingKeys.add(key);

        // Mark inactive if possible
        if (typeof dupe.active !== "undefined") {
          await base44.entities.OnboardingTemplateTask.update(dupe.id, { active: false });
          onboardingMarkedInactive++;
        }
      }

      // Migrate offboarding
      for (const dupe of offboardingDupes) {
        const key = `${dupe.template_id}::${dupe.title}`;
        if (offboardingKeys.has(key)) continue;

        const template = offboardingTemplateMap.get(dupe.template_id);
        const entity_id = dupe.entity_id || template?.entity_id || api.entityId;

        if (!entity_id) {
          console.warn("[TemplateTaskCleanup] Skipping offboarding task (no entity_id):", dupe);
          continue;
        }

        await api.offboardingTaskTemplates.create({
          entity_id,
          template_id: dupe.template_id,
          title: dupe.title,
          description: dupe.description || "",
          assignee_role: dupe.assignee_role || dupe.assigned_to || "hr",
          sort_order: dupe.sort_order ?? dupe.order_index ?? 0,
          category: dupe.category || null,
          due_offset_days: dupe.due_offset_days ?? 0,
          is_required: dupe.is_required ?? dupe.required ?? true,
          link_url: dupe.link_url || null,
          system_code: dupe.system_code || null,
        });

        offboardingCopied++;
        offboardingKeys.add(key);

        // Mark inactive if possible
        if (typeof dupe.active !== "undefined") {
          await base44.entities.OffboardingTemplateTask.update(dupe.id, { active: false });
          offboardingMarkedInactive++;
        }
      }

      console.log("[TemplateTaskCleanup] Migration complete:", {
        onboardingCopied,
        offboardingCopied,
        onboardingMarkedInactive,
        offboardingMarkedInactive,
      });

      toast.success(
        `Migration complete: ${onboardingCopied} onboarding, ${offboardingCopied} offboarding tasks copied`
      );

      // Re-run dry run to show updated state
      setTimeout(() => runDryRun(), 500);
    } catch (err) {
      console.error("[TemplateTaskCleanup] Migration error:", err);
      toast.error(`Migration failed: ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-amber-600" />
                <h3 className="text-lg font-semibold">Template Task Cleanup (Migrate Duplicates)</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Migrate duplicate OnboardingTemplateTask / OffboardingTemplateTask rows to canonical
                OnboardingTaskTemplate / OffboardingTaskTemplate entities.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={runDryRun} disabled={busy} variant="outline">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
                Dry Run
              </Button>
              <Button onClick={() => setShowConfirmDialog(true)} disabled={busy || !dryRunResult?.ok}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                Migrate Now
              </Button>
            </div>
          </div>

          {dryRunResult && (
            <div className="border rounded-lg p-4 bg-white space-y-3">
              {dryRunResult.ok ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm">Dry Run Results</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="font-medium text-slate-700">Onboarding Tasks</div>
                      <div className="space-y-1 text-xs text-slate-600">
                        <div>Duplicate entity rows: <Badge variant="secondary">{dryRunResult.onboarding.dupes}</Badge></div>
                        <div>Canonical entity rows: <Badge variant="secondary">{dryRunResult.onboarding.canonical}</Badge></div>
                        <div>
                          Would migrate:{" "}
                          <Badge className={dryRunResult.onboarding.missing > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}>
                            {dryRunResult.onboarding.missing}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="font-medium text-slate-700">Offboarding Tasks</div>
                      <div className="space-y-1 text-xs text-slate-600">
                        <div>Duplicate entity rows: <Badge variant="secondary">{dryRunResult.offboarding.dupes}</Badge></div>
                        <div>Canonical entity rows: <Badge variant="secondary">{dryRunResult.offboarding.canonical}</Badge></div>
                        <div>
                          Would migrate:{" "}
                          <Badge className={dryRunResult.offboarding.missing > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}>
                            {dryRunResult.offboarding.missing}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(dryRunResult.onboarding.missing > 0 || dryRunResult.offboarding.missing > 0) && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        Missing rows will be copied to canonical entities. Source rows will be marked inactive where possible.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    Dry run failed: {dryRunResult.error}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Migration</DialogTitle>
            <DialogDescription>
              This will copy missing template task rows from duplicate entities to canonical entities.
              Source rows will be marked inactive where possible. This action cannot be easily undone.
            </DialogDescription>
          </DialogHeader>

          {dryRunResult?.ok && (
            <div className="text-sm space-y-2">
              <div>
                • Onboarding tasks to migrate: <strong>{dryRunResult.onboarding.missing}</strong>
              </div>
              <div>
                • Offboarding tasks to migrate: <strong>{dryRunResult.offboarding.missing}</strong>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={runMigration} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Migration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}