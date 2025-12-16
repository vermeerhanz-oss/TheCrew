export const AssistantContextRegistry = {
  // --- Main ---
  Home: {
    title: "Dashboard",
    description: "Your personal overview showing tasks, upcoming leave, and team status.",
    suggestedQuestions: [
      "What tasks show up in my To-Do list?",
      "How do I approve leave from here?",
      "Where do I find my payslips?",
      "How do I request leave?"
    ]
  },

  // --- People ---
  Employees: {
    title: "Employee Directory",
    description: "List of all employees in the organization. View profiles, manage status, and update details.",
    suggestedQuestions: [
      "How do I add a new employee?",
      "How do I terminate an employee?",
      "Where can I see terminated staff?",
      "How do I bulk update details?"
    ]
  },
  OrgChart: {
    title: "Org Chart",
    description: "Visual view of reporting lines, managers, and team structure within the company.",
    suggestedQuestions: [
      "How do I change someone’s manager from this view?",
      "What’s a sensible reporting structure for a small startup?",
      "How do reporting lines affect leave approvals?"
    ]
  },
  EmployeeProfile: {
    title: "Employee Profile",
    description: "Detailed view of a single employee's information, including personal details, job role, compensation, and documents.",
    suggestedQuestions: [
      "Where do I find the employment contract?",
      "How do I update the salary?",
      "Can I see their leave history from here?"
    ]
  },

  // --- Leave ---
  MyLeave: {
    title: "My Leave",
    description: "Manage your own leave requests and view your leave balances.",
    suggestedQuestions: [
      "How do I submit a leave request?",
      "How do I cancel a request?",
      "Why is my balance lower than expected?",
      "Can I request half-days?"
    ]
  },
  TeamLeave: {
    title: "Team Leave",
    description: "Calendar view of your team's leave to help with resource planning.",
    suggestedQuestions: [
      "Who can see this calendar?",
      "Does it show public holidays?",
      "How far back can I see?",
      "Can I see leave reasons?"
    ]
  },
  LeaveApprovals: {
    title: "Leave Approvals",
    description: "Review and action pending leave requests from your team members.",
    suggestedQuestions: [
      "What happens when I decline a request?",
      "Can I approve a request that was submitted in the past?",
      "How do I see conflicting leave requests?"
    ]
  },
  LeaveCalendar: {
    title: "Leave Calendar",
    description: "Year view of approved and pending leave, including public holidays, so you can see staffing coverage at a glance.",
    suggestedQuestions: [
      "What do the different colours on the calendar mean?",
      "How do I filter the calendar by department or team?",
      "How do public holidays interact with leave requests?"
    ]
  },
  LeaveSummary: {
    title: "Leave Summary",
    description: "Overview of leave balances and activity for your team or the whole company.",
    suggestedQuestions: [
      "Does this include future approved leave?",
      "How are these balances calculated?",
      "Can I export this data?"
    ]
  },

  // --- Onboarding ---
  MyOnboarding: {
    title: "My Onboarding",
    description: "Your personal onboarding checklist and tasks to complete as a new hire.",
    suggestedQuestions: [
      "What happens when I complete all tasks?",
      "Who sees the documents I upload?",
      "Can I skip tasks?"
    ]
  },
  NewHireOnboardingWizard: {
    title: "Onboard New Hire",
    description: "Create a new employee record, set their compensation, work type, and assign onboarding tasks and contracts.",
    suggestedQuestions: [
      "What information do I need before onboarding a new hire?",
      "How do salary, bonuses, and work type fit together?",
      "How do I generate and send an employment contract from here?"
    ]
  },
  OnboardingManage: {
    title: "Onboarding Management",
    description: "Dashboard to track and manage all active onboarding processes for new hires.",
    suggestedQuestions: [
      "How do I check the status of a new hire?",
      "Can I nudge a manager to complete their tasks?",
      "How do I cancel an onboarding process?"
    ]
  },
  OnboardingDashboard: {
    title: "Onboarding Dashboard",
    description: "Overview of onboarding statistics and active workflows.",
    suggestedQuestions: [
      "What does 'Time to Productivity' mean?",
      "How many new hires are starting this month?",
      "Which tasks are most frequently overdue?"
    ]
  },

  // --- Offboarding ---
  Offboarding: {
    title: "Offboarding",
    description: "Manage employee departures, including exit checklists, asset return, and final pay calculations.",
    suggestedQuestions: [
      "How do I start the offboarding process?",
      "What happens to their access when I offboard them?",
      "Does this calculate final leave payouts?"
    ]
  },

  // --- Reporting ---
  ReportingOverview: {
    title: "Standard Reports",
    description: "Access to standard HR reports including demographics, leave accruals, and policy acknowledgements.",
    suggestedQuestions: [
      "What reports are available?",
      "Can I schedule these reports to be emailed?",
      "How often is the data updated?"
    ]
  },
  LeaveAccrualReport: {
    title: "Leave Accrual Report",
    description:
      "This report shows opening balances, NES-compliant leave accrual, leave taken, and closing balances for each employee. It also calculates monetary leave liability for payout-eligible leave types such as Annual Leave.",
    starterQuestions: [
      "How are opening and closing balances calculated in this report?",
      "What does 'NES-compliant accrual' mean and how is it applied here?",
      "Why does Annual Leave show liability but Personal Leave does not?",
      "How should I use this report when sending information to my accountant?",
      "How can I interpret a high closing balance for a particular employee?"
    ],
  },
  CustomReports: {
    title: "Custom Reports",
    description: "Build custom reports by selecting specific fields and filters.",
    suggestedQuestions: [
      "How do I create a report for specific departments?",
      "Can I save my report layout?",
      "What file formats can I export to?"
    ]
  },

  // --- Company ---
  CompanySettings: {
    title: "Company Settings",
    description: "Global settings for the organization, including entities, locations, and departments.",
    suggestedQuestions: [
      "How do I add a new office location?",
      "What is an Entity?",
      "How do I delete a department?",
      "Where do I set the default timezone?"
    ]
  },
  Entities: {
    title: "Legal Entities",
    description: "Manage your legal business entities (ABN/ACN) and their specific details.",
    suggestedQuestions: [
      "Why do I need multiple entities?",
      "How do I assign employees to an entity?",
      "Does this affect payroll?"
    ]
  },
  PublicHolidays: {
    title: "Public Holidays",
    description: "Manage public holiday calendars for different states and countries.",
    suggestedQuestions: [
      "How do I add a new public holiday?",
      "Can I set different holidays for different states?",
      "Do these automatically apply to leave requests?"
    ]
  },
  EmploymentAgreements: {
    title: "Employment Agreements",
    description: "Manage templates for employment contracts and agreements.",
    suggestedQuestions: [
      "How do I create a new agreement template?",
      "Can I use variables in the templates?",
      "How do I assign an agreement to an employee?"
    ]
  },
  PolicyLibrary: {
    title: "Policies",
    description: "Manage company policies and track employee acknowledgements.",
    suggestedQuestions: [
      "How do I upload a new policy?",
      "How do employees acknowledge policies?",
      "Can I see who hasn't signed a policy yet?"
    ]
  },
  LeavePolicies: {
    title: "Leave Policies",
    description: "Configure your organisation’s leave types, NES-compliant accrual rules, and which policies apply to different employees.",
    suggestedQuestions: [
      "How should I set up annual leave and personal leave for Australian employees?",
      "What does NES-compliant leave accrual mean in this system?",
      "How do I handle different entitlements for full-time and part-time staff?"
    ]
  },
  StaffingRules: {
    title: "Staffing Rules",
    description: "Set rules for minimum staffing levels and maximum concurrent leave.",
    suggestedQuestions: [
      "How do I ensure enough support staff are available?",
      "What happens if a leave request violates a rule?",
      "Can managers override these rules?"
    ]
  },
  DocumentTemplates: {
    title: "Document Templates",
    description: "Manage templates for generated documents like letters and contracts.",
    suggestedQuestions: [
      "How do I add a mail merge field?",
      "What format should the templates be in?",
      "Where are these templates used?"
    ]
  },
  OnboardingTemplates: {
    title: "Onboarding Templates",
    description: "Create and manage task lists for different roles or departments.",
    suggestedQuestions: [
      "How do I clone a template?",
      "Can I assign tasks to specific roles?",
      "How do I update a template for all future hires?"
    ]
  },

  // --- Settings ---
  Settings: {
    title: "My Settings",
    description: "Manage your personal user settings, notification preferences, and password.",
    suggestedQuestions: [
      "How do I change my password?",
      "How do I turn off email notifications?",
      "What is 'Admin Mode'?",
      "Can I change my email address?"
    ]
  }
};