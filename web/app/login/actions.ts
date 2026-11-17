'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeFor, type Role } from '@/lib/constants';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect('/login?error=' + encodeURIComponent('That email and password don’t match an account, or the email isn’t confirmed yet.'));
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single<{ role: Role }>();
  redirect(homeFor(profile?.role));
}
