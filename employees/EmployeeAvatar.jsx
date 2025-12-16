import React from 'react';
import { getInitials, getDisplayFirstName } from '@/components/utils/displayName';
import { cn } from '@/lib/utils';

export function EmployeeAvatar({ employee, className }) {
  if (!employee) return null;

  return (
    <div 
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white shrink-0",
        className
      )}
      title={getDisplayFirstName(employee)}
    >
      {getInitials(employee)}
    </div>
  );
}