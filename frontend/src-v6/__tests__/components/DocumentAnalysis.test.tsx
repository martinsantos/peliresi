import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentAnalysis } from '../../components/DocumentAnalysis';
import type { ReceiptAnalysis } from '../../types/documentAnalysis';
const analysis: ReceiptAnalysis = { version: 1, duplicado: false, lectura: 'LEIDO', motor: 'PDF_TEXT', texto: 'RECIBO QA · 12500', alcance: 'Página 1.', aviso: null };

describe('receipt feedback is readable evidence, never a payment certification', () => {
  it.each(['receipt', 'electricity', 'license'] as const)('offers an explicit first reading of a saved %s without analysis', kind => {
    const retry = vi.fn();
    const view = render(<DocumentAnalysis kind={kind} onRetry={retry} />);
    expect(screen.getByRole('status')).toHaveTextContent('El original sigue guardado');
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Leer documento', exact: true}));
    expect(retry).toHaveBeenCalledOnce();
    view.rerender(<DocumentAnalysis kind={kind} onRetry={retry} retrying />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('never promises a saved original for a local preview or offers OCR for unsupported documents', () => {
    const retry = vi.fn(), view = render(<DocumentAnalysis kind="electricity" onRetry={retry} persisted={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('todavía no está guardado');
    view.rerender(<DocumentAnalysis kind="document" onRetry={retry} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('does not invent an indicator when analysis is absent', () => {
    const result = render(<DocumentAnalysis />); expect(result.container).toBeEmptyDOMElement();
  });
  it('keeps the duplicate warning visible and does not disclose other accounts', () => {
    render(<DocumentAnalysis analysis={{ ...analysis, duplicado: true }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Comprobante repetido');
    expect(screen.getByRole('alert')).toHaveTextContent('no acredita un pago nuevo');
  });
  it('makes the text optional and the legal limit explicit', () => {
    render(<DocumentAnalysis analysis={analysis} />);
    const details = screen.getByText('Ver texto leído del recibo').closest('details')!;
    expect(details.open).toBe(false);
    expect(screen.getByText('Lectura automática para revisar; no valida el pago.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('RECIBO QA · 12500')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver texto leído del recibo'));
    expect(details.open).toBe(true);
  });
  it('does not present absence of a byte match as proof that an ATM ticket is unique', () => {
    render(<DocumentAnalysis analysis={analysis} />);
    const scope = screen.getByTestId('receipt-control-scope');
    expect(scope).toHaveTextContent('Una identidad ya reservada no puede usarse en otro trámite aunque cambie la foto');
    expect(scope).toHaveTextContent('no valida fondos ante ATM');
    expect(scope).toHaveTextContent('CUIT, concepto, fecha e importe contra el original y el trámite');
    expect(scope).toHaveTextContent('si falta identidad legible, queda para revisión');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it.each(['SIN_TEXTO', 'NO_DISPONIBLE'] as const)('does not claim successful reading for %s', lectura => {
    render(<DocumentAnalysis analysis={{ ...analysis, lectura, texto: '' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('revisión manual');
    expect(screen.queryByText('Ver texto leído del recibo')).toBeNull();
  });
  it('offers a retry of the saved receipt without requiring replacement or a second upload', () => {
    const retry = vi.fn();
    render(<DocumentAnalysis analysis={{ ...analysis, lectura: 'NO_DISPONIBLE', texto: '', duplicado: true }} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar lectura', exact: true }));
    expect(retry).toHaveBeenCalledTimes(1); expect(screen.getByRole('alert')).toHaveTextContent('Comprobante repetido');
  });
  it('can retry an invoice whose PDF layer was readable but did not identify the tariff', () => {
    const retry = vi.fn(); render(<DocumentAnalysis analysis={{ ...analysis, documentKind: 'FACTURA_ELECTRICA', aviso: 'Lectura parcial del PDF.', electricidad: { version: 1, distribuidora: 'EDEMSA', nombreDistribuidora: 'EDEMSA', campos: {}, conflictos: [], evidencias: [], aviso: 'No cambia la TEF.' } }} onRetry={retry} />);
    expect(screen.getByRole('status')).toHaveTextContent('Lectura parcial'); fireEvent.click(screen.getByRole('button', { name: 'Reintentar lectura', exact: true })); expect(retry).toHaveBeenCalledOnce();
  });
  it('disables repeated retries while a read is in progress', () => {
    const retry = vi.fn();
    render(<DocumentAnalysis analysis={{ ...analysis, lectura: 'NO_DISPONIBLE', texto: '' }} onRetry={retry} retrying />);
    fireEvent.click(screen.getByRole('button', { name: 'Leyendo recibo…', exact: true }));
    expect(retry).not.toHaveBeenCalled(); expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('incomplete electricity evidence remains actionable', () => {
  const electric = { ...analysis, documentKind: 'FACTURA_ELECTRICA' as const,
    electricidad: { version: 1 as const, distribuidora: 'EDEMSA', nombreDistribuidora: 'EDEMSA',
      campos: { categoriaTarifaria: 'T2', consumoKwh: '1250' }, conflictos: [], evidencias: [], aviso: 'Revisá el original.' } };
  it('offers a retry when tariff is present but consumption was not read', () => {
    render(<DocumentAnalysis analysis={{ ...electric, electricidad: { ...electric.electricidad, campos: { categoriaTarifaria: 'T2' } } }} onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Reintentar lectura' })).toBeEnabled();
  });
  it('offers a retry after a failed complementary pass despite retained fields', () => {
    render(<DocumentAnalysis analysis={{ ...electric, aviso: 'No se pudo completar la nueva lectura.' }} onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo completar');
    expect(screen.getByRole('button', { name: 'Reintentar lectura' })).toBeEnabled();
  });
  it('offers a retry for an unidentified distributor', () => {
    render(<DocumentAnalysis analysis={{ ...electric, electricidad: { ...electric.electricidad, distribuidora: null, nombreDistribuidora: null } }} onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Reintentar lectura' })).toBeEnabled();
  });
  it('does not require optional power or subsidy fields to complete the reading', () => {
    render(<DocumentAnalysis analysis={electric} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Reintentar lectura' })).toBeNull();
    expect(screen.getByText('1250 kWh')).toBeInTheDocument();
  });
});
