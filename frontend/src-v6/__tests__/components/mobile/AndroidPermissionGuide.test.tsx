import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AndroidPermissionGuide } from '../../../components/mobile/AndroidPermissionGuide';

describe('AndroidPermissionGuide', () => {
  it('renders GPS recovery steps for denied location permission', () => {
    render(<AndroidPermissionGuide permission="gps" state="denied" />);

    expect(screen.getByText('Permiso de ubicación bloqueado')).toBeInTheDocument();
    expect(screen.getByText(/navegador o teléfono/i)).toBeInTheDocument();
    expect(screen.getByText(/Reintentar GPS/i)).toBeInTheDocument();
    expect(screen.queryByText(/validar entregas/i)).not.toBeInTheDocument();
  });

  it('renders notification recovery copy', () => {
    render(<AndroidPermissionGuide permission="notifications" state="denied" />);

    expect(screen.getByText('Notificaciones desactivadas')).toBeInTheDocument();
    expect(screen.getByText(/avisos de viaje/i)).toBeInTheDocument();
  });
});
