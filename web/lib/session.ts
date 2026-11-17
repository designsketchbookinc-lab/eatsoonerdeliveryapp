import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeFor, type Role } from '@/lib/constants';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
}

// Loads the signed-in user and their profile. Sends them to the login page if signed out,
// and to their own home page if this page is for a different account type.
export async function requireRole(role: Role) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, phone')
    .eq('id', user.id)
    .single<Profile>();
  if (!profile) redirect('/login?error=' + encodeURIComponent('Your account is not set up yet. Please contact Eat Sooner.'));
  if (profile.role !== role) redirect(homeFor(profile.role));

  return { supabase, user, profile };
}
