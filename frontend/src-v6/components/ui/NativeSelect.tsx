import { useId, type ReactNode } from 'react';

export function NativeSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: ReactNode;
}) {
  const id = useId();
  return <div className="block space-y-1 text-sm font-medium text-neutral-700">
    <label htmlFor={id} className="block">{label}</label>
    <select id={id} className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-800"
      value={value} onChange={event => onChange(event.target.value)}>{children}</select>
  </div>;
}
