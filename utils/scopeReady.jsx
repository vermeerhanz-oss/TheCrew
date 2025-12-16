/**
 * Shared scope readiness helper for template wizards
 * Returns scope status and logs warning if not ready
 */
export function getScopeStatus(api, employeeCtx) {
  const scopeReady = !!api?.__entityId;
  const entityId = api?.__entityId || null;
  const tenantId = employeeCtx?.tenantId || null;
  
  if (!scopeReady) {
    console.warn('[Scope] not ready', { 
      tenantId, 
      entityId, 
      hasApi: !!api 
    });
  }
  
  return { scopeReady, entityId, tenantId };
}