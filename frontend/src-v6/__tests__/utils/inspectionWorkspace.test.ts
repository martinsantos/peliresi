import { describe, expect, it } from 'vitest';
import { inspectionDateFilter, inspectionFieldDraftKey, inspectionPage, inspectionReturnState, inspectionReturnTarget, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';

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
  it.each(['', '/mobile'])('returns to the same actor tab and page on %s', prefix => {
    const path = `${prefix}/admin/actores/generadores/g-1?tab=inspecciones&inspeccionesPagina=3`;
    const prior = { actorReturn: `${prefix}/manifiestos/m-1?pagina=2#registro` };
    const state = inspectionReturnState(path, 'owner', prior);
    expect(inspectionReturnTarget(state, 'owner', Boolean(prefix))).toEqual({ to: path, label: 'Ficha del actor', state: prior });
    expect(inspectionReturnTarget(state, 'another-owner', Boolean(prefix)).to).toBe(`${prefix}/inspecciones`);
    expect(inspectionReturnTarget(state, 'owner', !prefix).to).toBe(`${prefix ? '' : '/mobile'}/inspecciones`);
  });
  it.each(['/admin/actores/generadores/..', '/admin/actores/generadores/g%2fedit', '/admin/actores/generadores/g-1#x', '//other.invalid/admin/actores/generadores/g-1'])('does not accept a malformed actor return: %s', path => {
    expect(inspectionReturnTarget(inspectionReturnState(path, 'owner'), 'owner').to).toBe('/inspecciones');
  });
  it('does not carry an external origin into the actor ficha', () => {
    const state = inspectionReturnState('/admin/actores/generadores/g-1?tab=inspecciones', 'owner', { actorReturn: 'https://other.invalid', inspectionReturn: '/\\other.invalid' });
    expect(inspectionReturnTarget(state, 'owner')).toEqual({ to: '/admin/actores/generadores/g-1?tab=inspecciones', label: 'Ficha del actor' });
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

  it('never reuses a field draft after actor, establishment or authorization changes', () => {
    const company = { empresaId: 'company', actividadId: 'activity', establecimientoId: 'site', razonSocial: 'QA', rol: 'GENERADOR', actorId: 'actor', autorizacionId: 'auth', revision: 1, todasSedes: false, domicilioLegal: { calle: 'QA', localidad: 'QA', departamento: 'QA' } };
    const base = { ...admin, actorId: 'actor', empresaContexto: company };
    const contexts = [base, { ...base, actorId: 'other' }, ...[{ establecimientoId: 'other' }, { autorizacionId: 'other' }, { revision: 2 }].map(change => ({ ...base, empresaContexto: { ...company, ...change } }))];
    const keys = contexts.map(user => inspectionFieldDraftKey(user.id, inspectionWorkspaceOwner(user), 'case'));
    expect(new Set(keys).size).toBe(contexts.length);
    expect(keys).not.toContain('sitrep_inspection_draft_one_case');
    expect(inspectionFieldDraftKey('one', '', 'case')).toBe('');
  });
});
