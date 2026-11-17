// Shows ?error= and ?notice= messages passed back by server actions.
export default function Alert({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="alert info" role="status">
          {notice}
        </p>
      ) : null}
    </>
  );
}
