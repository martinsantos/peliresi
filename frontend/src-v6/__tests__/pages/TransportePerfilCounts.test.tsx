import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TransportePerfilPage from '../../pages/transporte/TransportePerfilPage';

const state = vi.hoisted(() => ({ total: 355 as number | undefined }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { rol: 'TRANSPORTISTA' } }) }));
vi.mock('../../hooks/useMobilePrefix', () => ({ useMobilePrefix: () => (path: string) => path }));
vi.mock('../../components/mobile/AssignedHandoffs', () => ({ AssignedHandoffs: () => null }));
vi.mock('../../hooks/useManifiestos', () => ({ useManifiestos: (filters: { estado?: string }) => ({
  isLoading: false,
  data: filters.estado === 'EN_TRANSITO'
    ? { items: [{ id: 'qa-trip', numero: 'QA-1' }], total: state.total }
    : { items: [], total: 0 },
}) }));

beforeEach(() => { state.total = 355; });

it('shows the total in both the header and the list when only one page of trips is loaded', () => {
  render(<MemoryRouter><TransportePerfilPage /></MemoryRouter>);
  expect(screen.getByText('355 en tránsito')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'En tránsito: 355 manifiestos' })).toBeVisible();
  expect(screen.getByText('Se muestran 1 de 355. Abrí Manifiestos para ver el resto.')).toBeVisible();
});

it('uses the loaded count when an older response has no total', () => {
  state.total = undefined;
  render(<MemoryRouter><TransportePerfilPage /></MemoryRouter>);
  expect(screen.getByText('1 en tránsito')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'En tránsito: 1 manifiesto' })).toBeVisible();
});
