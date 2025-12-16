import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { createPageUrl } from '@/utils';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Building2,
  Loader2,
  Shield,
  UserMinus,
} from 'lucide-react';

import {
  canActOnEmployee,
  canActAsAdmin,
  canManageOffboarding,
  isSensitiveFieldVisible,
} from '@/components/utils/permissions';

import StartOffboardingWizard from '@/components/offboarding/StartOffboardingWizard';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import { EmployeeProfileNav } from '@/components/employees/EmployeeProfileNav';
import ProfileHelper from '@/components/employee-profile/ProfileHelper';

import ProfilePersonalSection from '@/components/employee-profile/ProfilePersonalSection';
import ProfileWorkSection from '@/components/employee-profile/ProfileWorkSection';
import ProfileCompensationSection from '@/components/employee-profile/ProfileCompensationSection';
import ProfileLocationSection from '@/components/employee-profile/ProfileLocationSection';
import ProfileEntitySection from '@/components/employee-profile/ProfileEntitySection';
import ProfileDocumentsSection from '@/components/employee-profile/ProfileDocumentsSection';
import ProfileActivitySection from '@/components/employee-profile/ProfileActivitySection';
import ProfileLeaveSection from '@/components/employee-profile/ProfileLeaveSection';
import ProfileTimelineSection from '@/components/employee-profile/ProfileTimelineSection';
import ProfileGoogleSection from '@/components/employee-profile/ProfileGoogleSection';
import ProfileOnboardingSection from '@/components/employee-profile/ProfileOnboardingSection';
import ProfilePoliciesSection from '@/components/employee-profile/ProfilePoliciesSection';
import ProfileSuperSection from '@/components/employee-profile/ProfileSuperSection';
import ProfileWorkAuthorisationSection from '@/components/employee-profile/ProfileWorkAuthorisationSection';
import ProfileDevicesSection from '@/components/employee-profile/ProfileDevicesSection';

