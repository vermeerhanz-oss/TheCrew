/**
 * Tenant Reset Utility
 * 
 * Admin-only utilities for resetting and cleaning tenant baseline data.
 * Use with EXTREME CAUTION - this can delete operational data if misused.
 */

import { base44 } from '@/api/base44Client';
import { createTenantScopedApi } from './tenantApi';
import { logAuditEvent } from './audit';

/**
 * Reset baseline data for a tenant - CONTROLLED SOFT RESET
 * 
 * WARNING: This is a destructive operation. Use only for fixing data contamination.
 * All operations are tenant-scoped and will NOT affect other tenants.
 * 
 * @param {string} tenantId - The entity_id to reset
 * @param {string} userEmail - Email of user initiating reset (for audit)
 * @param {object} options - What to reset
 * @param {boolean} options.resetEntities - Delete entities created via setup (except primary)
 * @param {boolean} options.resetDepartments - Delete all departments
 * @param {boolean} options.resetLocations - Delete all locations
 * @param {boolean} options.resetLeavePolicies - Delete leave policies
 * @param {boolean} options.resetLeaveTypes - Delete leave types
 * @param {boolean} options.resetOnboardingTemplates - Delete onboarding templates
 * @param {boolean} options.resetOffboardingTemplates - Delete offboarding templates
 * @param {boolean} options.resetEmployees - DANGEROUS: Delete employees
 * @param {boolean} options.resetLeaveBalances - DANGEROUS: Delete leave balances
 * @param {boolean} options.dryRun - If true, only log what would be deleted
 * @returns {Promise<object>} Summary of what was deleted
 */
