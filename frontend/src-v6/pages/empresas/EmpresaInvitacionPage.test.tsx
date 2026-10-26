import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import EmpresaInvitacionPage from './EmpresaInvitacionPage';
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('axios', () => ({ default: { request: mock.request } }));
vi.mock('../../services/api', () => ({ default: { defaults: { baseURL: '/api' } } }));
const invitation = (name = 'Empresa QA', email = 'first@qa.invalid', rol = 'GENERADOR') => ({ data: { data: { empresa: name, email, rol, venceAt: '2026-12-01T00:00:00Z' } } });
function Navigation() { const navigate = useNavigate(); return <><button onClick={() => navigate('/empresa-invitacion/second')}>Otro enlace</button><EmpresaInvitacionPage /></>; }
function open(app = false) { return render(<MemoryRouter basename={app ? '/app' : undefined} initialEntries={[`${app ? '/app' : ''}/empresa-invitacion/first`]}><Routes><Route path="/empresa-invitacion/:token" element={<Navigation />} /></Routes></MemoryRouter>); }
beforeEach(() => { mock.request.mockReset(); vi.stubEnv('VITE_ENTERPRISE_ENABLED', 'true'); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
for (const app of [false, true]) {
  it(`app=${app}: retries a failed read without declaring expiry or submitting credentials`, async () => {
    mock.request.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce(invitation()); open(app);
    expect(await screen.findByRole('alert')).not.toHaveTextContent('venció');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }));
    expect(await screen.findByText('Empresa QA')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mock.request.mock.calls.every(([r]) => r.method === 'GET')).toBe(true);
  });
  it(`app=${app}: removes the former invitation and password immediately when the link changes`, async () => {
    let finish!: (value: unknown) => void;
    mock.request.mockResolvedValueOnce(invitation()).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); open(app);
    fireEvent.change(await screen.findByLabelText('Contraseña de tu cuenta'), { target: { value: 'OnlyTest-DoNotPersist!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Otro enlace' }));
    expect(screen.queryByText('Empresa QA')).toBeNull(); expect(screen.queryByLabelText('Contraseña de tu cuenta')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Consultando invitación');
    await act(async () => finish(invitation('Otra empresa QA', 'second@qa.invalid', 'OPERADOR')));
    expect(await screen.findByLabelText('Contraseña de tu cuenta')).toHaveValue('');
    expect(screen.getByText('Otra empresa QA')).toBeVisible();
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('OnlyTest');
  });
  it(`app=${app}: a completed invitation never masks a different link`, async () => {
    mock.request.mockImplementation(async r => r.method === 'GET' ? invitation(r.url.endsWith('second') ? 'Otra empresa QA' : 'Empresa QA') : { data: {} }); open(app);
    fireEvent.change(await screen.findByLabelText('Contraseña de tu cuenta'), { target: { value: 'OnlyTest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar acceso a empresa' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Acceso autorizado');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', `${app ? '/app' : ''}/login`);
    fireEvent.click(screen.getByRole('button', { name: 'Otro enlace' }));
    expect(await screen.findByText('Otra empresa QA')).toBeVisible();
    expect(screen.queryByText(/Acceso autorizado/)).toBeNull();
  });
}
it('an unavailable link gives a safe exit without a password form', async () => {
  mock.request.mockRejectedValue({ response: { status: 404 } }); open(true);
  expect(await screen.findByRole('alert')).toHaveTextContent('venció');
  expect(screen.queryByLabelText('Contraseña de tu cuenta')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reintentar consulta' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Volver al acceso' })).toHaveAttribute('href', '/app/login');
});
it('keeps credentials fixed during acceptance and sends only once', async () => {
  let finish!: (value: unknown) => void;
  mock.request.mockImplementation(r => r.method === 'GET' ? Promise.resolve(invitation()) : new Promise(resolve => { finish = resolve; })); open();
  const password = await screen.findByLabelText('Contraseña de tu cuenta'); fireEvent.change(password, { target: { value: 'OnlyTest' } });
  const button = screen.getByRole('button', { name: 'Aceptar acceso a empresa' }); fireEvent.click(button); fireEvent.click(button);
  expect(password).toBeDisabled(); expect(mock.request.mock.calls.filter(([r]) => r.method === 'POST')).toHaveLength(1);
  await act(async () => finish({ data: {} })); await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Acceso autorizado'));
});
