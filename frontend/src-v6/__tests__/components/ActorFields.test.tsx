import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActorAddressFields, ActorContactFields } from '../../components/registration/ActorFields';

function Addresses({ initial }: { initial: Record<string, string> }) {
  const [form, setForm] = useState(initial);
  return <ActorAddressFields form={form} up={(key, value) => setForm(previous => ({ ...previous, [key]: value }))} />;
}
describe('shared registration fields help only at the point of need', () => {
  it('reuses a declared address only on request and leaves the copy editable', () => {
    render(<Addresses initial={{ domicilio: 'QA Ruta 1', domicilioLegalLocalidad: 'QA Localidad' }} />);
    const legal = within(screen.getByRole('region', { name: 'Domicilio legal' }));
    expect(legal.getByLabelText('Calle')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Usar domicilio declarado' }));
    expect(legal.getByLabelText('Calle')).toHaveValue('QA Ruta 1');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar domicilio legal' }));
    const real = within(screen.getByRole('region', { name: 'Domicilio real' }));
    expect(real.getByLabelText('Calle')).toHaveValue('QA Ruta 1');
    expect(real.getByLabelText('Localidad')).toHaveValue('QA Localidad');
    fireEvent.change(real.getByLabelText('Calle'), { target: { value: 'QA Planta 2' } });
    expect(legal.getByLabelText('Calle')).toHaveValue('QA Ruta 1');
    expect(real.getByLabelText('Calle')).toHaveValue('QA Planta 2');
  });
  it('never offers to replace a distinct existing address or locality', () => {
    render(<Addresses initial={{ domicilio: 'QA base', domicilioLegalCalle: 'QA legal', domicilioRealLocalidad: 'QA planta' }} />);
    expect(screen.queryByRole('button', { name: 'Usar domicilio declarado' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copiar domicilio legal' })).toBeNull();
  });
  it('has no copy action when there is no source address', () => {
    render(<Addresses initial={{}} />); expect(screen.queryByRole('button', { name: /domicilio/ })).toBeNull();
  });
  it.each([false, true])('shows malformed email at its field after an attempt (admin=%s)', administrative => {
    const props = { form: { email: 'bad-email', emailContacto: 'bad-email' }, up: () => {}, administrative };
    const view = render(<ActorContactFields {...props} />);
    const email = screen.getByLabelText(administrative ? 'Email *' : 'Email de contacto');
    expect(email).not.toHaveAttribute('aria-invalid', 'true');
    view.rerender(<ActorContactFields {...props} attempted />);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Revisá el formato del email.');
  });
});
