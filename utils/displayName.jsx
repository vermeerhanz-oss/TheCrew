/**
 * Display Name Utilities
 * 
 * Centralized functions for formatting employee names consistently across the app.
 * Preferred name is used in greetings, directories, org chart labels, and assistant messages.
 * Full legal name is shown in the full profile view.
 */

/**
 * Get the display name for an employee (preferred name or first name)
 * Use this for greetings, directories, org chart labels, assistant messages, etc.
 * 
 * @param {Object} employee - Employee object
 * @returns {string} Display name (preferred_name if set, otherwise first_name)
 */
export function getDisplayFirstName(employee) {
  if (!employee) return '';
  return employee.preferred_name || employee.first_name || '';
}

/**
 * Get the full display name for an employee
 * Uses preferred name (if set) + last name for UI displays
 * 
 * @param {Object} employee - Employee object
 * @returns {string} Full display name
 */
export function getDisplayName(employee) {
  if (!employee) return '';
  const firstName = employee.preferred_name || employee.first_name || '';
  const lastName = employee.last_name || '';
  return `${firstName} ${lastName}`.trim();
}

/**
 * Get the full legal name for an employee
 * First + Middle (if present) + Last
 * Use this for official documents, full profile views, etc.
 * 
 * @param {Object} employee - Employee object
 * @returns {string} Full legal name
 */
export function getLegalName(employee) {
  if (!employee) return '';
  const parts = [
    employee.first_name,
    employee.middle_name,
    employee.last_name
  ].filter(Boolean);
  return parts.join(' ');
}

/**
 * Get initials for avatar display
 * Uses preferred name if set, otherwise first name
 * 
 * @param {Object} employee - Employee object
 * @returns {string} Two-letter initials
 */
export function getInitials(employee) {
  if (!employee) return '';
  const firstName = employee.preferred_name || employee.first_name || '';
  const lastName = employee.last_name || '';
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

/**
 * Get a standardized label for employee selection dropdowns
 * Format: "Name — Job Title (Department)"
 * 
 * @param {Object} employee - Employee object
 * @param {Array} departments - Optional list of departments to lookup department name if only ID is present
 * @returns {string} Formatted label
 */
export function getEmployeeSelectLabel(employee, departments = []) {
  if (!employee) return '';
  
  const name = getDisplayName(employee);
  const title = employee.job_title || 'No title';
  
  let departmentName = '';
  if (employee.department_id && departments.length > 0) {
    const dept = departments.find(d => d.id === employee.department_id);
    if (dept) departmentName = dept.name;
  } else if (employee.department) {
    departmentName = employee.department; // Fallback if department is a string on the employee object
  }

  if (departmentName) {
    return `${name} — ${title} (${departmentName})`;
  }
  
  return `${name} — ${title}`;
}