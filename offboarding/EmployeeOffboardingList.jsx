// src/components/offboarding/EmployeeOffboardingList.jsx
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Play } from "lucide-react";

const ACTIVE_OFFBOARDING_STATUSES = ["draft", "scheduled", "in_progress"];
const HISTORICAL_OFFBOARDING_STATUSES = ["completed", "cancelled"];

const OFFBOARDING_STATUS_BADGE = {
  draft: { className: "bg-slate-100 text-slate-700", label: "Draft" },
  scheduled: { className: "bg-yellow-100 text-yellow-700", label: "Scheduled" },
  in_progress: { className: "bg-blue-100 text-blue-700", label: "In Progress" },
  completed: { className: "bg-green-100 text-green-700", label: "Completed" },
  cancelled: { className: "bg-gray-100 text-gray-700", label: "Cancelled" },
};

export function EmployeeOffboardingList({
  employees = [],
  departments = [],

  // ✅ NEW
  offboardings = [], // EmployeeOffboarding rows
  offboardingTasks = [], // EmployeeOffboardingTask rows

  isAdmin = false,
  onStartOffboarding,
}) {
  const getManager = (managerId) => employees.find((e) => e.id === managerId);
  const getDepartment = (deptId) => departments.find((d) => d.id === deptId);

  const tasksByOffboardingId = useMemo(() => {
    const map = new Map();
    for (const t of offboardingTasks) {
      const key = t.offboarding_id;
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return map;
  }, [offboardingTasks]);

  const getProgress = (offboardingId) => {
    const tasks = tasksByOffboardingId.get(offboardingId) || [];
    if (!tasks.length) return 0;
    const done = tasks.filter((t) => t.status === "completed").length;
    return Math.round((done / tasks.length) * 100);
  };

  const getStatusBadge = (status) => {
    const c = OFFBOARDING_STATUS_BADGE[status] || OFFBOARDING_STATUS_BADGE.draft;
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  // Active = blocks new offboarding
  const getActiveOffboarding = (empId) =>
    offboardings.find(
      (o) =>
        o.employee_id === empId && ACTIVE_OFFBOARDING_STATUSES.includes(o.status)
    );

  const getLatestHistoricalOffboarding = (empId) => {
    const historical = offboardings
      .filter(
        (o) =>
          o.employee_id === empId &&
          HISTORICAL_OFFBOARDING_STATUSES.includes(o.status)
      )
      .sort((a, b) => {
        const aT = new Date(a.created_at || a.created_date || 0).getTime();
        const bT = new Date(b.created_at || b.created_date || 0).getTime();
        return bT - aT;
      });
    return historical[0] || null;
  };

  // Filter out terminated employees from list display
  const activeEmployees = employees.filter((e) => e.status !== "terminated");

  if (!activeEmployees.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No active employees found
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Employee
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Manager
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Department
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {activeEmployees.map((employee) => {
              const active = getActiveOffboarding(employee.id);
              const historical = getLatestHistoricalOffboarding(employee.id);

              const manager = getManager(employee.manager_id);
              const dept = getDepartment(employee.department_id);

              const progress = active ? getProgress(active.id) : 0;
              const canStartOffboarding = !active && isAdmin;

              return (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {employee.first_name} {employee.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{employee.email}</p>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-gray-600">
                    {manager ? `${manager.first_name} ${manager.last_name}` : "—"}
                  </td>

                  <td className="px-4 py-3 text-sm text-gray-600">
                    {dept?.name || "—"}
                  </td>

                  <td className="px-4 py-3">
                    {active ? (
                      getStatusBadge(active.status)
                    ) : historical ? (
                      <div className="flex items-center gap-1">
                        {getStatusBadge(historical.status)}
                        <span className="text-xs text-gray-400">(previous)</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {active ? (
                      <div className="w-24">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              progress === 100 ? "bg-green-500" : "bg-blue-600"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {active ? (
                        <Link
                          to={
                            createPageUrl("OffboardingManage") +
                            `?id=${active.id}`
                          }
                        >
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            View Offboarding
                          </Button>
                        </Link>
                      ) : canStartOffboarding ? (
                        <Button
                          size="sm"
                          onClick={() => onStartOffboarding?.(employee)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start Offboarding
                        </Button>
                      ) : historical ? (
                        <Link
                          to={
                            createPageUrl("OffboardingManage") +
                            `?id=${historical.id}`
                          }
                        >
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            View History
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
