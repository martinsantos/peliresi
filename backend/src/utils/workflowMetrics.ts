export interface WorkflowDates {
  createdAt: Date | string;
  fechaFirma: Date | string | null;
  fechaRetiro: Date | string | null;
  fechaEntrega: Date | string | null;
  fechaRecepcion: Date | string | null;
  fechaCierre: Date | string | null;
}

type DateKey = keyof WorkflowDates;

const STAGES: Array<{ name: string; from: DateKey; to: DateKey }> = [
  { name: 'Creación → Firma', from: 'createdAt', to: 'fechaFirma' },
  { name: 'Firma → Retiro', from: 'fechaFirma', to: 'fechaRetiro' },
  { name: 'Retiro → Entrega', from: 'fechaRetiro', to: 'fechaEntrega' },
  { name: 'Entrega → Recepción', from: 'fechaEntrega', to: 'fechaRecepcion' },
  { name: 'Recepción → Cierre', from: 'fechaRecepcion', to: 'fechaCierre' },
];

export function calculateAverageStageTimes(manifests: WorkflowDates[]) {
  return STAGES.map(stage => {
    const hours: number[] = [];
    for (const manifest of manifests) {
      const from = manifest[stage.from];
      const to = manifest[stage.to];
      if (!from || !to) continue;
      const difference = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
      if (Number.isFinite(difference) && difference >= 0) hours.push(difference);
    }
    const average = hours.length > 0 ? hours.reduce((sum, value) => sum + value, 0) / hours.length : 0;
    return { name: stage.name, value: Math.round(average * 10) / 10, sampleSize: hours.length };
  });
}
