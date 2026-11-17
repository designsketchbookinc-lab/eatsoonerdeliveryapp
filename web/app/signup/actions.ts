'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeFor } from '@/lib/constants';

function back(role: string, message: string): never {
  redirect(`/signup?role=${role}&error=${encodeURIComponent(message)}`);
}

export async function signUp(formData: FormData) {
  const role = formData.get('role') === 'courier' ? 'courier' : 'restaurant';
  const fullName = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!fullName) back(role, 'Enter your name.');
  if (!email) back(role, 'Enter your email address.');
  if (password.length < 8) back(role, 'Use a password of at least 8 characters.');

  const origin = process.env.NEXT_PUBLIC_SITE_URL || headers().get('origin') || '';
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name: fullName.slice(0, 120), phone: phone.slice(0, 30) },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) back(role, error.message);

  // If email confirmation is turned off in Supabase, the person is signed in right away.
  if (data.session) redirect(homeFor(role));
  redirect('/login?notice=' + encodeURIComponent('Check your email and tap the link to confirm your account, then sign in.'));
}
