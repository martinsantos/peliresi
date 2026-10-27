import { useEffect, useRef, useState } from 'react';
import type { CompanyFieldErrors } from '../utils/companyFormValidation';

/** Show field errors after an explicit attempt; typing never steals focus. */
export function useCompanyFormValidation<T extends HTMLElement>(current: CompanyFieldErrors) {
  const ref = useRef<T>(null);
  const [attempted, setAttempted] = useState<string[]>([]);
  const errors = Object.fromEntries(attempted.map(key => [key, current[key]]));
  useEffect(() => {
    if (!attempted.some(key => current[key])) return;
    const field = ref.current?.querySelector<HTMLElement>('input[aria-invalid="true"]:not(:disabled), select[aria-invalid="true"]:not(:disabled), textarea[aria-invalid="true"]:not(:disabled)');
    field?.focus({ preventScroll: true });
    field?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  }, [attempted]);
  return { ref, errors, validate(keys = Object.keys(current)) {
    setAttempted([...keys]);
    return keys.every(key => !current[key]);
  } };
}
