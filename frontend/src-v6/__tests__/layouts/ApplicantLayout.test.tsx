import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const logout = vi.hoisted(() => vi.fn());
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout }) }));
vi.mock('../../components/ui/Toast', () => ({ ToastContainer: () => null }));
import { ApplicantLayout } from '../../layouts/ApplicantLayout';
beforeEach(() => logout.mockClear());
it.each(['', '/app'])('keeps the own application and logout usable without unavailable navigation (%s)', prefix => {
  render(<MemoryRouter initialEntries={[prefix + '/mi-solicitud']}><Routes>
    <Route element={<ApplicantLayout />}><Route path={prefix + '/mi-solicitud'} element={<p>Observación para corregir</p>} /></Route>
    <Route path={prefix + '/login'} element={<p>Ingreso</p>} />
  </Routes></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Mi solicitud' })).toBeVisible();
  expect(screen.getByText('Observación para corregir')).toBeVisible();
  expect(screen.queryByRole('link', { name: /Manifiestos|Reportes|Avisos/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
  expect(logout).toHaveBeenCalledOnce();
  expect(screen.getByText('Ingreso')).toBeVisible();
});
