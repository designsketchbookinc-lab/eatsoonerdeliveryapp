import TopBar from '@/components/TopBar';
import Alert from '@/components/Alert';
import LiveRefresh from '@/components/LiveRefresh';
import SubmitButton from '@/components/SubmitButton';
import { requireRole } from '@/lib/session';
import {
  MODES,
  ORDER_SIZES,
  STATUS_LABEL,
  TIERS,
  ZONES,
  nyTime,
  startOfTodayNY,
  type CourierStatus,
  type DeliveryStatus,
  type Mode,
  type OrderSize,
  type Tier,
  type Zone,
} from '@/lib/constants';
import { apply, deliveryStep, setMode, setOnline } from './actions';

export const dynamic = 'force-dynamic';

interface Courier {
  id: string;
  status: CourierStatus;
  zone: Zone;
  mode: Mode;
  languages: string;
  online: boolean;
}

interface Job {
  id: string;
  customer_address: string;
  tier: Tier;
  order_size: OrderSize;
  ready_in_minutes: number;
  notes: string;
  status: DeliveryStatus;
  created_at: string;
  restaurant: { name: string; address: string; phone: string; zone: Zone } | null;
}

const JOB_FIELDS =
  'id, customer_address, tier, order_size, ready_in_minutes, notes, status, created_at, restaurant:restaurants(name, address, phone, zone)';

function StepButton({ id, step, label, gold }: { id: string; step: string; label: string; gold?: boolean }) {
  return (
    <form action={deliveryStep}>
      <input type="hidden" name="delivery_id" value={id} />
      <input type="hidden" name="step" value={step} />
      <SubmitButton className={gold ? 'btn gold' : step === 'decline' || step === 'release' ? 'btn-ghost' : 'btn'}>
        {label}
      </SubmitButton>
    </form>
  );
}

function JobDetails({ job, phone }: { job: Job; phone?: string }) {
  return (
    <>
      <div>
        <span className="muted">
          Pick up, ready {job.ready_in_minutes === 0 ? 'now' : `${job.ready_in_minutes} min after ${nyTime(job.created_at)}`}
        </span>
        <p>
          <b>{job.restaurant?.name ?? 'Restaurant'}</b>
        </p>
        <p className="muted">
          {job.restaurant?.address}
          {job.restaurant?.phone ? (
            <>
              {' · '}
              <a href={`tel:${job.restaurant.phone}`}>{job.restaurant.phone}</a>
            </>
          ) : null}
        </p>
      </div>
      <div>
        <span className="muted">Drop off</span>
        <p>
          <b>{job.customer_address}</b>
        </p>
        {phone ? (
          <p className="muted">
            Customer: <a href={`tel:${phone}`}>{phone}</a>
          </p>
        ) : null}
      </div>
      <span className="muted">
        {ORDER_SIZES[job.order_size]} · {TIERS[job.tier].label} trip ({TIERS[job.tier].range}) · plus 100% of tips
      </span>
      {job.notes ? <p className="muted">Note: {job.notes}</p> : null}
    </>
  );
}

