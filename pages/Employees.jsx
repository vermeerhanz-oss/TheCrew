import React, { useState, useMemo, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import { Button } from "@/components/ui/button";
import { Plus, Upload, List, GitBranch } from 'lucide-react';

import { EmployeeFilters } from '../components/employees/EmployeeFilters';
import { EmployeeTable } from '../components/employees/EmployeeTable';
import { EmployeeTreeTable } from '../components/employees/EmployeeTreeTable';
import { EmployeeImportWizard } from '../components/employees/EmployeeImportWizard';

import { canActAsAdmin, canViewEmployee } from '@/components/utils/permissions';
import { cn } from "@/lib/utils";
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';

import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { SessionReloadContext } from '@/components/utils/SessionContext';

export default function Employees() {
  const navigate = useNavigate();
  useLocation(); // reserved for future query param handling

  const ctx = useEmployeeContext();
  const reloadSession = useContext(SessionReloadContext);

  const tenantId = ctx?.tenantId || null;
  const user = ctx?.user || null;
  const preferences = ctx?.preferences || null;
  const currentEmployee = ctx?.employee || null;

  // These are already tenant-scoped by EmployeeContext.loadBulkData
  const employees = (ctx?.employees || []).filter(e =>
    tenantId ? e.entity_id === tenantId : true
  );
  const departments = ctx?.departments || [];
  const locations = ctx?.locations || [];

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('all');
  const [locationId, setLocationId] = useState('all');
  const [status, setStatus] = useState('all');
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [viewMode, setViewMode] = useState('hierarchy');

  const [error, setError] = useState(null);

  // If context is still bootstrapping
  const isLoading = !ctx;

  // Flat view filters
  const filteredEmployees = useMemo(() => {
    if (!employees.length) return [];

    return employees.filter((emp) => {
      if (!canViewEmployee(user, emp, currentEmployee, preferences)) return false;

      const searchLower = search.trim().toLowerCase();
      const searchMatch =
        !searchLower ||
        `${emp.first_name ?? ''} ${emp.last_name ?? ''}`
          .toLowerCase()
          .includes(searchLower) ||
        (emp.email ?? '').toLowerCase().includes(searchLower);

      const deptMatch =
        departmentId === 'all' || emp.department_id === departmentId;
      const locMatch =
        locationId === 'all' || emp.location_id === locationId;
      const statusMatch = status === 'all' || emp.status === status;

      return searchMatch && deptMatch && locMatch && statusMatch;
    });
  }, [
    employees,
    search,
    departmentId,
    locationId,
    status,
    user,
    currentEmployee,
    preferences,
  ]);

  // Hierarchy view – filtered only by permissions
  const visibleEmployees = useMemo(() => {
    if (!employees.length) return [];
    return employees.filter((emp) =>
      canViewEmployee(user, emp, currentEmployee, preferences)
    );
  }, [employees, user, currentEmployee, preferences]);

  const userIsAdmin = canActAsAdmin(user, preferences);

  const handleRowClick = (employee) => {
    navigate(createPageUrl('EmployeeProfile') + `?id=${employee.id}`);
  };

  const handleImportComplete = async () => {
    try {
      // Ask the app shell to reload EmployeeContext (which re-fetches tenant-scoped data)
      reloadSession();
      setShowImportWizard(false);
    } catch (err) {
      console.error('Failed to refresh employees after import', err);
      setError('Employees were imported, but we could not refresh the list automatically. Please reload the page.');
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <ErrorState
          title="Couldn’t load employees"
          message={error}
          onRetry={() => {
            setError(null);
            reloadSession();
          }}
        />
      </div>
    );
  }

  if (!isLoading && employees.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No employees yet"
          description="Start by adding your first employee so you can track leave, onboarding and policies."
          actionLabel={userIsAdmin ? 'Add employee' : null}
          onAction={() =>
            navigate(createPageUrl('EmployeeProfile') + '?new=true')
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">People</h1>
          <p className="text-slate-500 mt-1">
            {viewMode === 'flat'
              ? filteredEmployees.length
              : visibleEmployees.length}{' '}
            employees
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('hierarchy')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'hierarchy'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <GitBranch className="h-4 w-4" />
              Hierarchy
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'flat'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <List className="h-4 w-4" />
              Flat
            </button>
          </div>

          {userIsAdmin && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowImportWizard(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
              <Button
                onClick={() =>
                  navigate(createPageUrl('EmployeeProfile') + '?new=true')
                }
                data-tutorial="invite-employee-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </>
          )}
        </div>
      </div>

      {showImportWizard && (
        <EmployeeImportWizard
          onClose={() => setShowImportWizard(false)}
          onComplete={handleImportComplete}
        />
      )}

      <EmployeeFilters
        search={search}
        onSearchChange={setSearch}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        locationId={locationId}
        onLocationChange={setLocationId}
        status={status}
        onStatusChange={setStatus}
        departments={departments}
        locations={locations}
      />

      {viewMode === 'hierarchy' ? (
        <EmployeeTreeTable
          employees={visibleEmployees}
          departments={departments}
          locations={locations}
          isLoading={isLoading}
          onRowClick={handleRowClick}
          search={search}
          filters={{ departmentId, locationId, status }}
        />
      ) : (
        <EmployeeTable
          employees={filteredEmployees}
          departments={departments}
          locations={locations}
          isLoading={isLoading}
          onRowClick={handleRowClick}
        />
      )}
    </div>
  );
}