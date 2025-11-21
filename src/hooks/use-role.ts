'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type MembershipRole = Database['public']['Enums']['membership_role'];

export function useRole(organizationId: string) {
  const [role, setRole] = useState<MembershipRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function getRole() {
      const { data, error } = await supabase.rpc('get_user_role', {
        organization_id: organizationId,
      });

      if (error || !data) {
        setRole(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setRole(data);
      setIsAdmin(data === 'admin');
      setLoading(false);
    }

    getRole();
  }, [organizationId]);

  return { role, isAdmin, loading };
}
