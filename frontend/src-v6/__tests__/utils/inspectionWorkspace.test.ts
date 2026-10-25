import { describe, expect, it } from 'vitest';
import { inspectionDateFilter, inspectionPage, inspectionReturnState, inspectionReturnTarget, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';

const admin = { id: 'one', rol: 'ADMIN' };
describe('inspection workspace continuity', () => {
  it.each(['/inspecciones?vista=agenda&agendaEstado=EN_DESCARGO&agendaPage=2', '/mobile/inspecciones?search=QA&page=2'])('restores filters only within the same surface and identity: %s', path => {
    const owner = inspectionWorkspaceOwner(admin);
    const state = inspectionReturnState(path, owner);
    expect(inspectionReturnTarget(state, owner, path.startsWith('/mobile')).to).toBe(path);
    expect(inspectionReturnTarget(state, inspectionWorkspaceOwner({ ...admin, rol: 'ADMIN_GENERADOR' })).to).toBe('/inspecciones');
  });
  it.each(['https://other.invalid', '//other.invalid', '/inspecciones/secret', '/inspecciones/../usuarios', '/inspecciones#x', '/app/inspecciones'])('rejects an unrecognized return destination %s', path => {
    expect(inspectionReturnTarget(inspectionReturnState(path, 'owner'), 'owner').to).toBe('/inspecciones');
  });
  it('names the view restored and does not cross surfaces', () => {
    const state = inspectionReturnState('/inspecciones?vista=agenda', 'owner');
    expect(inspectionReturnTarget(state, 'owner').label).toBe('Agenda de inspecciones');
    expect(inspectionReturnTarget(state, 'owner', true).to).toBe('/mobile/inspecciones');
  });
  it('rejects invalid dates and pages without passing them to the API', () => {
    expect(inspectionDateFilter('2026-02-30')).toBe('');
    expect(inspectionDateFilter('2026-10-25')).toBe('2026-10-25');
    for (const value of ['-1', 'Infinity', '1.2', 'abc']) expect(inspectionPage(value)).toBe(1);
  });
  it('separates account, role, inspector permission and CAP context', () => {
    const contexts = [admin, { ...admin, id: 'two' }, { ...admin, rol: 'ADMIN_OPERADOR' }, { ...admin, esInspector: true }, { ...admin, training: true }];
    expect(new Set(contexts.map(inspectionWorkspaceOwner)).size).toBe(contexts.length);
  });
});
