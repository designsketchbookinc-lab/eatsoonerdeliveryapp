import TopBar from '@/components/TopBar';
import Alert from '@/components/Alert';
import LiveRefresh from '@/components/LiveRefresh';
import SubmitButton from '@/components/SubmitButton';
import { requireRole } from '@/lib/session';
import {
  MODES,
  STATUS_LABEL,
  TIERS,
  ZONES,
  money,
  nyTime,
  startOfTodayNY,
  type CourierStatus,
  type DeliveryStatus,
  type Mode,
  type Tier,
  type Zone,
} from '@/lib/constants';
import { adminCancel, reviewCourier } from './actions';

export const dynamic = 'force-dynamic';

interface CourierRow {
  id: string;
  status: CourierStatus;
  zone: Zone;
  mode: Mode;
  languages: string;
  second_chance_note: string;
  online: boolean;
  created_at: string;
}

interface DeliveryRow {
  id: string;
  customer_address: string;
  tier: Tier;
  fee: number;
  status: DeliveryStatus;
  courier_id: string | null;
  created_at: string;
  restaurant: { name: string; area: string } | null;
}

function ReviewButton({ id, status, label, gold }: { id: string; status: CourierStatus; label: string; gold?: boolean }) {
  return (
    <form action={reviewCourier}>
      <input type="hidden" name="courier_id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton className={gold ? 'btn gold' : 'btn-ghost'}>{label}</SubmitButton>
    </form>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: { error?: string; notice?: string } }) {
  const { supabase, profile, user } = await requireRole('admin');

  const [{ data: courierData }, { data: deliveryData }, { count: restaurantCount }] = await Promise.all([
    supabase
      .from('couriers')
      .select('id, status, zone, mode, languages, second_chance_note, online, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('deliveries')
      .select('id, customer_address, tier, fee, status, courier_id, created_at, restaurant:restaurants(name, area)')
      .gte('created_at', startOfTodayNY())
      .order('created_at', { ascending: false }),
    supabase.from('restaurants').select('id', { count: 'exact', head: true }),
  ]);
  const couriers = (courierData ?? []) as CourierRow[];
  const deliveries = (deliveryData ?? []) as unknown as DeliveryRow[];

  const ids = couriers.map((c) => c.id);
  const { data: people } = ids.length
    ? await supabase.from('profiles').select('id, full_name, phone').in('id', ids)
    : { data: [] as { id: string; full_name: string; phone: string }[] };
  const person = new Map((people ?? []).map((p) => [p.id, p]));

  const pending = couriers.filter((c) => c.status === 'pending');
  const others = couriers.filter((c) => c.status !== 'pending');
  const delivered = deliveries.filter((d) => d.status === 'delivered');

  return (
    <div className="page">
      <LiveRefresh />
      <main className="wrap wide">
        <TopBar subtitle={`Eat Sooner staff · ${profile.full_name || user.email}`} />
        <Alert error={searchParams.error} notice={searchParams.notice} />

        <div className="tiles">
          <div className="tile">
            <span>Restaurants</span>
            <b>{restaurantCount ?? 0}</b>
          </div>
          <div className="tile">
            <span>Couriers online</span>
            <b>{couriers.filter((c) => c.online).length}</b>
          </div>
          <div className="tile">
            <span>Delivered today · fees</span>
            <b>
              {delivered.length} · {money(delivered.reduce((s, d) => s + Number(d.fee), 0))}
            </b>
          </div>
        </div>

        <h2>Courier applications to review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="muted">No applications waiting.</p>
        ) : (
          <div className="stack">
            {pending.map((c) => {
              const p = person.get(c.id);
              return (
                <div className="card" key={c.id}>
                  <div className="row">
                    <h3>{p?.full_name || 'No name given'}</h3>
                    <span className="muted">applied {new Date(c.created_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</span>
                  </div>
                  <p className="muted">
                    {p?.phone ? <a href={`tel:${p.phone}`}>{p.phone}</a> : 'No phone'} · {ZONES[c.zone]} · {MODES[c.mode]} ·{' '}
                    {c.languages}
                  </p>
                  {c.second_chance_note ? (
                    <p>
                      <b>Their story:</b> {c.second_chance_note}
                    </p>
                  ) : null}
                  <p className="muted">Check their photo ID and work eligibility in person or by video before approving.</p>
                  <div className="grid2">
                    <ReviewButton id={c.id} status="paused" label="Not now" />
                    <ReviewButton id={c.id} status="approved" label="Approve" gold />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h2>All couriers</h2>
        {others.length === 0 ? (
          <p className="muted">No approved or paused couriers yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Area</th>
                  <th>Mode</th>
                  <th>Online</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {others.map((c) => (
                  <tr key={c.id}>
                    <td>{person.get(c.id)?.full_name || '—'}</td>
                    <td>
                      <span className={`badge b-${c.status}`}>{c.status === 'approved' ? 'Approved' : 'Paused'}</span>
                    </td>
                    <td>{ZONES[c.zone]}</td>
                    <td>{MODES[c.mode]}</td>
                    <td>{c.online ? 'Yes' : 'No'}</td>
                    <td>
                      {c.status === 'approved' ? (
                        <ReviewButton id={c.id} status="paused" label="Pause" />
                      ) : (
                        <ReviewButton id={c.id} status="approved" label="Approve" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2>Today&apos;s deliveries ({deliveries.length})</h2>
        {deliveries.length === 0 ? (
          <p className="muted">No deliveries yet today.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Restaurant</th>
                  <th>Drop off</th>
                  <th>Trip</th>
                  <th>Status</th>
                  <th>Courier</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>{nyTime(d.created_at)}</td>
                    <td>
                      {d.restaurant?.name}
                      <br />
                      <span className="muted">{d.restaurant?.area}</span>
                    </td>
                    <td>{d.customer_address}</td>
                    <td>
                      {TIERS[d.tier].label} · {money(d.fee)}
                    </td>
                    <td>
                      <span className={`badge b-${d.status}`}>{STATUS_LABEL[d.status]}</span>
                    </td>
                    <td>{d.courier_id ? person.get(d.courier_id)?.full_name || '—' : '—'}</td>
                    <td>
                      {d.status === 'requested' || d.status === 'accepted' ? (
                        <form action={adminCancel}>
                          <input type="hidden" name="delivery_id" value={d.id} />
                          <SubmitButton className="btn-ghost">Cancel</SubmitButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
