import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InspectionDocumentsPanel } from '../../pages/inspecciones/InspectionDocumentsPanel';

describe('InspectionDocumentsPanel', () => {
  it('explains and edits the two complementary outputs independently', () => {
    const onActDataChange = vi.fn();
    const onReportChange = vi.fn();
    render(<InspectionDocumentsPanel
      actData={{}}
      report={{}}
      actEditable
      reportEditable
      onActDataChange={onActDataChange}
      onReportChange={onReportChange}
    />);

    expect(screen.getByText(/se remiten juntos a legales/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Atendido por'), { target: { value: 'Responsable de planta' } });
    fireEvent.change(screen.getByLabelText('Plazo de descargo (días hábiles)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Daños a personas o bienes'), { target: { value: 'NO_OBSERVADOS' } });
    fireEvent.change(screen.getByLabelText('Libro de Registro de Operaciones'), { target: { value: 'EXHIBIDO' } });
    fireEvent.change(screen.getByLabelText('Constancia del libro'), { target: { value: 'Libro RP-2026 verificado.' } });
    fireEvent.change(screen.getByLabelText('Firma de la persona interviniente'), { target: { value: 'NEGATIVA' } });
    fireEvent.change(screen.getByLabelText('Constancia de firma, negativa o imposibilidad'), { target: { value: 'Negativa asentada en campo.' } });
    fireEvent.change(screen.getByLabelText('Entrega de copia del acta'), { target: { value: 'ENTREGADA' } });
    fireEvent.change(screen.getByLabelText('Domicilio legal constituido'), { target: { value: 'Calle Legal 123' } });
    fireEvent.change(screen.getByLabelText('Comunicación de lo actuado'), { target: { value: 'COMUNICADA_EN_ACTA' } });
    fireEvent.change(screen.getByLabelText('3. Evaluación'), { target: { value: 'Evaluación técnica fundada en acta y evidencias.' } });

    expect(onActDataChange).toHaveBeenCalledWith({ atendidoPor: 'Responsable de planta' });
    expect(onActDataChange).toHaveBeenCalledWith({ plazoDescargoDias: 5 });
    expect(onActDataChange).toHaveBeenCalledWith({ danosEstado: 'NO_OBSERVADOS' });
    expect(onActDataChange).toHaveBeenCalledWith({ libroOperacionesEstado: 'EXHIBIDO' });
    expect(onActDataChange).toHaveBeenCalledWith({ libroOperacionesDetalle: 'Libro RP-2026 verificado.' });
    expect(onActDataChange).toHaveBeenCalledWith({ firmaIntervinienteEstado: 'NEGATIVA' });
    expect(onActDataChange).toHaveBeenCalledWith({ firmaIntervinienteDetalle: 'Negativa asentada en campo.' });
    expect(onActDataChange).toHaveBeenCalledWith({ copiaActaEstado: 'ENTREGADA' });
    expect(onActDataChange).toHaveBeenCalledWith({ domicilioLegal: 'Calle Legal 123' });
    expect(onActDataChange).toHaveBeenCalledWith({ notificacionEstado: 'COMUNICADA_EN_ACTA' });
    expect(onReportChange).toHaveBeenCalledWith({ evaluacion: 'Evaluación técnica fundada en acta y evidencias.' });
  });

  it('freezes the field act while allowing the later technical report', () => {
    render(<InspectionDocumentsPanel
      actData={{ atendidoPor: 'Persona constatada' }}
      report={{ objetivo: 'Evaluar lo constatado' }}
      actEditable={false}
      reportEditable
      onActDataChange={vi.fn()}
      onReportChange={vi.fn()}
    />);

    expect(screen.getByLabelText('Atendido por')).toBeDisabled();
    expect(screen.getByLabelText('1. Objetivo')).not.toBeDisabled();
  });
});
