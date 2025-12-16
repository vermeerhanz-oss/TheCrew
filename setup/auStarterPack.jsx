import { createTenantScopedApi } from '@/components/utils/tenantApi';

// ============================================
// AU Leave Types
// ============================================

const AU_LEAVE_TYPES = [
  {
    name: 'Annual Leave',
    code: 'ANNUAL',
    description:
      'Paid annual leave entitlement under the National Employment Standards (NES). Full-time employees are entitled to 4 weeks (20 days) per year.',
    is_paid: true,
    is_active: true,
    default_annual_entitlement_days: 20,
    requires_approval: true,
    annual_entitlement_hours_full_time: 152,
    full_time_hours_per_week: 38,
    accrual_method: 'pro_rata_hours_worked',
    is_payable_on_termination: true,
  },
  {
    name: "Personal/Carer's Leave",
    code: 'PERSONAL',
    description:
      "Paid personal/carer's leave for illness, injury, or caring for immediate family members. Full-time employees are entitled to 10 days per year.",
    is_paid: true,
    is_active: true,
    default_annual_entitlement_days: 10,
    requires_approval: true,
    annual_entitlement_hours_full_time: 76,
    full_time_hours_per_week: 38,
    accrual_method: 'pro_rata_hours_worked',
    is_payable_on_termination: false,
  },
  {
    name: 'Compassionate Leave',
    code: 'COMP',
    description:
      'Paid compassionate leave for bereavement or serious illness of a family/household member.',
    is_paid: true,
    is_active: true,
    default_annual_entitlement_days: null,
    requires_approval: true,
    accrual_method: 'none',
  },
  {
    name: 'Family & Domestic Violence Leave',
    code: 'FDV',
    description:
      'Leave for situations of family and domestic violence, as per Fair Work guidance.',
    is_paid: true,
    is_active: true,
    default_annual_entitlement_days: null,
    requires_approval: true,
    accrual_method: 'none',
  },
  {
    name: 'Community Service Leave',
    code: 'COMMUNITY',
    description:
      'Leave for jury duty, voluntary emergency management activities, or other community service activities.',
    is_paid: true,
    is_active: true,
    default_annual_entitlement_days: null,
    requires_approval: true,
    accrual_method: 'none',
  },
  {
    name: 'Long Service Leave',
    code: 'LSL',
    description:
      'Long service leave entitlements vary by state/territory. Generally available after 7-10 years of continuous service.',
    is_paid: true,
    is_active: true,
    default_annual_entitlement_days: null,
    requires_approval: true,
    accrual_method: 'none', // LSL is complex, using standard logic for now
    is_payable_on_termination: true,
  },
  {
    name: 'Unpaid Leave',
    code: 'UNPAID',
    description:
      'Leave without pay for personal reasons not covered by other leave types.',
    is_paid: false,
    is_active: true,
    default_annual_entitlement_days: null,
    requires_approval: true,
    accrual_method: 'none',
  },
];

// ============================================
// AU Public Holidays
// ============================================

const AU_CALENDARS = [
  { name: 'Australia - National', code: 'AU_NATIONAL', country: 'Australia', state_or_region: null },
  { name: 'New South Wales (NSW)', code: 'NSW', country: 'Australia', state_or_region: 'NSW' },
  { name: 'Victoria (VIC)', code: 'VIC', country: 'Australia', state_or_region: 'VIC' },
  { name: 'Queensland (QLD)', code: 'QLD', country: 'Australia', state_or_region: 'QLD' },
  { name: 'Western Australia (WA)', code: 'WA', country: 'Australia', state_or_region: 'WA' },
  { name: 'South Australia (SA)', code: 'SA', country: 'Australia', state_or_region: 'SA' },
];

