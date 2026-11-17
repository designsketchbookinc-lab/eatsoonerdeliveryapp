'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/constants';

function back(params: { error?: string; notice?: string }): never {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  redirect('/admin' + (q ? '?' + q : ''));
}

export async function reviewCourier(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('courier_id') ?? '');
  const status = String(formData.get('status') ?? '');
  // The database checks that the caller is an admin.
  const { error } = await supabase.rpc('set_courier_status', { p_courier: id, p_status: status });
  if (error) back({ error: friendlyError(error.message) });
  revalidatePath('/admin');
  back({ notice: status === 'approved' ? 'Courier approved.' : status === 'paused' ? 'Courier paused.' : 'Saved.' });
}

export async function adminCancel(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get('delivery_id') ?? '');
  const { error } = await supabase.rpc('cancel_delivery', { p_delivery: id });
  if (error) back({ error: friendlyError(error.message) });
  revalidatePath('/admin');
  back({ notice: 'Delivery cancelled.' });
}
