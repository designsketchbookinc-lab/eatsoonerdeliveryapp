'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Reloads the page's data whenever a delivery this person can see changes,
// so restaurants see their courier coming and couriers see new offers without refreshing.
// Also refreshes every 30 seconds as a fallback.
export default function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase
      .channel('deliveries-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, refresh)
      .subscribe();
    const interval = setInterval(() => router.refresh(), 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
