import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { GeneratorCurrentExceptionPanel } from '../../pages/manifiestos/components/GeneratorCurrentExceptionPanel';
import { GeneratorCurrentExceptionHistory } from '../../components/generators/GeneratorCurrentExceptionHistory';
import { INTAKE_REASON_LABELS } from '../../types/inspectionIntake';

const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../services/api', () => ({ api: mock }));
function view(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
}
const status = (data: object) => ({ data: { data: { habilitado: true, fichaGenerador: ['Y8'], ...data } } });
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it('stays silent when the rule is off or the currents are registered', async () => {
  mock.get.mockResolvedValue({ data: { data: { habilitado: false } } });
  const { container } = view(<GeneratorCurrentExceptionPanel manifiestoId="m1" />);
  await waitFor(() => expect(mock.get).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it('tells the parties why they cannot approve yet, without offering the grant', async () => {
  mock.get.mockResolvedValue(status({ estado: 'REQUIERE_EXCEPCION', corrientes: ['Y34'], puedeOtorgar: false,
    mensaje: 'Y34 no figura en la ficha del generador. La autoridad de aplicación debe otorgar la excepción antes de las aprobaciones.' }));
  view(<GeneratorCurrentExceptionPanel manifiestoId="m1" />);
  expect(await screen.findByText('Corriente no inscripta · Y34')).toBeVisible();
  expect(screen.getByText(/La autoridad de aplicación debe otorgar la excepción/)).toBeVisible();
  expect(screen.getByText('Ficha del generador: Y8')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Otorgar excepción' })).toBeNull();
});

it('lets the authority grant with a reason, once, and keeps the reason on error', async () => {
  mock.get.mockResolvedValue(status({ estado: 'REQUIERE_EXCEPCION', corrientes: ['Y34'], puedeOtorgar: true, mensaje: 'Requiere excepción.' }));
  mock.post.mockRejectedValueOnce({ response: { data: { message: 'El generador ya tiene una excepción abierta' } } });
  view(<GeneratorCurrentExceptionPanel manifiestoId="m1" />);
  const button = await screen.findByRole('button', { name: 'Otorgar excepción' });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motivo de la excepción'), { target: { value: 'Generación puntual verificada' } });
  fireEvent.click(button);
  expect(await screen.findByText('El generador ya tiene una excepción abierta')).toBeVisible();
  expect(screen.getByLabelText('Motivo de la excepción')).toHaveValue('Generación puntual verificada');
  mock.post.mockResolvedValueOnce({ data: { data: {} } });
  fireEvent.click(screen.getByRole('button', { name: 'Otorgar excepción' }));
  await waitFor(() => expect(mock.post).toHaveBeenLastCalledWith('/manifiestos/m1/excepcion-corriente', { motivo: 'Generación puntual verificada' }));
});

it('explains a repeated stream as blocked', async () => {
  mock.get.mockResolvedValue(status({ estado: 'BLOQUEADA', corrientes: ['Y12'], puedeOtorgar: false, mensaje: 'Ya tiene una excepción abierta por Y34.' }));
  view(<GeneratorCurrentExceptionPanel manifiestoId="m1" />);
  expect(await screen.findByText('Corriente no inscripta reiterada · Y12')).toBeVisible();
});

it('shows the generator history with open and closed exceptions', async () => {
  mock.get.mockResolvedValue({ data: { data: { habilitado: true, fichaCorrientes: ['Y8', 'Y34'], disponible: false, excepciones: [
    { id: 'e2', origen: 'ADENDA', manifiestoId: 'm1', numero: 'M-1', corrientes: ['Y12'], motivo: 'Hallazgo verificado', otorgadaAt: '2026-11-07T12:00:00Z', estado: 'ABIERTA', cerradaAt: null, cierre: null },
    { id: 'e1', origen: 'MANIFIESTO', manifiestoId: 'm2', numero: 'M-2', corrientes: ['Y34'], motivo: 'Generación puntual', otorgadaAt: '2026-11-06T12:00:00Z', estado: 'CERRADA', cerradaAt: '2026-11-07T10:00:00Z', cierre: { fuente: 'EDICION_FICHA' } },
  ] } } });
  view(<GeneratorCurrentExceptionHistory generadorId="g1" linkTo={path => '/mobile' + path} />);
  expect(await screen.findByText(/Hay una excepción abierta/)).toBeVisible();
  expect(screen.getByText('Abierta')).toBeVisible();
  expect(screen.getByText(/por alta en la ficha/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Ver M-1' })).toHaveAttribute('href', '/mobile/manifiestos/m1/adendas');
});

it('labels the new antecedent motives', () => {
  expect(INTAKE_REASON_LABELS.Y_NO_INSCRIPTA_GENERADOR).toBe('Y no inscripta en la ficha del generador');
  expect(INTAKE_REASON_LABELS.Y_NO_INSCRIPTA_REITERADA).toBe('Y no inscripta con excepción abierta');
});
