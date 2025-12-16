// src/components/offboarding/offboardingEngine.jsx
import { addDays, format } from 'date-fns';
import { sendNotification } from '@/components/utils/notifications';
import { logForCurrentUser } from '@/components/utils/audit';
import { suspendUserForEmployee } from '@/components/utils/googleWorkspace';

/**
 * Helpers
 */
function normalizeDateYYYYMMDD(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return format(d, 'yyyy-MM-dd');
  } catch {
    return null;
  }
}

function normalizeRole(role) {
  const allowed = new Set(['employee', 'manager', 'hr', 'it', 'finance']);
  const r = (role || '').toString().toLowerCase().trim();
  return allowed.has(r) ? r : 'hr';
}

/**
 * Create an offboarding run from a template
 * @param {Object} api - Tenant-scoped API from useTenantApi()
 */
export async function createOffboardingFromTemplate(api, {
  employee,
  templateId,
  lastDay,
  exitType,
  reason,
  createdByUserId,
}) {
  if (!api?.employeeOffboardings) throw new Error('tenantApi missing employeeOffboardings');
  if (!api?.employeeOffboardingTasks) throw new Error('tenantApi missing employeeOffboardingTasks');
  if (!api?.offboardingTaskTemplates) throw new Error('tenantApi missing offboardingTaskTemplates');
  // DEBUG: Log instantiation start
  console.log('[offboardingEngine] createOffboardingFromTemplate() START', {
    employeeId: employee?.id,
    templateId,
    lastDay,
    exitType,
    entityId: employee?.entity_id
  });

  if (!employee?.id) throw new Error('createOffboardingFromTemplate: employee is required');

  const last_day = normalizeDateYYYYMMDD(lastDay);
  if (!last_day) throw new Error('createOffboardingFromTemplate: lastDay is required (YYYY-MM-DD)');

  const entity_id = employee.entity_id || null;
  if (!entity_id) {
    throw new Error(
      'createOffboardingFromTemplate: employee.entity_id is missing (cannot create scoped offboarding/tasks)'
    );
  }

  // AI FIX: Ensure all tenant scope fields are included
  const offboarding = await api.employeeOffboardings.create({
    entity_id,
    company_entity_id: entity_id,
    tenant_id: entity_id,
    employee_id: employee.id,
    template_id: templateId || null,
    department: employee.department_id || null,
    manager_id: employee.manager_id || null,
    last_day,
    exit_type: exitType,
    reason: reason || null,
    status: 'scheduled',
    created_by_user_id: createdByUserId || null,
  });

  if (templateId) {
    const taskTemplates = await api.offboardingTaskTemplates.filter({ template_id: templateId });
    console.log('[offboardingEngine] Loaded', taskTemplates.length, 'task templates for template', templateId);
    
    taskTemplates.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    // Load template (get() preferred, filter fallback)
    let template = null;
    try {
      const rows = await api.offboardingTemplates.filter({ id: templateId }).catch(() => []);
      template = rows?.[0] || null;
    } catch (err) {
      console.warn('[offboardingEngine] Failed to load template:', err);
    }

    // Generate docs (ensure entity_id included)
    if (template && api?.documentTemplates && api?.documents) {
      const documentTemplateIds = [
        template.termination_template_id,
        ...(template.exit_document_template_ids || []),
      ].filter(Boolean);

      for (const docTemplateId of documentTemplateIds) {
        const docTemplates = await api.documentTemplates.filter({ id: docTemplateId }).catch(() => []);
        const docTemplate = docTemplates?.[0];
        if (!docTemplate) continue;

        // AI FIX: Ensure all tenant scope fields are included
        await api.documents.create({
          entity_id,
          company_entity_id: entity_id,
          tenant_id: entity_id,
          owner_employee_id: employee.id,
          uploaded_by_id: createdByUserId || null,
          file_url: docTemplate.file_url,
          file_name: docTemplate.file_name,
          file_size: docTemplate.file_size_bytes,
          file_type: docTemplate.file_mime_type,
          category: 'Offboarding',
          visibility: 'admin',
          notes: `Generated from template: ${docTemplate.name}`,
          related_offboarding_task_id: null,
        });
      }
    }

    // AI FIX: Ensure all tenant scope fields and required fields are included
    const taskData = taskTemplates.map((tt) => {
      let due_date = null;
      if (tt.due_offset_days !== undefined && tt.due_offset_days !== null) {
        due_date = format(
          addDays(new Date(last_day), Number(tt.due_offset_days || 0)),
          'yyyy-MM-dd'
        );
      }

      return {
        entity_id,
        company_entity_id: entity_id,
        tenant_id: entity_id,
        offboarding_id: offboarding.id,
        task_template_id: tt.id,
        title: tt.title || 'Untitled task',
        description: tt.description || null,
        category: tt.category || null,
        assigned_to_role: normalizeRole(tt.assigned_to_role || tt.assignee_role),
        assigned_to_employee_id: null,
        due_date,
        required: tt.required !== false,
        link_url: tt.link_url || null,
        system_code: tt.system_code || null,
        order_index: tt.order_index || 0,
        status: 'not_started',
      };
    });

    if (taskData.length > 0) {
      console.log('[offboardingEngine] Creating', taskData.length, 'offboarding tasks');
      console.log('[offboardingEngine] Sample task payload:', taskData[0]);
      
      let createdCount = 0;
      let failedCount = 0;

      if (typeof api.employeeOffboardingTasks.bulkCreate === 'function') {
        try {
          await api.employeeOffboardingTasks.bulkCreate(taskData);
          createdCount = taskData.length;
          console.log('[offboardingEngine] Bulk created', createdCount, 'tasks successfully');
        } catch (error) {
          console.error('[offboardingEngine] Bulk create failed:', error);
          failedCount = taskData.length;
        }
      } else {
        // Fallback to individual creates with per-task logging
        for (const taskPayload of taskData) {
          try {
            await api.employeeOffboardingTasks.create(taskPayload);
            createdCount++;
            console.log('[offboardingEngine] Created task:', taskPayload.title);
          } catch (error) {
            failedCount++;
            console.error('[offboardingEngine] Failed to create task:', taskPayload.title, error);
          }
        }
        console.log('[offboardingEngine] Individual creates:', createdCount, 'success,', failedCount, 'failed');
      }
    }

    // Notifications
    const employeeFullName = `${employee.first_name} ${employee.last_name}`;
    const employees = await api.employees.list().catch(() => []);

    for (const tt of taskTemplates) {
      let taskOwner = null;

      // FIX: handle field name variation here too
      const role = normalizeRole(tt.assignee_role || tt.assigned_to || tt.assigned_to_role);
      
      if (role === 'employee') taskOwner = employee;
      else if (role === 'manager' && employee.manager_id) {
        taskOwner = employees.find((e) => e.id === employee.manager_id);
      }

      if (taskOwner?.user_id) {
        await sendNotification({
          userId: taskOwner.user_id,
          type: 'offboarding_task_assigned',
          title: 'New offboarding task',
          message: `${employeeFullName}: ${tt.title}`,
          link: `/offboarding/manage/${offboarding.id}`,
          relatedEmployeeId: employee.id,
          relatedRequestId: offboarding.id,
        }).catch((error) => {
          console.error('Error sending offboarding task notification:', error);
        });
      }
    }
  }

  await api.employees.update(employee.id, {
    status: 'offboarding',
    termination_date: last_day,
  });

  await logForCurrentUser({
    eventType: 'offboarding_started',
    entityType: 'EmployeeOffboarding',
    entityId: offboarding.id,
    relatedEmployeeId: employee.id,
    description: `Started offboarding for ${employee.first_name} ${employee.last_name} (${exitType})`,
  });

  if (employee.manager_id) {
    const managers = await api.employees.filter({ id: employee.manager_id }).catch(() => []);
    const manager = managers?.[0];

    if (manager?.user_id) {
      const employeeFullName = `${employee.first_name} ${employee.last_name}`;
      await sendNotification({
        userId: manager.user_id,
        type: 'offboarding_started',
        title: 'Offboarding started',
        message: `${employeeFullName} has begun the offboarding process.`,
        link: `/offboarding/manage/${offboarding.id}`,
        relatedEmployeeId: employee.id,
        relatedRequestId: offboarding.id,
      }).catch((error) => {
        console.error('Error sending offboarding started notification:', error);
      });
    }
  }

  return offboarding;
}

