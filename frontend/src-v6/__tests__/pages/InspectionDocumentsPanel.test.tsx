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
    fireEvent.change(screen.getByLabelText('3. Evaluación'), { target: { value: 'Evaluación técnica fundada en acta y evidencias.' } });

    expect(onActDataChange).toHaveBeenCalledWith({ atendidoPor: 'Responsable de planta' });
    expect(onActDataChange).toHaveBeenCalledWith({ plazoDescargoDias: 5 });
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
