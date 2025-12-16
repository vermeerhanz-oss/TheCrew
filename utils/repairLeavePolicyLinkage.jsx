/**
 * repairLeavePolicyLinkage.js
 *
 * Repairs existing LeavePolicy records by setting their leave_type_id
 * foreign key to point to the correct LeaveType record.
 *
 * Safe to re-run (idempotent).
 * Multi-tenant safe (uses tenant-scoped API).
 */

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

/**
 * Build a map from semantic leave types to LeaveType IDs
 * @param {Array} leaveTypes - Array of LeaveType records
 * @returns {Object} Map like { annual: 'uuid', personal: 'uuid', unpaid: 'uuid' }
 */
function buildLeaveTypeSemanticMap(leaveTypes) {
  const map = {};
  
  for (const lt of leaveTypes || []) {
    const code = norm(lt.code);
    const name = norm(lt.name);
    
    // Map by code (most reliable)
    if (code === 'annual') map.annual = lt.id;
    if (code === 'personal') map.personal = lt.id;
    if (code === 'compassionate') map.compassionate = lt.id;
    if (code === 'family_domestic_violence') map.family_domestic_violence = lt.id;
    if (code === 'parental') map.parental = lt.id;
    if (code === 'long_service') map.long_service = lt.id;
    if (code === 'unpaid') map.unpaid = lt.id;
    
    // Fallback: map by name patterns
    if (!map.annual && name.includes('annual')) map.annual = lt.id;
    if (!map.personal && (name.includes('personal') || name.includes('carer') || name.includes('sick'))) {
      map.personal = lt.id;
    }
    if (!map.compassionate && name.includes('compassionate')) map.compassionate = lt.id;
    if (!map.family_domestic_violence && name.includes('family') && name.includes('domestic')) {
      map.family_domestic_violence = lt.id;
    }
    if (!map.parental && name.includes('parental')) map.parental = lt.id;
    if (!map.long_service && name.includes('long') && name.includes('service')) {
      map.long_service = lt.id;
    }
    if (!map.unpaid && name.includes('unpaid')) map.unpaid = lt.id;
  }
  
  return map;
}

/**
 * Infer the semantic leave type from a policy's code or leave_type field
 * @param {Object} policy - LeavePolicy record
 * @returns {string|null} 'annual' | 'personal' | 'compassionate' | 'family_domestic_violence' | 'parental' | 'long_service' | 'unpaid' | null
 */
function inferPolicyType(policy) {
  // Primary: use policy.leave_type field
  if (policy.leave_type) {
    const lt = norm(policy.leave_type);
    if (lt === 'annual') return 'annual';
    if (lt === 'personal' || lt === 'sick' || lt === 'personal_carer') return 'personal';
    if (lt === 'compassionate') return 'compassionate';
    if (lt === 'family_domestic_violence' || lt.includes('family') && lt.includes('domestic')) return 'family_domestic_violence';
    if (lt === 'parental') return 'parental';
    if (lt === 'long_service' || lt === 'lsl') return 'long_service';
    if (lt === 'unpaid') return 'unpaid';
  }
  
  // Fallback: infer from code prefix
  if (policy.code) {
    const code = norm(policy.code);
    if (code.startsWith('annual')) return 'annual';
    if (code.startsWith('personal')) return 'personal';
    if (code.startsWith('compassionate')) return 'compassionate';
    if (code.startsWith('family') || code.startsWith('domestic')) return 'family_domestic_violence';
    if (code.startsWith('parental')) return 'parental';
    if (code.startsWith('long')) return 'long_service';
    if (code.startsWith('unpaid')) return 'unpaid';
  }
  
  // Fallback: infer from name
  if (policy.name) {
    const name = norm(policy.name);
    if (name.includes('annual')) return 'annual';
    if (name.includes('personal') || name.includes('carer') || name.includes('sick')) return 'personal';
    if (name.includes('compassionate')) return 'compassionate';
    if (name.includes('family') && name.includes('domestic')) return 'family_domestic_violence';
    if (name.includes('parental')) return 'parental';
    if (name.includes('long') && name.includes('service')) return 'long_service';
    if (name.includes('unpaid')) return 'unpaid';
  }
  
  return null;
}

/**
 * Repair LeavePolicy records by setting leave_type_id
 * @param {Object} api - Tenant-scoped API from useTenantApi()
 * @returns {Promise<Object>} { totalPolicies, repairedCount, stillMissingCount, errors }
 */
