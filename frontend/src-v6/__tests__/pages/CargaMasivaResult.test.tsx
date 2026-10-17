import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('../../components/ui/Toast', () => ({ toast }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
import CargaMasivaPage from '../../pages/carga-masiva/CargaMasivaPage';

// Minimal XHR double: answers the real upload request with a fixed status and body.
let reply = { status: 200, body: '' };
class FakeXHR {
  status = 0; responseText = ''; upload = { addEventListener: vi.fn() };
  private listeners: Record<string, () => void> = {};
  addEventListener(name: string, listener: () => void) { this.listeners[name] = listener; }
  open = vi.fn(); setRequestHeader = vi.fn();
  send() { this.status = reply.status; this.responseText = reply.body; queueMicrotask(() => this.listeners.load?.()); }
}

async function upload() {
  render(<MemoryRouter><CargaMasivaPage /></MemoryRouter>);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['cuit,razonSocial\n1,QA'], 'padron.csv', { type: 'text/csv' })] } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Procesar archivo' })); });
}

describe('bulk upload reports what the server actually loaded', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('XMLHttpRequest', FakeXHR); });
  afterEach(() => vi.unstubAllGlobals());
  it('does not call an all-failed upload completed and lists the failing rows', async () => {
    reply = { status: 200, body: JSON.stringify({ success: true, data: { total: 2, exitosos: 0, errores: [{ linea: 2, error: 'CUIT inválido' }, { linea: 3, error: 'Email duplicado' }] } }) };
    await upload();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se cargó ningún registro', expect.stringContaining('padron.csv'));
    expect(screen.getByText('Filas con error en padron.csv (2)')).toBeInTheDocument();
    expect(screen.getByText(/Email duplicado/)).toBeInTheDocument();
  });
  it('keeps the selected file and explains an expired session', async () => {
    reply = { status: 401, body: '' };
    await upload();
    expect(toast.error).toHaveBeenCalledWith('Error de carga', expect.stringMatching(/sesión venció/));
    expect(screen.getByRole('heading', { name: 'padron.csv' })).toBeInTheDocument();
  });
});
