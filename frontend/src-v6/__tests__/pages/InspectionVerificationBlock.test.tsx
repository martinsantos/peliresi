import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InspectionVerificationBlock } from '../../pages/inspecciones/InspectionVerificationBlock';

describe('InspectionVerificationBlock', () => {
  it('identifies a current document without exposing private data', () => {
    render(<InspectionVerificationBlock verification={{ url: '/verificar/inspecciones/current', huella: 'a'.repeat(64), version: 4, estadoVerificacion: 'VIGENTE' }} />);

    expect(screen.getByText('Documento vigente')).toBeInTheDocument();
    expect(screen.getByText(/La página pública no expone evidencias privadas/)).toBeInTheDocument();
    expect(screen.queryByText(/versión actual registrada/i)).not.toBeInTheDocument();
  });

  it('explains that an older emitted version remains authentic', () => {
    render(<InspectionVerificationBlock verification={{ url: '/verificar/inspecciones/historic', huella: 'b'.repeat(64), version: 3, estadoVerificacion: 'HISTORICA_AUTENTICA', versionActual: 5, huellaActual: 'c'.repeat(64) }} />);

    expect(screen.getByText('Versión histórica auténtica')).toBeInTheDocument();
    expect(screen.getByTestId('inspection-verification')).toHaveTextContent(/Este enlace conserva la versión 3 emitida por SITREP/);
    expect(screen.getByTestId('inspection-verification')).toHaveTextContent(/versión actual registrada del expediente es la 5/);
    expect(screen.queryByText(/adulterad/i)).not.toBeInTheDocument();
  });
});