export default function EmployeeProfile() {
  const employeeCtx = useEmployeeContext();
  const api = useTenantApi();
  const navigate = useNavigate();
  const location = useLocation();

  const tenantId = employeeCtx?.tenantId || null;

  // ✅ Correct query parsing for SPA
  const urlParams = new URLSearchParams(location.search);
  const employeeId = urlParams.get('id');
  const tabFromUrl = urlParams.get('tab');

  const [employee, setEmployee] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [preferences, setPreferences] = useState(null);

  const [entity, setEntity] = useState(null);
  const [department, setDepartment] = useState(null);
  const [locationObj, setLocationObj] = useState(null);
  const [manager, setManager] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [editPermission, setEditPermission] = useState(false);
  const [canViewSensitive, setCanViewSensitive] = useState(false);
  const [canOffboard, setCanOffboard] = useState(false);

  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedSection, setSelectedSection] = useState('personal');
  const [showOffboardingWizard, setShowOffboardingWizard] = useState(false);

  const [documentCount, setDocumentCount] = useState(0);
  const [policiesCount, setPoliciesCount] = useState(0);
  const [isManagerOfEmployee, setIsManagerOfEmployee] = useState(false);

  // helpers
  const [showPersonalHelper, setShowPersonalHelper] = useState(false);
  const [showContinueToWorkHelper, setShowContinueToWorkHelper] = useState(false);
  const [showWorkHelper, setShowWorkHelper] = useState(false);
  const [showContinueToCompHelper, setShowContinueToCompHelper] = useState(false);

  // ✅ keep tab in sync with URL
  useEffect(() => {
    if (tabFromUrl) setSelectedSection(tabFromUrl);
  }, [tabFromUrl]);

  // ✅ If someone hits this route without ?id=, don’t leave a broken screen
  useEffect(() => {
    if (!employeeId) {
      console.warn('[EmployeeProfile] Missing ?id= — redirecting to Employees');
      navigate(createPageUrl('Employees'));
    }
  }, [employeeId, navigate]);

  // ✅ main loader
  useEffect(() => {
    if (!employeeId) return;
    if (!tenantId) return;
    if (!api) return;

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, tenantId, api]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // api is guaranteed not-null here (guarded by effect)
      const user = await base44.auth.me();
      setCurrentUser(user);

      const prefsArr = await api.userPreferences.filter({ user_id: user.id });
      const userPrefs = prefsArr?.[0] || { acting_mode: 'admin' };
      setPreferences(userPrefs);

      const emps = await api.employees.list();
      setAllEmployees(emps || []);

      const userEmployee = (emps || []).find(
        (e) => e.email === user.email || e.user_id === user.id
      );
      setCurrentEmployee(userEmployee || null);

      const targetEmployee = (emps || []).find((e) => e.id === employeeId);
      if (!targetEmployee) {
        console.error('[EmployeeProfile] Target employee not found:', employeeId);
        setEmployee(null);
        return;
      }
      setEmployee(targetEmployee);

      const canViewResult = canActOnEmployee(employeeId, user, userEmployee, userPrefs);
      setCanView(!!canViewResult);
      setEditPermission(!!canViewResult);
      setCanViewSensitive(!!isSensitiveFieldVisible(user, userPrefs));
      setCanOffboard(!!canManageOffboarding(user, userEmployee, userPrefs, false));

      const [entities, departments, locations] = await Promise.all([
        targetEmployee.entity_id ? api.entities.filter({ id: targetEmployee.entity_id }) : [],
        targetEmployee.department_id ? api.departments.filter({ id: targetEmployee.department_id }) : [],
        targetEmployee.location_id ? api.locations.filter({ id: targetEmployee.location_id }) : [],
      ]);

      setEntity(entities?.[0] || null);
      setDepartment(departments?.[0] || null);
      setLocationObj(locations?.[0] || null);

      if (targetEmployee.manager_id) {
        const mgr = (emps || []).find((e) => e.id === targetEmployee.manager_id);
        setManager(mgr || null);
      } else {
        setManager(null);
      }

      setIsManagerOfEmployee(!!(userEmployee && targetEmployee.manager_id === userEmployee.id));

      const docs = await api.documents.filter({ owner_employee_id: employeeId });
      setDocumentCount((docs || []).length);

      if (targetEmployee.status === 'active') {
        const [allActivePolicies, empAcks] = await Promise.all([
          base44.entities.Policy.filter({ is_active: true, requires_acknowledgement: true }),
          base44.entities.PolicyAcknowledgement.filter({ employee_id: employeeId }),
        ]);

        const ackPolicyIds = new Set((empAcks || []).map((a) => a.policy_id));
        const pendingCount = (allActivePolicies || []).filter((p) => !ackPolicyIds.has(p.id)).length;
        setPoliciesCount(pendingCount);
      } else {
        setPoliciesCount(0);
      }
    } catch (error) {
      console.error('[EmployeeProfile] Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeUpdate = async (updates) => {
    if (!api || !employee?.id) return;
    await api.employees.update(employee.id, updates);
    await loadData();
  };

  const handlePersonalSectionSaved = () => {
    try { localStorage.setItem('fcw_personal_helper_done', 'true'); } catch {}
    setShowContinueToWorkHelper(true);
  };

  const handleContinueToWork = () => {
    setShowContinueToWorkHelper(false);
    navigate(createPageUrl('EmployeeProfile') + `?id=${employee.id}&tab=work`);
  };

  const handleWorkSectionSaved = () => {
    try { localStorage.setItem('fcw_work_helper_done', 'true'); } catch {}
    setShowContinueToCompHelper(true);
  };

  const handleContinueToComp = () => {
    setShowContinueToCompHelper(false);
    navigate(createPageUrl('EmployeeProfile') + `?id=${employee.id}&tab=compensation`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'onboarding': return 'bg-blue-100 text-blue-700';
      case 'offboarding': return 'bg-orange-100 text-orange-700';
      case 'terminated': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // ✅ Guard for scope resolving
  if (!employeeCtx || !tenantId) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500 ml-3">Loading workspace...</p>
      </div>
    );
  }

  // ✅ Guard for tenant API resolving
  if (!api) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-slate-600">
            Waiting for tenant/entity scope… (api is null)
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500 ml-3">Loading profile...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Employee not found</p>
        <Link to={createPageUrl('Employees')}>
          <Button variant="outline" className="mt-4">Back to Employees</Button>
        </Link>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">You don't have permission to view this profile</p>
        <Link to={createPageUrl('Employees')}>
          <Button variant="outline" className="mt-4">Back to Employees</Button>
        </Link>
      </div>
    );
  }

  const handleOffboardingSuccess = (offboarding) => {
    window.location.href = createPageUrl('OffboardingManage') + `?id=${offboarding.id}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={createPageUrl('Employees')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>

        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
              {getInitials(employee)}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{getDisplayName(employee)}</h1>
                <Badge className={getStatusColor(employee.status)}>{employee.status}</Badge>
              </div>
              <p className="text-gray-500">{employee.job_title}</p>

              <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                {department && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {department.name}
                  </span>
                )}
                {entity && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {entity.abbreviation || entity.name}
                  </span>
                )}
                {locationObj && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {locationObj.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Offboarding button */}
        {canOffboard && employee.status === 'active' && (
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setShowOffboardingWizard(true)}
          >
            <UserMinus className="h-4 w-4 mr-2" />
            Start Offboarding
          </Button>
        )}
      </div>

      {/* Main Layout */}
      <div className="flex flex-col md:flex-row gap-6">
        <aside className="md:w-56 lg:w-64 flex-shrink-0 md:border-r md:border-slate-200 md:pr-4 overflow-x-auto md:overflow-y-auto">
          <EmployeeProfileNav
            selectedSection={selectedSection}
            onSectionChange={setSelectedSection}
            documentCount={documentCount}
            policiesCount={policiesCount}
            canViewSensitive={canViewSensitive}
          />
        </aside>

        <main className="flex-1 min-w-0">
          {selectedSection === 'personal' && (
            <div data-tour="employee-personal-section">
              <ProfilePersonalSection
                employee={employee}
                canEdit={editPermission}
                onUpdate={handleEmployeeUpdate}
                onSaved={handlePersonalSectionSaved}
              />
            </div>
          )}

          {selectedSection === 'work' && (
            <div data-tour="employee-work-section">
              <ProfileWorkSection
                employee={employee}
                manager={manager}
                department={department}
                canEdit={editPermission}
                onUpdate={handleEmployeeUpdate}
                onSaved={handleWorkSectionSaved}
              />
            </div>
          )}

          {selectedSection === 'compensation' && canViewSensitive && (
            <div data-tour="employee-comp-section">
              <ProfileCompensationSection
                employee={employee}
                canEdit={editPermission}
                canViewSensitive={canViewSensitive}
                onUpdate={handleEmployeeUpdate}
              />
            </div>
          )}

          {selectedSection === 'super' && <ProfileSuperSection employee={employee} canEdit={editPermission} />}
          {selectedSection === 'work_authorisation' && <ProfileWorkAuthorisationSection employee={employee} canEdit={editPermission} />}
          {selectedSection === 'location' && <ProfileLocationSection employee={employee} location={locationObj} canEdit={editPermission} onUpdate={handleEmployeeUpdate} />}
          {selectedSection === 'entity' && <ProfileEntitySection employee={employee} entity={entity} canEdit={editPermission} onUpdate={handleEmployeeUpdate} />}
          {selectedSection === 'leave' && <ProfileLeaveSection employee={employee} />}
          {selectedSection === 'devices' && <ProfileDevicesSection employee={employee} canEdit={editPermission} />}
          {selectedSection === 'onboarding' && <ProfileOnboardingSection employee={employee} />}

          {selectedSection === 'documents' && (
            <ProfileDocumentsSection
              employee={employee}
              canEdit={editPermission}
              currentUser={currentUser}
              currentEmployee={currentEmployee}
              isAdmin={canActAsAdmin(currentUser, preferences)}
              isManagerOfEmployee={isManagerOfEmployee}
            />
          )}

          {selectedSection === 'policies' && (
            <ProfilePoliciesSection
              employee={employee}
              isOwnProfile={!!(currentEmployee && currentEmployee.id === employee.id)}
            />
          )}

          {selectedSection === 'timeline' && (
            <ProfileTimelineSection
              employee={employee}
              viewerRole={
                canActAsAdmin(currentUser, preferences) ? 'admin' :
                isManagerOfEmployee ? 'manager' : 'staff'
              }
            />
          )}

          {selectedSection === 'google' && (
            <ProfileGoogleSection
              employee={employee}
              canEdit={canActAsAdmin(currentUser, preferences)}
              onUpdate={loadData}
            />
          )}

          {selectedSection === 'activity' && <ProfileActivitySection employee={employee} />}
        </main>
      </div>

      {/* Offboarding Wizard */}
      <StartOffboardingWizard
        open={showOffboardingWizard}
        onOpenChange={setShowOffboardingWizard}
        preselectedEmployee={employee}
        employees={allEmployees}
        onSuccess={handleOffboardingSuccess}
      />

      {/* Profile Helpers */}
      {showPersonalHelper && (
        <ProfileHelper
          title="Step 1: Personal Information"
          body="Start by clicking the Edit button and filling out your personal details. When you're finished, click Save."
          primaryLabel="Got it"
          secondaryLabel="Skip for now"
          onPrimary={() => { setShowPersonalHelper(false); try { localStorage.setItem('fcw_personal_helper_done', 'true'); } catch {} }}
          onSecondary={() => { setShowPersonalHelper(false); try { localStorage.setItem('fcw_personal_helper_done', 'true'); } catch {} }}
        />
      )}

      {showContinueToWorkHelper && (
        <ProfileHelper
          title="Nice work!"
          body="Your personal information has been saved. Continue to Work & Reporting?"
          primaryLabel="Continue to Work & Reporting"
          secondaryLabel="Maybe later"
          onPrimary={handleContinueToWork}
          onSecondary={() => setShowContinueToWorkHelper(false)}
        />
      )}

      {showWorkHelper && (
        <ProfileHelper
          title="Step 2: Work & Reporting"
          body="Set up role, manager, employment type, and hours per week."
          primaryLabel="Got it"
          secondaryLabel="Skip for now"
          onPrimary={() => { setShowWorkHelper(false); try { localStorage.setItem('fcw_work_helper_done', 'true'); } catch {} }}
          onSecondary={() => { setShowWorkHelper(false); try { localStorage.setItem('fcw_work_helper_done', 'true'); } catch {} }}
        />
      )}

      {showContinueToCompHelper && (
        <ProfileHelper
          title="Great progress!"
          body="Your work details are saved. Continue to Compensation?"
          primaryLabel="Continue to Compensation"
          secondaryLabel="Maybe later"
          onPrimary={handleContinueToComp}
          onSecondary={() => setShowContinueToCompHelper(false)}
        />
      )}
    </div>
  );
}