export async function resetTenantBaseline(tenantId, userEmail, options = {}) {
  const {
    resetEntities = false,
    resetDepartments = true,
    resetLocations = true,
    resetLeavePolicies = true,
    resetLeaveTypes = true,
    resetOnboardingTemplates = true,
    resetOffboardingTemplates = true,
    resetEmployees = false,
    resetLeaveBalances = false,
    dryRun = false,
  } = options;

  if (!tenantId) {
    throw new Error('[tenantReset] tenantId is required');
  }

  if (!userEmail) {
    throw new Error('[tenantReset] userEmail is required for audit trail');
  }

  console.log('[tenantReset] ⚠️  TENANT BASELINE RESET INITIATED');
  console.log('[tenantReset] Tenant:', tenantId);
  console.log('[tenantReset] Initiated by:', userEmail);
  console.log('[tenantReset] Options:', options);

  // Log audit event IMMEDIATELY
  if (!dryRun) {
    try {
      const user = await base44.auth.me();
      await logAuditEvent({
        actorUserId: user.id,
        eventType: 'tenant_baseline_reset',
        entityType: 'CompanyEntity',
        entityId: tenantId,
        description: `Tenant baseline reset initiated by ${userEmail}`,
        metadata: {
          options: options,
          timestamp: new Date().toISOString(),
        },
      });
      console.log('[tenantReset] Audit event logged');
    } catch (auditError) {
      console.error('[tenantReset] Failed to log audit event:', auditError);
      // Continue anyway - audit failure shouldn't block reset
    }
  }

  const api = createTenantScopedApi(tenantId);
  
  const results = {
    tenantId,
    userEmail,
    dryRun,
    timestamp: new Date().toISOString(),
    deleted: {
      entities: 0,
      departments: 0,
      locations: 0,
      leavePolicies: 0,
      leaveTypes: 0,
      onboardingTemplates: 0,
      offboardingTemplates: 0,
      employees: 0,
      leaveBalances: 0,
    },
    warnings: [],
  };

  // 1. Reset Entities (except primary tenant entity)
  if (resetEntities) {
    const CompanyEntity = base44.entities.CompanyEntity;
    const entities = await CompanyEntity.filter({ id: tenantId });
    
    if (entities.length > 1) {
      results.warnings.push(`Multiple entities found for tenant ${tenantId} - will only operate on exact match`);
    }
    
    // We don't delete the primary tenant entity itself, just clear its data
    console.log('[tenantReset] Skipping entity deletion (preserving tenant record)');
  }

  // 2. Reset Departments
  if (resetDepartments) {
    const departments = await api.departments.list();
    console.log('[tenantReset] Found', departments.length, 'departments');
    
    if (dryRun) {
      console.log('[tenantReset] DRY RUN - Would delete departments:', departments.map(d => d.name));
      results.deleted.departments = departments.length;
    } else {
      for (const dept of departments) {
        await api.departments.delete(dept.id);
        console.log('[tenantReset] ✓ Deleted department:', dept.name);
        results.deleted.departments++;
      }
    }
  }

  // 3. Reset Locations
  if (resetLocations) {
    const locations = await api.locations.list();
    console.log('[tenantReset] Found', locations.length, 'locations');
    
    if (dryRun) {
      console.log('[tenantReset] DRY RUN - Would delete locations:', locations.map(l => l.name));
      results.deleted.locations = locations.length;
    } else {
      for (const loc of locations) {
        await api.locations.delete(loc.id);
        console.log('[tenantReset] ✓ Deleted location:', loc.name);
        results.deleted.locations++;
      }
    }
  }

  // 4. Reset Leave Policies
  if (resetLeavePolicies) {
    const policies = await api.leavePolicies.list();
    console.log('[tenantReset] Found', policies.length, 'leave policies');
    
    if (dryRun) {
      console.log('[tenantReset] DRY RUN - Would delete leave policies');
      results.deleted.leavePolicies = policies.length;
    } else {
      for (const policy of policies) {
        await api.leavePolicies.delete(policy.id);
        console.log('[tenantReset] ✓ Deleted leave policy:', policy.id);
        results.deleted.leavePolicies++;
      }
    }
  }

  // 5. Reset Leave Types
  if (resetLeaveTypes) {
    const leaveTypes = await api.leaveTypes.list();
    console.log('[tenantReset] Found', leaveTypes.length, 'leave types');
    
    if (dryRun) {
      console.log('[tenantReset] DRY RUN - Would delete leave types:', leaveTypes.map(lt => lt.name));
      results.deleted.leaveTypes = leaveTypes.length;
    } else {
      for (const lt of leaveTypes) {
        await api.leaveTypes.delete(lt.id);
        console.log('[tenantReset] ✓ Deleted leave type:', lt.name);
        results.deleted.leaveTypes++;
      }
    }
  }

  // 6. Reset Onboarding Templates
  if (resetOnboardingTemplates) {
    const templates = await api.onboardingTemplates.list();
    console.log('[tenantReset] Found', templates.length, 'onboarding templates');
    
    if (dryRun) {
      console.log('[tenantReset] DRY RUN - Would delete onboarding templates');
      results.deleted.onboardingTemplates = templates.length;
    } else {
      for (const template of templates) {
        await api.onboardingTemplates.delete(template.id);
        console.log('[tenantReset] ✓ Deleted onboarding template:', template.name);
        results.deleted.onboardingTemplates++;
      }
    }
  }

  // 7. Reset Offboarding Templates
  if (resetOffboardingTemplates) {
    const templates = await api.offboardingTemplates.list();
    console.log('[tenantReset] Found', templates.length, 'offboarding templates');
    
    if (dryRun) {
      console.log('[tenantReset] DRY RUN - Would delete offboarding templates');
      results.deleted.offboardingTemplates = templates.length;
    } else {
      for (const template of templates) {
        await api.offboardingTemplates.delete(template.id);
        console.log('[tenantReset] ✓ Deleted offboarding template:', template.name);
        results.deleted.offboardingTemplates++;
      }
    }
  }

  // 8. Reset Employees (DANGEROUS)
  if (resetEmployees) {
    const employees = await api.employees.list();
    console.log('[tenantReset] ⚠️  DANGEROUS: Found', employees.length, 'employees');
    
    if (dryRun) {
      console.log('[tenantReset] DRY RUN - Would delete employees');
      results.deleted.employees = employees.length;
    } else {
      for (const emp of employees) {
        await api.employees.delete(emp.id);
        console.log('[tenantReset] ⚠️  Deleted employee:', emp.email);
        results.deleted.employees++;
      }
    }
  }

  // 9. Reset Leave Balances (DANGEROUS)
  if (resetLeaveBalances) {
    const balances = await api.leaveBalances.list();
    console.log('[tenantReset] ⚠️  DANGEROUS: Found', balances.length, 'leave balances');
    
    if (dryRun) {
      console.log('[tenantReset] DRY RUN - Would delete leave balances');
      results.deleted.leaveBalances = balances.length;
    } else {
      for (const balance of balances) {
        await api.leaveBalances.delete(balance.id);
        console.log('[tenantReset] ⚠️  Deleted leave balance:', balance.id);
        results.deleted.leaveBalances++;
      }
    }
  }

  // 10. Mark bootstrap as incomplete (if not dry run)
  if (!dryRun) {
    try {
      const CompanySettings = base44.entities.CompanySettings;
      const settings = await CompanySettings.filter({ entity_id: tenantId });
      
      if (settings.length > 0) {
        await CompanySettings.update(settings[0].id, {
          has_completed_bootstrap: false,
        });
        console.log('[tenantReset] ✓ Marked bootstrap as incomplete');
      }
    } catch (settingsError) {
      console.error('[tenantReset] Failed to update bootstrap flag:', settingsError);
      results.warnings.push('Failed to update bootstrap flag');
    }

    // 11. Clear tenant-scoped localStorage flag
    if (typeof window !== 'undefined') {
      try {
        const tenantKey = `fcw_setup_completed:${tenantId}`;
        window.localStorage.removeItem(tenantKey);
        console.log('[tenantReset] ✓ Cleared localStorage flag:', tenantKey);
      } catch (e) {
        console.warn('[tenantReset] Failed to clear localStorage:', e);
      }
    }
  }

  console.log('[tenantReset] ✓ Reset complete:', results);
  return results;
}

