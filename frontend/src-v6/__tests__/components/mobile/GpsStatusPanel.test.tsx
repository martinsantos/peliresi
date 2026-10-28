import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GpsStatusPanel } from '../../../components/mobile/GpsStatusPanel';

describe('GpsStatusPanel', () => {
  it('shows active GPS coordinates, accuracy, and pending sync count', () => {
    render(
      <GpsStatusPanel
        status="active"
        sendStatus="error"
        position={[-32.92871, -68.85352]}
        details={{ accuracy: 8, speed: 10, heading: 90, altitude: null, lastUpdate: new Date('2026-05-31T10:00:00Z') }}
        pendingCount={3}
        lastSyncAt={null}
      />,
    );

    expect(screen.getByText('GPS activo')).toBeInTheDocument();
    expect(screen.getByText(/-32.92871, -68.85352/)).toBeInTheDocument();
    expect(screen.getByText('3 pendientes')).toBeInTheDocument();
    expect(screen.getByText('Sin enviar')).toBeInTheDocument();
  });

  it('shows Android recovery guidance when GPS is denied', () => {
    render(
      <GpsStatusPanel
        status="denied"
        sendStatus="idle"
        position={null}
        details={{ accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null }}
        pendingCount={0}
        lastSyncAt={null}
      />,
    );

    expect(screen.getByText('Permiso GPS denegado')).toBeInTheDocument();
    expect(screen.getByText('Permiso de ubicación bloqueado')).toBeInTheDocument();
  });

  it('uses the singular for one point waiting to be sent', () => {
    render(<GpsStatusPanel status="active" sendStatus="error" position={[-33,-69]}
      details={{accuracy:10,speed:null,heading:null,altitude:null,lastUpdate:null}}
      pendingCount={1} lastSyncAt={null} />);
    expect(screen.getByText('1 pendiente')).toBeInTheDocument();
  });

  it('offers a single retry after a GPS permission failure', () => {
    const retry=vi.fn();
    const props={status:'denied' as const,sendStatus:'idle' as const,position:null,details:{accuracy:null,speed:null,heading:null,altitude:null,lastUpdate:null},pendingCount:0,lastSyncAt:null,onRetry:retry};
    const view=render(<GpsStatusPanel {...props} />);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar GPS',exact:true}));
    expect(retry).toHaveBeenCalledOnce();
    view.rerender(<GpsStatusPanel {...props} retrying />);
    expect(screen.getByRole('button',{name:'Reintentando GPS',exact:true})).toBeDisabled();
  });

  it.each(['unavailable','error'] as const)('offers retry when GPS is %s', status => {
    const retry=vi.fn();
    render(<GpsStatusPanel status={status} sendStatus="idle" position={null}
      details={{accuracy:null,speed:null,heading:null,altitude:null,lastUpdate:null}}
      pendingCount={0} lastSyncAt={null} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar GPS',exact:true}));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('does not present a stopped tracker as active while the trip is paused', () => {
    render(<GpsStatusPanel status="active" sendStatus="ok" position={[-33,-69]}
      details={{accuracy:10,speed:null,heading:null,altitude:null,lastUpdate:null}}
      pendingCount={0} lastSyncAt={new Date()} paused onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Seguimiento GPS pausado');
    expect(screen.queryByText('GPS activo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Reintentar GPS'})).not.toBeInTheDocument();
  });

  it('keeps a storage failure visible even when the trip is paused', () => {
    render(<GpsStatusPanel status="active" sendStatus="error" position={null}
      details={{accuracy:null,speed:null,heading:null,altitude:null,lastUpdate:null}}
      pendingCount={1} lastSyncAt={null} paused storageError />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar el recorrido');
    expect(screen.getByRole('alert')).toHaveTextContent('Mantené esta pantalla abierta');
  });

  it('keeps an actionable upload error visible while the trip is paused', () => {
    render(<GpsStatusPanel status="active" sendStatus="error" sendError="No se pudo verificar el viaje o el servidor. Contactá a soporte."
      position={null} details={{accuracy:null,speed:null,heading:null,altitude:null,lastUpdate:null}}
      pendingCount={1} lastSyncAt={null} paused />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo verificar el viaje o el servidor');
  });

  it('reports Android GPS as searching instead of off while waiting for a fix', () => {
    render(
      <GpsStatusPanel
        status="acquiring"
        sendStatus="idle"
        position={null}
        details={{ accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null }}
        pendingCount={0}
        lastSyncAt={null}
      />,
    );

    expect(screen.getByText('Buscando señal GPS')).toBeInTheDocument();
    expect(screen.getByText('Esperando el primer punto GPS del dispositivo.')).toBeInTheDocument();
    expect(screen.queryByText('GPS no disponible')).not.toBeInTheDocument();
  });
});
