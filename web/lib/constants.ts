// Shared labels. Prices here are for display only: the database sets the real fee
// (see fee_for_tier in supabase/schema.sql). Keep the two in step.

export type Role = 'restaurant' | 'courier' | 'admin';
export type Tier = 'short' | 'standard' | 'long';
export type DeliveryStatus = 'requested' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
export type CourierStatus = 'pending' | 'approved' | 'paused';

export const TIERS: Record<Tier, { label: string; range: string; fee: number }> = {
  short: { label: 'Short', range: 'Up to 0.5 mi', fee: 5.25 },
  standard: { label: 'Standard', range: '0.5 to 1.5 mi', fee: 5.75 },
  long: { label: 'Long', range: '1.5 to 2.5 mi', fee: 6.75 },
};

export const ORDER_SIZES = {
  one_bag: 'One bag',
  two_bags: 'Two bags',
  cake_box: 'Cake box',
} as const;
export type OrderSize = keyof typeof ORDER_SIZES;

export const READY_TIMES = [
  { value: 0, label: 'Now' },
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
] as const;

export const AREAS = ['Sunnyside', 'Long Island City', 'Astoria', 'Midtown', 'Harlem'] as const;
export type Area = (typeof AREAS)[number];

export const ZONES = {
  queens: 'Queens (Sunnyside, LIC, Astoria)',
  midtown: 'Midtown',
  harlem: 'Harlem',
} as const;
export type Zone = keyof typeof ZONES;

export const MODES = {
  bike: 'Bike',
  ebike: 'E-bike',
  walk: 'Walk',
  transit: 'Transit',
} as const;
export type Mode = keyof typeof MODES;

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  requested: 'Finding a courier',
  accepted: 'Courier heading to you',
  picked_up: 'On the way to customer',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function homeFor(role: Role | null | undefined): string {
  if (role === 'admin') return '/admin';
  if (role === 'courier') return '/courier';
  return '/restaurant';
}

export function money(n: number | string): string {
  return '$' + Number(n).toFixed(2);
}

// All times are shown in New York time, whatever the server's clock is set to.
export function nyTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Midnight today in New York, as an ISO timestamp, for "today's deliveries".
export function startOfTodayNY(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // The New York wall-clock time, read as if it were UTC, minus the real instant = the offset.
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offsetMs = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const midnightWallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'));
  return new Date(midnightWallAsUtc - offsetMs).toISOString();
}

// Turns a database error into a short message for the screen.
export function friendlyError(message: string | undefined | null): string {
  if (!message) return 'Something went wrong. Please try again.';
  if (message.includes('row-level security')) return 'You do not have permission to do that.';
  return message.length > 160 ? 'Something went wrong. Please try again.' : message;
}
