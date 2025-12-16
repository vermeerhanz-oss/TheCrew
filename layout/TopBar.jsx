import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Menu, LogOut, User, ChevronDown, Settings, Wrench } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Logo from '@/components/brand/Logo';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useEmployeeContext } from "@/components/utils/EmployeeContext";
import { useSessionReload } from '@/components/utils/SessionContext';
import { Shield, User as UserIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { usePendingPoliciesCount } from '@/components/policies/usePendingPoliciesCount';
import { getMyPoliciesProfileUrl } from '@/components/utils/navigation';

export function TopBar({ onMenuToggle }) {
  const { count: pendingPolicyCount } = usePendingPoliciesCount();
  const context = useEmployeeContext();
  const reloadSession = useSessionReload();
  const user = context?.user;
  const employee = context?.employee;
  const actingMode = context?.actingMode || 'admin';
  const isAdminUser = context?.isAdmin;

  const toggleActingMode = async () => {
    try {
      const newMode = actingMode === 'admin' ? 'staff' : 'admin';
      
      // Update preferences
      const prefs = await base44.entities.UserPreferences.filter({ user_id: user.id });
      if (prefs.length > 0) {
        await base44.entities.UserPreferences.update(prefs[0].id, { acting_mode: newMode });
      } else {
        await base44.entities.UserPreferences.create({ user_id: user.id, acting_mode: newMode });
      }
      
      toast.success(`Switched to ${newMode === 'admin' ? 'Admin' : 'Staff'} mode`);
      
      // Reload context immediately
      if (reloadSession) reloadSession();
    } catch (error) {
      console.error('Failed to toggle mode:', error);
      toast.error('Failed to switch mode');
    }
  };

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
      const appBase = base44.config?.APP_URL || window.location.origin;
      window.location.href = `${appBase}/auth/login`;
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const displayName = employee 
    ? getDisplayName(employee)
    : user?.full_name || user?.email;

  const initials = employee
    ? getInitials(employee)
    : user?.full_name?.[0] || user?.email?.[0] || '?';

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 sticky top-0 z-20">
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 -ml-2 mr-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link to={createPageUrl('Home')} className="lg:hidden">
        <Logo size="sm" />
      </Link>

      <div className="flex-1" />

      {pendingPolicyCount > 0 && (
        <Link 
          to={employee ? getMyPoliciesProfileUrl(employee.id) : createPageUrl('MyPolicies')} 
          className="mr-3 relative group"
        >
          <div className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors relative">
            <FileText className="h-5 w-5" />
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
              {pendingPolicyCount}
            </span>
          </div>
          <div className="absolute top-full right-0 mt-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            You have {pendingPolicyCount} policies waiting for your acknowledgement.
          </div>
        </Link>
      )}

      <NotificationBell authUserId={user?.id} employeeId={employee?.id} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <Settings className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isAdminUser && (
            <>
              <DropdownMenuItem onClick={toggleActingMode} className="cursor-pointer">
                {actingMode === 'admin' ? (
                  <>
                    <UserIcon className="h-4 w-4 mr-2" />
                    Switch to Staff View
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Switch to Admin View
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link to={createPageUrl('Settings')} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" />
              My Settings
            </Link>
          </DropdownMenuItem>
          {(context?.role === 'owner' || context?.role === 'admin' || process.env.NODE_ENV !== 'production') && (
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('AdminUtilities')} className="cursor-pointer">
                <Wrench className="h-4 w-4 mr-2" />
                Admin Utilities
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}