import React, { createContext, useContext, useState, useEffect } from 'react';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { useTenantApi } from '@/components/utils/useTenantApi';

const BrandingContext = createContext({
  logoUrl: null,
  primaryColor: '#F9FAFB',
  secondaryColor: '#020617',
  useBranding: false,
  isLoading: true,
  refresh: () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }) {
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId || null;
  const api = useTenantApi();

  const [branding, setBranding] = useState({
    logoUrl: null,
    primaryColor: '#F9FAFB',
    secondaryColor: '#020617',
    useBranding: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadBranding = async () => {
    // If we don't have a tenant yet, just keep defaults and stop
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // OPTIMIZATION: Use companySettings from EmployeeContext if available
      const settingsFromCtx = employeeCtx?.companySettings;
      
      if (settingsFromCtx) {
        // Use cached settings from context
        setBranding({
          logoUrl: settingsFromCtx.logo_url || null,
          primaryColor: settingsFromCtx.primary_color || '#F9FAFB',
          secondaryColor: settingsFromCtx.secondary_color || '#020617',
          useBranding: !!settingsFromCtx.use_branding,
        });
      } else {
        // Fallback: fetch if not in context yet
        const settings =
          (await (api.companySettings?.list() ?? Promise.resolve([]))) || [];

        if (settings.length > 0) {
          const s = settings[0];
          setBranding({
            logoUrl: s.logo_url || null,
            primaryColor: s.primary_color || '#F9FAFB',
            secondaryColor: s.secondary_color || '#020617',
            useBranding: !!s.use_branding,
          });
        } else {
          // No record – keep defaults
          setBranding((prev) => ({
            ...prev,
            useBranding: false,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading branding:', error);
      // On error, keep whatever branding we already had
    } finally {
      setIsLoading(false);
    }
  };

  // Load branding when tenant changes
  useEffect(() => {
    loadBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Apply CSS variables when branding changes
  useEffect(() => {
    if (branding.useBranding) {
      document.documentElement.style.setProperty(
        '--brand-primary',
        branding.primaryColor
      );
      document.documentElement.style.setProperty(
        '--brand-secondary',
        branding.secondaryColor
      );
    } else {
      document.documentElement.style.removeProperty('--brand-primary');
      document.documentElement.style.removeProperty('--brand-secondary');
    }
  }, [branding]);

  return (
    <BrandingContext.Provider
      value={{ ...branding, isLoading, refresh: loadBranding }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

/**
 * Get hex to RGB for CSS variable usage
 */
export function hexToRgb(hex) {
  const result =
    /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}