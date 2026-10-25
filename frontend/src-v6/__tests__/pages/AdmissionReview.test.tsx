import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Renovacion } from '../../types/api';
const state = vi.hoisted(() => ({
  context: { owner: 'account:admin', actorType: '', role: 'ADMIN', ready: true },
  list: {} as any, applications: {} as any, detail: {} as any,
  getDetail: vi.fn(), approve: vi.fn(), reject: vi.fn(), filters: vi.fn(),
}));
vi.mock('../../hooks/useAdmissionContext', () => ({ useAdmissionContext: () => state.context }));
vi.mock('../../hooks/useRenovaciones', () => ({
  useRenovaciones: (f: unknown) => { state.filters(f); return state.list; },
  useRenovacion: (id: string) => { state.getDetail(id); return state.detail; },
  useAprobarRenovacion: () => ({ mutateAsync: state.approve }),
  useRechazarRenovacion: () => ({ mutateAsync: state.reject }),
}));
vi.mock('../../hooks/useSolicitudes', () => ({ useSolicitudes: (f: unknown) => { state.filters(f); return state.applications; } }));
import AdminRenovacionesPage, { RenewalReview } from '../../pages/admin/AdminRenovacionesPage';
import AdminSolicitudesPage from '../../pages/admin/AdminSolicitudesPage';
import { applicationReturn, applicantName, renewalChanges } from '../../utils/admissionReview';
import { AdmissionTabs } from '../../components/registration/AdmissionTabs';
import { workspaceSectionPath } from '../../utils/workspaceNavigation';
const renewal: Renovacion = { id: 'r1', anio: 2026, tipoActor: 'GENERADOR', modalidad: 'CON_CAMBIOS', estado: 'PENDIENTE', createdAt: '2026-10-25', generador: { razonSocial: 'Empresa de práctica', cuit: '30-00000000-0' }, datosActuales: JSON.stringify({ telefono: '111' }), datosNuevos: JSON.stringify({ telefono: '222' }) };
const query = (data: unknown) => ({ data, isPending: false, isError: false, isFetching: false, refetch: vi.fn().mockResolvedValue({}) });
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  state.context = { owner: 'account:admin', actorType: '', role: 'ADMIN', ready: true };
  state.list = query({ items: [renewal], total: 21, totalPages: 2 });
  state.applications = query({ items: [{ id: 's1', tipoActor: 'GENERADOR', estado: 'OBSERVADA', datosActor: '{"razonSocial":"Solicitante QA"}', usuario: { nombre: 'Persona', email: 'persona@night-qa.invalid' } }], total: 21, totalPages: 2 });
  state.detail = query(renewal);
  state.approve.mockResolvedValue(renewal); state.reject.mockResolvedValue(renewal);
});
afterEach(cleanup);
function Location() { const l = useLocation(); return <output aria-label="Ruta actual">{l.pathname + l.search}</output>; }
function Detail() {
  const l = useLocation(), n = useNavigate();
  return <button onClick={() => n(applicationReturn(l.state, l.pathname.startsWith('/app/') ? '/app/admin/solicitudes' : '/admin/solicitudes', state.context.owner))}>Regresar</button>;
}
function list(kind: 'applications' | 'renewals', prefix = '') {
  const path = '/admin/' + (kind === 'applications' ? 'solicitudes' : 'renovaciones');
  return render(<MemoryRouter basename={prefix || '/'} initialEntries={[prefix + path]}><Location /><Routes><Route path={path} element={kind === 'applications' ? <AdminSolicitudesPage /> : <AdminRenovacionesPage />} /><Route path={path + '/:id'} element={<Detail />} /></Routes></MemoryRouter>);
}
it.each(['', '/app'])('application list keeps filters and page through detail/back (%s)', async prefix => {
  list('applications', prefix);
  fireEvent.change(screen.getByLabelText('Nombre o correo del solicitante'), { target: { value: 'QA' } });
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'OBSERVADA' } });
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente', exact: true }));
  expect(state.filters).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'QA', estado: 'OBSERVADA', page: 2 }));
  expect(screen.getByRole('navigation', { name: 'Páginas de resultados' }).closest('.hidden')).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Revisar Solicitante QA' }));
  fireEvent.click(screen.getByRole('button', { name: 'Regresar' }));
  expect(screen.getByLabelText('Nombre o correo del solicitante')).toHaveValue('QA');
  expect(screen.getByLabelText('Estado')).toHaveValue('OBSERVADA');
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('page=2');
});
it.each(['applications', 'renewals'] as const)('%s: failed read is not an empty list and retry preserves filters', kind => {
  (kind === 'applications' ? state.applications : state.list).isError = true;
  list(kind);
  expect(screen.getByRole('alert')).toHaveTextContent('Tus filtros se conservan');
  expect(screen.queryByText(/No hay (solicitudes|renovaciones)/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
  expect((kind === 'applications' ? state.applications : state.list).refetch).toHaveBeenCalledOnce();
});
it('renewals: opens fresh detail without deciding and retains page when closed', () => {
  list('renewals', '/app');
  fireEvent.change(screen.getByLabelText('Año'), { target: { value: '' } });
  expect(state.filters).toHaveBeenLastCalledWith(expect.objectContaining({ anio: undefined }));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Revisar Empresa de práctica, 2026' }));
  expect(state.getDetail).toHaveBeenCalledWith('r1');
  expect(screen.getByText('111')).toBeVisible(); expect(screen.getByText('222')).toBeVisible();
  expect(state.approve).not.toHaveBeenCalled(); expect(state.reject).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Cerrar/ }));
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('page=2');
});
it('requires confirmation and protects concurrent approval clicks', async () => {
  let resolve!: () => void; state.approve.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  render(<RenewalReview id="r1" owner="admin" role="ADMIN" close={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar renovación', exact: true }));
  expect(state.approve).not.toHaveBeenCalled();
  const confirm = screen.getByRole('button', { name: 'Confirmar aprobación', exact: true });
  expect(confirm).toHaveFocus();
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(state.approve).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Volver a revisar', exact: true })).toBeDisabled();
  await act(async () => { resolve(); });
  expect(screen.getByRole('status')).toHaveTextContent('Renovación aprobada');
  expect(screen.getByRole('status')).toHaveFocus();
});
it('reject reason survives failed decision and closing/reopening, and is isolated by owner', async () => {
  state.reject.mockRejectedValue(new Error('offline'));
  let view = render(<RenewalReview id="r1" owner="admin" role="ADMIN" close={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Rechazar con motivo' }));
  fireEvent.change(screen.getByLabelText('Motivo del rechazo'), { target: { value: 'ab' } });
  expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motivo del rechazo'), { target: { value: 'Falta documentación de práctica' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' })); });
  expect(state.detail.refetch).toHaveBeenCalled();
  expect(screen.getByLabelText('Motivo del rechazo')).toHaveValue('Falta documentación de práctica');
  view.unmount(); view = render(<RenewalReview id="r1" owner="other-admin" role="ADMIN" close={vi.fn()} />);
  expect(screen.queryByLabelText('Motivo del rechazo')).not.toBeInTheDocument();
  view.unmount(); render(<RenewalReview id="r1" owner="admin" role="ADMIN" close={vi.fn()} />);
  expect(screen.getByLabelText('Motivo del rechazo')).toHaveValue('Falta documentación de práctica');
});
it.each(['error', 'fetching', 'processed', 'wrong-role', 'malformed'] as const)('prevents approval when %s', failure => {
  if (failure === 'error') state.detail.isError = true;
  if (failure === 'fetching') state.detail.isFetching = true;
  if (failure === 'processed') state.detail.data = { ...renewal, estado: 'APROBADA' };
  if (failure === 'malformed') state.detail.data = { ...renewal, datosNuevos: '{broken' };
  render(<RenewalReview id="r1" owner="admin" role={failure === 'wrong-role' ? 'ADMIN_OPERADOR' : 'ADMIN'} close={vi.fn()} />);
  const b = screen.queryByRole('button', { name: 'Aprobar renovación', exact: true });
  if (b) expect(b).toBeDisabled();
  expect(state.approve).not.toHaveBeenCalled();
});
it('area reviewer cannot choose another activity filter', () => {
  state.context = { ...state.context, actorType: 'OPERADOR', role: 'ADMIN_OPERADOR' };
  list('renewals');
  expect(screen.queryByLabelText('Actividad')).not.toBeInTheDocument();
  expect(state.filters).toHaveBeenLastCalledWith(expect.objectContaining({ tipoActor: 'OPERADOR' }));
});
it('does not interpret malformed JSON as no changes or a raw field count', () => {
  expect(renewalChanges({ ...renewal, datosNuevos: '[]' }).valid).toBe(false);
  expect(renewalChanges({ ...renewal, datosNuevos: '{"telefono":null}' }).rows[0].after).toBe('Sin declarar');
  expect(renewalChanges({ ...renewal, camposModificados: '{broken' }).rows).toHaveLength(1);
  expect(applicantName({ datosActor: '{bad', usuario: { nombre: 'Persona' } } as any)).toBe('Persona');
});
it('return destination rejects another account or another origin/surface', () => {
  const base = '/app/admin/solicitudes';
  for (const path of ['https://evil.invalid/app/admin/solicitudes', '/admin/solicitudes', '/app/empresas']) expect(applicationReturn({ admissionReturn: { owner: 'a', path } }, base, 'a')).toBe(base);
  expect(applicationReturn({ admissionReturn: { owner: 'a', path: base + '?page=2' } }, base, 'b')).toBe(base);
});
it.each(['', '/app'])('keeps filters when moving between admission sections (%s)', prefix => {
  render(<MemoryRouter basename={prefix || '/'} initialEntries={[prefix + '/admin/solicitudes?search=QA&page=2']}><Location /><Routes>
    <Route path="/admin/solicitudes" element={<AdmissionTabs active="solicitudes" />} />
    <Route path="/admin/renovaciones" element={<AdmissionTabs active="renovaciones" />} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: 'Renovaciones', exact: true }));
  fireEvent.click(screen.getByRole('link', { name: 'Inscripciones', exact: true }));
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/admin/solicitudes?search=QA&page=2');
  expect(workspaceSectionPath(prefix + '/admin/renovaciones')).toBe('/admin/solicitudes');
});
it('does not offer renewals to transport administration', () => {
  state.context = { ...state.context, role: 'ADMIN_TRANSPORTISTA', actorType: 'TRANSPORTISTA' };
  render(<MemoryRouter><AdmissionTabs active="solicitudes" /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: 'Renovaciones', exact: true })).not.toBeInTheDocument();
});
