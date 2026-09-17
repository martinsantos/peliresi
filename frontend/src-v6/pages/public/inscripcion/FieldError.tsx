import React from 'react';
import { AlertCircle } from 'lucide-react';

export function FieldError({ show, msg, id }: { show: boolean; msg: string; id?: string }) {
  if (!show) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-xs text-error-600 mt-1">
      <AlertCircle size={12} aria-hidden="true" /> {msg}
    </p>
  );
}