/**
 * Check for duplicate baseline data in a tenant
 * 
 * @param {string} tenantId - The entity_id to check
 * @returns {Promise<object>} Report of duplicates found
 */
export async function auditTenantDuplicates(tenantId) {
  if (!tenantId) {
    throw new Error('[tenantReset] tenantId is required');
  }

  const api = createTenantScopedApi(tenantId);
  
  const report = {
    tenantId,
    duplicateDepartments: [],
    duplicateLocations: [],
    warnings: [],
  };

  // Check for duplicate departments (same name, case-insensitive)
  const departments = await api.departments.list();
  const deptNames = new Map();
  
  for (const dept of departments) {
    const key = (dept.name || '').toLowerCase().trim();
    if (!key) continue;
    
    if (deptNames.has(key)) {
      deptNames.get(key).push(dept);
    } else {
      deptNames.set(key, [dept]);
    }
  }
  
  for (const [name, depts] of deptNames.entries()) {
    if (depts.length > 1) {
      report.duplicateDepartments.push({
        name,
        count: depts.length,
        ids: depts.map(d => d.id),
      });
    }
  }

  // Check for duplicate locations (same name)
  const locations = await api.locations.list();
  const locNames = new Map();
  
  for (const loc of locations) {
    const key = (loc.name || '').toLowerCase().trim();
    if (!key) continue;
    
    if (locNames.has(key)) {
      locNames.get(key).push(loc);
    } else {
      locNames.set(key, [loc]);
    }
  }
  
  for (const [name, locs] of locNames.entries()) {
    if (locs.length > 1) {
      report.duplicateLocations.push({
        name,
        count: locs.length,
        ids: locs.map(l => l.id),
      });
    }
  }

  // Warnings
  if (report.duplicateDepartments.length > 0) {
    report.warnings.push(`Found ${report.duplicateDepartments.length} duplicate department names`);
  }
  
  if (report.duplicateLocations.length > 0) {
    report.warnings.push(`Found ${report.duplicateLocations.length} duplicate location names`);
  }

  console.log('[tenantReset] Audit complete:', report);
  return report;
}

/**
 * Deduplicate departments by keeping only the oldest record for each name
 * 
 * ENHANCED: Now handles references (re-points employees, templates) before deleting
 * 
 * @param {string} tenantId - The entity_id to deduplicate
 * @param {boolean} dryRun - If true, only log what would be deleted
 * @returns {Promise<object>} Summary of deduplication
 */
