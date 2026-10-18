import React from 'react';

export function SectionTitle({ icon: Icon, title }: { icon: React.FC<{ size?: number; className?: string }>; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3" data-testid="registration-section-title">
      <Icon size={20} className="shrink-0 text-primary-800" />
      <h3 className="min-w-0 text-lg font-bold text-neutral-900">{title}</h3>
    </div>
  );
}
