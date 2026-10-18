import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import BlockchainPanel from '../../components/BlockchainPanel';

const query = vi.hoisted(() => ({ data: undefined as any, isLoading: false, isError: false }));
vi.mock('../../hooks/useBlockchain', () => ({ useBlockchainStatus: () => query }));
const mount = () => render(<QueryClientProvider client={new QueryClient()}><BlockchainPanel manifiestoId="qa" manifiestoEstado="TRATADO" /></QueryClientProvider>);
describe('blockchain panel only offers supported actions and verified claims', () => {
  it('does not offer certification when the server has disabled it', () => {
    Object.assign(query, { isError: false, data: { enabled: false, sellos: [] } });
    mount();
    expect(screen.queryByRole('button', { name: 'Certificar en Blockchain' })).not.toBeInTheDocument();
  });
  it('does not interpret unavailable status as permission to register', () => {
    Object.assign(query, { isError: true, data: undefined });
    mount();
    expect(screen.queryByRole('button', { name: 'Certificar en Blockchain' })).not.toBeInTheDocument();
  });
  it('does not claim the event chain was checked because two seals exist', () => {
    Object.assign(query, { isError: false, data: { enabled: false, rollingHash: 'qa-hash', sellos: ['GENESIS', 'CIERRE'].map(tipo => ({ tipo, status: 'CONFIRMADO', hash: 'qa-hash' })) } });
    mount();
    expect(screen.queryByText(/Garantiza que ningun dato|chain activa/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no verifica por sí solo los eventos intermedios/)).toBeInTheDocument();
  });
});
