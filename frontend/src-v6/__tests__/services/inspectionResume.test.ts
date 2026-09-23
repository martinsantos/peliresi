import { beforeEach, describe, expect, it } from 'vitest';
import { clearInspectionResume, readInspectionResume, saveInspectionResume } from '../../services/inspectionResume';

describe('inspection return position', () => {
  beforeEach(() => localStorage.clear());

  it('keeps only a user-scoped navigation reference', () => {
    saveInspectionResume('inspector-1', 'case-1', '#checklist/DOC-01', 'Checklist · Documentación');
    expect(readInspectionResume('inspector-1', 'case-1')).toMatchObject({ hash: '#checklist/DOC-01', label: 'Checklist · Documentación' });
    expect(readInspectionResume('inspector-2', 'case-1')).toBeNull();
    clearInspectionResume('inspector-1', 'case-1');
    expect(readInspectionResume('inspector-1', 'case-1')).toBeNull();
  });

  it('ignores malformed stored links', () => {
    saveInspectionResume('inspector-1', 'case-1', 'https://elsewhere.example', 'No válido');
    expect(readInspectionResume('inspector-1', 'case-1')).toBeNull();
  });
});
