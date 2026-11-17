import TopBar from '@/components/TopBar';
import Alert from '@/components/Alert';
import LiveRefresh from '@/components/LiveRefresh';
import SubmitButton from '@/components/SubmitButton';
import { requireRole } from '@/lib/session';
import {
  AREAS,
  MODES,
  ORDER_SIZES,
  READY_TIMES,
  STATUS_LABEL,
  TIERS,
  money,
  nyTime,
  startOfTodayNY,
  type DeliveryStatus,
  type Mode,
  type OrderSize,
  type Tier,
} from '@/lib/constants';
import { cancelDelivery, requestCourier, saveRestaurant } from './actions';

export const dynamic = 'force-dynamic';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  area: string;
  phone: string;
}

interface DeliveryRow {
  id: string;
  customer_address: string;
  tier: Tier;
  order_size: OrderSize;
  fee: number;
  status: DeliveryStatus;
  courier_id: string | null;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
}

export default async function RestaurantPage({
  searchParams,
}: {
  searchParams: { error?: string; notice?: string };
}) {
  const { supabase, user, profile } = await requireRole('restaurant');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, address, area, phone')
    .eq('owner_id', user.id)
    .maybeSingle<Restaurant>();

  if (!restaurant) {
    return (
      <div className="page">
        <main className="wrap">
          <TopBar subtitle={`Signed in as ${profile.full_name || user.email}`} />
          <h1>Set up your restaurant</h1>
          <p className="muted">This is where couriers will pick up. You can only add one restaurant per account.</p>
          <Alert error={searchParams.error} notice={searchParams.notice} />
          <form action={saveRestaurant} className="card">
            <label>
              Restaurant name
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Pickup address
              <input name="address" required maxLength={200} placeholder="Street address" autoComplete="street-address" />
            </label>
            <fieldset className="choices c2">
              <legend>Neighborhood</legend>
              {AREAS.map((a, i) => (
                <label className="choice" key={a}>
                  <input type="radio" name="area" value={a} defaultChecked={i === 0} />
                  <span>{a}</span>
                </label>
              ))}
            </fieldset>
            <label>
              Restaurant phone
              <input name="phone" type="tel" maxLength={30} defaultValue={profile.phone} />
            </label>
            <SubmitButton pendingText="Saving...">Save and continue</SubmitButton>
          </form>
        </main>
      </div>
    );
  }

  const { data: deliveriesData } = await supabase
    .from('deliveries')
    .select('id, customer_address, tier, order_size, fee, status, courier_id, created_at, accepted_at, picked_up_at, delivered_at')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', startOfTodayNY())
    .order('created_at', { ascending: false });
  const deliveries = (deliveriesData ?? []) as DeliveryRow[];

  // Who is coming: the database only shows a courier's name and phone while they hold your job.
  const courierIds = Array.from(new Set(deliveries.map((d) => d.courier_id).filter(Boolean))) as string[];
  const couriers = new Map<string, { name: string; phone: string; mode: string }>();
  if (courierIds.length) {
    const [{ data: people }, { data: rides }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone').in('id', courierIds),
      supabase.from('couriers').select('id, mode').in('id', courierIds),
    ]);
    for (const p of people ?? []) {
      const ride = (rides ?? []).find((r) => r.id === p.id);
      couriers.set(p.id, {
        name: p.full_name,
        phone: p.phone,
        mode: ride ? MODES[ride.mode as Mode] : '',
      });
    }
  }

  const out = deliveries.filter((d) => ['requested', 'accepted', 'picked_up'].includes(d.status)).length;
  const done = deliveries.filter((d) => d.status === 'delivered');
  const feesToday = done.reduce((sum, d) => sum + Number(d.fee), 0);

  return (
    <div className="page">
      <LiveRefresh />
      <main className="wrap">
        <TopBar subtitle={`${restaurant.name} · ${restaurant.area}`} />
        <h1>Request a courier</h1>
        <Alert error={searchParams.error} notice={searchParams.notice} />

        <form action={requestCourier} className="card">
          <label>
            Customer address
            <input name="customer_address" required maxLength={200} placeholder="Street address and apartment" autoComplete="off" />
          </label>
          <label>
            Customer phone (optional)
            <input name="customer_phone" type="tel" maxLength={30} placeholder="Only shown to the courier who accepts" autoComplete="off" />
          </label>
          <fieldset className="choices c3">
            <legend>Trip distance</legend>
            {(Object.keys(TIERS) as Tier[]).map((t, i) => (
              <label className="choice" key={t}>
                <input type="radio" name="tier" value={t} defaultChecked={i === 0} />
                <span>
                  {TIERS[t].label} · {money(TIERS[t].fee)}
                  <small>{TIERS[t].range}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="choices c3">
            <legend>Order size</legend>
            {(Object.keys(ORDER_SIZES) as OrderSize[]).map((s, i) => (
              <label className="choice" key={s}>
                <input type="radio" name="order_size" value={s} defaultChecked={i === 0} />
                <span>{ORDER_SIZES[s]}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="choices c3">
            <legend>Ready for pickup in</legend>
            {READY_TIMES.map((r, i) => (
              <label className="choice" key={r.value}>
                <input type="radio" name="ready_in_minutes" value={r.value} defaultChecked={i === 0} />
                <span>{r.label}</span>
              </label>
            ))}
          </fieldset>
          <label>
            Note for the courier (optional)
            <input name="notes" maxLength={300} placeholder="Buzzer code, side door, fragile..." />
          </label>
          <SubmitButton pendingText="Requesting...">Request a courier</SubmitButton>
        </form>

        <h2>Today&apos;s deliveries</h2>
        <div className="tiles">
          <div className="tile">
            <span>Out now</span>
            <b>{out}</b>
          </div>
          <div className="tile">
            <span>Delivered</span>
            <b>{done.length}</b>
          </div>
          <div className="tile">
            <span>Fees today</span>
            <b>{money(feesToday)}</b>
          </div>
        </div>

        {deliveries.length === 0 ? (
          <p className="muted">No deliveries yet today.</p>
        ) : (
          <div className="stack">
            {deliveries.map((d) => {
              const c = d.courier_id ? couriers.get(d.courier_id) : undefined;
              const canCancel = d.status === 'requested' || d.status === 'accepted';
              return (
                <div className="card" style={{ gap: 8 }} key={d.id}>
                  <div className="row">
                    <b>{d.customer_address}</b>
                    <span className={`badge b-${d.status}`}>{STATUS_LABEL[d.status]}</span>
                  </div>
                  <span className="muted">
                    {ORDER_SIZES[d.order_size]} · {TIERS[d.tier].label} trip · {money(d.fee)} · requested {nyTime(d.created_at)}
                    {d.delivered_at ? ` · delivered ${nyTime(d.delivered_at)}` : ''}
                  </span>
                  {c ? (
                    <span className="muted">
                      Courier: {c.name}
                      {c.mode ? ` · ${c.mode}` : ''}
                      {c.phone ? (
                        <>
                          {' · '}
                          <a href={`tel:${c.phone}`}>{c.phone}</a>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                  {canCancel ? (
                    <form action={cancelDelivery}>
                      <input type="hidden" name="delivery_id" value={d.id} />
                      <SubmitButton className="btn-ghost" pendingText="Cancelling...">
                        Cancel this delivery
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <p className="muted">
          Pickup: {restaurant.address}. Fees are billed weekly; billing isn&apos;t switched on yet.
        </p>
      </main>
    </div>
  );
}
