/**
 * leaveTypeDropdownDedupe.js
 *
 * Front-end safety deduplication for leave type dropdown options.
 * Handles cases where leave types may be duplicated in ConfigProvider
 * or mixed from multiple sources.
 */

function normalizeName(str) {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Deduplicate leave type options for dropdown display
 * 
 * @param {Array} leaveTypes - Raw leave types from ConfigProvider or API
 * @returns {Array} Deduplicated leave types
 */
export function deduplicateLeaveTypes(leaveTypes) {
  if (!leaveTypes || leaveTypes.length === 0) return [];

  // Track seen codes and names
  const seenCodes = new Map();
  const seenNames = new Map();
  const deduplicated = [];
  const duplicates = [];

  for (const lt of leaveTypes) {
    const normalizedCode = lt.code ? normalizeName(lt.code) : null;
    const normalizedName = normalizeName(lt.name);
    
    // Prefer deduplication by code (most reliable)
    const key = normalizedCode || normalizedName;
    
    if (!key) {
      console.warn('[LeaveTypeDropdown] Skipping leave type with no code/name:', lt);
      continue;
    }

    if (seenCodes.has(key)) {
      // Duplicate found
      const existing = seenCodes.get(key);
      duplicates.push({
        key,
        existing: { id: existing.id, name: existing.name, code: existing.code },
        duplicate: { id: lt.id, name: lt.name, code: lt.code },
      });
      
      // Prefer newer/active record
      if (lt.is_active && !existing.is_active) {
        // Replace with active version
        const index = deduplicated.findIndex(d => d.id === existing.id);
        if (index >= 0) {
          deduplicated[index] = lt;
          seenCodes.set(key, lt);
        }
      }
    } else {
      seenCodes.set(key, lt);
      deduplicated.push(lt);
    }
  }

  // Diagnostic logging
  if (duplicates.length > 0) {
    console.log('[LeaveTypeDropdown] raw=', leaveTypes.length, 'deduped=', deduplicated.length, 'dupeCodes=', duplicates.map(d => d.key));
    console.log('[LeaveTypeDropdown] Duplicates found:', duplicates);
  }

  return deduplicated;
}