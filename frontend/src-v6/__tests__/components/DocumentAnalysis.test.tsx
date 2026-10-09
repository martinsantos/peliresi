import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentAnalysis } from '../../components/DocumentAnalysis';
import type { ReceiptAnalysis } from '../../types/documentAnalysis';
const analysis: ReceiptAnalysis = { version: 1, duplicado: false, lectura: 'LEIDO', motor: 'PDF_TEXT', texto: 'RECIBO QA · 12500', alcance: 'Página 1.', aviso: null };

describe('receipt feedback is readable evidence, never a payment certification', () => {
  it('does not invent an indicator when analysis is absent', () => {
    const result = render(<DocumentAnalysis />); expect(result.container).toBeEmptyDOMElement();
  });
  it('keeps the duplicate warning visible and does not disclose other accounts', () => {
    render(<DocumentAnalysis analysis={{ ...analysis, duplicado: true }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Comprobante repetido');
    expect(screen.getByRole('alert')).toHaveTextContent('no acredita un pago nuevo');
  });
  it('makes the text optional and the legal limit explicit', () => {
    const result = render(<DocumentAnalysis analysis={analysis} />);
    const details = result.container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(screen.getByText(/no valida el pago/)).toBeInTheDocument();
    expect(screen.getByText('RECIBO QA · 12500')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver texto leído del recibo'));
  });
  it.each(['SIN_TEXTO', 'NO_DISPONIBLE'] as const)('does not claim successful reading for %s', lectura => {
    render(<DocumentAnalysis analysis={{ ...analysis, lectura, texto: '' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('revisión manual');
    expect(screen.queryByText('Ver texto leído del recibo')).toBeNull();
  });
});
