import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BajaIntensidadPage from '../../pages/manifiestos/BajaIntensidadPage';
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), user: { id: 'qa-operator', rol: 'OPERADOR' } }));
vi.mock('../../services/api', () => ({ api: mock }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mock.user }) }));
const id = '00000000-0000-4000-8000-000000000001';
const entry = { id, referencia: 'BI-' + id, version: 0, etapa: 'RECIBIDO', puedeRegistrar: true, puedeResolver: false,
  datos: { generador: { nombre: 'QA externo', identificacion: 'Declarada', domicilio: 'QA' },
    transportista: { nombre: 'QA externo transporte', identificacion: 'Declarada', domicilio: 'QA' },
    patente: 'QA-1', motivo: 'Sin alta', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] },
  revisiones: [{ objetivo: id, estado: 'PENDIENTE', solicitada: false }], eventos: [] };
function view(detail = false, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/manifiestos/baja-intensidad' + (detail ? '?registro=' + id : '')]}><BajaIntensidadPage /></MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); mock.user = { id: 'qa-operator', rol: 'OPERADOR' }; vi.stubEnv('VITE_MANIFEST_EXCEPTIONAL_ENABLED', 'true');
  mock.get.mockResolvedValue({ data: { data: { registro: entry, registros: [], total: 0 } } });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it('disabled feature never fetches or shows write controls', () => {
  vi.stubEnv('VITE_MANIFEST_EXCEPTIONAL_ENABLED', 'false'); view();
  expect(screen.getByText('Circuito no habilitado.')).toBeVisible();
  expect(mock.get).not.toHaveBeenCalled(); expect(mock.post).not.toHaveBeenCalled();
});
it('pending conformity does not disable recording treatment, nor grant reviewer buttons', async () => {
  view(true); await screen.findByText('Operación: Recibido');
  expect(screen.getByText(/Pendiente de conformidad/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'Hecho registrado con evidencia' } });
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Aprobar post facto' })).not.toBeInTheDocument();
});
it('failed write retains note, same request id on retry, no false confirmation', async () => {
  mock.post.mockRejectedValue(new Error('offline')); view(true); await screen.findByText('Operación: Recibido');
  fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'Evidencia conservada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Nota de la acción')).toHaveValue('Evidencia conservada');
  expect(screen.getByText('Operación: Recibido')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2));
  expect(mock.post.mock.calls[0]).toEqual(mock.post.mock.calls[1]);
});
it('an HTTP error is not presented as zero records', async () => {
  mock.get.mockRejectedValue(new Error('unavailable')); view();
  await screen.findByRole('alert');
  expect(screen.queryByText(/^0 registros/)).not.toBeInTheDocument();
});
it('invalidates a fresh list after a write without discarding the returned detail', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  const listKey = ['baja-intensidad', mock.user.id, null, 1];
  client.setQueryData(listKey, { registros: [entry], total: 1 });
  const updated = { ...entry, version: 1, etapa: 'TRATADO' };
  mock.post.mockResolvedValue({ data: { data: { registro: updated } } });
  view(true, client); await screen.findByText('Operación: Recibido');
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await screen.findByText('Operación: Tratado');
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  expect(client.getQueryData(['baja-intensidad', mock.user.id, id])).toEqual({ registro: updated });
});

// Especificación aprobada 17/10/2026 (docs/ESPEC-EVENTUALES-20261017.md v2).
it('a generator starts an eventual: its own slot comes from the session, it declares carrier and operator', async () => {
  mock.user = { id: 'qa-generator', rol: 'GENERADOR' };
  mock.post.mockResolvedValue({ data: { data: { registro: entry } } });
  view(); fireEvent.click(await screen.findByRole('button', { name: 'Registrar operación' }));
  expect(screen.queryByLabelText('Generador · Nombre o razón social')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Transportista · Nombre o razón social'), { target: { value: 'QA flete externo' } });
  fireEvent.change(screen.getByLabelText('Operador · Nombre o razón social'), { target: { value: 'QA planta externa' } });
  fireEvent.change(screen.getByLabelText('Corriente'), { target: { value: 'y1' } });
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target: { value: 'Planta sin alta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar operación' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(1));
  const [path, body] = mock.post.mock.calls[0];
  expect(path).toBe('/manifiestos/baja-intensidad');
  expect(body).not.toHaveProperty('generador');
  expect(body.transportista.nombre).toBe('QA flete externo');
  expect(body.operador.nombre).toBe('QA planta externa');
});
it('an administrator declares the three participants; sector administrators cannot start one', async () => {
  mock.user = { id: 'qa-admin', rol: 'ADMIN' };
  view(); fireEvent.click(await screen.findByRole('button', { name: 'Registrar operación' }));
  for (const role of ['Generador', 'Transportista', 'Operador']) expect(screen.getByLabelText(role + ' · Nombre o razón social')).toBeVisible();
  cleanup(); mock.user = { id: 'qa-sector', rol: 'ADMIN_GENERADOR' }; view();
  await waitFor(() => expect(mock.get).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'Registrar operación' })).not.toBeInTheDocument();
});
const pending = { ...entry, etapa: 'REGISTRADO', puedeAprobar: ['operador'],
  datos: { ...entry.datos, operador: { nombre: 'QA planta con alta', identificacion: '30-1', domicilio: 'QA', padronId: 'qa-op' } },
  aprobacion: { estado: 'PENDIENTE', partes: [{ parte: 'creador', rol: 'GENERADOR', estado: 'APROBADA' }, { parte: 'operador', rol: 'OPERADOR', estado: 'PENDIENTE' }] } };
