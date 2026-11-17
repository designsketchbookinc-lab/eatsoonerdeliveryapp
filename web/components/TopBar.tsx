import Logo from '@/components/Logo';

export default function TopBar({ subtitle }: { subtitle: string }) {
  return (
    <>
      <div className="logo-row">
        <Logo width={300} />
      </div>
      <div className="topbar">
        <p className="muted">{subtitle}</p>
        <form action="/auth/signout" method="post" className="inline">
          <button type="submit" className="btn-ghost">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
