import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';

export function usePendingPoliciesCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPendingPolicies();
    
    // Poll occasionally to keep fresh (e.g. every 2 minutes)
    const interval = setInterval(checkPendingPolicies, 120000);
    return () => clearInterval(interval);
  }, []);

  const checkPendingPolicies = async () => {
    try {
      const ctx = await getCurrentUserEmployeeContext();
      if (!ctx || !ctx.employee) {
        setLoading(false);
        return;
      }

      // 1. Get active required policies
      const policies = await base44.entities.Policy.filter({
        is_active: true,
        requires_acknowledgement: true
      });

      if (policies.length === 0) {
        setCount(0);
        setLoading(false);
        return;
      }

      // 2. Get my acknowledgements
      // Optimization: if we have many policies, this might get slow.
      // But typically < 50 policies.
      const myAcks = await base44.entities.PolicyAcknowledgement.filter({
        employee_id: ctx.employee.id
      });

      const ackPolicyIds = new Set(myAcks.map(a => a.policy_id));
      
      // 3. Count pending
      const pending = policies.filter(p => !ackPolicyIds.has(p.id));
      
      setCount(pending.length);
    } catch (error) {
      console.error("Failed to check pending policies", error);
    } finally {
      setLoading(false);
    }
  };

  return { count, loading, refresh: checkPendingPolicies };
}