it('facts wait for every approval; the party approves only its own slot', async () => {
  mock.get.mockResolvedValue({ data: { data: { registro: pending } } });
  mock.post.mockResolvedValue({ data: { data: { registro: pending } } });
  view(true); await screen.findByText('Aprobación de las partes: pendiente');
  expect(screen.getByRole('listitem', { name: 'Operador · Pendiente · Te toca' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Registrar retirado' })).toBeDisabled();
  expect(screen.getByText('Faltan aprobaciones de las partes para avanzar.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Solicitar revisión' })).not.toBeInTheDocument();
  expect(screen.getByText('QA planta con alta')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Aprobar como creador' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar como operador' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(1));
  expect(mock.post.mock.calls[0][0]).toBe('/manifiestos/baja-intensidad/' + id + '/eventos');
  expect(mock.post.mock.calls[0][1]).toMatchObject({ tipo: 'APROBAR_PARTE', parte: 'operador', version: 0 });
});
it('rejecting needs a reason; without a pending slot of its own a party sees no decision buttons', async () => {
  mock.get.mockResolvedValue({ data: { data: { registro: pending } } });
  view(true); await screen.findByText('Aprobación de las partes: pendiente');
  const reject = screen.getByRole('button', { name: 'Rechazar como operador' });
  expect(reject).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'La carga no es nuestra' } });
  expect(reject).toBeEnabled();
  cleanup(); mock.get.mockResolvedValue({ data: { data: { registro: { ...pending, puedeAprobar: [] } } } });
  view(true); await screen.findByText('Aprobación de las partes: pendiente');
  expect(screen.queryByRole('button', { name: /Aprobar como|Rechazar como/ })).not.toBeInTheDocument();
});
it('a rejected eventual is kept as a record and cannot advance', async () => {
  const rejected = { ...pending, puedeAprobar: [], aprobacion: { estado: 'RECHAZADO', partes: [{ ...pending.aprobacion.partes[0] }, { parte: 'operador', rol: 'OPERADOR', estado: 'RECHAZADA' }] } };
  mock.get.mockResolvedValue({ data: { data: { registro: rejected } } });
  view(true); await screen.findByText('Aprobación de las partes: rechazado');
  expect(screen.getByRole('button', { name: 'Registrar retirado' })).toBeDisabled();
  expect(screen.getByText('Rechazado por una parte: se conserva como antecedente y no avanza.')).toBeVisible();
});
it('legacy records without required approvals keep advancing as before', async () => {
  mock.get.mockResolvedValue({ data: { data: { registro: { ...entry, aprobacion: { estado: 'NO_REQUIERE', partes: [] }, puedeAprobar: [] } } } });
  view(true); await screen.findByText('Operación: Recibido');
  expect(screen.queryByText(/Aprobación de las partes/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeEnabled();
});

it.each([
  ['OPERADOR', ['operador'], 'PENDIENTE', 'Te toca aprobar', true],
  ['TRANSPORTISTA', [], 'PENDIENTE', 'Esperando aprobaciones', true],
  ['OPERADOR', [], 'APROBADO', 'Listo para registrar el retiro', false],
  ['OPERADOR', [], 'RECHAZADO', 'Operación detenida', true],
])('shows the current task for %s with %s / %s without changing action permissions', async (rol, puedeAprobar, estado, message, blocked) => {
  mock.user = { id: 'qa-current', rol: rol as string };
  const partes = pending.aprobacion.partes.map(part => ({ ...part, estado: estado === 'APROBADO' ? 'APROBADA' : part.estado }));
  mock.get.mockResolvedValue({ data: { data: { registro: { ...pending, puedeAprobar, aprobacion: { estado, partes } } } } });
  view(true);
  expect(await screen.findByText(message as string, { exact: true })).toBeVisible();
  const approvals = screen.getByRole('list', { name: 'Participantes que deben aprobar' });
  expect(approvals.children).toHaveLength(2); // No fictitious approval for an external participant.
  expect(screen.getByText('Generador · creador')).toBeVisible();
  const action = screen.getByRole('button', { name: 'Registrar retirado' });
  if (blocked) expect(action).toBeDisabled(); else expect(action).toBeEnabled();
});


it('filters eventuals on the server and retains search when returning from a record', async () => {
  mock.get.mockImplementation(url => Promise.resolve({ data: { data: url.includes('/' + id) ? { registro: entry } : { registros: [entry], total: 1, page: 1, pageSize: 20 } } }));
  view();
  fireEvent.change(await screen.findByLabelText('Buscar eventual'), { target: { value: 'QA externo' } });
  fireEvent.change(screen.getByLabelText('Etapa del eventual'), { target: { value: 'RECIBIDO' } });
  await waitFor(() => expect(mock.get.mock.calls.some(([url, config]) => url === '/manifiestos/baja-intensidad' && config?.params?.search === 'QA externo' && config?.params?.etapa === 'RECIBIDO')).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: /Abrir eventual/ }));
  await screen.findByText('Operación: Recibido');
  fireEvent.click(screen.getByRole('button', { name: 'Ver registros' }));
  expect(await screen.findByLabelText('Buscar eventual')).toHaveValue('QA externo');
  expect(screen.getByLabelText('Etapa del eventual')).toHaveValue('RECIBIDO');
});
it('shows a compact approval task in the list without claiming external parties approved', async () => {
  mock.get.mockResolvedValue({ data: { data: { registros: [pending], total: 1, page: 1 } } });
  view();
  expect(await screen.findByText('Te toca aprobar', { exact: true })).toBeVisible();
  expect(screen.getByRole('group', { name: 'Aprobaciones del eventual' }).children).toHaveLength(2);
});
it('refreshes an open eventual and protects a note against a concurrent revision until explicitly acknowledged', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mock.get.mockResolvedValue({ data: { data: { registro: entry } } });
  view(true, client); fireEvent.change(await screen.findByLabelText('Nota de la acción'), { target: { value: 'Mi evidencia sigue aquí' } });
  mock.get.mockResolvedValue({ data: { data: { registro: { ...entry, version: 1 } } } });
  await client.invalidateQueries({ queryKey: ['baja-intensidad'] });
  expect(await screen.findByText(/El registro cambió mientras escribías/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeDisabled();
  expect(screen.getByLabelText('Nota de la acción')).toHaveValue('Mi evidencia sigue aquí');
  fireEvent.click(screen.getByRole('button', { name: 'Usar versión actual' }));
  mock.post.mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ version: 1, nota: 'Mi evidencia sigue aquí' })));
  expect(client.getQueryCache().getAll().find(q => q.queryKey[0] === 'baja-intensidad')?.observers[0].options.refetchInterval).toBe(5000);
});

