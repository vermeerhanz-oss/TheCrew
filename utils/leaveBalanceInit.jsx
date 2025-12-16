import { format } from 'date-fns';
import { createTenantScopedApi } from '@/components/utils/tenantApi';

// 🔒 Guard: prevent concurrent/duplicate init calls for same employee
const initializingKeys = new Set();
const initializedKeys = new Set();

function todayYYYYMMDD() {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Resolve a tenant-scoped api instance.
 * Preferred: pass api from useTenantApi()
 * Fallback: pass tenantId to build scoped api.
 */
function resolveApi(apiOrTenantId) {
  if (!apiOrTenantId) return null;
  if (typeof apiOrTenantId === 'object') return apiOrTenantId;
  return createTenantScopedApi(apiOrTenantId);
}

/**
 * Get the correct leave balances collection from the tenant api.
 * Your scopeRegistry uses: key 'leaveBalances' -> entityName 'LeaveBalance'
 */
function getLeaveBalancesEntity(api) {
  return api?.leaveBalances || api?.employeeLeaveBalances || null; // fallback for legacy
}

/**
 * Initialize leave balance records for a new employee.
 * Creates annual and personal leave balances with 0 hours if missing.
 *
 * Preferred call:
 *   initializeLeaveBalances(api, employeeId, startDate)
 *
 * Legacy call supported:
 *   initializeLeaveBalances(employeeId, tenantId, startDate)
 */
export async function initializeLeaveBalances(arg1, arg2 = null, arg3 = null) {
  // Support both signatures:
  // 1) (api, employeeId, startDate)
  // 2) (employeeId, tenantId, startDate)
  let api = null;
  let employeeId = null;
  let tenantId = null;
  let startDate = null;

  if (typeof arg1 === 'object' && arg1) {
    api = arg1;
    employeeId = arg2;
    startDate = arg3;
    tenantId = api?.entityId || api?.tenantId || null; // optional best-effort
  } else {
    employeeId = arg1;
    tenantId = arg2;
    startDate = arg3;
    api = resolveApi(tenantId);
  }

  if (!employeeId) {
    console.warn('[leaveBalanceInit] Missing employeeId - cannot initialize balances');
    return 0;
  }

  if (!api) {
    console.warn('[leaveBalanceInit] No tenant-scoped api provided - cannot initialize balances');
    return 0;
  }

  const leaveBalancesEntity = getLeaveBalancesEntity(api);
  if (!leaveBalancesEntity) {
    console.warn('[leaveBalanceInit] leaveBalances entity not available on tenant api');
    return 0;
  }

  const scopeKey = tenantId ? `${tenantId}:${employeeId}` : `api:${employeeId}`;

  // 🛡️ Idempotency: skip if already initialized or currently initializing
  if (initializedKeys.has(scopeKey)) {
    console.log(`[leaveBalanceInit] Already initialized for ${scopeKey}`);
    return 0;
  }
  if (initializingKeys.has(scopeKey)) {
    console.log(`[leaveBalanceInit] Already initializing ${scopeKey}, skipping duplicate call`);
    return 0;
  }

  initializingKeys.add(scopeKey);

  try {
    const effectiveDate = startDate || todayYYYYMMDD();

    // Check if balances already exist
    const existing = (await leaveBalancesEntity.filter({ employee_id: employeeId })) || [];
    const existingTypes = new Set(existing.map(b => b.leave_type));

    const leaveTypes = ['annual', 'personal'];
    const toCreate = [];

    for (const leaveType of leaveTypes) {
      if (!existingTypes.has(leaveType)) {
        toCreate.push({
          employee_id: employeeId,
          leave_type: leaveType,
          balance_hours: 0,
          last_calculated_date: effectiveDate,
        });
      }
    }

    if (toCreate.length > 0) {
      await leaveBalancesEntity.bulkCreate(toCreate);
    }

    initializedKeys.add(scopeKey);
    return toCreate.length;
  } catch (err) {
    console.error('[leaveBalanceInit] Failed to initialize balances', err);
    throw err;
  } finally {
    initializingKeys.delete(scopeKey);
  }
}

/**
 * Get leave balances for an employee.
 *
 * Preferred:
 *   getLeaveBalances(api, employeeId)
 *
 * Legacy supported:
 *   getLeaveBalances(employeeId, tenantId)
 */
export async function getLeaveBalances(arg1, arg2 = null) {
  let api = null;
  let employeeId = null;

  if (typeof arg1 === 'object' && arg1) {
    api = arg1;
    employeeId = arg2;
  } else {
    employeeId = arg1;
    const tenantId = arg2;
    api = resolveApi(tenantId);
  }

  if (!employeeId) {
    console.warn('[leaveBalanceInit] Missing employeeId for getLeaveBalances');
    return {};
  }
  if (!api) {
    console.warn('[leaveBalanceInit] No tenant-scoped api provided to getLeaveBalances');
    return {};
  }

  const leaveBalancesEntity = getLeaveBalancesEntity(api);
  if (!leaveBalancesEntity) {
    console.warn('[leaveBalanceInit] leaveBalances entity not available on tenant api');
    return {};
  }

  const balances = (await leaveBalancesEntity.filter({ employee_id: employeeId })) || [];

  const map = {};
  for (const b of balances) {
    map[b.leave_type] = b;
  }

  // Ensure defaults for standard types to prevent crashes
  ['annual', 'personal'].forEach(type => {
    if (!map[type]) {
      map[type] = {
        employee_id: employeeId,
        leave_type: type,
        balance_hours: 0,
        last_calculated_date: todayYYYYMMDD(),
      };
    }
  });

  return map;
}
