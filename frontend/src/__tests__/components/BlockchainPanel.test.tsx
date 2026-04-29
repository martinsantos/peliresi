/**
 * SITREP v6 - BlockchainPanel Unit Tests
 * Smoke-level: exports exist, component renders without error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockUseBlockchainStatus = vi.fn();

// Mock useBlockchainStatus hook
vi.mock('@src/hooks/useBlockchain', () => ({
  useBlockchainStatus: mockUseBlockchainStatus,
}));

// Mock manifiesto service
vi.mock('@src/services/manifiesto.service', () => ({
  manifiestoService: {
    registrarBlockchain: vi.fn().mockResolvedValue({}),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('BlockchainPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBlockchainStatus.mockReturnValue({ data: null, isLoading: false });
  });

  it('should export BlockchainPanel as default', async () => {
    const BlockchainPanel = (await import('@src/components/BlockchainPanel')).default;
    expect(typeof BlockchainPanel).toBe('function');
  });

  it('should render null when loading and no data (isLoading=true)', async () => {
    mockUseBlockchainStatus.mockReturnValue({ data: null, isLoading: true });

    const BlockchainPanel = (await import('@src/components/BlockchainPanel')).default;
    const Wrapper = createWrapper();

    const { container } = render(
      React.createElement(Wrapper, null,
        React.createElement(BlockchainPanel, { manifiestoId: 'test-id', manifiestoEstado: 'APROBADO' })
      )
    );

    // Should render nothing
    expect(container.innerHTML).toBe('');
  });

  it('should render null when no blockchain data and cannot certify (BORRADOR state)', async () => {
    const BlockchainPanel = (await import('@src/components/BlockchainPanel')).default;
    const Wrapper = createWrapper();

    const { container } = render(
      React.createElement(Wrapper, null,
        React.createElement(BlockchainPanel, { manifiestoId: 'test-id', manifiestoEstado: 'BORRADOR' })
      )
    );

    // Should render nothing (BORRADOR can't certify)
    expect(container.innerHTML).toBe('');
  });

  it('should render null when no blockchain data and cannot certify (CANCELADO state)', async () => {
    const BlockchainPanel = (await import('@src/components/BlockchainPanel')).default;
    const Wrapper = createWrapper();

    const { container } = render(
      React.createElement(Wrapper, null,
        React.createElement(BlockchainPanel, { manifiestoId: 'test-id', manifiestoEstado: 'CANCELADO' })
      )
    );

    // Should render nothing (CANCELADO can't certify)
    expect(container.innerHTML).toBe('');
  });

  it('should render CTA when manifest can be certified', async () => {
    const BlockchainPanel = (await import('@src/components/BlockchainPanel')).default;
    const Wrapper = createWrapper();

    const { container } = render(
      React.createElement(Wrapper, null,
        React.createElement(BlockchainPanel, { manifiestoId: 'test-id', manifiestoEstado: 'APROBADO' })
      )
    );

    // Should render the CTA section with content
    expect(container.innerHTML).not.toBe('');
    expect(container.textContent).toContain('Blockchain');
  });

  it('should render panel header with sellos when data has sellos', async () => {
    mockUseBlockchainStatus.mockReturnValue({
      data: {
        sellos: [{
          tipo: 'GENESIS',
          status: 'CONFIRMADO',
          hash: '0xabc123def456',
          txHash: '0x7890123456',
          blockNumber: 12345678,
          blockTimestamp: '2026-03-20T12:00:00Z',
        }],
        blockchainStatus: 'COMPLETADO',
      },
      isLoading: false,
    });

    const BlockchainPanel = (await import('@src/components/BlockchainPanel')).default;
    const Wrapper = createWrapper();

    render(
      React.createElement(Wrapper, null,
        React.createElement(BlockchainPanel, { manifiestoId: 'test-id', manifiestoEstado: 'TRATADO' })
      )
    );

    // Panel should be visible with blockchain info
    expect(screen.getByText('Certificacion Blockchain')).toBeDefined();
  });
});
