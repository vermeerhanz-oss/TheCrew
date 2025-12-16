// src/pages/AdminUtilities.jsx
import React, { useMemo, useState } from "react";
import { useEmployeeContext } from "@/components/utils/EmployeeContext";
import { Card, CardContent } from "@/components/ui/card";
import MigrationAuditorCard from "@/components/admin/MigrationAuditorCard";
import TemplateTaskCleanupCard from "@/components/admin/TemplateTaskCleanupCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertCircleIcon,
  Calendar,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import TenantResetDialog from "@/components/admin/TenantResetDialog";
import ScopeAuditCard from "@/components/admin/ScopeAuditCard";
import {
  runTenantHealthCheck,
  deduplicateDepartments,
} from "@/components/utils/tenantReset";
import { seedLeaveTypesAndPolicies } from "@/components/utils/seedLeaveData";
import { repairLeavePolicyLinkage } from "@/components/utils/repairLeavePolicyLinkage";
import { runCleanupAudit, applyCleanupFixes } from "@/components/utils/tenantCleanup";
import { useTenantApi } from "@/components/utils/useTenantApi";
import { useConfigRefresh } from "@/components/providers/ConfigProvider";
import { SCOPE_REGISTRY, SCOPE } from "@/components/utils/scopeRegistry";
import { toast } from "sonner";
import { isPSMEnabled, setPSMEnabled } from "@/components/utils/psm";
import { discoverScopeFields } from "@/components/utils/scopeDiscovery";

/* ============================================================
   Universal Probe helpers (AdminUtilities-only)
   ============================================================ */

async function getAnyEmployeeIdForTenant(entityId) {
  try {
    const rows = await base44.entities.Employee.filter({ entity_id: entityId }, undefined, 5);
    return rows?.[0]?.id || null;
  } catch {
    return null;
  }
}

async function getAnyLeaveTypeIdForTenant(entityId) {
  try {
    const rows = await base44.entities.LeaveType.filter({ entity_id: entityId }, undefined, 10);
    return rows?.[0]?.id || null;
  } catch {
    return null;
  }
}

