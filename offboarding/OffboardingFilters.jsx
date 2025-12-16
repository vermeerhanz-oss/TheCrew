// src/components/offboarding/OffboardingFilters.jsx
import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { getDisplayName } from "@/components/utils/displayName";

const PIPELINE_STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
];

const HISTORY_STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const EXIT_TYPES = [
  { value: "all", label: "All exit types" },
  { value: "voluntary", label: "Voluntary" },
  { value: "involuntary", label: "Involuntary" },
  { value: "redundancy", label: "Redundancy" },
  { value: "other", label: "Other" },
];

function safeId(v) {
  // shadcn Select requires string values
  return typeof v === "string" && v.trim() ? v : "";
}

export function OffboardingFilters({
  search = "",
  onSearchChange,

  departmentId = "all",
  onDepartmentChange,

  statusFilter = "all",
  onStatusFilterChange,

  entityId = "all",
  onEntityChange,

  exitTypeFilter = "all",
  onExitTypeChange,

  managerId = "all",
  onManagerChange,

  departments = [],
  entities = [],
  managers = [],

  showEntityFilter = false,
  viewMode = "pipeline",
}) {
  const statusOptions =
    viewMode === "pipeline" ? PIPELINE_STATUSES : HISTORY_STATUSES;

  const hasDepartments = Array.isArray(departments) && departments.length > 0;
  const hasEntities =
    showEntityFilter && Array.isArray(entities) && entities.length > 0;
  const hasManagers = Array.isArray(managers) && managers.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Status */}
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange?.(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Exit Type */}
        <Select
          value={exitTypeFilter}
          onValueChange={(v) => onExitTypeChange?.(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All exit types" />
          </SelectTrigger>
          <SelectContent>
            {EXIT_TYPES.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Department */}
        <Select
          value={departmentId}
          onValueChange={(v) => onDepartmentChange?.(v)}
          disabled={!hasDepartments}
        >
          <SelectTrigger>
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments
              .filter((d) => safeId(d?.id))
              .map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {/* Entity */}
        {hasEntities ? (
          <Select value={entityId} onValueChange={(v) => onEntityChange?.(v)}>
            <SelectTrigger>
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entities
                .filter((e) => safeId(e?.id))
                .map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.abbreviation || e.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          // keep grid consistent when entity filter is hidden
          <div className="hidden lg:block" />
        )}

        {/* Manager */}
        {hasManagers ? (
          <Select value={managerId} onValueChange={(v) => onManagerChange?.(v)}>
            <SelectTrigger>
              <SelectValue placeholder="All managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All managers</SelectItem>
              {managers
                .filter((m) => safeId(m?.id))
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {getDisplayName(m)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="hidden lg:block" />
        )}
      </div>
    </div>
  );
}