export async function repairLeavePolicyLinkage(api) {
  console.log('[repairLeavePolicyLinkage] Starting repair...');
  
  // 1. Load all leave types for this tenant
  const leaveTypes = await api.leaveTypes.list().catch(() => []);
  console.log('[repairLeavePolicyLinkage] Loaded leave types:', leaveTypes.length);
  
  if (leaveTypes.length === 0) {
    console.warn('[repairLeavePolicyLinkage] No leave types found - aborting repair');
    return { totalPolicies: 0, repairedCount: 0, stillMissingCount: 0, errors: [] };
  }
  
  // 2. Build semantic type -> ID map
  const typeMap = buildLeaveTypeSemanticMap(leaveTypes);
  console.log('[repairLeavePolicyLinkage] Type map:', typeMap);
  
  // 3. Load all leave policies for this tenant
  const policies = await api.leavePolicies.list().catch(() => []);
  console.log('[repairLeavePolicyLinkage] Loaded policies:', policies.length);
  
  const totalPolicies = policies.length;
  let repairedCount = 0;
  let stillMissingCount = 0;
  const errors = [];
  
  // 4. Repair each policy missing leave_type_id
  for (const policy of policies) {
    // Skip if already has leave_type_id
    if (policy.leave_type_id) {
      continue;
    }
    
    // Infer the semantic type
    const semanticType = inferPolicyType(policy);
    if (!semanticType) {
      console.warn(`[repairLeavePolicyLinkage] Cannot infer type for policy: ${policy.name} (${policy.code})`);
      stillMissingCount++;
      errors.push(`Cannot infer type: ${policy.name}`);
      continue;
    }
    
    // Get the LeaveType ID for this semantic type
    const leaveTypeId = typeMap[semanticType];
    if (!leaveTypeId) {
      console.warn(`[repairLeavePolicyLinkage] No LeaveType ID for "${semanticType}" - policy: ${policy.name}`);
      stillMissingCount++;
      errors.push(`No LeaveType for "${semanticType}": ${policy.name}`);
      continue;
    }
    
    // Update the policy
    try {
      await api.leavePolicies.update(policy.id, {
        leave_type_id: leaveTypeId,
      });
      console.log(`[repairLeavePolicyLinkage] ✓ Repaired: ${policy.name} -> ${semanticType} (${leaveTypeId})`);
      repairedCount++;
    } catch (err) {
      console.error(`[repairLeavePolicyLinkage] Failed to update policy ${policy.name}:`, err);
      errors.push(`Update failed: ${policy.name} - ${err.message}`);
      stillMissingCount++;
    }
  }
  
  console.log('[repairLeavePolicyLinkage] Complete:', {
    totalPolicies,
    repairedCount,
    stillMissingCount,
    errors: errors.length,
  });
  
  return { totalPolicies, repairedCount, stillMissingCount, errors };
}

/**
 * Ensure all employees have leave balances for active leave types
 * @param {Object} api - Tenant-scoped API from useTenantApi()
 * @returns {Promise<Object>} { employeesProcessed, balancesCreated }
 */
export async function ensureEmployeeLeaveBalances(api) {
  console.log('[ensureEmployeeLeaveBalances] Starting...');
  
  const employees = await api.employees.list().catch(() => []);
  const leaveTypes = await api.leaveTypes.filter({ is_active: true }).catch(() => []);
  
  console.log('[ensureEmployeeLeaveBalances] Employees:', employees.length, 'Active leave types:', leaveTypes.length);
  
  let employeesProcessed = 0;
  let balancesCreated = 0;
  
  for (const employee of employees) {
    employeesProcessed++;
    
    for (const leaveType of leaveTypes) {
      // Check if balance exists
      const existingBalances = await api.leaveBalances.filter({
        employee_id: employee.id,
        leave_type_id: leaveType.id
      }).catch(() => []);
      
      if (existingBalances.length === 0) {
        // Create balance
        try {
          await api.leaveBalances.create({
            employee_id: employee.id,
            leave_type_id: leaveType.id,
            leave_type: norm(leaveType.code) || 'annual',
            opening_balance_hours: 0,
            accrued_hours: 0,
            taken_hours: 0,
            adjusted_hours: 0,
            available_hours: 0,
            last_accrual_date: new Date().toISOString().split('T')[0],
            version: 0
          });
          balancesCreated++;
          console.log(`[ensureEmployeeLeaveBalances] Created balance for ${employee.email} - ${leaveType.name}`);
        } catch (err) {
          console.error(`[ensureEmployeeLeaveBalances] Failed to create balance:`, err);
        }
      } else if (!existingBalances[0].leave_type_id) {
        // Update to populate leave_type_id
        try {
          await api.leaveBalances.update(existingBalances[0].id, {
            leave_type_id: leaveType.id
          });
          console.log(`[ensureEmployeeLeaveBalances] Updated balance leave_type_id for ${employee.email} - ${leaveType.name}`);
        } catch (err) {
          console.error(`[ensureEmployeeLeaveBalances] Failed to update balance:`, err);
        }
      }
    }
  }
  
  console.log('[ensureEmployeeLeaveBalances] Complete:', { employeesProcessed, balancesCreated });
  return { employeesProcessed, balancesCreated };
}