function buildProbeOverrides({
  entityName,
  employeeId,
  leaveTypeId,
  templateId,
  instanceId,
  offboardingId,
}) {
  const ts = Date.now();
  const today = new Date().toISOString().split("T")[0];

  if (entityName === "Employee") {
    return {
      first_name: "Probe",
      last_name: "User",
      email: `probe_${ts}@example.com`,
      job_title: "Tester",
    };
  }

  if (entityName === "LeaveType") {
    return { name: `PROBE_LEAVE_TYPE_${ts}`, code: `PROBE_${ts}` };
  }

  if (entityName === "LeavePolicy") {
    return {
      name: `PROBE_LEAVE_POLICY_${ts}`,
      code: `PROBE_POLICY_${ts}`,
      leave_type: "annual",
      is_active: true,
      accrual_rate: 4,
      accrual_unit: "weeks_per_year",
      standard_hours_per_day: 7.6,
      ...(leaveTypeId ? { leave_type_id: leaveTypeId } : {}),
    };
  }

  if (entityName === "LeaveBalance") {
    return {
      ...(employeeId ? { employee_id: employeeId } : {}),
      leave_type: "annual",
      available_hours: 0,
      version: 0,
    };
  }

  if (entityName === "LeaveRequest") {
    return {
      ...(employeeId ? { employee_id: employeeId } : {}),
      ...(leaveTypeId ? { leave_type_id: leaveTypeId } : {}),
      start_date: today,
      end_date: today,
      total_days: 1,
      status: "pending",
    };
  }

  if (entityName === "Document") {
    return {
      ...(employeeId ? { uploaded_by_id: employeeId } : {}),
      file_url: "https://example.com/probe.pdf",
      file_name: `PROBE_${ts}.pdf`,
    };
  }

  if (entityName === "OnboardingTemplate") {
    return { name: `PROBE_ONBOARDING_TEMPLATE_${ts}` };
  }

  if (entityName === "OnboardingTemplateTask") {
    return {
      ...(templateId ? { template_id: templateId } : {}),
      title: `PROBE_TASK_${ts}`,
      assignee_role: "hr",
      description: `Probe task for ${entityName}`,
    };
  }

  if (entityName === "OnboardingInstance") {
    return {
      ...(employeeId ? { employee_id: employeeId } : {}),
      ...(templateId ? { template_id: templateId } : {}),
      start_date: today,
      status: "pending",
    };
  }

  if (entityName === "EmployeeOnboarding") {
    return {
      ...(employeeId ? { employee_id: employeeId } : {}),
      ...(templateId ? { template_id: templateId } : {}),
      start_date: today,
      status: "in_progress",
    };
  }

  if (entityName === "EmployeeOnboardingTask") {
    return {
      ...(instanceId ? { onboarding_id: instanceId } : {}),
      title: `PROBE_TASK_${ts}`,
      assigned_to_role: "hr",
      due_date: today,
      status: "not_started",
    };
  }

  if (entityName === "OnboardingTask") {
    return {
      ...(instanceId ? { instance_id: instanceId } : {}),
      task_name: `PROBE_TASK_${ts}`,
      assigned_to_role: "HR",
      due_date: today,
      status: "not_started",
    };
  }

  if (entityName === "EmployeeOffboarding") {
    return {
      ...(employeeId ? { employee_id: employeeId } : {}),
      last_day: today,
      exit_type: "voluntary",
      status: "not_started",
    };
  }

  if (entityName === "EmployeeOffboardingTask") {
    return {
      ...(offboardingId ? { offboarding_id: offboardingId } : {}),
      title: `PROBE_OFFBOARD_TASK_${ts}`,
      assignee_type: "hr",
      assigned_to_role: "hr",
      status: "not_started",
    };
  }

  if (entityName === "DocumentTemplate") {
    return { name: `PROBE_DOC_${ts}`, category: "general" };
  }

  if (entityName === "CompanySettings") {
    return { key: `__probe_key_${ts}__`, value: "__probe_value__" };
  }

  return {};
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

/**
 * Detect which scope field actually works for filtering.
 * Some entities (like task children) may require a baseFilter (e.g., parent id).
 */
async function detectWorkingScopeField(Entity, probeId, tenantId, candidates, baseFilter = {}) {
  for (const field of candidates) {
    try {
      const rows = await Entity.filter({ ...baseFilter, [field]: tenantId }).catch(() => []);
      if (rows.some((r) => r.id === probeId)) return field;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Special: OnboardingInstance requires template_id.
 * Create Template -> Instance -> detect working scope -> cleanup.
 */
async function probeOnboardingInstance(
  InstanceEntity,
  entityName,
  scopeField,
  tenantId,
  employeeId,
  results
) {
  let templateId = null;
  let instanceId = null;

  try {
    const ts = Date.now();
    const today = new Date().toISOString().split("T")[0];

    const TemplateEntity = base44.entities.OnboardingTemplate;
    const template = await TemplateEntity.create({
      name: `__PROBE_TEMPLATE_${ts}__`,
      entity_id: tenantId,
      company_entity_id: tenantId,
      tenant_id: tenantId,
    });
    templateId = template.id;

    const payload = {
      employee_id: employeeId,
      template_id: templateId,
      start_date: today,
      status: "pending",
      entity_id: tenantId,
      company_entity_id: tenantId,
      tenant_id: tenantId,
    };

    const created = await InstanceEntity.create(payload);
    instanceId = created?.id;

    if (!instanceId) {
      results.push({ entity: entityName, status: "FAIL", reason: "Create returned no ID" });
      return;
    }

    const scopeCandidates = uniq([scopeField, "entity_id", "company_entity_id", "tenant_id"]);
    const workingScopeField = await detectWorkingScopeField(
      InstanceEntity,
      instanceId,
      tenantId,
      scopeCandidates
    );

    const fetched = await InstanceEntity.get(instanceId);
    const persistedScope = workingScopeField ? fetched?.[workingScopeField] ?? null : null;

    let wrongScopeHidden = true;
    if (workingScopeField) {
      const wrongRows = await InstanceEntity.filter({
        [workingScopeField]: `WRONG_${tenantId}`,
      }).catch(() => []);
      wrongScopeHidden = !wrongRows.some((r) => r.id === instanceId);
    }

    await InstanceEntity.delete(instanceId).catch(() => {});
    await TemplateEntity.delete(templateId).catch(() => {});

    const issues = [];
    if (!workingScopeField) issues.push("noWorkingScopeField");
    if (workingScopeField && persistedScope !== tenantId) {
      issues.push(`persistedScope(${workingScopeField})=${persistedScope || "null"}`);
    }
    if (!wrongScopeHidden) issues.push("wrongScopeVisible");

    results.push({
      entity: entityName,
      scopedFound: Boolean(workingScopeField),
      wrongScopeHidden,
      status: issues.length === 0 ? "PASS" : "FAIL",
      reason: issues.length
        ? `${issues.join(", ")} (workingScope=${workingScopeField || "NONE"})`
        : "",
    });
  } catch (err) {
    results.push({
      entity: entityName,
      status: "FAIL",
      reason: err?.message || "Unknown error",
    });
  } finally {
    if (instanceId) await InstanceEntity.delete(instanceId).catch(() => {});
    if (templateId) await base44.entities.OnboardingTemplate.delete(templateId).catch(() => {});
  }
}

export default function AdminUtilities() {
  const ctx = useEmployeeContext();
  const api = useTenantApi();
  const refreshConfig = useConfigRefresh();

  const [psmVersion, setPsmVersion] = useState(0);
  const PSM = useMemo(() => isPSMEnabled(), [psmVersion]);
  const isProd = process.env.NODE_ENV === "production";

  const [isDiscoveringScope, setIsDiscoveringScope] = useState(false);
  const [scopeDiscoveryResult, setScopeDiscoveryResult] = useState(null);
  const [scopeDiscoveryError, setScopeDiscoveryError] = useState(null);

  if (!ctx) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const tenantId = ctx?.tenantId;
  const isOwner = ctx?.role === "owner" || ctx?.role === "admin";

  if (!isOwner && isProd) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <Shield className="h-10 w-10 mx-auto mb-4 text-gray-300" />
            <p>You do not have permission to access Admin Utilities.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ============================================================
     State
     ============================================================ */

  const [showConfirm, setShowConfirm] = useState(false);
  const [isRunningBackfill, setIsRunningBackfill] = useState(false);
  const [log, setLog] = useState([]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetLog, setResetLog] = useState([]);

  const [showTenantReset, setShowTenantReset] = useState(false);

  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState(null);

  const [leaveDataDiag, setLeaveDataDiag] = useState(null);
  const [isLoadingLeaveDiag, setIsLoadingLeaveDiag] = useState(false);
  const [isSeedingLeave, setIsSeedingLeave] = useState(false);
  const [repairResult, setRepairResult] = useState(null);

  const [isDumpingSchema, setIsDumpingSchema] = useState(false);
  const [schemaResult, setSchemaResult] = useState(null);

  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);

  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  const [isUniversalProbing, setIsUniversalProbing] = useState(false);
  const [universalProbeResult, setUniversalProbeResult] = useState(null);

  const canRunBackfill = Boolean(tenantId) && isOwner;
  const canRunReset = isOwner;

  const entitiesToProbe = useMemo(
    () => SCOPE_REGISTRY.filter((e) => e.scope === SCOPE.ENTITY),
    []
  );

  /* ============================================================
     Helpers
     ============================================================ */

  const appendLog = (msg) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log("[AdminUtilities]", line);
    setLog((prev) => [...prev, line]);
  };

  const appendResetLog = (msg) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log("[AdminUtilities:Reset]", line);
    setResetLog((prev) => [...prev, line]);
  };

  const blockIfPSM = (actionLabel) => {
    if (!PSM) return false;
    toast.error(`Blocked by Production Safety Mode: ${actionLabel}`);
    return true;
  };

  async function batchUpdate(entity, records, transform) {
    const BATCH_SIZE = 25;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((rec) => entity.update(rec.id, transform(rec))));
      appendLog(`Updated ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
    }
  }

  async function batchDelete(entity, records, appendFn) {
    const BATCH_SIZE = 25;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((rec) => entity.delete(rec.id)));
      appendFn(`Deleted ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
    }
  }

  const getStatusIcon = (status) => {
    if (status === "PASS") return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (status === "WARN") return <AlertCircleIcon className="h-5 w-5 text-yellow-600" />;
    if (status === "FAIL") return <XCircle className="h-5 w-5 text-red-600" />;
    return null;
  };

  /* ============================================================
     Actions
     ============================================================ */

  const runHealthCheck = async () => {
    if (!tenantId) return toast.error("No tenant ID found");

    setIsRunningHealthCheck(true);
    setHealthCheckResult(null);

    try {
      const result = await runTenantHealthCheck(tenantId);
      setHealthCheckResult(result);

      if (result.status === "PASS") toast.success("Health check passed!");
      else if (result.status === "WARN") toast.warning("Health check passed with warnings");
      else toast.error("Health check failed");
    } catch (error) {
      console.error("[AdminUtilities] Health check error:", error);
      toast.error(`Health check failed: ${error?.message || "Unknown error"}`);
    } finally {
      setIsRunningHealthCheck(false);
    }
  };

  const handleDeduplicateDepartments = async () => {
    if (!tenantId) return toast.error("No tenant ID found");

    try {
      toast.info("Deduplicating departments...");
      const result = await deduplicateDepartments(tenantId, false);

      if (result.duplicatesFound > 0) {
        toast.success(`Deduplicated ${result.recordsDeleted} department records`);
        await runHealthCheck();
      } else {
        toast.info("No duplicates found");
      }
    } catch (error) {
      console.error("[AdminUtilities] Deduplication error:", error);
      toast.error(`Deduplication failed: ${error?.message || "Unknown error"}`);
    }
  };

  const runBackfill = async () => {
    if (blockIfPSM("Tenant Backfill")) return;

    if (!tenantId) {
      appendLog("❌ No tenantId in context. Aborting.");
      return;
    }

    setShowConfirm(false);
    setIsRunningBackfill(true);
    setLog([]);

    appendLog(`Starting FULL tenant backfill for tenant: ${tenantId}`);
    appendLog("This may take a minute…");

    const raw = base44.entities;

    const GLOBAL_ENTITIES = [
      raw.Employee,
      raw.Department,
      raw.Location,
      raw.LeaveType,
      raw.LeaveRequest,
      raw.LeaveApproval,
      raw.EmployeeLeaveBalance,
      raw.OnboardingTemplate,
      raw.OnboardingInstance,
      raw.OnboardingTask,
      raw.OffboardingTemplate,
      raw.OffboardingTaskTemplate,
      raw.EmployeeOffboarding,
      raw.Document,
      raw.Policy,
      raw.PolicyAcknowledgement,
    ];

    try {
      for (const entity of GLOBAL_ENTITIES) {
        if (!entity) continue;

        const name = entity.__typename || "Entity";
        appendLog("");
        appendLog(`Processing ${name}…`);

        const records = await entity.list({}, undefined, 5000);
        appendLog(`Found ${records.length} records`);

        if (!records.length) {
          appendLog(`Skipping ${name} — no records.`);
          continue;
        }

        await batchUpdate(entity, records, (record) => {
          const payload = {};
          if ("entity_id" in record) payload.entity_id = tenantId;
          if ("company_entity_id" in record) payload.company_entity_id = tenantId;
          if ("tenant_id" in record) payload.tenant_id = tenantId;
          return payload;
        });

        appendLog(`✔ Finished ${name}`);
      }

      appendLog("");
      appendLog("🎉 Backfill complete. All matching records updated.");
      toast.success("Backfill complete");
    } catch (err) {
      console.error("[AdminUtilities] Error during backfill", err);
      appendLog(`❌ Error: ${err?.message || "Unknown error"}`);
      toast.error(`Backfill failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsRunningBackfill(false);
    }
  };

  const runCleanReset = async () => {
    if (blockIfPSM("Clean Reset (Delete All Data)")) return;

    setShowResetConfirm(false);
    setIsResetting(true);
    setResetLog([]);

    appendResetLog("Starting CLEAN RESET of all tenant-scoped & setup data");
    appendResetLog("⚠️ This will delete ALL business + company records created by setup.");
    appendResetLog("");

    const raw = base44.entities;

    const BUSINESS_ENTITIES = [
      raw.LeaveRequest,
      raw.LeaveApproval,
      raw.EmployeeLeaveBalance,
      raw.OnboardingInstance,
      raw.OnboardingTask,
      raw.EmployeeOffboarding,
      raw.OffboardingTask,
      raw.OffboardingTaskTemplate,
      raw.Document,
      raw.PolicyAcknowledgement,

      raw.OnboardingTemplate,
      raw.OffboardingTemplate,
      raw.LeaveType,
      raw.Policy,

      raw.Employee,
      raw.Department,
      raw.Location,

      raw.CompanySettings,
      raw.CompanyEntity,
      raw.Company,
    ];

    try {
      for (const entity of BUSINESS_ENTITIES) {
        if (!entity) continue;

        const name = entity.__typename || "Entity";
        appendResetLog("");
        appendResetLog(`Processing ${name}…`);

        try {
          const records = await entity.list({}, undefined, 5000);
          appendResetLog(`Found ${records.length} records`);

          if (!records.length) {
            appendResetLog(`Skipping ${name} — no records.`);
            continue;
          }

          await batchDelete(entity, records, appendResetLog);
          appendResetLog(`✔ Deleted all ${name} records`);
        } catch (err) {
          appendResetLog(`⚠️ Error processing ${name}: ${err?.message || "Unknown error"}`);
        }
      }

      appendResetLog("");
      appendResetLog("🎉 Clean reset complete. Users/auth preserved.");
      toast.success("Clean reset complete");
    } catch (err) {
      console.error("[AdminUtilities] Error during reset", err);
      appendResetLog(`❌ Error: ${err?.message || "Unknown error"}`);
      toast.error(`Reset failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsResetting(false);
    }
  };

  const loadLeaveDiagnostic = async () => {
    if (!api) return toast.error("API not ready yet (scope still loading).");
    if (!tenantId) return toast.error("No tenant ID found");

    setIsLoadingLeaveDiag(true);
    try {
      const safeList = async (collection) => {
        if (!collection?.list) return [];
        try {
          return (await collection.list()) || [];
        } catch (e) {
          console.warn("[LeaveDiagnostic] list failed:", e);
          return [];
        }
      };

      const [types, policies, balances] = await Promise.all([
        safeList(api.leaveTypes ?? api.leaveType),
        safeList(api.leavePolicies ?? api.leavePolicy),
        safeList(api.leaveBalances ?? api.leaveBalance),
      ]);

      setLeaveDataDiag({
        leaveTypes: types,
        leavePolicies: policies,
        leaveBalances: balances,
      });
    } catch (err) {
      console.error("[AdminUtilities] Leave diagnostic error:", err);
      toast.error("Failed to load leave diagnostic");
    } finally {
      setIsLoadingLeaveDiag(false);
    }
  };

  const handleSeedLeaveData = async () => {
    if (!api) return toast.error("API not ready yet (scope still loading).");
    if (!tenantId) return toast.error("No tenant ID found");

    setIsSeedingLeave(true);
    setRepairResult(null);

    try {
      toast.info("Seeding/repairing leave data...");

      const safeList = async (collection) => {
        if (!collection?.list) return [];
        try {
          return (await collection.list()) || [];
        } catch {
          return [];
        }
      };

      const policiesBefore = await safeList(api.leavePolicies ?? api.leavePolicy);
      const seedResult = await seedLeaveTypesAndPolicies(tenantId);
      const policiesAfter = await safeList(api.leavePolicies ?? api.leavePolicy);
      const actuallyCreated = policiesAfter.length - policiesBefore.length;

      const repair = await repairLeavePolicyLinkage(api);
      const policiesFinal = await safeList(api.leavePolicies ?? api.leavePolicy);

      const combinedResult = {
        createdLeaveTypes: seedResult?.leaveTypes?.created ?? 0,
        createdLeavePolicies: Math.max(0, actuallyCreated),
        totalPolicies: repair?.totalPolicies ?? 0,
        repairedPolicies: repair?.repairedCount ?? 0,
        stillMissingCount: repair?.stillMissingCount ?? 0,
        errors: repair?.errors ?? [],
        samplePolicies: policiesFinal.slice(0, 5).map((p) => ({
          name: p.name,
          leave_type_id: p.leave_type_id ? `${String(p.leave_type_id).slice(0, 8)}...` : "MISSING",
          isActive: p.is_active,
        })),
      };

      setRepairResult(combinedResult);

      toast.success("Leave repair complete");
      await refreshConfig();
      await loadLeaveDiagnostic();
    } catch (err) {
      console.error("[LeaveRepair] Repair error:", err);
      toast.error(`Repair failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSeedingLeave(false);
    }
  };

  const handleDumpLeavePolicySchema = async () => {
    if (!tenantId) return toast.error("No tenant ID found");

    setIsDumpingSchema(true);
    setSchemaResult(null);

    try {
      const RawLeavePolicy = base44.entities.LeavePolicy;
      const RawLeaveType = base44.entities.LeaveType;
      const timestamp = Date.now();

      const leaveTypes = await RawLeaveType.filter({ entity_id: tenantId }).catch(() => []);
      const annual =
        leaveTypes.find((t) => String(t.code || "").toUpperCase() === "ANNUAL") || leaveTypes[0];

      if (!annual) {
        toast.error("No leave types found - run Seed/Repair first");
        return;
      }

      const testPayload = {
        name: `SCHEMA_TEST_${timestamp}`,
        code: `TEST_${timestamp}`,
        leave_type: "annual",
        accrual_rate: 4,
        accrual_unit: "weeks_per_year",
        is_active: true,
        entity_id: tenantId,
        leave_type_id: annual.id,
      };

      const created = await RawLeavePolicy.create(testPayload);
      const fetched = await RawLeavePolicy.get(created.id);

      const relevantFields = {
        entity_id: fetched?.entity_id,
        company_entity_id: fetched?.company_entity_id,
        tenantId: fetched?.tenantId,
        tenant_id: fetched?.tenant_id,
        leave_type_id: fetched?.leave_type_id,
        leave_type: fetched?.leave_type,
      };

      await RawLeavePolicy.delete(created.id).catch(() => {});

      setSchemaResult({
        allFields: Object.keys(fetched || {}).sort(),
        relevantFields,
        fullRecord: fetched,
      });

      toast.success("Schema dump complete");
    } catch (err) {
      console.error("[SchemaDump] Error:", err);
      toast.error(`Schema dump failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsDumpingSchema(false);
    }
  };

  const handleProbeLeavePolicyScope = async () => {
    if (!api) return toast.error("API not ready yet (scope still loading).");
    if (!tenantId) return toast.error("No tenant ID found");

    setIsProbing(true);
    setProbeResult(null);

    try {
      const RawLeavePolicy = base44.entities.LeavePolicy;
      const RawLeaveType = base44.entities.LeaveType;
      const timestamp = Date.now();

      const scopedTypes = await api.leaveTypes?.list?.().catch(() => []);
      const unscopedTypes = await RawLeaveType.filter({ entity_id: tenantId }).catch(() => []);
      const leaveTypes = scopedTypes?.length ? scopedTypes : unscopedTypes;

      if (!leaveTypes.length) {
        toast.error("No leave types found - run Seed/Repair first");
        setProbeResult({ error: "No leave types found" });
        return;
      }

      const annual =
        leaveTypes.find((t) => String(t.code || "").toUpperCase() === "ANNUAL") || leaveTypes[0];

      const probePayload = {
        name: `DEBUG_SCOPE_PROBE_${timestamp}`,
        code: `DEBUG_SCOPE_${timestamp}`,
        leave_type: "annual",
        accrual_rate: 4,
        accrual_unit: "weeks_per_year",
        is_active: true,
        standard_hours_per_day: 7.6,
        entity_id: tenantId,
        leave_type_id: annual.id,
      };

      const created = await RawLeavePolicy.create(probePayload);
      const fetched = await RawLeavePolicy.get(created.id);

      const queries = [
        { label: "entity_id", filter: { entity_id: tenantId } },
        { label: "tenant_id", filter: { tenant_id: tenantId } },
        { label: "company_entity_id", filter: { company_entity_id: tenantId } },
      ];

      const queryResults = [];
      for (const q of queries) {
        try {
          const rows = await RawLeavePolicy.filter(q.filter);
          queryResults.push({
            label: q.label,
            count: rows.length,
            hasProbe: rows.some((p) => p.id === created.id),
          });
        } catch (e) {
          queryResults.push({ label: q.label, count: 0, hasProbe: false, error: e.message });
        }
      }

      await RawLeavePolicy.delete(created.id).catch(() => {});

      const working = queryResults.find((r) => r.hasProbe)?.label || "NONE";
      setProbeResult({
        createdId: created.id,
        persisted: {
          entity_id: fetched?.entity_id,
          company_entity_id: fetched?.company_entity_id,
          tenant_id: fetched?.tenant_id,
        },
        queryResults,
        recommendedField: working,
      });

      if (working !== "NONE") toast.success(`Probe complete: recommend "${working}"`);
      else toast.error("Probe complete: no working scope field found");
    } catch (err) {
      console.error("[Probe] Error:", err);
      toast.error(`Probe failed: ${err?.message || "Unknown error"}`);
      setProbeResult({ error: err?.message || "Unknown error" });
    } finally {
      setIsProbing(false);
    }
  };

  const handleRunCleanupAudit = async () => {
    if (!api) return toast.error("API not ready yet (scope still loading).");
    if (!tenantId) return toast.error("No tenant ID found");

    setIsAuditing(true);
    setAuditResult(null);
    setApplyResult(null);

    try {
      const result = await runCleanupAudit(api, tenantId);
      setAuditResult(result);
      if (result.totalIssues === 0) toast.success("Audit complete - no issues found!");
      else toast.info(`Audit complete - found ${result.totalIssues} issue(s)`);
    } catch (err) {
      console.error("[AdminUtilities] Cleanup audit error:", err);
      toast.error(`Audit failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleApplyCleanupFixes = async () => {
    if (blockIfPSM("Apply Cleanup Fixes")) return;

    if (!api) return toast.error("API not ready yet (scope still loading).");
    if (!auditResult) return toast.error("Run audit first");

    setShowApplyConfirm(false);
    setIsApplying(true);
    setApplyResult(null);

    try {
      const result = await applyCleanupFixes(api, tenantId, auditResult);
      setApplyResult(result);

      await refreshConfig();
      toast.success("Cleanup applied - refreshing audit...");
      setTimeout(() => handleRunCleanupAudit(), 800);
    } catch (err) {
      console.error("[AdminUtilities] Cleanup apply error:", err);
      toast.error(`Apply failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsApplying(false);
    }
  };

  const exportAuditReport = () => {
    if (!auditResult) return toast.error("No audit result to export");

    const report = {
      timestamp: new Date().toISOString(),
      entityId: tenantId,
      audit: auditResult,
      apply: applyResult,
    };

    console.log("[AdminUtilities] Audit Report:", report);

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tenant-cleanup-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Report downloaded");
  };

  /**
   * Universal Probe:
   * Create -> GET -> detect working scope field -> scoped filter -> wrong scope filter -> delete
   */
  const runUniversalProbe = async () => {
    if (!tenantId) return toast.error("Context not ready - no tenant ID");

    setIsUniversalProbing(true);
    setUniversalProbeResult(null);

    const results = [];

    try {
      const employeeId = await getAnyEmployeeIdForTenant(tenantId);
      const leaveTypeId = await getAnyLeaveTypeIdForTenant(tenantId);

      // ✅ Create probe template for dependent entities
      let probeTemplateId = null;
      let probeOnboardingInstanceId = null;

      try {
        const OnboardingTemplateEntity = base44.entities.OnboardingTemplate;
        const probeTemplate = await OnboardingTemplateEntity.create({
          name: `__UNIVERSAL_PROBE_TEMPLATE_${Date.now()}__`,
          entity_id: tenantId,
        });
        probeTemplateId = probeTemplate.id;

        if (employeeId && probeTemplateId) {
          const EmployeeOnboardingEntity = base44.entities.EmployeeOnboarding;
          const probeInstance = await EmployeeOnboardingEntity.create({
            employee_id: employeeId,
            template_id: probeTemplateId,
            start_date: new Date().toISOString().split("T")[0],
            status: "in_progress",
            entity_id: tenantId,
          });
          probeOnboardingInstanceId = probeInstance.id;
        }
      } catch (err) {
        console.warn("[UniversalProbe] Failed to create probe dependencies:", err);
      }

      for (const entry of entitiesToProbe) {
        const { entityName, scopeField, uniqueKeys = [] } = entry;
        const Entity = base44.entities?.[entityName];

        if (!Entity) {
          results.push({
            entity: entityName,
            status: "FAIL",
            reason: "Entity not found in base44.entities",
          });
          continue;
        }

        const requiresEmployee = [
          "LeaveBalance",
          "LeaveRequest",
          "Document",
          "OnboardingInstance",
          "EmployeeOffboarding",
        ];

        if (requiresEmployee.includes(entityName) && !employeeId) {
          results.push({
            entity: entityName,
            status: "FAIL",
            reason: `No employee exists for this tenant (${entityName} requires employee_id)`,
          });
          continue;
        }

        if (entityName === "LeaveRequest" && !leaveTypeId) {
          results.push({
            entity: entityName,
            status: "FAIL",
            reason: "No leave type exists for this tenant (LeaveRequest requires leave_type_id)",
          });
          continue;
        }

        // Dependent entity special-cases
        if (entityName === "OnboardingTask") {
          await probeOnboardingTask(Entity, entityName, scopeField, tenantId, employeeId, results);
          continue;
        }

        if (entityName === "EmployeeOffboardingTask") {
          await probeOffboardingTask(Entity, entityName, scopeField, tenantId, employeeId, results);
          continue;
        }

        if (entityName === "OnboardingInstance") {
          await probeOnboardingInstance(Entity, entityName, scopeField, tenantId, employeeId, results);
          continue;
        }

        // Standard probe
        let probeId = null;

        try {
          const ts = Date.now();
          const markerField =
            uniqueKeys.includes("code")
              ? "code"
              : uniqueKeys.includes("key")
              ? "key"
              : "name";

          const markerValue =
            markerField === "code"
              ? `__PROBE_${ts}__`
              : markerField === "key"
              ? `__probe_key_${ts}__`
              : `__PROBE_${ts}__`;

          const overrides = buildProbeOverrides({
            entityName,
            employeeId,
            leaveTypeId,
            templateId: probeTemplateId,
            instanceId: probeOnboardingInstanceId,
            offboardingId: null,
          });

          const scopeCandidates = uniq([scopeField, "entity_id", "company_entity_id", "tenant_id"]);

          const probePayload = {
            [markerField]: markerValue,
            ...scopeCandidates.reduce((acc, f) => ({ ...acc, [f]: tenantId }), {}),
            ...overrides,
          };

          const created = await Entity.create(probePayload);
          probeId = created?.id;

          if (!probeId) {
            results.push({ entity: entityName, status: "FAIL", reason: "Create returned no ID" });
            continue;
          }

          const fetched = await Entity.get(probeId);

          const workingScopeField = await detectWorkingScopeField(
            Entity,
            probeId,
            tenantId,
            scopeCandidates
          );

          let scopedFound = false;
          let wrongScopeHidden = true;
          let persistedScope = null;

          if (workingScopeField) {
            scopedFound = true;
            persistedScope = fetched?.[workingScopeField] ?? null;

            const wrongRows = await Entity.filter({
              [workingScopeField]: `WRONG_${tenantId}`,
            }).catch(() => []);
            wrongScopeHidden = !wrongRows.some((r) => r.id === probeId);
          }

          await Entity.delete(probeId).catch(() => {});

          const issues = [];
          if (!workingScopeField) issues.push("noWorkingScopeField");
          if (workingScopeField && persistedScope !== tenantId) {
            issues.push(`persistedScope(${workingScopeField})=${persistedScope || "null"}`);
          }
          if (!scopedFound) issues.push("scopedNotFound");
          if (!wrongScopeHidden) issues.push("wrongScopeVisible");

          const ok = issues.length === 0;

          results.push({
            entity: entityName,
            scopedFound,
            wrongScopeHidden,
            status: ok ? "PASS" : "FAIL",
            reason: ok
              ? ""
              : `${issues.join(", ")}${
                  workingScopeField ? ` (workingScope=${workingScopeField})` : ""
                }`,
          });
        } catch (err) {
          if (probeId) {
            try {
              await Entity.delete(probeId);
            } catch {}
          }
          results.push({
            entity: entityName,
            status: "FAIL",
            reason: err?.message || "Unknown error",
          });
        }
      }

      const totalPassed = results.filter((r) => r.status === "PASS").length;
      const totalFailed = results.filter((r) => r.status === "FAIL").length;

      setUniversalProbeResult({
        timestamp: new Date().toISOString(),
        activeEntityId: tenantId,
        results,
        totalPassed,
        totalFailed,
      });

      if (totalFailed === 0) toast.success(`Universal probe: ${totalPassed}/${results.length} passed`);
      else toast.warning(`Universal probe: ${totalPassed}/${results.length} passed, ${totalFailed} failed`);
    } catch (err) {
      toast.error(`Universal probe failed: ${err?.message || "Unknown error"}`);
      setUniversalProbeResult({ error: err?.message || "Unknown error", results });
    } finally {
      setIsUniversalProbing(false);

      // ✅ Cleanup probe dependencies
      if (probeOnboardingInstanceId) {
        try {
          await base44.entities.EmployeeOnboarding.delete(probeOnboardingInstanceId);
        } catch {}
      }
      if (probeTemplateId) {
        try {
          await base44.entities.OnboardingTemplate.delete(probeTemplateId);
        } catch {}
      }
    }
  };

  // Helper: Probe OnboardingTask (requires parent template + instance)
  async function probeOnboardingTask(TaskEntity, entityName, scopeField, tenantId, employeeId, results) {
    let templateId = null;
    let instanceId = null;
    let taskId = null;

    try {
      const ts = Date.now();
      const today = new Date().toISOString().split("T")[0];

      const TemplateEntity = base44.entities.OnboardingTemplate;

      const template = await TemplateEntity.create({
        name: `__PROBE_TEMPLATE_${ts}__`,
        entity_id: tenantId,
        company_entity_id: tenantId,
        tenant_id: tenantId,
      });
      templateId = template.id;

      const InstanceEntity = base44.entities.OnboardingInstance;
      const instance = await InstanceEntity.create({
        employee_id: employeeId,
        template_id: templateId,
        start_date: today,
        status: "pending",
        entity_id: tenantId,
        company_entity_id: tenantId,
        tenant_id: tenantId,
      });
      instanceId = instance.id;

      const task = await TaskEntity.create({
        instance_id: instanceId,
        task_name: `__PROBE_TASK_${ts}__`,
        assigned_to_role: "HR",
        due_date: today,
        status: "not_started",
        entity_id: tenantId,
        company_entity_id: tenantId,
        tenant_id: tenantId,
      });
      taskId = task.id;

      const scopeCandidates = uniq([scopeField, "entity_id", "company_entity_id", "tenant_id"]);
      const workingScopeField = await detectWorkingScopeField(
        TaskEntity,
        taskId,
        tenantId,
        scopeCandidates
      );

      const fetched = await TaskEntity.get(taskId);
      const persistedScope = workingScopeField ? fetched?.[workingScopeField] ?? null : null;

      let wrongScopeHidden = true;
      if (workingScopeField) {
        const wrongRows = await TaskEntity.filter({
          [workingScopeField]: `WRONG_${tenantId}`,
        }).catch(() => []);
        wrongScopeHidden = !wrongRows.some((r) => r.id === taskId);
      }

      const issues = [];
      if (!workingScopeField) issues.push("noWorkingScopeField");
      if (workingScopeField && persistedScope !== tenantId) {
        issues.push(`persistedScope(${workingScopeField})=${persistedScope || "null"}`);
      }
      if (!wrongScopeHidden) issues.push("wrongScopeVisible");

      results.push({
        entity: entityName,
        scopedFound: Boolean(workingScopeField),
        wrongScopeHidden,
        status: issues.length === 0 ? "PASS" : "FAIL",
        reason: issues.length
          ? `${issues.join(", ")} (workingScope=${workingScopeField || "NONE"})`
          : "",
      });
    } catch (err) {
      results.push({ entity: entityName, status: "FAIL", reason: err?.message || "Unknown error" });
    } finally {
      if (taskId) await TaskEntity.delete(taskId).catch(() => {});
      if (instanceId) await base44.entities.OnboardingInstance.delete(instanceId).catch(() => {});
      if (templateId) await base44.entities.OnboardingTemplate.delete(templateId).catch(() => {});
    }
  }

  // Helper: Probe EmployeeOffboardingTask (requires parent offboarding)
  async function probeOffboardingTask(TaskEntity, entityName, scopeField, tenantId, employeeId, results) {
    let offboardingId = null;
    let taskId = null;

    try {
      const ts = Date.now();
      const today = new Date().toISOString().split("T")[0];

      const OffboardingEntity = base44.entities.EmployeeOffboarding;
      const offboarding = await OffboardingEntity.create({
        employee_id: employeeId,
        last_day: today,
        exit_type: "voluntary",
        status: "not_started",
        entity_id: tenantId,
        company_entity_id: tenantId,
        tenant_id: tenantId,
      });
      offboardingId = offboarding.id;

      const task = await TaskEntity.create({
        offboarding_id: offboardingId,
        title: `__PROBE_OFFBOARD_TASK_${ts}__`,
        assignee_type: "hr",
        assigned_to_role: "hr",
        status: "not_started",
        entity_id: tenantId,
        company_entity_id: tenantId,
        tenant_id: tenantId,
      });
      taskId = task.id;

      const scopeCandidates = uniq([scopeField, "entity_id", "company_entity_id", "tenant_id"]);

      // IMPORTANT: tasks often require parent id to be queryable
      const workingScopeField = await detectWorkingScopeField(
        TaskEntity,
        taskId,
        tenantId,
        scopeCandidates,
        { offboarding_id: offboardingId }
      );

      const fetched = await TaskEntity.get(taskId);
      const persistedScope = workingScopeField ? fetched?.[workingScopeField] ?? null : null;

      let wrongScopeHidden = true;
      if (workingScopeField) {
        const wrongRows = await TaskEntity.filter({
          offboarding_id: offboardingId,
          [workingScopeField]: `WRONG_${tenantId}`,
        }).catch(() => []);
        wrongScopeHidden = !wrongRows.some((r) => r.id === taskId);
      }

      const issues = [];
      if (!workingScopeField) issues.push("noWorkingScopeField");
      if (workingScopeField && persistedScope !== tenantId) {
        issues.push(`persistedScope(${workingScopeField})=${persistedScope || "null"}`);
      }
      if (!wrongScopeHidden) issues.push("wrongScopeVisible");

      results.push({
        entity: entityName,
        scopedFound: Boolean(workingScopeField),
        wrongScopeHidden,
        status: issues.length === 0 ? "PASS" : "FAIL",
        reason: issues.length
          ? `${issues.join(", ")} (workingScope=${workingScopeField || "NONE"})`
          : "",
      });
    } catch (err) {
      results.push({ entity: entityName, status: "FAIL", reason: err?.message || "Unknown error" });
    } finally {
      if (taskId) await TaskEntity.delete(taskId).catch(() => {});
      if (offboardingId) await base44.entities.EmployeeOffboarding.delete(offboardingId).catch(() => {});
    }
  }

  const copyProbeResultsToClipboard = () => {
    if (!universalProbeResult) return toast.error("No results to copy");

    const report = {
      timestamp: universalProbeResult.timestamp,
      activeEntityId: universalProbeResult.activeEntityId,
      summary: {
        totalPassed: universalProbeResult.totalPassed,
        totalFailed: universalProbeResult.totalFailed,
      },
      results: universalProbeResult.results,
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast.success("Probe results copied");
  };

  const togglePSMDev = () => {
    if (isProd) return;
    const next = setPSMEnabled(!PSM);
    setPsmVersion((v) => v + 1);
    toast.success(`PSM is now ${next ? "ON" : "OFF"}`);
  };

  const runScopeDiscovery = async () => {
    if (!tenantId) return toast.error("No tenant ID");

    setIsDiscoveringScope(true);
    setScopeDiscoveryResult(null);
    setScopeDiscoveryError(null);

    try {
      const failingEntities = [
        "LeaveRequest",
        "Document",
        "OnboardingInstance",
        "OnboardingTask",
        "EmployeeOffboardingTask",
      ];

      const results = await discoverScopeFields({
        tenantId,
        entityNames: failingEntities,
      });

      setScopeDiscoveryResult({
        timestamp: new Date().toISOString(),
        tenantId,
        results,
      });

      console.log("[ScopeDiscovery]", results);
      toast.success("Scope discovery complete");
    } catch (err) {
      console.error("[ScopeDiscovery] Error:", err);
      setScopeDiscoveryError(err?.message || String(err));
      toast.error(err?.message || "Scope discovery failed");
    } finally {
      setIsDiscoveringScope(false);
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin Utilities</h1>
      <p className="text-slate-500">Secure tools for data repair, tenant migration & debugging.</p>

      {PSM && (
        <Card className="border-2 border-red-300 bg-red-50">
          <CardContent className="p-4 text-sm text-red-900">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-red-700" />
              <div>
                <p className="font-semibold">Production Safety Mode is ON</p>
                <p className="text-xs text-red-700">
                  Destructive actions are disabled to protect tenant data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isProd && (
        <Card className="border border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Dev Safety Toggle:</span>{" "}
              <span className={PSM ? "text-red-700 font-semibold" : "text-slate-600"}>
                PSM {PSM ? "ON" : "OFF"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={togglePSMDev}>
              Toggle PSM
            </Button>
          </CardContent>
        </Card>
      )}

      {!api && (
        <Card className="border border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-amber-900 text-sm">
            Waiting for tenant/entity scope… (api is null). API-scoped tools are disabled until scope
            resolves.
          </CardContent>
        </Card>
      )}

      <ScopeAuditCard />

      {/* Scope Field Discovery */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Scope Field Discovery</h2>
              <p className="text-xs text-slate-500">
                Detects which field actually persists tenant scoping for failing entities.
              </p>
            </div>

            <Button
              onClick={runScopeDiscovery}
              disabled={isDiscoveringScope || !tenantId}
              variant="outline"
            >
              {isDiscoveringScope && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Discover Scope Fields
            </Button>
          </div>

          {scopeDiscoveryError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              Scope discovery error: {scopeDiscoveryError}
            </div>
          )}

          {scopeDiscoveryResult && (
            <pre className="text-xs bg-slate-100 rounded p-3 overflow-x-auto">
              {JSON.stringify(scopeDiscoveryResult, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Universal Scope Probe */}
      <Card className="border-2 border-purple-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Universal Scope Probe (Registry)
              </h2>
              <p className="text-xs text-slate-500">
                Create → GET → Scoped Filter → Wrong-Scope Filter → Delete
              </p>
            </div>
          </div>

          <ScopeAuditCard />

          <MigrationAuditorCard />

          <TemplateTaskCleanupCard />

          <Button onClick={runTenantHealthCheck}>
            Run Tenant Health Check
          </Button>


          <p className="text-slate-600 text-sm">
            Active Entity ID:{" "}
            <code className="bg-slate-100 px-2 py-0.5 rounded">{tenantId || "N/A"}</code>
            <br />
            <span className="text-slate-500">Entities tested: {entitiesToProbe.length}</span>
          </p>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={runUniversalProbe}
              disabled={isUniversalProbing || !tenantId}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isUniversalProbing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Run Universal Probe
            </Button>

            <Button
              onClick={copyProbeResultsToClipboard}
              disabled={!universalProbeResult}
              variant="outline"
              size="sm"
            >
              Copy Results
            </Button>
          </div>

          {universalProbeResult && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-purple-900">Probe Results</p>
                <div className="flex gap-3">
                  <span className="text-2xl font-bold text-green-600">
                    {universalProbeResult.totalPassed} PASS
                  </span>
                  <span className="text-2xl font-bold text-red-600">
                    {universalProbeResult.totalFailed} FAIL
                  </span>
                </div>
              </div>

              {universalProbeResult.error && (
                <div className="bg-red-100 border border-red-300 rounded p-2 text-sm text-red-800">
                  Error: {universalProbeResult.error}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Entity</th>
                      <th className="px-3 py-2 text-center font-semibold">Scoped Found</th>
                      <th className="px-3 py-2 text-center font-semibold">Wrong-scope Hidden</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {universalProbeResult.results.map((r, i) => (
                      <tr key={i} className="bg-white hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{r.entity}</td>
                        <td className="px-3 py-2 text-center">
                          {r.scopedFound ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.wrongScopeHidden ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                r.status === "PASS"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {r.status}
                            </span>
                            {r.reason && <span className="text-xs text-red-600">{r.reason}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Cleanup & Repair */}
      <Card className="border-2 border-purple-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Tenant Cleanup & Repair</h2>
              <p className="text-xs text-slate-500">Audit and fix duplicates / scoped data issues</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleRunCleanupAudit}
              disabled={isAuditing || !tenantId || !api}
              className="bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              {isAuditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Run Dry-Run Audit
            </Button>

            <Button
              onClick={() => {
                if (PSM) return toast.error("Blocked by Production Safety Mode: Apply Fixes");
                setShowApplyConfirm(true);
              }}
              disabled={PSM || isApplying || !auditResult || auditResult.totalIssues === 0 || !api}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
            >
              Apply Fixes
            </Button>

            <Button onClick={exportAuditReport} disabled={!auditResult} variant="outline" size="sm">
              Export Report
            </Button>

            <Button
              onClick={handleDeduplicateDepartments}
              disabled={!tenantId}
              variant="outline"
              size="sm"
              className="border-slate-300"
            >
              Deduplicate Departments
            </Button>
          </div>

          {auditResult && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-purple-900">Audit Results</p>
                <span
                  className={`text-xl font-bold ${
                    auditResult.totalIssues === 0 ? "text-green-600" : "text-orange-600"
                  }`}
                >
                  {auditResult.totalIssues} issues
                </span>
              </div>
            </div>
          )}

          {applyResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-green-900">Apply Results recorded.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave Data Diagnostic */}
      <Card className="border-2 border-indigo-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Leave Data Diagnostic</h2>
              <p className="text-xs text-slate-500">
                Verify LeaveTypes, LeavePolicies, and balances exist
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={loadLeaveDiagnostic}
              disabled={isLoadingLeaveDiag || !tenantId || !api}
              variant="outline"
              size="sm"
            >
              {isLoadingLeaveDiag && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Load Diagnostic
            </Button>

            <Button
              onClick={handleDumpLeavePolicySchema}
              disabled={isDumpingSchema || !tenantId}
              variant="outline"
              size="sm"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {isDumpingSchema && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Dump Schema
            </Button>

            <Button
              onClick={handleProbeLeavePolicyScope}
              disabled={isProbing || !tenantId || !api}
              variant="outline"
              size="sm"
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              {isProbing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Probe Scope
            </Button>

            <Button
              onClick={handleSeedLeaveData}
              disabled={isSeedingLeave || !tenantId || !api}
              className="bg-indigo-600 hover:bg-indigo-700"
              size="sm"
            >
              {isSeedingLeave && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Seed/Repair
            </Button>
          </div>

          {leaveDataDiag && (
            <div className="bg-slate-50 rounded-lg p-4 text-sm">
              <p>
                LeaveTypes: <b>{leaveDataDiag.leaveTypes.length}</b> | LeavePolicies:{" "}
                <b>{leaveDataDiag.leavePolicies.length}</b> | LeaveBalances:{" "}
                <b>{leaveDataDiag.leaveBalances.length}</b>
              </p>
            </div>
          )}

          {schemaResult && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 text-sm">
              <p className="font-semibold text-orange-900 mb-2">Schema Dump</p>
              <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                {JSON.stringify(schemaResult.relevantFields, null, 2)}
              </pre>
            </div>
          )}

          {probeResult && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 text-sm">
              <p className="font-semibold text-purple-900 mb-2">Probe Results</p>
              <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                {JSON.stringify(probeResult, null, 2)}
              </pre>
            </div>
          )}

          {repairResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-green-900 mb-2">Repair Results</p>
              <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                {JSON.stringify(repairResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Multi-Tenant Health Check */}
      <Card className="border-2 border-blue-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Multi-Tenant Health Check</h2>
              <p className="text-xs text-slate-500">Verify data integrity and isolation</p>
            </div>
          </div>

          <Button
            onClick={runHealthCheck}
            disabled={isRunningHealthCheck || !tenantId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRunningHealthCheck && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Run Health Check
          </Button>

          {healthCheckResult && (
            <div className="mt-4 space-y-3 bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                {getStatusIcon(healthCheckResult.status)}
                <span className="font-semibold text-slate-900">
                  Overall Status: {healthCheckResult.status}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Backfill */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Tenant Data Backfill</h2>
          <p className="text-slate-600 text-sm">
            Tenant ID: <code className="bg-slate-100 p-1 rounded">{tenantId || "N/A"}</code>
          </p>

          <Button
            onClick={() => {
              if (PSM) return toast.error("Blocked by Production Safety Mode: Tenant Backfill");
              setShowConfirm(true);
            }}
            disabled={PSM || isRunningBackfill || !canRunBackfill}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            Run Tenant Backfill
          </Button>

          {!!log.length && (
            <div className="mt-4 bg-slate-900 text-slate-100 p-4 rounded-lg h-64 overflow-y-auto text-sm font-mono">
              {log.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Baseline Reset */}
      <Card className="border-2 border-orange-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Tenant Baseline Reset</h2>
              <p className="text-xs text-slate-500">Controlled reset for testing setup flows</p>
            </div>
          </div>

          <Button
            onClick={() => {
              if (PSM) return toast.error("Blocked by Production Safety Mode: Tenant Reset");
              setShowTenantReset(true);
            }}
            disabled={PSM || !tenantId || !isOwner}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
          >
            Reset Tenant Setup
          </Button>
        </CardContent>
      </Card>

      {/* Clean Reset (Legacy) */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Clean Reset (Delete All Data) - LEGACY
          </h2>

          <Button
            onClick={() => {
              if (PSM) return toast.error("Blocked by Production Safety Mode: Clean Reset");
              setShowResetConfirm(true);
            }}
            disabled={PSM || isResetting || !canRunReset}
            variant="destructive"
            className="disabled:opacity-50"
          >
            Delete All Business Data
          </Button>

          {!!resetLog.length && (
            <div className="mt-4 bg-slate-900 text-slate-100 p-4 rounded-lg h-64 overflow-y-auto text-sm font-mono">
              {resetLog.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backfill Confirmation */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent aria-describedby="admin-backfill-desc">
          <DialogHeader>
            <DialogTitle>Run Tenant Backfill?</DialogTitle>
            <DialogDescription id="admin-backfill-desc">
              This updates matching records to use the active tenant/entity ID. (Non-destructive.)
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={runBackfill}
              className="bg-red-600 hover:bg-red-700"
              disabled={PSM || isRunningBackfill || !canRunBackfill}
            >
              {isRunningBackfill && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Run Backfill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TenantResetDialog open={showTenantReset} onOpenChange={setShowTenantReset} context={ctx} />

      {/* Apply Fixes Confirmation */}
      <Dialog open={showApplyConfirm} onOpenChange={setShowApplyConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Cleanup Fixes?</DialogTitle>
            <DialogDescription>
              This will fix {auditResult?.totalIssues || 0} issue(s) in your tenant data.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyCleanupFixes}
              className="bg-green-600 hover:bg-green-700"
              disabled={PSM || isApplying || !api}
            >
              {isApplying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply Fixes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent aria-describedby="admin-reset-desc">
          <DialogHeader>
            <DialogTitle>⚠️ Delete All Business Data?</DialogTitle>
            <DialogDescription id="admin-reset-desc">
              This will permanently delete tenant-scoped & company setup records, but keep your user
              login.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={runCleanReset}
              variant="destructive"
              disabled={PSM || isResetting || !canRunReset}
            >
              {isResetting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}