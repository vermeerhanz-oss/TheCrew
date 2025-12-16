/**
 * useScope.jsx
 * 
 * Central scope guard hook that exposes tenant scope status.
 * Keeps last-known-good scope during route changes to prevent unscoped API calls.
 */

import { useMemo, useRef } from 'react';
import { useEmployeeContext } from './EmployeeContext';

export function useScope() {
  const ctx = useEmployeeContext();
  
  const lastGoodRef = useRef({
    tenantId: null,
    entityId: null,
    userEmail: null,
    isReady: false,
  });

  const tenantId = ctx?.tenantId || null;
  const entityId = 
    ctx?.entityId ||
    ctx?.companyEntityId ||
    ctx?.company_entity_id ||
    ctx?.entity_id ||
    tenantId ||
    null;

  const userEmail = ctx?.user?.email || ctx?.employee?.email || null;
  
  // isReady = we have both tenantId/entityId AND employee context is loaded
  const isReady = !!(
    tenantId && 
    entityId && 
    ctx?.employee && 
    (ctx?.employees?.length > 0 || ctx?.isAdmin)
  );

  // If we have valid scope, update last-good
  if (isReady && tenantId && entityId) {
    lastGoodRef.current = {
      tenantId,
      entityId,
      userEmail,
      isReady: true,
    };
  }

  // If scope is missing, return last-good with isReady=false
  if (!isReady || !tenantId || !entityId) {
    return {
      ...lastGoodRef.current,
      isReady: false, // Override to false when current scope is missing
    };
  }

  return {
    tenantId,
    entityId,
    userEmail,
    isReady,
  };
}