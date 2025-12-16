export const OFFBOARDING_DEPARTMENT_PRESETS = {
  GENERAL: [
    { id: 'resignation-letter', title: 'Receive formal resignation letter', owner: 'HR',       duePreset: 'DAY_MINUS_14' },
    { id: 'exit-interview',     title: 'Conduct exit interview',            owner: 'HR',       duePreset: 'DAY_MINUS_2' },
    { id: 'return-equipment',   title: 'Collect company equipment (laptop, badge)', owner: 'MANAGER', duePreset: 'DAY_0' },
    { id: 'remove-access',      title: 'Revoke system access',              owner: 'IT',       duePreset: 'DAY_0' },
    { id: 'final-pay',          title: 'Process final pay',                 owner: 'FINANCE',  duePreset: 'DAY_PLUS_3' },
  ],
  ENGINEERING: [
    { id: 'resignation-letter', title: 'Receive formal resignation letter', owner: 'HR',       duePreset: 'DAY_MINUS_14' },
    { id: 'knowledge-transfer', title: 'Complete code handover / knowledge transfer', owner: 'MANAGER', duePreset: 'DAY_MINUS_3' },
    { id: 'revoke-aws',         title: 'Revoke AWS / Cloud access',         owner: 'IT',       duePreset: 'DAY_0' },
    { id: 'revoke-github',      title: 'Remove from GitHub organization',   owner: 'IT',       duePreset: 'DAY_0' },
    { id: 'return-equipment',   title: 'Collect laptop and hardware keys',  owner: 'MANAGER',  duePreset: 'DAY_0' },
    { id: 'exit-interview',     title: 'Conduct exit interview',            owner: 'HR',       duePreset: 'DAY_MINUS_2' },
  ],
  SALES: [
    { id: 'resignation-letter', title: 'Receive formal resignation letter', owner: 'HR',       duePreset: 'DAY_MINUS_14' },
    { id: 'transfer-accounts',  title: 'Transfer active accounts to new rep', owner: 'MANAGER', duePreset: 'DAY_MINUS_3' },
    { id: 'revoke-crm',         title: 'Revoke CRM access (Salesforce/HubSpot)', owner: 'IT',   duePreset: 'DAY_0' },
    { id: 'return-equipment',   title: 'Collect laptop and phone',          owner: 'MANAGER',  duePreset: 'DAY_0' },
    { id: 'commission-calc',    title: 'Calculate final commissions',       owner: 'FINANCE',  duePreset: 'DAY_PLUS_5' },
  ],
  FINANCE: [
    { id: 'resignation-letter', title: 'Receive formal resignation letter', owner: 'HR',       duePreset: 'DAY_MINUS_14' },
    { id: 'revoke-banking',     title: 'Revoke banking / payroll access',   owner: 'IT',       duePreset: 'DAY_0' },
    { id: 'handover-books',     title: 'Handover financial records access', owner: 'MANAGER',  duePreset: 'DAY_MINUS_2' },
    { id: 'return-equipment',   title: 'Collect equipment',                 owner: 'MANAGER',  duePreset: 'DAY_0' },
  ],
  IT: [
    { id: 'resignation-letter', title: 'Receive formal resignation letter', owner: 'HR',       duePreset: 'DAY_MINUS_14' },
    { id: 'admin-revoke',       title: 'Revoke Global Admin rights',        owner: 'IT',       duePreset: 'DAY_MINUS_1' },
    { id: 'credential-rotation',title: 'Rotate shared credentials',         owner: 'IT',       duePreset: 'DAY_0' },
    { id: 'return-equipment',   title: 'Collect equipment and security keys', owner: 'MANAGER', duePreset: 'DAY_0' },
  ]
};

export const OFFBOARDING_DUE_PRESETS = {
  DAY_MINUS_14: -14,
  DAY_MINUS_7: -7,
  DAY_MINUS_3: -3,
  DAY_MINUS_2: -2,
  DAY_MINUS_1: -1,
  DAY_0: 0,
  DAY_PLUS_1: 1,
  DAY_PLUS_3: 3,
  DAY_PLUS_5: 5,
};

export function resolveOffboardingDueOffset(preset) {
  return OFFBOARDING_DUE_PRESETS[preset] ?? 0;
}

export function getOffboardingDepartmentPresets(department) {
  if (!department) return OFFBOARDING_DEPARTMENT_PRESETS.GENERAL;
  const upperDept = department.toUpperCase();
  const key = Object.keys(OFFBOARDING_DEPARTMENT_PRESETS).find(k => upperDept.includes(k));
  return OFFBOARDING_DEPARTMENT_PRESETS[key] || OFFBOARDING_DEPARTMENT_PRESETS.GENERAL;
}