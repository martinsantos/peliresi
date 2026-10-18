import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useHref, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EscanerQRPage from '../../pages/escaner/EscanerQRPage';
import { parseQrPayload } from '../../pages/escaner/qrParser';

const id = `cm${'0'.repeat(22)}1`;
const numero = '2026-000001';
// Payload produced by manifiesto-workflow.controller.ts and embedded by pdf.controller.ts.
const pdfPayload = JSON.stringify({ numero, id, timestamp: '2026-10-02T12:00:00.000Z' });
const publicUrl = `https://rptrazar.mendoza.gov.ar/manifiestos/verificar/${numero}`;
const mock = vi.hoisted(() => ({ payload: '', cached: vi.fn(), info: vi.fn() }));
vi.mock('../../components/QRScanner', () => ({ default: ({ onScan }: { onScan: (value: string) => void }) => <button onClick={() => onScan(mock.payload)}>Leer QR de prueba</button> }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'inspector-1' } }) }));
vi.mock('../../services/offline-sync', () => ({ getCachedManifiestos: mock.cached }));
vi.mock('../../components/ui/Toast', () => ({ toast: { info: mock.info } }));

function Destination() {
  const { pathname } = useLocation();
  return <a href={useHref(pathname)}>Destino del QR</a>;
}
function scan(payload: string, base = '/app') {
  mock.payload = payload;
  render(<MemoryRouter basename={base || undefined} initialEntries={[`${base}/escaner-qr`]}><Routes>
    <Route path="/escaner-qr" element={<EscanerQRPage />} />
    <Route path="*" element={<Destination />} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Leer QR de prueba' }));
}

describe('scanner contract with issued manifest QR payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    mock.cached.mockResolvedValue([]);
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('recognizes the PDF JSON containing the database CUID and actual manifest number', () => {
    expect(parseQrPayload(pdfPayload)).toEqual({ kind: 'manifiesto', id });
  });
  it.each([numero, publicUrl, `https://sitrep.ultimamilla.com.ar/v6/manifiestos/verificar/${numero}`, `https://rptrazar.mendoza.gov.ar/app/manifiestos/verificar/${numero}`])('recognizes issued number or canonical verification URL: %s', payload => {
    expect(parseQrPayload(payload)).toEqual({ kind: 'manifiesto', id: numero });
  });
  it.each([
    'https://evil.example/manifiestos/verificar/M-2025-0089',
    'https://rptrazar.mendoza.gov.ar.evil.example/manifiestos/verificar/M-2025-0089',
    'http://rptrazar.mendoza.gov.ar/manifiestos/verificar/M-2025-0089',
    'https://user:secret@rptrazar.mendoza.gov.ar/manifiestos/verificar/M-2025-0089',
    'https://rptrazar.mendoza.gov.ar:444/manifiestos/verificar/M-2025-0089',
    'https://rptrazar.mendoza.gov.ar/otra-ruta/M-2025-0089',
    'https://rptrazar.mendoza.gov.ar/manifiestos/verificar/M-2025-0089?next=https://evil.example',
    'https://rptrazar.mendoza.gov.ar/manifiestos/verificar/M-2025-0089#otra-ruta',
  ])('rejects URLs outside the supported service contract: %s', payload => {
    expect(parseQrPayload(payload)).toBeNull();
  });
  it.each(['', '/app'])('opens the PDF CUID on the authenticated detail route under basename %j', async base => {
    scan(pdfPayload, base);
    fireEvent.click(screen.getByRole('button', { name: 'Ver Manifiesto' }));
    expect(await screen.findByRole('link', { name: 'Destino del QR' })).toHaveAttribute('href', `${base}/manifiestos/${id}`);
    expect(mock.cached).not.toHaveBeenCalled();
  });
  it.each([publicUrl, numero, 'M-2025-0089'])('opens number-only QR on the public verification route: %s', async payload => {
    scan(payload);
    fireEvent.click(screen.getByRole('button', { name: 'Ver Manifiesto' }));
    expect(await screen.findByRole('link', { name: 'Destino del QR' })).toHaveAttribute('href', `/app/manifiestos/verificar/${payload === 'M-2025-0089' ? payload : numero}`);
  });
  it.each([publicUrl, pdfPayload, 'M-2025-0089'])('uses the cached database ID when offline, even if scanning its number: %s', async payload => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    mock.cached.mockResolvedValue([{ id, numero: payload === 'M-2025-0089' ? payload : numero }]);
    scan(payload);
    fireEvent.click(screen.getByRole('button', { name: 'Ver Manifiesto' }));
    expect(await screen.findByRole('link', { name: 'Destino del QR' })).toHaveAttribute('href', `/app/manifiestos/${id}`);
    expect(mock.cached).toHaveBeenCalledWith('inspector-1');
  });
  it('stays on the recognized QR when offline without a cached manifest', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    scan('M-2025-0089');
    fireEvent.click(screen.getByRole('button', { name: 'Ver Manifiesto' }));
    await waitFor(() => expect(mock.info).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Destino del QR' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escanear otro' })).toBeVisible();
  });
});
