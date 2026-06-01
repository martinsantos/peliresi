import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
    expect(screen.getByText('Permiso de ubicacion bloqueado')).toBeInTheDocument();
  });
});
