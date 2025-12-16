export function generateCodeOfConductContent(data) {
  const { basics, respectfulWorkplace, professionalConduct, reportingAndConsequences } = data;
  const companyName = basics.entityName || "[the Company]";
  
  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "Effective Date";
    try {
      return new Date(dateStr).toLocaleDateString('en-AU', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });
    } catch (e) {
      return dateStr;
    }
  };

  const sections = [];

  // Title & Header
  sections.push(`# ${basics.policyTitle || 'Code of Conduct & Workplace Behaviour Policy'}`);
  sections.push(`**Effective Date:** ${formatDate(basics.effectiveDate)}`);
  sections.push(`**Policy Owner:** ${basics.policyOwner || 'Management'}`);
  
  if (basics.appliesTo && basics.appliesTo.length > 0) {
    sections.push(`**Applies To:** ${basics.appliesTo.join(', ')}`);
  }

  // 1. Introduction
  sections.push(`## 1. Introduction`);
  sections.push(`${companyName} is committed to fostering a safe, inclusive, and professional workplace. This Code of Conduct ("the Code") sets out the standards of behaviour expected of all workers.`);
  sections.push(`This Code is not a term of any contract of employment or engagement and may be varied by the Company from time to time.`);

  // 2. Purpose & Scope
  sections.push(`## 2. Purpose and Scope`);
  sections.push(`The purpose of this Code is to ensuring that all workers understand the Company’s expectations regarding professional conduct, ethics, and workplace behaviour.`);
  sections.push(`This Code applies to all employees, contractors, volunteers, and other workers engaged by ${companyName}. It applies during work hours, at work-related events (including social functions), and in any situation where a person is representing the Company.`);

  // 3. Core Values
  if (basics.companyCoreValues) {
    sections.push(`## 3. Core Values`);
    sections.push(`Our culture is defined by our core values, which should guide all interactions and decisions:`);
    sections.push(`> ${basics.companyCoreValues.split('\n').join('\n> ')}`);
  }

  // 4. Respectful Workplace & Anti-Discrimination
  sections.push(`## 4. Respectful Workplace & Anti-Discrimination`);
  if (respectfulWorkplace.zeroToleranceConfirmed) {
    sections.push(`**Zero Tolerance:** ${companyName} has a zero-tolerance approach to discrimination, bullying, harassment, sexual harassment, and victimisation. Any such behaviour will be treated as serious misconduct.`);
  }
  
  sections.push(`We are committed to providing a workplace free from unlawful discrimination and harassment. Under Australian law, this includes protection against discrimination based on attributes such as:`);
  sections.push(`- Race, colour, descent, or national/ethnic origin`);
  sections.push(`- Sex, gender identity, or intersex status`);
  sections.push(`- Sexual orientation`);
  sections.push(`- Age`);
  sections.push(`- Disability (physical or mental)`);
  sections.push(`- Marital or relationship status`);
  sections.push(`- Pregnancy, breastfeeding, or family responsibilities`);
  sections.push(`- Religion or political opinion`);

  // 5. Sexual Harassment and Positive Duty
  sections.push(`## 5. Sexual Harassment and Positive Duty`);
  sections.push(`Sexual harassment is unwelcome conduct of a sexual nature that makes a person feel offended, humiliated, or intimidated. It is unlawful under the *Sex Discrimination Act 1984* (Cth).`);
  sections.push(`${companyName} acknowledges its positive duty to take reasonable and proportionate measures to eliminate sexual harassment, sex-based harassment, and hostile workplace environments.`);
  sections.push(`All workers are expected to contribute to a culture of respect and to speak up or report concerns if they witness inappropriate behaviour.`);

  // 6. Work Health & Safety (WHS)
  if (respectfulWorkplace.includeWHSClause) {
    sections.push(`## 6. Work Health & Safety`);
    sections.push(`All workers have a duty under Work Health and Safety laws to take reasonable care for their own health and safety and that of others.`);
    sections.push(`This includes psychological health. Workers must comply with any reasonable instruction or policy given by the Company relating to health and safety, including policies on bullying, fatigue, and drug and alcohol use.`);
  }

  // 7. Professional Conduct & Business Ethics
  sections.push(`## 7. Professional Conduct & Business Ethics`);
  sections.push(`Workers are expected to:`);
  sections.push(`- Act with honesty, integrity, and professionalism at all times.`);
  sections.push(`- Perform their duties to the best of their ability.`);
  sections.push(`- Treat colleagues, customers, and stakeholders with courtesy and respect.`);
  sections.push(`- Comply with all applicable laws and regulations.`);

  // 8. Confidential Information
  if (professionalConduct.confidentialityConfirmed) {
    sections.push(`## 8. Confidential Information`);
    sections.push(`Workers must protect the confidential information of ${companyName}, its clients, and its employees. Confidential information includes client lists, trade secrets, financial data, and personal information.`);
    sections.push(`This obligation continues even after employment or engagement ceases. Data must not be accessed, used, or disclosed without authorisation.`);
  }

  // 9. Conflicts of Interest
  sections.push(`## 9. Conflicts of Interest`);
  sections.push(`A conflict of interest occurs when a worker’s personal interests conflict, or appear to conflict, with the interests of the Company.`);
  sections.push(`**Disclosure Process:**`);
  sections.push(professionalConduct.conflictsProcess || "Workers must disclose any actual or potential conflict of interest to their manager immediately.");

  // 10. Social Media & Public Comment
  if (respectfulWorkplace.socialMediaGuidelines) {
    sections.push(`## 10. Social Media & Public Comment`);
    sections.push(respectfulWorkplace.socialMediaGuidelines);
  }

  // 11. Use of Company Assets
  if (professionalConduct.includeITUseGuidelines) {
    sections.push(`## 11. Use of Company Assets & IT Systems`);
    sections.push(`Company assets, including computers, internet access, email, and software, are provided for business purposes.`);
    sections.push(`- Limited personal use is permitted provided it does not interfere with work duties.`);
    sections.push(`- IT systems must not be used to access, store, or distribute offensive, illegal, or inappropriate material.`);
    sections.push(`- The Company reserves the right to monitor the use of its IT systems and devices to ensure compliance with this policy.`);
  }

  // 12. Reporting Concerns
  sections.push(`## 12. Reporting Concerns`);
  sections.push(`If you witness or experience behaviour that breaches this Code, you are encouraged to report it.`);
  
  sections.push(`**Primary Contact:** ${reportingAndConsequences.primaryReportingContact || "Your Manager"}`);
  if (reportingAndConsequences.alternativeReportingContact) {
    sections.push(`**Alternative Contact:** ${reportingAndConsequences.alternativeReportingContact}`);
  }
  sections.push(`Reports will be treated seriously and, where appropriate, confidentially. The Company prohibits victimisation of any person who raises a genuine concern.`);

  // 13. Breaches of this Policy
  sections.push(`## 13. Breaches of this Policy`);
  if (reportingAndConsequences.consequencesConfirmed) {
    sections.push(`Compliance with this Code is mandatory. Breaches may lead to disciplinary action, depending on the severity of the misconduct.`);
    sections.push(`Disciplinary outcomes may include counseling, warnings, or termination of employment or engagement.`);
  } else {
    sections.push(`Failure to comply with this Code may result in disciplinary action.`);
  }

  return sections.join('\n\n');
}