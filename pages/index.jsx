import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ensureUserSetupOrRedirect } from '@/components/utils/authClient';
import { createPageUrl } from '@/utils';

/**
 * Root redirect component
 * Checks if user needs to complete setup before going to Dashboard
 */
export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function checkSetup() {
      const result = await ensureUserSetupOrRedirect();
      
      if (cancelled) return;

      // If needsSetup is true, ensureUserSetupOrRedirect has already redirected to Setup
      // Otherwise, go to Dashboard
      if (!result?.needsSetup) {
        navigate(createPageUrl('Home'), { replace: true });
      }
    }

    checkSetup();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
    </div>
  );
}