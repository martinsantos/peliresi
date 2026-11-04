import { describe, expect, it } from 'vitest';
import { nextInspectionTask } from '../../pages/inspecciones/inspectionJourney';
describe('inspection journey', () => {
  const available = ['resumen', 'acta', 'checklist', 'declaracion', 'evidencias', 'firma', 'entrega', 'revision', 'informe-tecnico', 'trazabilidad'];
  it('finishes the field journey before entering administrative tools', () => {
    const path: string[] = ['resumen'];
    while (nextInspectionTask(path.at(-1)!, available)) path.push(nextInspectionTask(path.at(-1)!, available)!);
    // Constatar is one scroll: from the act, «continuar» goes to the next section, not to the next open task.
    expect(path).toEqual(['resumen', 'acta', 'evidencias', 'firma', 'entrega', 'revision']);
    expect(nextInspectionTask('checklist', available)).toBe('evidencias');
    expect(nextInspectionTask('declaracion', available)).toBe('evidencias');
  });
  it('skips unavailable comparisons without inventing steps or business transitions', () => {
    expect(nextInspectionTask('checklist', available.filter(id => id !== 'declaracion'))).toBe('evidencias');
    expect(nextInspectionTask('revision', available)).toBeUndefined();
    expect(nextInspectionTask('trazabilidad', available)).toBeUndefined();
  });
});