export async function deduplicateDepartments(tenantId, dryRun = true) {
  if (!tenantId) {
    throw new Error('[tenantReset] tenantId is required');
  }

  const api = createTenantScopedApi(tenantId);
  const departments = await api.departments.list();
  
  const deptsByName = new Map();
  for (const dept of departments) {
    const key = (dept.name || '').toLowerCase().trim();
    if (!key) continue;
    
    if (!deptsByName.has(key)) {
      deptsByName.set(key, []);
    }
    deptsByName.get(key).push(dept);
  }

  const results = {
    tenantId,
    dryRun,
    duplicatesFound: 0,
    recordsDeleted: 0,
    recordsKept: 0,
    referencesRepointed: 0,
    details: [],
  };

  for (const [name, depts] of deptsByName.entries()) {
    if (depts.length > 1) {
      results.duplicatesFound++;
      
      // Sort by created_date (oldest first)
      depts.sort((a, b) => {
        const dateA = new Date(a.created_date || 0);
        const dateB = new Date(b.created_date || 0);
        return dateA - dateB;
      });
      
      const toKeep = depts[0];
      const toDelete = depts.slice(1);
      
      results.recordsKept++;
      results.recordsDeleted += toDelete.length;
      
      const detail = {
        name,
        totalFound: depts.length,
        kept: { id: toKeep.id, created: toKeep.created_date },
        deleted: toDelete.map(d => ({ id: d.id, created: d.created_date })),
        referencesFixed: 0,
      };
      
      if (!dryRun) {
        // STEP 1: Re-point all references to canonical department
        for (const dupDept of toDelete) {
          // Check Employee.department_id
          try {
            const emps = await api.employees.filter({ department_id: dupDept.id });
            for (const emp of emps) {
              await api.employees.update(emp.id, { department_id: toKeep.id });
              detail.referencesFixed++;
              results.referencesRepointed++;
              console.log('[tenantReset] Re-pointed Employee', emp.id, 'from', dupDept.id, 'to', toKeep.id);
            }
          } catch (err) {
            console.warn('[tenantReset] Error re-pointing employees:', err);
          }
          
          // Check OnboardingTemplate.meta.department_id if it exists
          try {
            const onboardingTemplates = await api.onboardingTemplates.list();
            for (const tpl of onboardingTemplates || []) {
              if (tpl.meta?.department_id === dupDept.id) {
                await api.onboardingTemplates.update(tpl.id, {
                  meta: { ...tpl.meta, department_id: toKeep.id }
                });
                detail.referencesFixed++;
                results.referencesRepointed++;
                console.log('[tenantReset] Re-pointed OnboardingTemplate', tpl.id, 'meta.department_id');
              }
            }
          } catch (err) {
            console.warn('[tenantReset] Error re-pointing onboarding templates:', err);
          }
          
          // Check OffboardingTemplate.meta.department_id if it exists
          try {
            const offboardingTemplates = await api.offboardingTemplates.list();
            for (const tpl of offboardingTemplates || []) {
              if (tpl.meta?.department_id === dupDept.id) {
                await api.offboardingTemplates.update(tpl.id, {
                  meta: { ...tpl.meta, department_id: toKeep.id }
                });
                detail.referencesFixed++;
                results.referencesRepointed++;
                console.log('[tenantReset] Re-pointed OffboardingTemplate', tpl.id, 'meta.department_id');
              }
            }
          } catch (err) {
            console.warn('[tenantReset] Error re-pointing offboarding templates:', err);
          }
        }
        
        // STEP 2: Delete duplicates
        for (const dept of toDelete) {
          await api.departments.delete(dept.id);
          console.log('[tenantReset] Deleted duplicate department:', dept.name, dept.id);
        }
      } else {
        console.log('[tenantReset] DRY RUN - Would keep:', toKeep.name, toKeep.id);
        console.log('[tenantReset] DRY RUN - Would delete:', toDelete.map(d => d.id));
      }
      
      results.details.push(detail);
    }
  }

  console.log('[tenantReset] Deduplication complete:', results);
  return results;
}

/**
 * Verify employee entity assignments for a tenant
 * 
 * @param {string} tenantId - The entity_id to verify
 * @returns {Promise<object>} Report of misassigned employees
 */
export async function verifyEmployeeEntityAssignment(tenantId) {
  if (!tenantId) {
    throw new Error('[tenantReset] tenantId is required');
  }

  const api = createTenantScopedApi(tenantId);
  const employees = await api.employees.list();

  const report = {
    tenantId,
    totalEmployees: employees.length,
    correctlyAssigned: 0,
    misassigned: [],
    warnings: [],
  };

  for (const emp of employees) {
    if (emp.entity_id === tenantId) {
      report.correctlyAssigned++;
    } else {
      report.misassigned.push({
        id: emp.id,
        email: emp.email,
        name: `${emp.first_name} ${emp.last_name}`,
        assignedTo: emp.entity_id,
        shouldBe: tenantId,
      });
    }
  }

  if (report.misassigned.length > 0) {
    report.warnings.push(`Found ${report.misassigned.length} employees assigned to wrong entity`);
  }

  console.log('[tenantReset] Employee assignment verification:', report);
  return report;
}

