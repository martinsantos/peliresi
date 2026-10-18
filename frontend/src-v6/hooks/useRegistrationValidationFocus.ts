import { useEffect, useRef } from 'react';

/** Only an explicit attempt to continue/submit moves focus, never typing or an
 * asynchronous save. Scope the search to this form, not other open dialogs. */
export function useRegistrationValidationFocus(attempted: ReadonlySet<number>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!attempted.size) return;
    const field = ref.current?.querySelector<HTMLElement>(
      'input[aria-invalid="true"]:not(:disabled), textarea[aria-invalid="true"]:not(:disabled), select[aria-invalid="true"]:not(:disabled), button[aria-invalid="true"]:not(:disabled)',
    );
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  }, [attempted]);
  return ref;
}
