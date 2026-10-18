import { Factory, Truck, FlaskConical } from 'lucide-react';

const CATEGORIES = {
  generador: { label: 'Generador', Icon: Factory, color: 'text-purple-700 bg-purple-50' },
  transportista: { label: 'Transportista', Icon: Truck, color: 'text-orange-700 bg-orange-50' },
  operador: { label: 'Operador', Icon: FlaskConical, color: 'text-blue-700 bg-blue-50' },
};

/** These event summaries do not carry actor IDs; do not invent navigation. */
export function MonitorActorRow({ category, name }: { category: keyof typeof CATEGORIES; name: string }) {
  const { label, Icon, color } = CATEGORIES[category];
  return <li className="flex items-center gap-2">
    <span className={`shrink-0 rounded p-1 ${color}`}><Icon size={16} aria-hidden="true" /></span>
    <span className="min-w-0">
      <span className="block text-[10px] text-neutral-600">{label}</span>
      <span className="block truncate text-[11px] font-medium text-neutral-800" title={name}>{name}</span>
    </span>
  </li>;
}