/**
 * Run comprehensive multi-tenant health check
 * 
 * @param {string} tenantId - The entity_id to check
 * @returns {Promise<object>} Comprehensive health report
 */
export async function runTenantHealthCheck(tenantId) {
  if (!tenantId) {
    throw new Error('[tenantReset] tenantId is required');
  }

  console.log('[HealthCheck] scope', { tenantId, entityIdResolved: tenantId });
  console.log('[tenantReset] Running health check for tenant:', tenantId);

  const results = {
    tenantId,
    timestamp: new Date().toISOString(),
    status: 'PASS', // PASS | WARN | FAIL
    checks: {},
    warnings: [],
    errors: [],
  };

  try {
    // Check 1: Duplicate records
    const duplicates = await auditTenantDuplicates(tenantId);
    results.checks.duplicates = {
      status: duplicates.warnings.length > 0 ? 'WARN' : 'PASS',
      duplicateDepartments: duplicates.duplicateDepartments.length,
      duplicateLocations: duplicates.duplicateLocations.length,
      details: duplicates,
    };
    if (duplicates.warnings.length > 0) {
      results.warnings.push(...duplicates.warnings);
      results.status = 'WARN';
    }

    // Check 2: Employee entity assignment
    const employeeCheck = await verifyEmployeeEntityAssignment(tenantId);
    results.checks.employeeAssignment = {
      status: employeeCheck.misassigned.length > 0 ? 'FAIL' : 'PASS',
      correctlyAssigned: employeeCheck.correctlyAssigned,
      misassigned: employeeCheck.misassigned.length,
      details: employeeCheck,
    };
    if (employeeCheck.misassigned.length > 0) {
      results.errors.push(`${employeeCheck.misassigned.length} employees assigned to wrong entity`);
      results.status = 'FAIL';
    }

    // Check 3: Setup flags and bootstrap version
    const CompanySettings = base44.entities.CompanySettings;
    const settings = await CompanySettings.filter({ entity_id: tenantId });
    const settingsRecord = settings[0];

    const hasBootstrapFlag = settingsRecord?.has_completed_bootstrap === true;
    const hasVersionFlag = typeof settingsRecord?.bootstrapVersion === 'number';

    results.checks.setupFlags = {
      status: hasBootstrapFlag && hasVersionFlag ? 'PASS' : 'WARN',
      hasCompletedBootstrap: hasBootstrapFlag,
      bootstrapVersion: settingsRecord?.bootstrapVersion || null,
      details: {
        settingsFound: !!settingsRecord,
        hasVersionFlag,
      },
    };

    if (!hasVersionFlag && hasBootstrapFlag) {
      results.warnings.push('Bootstrap complete but version missing (legacy tenant)');
      if (results.status === 'PASS') results.status = 'WARN';
    }

    // Check 4: LocalStorage tenant scoping
    if (typeof window !== 'undefined') {
      const tenantKey = `fcw_setup_completed:${tenantId}`;
      const hasTenantScopedFlag = window.localStorage.getItem(tenantKey) === 'true';
      const hasLegacyFlag = window.localStorage.getItem('fcw_setup_completed') === 'true';

      results.checks.localStorage = {
        status: hasTenantScopedFlag ? 'PASS' : (hasLegacyFlag ? 'WARN' : 'PASS'),
        hasTenantScopedFlag,
        hasLegacyFlag,
        recommendation: hasLegacyFlag && !hasTenantScopedFlag ? 
          'Remove legacy flag and use tenant-scoped key' : null,
      };

      if (hasLegacyFlag && !hasTenantScopedFlag) {
        results.warnings.push('Legacy localStorage flag detected (not tenant-scoped)');
        if (results.status === 'PASS') results.status = 'WARN';
      }
    }

  } catch (error) {
    console.error('[tenantReset] Health check failed:', error);
    results.status = 'FAIL';
    results.errors.push(`Health check error: ${error.message}`);
  }

  console.log('[tenantReset] Health check complete:', results);
  return results;
}