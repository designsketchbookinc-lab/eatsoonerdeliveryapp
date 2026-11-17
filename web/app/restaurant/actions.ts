'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AREAS, ORDER_SIZES, TIERS, friendlyError } from '@/lib/constants';

function back(params: { error?: string; notice?: string }): never {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  redirect('/restaurant' + (q ? '?' + q : ''));
}

async function userId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, id: user.id };
}

export async function saveRestaurant(formData: FormData) {
  const { supabase, id } = await userId();
  const name = String(formData.get('name') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const area = String(formData.get('area') ?? '');
  const phone = String(formData.get('phone') ?? '').trim().slice(0, 30);

  if (!name) back({ error: 'Enter your restaurant’s name.' });
  if (!address) back({ error: 'Enter the pickup address.' });
  if (!(AREAS as readonly string[]).includes(area)) back({ error: 'Choose your neighborhood.' });

  const { error } = await supabase.from('restaurants').insert({ owner_id: id, name, address, area, phone });
  if (error) back({ error: friendlyError(error.message) });
  revalidatePath('/restaurant');
  back({ notice: 'Your restaurant is set up. You can request a courier now.' });
}

export async function requestCourier(formData: FormData) {
  const { supabase } = await userId();
  const address = String(formData.get('customer_address') ?? '').trim();
  const phone = String(formData.get('customer_phone') ?? '').trim().slice(0, 30);
  const tier = String(formData.get('tier') ?? '');
  const size = String(formData.get('order_size') ?? '');
  const ready = Number(formData.get('ready_in_minutes') ?? 0);
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 300);

  if (!address) back({ error: 'Add the customer address first.' });
  if (!(tier in TIERS)) back({ error: 'Choose a trip distance.' });
  if (!(size in ORDER_SIZES)) back({ error: 'Choose the order size.' });
  if (![0, 10, 20].includes(ready)) back({ error: 'Choose when the order will be ready.' });

  const { error } = await supabase.rpc('create_delivery', {
    p_customer_address: address,
    p_customer_phone: phone,
    p_tier: tier,
    p_order_size: size,
    p_ready_in_minutes: ready,
    p_notes: notes,
  });
  if (error) back({ error: friendlyError(error.message) });
  revalidatePath('/restaurant');
  back({ notice: 'Courier requested. You’ll see here when someone accepts.' });
}

export async function cancelDelivery(formData: FormData) {
  const { supabase } = await userId();
  const id = String(formData.get('delivery_id') ?? '');
  const { error } = await supabase.rpc('cancel_delivery', { p_delivery: id });
  if (error) back({ error: friendlyError(error.message) });
  revalidatePath('/restaurant');
  back({ notice: 'Delivery cancelled.' });
}
