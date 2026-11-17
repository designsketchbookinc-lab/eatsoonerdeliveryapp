import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';
import { homeFor, TIERS, money, type Role } from '@/lib/constants';

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<{ role: Role }>();
    if (profile) redirect(homeFor(profile.role));
  }

  return (
    <div className="page">
      <main className="wrap">
        <div className="logo-row">
          <Logo width={340} />
        </div>
        <div className="stack center">
          <h1>Your orders, delivered by neighbors.</h1>
          <p className="muted">
            Keep taking orders your way. Request an Eat Sooner courier when the food is ready. Our couriers ride,
            walk or take transit, so no car or driver&apos;s license is needed.
          </p>
        </div>

        <section className="card" aria-labelledby="for-restaurants">
          <h2 id="for-restaurants">For restaurants</h2>
          <div className="stack">
            {Object.values(TIERS).map((t) => (
              <div className="row" key={t.label}>
                <span>
                  <b>{t.label} trip</b> <span className="muted">{t.range}</span>
                </span>
                <span className="fee" style={{ fontSize: 20 }}>
                  {money(t.fee)}
                </span>
              </div>
            ))}
          </div>
          <p className="muted">No contract and no setup fee. Every tip goes to the courier.</p>
          <Link className="btn" href="/signup?role=restaurant">
            Sign up your restaurant
          </Link>
        </section>

        <section className="card theme-courier" aria-labelledby="for-couriers" style={{ background: '#18205a' }}>
          <h2 id="for-couriers">For couriers</h2>
          <p className="muted">
            Your own account, on a bike, on foot or by transit. We never ask about a car or your driving record.
            Turned away somewhere else? A person reviews every application.
          </p>
          <Link className="btn gold" href="/signup?role=courier">
            Deliver with Eat Sooner
          </Link>
        </section>

        <p className="center">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
        <p className="muted center">Serving Sunnyside, Long Island City, Astoria, Midtown and Harlem.</p>
      </main>
    </div>
  );
}
