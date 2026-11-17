import Link from 'next/link';
import Logo from '@/components/Logo';
import Alert from '@/components/Alert';
import SubmitButton from '@/components/SubmitButton';
import { signUp } from './actions';

export default function SignUpPage({ searchParams }: { searchParams: { role?: string; error?: string } }) {
  const role = searchParams.role === 'courier' ? 'courier' : 'restaurant';
  const isCourier = role === 'courier';

  return (
    <div className={'page' + (isCourier ? ' theme-courier' : '')}>
      <main className="wrap">
        <div className="logo-row">
          <Link href="/" aria-label="Eat Sooner home">
            <Logo width={300} />
          </Link>
        </div>
        <div className="stack">
          <h1>{isCourier ? 'Deliver with Eat Sooner' : 'Sign up your restaurant'}</h1>
          <p className="muted">
            {isCourier
              ? 'Create your own account. Next you will tell us where and how you deliver, and a person will review your application.'
              : 'Create your account. Next you will add your restaurant’s name and pickup address.'}
          </p>
        </div>
        <Alert error={searchParams.error} />
        <form action={signUp} className="card">
          <input type="hidden" name="role" value={role} />
          <label>
            {isCourier ? 'Your full name' : 'Your name'}
            <input name="full_name" autoComplete="name" required maxLength={120} />
          </label>
          <label>
            Phone number
            <input name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="So we can reach you" />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <SubmitButton className={isCourier ? 'btn gold' : 'btn'} pendingText="Creating your account...">
            Create account
          </SubmitButton>
        </form>
        <p className="center">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
        <p className="center muted">
          {isCourier ? (
            <Link href="/signup?role=restaurant">Signing up a restaurant instead?</Link>
          ) : (
            <Link href="/signup?role=courier">Want to deliver instead?</Link>
          )}
        </p>
      </main>
    </div>
  );
}
