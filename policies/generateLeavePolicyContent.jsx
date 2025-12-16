import { format } from 'date-fns';

/**
 * Generates markdown content for a Leave & Time Off Policy based on wizard configuration.
 * 
 * @param {Object} data - The wizard configuration data
 * @returns {string} Markdown content
 */
export function generateLeavePolicyContent(data) {
  const {
    basics,
    nesAndAward,
    accrual,
    usage,
    evidenceAndApprovals,
    carryoverAndCaps
  } = data;

  const effectiveDateStr = basics.effectiveDate 
    ? format(new Date(basics.effectiveDate), 'd MMMM yyyy') 
    : '[DATE]';

  const leaveName = basics.leaveCategory === 'CUSTOM' 
    ? basics.policyTitle 
    : formatLeaveCategory(basics.leaveCategory);

  // --- Helper Functions ---
  
  function formatLeaveCategory(cat) {
    switch (cat) {
      case 'ANNUAL': return 'Annual Leave';
      case 'PERSONAL_CARER': return 'Personal/Carer\'s Leave';
      case 'COMPASSIONATE': return 'Compassionate Leave';
      case 'FDV': return 'Family & Domestic Violence Leave';
      case 'UNPAID': return 'Unpaid Leave';
      default: return cat;
    }
  }

  function getAccrualDescription() {
    if (basics.leaveCategory === 'UNPAID' || basics.leaveCategory === 'COMPASSIONATE' || basics.leaveCategory === 'FDV') {
      return `This leave does not accrue. It is available as an entitlement per year or per occasion as specified by the National Employment Standards (NES).`;
    }

    let desc = '';
    if (accrual.annualEntitlementDays) {
      desc += `Full-time employees are entitled to ${accrual.annualEntitlementDays} days (or ${accrual.annualEntitlementHours || accrual.annualEntitlementDays * 7.6} hours) of ${leaveName} per year. `;
    } else if (accrual.annualEntitlementHours) {
      desc += `Full-time employees are entitled to ${accrual.annualEntitlementHours} hours of ${leaveName} per year. `;
    }

    if (accrual.accrualModel === 'PER_HOUR_WORKED' || accrual.accrualModel === 'PER_PAY_PERIOD') {
      desc += `Leave accrues progressively during the year according to the employee's ordinary hours of work. `;
    } else if (accrual.accrualModel === 'PER_YEAR') {
      desc += `Leave entitlement is credited annually. `;
    }

    if (accrual.proRataForPartTime) {
      desc += `Part-time employees accrue leave on a pro-rata basis equivalent to their ordinary hours of work. `;
    }

    if (accrual.startAfterMonths > 0) {
      desc += `\n\nAccess to accrued leave begins after ${accrual.startAfterMonths} months of continuous service.`;
    }

    return desc;
  }

  function getTakingLeaveDescription() {
    const parts = [];

    if (usage.canTakeInHours) {
      parts.push(`Leave can be taken in blocks as small as ${usage.minimumBlockHours || 1} hour(s).`);
    } else {
      parts.push(`Leave must generally be taken in full days.`);
    }

    if (usage.standardNoticeDays) {
      parts.push(`Employees are expected to provide at least ${usage.standardNoticeDays} days' notice where possible, except in emergencies.`);
    }

    if (usage.publicHolidayRule === 'SKIP_PUB_HOLS') {
      parts.push(`If a public holiday falls during a period of ${leaveName}, the employee is not taken to be on leave for that day (it is paid as a public holiday).`);
    } else if (usage.publicHolidayRule === 'INCLUDE_PUB_HOLS') {
      parts.push(`Public holidays falling during the leave period are counted as leave days.`);
    }

    if (usage.allowBlackoutPeriods) {
      parts.push(`\n**Blackout Periods:**\n${usage.blackoutNotes || 'The company may designate certain busy periods where leave requests may be restricted.'}`);
    }

    return parts.join('\n\n');
  }

  // --- Content Generation ---

  let content = `# ${basics.policyTitle}\n\n`;
  
  // Disclaimer
  content += `> **Note:** This policy is a general template and does not constitute legal advice. It sets out the company's guidelines for ${leaveName}.\n\n`;

  // 1. Purpose & Scope
  content += `## 1. Purpose and Scope\n\n`;
  content += `This policy outlines the entitlements and procedures for taking ${leaveName}. `;
  
  if (basics.appliesToEmploymentTypes && basics.appliesToEmploymentTypes.length > 0) {
    const types = basics.appliesToEmploymentTypes.map(t => t.replace('_', ' ').toLowerCase()).join(', ');
    content += `It applies to the following employment types: ${types}. `;
  }
  
  content += `\n\nThis policy is effective from **${effectiveDateStr}**.\n\n`;

  // 2. Entitlement & Accrual
  content += `## 2. Entitlement and Accrual\n\n`;
  
  if (nesAndAward.useNESMinimums) {
    content += `Our leave entitlements are designed to meet or exceed the National Employment Standards (NES). `;
  }
  
  content += getAccrualDescription();
  
  if (accrual.allowNegativeBalance) {
    content += `\n\nAt the manager's discretion, an employee may be permitted to go into a negative leave balance` + 
      (accrual.negativeBalanceLimitHours ? ` up to a maximum of ${accrual.negativeBalanceLimitHours} hours.` : '.');
  } else {
    content += `\n\nNegative leave balances are generally not permitted unless authorised by HR in exceptional circumstances.`;
  }
  
  content += `\n\n`;

  // 3. Taking Leave
  content += `## 3. Taking Leave\n\n`;
  content += getTakingLeaveDescription();
  content += `\n\n`;

  // 4. Evidence & Approvals
  content += `## 4. Approvals and Evidence\n\n`;
  content += `All leave requests must be approved by **${evidenceAndApprovals.approverRole || 'your Manager'}**. `;
  content += `Employees should submit requests via the company's HR system.\n\n`;

  if (basics.leaveCategory === 'PERSONAL_CARER' || basics.leaveCategory === 'SICK' || evidenceAndApprovals.evidenceRequiredAfterDays) {
    content += `Medical certificates or statutory declarations may be required for absences`;
    if (evidenceAndApprovals.evidenceRequiredAfterDays) {
      content += ` exceeding ${evidenceAndApprovals.evidenceRequiredAfterDays} consecutive days,`;
    }
    content += ` or where the absence usually precedes or follows a weekend or public holiday.\n\n`;
  }

  if (evidenceAndApprovals.evidenceNotes) {
    content += `${evidenceAndApprovals.evidenceNotes}\n\n`;
  }

  if (evidenceAndApprovals.escalationContact) {
    content += `If you have concerns about a leave request, please contact ${evidenceAndApprovals.escalationContact}.\n\n`;
  }

  // 5. Carryover and Cash-out
  if (basics.leaveCategory !== 'UNPAID' && basics.leaveCategory !== 'COMPASSIONATE' && basics.leaveCategory !== 'FDV') {
    content += `## 5. Carryover and Payout\n\n`;
    
    if (carryoverAndCaps.allowCarryover) {
      content += `Unused ${leaveName} will roll over from year to year. `;
      if (carryoverAndCaps.maxCarryoverDays) {
        content += `However, the company may direct employees to take leave if their balance exceeds ${carryoverAndCaps.maxCarryoverDays} days.`;
      }
    } else {
      content += `Unused ${leaveName} does not carry over and is forfeited at the end of the entitlement year.`;
    }
    
    content += `\n\n`;

    if (carryoverAndCaps.allowCashOut) {
      content += `**Cashing Out Leave:**\nEmployees may request to cash out a portion of their accrued leave, subject to manager approval and relevant legislation. `;
      if (carryoverAndCaps.cashOutConditions) {
        content += `${carryoverAndCaps.cashOutConditions}`;
      } else {
        content += `Generally, a minimum balance of 4 weeks must be maintained after cash-out.`;
      }
    } else {
      content += `Cashing out of ${leaveName} is generally not permitted.`;
    }
    content += `\n\n`;
  }

  // 6. Award Reference
  if (nesAndAward.awardName) {
    content += `## 6. Relevant Award\n\n`;
    content += `Where applicable, this policy should be read in conjunction with the **${nesAndAward.awardName}**. `;
    content += `Where there is any inconsistency, the more beneficial provisions for the employee will apply, subject to applicable laws.\n\n`;
    
    if (nesAndAward.awardNotes) {
      content += `${nesAndAward.awardNotes}\n\n`;
    }
  }

  return content;
}