/** Presentation order only; business states and permissions are unchanged. */
export const inspectionJourney = [
  { label: 'Visita y lugar', mobileLabel: 'Visita', title: 'Preparar la visita', description: 'Identificá el lugar y a la persona que atiende.', ids: ['resumen', 'contexto'] },
  { label: 'Constataciones', mobileLabel: 'Constatar', title: 'Registrar lo que encontraste', description: 'Describí los hechos, revisá los controles y contrastá lo declarado.', ids: ['acta', 'checklist', 'declaracion'] },
  { label: 'Evidencias', mobileLabel: 'Evidencias', title: 'Documentar con evidencias', description: 'Agregá fotos y explicá qué muestra cada una.', ids: ['evidencias'] },
  { label: 'Revisar y firmar', mobileLabel: 'Finalizar', title: 'Revisar y finalizar la visita', description: 'Mostrá el acta, registrá la firma y resolvé los pendientes antes de enviarla a revisión.', ids: ['firma', 'entrega', 'revision'] },
];
const taskLabels: Record<string, string> = {
  resumen: 'Visita y lugar', contexto: 'Visita y lugar', acta: 'Hechos, actividad y entorno',
  checklist: 'Controles en campo', declaracion: 'Comparar con lo declarado',
  evidencias: 'Fotos y archivos', firma: 'Leer el acta y registrar la firma',
  entrega: 'Copia del acta y respuestas', revision: 'Pendientes y envío a revisión',
  'informe-tecnico': 'Informe técnico', intercambios: 'Requerimientos y respuestas',
  trazabilidad: 'Historial de intervenciones', verificacion: 'Verificación QR',
  organizacion: 'Asignación y programación', copias: 'Copias de versiones anteriores',
};
export const inspectionTaskLabel = (step: { id: string; label: string }) => taskLabels[step.id] || step.label;
export function nextInspectionTask(active: string, available: string[]): string | undefined {
  const ordered = inspectionJourney.flatMap(section => section.ids).filter(id => available.includes(id));
  const position = ordered.indexOf(active);
  return position < 0 ? undefined : ordered[position + 1];
}
