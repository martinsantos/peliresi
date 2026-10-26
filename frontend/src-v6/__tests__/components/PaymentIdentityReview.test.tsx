import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentIdentityReview } from '../../components/PaymentIdentityReview';
import { ElectricityEvidence } from '../../components/ElectricityEvidence';
import type { ReceiptAnalysis } from '../../types/documentAnalysis';
const sha = 'a'.repeat(64);
const analysis: ReceiptAnalysis = { version: 1, duplicado: false, lectura: 'LEIDO', motor: 'PDF_TEXT', texto: 'ATM ARTIFICIAL', alcance: 'QA', aviso: null,
  pago: { revision: 'PENDIENTE', coincidencia: false, propuesta: { campos: { emisor: 'ATM_TASAS', idComprobante: 'QA123', codigoTasa: '162', importe: '12500.00', fechaPago: '2026-10-20' }, conflictos: [] } } };
describe('reviewing payment identity', () => {
  it('requires reconciling a new OCR reading of the same original before reserving a payment', () => {
    const save = vi.fn();
    const { rerender } = render(<PaymentIdentityReview sha256={sha} cuit="30900000011" referencia="QA" onConfirm={save} />);
    fireEvent.click(screen.getByText('Identificar y reservar pago ATM'));
    fireEvent.change(screen.getByLabelText('ID Comprobante ATM'), { target: { value: 'MANUAL999' } });
    fireEvent.click(screen.getByRole('checkbox'));
    rerender(<PaymentIdentityReview analysis={analysis} sha256={sha} cuit="30900000011" referencia="QA" onConfirm={save} />);
    expect(screen.getByRole('button', { name: 'Confirmar y reservar pago' })).toBeDisabled();
    expect(screen.getByLabelText('ID Comprobante ATM')).toHaveValue('MANUAL999');
    fireEvent.click(screen.getByRole('button', { name: 'Usar nueva lectura' }));
    expect(screen.getByLabelText('ID Comprobante ATM')).toHaveValue('QA123');
    expect(screen.getByLabelText('Importe pagado (ARS)')).toHaveValue('12500.00');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(save).not.toHaveBeenCalled();
  });
  it('keeps manual corrections only after an explicit choice and requests a fresh original review', () => {
    const { rerender } = render(<PaymentIdentityReview analysis={analysis} sha256={sha} referencia="QA" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Identificar y reservar pago ATM'));
    fireEvent.change(screen.getByLabelText('Importe pagado (ARS)'), { target: { value: '19000' } });
    fireEvent.click(screen.getByRole('checkbox'));
    const next = { ...analysis, pago: { ...analysis.pago!, propuesta: { campos: { ...analysis.pago!.propuesta!.campos, importe: '21000' }, conflictos: [] } } };
    rerender(<PaymentIdentityReview analysis={next} sha256={sha} referencia="QA" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conservar mis datos' }));
    expect(screen.getByLabelText('Importe pagado (ARS)')).toHaveValue('19000');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    rerender(<PaymentIdentityReview analysis={JSON.parse(JSON.stringify(next))} sha256={sha} referencia="QA" onConfirm={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Usar nueva lectura' })).toBeNull();
    expect(screen.getByLabelText('Importe pagado (ARS)')).toHaveValue('19000');
  });
  it('does not carry reviewed payment fields to another original or taxpayer', () => {
    const { rerender } = render(<PaymentIdentityReview analysis={analysis} sha256={sha} cuit="30900000011" referencia="QA" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Identificar y reservar pago ATM'));
    fireEvent.click(screen.getByRole('checkbox'));
    rerender(<PaymentIdentityReview sha256={'b'.repeat(64)} cuit="30900000022" referencia="QA-OTHER" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Identificar y reservar pago ATM'));
    expect(screen.getByLabelText('ID Comprobante ATM')).toHaveValue('');
    expect(screen.getByLabelText('CUIT del obligado')).toHaveValue('30900000022');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
  it.each([
    ['PENDIENTE', 'Revisá el documento para aprobarlo o rechazarlo.'],
    ['APROBADO', 'Documento aprobado.'],
    ['RECHAZADO', 'Documento rechazado. La reserva no se libera para otro trámite.'],
  ] as const)('reflects document state %s without confusing reservation with accreditation', (estado, message) => {
    const reserved: ReceiptAnalysis = { ...analysis, pago: { ...analysis.pago!, revision: 'CONFIRMADO', sha256: sha } };
    const { rerender } = render(<PaymentIdentityReview analysis={reserved} sha256={sha} estadoDocumento={estado} referencia="QA" onConfirm={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.getByRole('status')).toHaveTextContent('No acredita fondos ante ATM.');
    expect(screen.getByRole('status')).not.toHaveTextContent('si está pendiente');
    rerender(<PaymentIdentityReview analysis={reserved} sha256={sha} estadoDocumento="APROBADO" referencia="QA" onConfirm={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Documento aprobado.');
    expect(screen.getByRole('status')).not.toHaveTextContent('Revisá el documento');
  });
  it.each(['0', '-1', '12,345', 'un mil', '1,000.50'])('keeps invalid amount %s local and points to the field', value => {
    const save = vi.fn();
    render(<PaymentIdentityReview analysis={analysis} sha256={sha} cuit="30900000011" referencia="QA" onConfirm={save} />);
    fireEvent.click(screen.getByText('Identificar y reservar pago ATM'));
    fireEvent.change(screen.getByLabelText('Importe pagado (ARS)'), {target:{value}});
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name:'Confirmar y reservar pago'}));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Importe pagado (ARS)')).toHaveFocus();
    expect(screen.getByLabelText('Importe pagado (ARS)')).toHaveAccessibleDescription('Ingresá un importe mayor que cero, con hasta dos decimales. Por ejemplo: 12.500,50.');
    expect(screen.getByLabelText('ID Comprobante ATM')).toHaveValue('QA123');
  });
  it('keeps an incomplete OCR review local and focuses the first missing field', async () => {
    const save = vi.fn();
    render(<PaymentIdentityReview sha256={sha} cuit="30900000011" referencia="QA-ALTA" onConfirm={save} />);
    fireEvent.click(screen.getByText('Identificar y reservar pago ATM'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y reservar pago' }));
    expect(save).not.toHaveBeenCalled();
    const id = screen.getByLabelText('ID Comprobante ATM');
    expect(id).toHaveFocus(); expect(id).toHaveAttribute('aria-invalid', 'true');
    expect(id).toHaveAccessibleDescription('Completá id comprobante atm según el original.');
    expect(screen.getByLabelText('Transacción (si figura)')).toHaveAttribute('aria-invalid', 'false');
    for (const [name, value] of [['ID Comprobante ATM','QA123'],['Código de tasa','162'],['Fecha de pago','2026-10-20'],['Importe pagado (ARS)','12500,00']]) {
      fireEvent.change(screen.getByLabelText(name), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y reservar pago' }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({ importe:'12500,00', expectedSha256:sha });
  });
  it('identifies the mismatched taxpayer without erasing the original values', () => {
    const save = vi.fn();
    render(<PaymentIdentityReview analysis={analysis} sha256={sha} cuit="30900000011" referencia="QA" onConfirm={save} />);
    fireEvent.click(screen.getByText('Identificar y reservar pago ATM'));
    fireEvent.change(screen.getByLabelText('CUIT del obligado'), { target:{value:'30900000022'} });
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', {name:'Confirmar y reservar pago'}));
    expect(save).not.toHaveBeenCalled(); expect(screen.getByLabelText('CUIT del obligado')).toHaveFocus();
    expect(screen.getByLabelText('CUIT del obligado')).toHaveAccessibleDescription('El CUIT debe coincidir con el obligado de este trámite.');
    expect(screen.getByLabelText('ID Comprobante ATM')).toHaveValue('QA123');
  });
  it('requires a reviewed original, sends the exact immutable file hash, and keeps fields on conflict', async () => {
    const save = vi.fn().mockRejectedValue({ response: { data: { message: 'Este pago ya está vinculado a otro trámite.' } } });
    render(<PaymentIdentityReview analysis={analysis} sha256={sha} cuit="30900000011" referencia="QA-ALTA" onConfirm={save} />);
    fireEvent.click(screen.getByText('Identificar y reservar pago ATM'));
    const button = screen.getByRole('button', { name: 'Confirmar y reservar pago' }); expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button);
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({ emisor: 'ATM_TASAS', idComprobante: 'QA123', cuit: '30900000011', expectedSha256: sha, originalRevisado: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('otro trámite');
    expect(screen.getByLabelText('ID Comprobante ATM')).toHaveValue('QA123'); expect(button).not.toBeDisabled();
  });
  it('cannot allocate a legacy attachment without a fingerprint', () => {
    render(<PaymentIdentityReview analysis={analysis} referencia="QA" onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Identificar y reservar pago ATM')); fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Confirmar y reservar pago' })).toBeDisabled(); expect(screen.getByRole('alert')).toHaveTextContent('huella');
  });
  it('shows the confirmed reservation without claiming ATM accreditation', () => {
    render(<PaymentIdentityReview analysis={{ ...analysis, pago: { ...analysis.pago!, revision: 'CONFIRMADO', sha256: sha } }} sha256={sha} referencia="QA" onConfirm={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('reservado para este trámite'); expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status')).not.toHaveTextContent('Documento aprobado');
    expect(screen.getByRole('status')).not.toHaveTextContent('Revisá el documento');
  });
  it('presents tariff, energy and power separately, with the labelled evidence and explicit conflicts', () => {
    render(<ElectricityEvidence reading={{ version: 1, distribuidora: 'EDEMSA', nombreDistribuidora: 'EDEMSA', campos: { categoriaTarifaria: 'T1R3', consumoKwh: '1200', potenciaContratadaKw: '25' }, evidencias: [{ campo: 'categoriaTarifaria', texto: 'TARIFA T1-R3' }], conflictos: ['suministro'], aviso: 'No reemplaza la potencia instalada en HP ni cambia la TEF.' }} />);
    expect(screen.getByLabelText('Lectura de factura eléctrica')).toHaveTextContent('T1R3'); expect(screen.getByText('1200 kWh')).toBeVisible(); expect(screen.getByText('25 kW')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('contradictorios'); expect(screen.getByText('No reemplaza la potencia instalada en HP ni cambia la TEF.')).toBeVisible();
    expect(screen.getByText('Suministro').parentElement).toHaveTextContent('Lecturas distintas: revisar original');
    expect(screen.getByText('Período').parentElement).toHaveTextContent('No leído');
  });
});
