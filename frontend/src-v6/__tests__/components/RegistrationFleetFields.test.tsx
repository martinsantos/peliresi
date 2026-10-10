import { useState } from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RegistrationFleetFields } from '../../components/registration/RegistrationFleetFields';
import { EMPTY_DRIVER, type DriverDraft } from '../../services/registrationFleet';
import type { LicensePreview } from '../../services/documentPreview';

const read: LicensePreview = { analisis: { version: 1, duplicado: false, lectura: 'LEIDO', motor: 'TESSERACT', texto: 'QA licence', alcance: 'Imagen.', aviso: null }, campos: { nombre: 'JUAN', apellido: 'PEREZ', dni: '30123456', licencia: 'QA-001', vencimiento: '2027-12-31' }, persistido: false };
function Form({ onLicense, initialName = '' }: { onLicense: (key: string, file: File) => Promise<LicensePreview>; initialName?: string }) {
  const [drivers, setDrivers] = useState<DriverDraft[]>([{ ...EMPTY_DRIVER, key: 'driver-qa-001', nombre: initialName }]);
  return <RegistrationFleetFields vehicles={[]} drivers={drivers} onDrivers={setDrivers} onVehicles={() => undefined} section="drivers" onLicense={onLicense} />;
}
const photo = new File(['QA'], 'license.png', { type: 'image/png' });
describe('one structured driver control across public and administrative creation', () => {
  it('explains a partial reading and lets the person complete it without losing the safe proposal', async () => {
    render(<Form onLicense={vi.fn().mockResolvedValue({ ...read, campos: { dni: '30123456' }, analisis: { ...read.analisis, aviso: 'Lectura parcial. Revisá las propuestas y completá manualmente los campos que falten.' } })} />);
    fireEvent.change(screen.getByLabelText('Archivo de licencia del chofer 1'), { target: { files: [photo] } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Lectura parcial'));
    fireEvent.click(screen.getByRole('button', { name: 'Usar datos seleccionados' }));
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'QA completado a mano' } });
    expect(screen.getByLabelText('DNI *')).toHaveValue('30123456');
    expect(screen.getByLabelText('Nombre *')).toHaveValue('QA completado a mano');
  });
  it('does not replace current data until the user reviews and applies selected OCR proposals', async () => {
    const reader = vi.fn().mockResolvedValue(read); render(<Form onLicense={reader} initialName="Nombre propio" />);
    fireEvent.change(screen.getByLabelText('Archivo de licencia del chofer 1'), { target: { files: [photo] } });
    await screen.findByText('Revisá los datos leídos');
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Nombre propio'); expect(screen.getByLabelText('DNI *')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Usar datos seleccionados' }));
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Nombre propio'); expect(screen.getByLabelText('DNI *')).toHaveValue('30123456');
    expect(screen.getByLabelText('Licencia')).toHaveValue('QA-001'); expect(screen.getByLabelText('Vencimiento *')).toHaveValue('2027-12-31');
    expect(reader).toHaveBeenCalledWith('driver-qa-001', photo);
  });
  it('protects typing during a pending OCR and blocks duplicate reading', async () => {
    let finish!: (value: LicensePreview) => void;
    const reader = vi.fn(() => new Promise<LicensePreview>(resolve => { finish = resolve; })); render(<Form onLicense={reader} />);
    const input = screen.getByLabelText('Archivo de licencia del chofer 1');
    fireEvent.change(input, { target: { files: [photo] } }); fireEvent.change(input, { target: { files: [photo] } });
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'QA edición durante OCR' } });
    await act(async () => finish(read)); fireEvent.click(screen.getByRole('button', { name: 'Usar datos seleccionados' }));
    expect(reader).toHaveBeenCalledOnce(); expect(screen.getByLabelText('Nombre *')).toHaveValue('QA edición durante OCR');
  });
  it('keeps manual fields usable after a failed read', async () => {
    render(<Form onLicense={vi.fn().mockRejectedValue(new Error('QA lectura no disponible'))} />);
    fireEvent.change(screen.getByLabelText('Archivo de licencia del chofer 1'), { target: { files: [photo] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('QA lectura no disponible'));
    fireEvent.change(screen.getByLabelText('DNI *'), { target: { value: '30123456' } }); expect(screen.getByLabelText('DNI *')).toHaveValue('30123456');
  });
  it('rejects unsupported files before any analysis call', async () => {
    const reader = vi.fn(); render(<Form onLicense={reader} />);
    fireEvent.change(screen.getByLabelText('Archivo de licencia del chofer 1'), { target: { files: [new File(['QA'], 'bad.html', { type: 'text/html' })] } });
    await screen.findByRole('alert'); expect(reader).not.toHaveBeenCalled();
  });
  it('adds and removes individual drivers without changing another driver', () => {
    render(<Form onLicense={vi.fn()} initialName="QA original" />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar', exact: true }));
    const second = screen.getByRole('group', { name: 'Chofer 2', exact: true });
    fireEvent.change(within(second).getByLabelText('Nombre *'), { target: { value: 'QA nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar chofer 1' }));
    expect(screen.getByLabelText('Nombre *')).toHaveValue('QA nuevo');
  });
});
