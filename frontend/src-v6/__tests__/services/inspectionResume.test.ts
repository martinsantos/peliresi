import { beforeEach, describe, expect, it } from 'vitest';
import { clearInspectionResume, readInspectionResume, saveInspectionResume } from '../../services/inspectionResume';

describe('inspection return position', () => {
  beforeEach(() => localStorage.clear());

  it('keeps only a user-scoped navigation reference', () => {
    saveInspectionResume('inspector-1', 'case-1', '#checklist/DOC-01', 'Checklist · Documentación', 'context-A');
    expect(readInspectionResume('inspector-1', 'case-1', 'context-A')).toMatchObject({ hash: '#checklist/DOC-01', label: 'Checklist · Documentación' });
    expect(readInspectionResume('inspector-2', 'case-1', 'context-A')).toBeNull();
    clearInspectionResume('inspector-1', 'case-1', 'context-A');
    expect(readInspectionResume('inspector-1', 'case-1', 'context-A')).toBeNull();
  });

  it('ignores malformed stored links', () => {
    saveInspectionResume('inspector-1', 'case-1', 'https://elsewhere.example', 'No válido', 'context-A');
    expect(readInspectionResume('inspector-1', 'case-1', 'context-A')).toBeNull();
  });

  it('separates the return point by authorization context, preserving the original', () => {
    saveInspectionResume('inspector-1', 'case-1', '#checklist/DOC-01', 'Control de documentación', 'context-A');
    expect(readInspectionResume('inspector-1', 'case-1', 'context-B')).toBeNull();
    expect(readInspectionResume('inspector-1', 'case-1', 'context-A')?.hash).toBe('#checklist/DOC-01');
  });
});
