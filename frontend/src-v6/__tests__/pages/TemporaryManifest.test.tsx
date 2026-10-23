import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import NuevoManifiestoPage from '../../pages/manifiestos/NuevoManifiestoPage';
const state = vi.hoisted(() => ({ role: 'OPERADOR', temporary: true, training: false, exit: vi.fn(), create: vi.fn(), catalog: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa', rol: state.role, actorId: 'actor-qa', training: state.training }, isAdmin: state.role === 'ADMIN', isGenerador: state.role === 'GENERADOR' }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonationData: state.temporary ? {} : null, exitImpersonation: state.exit }) }));
vi.mock('../../hooks/useManifiestos', () => ({ useCreateManifiesto: () => ({ mutateAsync: state.create }) }));
vi.mock('../../hooks/useCatalogos', () => ({ useTiposResiduo: () => (state.catalog(), { data: [] }), useCatalogoGeneradores: () => ({ data: [] }), useCatalogoTransportistas: () => ({ data: [] }), useCatalogoOperadores: () => ({ data: [] }) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true'); state.temporary = true; state.training = false; });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('explains the temporary %s boundary before mounting the form or loading catalogs', role => {
 state.role = role; render(<MemoryRouter><NuevoManifiestoPage /></MemoryRouter>);
 expect(screen.getByRole('heading', {name:'Estás en una vista temporal'})).toBeVisible();
 expect(screen.getByText(/propia cuenta/)).toBeVisible();
 expect(screen.queryByRole('button', {name:'Siguiente'})).not.toBeInTheDocument();
 expect(state.catalog).not.toHaveBeenCalled(); expect(state.create).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', {name:'Volver a mi cuenta'})); expect(state.exit).toHaveBeenCalledOnce();
});
it.each(['GENERADOR','TRANSPORTISTA','OPERADOR','ADMIN'])('keeps the actual %s account form available', role => {
 state.role=role; state.temporary=false; render(<MemoryRouter><NuevoManifiestoPage /></MemoryRouter>);
 expect(screen.queryByRole('heading', {name:'Estás en una vista temporal'})).not.toBeInTheDocument();
 expect(screen.getByRole('button', {name:'Siguiente'})).toBeVisible(); expect(state.create).not.toHaveBeenCalled();
});