export default async function CourierPage({
  searchParams,
}: {
  searchParams: { error?: string; notice?: string };
}) {
  const { supabase, user, profile } = await requireRole('courier');
  const { data: courier } = await supabase
    .from('couriers')
    .select('id, status, zone, mode, languages, online')
    .eq('id', user.id)
    .maybeSingle<Courier>();

  const name = profile.full_name || user.email || '';

  // Step 1: the application.
  if (!courier) {
    return (
      <div className="page theme-courier">
        <main className="wrap">
          <TopBar subtitle={`Signed in as ${name}`} />
          <h1>Your courier application</h1>
          <p className="muted">
            We never ask about a car or your driving record. A person reads every application before anyone is
            approved.
          </p>
          <Alert error={searchParams.error} notice={searchParams.notice} />
          <form action={apply} className="card">
            <fieldset className="choices">
              <legend>Where do you want to deliver?</legend>
              {(Object.keys(ZONES) as Zone[]).map((z, i) => (
                <label className="choice" key={z}>
                  <input type="radio" name="zone" value={z} defaultChecked={i === 0} />
                  <span>{ZONES[z]}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="choices c4">
              <legend>How do you deliver?</legend>
              {(Object.keys(MODES) as Mode[]).map((m, i) => (
                <label className="choice" key={m}>
                  <input type="radio" name="mode" value={m} defaultChecked={i === 0} />
                  <span>{MODES[m]}</span>
                </label>
              ))}
            </fieldset>
            <label>
              Languages you speak
              <input name="languages" maxLength={120} defaultValue="English" />
            </label>
            <label>
              Turned away by another app? Tell us what happened (optional)
              <textarea name="second_chance_note" maxLength={1000} placeholder="Only Eat Sooner staff will read this." />
            </label>
            <label className="check">
              <input type="checkbox" name="confirm" value="yes" required />
              <span>I can show a photo ID and I am allowed to work in the US. I&apos;ll use my own account only.</span>
            </label>
            <SubmitButton className="btn gold" pendingText="Sending...">
              Send application
            </SubmitButton>
          </form>
        </main>
      </div>
    );
  }

  // Step 2: waiting for review, or paused.
  if (courier.status !== 'approved') {
    return (
      <div className="page theme-courier">
        <main className="wrap">
          <TopBar subtitle={`Signed in as ${name}`} />
          <Alert error={searchParams.error} notice={searchParams.notice} />
          <section className="card">
            <span className={`badge b-${courier.status}`} style={{ alignSelf: 'flex-start' }}>
              {courier.status === 'pending' ? 'Application under review' : 'Account paused'}
            </span>
            <h1>{courier.status === 'pending' ? 'Thanks for applying' : 'Your account is paused'}</h1>
            <p className="muted">
              {courier.status === 'pending'
                ? 'A person on the Eat Sooner team will review your application and contact you to check your ID. Once you’re approved, this page will show delivery offers.'
                : 'You can’t receive delivery offers right now. Please contact Eat Sooner to talk about it.'}
            </p>
            <p className="muted">
              {ZONES[courier.zone]} · {MODES[courier.mode]}
            </p>
          </section>
        </main>
      </div>
    );
  }

  // Step 3: approved courier.
  const [{ data: activeData }, { data: offersData }, { data: declinedData }, { count: doneToday }] = await Promise.all([
    supabase.from('deliveries').select(JOB_FIELDS).eq('courier_id', user.id).in('status', ['accepted', 'picked_up']).order('accepted_at'),
    supabase.from('deliveries').select(JOB_FIELDS).eq('status', 'requested').order('created_at'),
    supabase.from('delivery_declines').select('delivery_id').eq('courier_id', user.id),
    supabase
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('courier_id', user.id)
      .eq('status', 'delivered')
      .gte('delivered_at', startOfTodayNY()),
  ]);
  const active = (activeData ?? []) as unknown as Job[];
  const declined = new Set((declinedData ?? []).map((d) => d.delivery_id as string));
  const offers = ((offersData ?? []) as unknown as Job[]).filter(
    (j) => j.restaurant?.zone === courier.zone && !declined.has(j.id),
  );

  const phones = new Map<string, string>();
  if (active.length) {
    const { data: contacts } = await supabase
      .from('delivery_contacts')
      .select('delivery_id, customer_phone')
      .in('delivery_id', active.map((a) => a.id));
    for (const c of contacts ?? []) phones.set(c.delivery_id, c.customer_phone);
  }

  return (
    <div className="page theme-courier">
      <LiveRefresh />
      <main className="wrap">
        <TopBar subtitle={`Signed in as ${name}`} />
        <Alert error={searchParams.error} notice={searchParams.notice} />

        <section className="card">
          <div className="row">
            <div>
              <p className="muted">Verified account · {ZONES[courier.zone]}</p>
              <h1>{courier.online ? 'You’re online' : 'You’re offline'}</h1>
            </div>
            <form action={setOnline}>
              <input type="hidden" name="online" value={courier.online ? 'false' : 'true'} />
              <SubmitButton className="btn-ghost" pendingText="...">
                {courier.online ? 'Go offline' : 'Go online'}
              </SubmitButton>
            </form>
          </div>
          <details>
            <summary className="muted" style={{ cursor: 'pointer' }}>
              Delivering by {MODES[courier.mode]} · change
            </summary>
            <form action={setMode} className="stack" style={{ marginTop: 12 }}>
              <fieldset className="choices c4">
                <legend>How you deliver</legend>
                {(Object.keys(MODES) as Mode[]).map((m) => (
                  <label className="choice" key={m}>
                    <input type="radio" name="mode" value={m} defaultChecked={m === courier.mode} />
                    <span>{MODES[m]}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="choices">
                <legend>Where you deliver</legend>
                {(Object.keys(ZONES) as Zone[]).map((z) => (
                  <label className="choice" key={z}>
                    <input type="radio" name="zone" value={z} defaultChecked={z === courier.zone} />
                    <span>{ZONES[z]}</span>
                  </label>
                ))}
              </fieldset>
              <SubmitButton className="btn-ghost" pendingText="Saving...">
                Save
              </SubmitButton>
            </form>
          </details>
        </section>

        {active.length ? (
          <>
            <h2>Your deliveries</h2>
            <div className="stack">
              {active.map((job) => (
                <div className="card" key={job.id}>
                  <span className={`badge b-${job.status}`} style={{ alignSelf: 'flex-start' }}>
                    {job.status === 'accepted' ? 'Go to the restaurant' : STATUS_LABEL[job.status]}
                  </span>
                  <JobDetails job={job} phone={phones.get(job.id)} />
                  {job.status === 'accepted' ? (
                    <div className="grid2">
                      <StepButton id={job.id} step="release" label="Can’t make it" />
                      <StepButton id={job.id} step="picked_up" label="I picked it up" />
                    </div>
                  ) : (
                    <StepButton id={job.id} step="delivered" label="Mark as delivered" />
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}

        <h2>Delivery offers</h2>
        {!courier.online ? (
          <p className="muted">Go online to see delivery offers.</p>
        ) : offers.length === 0 ? (
          <p className="muted">No offers in {ZONES[courier.zone]} right now. New ones appear here on their own.</p>
        ) : (
          <div className="stack">
            {offers.map((job) => (
              <div className="card" key={job.id}>
                <span className="badge b-requested" style={{ alignSelf: 'flex-start' }}>
                  New delivery offer
                </span>
                <JobDetails job={job} />
                <div className="grid2">
                  <StepButton id={job.id} step="decline" label="Decline" />
                  <StepButton id={job.id} step="accept" label="Accept" />
                </div>
                <span className="muted">Declining never counts against your account.</span>
              </div>
            ))}
          </div>
        )}

        <div className="tiles">
          <div className="tile">
            <span>Delivered today</span>
            <b>{doneToday ?? 0}</b>
          </div>
          <div className="tile">
            <span>Active now</span>
            <b>{active.length}</b>
          </div>
          <div className="tile">
            <span>Tips</span>
            <b style={{ fontSize: 16, lineHeight: 1.7 }}>100% yours</b>
          </div>
        </div>
      </main>
    </div>
  );
}
