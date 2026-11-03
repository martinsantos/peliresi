import { describe, expect, it } from 'vitest';
import { nextInspectionTask } from '../../pages/inspecciones/inspectionJourney';
describe('inspection journey', () => {
  const available = ['resumen', 'acta', 'checklist', 'declaracion', 'evidencias', 'firma', 'entrega', 'revision', 'informe-tecnico', 'trazabilidad'];
  it('finishes the field journey before entering administrative tools', () => {
    const path: string[] = ['resumen'];
    while (nextInspectionTask(path.at(-1)!, available)) path.push(nextInspectionTask(path.at(-1)!, available)!);
    expect(path).toEqual(available.slice(0, 8));
  });
  it('skips unavailable comparisons without inventing steps or business transitions', () => {
    expect(nextInspectionTask('checklist', available.filter(id => id !== 'declaracion'))).toBe('evidencias');
    expect(nextInspectionTask('revision', available)).toBeUndefined();
    expect(nextInspectionTask('trazabilidad', available)).toBeUndefined();
  });
});
