import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  ArrowLeft,
  Loader2,
  Building2,
  Briefcase,
  UserCheck,
} from 'lucide-react';

import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { useTenantApi } from '@/components/utils/useTenantApi';

import PeopleSummaryTable from '@/components/reporting/PeopleSummaryTable';
import PeopleSummaryCharts from '@/components/reporting/PeopleSummaryCharts';

export default function PeopleSummary() {
  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [entities, setEntities] = useState([]);
  const [documentCounts, setDocumentCounts] = useState({});

  // Filters
  const [entityFilter, setEntityFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');

  const api = useTenantApi();

  const { isAllowed, isLoading: permLoading } = useRequirePermission(
    context,
    'canViewReports',
    {
      requireAdminMode: true,
      message: 'You need admin access to view reports.',
    }
  );

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);

        const ctx = await getCurrentUserEmployeeContext({
          includeLeaveBalances: false,
          includeManagerChain: false,
        });

        setContext(ctx);

        if (!ctx?.tenantId || !ctx.permissions?.canViewReports) {
          console.warn('[PeopleSummary] No tenantId or permission - skipping load');
          setIsLoading(false);
          return;
        }

        // Use tenant-scoped data from EmployeeContext
        const visibleEmps = ctx.visibleEmployees || [];
        const depts = ctx.departments || [];
        const locs = ctx.locations || [];
        const ents = ctx.entities || [];

        // Only network call here: tenant-scoped documents
        const docs = (await api.documents?.list?.()) || [];

        // Build document count map by employee
        const docCountMap = {};
        (docs || []).forEach((doc) => {
          if (doc.owner_employee_id) {
            docCountMap[doc.owner_employee_id] =
              (docCountMap[doc.owner_employee_id] || 0) + 1;
          }
        });

        setEmployees(visibleEmps);
        setDepartments(depts);
        setLocations(locs);
        setEntities(ents);
        setDocumentCounts(docCountMap);
      } catch (err) {
        console.error('[PeopleSummary] Failed to load data', err);
      } finally {
        setIsLoading(false);
      }
    }

    load();
    // ✅ STABLE DEPS: mount only - loads context internally
  }, []);

  // Build lookup maps
  const deptMap = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d])),
    [departments]
  );
  const locMap = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.id, l])),
    [locations]
  );
  const entityMap = useMemo(
    () => Object.fromEntries(entities.map((e) => [e.id, e])),
    [entities]
  );
  const empMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees]
  );

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Status filter
      if (statusFilter === 'active' && emp.status !== 'active') return false;
      if (statusFilter === 'inactive' && emp.status === 'active') return false;

      // Entity filter
      if (entityFilter !== 'all' && emp.entity_id !== entityFilter) return false;

      // Location filter
      if (locationFilter !== 'all' && emp.location_id !== locationFilter)
        return false;

      // Department filter
      if (departmentFilter !== 'all' && emp.department_id !== departmentFilter)
        return false;

      // Employment type filter
      if (
        employmentTypeFilter !== 'all' &&
        emp.employment_type !== employmentTypeFilter
      )
        return false;

      return true;
    });
  }, [
    employees,
    entityFilter,
    locationFilter,
    departmentFilter,
    employmentTypeFilter,
    statusFilter,
  ]);

  // Build a set of employee IDs that have direct reports
  const managersWithReports = useMemo(() => {
    const managerIds = new Set();
    employees.forEach((emp) => {
      if (emp.manager_id) {
        managerIds.add(emp.manager_id);
      }
    });
    return managerIds;
  }, [employees]);

  // Compute metrics
  const metrics = useMemo(() => {
    const activeEmployees = filteredEmployees.filter(
      (e) => e.status === 'active'
    );
    const total = activeEmployees.length;

    const ftCount = activeEmployees.filter(
      (e) => e.employment_type === 'full_time'
    ).length;
    const ptCount = activeEmployees.filter(
      (e) => e.employment_type === 'part_time'
    ).length;
    const casualCount = activeEmployees.filter(
      (e) => e.employment_type === 'casual'
    ).length;
    const contractorCount = activeEmployees.filter(
      (e) => e.employment_type === 'contractor'
    ).length;

    const managerCount = activeEmployees.filter(
      (e) => e.is_manager === true || managersWithReports.has(e.id)
    ).length;
    const icCount = total - managerCount;

    const uniqueEntities = new Set(
      activeEmployees.map((e) => e.entity_id).filter(Boolean)
    ).size;
    const uniqueLocations = new Set(
      activeEmployees.map((e) => e.location_id).filter(Boolean)
    ).size;

    return {
      total,
      ftCount,
      ptCount,
      casualCount,
      contractorCount,
      managerCount,
      icCount,
      uniqueEntities,
      uniqueLocations,
    };
  }, [filteredEmployees, managersWithReports]);

  if (isLoading || permLoading || !isAllowed) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link to={createPageUrl('ReportingOverview')}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reporting
          </Button>
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-7 w-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">People Summary</h1>
        </div>
        <p className="text-gray-600">
          Headcount, employment types, managers vs ICs.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">
                Total Headcount
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{metrics.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <Briefcase className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">
                Employment Types
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {metrics.ftCount} FT · {metrics.ptCount} PT ·{' '}
              {metrics.casualCount} Casual · {metrics.contractorCount}{' '}
              Contractor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <UserCheck className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">
                Managers vs ICs
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {metrics.managerCount} managers · {metrics.icCount} ICs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">
                Entities / Locations
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {metrics.uniqueEntities} entities · {metrics.uniqueLocations}{' '}
              locations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {entities
              .filter((e) => employees.some((emp) => emp.entity_id === e.id))
              .map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments
              .filter((d) => employees.some((emp) => emp.department_id === d.id))
              .map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select
          value={employmentTypeFilter}
          onValueChange={setEmploymentTypeFilter}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Employment type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="full_time">Full-time</SelectItem>
            <SelectItem value="part_time">Part-time</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
            <SelectItem value="contractor">Contractor</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations
              .filter((l) => employees.some((emp) => emp.location_id === l.id))
              .map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Charts */}
      <PeopleSummaryCharts
        employees={filteredEmployees}
        entityMap={entityMap}
        deptMap={deptMap}
      />

      {/* Table */}
      <PeopleSummaryTable
        employees={filteredEmployees}
        deptMap={deptMap}
        locMap={locMap}
        entityMap={entityMap}
        empMap={empMap}
        canViewSensitive={
          context?.permissions?.isSensitiveFieldVisible || false
        }
        documentCounts={documentCounts}
      />
    </div>
  );
}