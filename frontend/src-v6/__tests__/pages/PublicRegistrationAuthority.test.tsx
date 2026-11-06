import React from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InscripcionWizardPage from '../../pages/public/InscripcionWizardPage';

const requests = vi.hoisted(() => ({ getRequirements: vi.fn(), put: vi.fn(), post: vi.fn(), uploadDocumento: vi.fn(), preview: vi.fn() }));
vi.mock('../../services/documentPreview', () => ({ previewDocument: requests.preview }));
vi.mock('../../services/api', () => ({ default: { put: requests.put, post: requests.post } }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: requests }));

const requirements = [
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP', required: true },
  { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Habilitación', required: true },
  { tipo: 'MEMORIA_TECNICA', nombre: 'Memoria técnica', required: true },
  { tipo: 'COMPROBANTE_PAGO', nombre: 'Comprobante de sellado / pago', required: false },
];
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
async function openReview(actor: string, prefix = '') {
  await act(async () => {
    render(<MemoryRouter basename={prefix || '/'} initialEntries={[`${prefix}/inscripcion/${actor}?modo=revision`]}><Routes>
      <Route path="/inscripcion/:tipo" element={<InscripcionWizardPage />} />
    </Routes></MemoryRouter>);
  });
}

describe('Public registration collects declarations, never calculates a tax for the applicant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    requests.preview.mockResolvedValue({ persistido: false, campos: {}, analisis: { version: 1, duplicado: false, lectura: 'LEIDO', texto: 'LECTURA QA', motor: 'PDF_TEXT', alcance: 'QA', aviso: null } });
    requests.getRequirements.mockResolvedValue({ documentos: requirements, maxBytes: 10 * 1024 * 1024 });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
    else delete (HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it.each([['generador', 7, 5], ['operador', 8, 6]] as const)('%s preserves operational data without a TEF amount or coefficients', async (actor, total, activityStep) => {
    await openReview(actor);
    const rail = screen.getByRole('navigation', { name: 'Etapas de la inscripción' });
    expect(within(rail).queryByRole('button', { name: /Calculo TEF/i })).not.toBeInTheDocument();
    fireEvent.click(within(rail).getByRole('button', { name: `Paso ${activityStep} de ${total}: Actividad` }));
    expect(screen.getByRole('heading', { name: 'Datos de la actividad' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Personal en planta'), { target: { value: '32' } });
    fireEvent.change(screen.getByLabelText('Potencia instalada (HP)'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Superficie cubierta (m²)'), { target: { value: '1250' } });
    expect(screen.queryByText(/TEF = M/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tasa de Evaluacion y Fiscalizacion')).not.toBeInTheDocument();
    fireEvent.click(within(rail).getByRole('button', { name: `Paso ${total} de ${total}: Resumen` }));
    expect(screen.getByRole('heading', { name: 'Actividad' })).toBeVisible();
    expect(screen.getByText('32', { exact: true })).toBeVisible();
    expect(screen.getByText('120', { exact: true })).toBeVisible();
    expect(screen.getByText('1250', { exact: true })).toBeVisible();
    expect(screen.queryByText('Factor R', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Monto MxR', { exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    fireEvent.click(within(rail).getByRole('button', { name: `Paso ${activityStep} de ${total}: Actividad` }));
    expect(screen.getByLabelText('Personal en planta')).toHaveValue(32);
    expect(requests.put).not.toHaveBeenCalled();
    expect(requests.post).not.toHaveBeenCalled();
  });

  it.each([['generador', 7, 6], ['operador', 8, 7], ['transportista', 5, 4]] as const)('%s Probar reads the receipt without pretending it was stored or creating an application', async (actor, total, documentsStep) => {
    await openReview(actor);
    fireEvent.click(screen.getByRole('button', { name: `Paso ${documentsStep} de ${total}: Documentos` }));
    const row = screen.getByTestId('registration-document-COMPROBANTE_PAGO');
    expect(within(row).queryByLabelText('obligatorio')).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Adjuntar' }));
    fireEvent.change(screen.getByLabelText('Adjuntar Comprobante de sellado / pago'), { target: { files: [new File(['%PDF-1.4 QA'], 'recibo-prueba.pdf', { type: 'application/pdf' })] } });
    expect(row).toHaveTextContent('recibo-prueba.pdf');
    expect(row).toHaveTextContent('Seleccionado para revisión');
    expect(row).not.toHaveTextContent('Guardado');
    expect(screen.getByText('En prueba los archivos no se conservan al salir.')).toBeVisible();
    const filesHelp = screen.getByText('PDF, JPG o PNG · hasta 10 MB').closest('details')!;
    expect(filesHelp.open).toBe(false);
    // JSDOM does not perform the native summary toggle; the cloud E2E clicks it.
    fireEvent.click(screen.getByText('PDF, JPG o PNG · hasta 10 MB'));
    expect(screen.getByText(/La prueba no consulta recibos de otros usuarios/)).toBeInTheDocument();
    await waitFor(() => expect(requests.preview).toHaveBeenCalledOnce());
    expect(requests.preview.mock.calls[0][1]).toBe('COMPROBANTE_PAGO');
    await waitFor(() => expect(within(row).getByText('Ver texto leído del recibo')).toBeVisible());
    expect(requests.uploadDocumento).not.toHaveBeenCalled();
    expect(requests.put).not.toHaveBeenCalled();
    expect(requests.post).not.toHaveBeenCalled();
  });
  it.each(['', '/app'])('preserves a licence reading between fleet and documents and retries with the licence profile (%s)', async prefix => {
    const analysis = {version:1,duplicado:false,lectura:'NO_DISPONIBLE',texto:'',motor:null,alcance:'Licencia',aviso:'Lectura ocupada. Tu archivo sigue seleccionado.'};
    requests.preview.mockResolvedValue({persistido:false,campos:{},analisis:analysis});
    await openReview('transportista', prefix);
    fireEvent.click(screen.getByRole('button',{name:'Paso 3 de 5: Flota y choferes'}));
    await act(async()=>{fireEvent.change(screen.getByLabelText('Archivo de licencia del chofer 1'),{target:{files:[new File(['QA'],'licencia.png',{type:'image/png'})]}});});
    expect(requests.preview).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button',{name:'Paso 4 de 5: Documentos'}));
    const row=screen.getByText('licencia.png').closest('[data-testid]')!;
    expect(row).toHaveTextContent('Lectura ocupada');
    await act(async()=>{fireEvent.click(within(row as HTMLElement).getByRole('button',{name:'Reintentar lectura'}));});
    expect(requests.preview).toHaveBeenCalledTimes(2);
    expect(requests.preview.mock.calls[1][1]).toBe('LICENCIA');
    expect(requests.preview.mock.calls[1][0]).toBe(requests.preview.mock.calls[0][0]);
    expect(requests.uploadDocumento).not.toHaveBeenCalled();
  });
  it.each(['', '/app'])('announces repeated reads, preserves prior evidence on retry failure, and clears it for replacement (%s)', async prefix => {
    requests.getRequirements.mockResolvedValue({documentos:[{tipo:'FACTURA_ELECTRICA',nombre:'Factura eléctrica',required:false}],maxBytes:10485760});
    const partial = {version:1,lectura:'LEIDO',texto:'LECTURA ORIGINAL QA',documentKind:'FACTURA_ELECTRICA',electricidad:{version:1,distribuidora:'EDESTE',nombreDistribuidora:'EDESTE',campos:{categoriaTarifaria:'T2',consumoKwh:'420'},conflictos:[],evidencias:[],aviso:''}};
    requests.preview.mockResolvedValue({persistido:false,analisis:partial});
    await openReview('generador', prefix);
    fireEvent.click(screen.getByRole('button',{name:'Paso 6 de 7: Documentos'}));
    const row=screen.getByTestId('registration-document-FACTURA_ELECTRICA');
    fireEvent.click(within(row).getByRole('button',{name:'Adjuntar'}));
    await act(async()=>{fireEvent.change(screen.getByLabelText('Adjuntar Factura eléctrica'),{target:{files:[new File(['QA'],'uno.pdf',{type:'application/pdf'})]}});});
    const outcome='Lectura terminada con datos por revisar. Consultá los campos pendientes o en conflicto debajo.';
    expect(within(row).getByText(outcome)).toHaveAttribute('role','status');
    expect(row).not.toHaveTextContent('Adjuntá la factura completa');
    let finish!: (value: unknown)=>void;
    requests.preview.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    fireEvent.click(within(row).getByRole('button',{name:'Reintentar lectura'}));
    expect(within(row).queryByText(outcome)).toBeNull();
    expect(within(row).getByRole('button',{name:'Leyendo documento…'})).toBeDisabled();
    await act(async()=>{finish({persistido:false,analisis:partial});});
    expect(within(row).getByText(outcome)).toBeVisible();
    requests.preview.mockRejectedValueOnce(new Error('Lectura QA interrumpida'));
    await act(async()=>{fireEvent.click(within(row).getByRole('button',{name:'Reintentar lectura'}));});
    expect(within(row).queryByText(outcome)).toBeNull();
    expect(within(row).getByText('LECTURA ORIGINAL QA')).toBeInTheDocument();
    expect(within(row).getByRole('alert')).toHaveTextContent('Lectura QA interrumpida');
    // A different file must never inherit the first file's OCR result.
    requests.preview.mockRejectedValueOnce(new Error('Nuevo archivo ilegible'));
    await act(async()=>{fireEvent.change(screen.getByLabelText('Adjuntar Factura eléctrica'),{target:{files:[new File(['QA2'],'dos.pdf',{type:'application/pdf'})]}});});
    expect(within(row).queryByText('LECTURA ORIGINAL QA')).toBeNull();
    expect(within(row).getByText('dos.pdf')).toBeVisible();
    expect(within(row).getByRole('alert')).toHaveTextContent('Nuevo archivo ilegible');
    expect(requests.uploadDocumento).not.toHaveBeenCalled(); expect(requests.put).not.toHaveBeenCalled(); expect(requests.post).not.toHaveBeenCalled();
  });

});
