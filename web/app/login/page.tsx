import Link from 'next/link';
import Logo from '@/components/Logo';
import Alert from '@/components/Alert';
import SubmitButton from '@/components/SubmitButton';
import { signIn } from './actions';

export default function LoginPage({ searchParams }: { searchParams: { error?: string; notice?: string } }) {
  return (
    <div className="page">
      <main className="wrap">
        <div className="logo-row">
          <Link href="/" aria-label="Eat Sooner home">
            <Logo width={300} />
          </Link>
        </div>
        <h1>Sign in</h1>
        <Alert error={searchParams.error} notice={searchParams.notice} />
        <form action={signIn} className="card">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>
        </form>
        <p className="center">
          New here? <Link href="/signup?role=restaurant">Sign up a restaurant</Link> or{' '}
          <Link href="/signup?role=courier">become a courier</Link>.
        </p>
      </main>
    </div>
  );
}