/**
 * Complete an offboarding task (scope-safe)
 * @param {Object} api - Tenant-scoped API from useTenantApi()
 */
export async function completeOffboardingTask(api, taskId) {
  if (!api?.employeeOffboardingTasks) throw new Error('tenantApi missing employeeOffboardingTasks');
  if (!api?.employeeOffboardings) throw new Error('tenantApi missing employeeOffboardings');
  if (!api?.employees) throw new Error('tenantApi missing employees');
  
  const tasks = await api.employeeOffboardingTasks.filter({ id: taskId });
  if (tasks.length === 0) throw new Error('Task not found');
  const taskData = tasks[0];

  // ✅ Use taskData.entity_id to keep all subsequent reads scoped
  const entity_id = taskData.entity_id || null;
  if (!entity_id) throw new Error('Task is missing entity_id (scope)');

  const offboardings = await api.employeeOffboardings.filter({
    id: taskData.offboarding_id,
    entity_id,
  });
  const offboarding = offboardings?.[0] || null;

  let employee = null;
  if (offboarding?.employee_id) {
    const employees = await api.employees.filter({ id: offboarding.employee_id }).catch(() => []);
    employee = employees?.[0] || null;
  }

  let systemResult = null;
  if (taskData.system_code === 'GOOGLE_ACCOUNT_SUSPEND' && employee) {
    systemResult = await handleGoogleAccountSuspension(employee, offboarding, api);
  }

  const task = await api.employeeOffboardingTasks.update(taskId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  await logForCurrentUser({
    eventType: 'offboarding_task_completed',
    entityType: 'EmployeeOffboardingTask',
    entityId: taskId,
    relatedEmployeeId: offboarding ? offboarding.employee_id : null,
    description: `Completed offboarding task "${task.title}" for ${
      employee ? `${employee.first_name} ${employee.last_name}` : ''
    }`,
  });

  const allTasks = await api.employeeOffboardingTasks.filter({
    offboarding_id: task.offboarding_id,
    entity_id,
  });

  const requiredTasks = allTasks.filter((t) => t.required);
  const allComplete = requiredTasks.every((t) => t.status === 'completed');

  if (allComplete) {
    await api.employeeOffboardings.update(task.offboarding_id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    if (offboarding?.employee_id) {
      await api.employees.update(offboarding.employee_id, { status: 'terminated' });
    }

    await logForCurrentUser({
      eventType: 'offboarding_completed',
      entityType: 'EmployeeOffboarding',
      entityId: task.offboarding_id,
      relatedEmployeeId: offboarding ? offboarding.employee_id : null,
      description: `Offboarding completed for ${
        employee ? `${employee.first_name} ${employee.last_name}` : ''
      }`,
    });

    return { taskCompleted: true, offboardingCompleted: true, systemResult };
  }

  return { taskCompleted: true, offboardingCompleted: false, systemResult };
}

async function handleGoogleAccountSuspension(employee, offboarding, api) {
  try {
    const result = await suspendUserForEmployee(employee);

    if (result.ok) {
      await logForCurrentUser({
        eventType: 'google_account_suspended',
        entityType: 'Employee',
        entityId: employee.id,
        relatedEmployeeId: employee.id,
        description: `Google Workspace account suspended for ${employee.first_name} ${employee.last_name}`,
        metadata: { google_primary_email: employee.google_primary_email },
      });

      if (offboarding?.manager_id) {
        const managers = await api.employees.filter({ id: offboarding.manager_id }).catch(() => []);
        const manager = managers?.[0] || null;

        if (manager?.user_id) {
          await sendNotification({
            userId: manager.user_id,
            type: 'google_account_suspended',
            title: 'Google account suspended',
            message: `Google account suspended for ${employee.first_name} ${employee.last_name}.`,
            link: `/employee/${employee.id}`,
            relatedEmployeeId: employee.id,
          });
        }
      }

      return { ok: true };
    }

    await logForCurrentUser({
      eventType: 'google_account_error',
      entityType: 'Employee',
      entityId: employee.id,
      relatedEmployeeId: employee.id,
      description: `Failed to suspend Google account for ${employee.first_name} ${employee.last_name}: ${result.error}`,
    });

    return { ok: false, error: result.error };
  } catch (error) {
    console.error('Error suspending Google account:', error);
    return { ok: false, error: error.message };
  }
}

export async function getOffboardingProgress(api, offboardingId, entityId) {
  if (!api?.employeeOffboardingTasks) throw new Error('tenantApi missing employeeOffboardingTasks');
  
  const tasks = await api.employeeOffboardingTasks.filter({
    offboarding_id: offboardingId,
    ...(entityId ? { entity_id: entityId } : {}),
  });

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const requiredTasks = tasks.filter((t) => t.required);
  const requiredCompleted = requiredTasks.filter((t) => t.status === 'completed').length;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    requiredTotal: requiredTasks.length,
    requiredCompleted,
    requiredPercentage:
      requiredTasks.length > 0
        ? Math.round((requiredCompleted / requiredTasks.length) * 100)
        : 100,
  };
}

export async function getOffboardingTasksByRole(api, offboardingId, entityId) {
  if (!api?.employeeOffboardingTasks) throw new Error('tenantApi missing employeeOffboardingTasks');
  
  const tasks = await api.employeeOffboardingTasks.filter({
    offboarding_id: offboardingId,
    ...(entityId ? { entity_id: entityId } : {}),
  });

  tasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  return {
    employee: tasks.filter((t) => t.assigned_to_role === 'employee'),
    manager: tasks.filter((t) => t.assigned_to_role === 'manager'),
    hr: tasks.filter((t) => t.assigned_to_role === 'hr'),
    it: tasks.filter((t) => t.assigned_to_role === 'it'),
    finance: tasks.filter((t) => t.assigned_to_role === 'finance'),
  };
}

/**
 * Find best matching template for an employee (scope-safe)
 * @param {Object} api - Tenant-scoped API from useTenantApi()
 */
export async function findOffboardingTemplate(api, employee, exitType) {
  if (!api?.offboardingTemplates) throw new Error('tenantApi missing offboardingTemplates');
  
  const templates = await api.offboardingTemplates.filter({ active: true });

  // ✅ Do not consider templates from another entity (allow null = "any")
  const scoped = (templates || []).filter(
    (t) => !t.entity_id || t.entity_id === employee?.entity_id
  );

  const scored = scoped.map((t) => {
    let score = 0;
    if (t.entity_id && t.entity_id === employee.entity_id) score += 4;
    if (t.department && t.department === employee.department_id) score += 2;
    if (t.employment_type && t.employment_type === employee.employment_type) score += 2;
    if (t.exit_type && t.exit_type === exitType) score += 3;
    if (t.is_default) score += 1;
    return { template: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.length > 0 ? scored[0].template : null;
}

export async function pauseOffboarding(api, offboardingId) {
  if (!api?.employeeOffboardings) throw new Error('tenantApi missing employeeOffboardings');
  await api.employeeOffboardings.update(offboardingId, { status: 'draft' });
}

export async function startOffboarding(api, offboardingId) {
  if (!api?.employeeOffboardings) throw new Error('tenantApi missing employeeOffboardings');
  await api.employeeOffboardings.update(offboardingId, { status: 'in_progress' });
}

export async function cancelOffboarding(api, offboardingId) {
  if (!api?.employeeOffboardings) throw new Error('tenantApi missing employeeOffboardings');
  if (!api?.employees) throw new Error('tenantApi missing employees');
  
  const offboardings = await api.employeeOffboardings.filter({ id: offboardingId });
  if (offboardings.length === 0) return;

  const offboarding = offboardings[0];

  await api.employeeOffboardings.update(offboardingId, { status: 'cancelled' });

  await api.employees.update(offboarding.employee_id, {
    status: 'active',
    termination_date: null,
  });

  await logForCurrentUser({
    eventType: 'offboarding_cancelled',
    entityType: 'EmployeeOffboarding',
    entityId: offboardingId,
    relatedEmployeeId: offboarding.employee_id,
    description: `Offboarding cancelled`,
  });
}