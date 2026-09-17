import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActorDocumentPanel from '../../components/ActorDocumentPanelV2';

vi.mock('../../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: { documentos: [], requisitos: [], credenciales: [] } } }), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isAnyAdmin: true, currentUser: { id: 'admin-1' } }) }));
vi.mock('../../services/indexeddb', () => ({ getSyncQueue: vi.fn().mockResolvedValue([]) }));

describe('ActorDocumentPanel', () => {
  it('renders a shared documentary surface for non-transport actors', async () => {
    render(<ActorDocumentPanel actorType="generador" actorId="gen-1" />);
    expect(await screen.findByText('Expediente documental y certificados')).toBeInTheDocument();
    expect(screen.getByText('Cargar ATM')).toBeInTheDocument();
    expect(screen.getByText('Crear credencial')).toBeInTheDocument();
  });
});
