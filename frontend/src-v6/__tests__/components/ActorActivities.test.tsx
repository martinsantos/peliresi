import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), post: vi.fn(), get: vi.fn() }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { misSolicitudes: mocks.list } }));
vi.mock('../../services/api', () => ({ api: { post: mocks.post, get: mocks.get } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa-user', rol: 'GENERADOR' }, isRestricted: true }) }));
import ActorActivities from '../../components/ActorActivities';
function Location() { const location = useLocation(); return <output>{location.pathname + location.search}</output>; }
function view() { return render(<MemoryRouter initialEntries={['/mi-solicitud']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ActorActivities /><Location /></QueryClientProvider></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true'); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it('continues existing draft, views submitted application, and requests only a missing activity', async () => {
  mocks.list.mockResolvedValue([{ id: 'g', tipoActor: 'GENERADOR', estado: 'BORRADOR' }, { id: 'o', tipoActor: 'OPERADOR', estado: 'EN_REVISION' }]);
  view(); fireEvent.click(await screen.findByRole('button', { name: 'Continuar Generador' }));
  expect(screen.getByText('/inscripcion/generador')).toBeVisible(); expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Ver solicitud de Operador' }));
  expect(screen.getByText('/mi-solicitud?solicitud=o')).toBeVisible(); expect(mocks.post).not.toHaveBeenCalled();
  mocks.post.mockResolvedValue({ data: { data: { solicitud: { id: 't', usuarioId: 'qa-user', estado: 'BORRADOR' } } } });
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar Transportista' }));
  await screen.findByText('/inscripcion/transportista');
  expect(mocks.post).toHaveBeenCalledWith('/solicitudes/actividad-adicional', { tipoActor: 'TRANSPORTISTA' });
});
it('failed lookup does not masquerade as no applications or permit duplicate requests', async () => {
  mocks.list.mockRejectedValue(new Error('offline')); view(); await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Solicitar Operador' })).toBeDisabled(); expect(mocks.post).not.toHaveBeenCalled();
  mocks.list.mockResolvedValue([{ id: 'o', tipoActor: 'OPERADOR', estado: 'OBSERVADA' }]);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar Operador' })).toBeEnabled());
});
it('flag off makes no request', () => { vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'false'); view(); expect(mocks.list).not.toHaveBeenCalled(); });
