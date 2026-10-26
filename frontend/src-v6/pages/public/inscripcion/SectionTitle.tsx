import React from 'react';

export function SectionTitle({ icon: Icon, title }: { icon: React.FC<{ size?: number; className?: string }>; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3" data-testid="registration-section-title">
      <Icon size={20} className="shrink-0 text-primary-800" />
      <h2 tabIndex={-1} className="min-w-0 rounded-sm text-lg font-bold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2">{title}</h2>
    </div>
  );
}
