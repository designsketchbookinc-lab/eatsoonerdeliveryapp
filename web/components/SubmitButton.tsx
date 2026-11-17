'use client';

import { useFormStatus } from 'react-dom';

// A submit button that disables itself while the form is sending, so a tap
// can't request the same courier twice.
export default function SubmitButton({
  children,
  pendingText = 'Working...',
  className = 'btn',
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
