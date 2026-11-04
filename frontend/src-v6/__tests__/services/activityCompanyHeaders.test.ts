import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../services/sessionCheckpoint', () => ({ readSessionCheckpoint: vi.fn(), writeSessionCheckpoint: vi.fn() }));
vi.mock('../../services/companyContext', () => ({
  readCompanyContext: () => ({ empresaId: 'company', actividadId: 'company-activity' }),
  companyHeaders: () => ({ 'X-SITREP-Empresa': 'company', 'X-SITREP-Empresa-Actividad': 'company-activity' }),
}));
vi.mock('../../services/actorActivity', () => ({ ACTIVITY_HEADER: 'X-SITREP-Activity', readActorActivity: () => null }));
import { api } from '../../services/api';

afterEach(() => { localStorage.clear(); });
it('checks an explicitly selected personal activity without adding the current company headers', async () => {
  localStorage.setItem('sitrep_access_token', 'fixture-token');
  const adapter = vi.fn(async (config: any) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }));
  await api.get('/auth/profile', { headers: { 'X-SITREP-Activity': 'OPERADOR' }, adapter });
  const headers = adapter.mock.calls[0][0].headers;
  expect(headers.get('X-SITREP-Activity')).toBe('OPERADOR');
  expect(headers.has('X-SITREP-Empresa')).toBe(false);
  expect(headers.has('X-SITREP-Empresa-Actividad')).toBe(false);
});
it('keeps company headers for ordinary company requests', async () => {
  localStorage.setItem('sitrep_access_token', 'fixture-token');
  const adapter = vi.fn(async (config: any) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }));
  await api.get('/auth/profile', { adapter });
  const headers = adapter.mock.calls[0][0].headers;
  expect(headers.get('X-SITREP-Empresa')).toBe('company');
  expect(headers.get('X-SITREP-Empresa-Actividad')).toBe('company-activity');
});
