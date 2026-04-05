import React from 'react';
import { AlertCircle } from 'lucide-react';

export function FieldError({ show, msg }: { show: boolean; msg: string }) {
  if (!show) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-error-600 mt-1">
      <AlertCircle size={12} /> {msg}
    </p>
  );
}
