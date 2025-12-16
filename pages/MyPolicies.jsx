import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Loader2 } from 'lucide-react';
import { getMyPoliciesProfileUrl } from '@/components/utils/navigation';

export default function MyPolicies() {
  const navigate = useNavigate();

  useEffect(() => {
    const redirect = async () => {
      try {
        // 1. Check if we have a user
        const user = await base44.auth.me().catch(() => null);
        if (!user) {
          // Not logged in -> Home (which will redirect to login)
          navigate(createPageUrl('Home'), { replace: true });
          return;
        }

        // 2. Find employee record
        const employees = await base44.entities.Employee.filter({ user_id: user.id });
        if (employees.length > 0) {
          // 3. Navigate to profile policies tab
          const url = getMyPoliciesProfileUrl(employees[0].id);
          navigate(url, { replace: true });
        } else {
          // No employee record -> Home
          navigate(createPageUrl('Home'), { replace: true });
        }
      } catch (e) {
        console.error("MyPolicies redirect error:", e);
        navigate(createPageUrl('Home'), { replace: true });
      }
    };
    
    redirect();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );
}