it('a rejected eventual never offers another pending party an impossible approval', async () => {
 mock.get.mockResolvedValue({ data: { data: { registro: { ...pending, aprobacion: { ...pending.aprobacion, estado: 'RECHAZADO' } } } } });
 view(true); await screen.findByText('Operación detenida', { exact: true });
 expect(screen.queryByRole('button', { name: /Aprobar como/ })).not.toBeInTheDocument();
 expect(screen.getByRole('button', { name: 'Registrar retirado' })).toBeDisabled();
});

it('recovers a committed command after a lost response without resubmitting or erasing newer edits', async () => {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 mock.post.mockRejectedValue(new Error('response lost')); view(true, client);
 fireEvent.change(await screen.findByLabelText('Nota de la acción'), { target: { value: 'Nota enviada' } });
 fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' })); await screen.findByRole('alert');
 const commandId = mock.post.mock.calls[0][1].id;
 fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'Otra nota todavía sin enviar' } });
 mock.get.mockResolvedValue({ data: { data: { registro: { ...entry, version: 1, etapa: 'TRATADO', eventos: [{ id: commandId, tipo: 'AVANCE', etapa: 'TRATADO', fecha: '2026-10-22T15:00:00Z', nota: 'Nota enviada' }] } } } });
 await client.invalidateQueries({ queryKey: ['baja-intensidad'] });
 expect(await screen.findByText('La acción ya estaba guardada. Recuperamos la confirmación sin duplicarla.')).toBeVisible();
 expect(screen.getByLabelText('Nota de la acción')).toHaveValue('Otra nota todavía sin enviar');
 expect(mock.post).toHaveBeenCalledTimes(1);
});
