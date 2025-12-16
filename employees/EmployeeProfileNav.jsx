import React from 'react';
import { 
  User, 
  Briefcase, 
  MapPin, 
  Building2,
  FileText,
  Activity,
  DollarSign,
  Clock,
  Mail,
  Calendar,
  UserPlus,
  Shield,
  PiggyBank,
  FileCheck,
  Laptop
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function EmployeeProfileNav({ selectedSection, onSectionChange, documentCount, policiesCount, canViewSensitive }) {
  const navItems = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'work', label: 'Work & Reporting', icon: Briefcase },
    ...(canViewSensitive ? [{ id: 'compensation', label: 'Compensation', icon: DollarSign }] : []),
    { id: 'super', label: 'Superannuation', icon: PiggyBank },
    { id: 'work_authorisation', label: 'Work Authorisation', icon: FileCheck },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'entity', label: 'Entity', icon: Building2 },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    { id: 'devices', label: 'Devices', icon: Laptop },
    { id: 'documents', label: 'Documents', icon: FileText, count: documentCount },
    { id: 'policies', label: 'Policies', icon: Shield, count: policiesCount },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'google', label: 'Google', icon: Mail },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <nav className="flex flex-col gap-1 text-sm text-slate-700 h-full overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = selectedSection === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-200 text-left group",
              isActive 
                ? "bg-slate-900 text-white shadow-sm" 
                : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-slate-300" : "text-slate-400 group-hover:text-slate-600")} />
              <span className="font-medium">{item.label}</span>
            </div>
            {item.count > 0 && (
              <Badge 
                variant="secondary" 
                className={cn(
                  "ml-auto text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center rounded-full",
                  isActive ? "bg-slate-700 text-white hover:bg-slate-600" : "bg-slate-200 text-slate-600"
                )}
              >
                {item.count}
              </Badge>
            )}
          </button>
        );
      })}
    </nav>
  );
}