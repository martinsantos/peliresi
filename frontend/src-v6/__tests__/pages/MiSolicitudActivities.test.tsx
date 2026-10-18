import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../components/ActorActivities', () => ({ default: () => null }));
vi.mock('../../hooks/useSolicitudes', () => ({
  useMisSolicitudes: () => ({ data: [
    { id: 'g', tipoActor: 'GENERADOR', estado: 'OBSERVADA', observaciones: 'Generador observado' },
    { id: 'o', tipoActor: 'OPERADOR', estado: 'OBSERVADA', observaciones: 'Operador observado' },
  ] }),
  useMensajesSolicitud: () => ({ data: [] }),
  useEnviarMensaje: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEnviarSolicitud: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
import MiSolicitudPage from '../../pages/solicitud/MiSolicitudPage';
afterEach(() => vi.unstubAllEnvs());
it('opens the requested own application from the activity button', () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true');
  render(<MemoryRouter initialEntries={['/mi-solicitud?solicitud=o']}><MiSolicitudPage /></MemoryRouter>);
  expect(screen.getByLabelText('Solicitud por actividad')).toHaveValue('o');
  expect(screen.getByText('Tipo: OPERADOR')).toBeVisible();
});
it('keeps unsent conversations separate when selecting another application', () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true');
  render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
  fireEvent.change(screen.getByPlaceholderText('Escribe un mensaje...'), { target: { value: 'Consulta del generador sin enviar' } });
  fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'o' } });
  expect(screen.getByText('Tipo: OPERADOR')).toBeVisible();
  expect(screen.getByPlaceholderText('Escribe un mensaje...')).toHaveValue('');
  fireEvent.change(screen.getByPlaceholderText('Escribe un mensaje...'), { target: { value: 'Consulta del operador sin enviar' } });
  fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'g' } });
  expect(screen.getByPlaceholderText('Escribe un mensaje...')).toHaveValue('Consulta del generador sin enviar');
  fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'o' } });
  expect(screen.getByPlaceholderText('Escribe un mensaje...')).toHaveValue('Consulta del operador sin enviar');
});
