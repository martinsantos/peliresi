import React, { useLayoutEffect, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InspectionActData } from '../../types/inspection';
import { InspectionClosingQuestions } from '../../pages/inspecciones/InspectionClosingQuestions';

let last: InspectionActData = {};
function Harness({ initial = {} }: { initial?: InspectionActData }) {
  const [value, setValue] = useState<InspectionActData>(initial);
  useLayoutEffect(() => { last = value; }, [value]);
  return <InspectionClosingQuestions value={value} disabled={false} onChange={v => { last = v; setValue(v); }} />;
}

describe('closing questions', () => {
  it('answers with one tap, opens a detail only when the answer asks for it and feeds the act keys', () => {
    render(<Harness />);
    expect(screen.getByText('0 de 6 respondidas · la aprobación las necesita.')).toBeTruthy();
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'No se observaron' }));
    expect(last.danosEstado).toBe('NO_OBSERVADOS');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Se negó' }));
    expect(last.firmaIntervinienteEstado).toBe('NEGATIVA');
    fireEvent.change(screen.getByLabelText('Constancia de la negativa, imposibilidad o ausencia'), { target: { value: 'Se negó ante dos testigos.' } });
    expect(last.firmaIntervinienteDetalle).toBe('Se negó ante dos testigos.');
    expect(screen.getByText('2 de 6 respondidas · la aprobación las necesita.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Se negó' }));
    expect(last.firmaIntervinienteEstado).toBeUndefined();
    expect(screen.getByLabelText('Constancia de la negativa, imposibilidad o ausencia')).toHaveValue('Se negó ante dos testigos.');
  });
  it('shows what the act already holds', () => {
    render(<Harness initial={{ libroOperacionesEstado: 'EXHIBIDO', libroOperacionesDetalle: 'Libro RP-2026 verificado.', copiaActaEstado: 'ENTREGADA' }} />);
    expect(screen.getByRole('button', { name: 'Sí, verificado' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Constancia del libro')).toHaveValue('Libro RP-2026 verificado.');
    expect(screen.getByText('2 de 6 respondidas · la aprobación las necesita.')).toBeTruthy();
  });
});
