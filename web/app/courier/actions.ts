'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { MODES, ZONES, friendlyError } from '@/lib/constants';

function back(params: { error?: string; notice?: string }): never {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  redirect('/courier' + (q ? '?' + q : ''));
}

async function userId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, id: user.id };
}

export async function apply(formData: FormData) {
  const { supabase, id } = await userId();
  const zone = String(formData.get('zone') ?? '');
  const mode = String(formData.get('mode') ?? '');
  const languages = String(formData.get('languages') ?? '').trim().slice(0, 120) || 'English';
  const note = String(formData.get('second_chance_note') ?? '').trim().slice(0, 1000);
  const confirmed = formData.get('confirm') === 'yes';

  if (!(zone in ZONES)) back({ error: 'Choose where you want to deliver.' });
  if (!(mode in MODES)) back({ error: 'Choose how you deliver.' });
  if (!confirmed) back({ error: 'Confirm that you can show photo ID and are allowed to work in the US.' });

  const { error } = await supabase.from('couriers').insert({ id, zone, mode, languages, second_chance_note: note });
  if (error) back({ error: friendlyError(error.message) });
  revalidatePath('/courier');
  back({ notice: 'Application sent. We’ll review it and contact you.' });
}

export async function setOnline(formData: FormData) {
  const { supabase, id } = await userId();
  const online = formData.get('online') === 'true';
  const { error } = await supabase.from('couriers').update({ online }).eq('id', id);
  if (error) back({ error: friendlyError(error.message) });
  revalidatePath('/courier');
  back({});
}

export async function setMode(formData: FormData) {
  const { supabase, id } = await userId();
  const mode = String(formData.get('mode') ?? '');
  const zone = String(formData.get('zone') ?? '');
  if (!(mode in MODES) || !(zone in ZONES)) back({ error: 'Choose how and where you deliver.' });
  const { error } = await supabase.from('couriers').update({ mode, zone }).eq('id', id);
  if (error) back({ error: friendlyError(error.message) });
  revalidatePath('/courier');
  back({ notice: 'Saved.' });
}

const STEPS = {
  accept: { fn: 'accept_delivery', notice: 'Accepted. Head to the restaurant.' },
  decline: { fn: 'decline_delivery', notice: '' },
  release: { fn: 'release_delivery', notice: 'Handed back. Another courier can take it.' },
  picked_up: { fn: 'mark_picked_up', notice: 'Picked up. On to the customer.' },
  delivered: { fn: 'mark_delivered', notice: 'Delivered. Nice work.' },
} as const;

export async function deliveryStep(formData: FormData) {
  const { supabase } = await userId();
  const step = String(formData.get('step') ?? '') as keyof typeof STEPS;
  const id = String(formData.get('delivery_id') ?? '');
  const action = STEPS[step];
  if (!action || !id) back({ error: 'Unknown action.' });
  const { error } = await supabase.rpc(action.fn, { p_delivery: id });
  if (error) back({ error: friendlyError(error.message) });
  revalidatePath('/courier');
  back(action.notice ? { notice: action.notice } : {});
}
