import { useEffect, useState } from 'react';
import { createPageUrl } from '@/utils';
import { getCurrentUserEmployeeContextSafe, loginOrRedirect } from '@/components/utils/authClient';

/**
 * Global guard used to ensure:
 *  - user is logged in
 *  - user has completed Setup (has an Employee record)
 * If no employee exists for the logged-in user, redirect to /setup.
 */
export function useEmployeeSetupGuard() {
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const result = await getCurrentUserEmployeeContextSafe();

      // Not logged in → allow authClient to handle redirection
      if (!result.isAuthenticated) {
        await loginOrRedirect();
        return;
      }

      // Logged in but no Employee profile → force Setup wizard
      if (!result.employee) {
        window.location.href = createPageUrl('Setup');
        return;
      }

      // User has employee profile → continue
      if (!cancelled) {
        setCtx(result);
        setLoading(false);
      }
    }

    check();

    return () => { cancelled = true; };
  }, []);

  return { loading, ctx };
}