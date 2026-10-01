import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InspectionReport } from '../../pages/inspecciones/InspectionReport';
import type { Inspection } from '../../types/inspection';

describe('InspectionReport', () => {
  it('explains an unlinked finding instead of showing empty declared-data metrics', () => {
    const inspection = {
      id: 'finding-1', tipoActor: null, observaciones: 'Se observa un vertido en el lugar.',
      comparaciones: [], items: [], evidencias: [], informeTecnico: {},
    } as unknown as Inspection;

    render(<InspectionReport inspection={inspection} />);

    expect(screen.getByText(/todavía no hay un sujeto ni una declaración vinculados/i)).toBeInTheDocument();
    expect(screen.queryByText('Datos verificados')).not.toBeInTheDocument();
    expect(screen.queryByText('Diferencias')).not.toBeInTheDocument();
    expect(screen.getByText('Controles conformes')).toBeInTheDocument();
  });
});