// 2025 dates (approximate for demo)
const AU_NATIONAL_HOLIDAYS = [
  { name: "New Year's Day", date: '2025-01-01' },
  { name: 'Australia Day', date: '2025-01-27' },
  { name: 'Good Friday', date: '2025-04-18' },
  { name: 'Easter Saturday', date: '2025-04-19' },
  { name: 'Easter Monday', date: '2025-04-21' },
  { name: 'ANZAC Day', date: '2025-04-25' },
  { name: 'Christmas Day', date: '2025-12-25' },
  { name: 'Boxing Day', date: '2025-12-26' },
];

const NSW_HOLIDAYS = [
  { name: "Queen's Birthday", date: '2025-06-09' },
  { name: 'Bank Holiday', date: '2025-08-04' },
];

const VIC_HOLIDAYS = [
  { name: 'Labour Day', date: '2025-03-10' },
  { name: "Queen's Birthday", date: '2025-06-09' },
  { name: 'Melbourne Cup Day', date: '2025-11-04' },
];

const QLD_HOLIDAYS = [
  { name: 'Labour Day', date: '2025-05-05' },
  { name: "Queen's Birthday", date: '2025-10-06' },
];

const WA_HOLIDAYS = [
  { name: 'Labour Day', date: '2025-03-03' },
  { name: 'Western Australia Day', date: '2025-06-02' },
  { name: "Queen's Birthday", date: '2025-09-29' },
];

const SA_HOLIDAYS = [
  { name: 'Adelaide Cup Day', date: '2025-03-10' },
  { name: "Queen's Birthday", date: '2025-06-09' },
  { name: 'Proclamation Day', date: '2025-12-24' },
];

// ============================================
// AU Policies
// ============================================

