import { describe, expect, it } from 'vitest';
import type { User } from '../../contexts/AuthContext';
import { actorWorkspaceNavigation, actorWorkspaceRoute } from '../../utils/actorWorkspace';
import { workspaceSectionPath, workspaceTitle } from '../../utils/workspaceNavigation';
import { contextualGuidance } from '../../utils/contextualGuidance';

const admin = { id: 'qa', rol: 'ADMIN' } as User;
const kinds = [['generadores', 'GENERADOR', 'generador'], ['transportistas', 'TRANSPORTISTA', 'transportista'], ['operadores', 'OPERADOR', 'operador']] as const;
for (const prefix of ['', '/app', '/mobile']) describe('actor workspace on ' + (prefix || 'web'), () => {
  for (const [kind, role, label] of kinds) {
    const list = prefix + '/admin/actores/' + kind, detail = list + '/qa';
    it(`keeps ${kind} list filters, tab and entry context through editing`, () => {
      const entry = list + '?search=QA%20Uno&page=3&sortOrder=desc';
      const nav = actorWorkspaceNavigation(detail + '/editar', admin, { actorReturn: entry, actorDetailReturn: detail + '?tab=historial' })!;
      expect(nav.backPath).toBe(detail + '?tab=historial');
      expect(nav.returnState.actorReturn).toBe(entry);
      expect(actorWorkspaceNavigation(nav.backPath, admin, nav.returnState)?.backPath).toBe(entry);
      expect(actorWorkspaceNavigation(list + '/nuevo', admin, { actorReturn: entry })?.backPath).toBe(entry);
    });
    it(`names the ${label} ficha and retains the manifest section across the edit round trip`, () => {
      const entry = prefix + '/manifiestos/m-qa?from=agenda#certificaciones';
      const state = { actorReturn: entry, actorDetailReturn: detail + '?tab=historial' };
      const ficha = actorWorkspaceNavigation(detail, admin, state)!;
      const edit = actorWorkspaceNavigation(detail + '/editar', admin, state)!;
      expect(ficha.backLabel).toBe('Volver al manifiesto');
      expect(ficha.title).toBe('Ficha del ' + label);
      expect(workspaceTitle(detail)).toBe(ficha.title);
      expect(workspaceSectionPath(detail, admin, state)).toBe('/manifiestos');
      expect(workspaceSectionPath(detail + '/editar', admin, state)).toBe('/manifiestos');
      expect(actorWorkspaceNavigation(edit.backPath, admin, edit.returnState)?.backPath).toBe(entry);
      expect(edit.backLabel).toBe('Volver a la ficha');
    });
    it(`retains an inspection origin and anchor for ${kind}`, () => {
      const entry = prefix + '/inspecciones/i-qa?tab=acta#intercambios';
      const nav = actorWorkspaceNavigation(detail, admin, { inspectionReturn: entry })!;
      expect(nav.backPath).toBe(entry); expect(nav.backLabel).toBe('Volver a la inspección');
      expect(nav.sectionPath).toBe('/inspecciones');
    });
    it(`gives the ordinary ${role} a profile return and consultation help, never an administrative shortcut`, () => {
      const user = { id: 'qa', rol: role, actorId: 'qa' } as User;
      const nav = actorWorkspaceNavigation(detail, user, { actorReturn: prefix + '/inspecciones/unauthorized' })!;
      expect(nav.backPath).toBe(prefix + '/mi-perfil');
      expect(nav.backLabel).toBe('Volver a mi perfil');
      expect(nav.sectionPath).toBe('/mi-perfil');
      const help = contextualGuidance(detail, role);
      expect(help.manual).toBe('fichas-propias-actores');
      expect(help.steps.join(' ')).not.toContain('Presentar');
      expect(help.steps.join(' ')).not.toContain('usá Editar');
      expect(contextualGuidance(list, 'ADMIN').title).toBe('Consultar ' + kind);
      expect(contextualGuidance(detail + '/editar', 'ADMIN').steps.join(' ')).toContain('Guardar cambios');
      expect(contextualGuidance(detail + '/editar', 'ADMIN').steps.join(' ')).not.toContain('presenta el alta');
    });
  }
  it('does not follow foreign, unsafe, wrong-surface, unknown or circular origins', () => {
    const list = prefix + '/admin/actores/generadores', detail = list + '/qa';
    const wrongSurface = prefix ? '/manifiestos/m' : '/app/manifiestos/m';
    for (const target of ['https://other.invalid/manifiestos/m', '//other.invalid', prefix + '/manifiestos/../dashboard', prefix + '/manifiestos/%2e%2e/dashboard', prefix + '/manifiestos/m\\bad', prefix + '/manifiestos/%5cbad', wrongSurface, detail, detail + '/editar', prefix + '/unknown', prefix + '/admin/usuarios']) {
      expect(actorWorkspaceNavigation(detail, admin, { actorReturn: target })?.backPath, target).toBe(list);
    }
    expect(actorWorkspaceNavigation(detail + '/editar', admin, { actorDetailReturn: list + '/another?tab=fiscal' })?.backPath).toBe(detail);
  });
  it('returns from a new actor form to its authorized overview and preserved filters', () => {
    const overview = prefix + '/admin/actores?q=QA&page=3&estado=inactivo';
    const form = prefix + '/admin/actores/generadores/nuevo';
    const nav = actorWorkspaceNavigation(form, admin, { actorReturn: overview })!;
    expect(nav.backPath).toBe(overview);
    expect(nav.backLabel).toBe('Volver a Actores');
    expect(nav.sectionPath).toBe('/admin/actores');
  });
  it('does not inherit an origin that belongs to a previous role or site', () => {
    const user = { id: 'qa', rol: 'GENERADOR', actorId: 'qa' } as User;
    const path = prefix + '/admin/actores/generadores/qa';
    expect(actorWorkspaceNavigation(path, user, { actorReturn: prefix + '/admin/actores/generadores?page=2' })?.backPath).toBe(prefix + '/mi-perfil');
    const siteUser = { ...user, empresaContexto: { todasSedes: false } } as User;
    expect(actorWorkspaceNavigation(path, siteUser, { actorReturn: prefix + '/admin/actores' })?.backPath).toBe(prefix + '/mi-perfil');
  });
  it('returns to the specific notice without losing the active section', () => {
    const user = { id: 'qa', rol: 'GENERADOR', actorId: 'qa' } as User;
    const detail = prefix + '/admin/actores/generadores/qa';
    const entry = prefix + '/notificaciones/n-1';
    const nav = actorWorkspaceNavigation(detail, user, { actorReturn: entry })!;
    expect(nav.backPath).toBe(entry);
    expect(nav.backLabel).toBe('Volver al aviso');
    expect(nav.sectionPath).toBe('/notificaciones');
    expect(actorWorkspaceNavigation(detail, user, { actorReturn: prefix + '/notificaciones/../dashboard' })?.backPath).toBe(prefix + '/mi-perfil');
  });
});
it('recognizes legacy fiche paths without treating creation as a record', () => {
  expect(actorWorkspaceRoute('/admin/generadores/qa')?.stage).toBe('detail');
  expect(actorWorkspaceRoute('/actores/operadores/qa')?.role).toBe('OPERADOR');
  expect(actorWorkspaceRoute('/admin/actores/generadores/nuevo')?.stage).toBe('create');
  expect(actorWorkspaceRoute('/admin/actores/generadores/%2Fqa')).toBeNull();
  expect(actorWorkspaceRoute('/admin/actores/generadores/nuevo/editar')).toBeNull();
});
