import React from 'react';

export function SectionTitle({ icon: Icon, title }: { icon: React.FC<{ size?: number; className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={20} className="text-[#0D8A4F]" />
      <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
    </div>
  );
}