const AU_POLICIES = [
  {
    title: 'Code of Conduct',
    description: 'Standards of behaviour and ethics expected of all employees.',
    category: 'HR',
    requires_acknowledgement: true,
    content: `# Code of Conduct

## Purpose
This Code of Conduct outlines the standards of behaviour expected of all employees. It provides guidance on ethical conduct and professional standards.

## Key Principles
- **Integrity**: Act honestly and ethically in all dealings.
- **Respect**: Treat colleagues, customers, and stakeholders with dignity and respect.
- **Compliance**: Follow all applicable laws, regulations, and company policies.
- **Confidentiality**: Protect sensitive company and customer information.

## Expected Behaviours
- Maintain professional relationships with all colleagues
- Report any conflicts of interest
- Use company resources responsibly
- Avoid discrimination and harassment

## Reporting Concerns
If you witness or experience behaviour that violates this code, please report it to your manager or HR.

---
*This is a template policy. Please review with your legal/HR team before implementing.*`,
  },
  {
    title: 'Work Health & Safety (WHS) Policy',
    description: 'Commitment to providing a safe and healthy workplace.',
    category: 'Safety',
    requires_acknowledgement: true,
    content: `# Work Health & Safety Policy

## Purpose
This policy outlines our commitment to providing a safe and healthy workplace for all workers, contractors, and visitors in compliance with the Work Health and Safety Act 2011.

## Responsibilities

### Employer Responsibilities
- Provide and maintain a safe work environment
- Provide adequate facilities and training
- Ensure safe systems of work
- Consult with workers on health and safety matters

### Employee Responsibilities
- Take reasonable care of your own health and safety
- Take reasonable care not to adversely affect others' health and safety
- Comply with reasonable instructions and policies
- Report hazards and incidents promptly

## Hazard Reporting
All hazards, near misses, and incidents must be reported to your supervisor immediately.

## Emergency Procedures
Familiarise yourself with emergency evacuation procedures and assembly points.

---
*This is a template policy. Please review with your WHS advisor before implementing.*`,
  },
  {
    title: 'Equal Employment Opportunity Policy',
    description: 'Commitment to a discrimination-free workplace.',
    category: 'HR',
    requires_acknowledgement: true,
    content: `# Equal Employment Opportunity Policy

## Purpose
This policy affirms our commitment to providing equal employment opportunities and maintaining a workplace free from discrimination, harassment, and bullying.

## Scope
This policy applies to all aspects of employment including recruitment, selection, training, promotion, and termination.

## Protected Attributes
We do not discriminate based on:
- Race, colour, national origin, or ethnic background
- Sex, gender identity, or sexual orientation
- Age
- Disability
- Religion
- Family or carer's responsibilities
- Pregnancy
- Political opinion

## Harassment and Bullying
Workplace harassment and bullying are not tolerated. This includes:
- Unwelcome sexual advances
- Offensive comments or jokes
- Intimidation or exclusion
- Cyberbullying

## Complaints Process
If you experience or witness discrimination, harassment, or bullying, please report it to your manager or HR.

---
*This is a template policy. Please review with your legal/HR team before implementing.*`,
  },
  {
    title: 'Leave Policy',
    description: 'Overview of employee leave entitlements and procedures.',
    category: 'HR',
    requires_acknowledgement: false,
    content: `# Leave Policy

## Purpose
This policy outlines the types of leave available to employees and the procedures for requesting leave.

## Leave Types

### Annual Leave
Full-time employees accrue 4 weeks (20 days) of paid annual leave per year. Part-time employees accrue leave on a pro-rata basis.

### Personal/Carer's Leave
Full-time employees are entitled to 10 days of paid personal/carer's leave per year for illness or caring responsibilities.

### Long Service Leave
Entitlements vary by state/territory. Generally available after 7-10 years of continuous service.

### Parental Leave
Eligible employees may take up to 12 months of unpaid parental leave with the right to request an additional 12 months.

## Requesting Leave
1. Submit leave requests through the HRIS system
2. Provide reasonable notice (minimum 4 weeks for annual leave)
3. Await manager approval before confirming travel arrangements

## Public Holidays
Employees are entitled to public holidays applicable to their work location.

---
*This is a template policy. Please review with your legal/HR team before implementing.*`,
  },
  {
    title: 'IT / Acceptable Use Policy',
    description: 'Guidelines for appropriate use of company IT resources.',
    category: 'IT',
    requires_acknowledgement: true,
    content: `# IT / Acceptable Use Policy

## Purpose
This policy sets out the acceptable use of company IT resources including computers, email, internet, and mobile devices.

## Scope
This policy applies to all employees, contractors, and visitors using company IT systems.

## Acceptable Use
- Use IT resources primarily for business purposes
- Protect your passwords and access credentials
- Lock your computer when away from your desk
- Report security incidents immediately

## Prohibited Activities
- Accessing inappropriate or illegal content
- Installing unauthorised software
- Sharing passwords or access credentials
- Using company resources for personal commercial activities
- Sending spam or malicious content

## Email and Internet
- Business emails may be monitored
- Personal use of internet should be minimal and reasonable
- Do not send confidential information via unsecured channels

## Data Security
- Store business data on approved systems only
- Do not copy sensitive data to personal devices
- Report lost or stolen devices immediately

## Consequences
Violation of this policy may result in disciplinary action, up to and including termination.

---
*This is a template policy. Please review with your IT security team before implementing.*`,
  },
  {
    title: 'Compassionate & Family Leave Policy',
    description:
      'Overview of Compassionate Leave and Family & Domestic Violence Leave entitlements.',
    category: 'HR',
    requires_acknowledgement: false,
    content: `# Compassionate & Family Leave Policy

## Purpose
This policy outlines entitlements to Compassionate Leave and Family & Domestic Violence Leave.

## Compassionate Leave
Employees are entitled to 2 days of compassionate leave per occasion when a member of their immediate family or household dies or contracts a life-threatening illness or injury.

### Entitlement
- **Full-time & Part-time employees**: Paid leave.
- **Casual employees**: Unpaid leave.

### Notice & Evidence
You must give your manager notice as soon as practicable and may be required to provide evidence (e.g., death certificate or medical certificate).

## Family & Domestic Violence Leave
All employees (including casuals) are entitled to 10 days of paid family and domestic violence leave each year.

### Purpose
This leave is available if you need to do something to deal with the impact of family and domestic violence and it is impractical to do so outside of work hours.

### Confidentiality
Information about family and domestic violence leave will be handled with strict confidentiality and sensitivity.

---
*This is a template policy. Please review with your legal/HR team before implementing.*`,
  },
];

