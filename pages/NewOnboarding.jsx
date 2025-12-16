import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, UserPlus, List, Loader2 } from 'lucide-react';

import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { useTenantApi } from '@/components/utils/useTenantApi';

import NewHireForm from '@/components/onboarding/NewHireForm';
import TemplateSelection from '@/components/onboarding/TemplateSelection';
import OnboardingTable from '@/components/onboarding/OnboardingRunsTable';

export default function NewOnboarding() {
  const navigate = useNavigate();
  const api = useTenantApi();

  const [userContext, setUserContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new');

  // Wizard state
  const [step, setStep] = useState(1);
  const [newHireData, setNewHireData] = useState(null);

  // Lookup data (tenant-scoped)
  const [entities, setEntities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);

  const { isAllowed, isLoading: permLoading } = useRequirePermission(
    userContext,
    'canManageOnboarding'
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]); // re-run if tenant changes

  const loadData = async () => {
    try {
      setIsLoading(true);

      const ctx = await getCurrentUserEmployeeContext();
      setUserContext(ctx);

      if (!ctx.permissions?.canManageOnboarding) {
        setIsLoading(false);
        return;
      }

const [ents, depts, locs, emps, tmps] = await Promise.all([
  api.entities.list(),
  api.departments.list(),
  api.locations.list(),
  api.employees.filter({ status: 'active' }),
  api.onboardingTemplates.filter({ active: true }),
]);


      setEntities(ents || []);
      setDepartments(depts || []);
      setLocations(locs || []);
      setEmployees(emps || []);
      setTemplates(tmps || []);
    } catch (error) {
      console.error('[NewOnboarding] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewHireNext = (data) => {
    setNewHireData(data);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleComplete = () => {
    // Redirect to manage view
    setActiveTab('manage');
    setStep(1);
    setNewHireData(null);
    loadData();
  };

  if (isLoading || permLoading || !isAllowed) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
          <p className="text-gray-500 mt-1">
            Create new hires and manage onboarding
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="new" className="flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" />
              New Hire
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-1.5">
              <List className="h-4 w-4" />
              Manage
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'new' && (
        <>
          {step === 1 && (
            <NewHireForm
              userContext={userContext}
              entities={entities}
              departments={departments}
              locations={locations}
              employees={employees}
              onNext={handleNewHireNext}
              initialData={newHireData}
            />
          )}

          {step === 2 && newHireData && (
            <TemplateSelection
              userContext={userContext}
              newHireData={newHireData}
              templates={templates}
              onBack={handleBack}
              onComplete={handleComplete}
            />
          )}
        </>
      )}

      {activeTab === 'manage' && (
        <OnboardingTable
          userContext={userContext}
          entities={entities}
          employees={employees}
        />
      )}
    </div>
  );
}