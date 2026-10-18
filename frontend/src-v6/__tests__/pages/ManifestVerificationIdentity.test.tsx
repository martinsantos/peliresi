import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import VerificarManifiestoPage from '../../pages/manifiestos/VerificarManifiestoPage';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('keeps the canonical actor identity next to the actual public manifest data', async () => {
  vi.mocked(axios.get).mockResolvedValueOnce({ data: { success: true, data: { manifiesto: {
    numero: '2026-990001', estado: 'EN_TRANSITO', createdAt: '2026-10-05T12:00:00Z',
    fechaFirma: null, fechaRetiro: null, fechaEntrega: null, fechaRecepcion: null, fechaCierre: null,
    blockchainHash: null, blockchainTxHash: null, blockchainBlockNumber: null,
    blockchainTimestamp: null, blockchainStatus: null, rollingHash: null,
    generador: { razonSocial: 'QA Generador 1' },
    transportista: { razonSocial: 'QA Transporte 1' },
    operador: { razonSocial: 'QA Operador 1' }, residuos: [],
  } } } });
  render(<MemoryRouter initialEntries={['/manifiestos/verificar/2026-990001']}>
    <Routes><Route path="/manifiestos/verificar/:numero" element={<VerificarManifiestoPage />} /></Routes>
  </MemoryRouter>);
  const heading = await screen.findByRole('heading', { name: '2026-990001', exact: true });
  expect(heading).toHaveClass('text-white');
  expect(heading.parentElement).toContainElement(screen.getByText('SITREP — Verificación de Manifiesto'));
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/manifiestos\/verificar\/2026-990001$/));
  for (const [label, name, glyph] of [
    ['Generador', 'QA Generador 1', 'factory'],
    ['Transportista', 'QA Transporte 1', 'truck'],
    ['Operador', 'QA Operador 1', 'flask-conical'],
  ]) {
    const row = screen.getByText(label, { exact: true }).parentElement!.parentElement!;
    expect(within(row).getByText(name, { exact: true })).toBeVisible();
    expect(row.querySelectorAll(`svg.lucide-${glyph}`)).toHaveLength(1);
    expect(row.querySelector('svg.lucide-building-2')).toBeNull();
    expect(row.querySelector('a')).toBeNull();
  }
});