// ============================================
// AU Onboarding Tasks
// ============================================

const AU_ONBOARDING_TASKS = [
  // HR Tasks
  { title: 'Collect Tax File Number (TFN) declaration form', assignee_role: 'hr', sort_order: 1 },
  { title: 'Collect Superannuation standard choice form', assignee_role: 'hr', sort_order: 2 },
  { title: 'Collect bank account details for payroll', assignee_role: 'hr', sort_order: 3 },
  { title: 'Provide Fair Work Information Statement to employee', assignee_role: 'hr', sort_order: 4 },

  // Employee Tasks
  { title: 'Review and acknowledge the Code of Conduct', assignee_role: 'employee', sort_order: 10 },
  { title: 'Review and acknowledge WHS/OHS Policy', assignee_role: 'employee', sort_order: 11 },
  { title: 'Review and acknowledge IT / Acceptable Use Policy', assignee_role: 'employee', sort_order: 12 },
];

// ============================================
// Helpers
// ============================================

async function findOrCreateLeaveType(api, attrs) {
  const existing = await api.leaveTypes.filter({ code: attrs.code });
  if (existing && existing.length > 0) return { record: existing[0], created: false };
  const created = await api.leaveTypes.create(attrs);
  return { record: created, created: true };
}

async function findOrCreateCalendar(api, attrs) {
  const existing = await api.publicHolidayCalendars?.filter({ code: attrs.code }) || [];
  if (existing.length > 0) return { record: existing[0], created: false };
  const created = await api.publicHolidayCalendars?.create(attrs);
  return { record: created, created: true };
}

async function findOrCreateHoliday(api, calendarId, attrs) {
  const existing = await api.publicHolidays?.filter({ calendar_id: calendarId, date: attrs.date }) || [];
  if (existing.length > 0) return { record: existing[0], created: false };
  const created = await api.publicHolidays?.create({ ...attrs, calendar_id: calendarId });
  return { record: created, created: true };
}

async function findOrCreatePolicy(api, attrs) {
  const existing = await api.policies.filter({ title: attrs.title });
  if (existing && existing.length > 0) return { record: existing[0], created: false };
  const created = await api.policies.create({ ...attrs, is_active: true });
  return { record: created, created: true };
}

async function findOrCreateOnboardingTemplate(api, attrs) {
  const all = await api.onboardingTemplates.list();
  const existing = all.find((t) => t.name === attrs.name);
  if (existing) return { record: existing, created: false };
  const created = await api.onboardingTemplates.create(attrs);
  return { record: created, created: true };
}

async function findOrCreateOnboardingTask(api, templateId, attrs) {
  const existing = await api.onboardingTaskTemplates.filter({
    template_id: templateId,
    title: attrs.title,
  });
  if (existing && existing.length > 0) return { record: existing[0], created: false };
  const created = await api.onboardingTaskTemplates.create({ ...attrs, template_id: templateId });
  return { record: created, created: true };
}

// ============================================
// Main Starter Pack Function
// ============================================

/**
 * Run AU starter pack:
 *  - Seed NES-style leave types
 *  - Seed AU public holiday calendars + 2025 holidays
 *  - Link a location to the appropriate calendar (national + state)
 *  - Seed baseline HR / WHS / IT policies
 *  - Seed standard onboarding template with AU-specific tasks
 *
 * MULTI-TENANT: All entities created with entity_id for proper tenant isolation.
 *
 * Idempotent: running multiple times should not duplicate records.
 * 
 * @param {string} tenantId - The entity_id for the tenant
 * @param {string} companyId - Legacy company ID (optional)
 * @param {string} locationId - Location ID to link holidays
 * @param {string} locationState - State code (NSW, VIC, etc.)
 */
