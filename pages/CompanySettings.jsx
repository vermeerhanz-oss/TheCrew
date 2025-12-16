import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Layers, ArrowRight, Loader2 } from 'lucide-react';
import ErrorState from '@/components/common/ErrorState';
import { logApiError } from '@/components/utils/logger';
import { getCurrentUserEmployeeContext, useEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { useTenantApi } from '@/components/utils/useTenantApi';
import SetupStatusCard from '@/components/setup/SetupStatusCard';

export default function CompanySettings() {
  const employeeCtx = useEmployeeContext();
  
  // Guard: Wait for context to load
  if (!employeeCtx) {
    console.log('[CompanySettings] Waiting for EmployeeContext…');
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const api = useTenantApi();
  const [context, setContext] = useState(null);
  const [stats, setStats] = useState({ entities: 0, locations: 0, departments: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManageCompanySettings');

  async function load() {
    setDataLoading(true);
    setError(null);
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);

      if (!ctx.permissions?.canManageCompanySettings) {
        setDataLoading(false);
        return;
      }

      const tenantId = ctx.tenantId;
      if (!tenantId) {
        setDataLoading(false);
        return;
      }

      const [entities, locations, departments] = await Promise.all([
        api.entities.list(),
        api.locations.filter({ entity_id: tenantId }),
        api.departments.filter({ entity_id: tenantId }),
      ]);

      setStats({
        entities: entities.length,
        locations: locations.length,
        departments: departments.length,
      });

      // 🔹 Backfill: ensure has_completed_bootstrap is true for existing tenants with data
      if (entities.length > 0 && locations.length > 0) {
        try {
          const settings = await api.companySettings.list().catch(() => []);
          if (settings.length > 0 && !settings[0].has_completed_bootstrap) {
            await api.companySettings.update(settings[0].id, { 
              has_completed_bootstrap: true,
              default_entity_id: settings[0].default_entity_id || entities[0].id,
              default_location_id: settings[0].default_location_id || locations[0].id,
            });
          } else if (settings.length === 0) {
            await api.companySettings.create({
              entity_id: tenantId,
              has_completed_bootstrap: true,
              default_entity_id: entities[0].id,
              default_location_id: locations[0].id,
              primary_color: '#F9FAFB',
              secondary_color: '#020617',
              use_branding: false,
            });
          }
        } catch (backfillErr) {
          console.warn('Could not backfill bootstrap flag:', backfillErr);
        }
      }
    } catch (err) {
      const userMsg = logApiError('CompanySettings', err);
      setError(userMsg);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (dataLoading || permLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!isAllowed) {
    // Fallback if useRequirePermission didn't redirect or handle it, though usually it handles redirects if configured or returns restricted UI
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const sections = [
    {
      title: 'Entities',
      description: 'Manage company entities and legal structures.',
      icon: Building2,
      page: 'Entities',
      count: stats.entities,
      dataAttr: 'company-settings-tile',
    },
    {
      title: 'Locations',
      description: 'Manage office locations and work sites.',
      icon: MapPin,
      page: 'Locations',
      count: stats.locations,
    },
    {
      title: 'Departments',
      description: 'Manage departments and teams.',
      icon: Layers,
      page: 'Departments',
      count: stats.departments,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-7 w-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Company & Entities</h1>
        </div>
        <p className="text-gray-600">
          Manage your company structure, entities, locations, and departments.
        </p>
      </div>

      {/* Setup Status Card */}
      <div className="mb-6">
        <SetupStatusCard />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sections.map((section) => (
          <Card key={section.page} className="hover:shadow-md transition-shadow" data-tutorial={section.dataAttr}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <section.icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                  <span className="text-sm text-gray-500">{section.count} configured</span>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-6">{section.description}</p>
              <Link to={createPageUrl(section.page)}>
                <Button variant="outline" className="w-full">
                  Manage
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}