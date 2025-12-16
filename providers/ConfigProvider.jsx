import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getCurrentUserEmployeeContextSafe } from '@/components/utils/authClient';
import { createTenantScopedApi } from '@/components/utils/tenantApi';
import { logApiError } from '@/components/utils/logger';
import { getSetupStatus } from '@/components/utils/setupService';
import { Loader2, AlertTriangle } from 'lucide-react';

// Create context with null so we can detect misuse
const ConfigContext = createContext(null);

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

// Alias if you want both names around the app
export const useAppConfig = useConfig;

// Create a refresh context for forcing config reload
const ConfigRefreshContext = createContext(null);

export function useConfigRefresh() {
  const refresh = useContext(ConfigRefreshContext);
  if (!refresh) {
    throw new Error('useConfigRefresh must be used within a ConfigProvider');
  }
  return refresh;
}

export function ConfigProvider({ children }) {
  const [state, setState] = useState({
    companySettings: null,
    leaveTypes: [],
    leavePolicies: [],
    publicHolidays: [],
    publicHolidayCalendars: [],
    branding: null,
    setupStatus: null,
    isLoading: true,
    error: null,
  });

  // Refresh trigger for forcing reload
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const refreshConfig = useCallback(() => {
    console.log('[ConfigProvider] Manual refresh triggered');
    setRefreshTrigger(v => v + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    let cancelled = false;

    const loadConfig = async () => {
      try {
        // Get tenant context which includes companySettings
        const ctx = await getCurrentUserEmployeeContextSafe();
        if (cancelled || !mounted) return;
        
        const tenantId = ctx?.employee?.entity_id || ctx?.tenantId || null;
        const bootstrapComplete = ctx?.tenantFlags?.hasCompletedBootstrap ?? true;
        
        // Guard 1: No tenantId yet
        if (!tenantId) {
          if (process.env.NODE_ENV !== "production") {
            console.debug('[ConfigProvider] No tenantId yet - skipping config load');
          }
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Guard 2: Bootstrap not complete (prevents premature config fetches)
        if (!bootstrapComplete) {
          if (process.env.NODE_ENV !== "production") {
            console.debug('[ConfigProvider] Bootstrap incomplete - skipping config load');
          }
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Use tenant-scoped API (will be guarded internally)
        const api = createTenantScopedApi({ tenantId, entityId: tenantId });

        // Guard 3: API not ready (should not happen with guards above, but defensive)
        if (!api) {
          if (process.env.NODE_ENV !== "production") {
            console.debug('[ConfigProvider] API not ready - skipping config load');
          }
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        const [
          leaveTypesRes,
          leavePoliciesRes,
          publicHolidaysRes,
          publicHolidayCalendarsRes,
        ] = await Promise.all([
          api.leaveTypes?.list?.().catch(() => []) || Promise.resolve([]),
          api.leavePolicies?.list?.().catch(() => []) || Promise.resolve([]),
          // PublicHoliday not tenant-scoped (global/regional data)
          (async () => {
            try {
              const { base44 } = await import('@/api/base44Client');
              return await base44.entities.PublicHoliday.filter(
                { is_active: true },
                '-date',
                1000
              );
            } catch {
              return [];
            }
          })(),
          // PublicHolidayCalendar not tenant-scoped (global/regional data)
          (async () => {
            try {
              const { base44 } = await import('@/api/base44Client');
              return await base44.entities.PublicHolidayCalendar.list();
            } catch {
              return [];
            }
          })(),
        ]);

        if (cancelled || !mounted) return;

        // OPTIMIZATION: Use companySettings from context instead of fetching again
        const settingsRes = ctx?.companySettings ? [ctx.companySettings] : [];

        if (cancelled || !mounted) return;

        const companySettings = settingsRes?.[0] || null;
        const leaveTypes = leaveTypesRes || [];
        const leavePolicies = leavePoliciesRes || [];
        const publicHolidays = publicHolidaysRes || [];
        const publicHolidayCalendars = publicHolidayCalendarsRes || [];
        
        // Diagnostic logging (dev only)
        if (process.env.NODE_ENV !== "production") {
          console.debug('[ConfigProvider] Loaded:', {
            tenantId,
            leaveTypes: leaveTypes?.length ?? 0,
            leavePolicies: leavePolicies?.length ?? 0,
          });
        }

        // Derive branding from companySettings
        const branding = companySettings
          ? {
              logoUrl: companySettings.logo_url || null,
              primaryColor: companySettings.primary_color || '#6366F1',
              secondaryColor: companySettings.secondary_color || '#0D1117',
              useBranding: !!companySettings.use_branding,
            }
          : null;

        // Load setup status
        const setupStatus = tenantId ? await getSetupStatus(tenantId) : null;

        setState({
          companySettings,
          leaveTypes,
          leavePolicies,
          publicHolidays,
          publicHolidayCalendars,
          branding,
          setupStatus,
          setupCompleted: setupStatus?.setupCompletedFlag || false,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (!mounted) return;

        logApiError('ConfigProvider', err);

        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err?.message || 'Failed to load configuration',
        }));
      }
    };

    loadConfig();

    return () => {
      mounted = false;
      cancelled = true;
    };
  }, [refreshTrigger]);

  if (state.isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-600">
          Loading settings...
        </p>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={state}>
      <ConfigRefreshContext.Provider value={refreshConfig}>
        {state.error && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center text-sm text-amber-800 gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Warning: {state.error}</span>
          </div>
        )}
        {children}
      </ConfigRefreshContext.Provider>
    </ConfigContext.Provider>
  );
}