export async function runAUStarterPack(tenantId, companyId, locationId, locationState) {
  if (!tenantId) {
    console.error('[auStarterPack] No tenantId provided - cannot create tenant-scoped data');
    return {
      leaveTypes: 0,
      calendars: 0,
      holidays: 0,
      policies: 0,
      onboardingTasks: 0,
      error: 'No tenantId provided'
    };
  }

  const api = createTenantScopedApi(tenantId);

  const results = {
    leaveTypes: 0,
    calendars: 0,
    holidays: 0,
    policies: 0,
    onboardingTasks: 0,
  };

  // 1. Create Leave Types
  for (const lt of AU_LEAVE_TYPES) {
    const { created } = await findOrCreateLeaveType(api, lt);
    if (created) results.leaveTypes++;
  }

  // 2. Create Public Holiday Calendars (if API supports them)
  const calendarIdMap = {};
  if (api.publicHolidayCalendars) {
    for (const cal of AU_CALENDARS) {
      const { record, created } = await findOrCreateCalendar(api, cal);
      calendarIdMap[cal.code] = record.id;
      if (created) results.calendars++;
    }

    // 3. Create Public Holidays
    const createHolidays = async (calendarCode, holidays) => {
      const calId = calendarIdMap[calendarCode];
      if (!calId) return;
      for (const h of holidays) {
        const { created } = await findOrCreateHoliday(api, calId, h);
        if (created) results.holidays++;
      }
    };

    await createHolidays('AU_NATIONAL', AU_NATIONAL_HOLIDAYS);
    await createHolidays('NSW', NSW_HOLIDAYS);
    await createHolidays('VIC', VIC_HOLIDAYS);
    await createHolidays('QLD', QLD_HOLIDAYS);
    await createHolidays('WA', WA_HOLIDAYS);
    await createHolidays('SA', SA_HOLIDAYS);

    // 4. Link Location to appropriate calendar (idempotent update)
    let calendarToLink = calendarIdMap['AU_NATIONAL'];
    const stateCode = locationState;
    if (stateCode && calendarIdMap[stateCode]) {
      calendarToLink = calendarIdMap[stateCode];
    }

    if (calendarToLink && locationId) {
      const locs = await api.locations.filter({ id: locationId });
      if (locs.length > 0 && locs[0].public_holiday_calendar_id !== calendarToLink) {
        await api.locations.update(locationId, { public_holiday_calendar_id: calendarToLink });
      }
    }
  }

  // 5. Create Policies
  for (const policy of AU_POLICIES) {
    const { created } = await findOrCreatePolicy(api, policy);
    if (created) results.policies++;
  }

  // 6. Add AU-specific onboarding tasks to Standard Onboarding template
  const { record: standardTemplate } = await findOrCreateOnboardingTemplate(api, {
    name: 'Standard Onboarding',
    description: 'Standard onboarding process for new employees',
    active: true,
  });

  for (const task of AU_ONBOARDING_TASKS) {
    const { created } = await findOrCreateOnboardingTask(api, standardTemplate.id, {
      title: task.title,
      description: '',
      assignee_role: task.assignee_role,
      sort_order: task.sort_order,
    });
    if (created) results.onboardingTasks++;
  }

  return results;
}

/**
 * Map an AU state/territory code to the appropriate calendar code.
 */
export function getStateCalendarCode(state) {
  const stateMap = {
    NSW: 'NSW',
    VIC: 'VIC',
    QLD: 'QLD',
    WA: 'WA',
    SA: 'SA',
    TAS: 'AU_NATIONAL',
    ACT: 'AU_NATIONAL',
    NT: 'AU_NATIONAL',
  };
  return state ? stateMap[state] || 'AU_NATIONAL' : 'AU_NATIONAL';
}