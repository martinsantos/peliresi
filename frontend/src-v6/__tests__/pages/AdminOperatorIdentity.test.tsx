import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminOperadoresPage from '../../pages/admin/AdminOperadoresPage';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonateUser: vi.fn() }) }));
vi.mock('../../hooks/useEnrichment', () => ({ useOperadoresEnrichment: () => ({ data: { operadores: {} } }) }));
vi.mock('../../hooks/useActores', () => ({
  useOperadores: () => ({ data: { items: [{ id: 'qa-operator', razonSocial: 'QA Operador', cuit: '30-00000000-1', activo: true, tratamientos: [] }], total: 1, totalPages: 1 }, isLoading: false, isError: false }),
  useDeleteOperador: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('Operator administration does not change actor identity to green', () => {
  it('uses a blue FlaskConical in header, category total, table and mobile card', () => {
    const { container } = render(<MemoryRouter><AdminOperadoresPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Admin Operadores', exact: true })).toBeVisible();
    const icons = container.querySelectorAll('svg.lucide-flask-conical');
    expect(icons).toHaveLength(4);
    for (const icon of icons) expect(icon).toHaveClass('text-blue-700');
    // Success remains green because it describes state, not actor category.
    expect(container.querySelector('svg.lucide-circle-check-big')).toHaveClass('text-success-600');
  });
});
