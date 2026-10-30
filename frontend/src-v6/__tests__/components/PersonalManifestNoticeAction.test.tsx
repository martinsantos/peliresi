import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ check: vi.fn(), activate: vi.fn() }));
vi.mock('../../services/manifestPersonalAccess', () => ({ personalManifestAccess: mocks.check }));
vi.mock('../../services/activateActorActivity', () => ({ activateActorActivity: mocks.activate }));
import PersonalManifestNoticeAction from '../../components/PersonalManifestNoticeAction';
const user = { id: 'u', rol: 'GENERADOR', actorId: 'g', actividades: ['GENERADOR', 'OPERADOR'] } as any;
function show(value = user, onCurrent?: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><PersonalManifestNoticeAction manifestId="m" target="/manifiestos/m/adendas?adenda=a" user={value} onCurrent={onCurrent} /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { mocks.check.mockReset().mockResolvedValue({ accesses: [{ rol: 'OPERADOR', actorId: 'o' }], incomplete: false }); mocks.activate.mockReset(); });
afterEach(cleanup);
it('offers only the verified activity and does not switch when verification fails', async () => {
  mocks.activate.mockRejectedValue(new Error('Revoked')); show();
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir como Operador' }));
  await waitFor(() => expect(mocks.activate).toHaveBeenCalledWith('u', 'OPERADOR', 'o', expect.any(Function)));
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos abrir el manifiesto');
  expect(screen.queryByRole('button', { name: 'Abrir como Generador' })).toBeNull();
});
it('keeps the exact target for an already matching personal activity', async () => {
  show({ ...user, rol: 'OPERADOR', actorId: 'o' });
  expect(await screen.findByRole('link', { name: 'Abrir como Operador' })).toHaveAttribute('href', '/manifiestos/m/adendas?adenda=a');
});
it('falls back to the dossier when a target only resembles the addenda path', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><PersonalManifestNoticeAction manifestId="m" target="/manifiestos/m/adendas-extra" user={{ ...user, rol: 'OPERADOR', actorId: 'o' }} /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('link', { name: 'Abrir como Operador' })).toHaveAttribute('href', '/manifiestos/m');
});
it('requires an explicit personal activation from a company context', async () => {
  show({ ...user, rol: 'OPERADOR', actorId: 'o', empresaContexto: { empresaId: 'co' } });
  expect(await screen.findByRole('button', { name: 'Abrir como Operador' })).toBeVisible();
});
it('keeps a retry available when a role could not be checked', async () => {
  mocks.check.mockResolvedValue({ accesses: [], incomplete: true }); show();
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos comprobar todas tus actividades');
  expect(screen.getByRole('button', { name: 'Reintentar comprobación' })).toBeVisible();
});
it('does not allow an unfinished activation to change context after unmount', async () => {
  let finish!: () => void; mocks.activate.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const view = show(); fireEvent.click(await screen.findByRole('button', { name: 'Abrir como Operador' }));
  const stillRelevant = mocks.activate.mock.calls[0][3]; expect(stillRelevant()).toBe(true);
  view.unmount(); expect(stillRelevant()).toBe(false); finish(); await Promise.resolve();
});
