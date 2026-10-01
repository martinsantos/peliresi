import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/ButtonV2';
import { Select } from '../../components/ui/Select';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';

describe('shared controls: stable and accessible interaction', () => {
  it('treats a provided error as invalid and preserves additional field guidance', () => {
    render(<><p id="format">Once dígitos</p><Input label="CUIT" errorMessage="Revisá el CUIT" aria-describedby="format" /></>);
    expect(screen.getByLabelText('CUIT')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('CUIT')).toHaveAccessibleDescription('Once dígitos Revisá el CUIT');
  });

  it('closes only the open selector on Escape, preserving the surrounding form', () => {
    const close = vi.fn();
    render(<Modal isOpen onClose={close} title="Nuevo usuario"><Input label="Nombre" defaultValue="María" /><Select label="Rol" onChange={vi.fn()} options={[{ value: 'OPERADOR', label: 'Operador' }]} /></Modal>);
    fireEvent.click(screen.getByLabelText('Rol'));
    fireEvent.keyDown(screen.getByRole('option'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre')).toHaveValue('María');
    expect(screen.getByLabelText('Rol')).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText('Rol'), { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('lets only the top dialog handle Escape and retains the body lock', () => {
    const parentClose = vi.fn();
    const childClose = vi.fn();
    const { rerender, unmount } = render(<><Modal isOpen title="Principal" onClose={parentClose}>Formulario</Modal><Modal isOpen title="Confirmación" onClose={childClose}>Detalle</Modal></>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(childClose).toHaveBeenCalledTimes(1);
    expect(parentClose).not.toHaveBeenCalled();
    rerender(<><Modal isOpen={false} title="Principal" onClose={parentClose}>Formulario</Modal><Modal isOpen title="Confirmación" onClose={childClose}>Detalle</Modal></>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('keeps a nested dialog above its parent even with child-first effect order', () => {
    const parentClose = vi.fn();
    const childClose = vi.fn();
    render(<Modal isOpen title="Principal" onClose={parentClose}><Modal isOpen title="Anidado" onClose={childClose}>Detalle</Modal></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(childClose).toHaveBeenCalledTimes(1);
    expect(parentClose).not.toHaveBeenCalled();
  });

  it('shows a confirmation once and prevents dismissal or duplicate submission while processing', () => {
    const close = vi.fn();
    const confirm = vi.fn();
    render(<ConfirmModal isOpen isLoading title="Eliminar registro" description="Esta acción no se puede deshacer." onClose={close} onConfirm={confirm} />);
    expect(screen.getAllByText('Esta acción no se puede deshacer.')).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: /Procesando/ }));
    expect(close).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
  });

  it('offers keyboard sorting and does not navigate a row when its own action is used', () => {
    const sort = vi.fn();
    const open = vi.fn();
    const edit = vi.fn();
    render(<Table data={[{ id: 'one', nombre: 'Registro' }]} keyExtractor={row => row.id} onRowClick={open} sortable onSort={sort} columns={[
      { key: 'nombre', header: 'Nombre', sortable: true },
      { key: 'acciones', header: 'Acciones', render: () => <button type="button" onClick={edit}>Editar</button> },
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Nombre' }));
    expect(sort).toHaveBeenCalledWith('nombre', 'asc');
    expect(screen.getByRole('columnheader', { name: /Nombre/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(edit).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByText('Registro').closest('tr')!, { key: 'Enter' });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does not offer an impossible next page or an inverted range on an empty result', () => {
    const change = vi.fn();
    render(<Pagination currentPage={1} totalPages={0} totalItems={0} itemsPerPage={25} onPageChange={change} />);
    expect(screen.getByText('0-0')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(change).not.toHaveBeenCalled();
  });

  it('bounds the selection column and preserves selections from other pages', () => {
    const change = vi.fn();
    const { rerender } = render(<Table data={[{ id: 'one', nombre: 'Registro' }]} keyExtractor={row => row.id} selectable fixedLayout selectedKeys={['another-page']} onSelectionChange={change} columns={[{ key: 'nombre', header: 'Nombre' }]} />);
    const all = screen.getByRole('checkbox', { name: 'Seleccionar todos los registros de esta página' });
    expect(all.closest('th')).toHaveClass('w-12');
    fireEvent.click(all);
    expect(change).toHaveBeenLastCalledWith(['another-page', 'one']);
    rerender(<Table data={[{ id: 'one', nombre: 'Registro' }]} keyExtractor={row => row.id} selectable fixedLayout selectedKeys={['another-page', 'one']} onSelectionChange={change} columns={[{ key: 'nombre', header: 'Nombre' }]} />);
    fireEvent.click(all);
    expect(change).toHaveBeenLastCalledWith(['another-page']);
  });

  it('keeps checkbox selection separate from row navigation', () => {
    const change = vi.fn();
    const open = vi.fn();
    render(<Table data={[{ id: 'one', nombre: 'Registro' }]} keyExtractor={row => row.id} selectable onSelectionChange={change} onRowClick={open} columns={[{ key: 'nombre', header: 'Nombre' }]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar registro 1' }));
    expect(change).toHaveBeenCalledWith(['one']);
    expect(open).not.toHaveBeenCalled();
  });
  it('preserves input identity and connects its error after rerender', () => {
    const { rerender } = render(<Input label="CUIT" />);
    const id = screen.getByLabelText('CUIT').id;
    rerender(<Input label="CUIT" state="error" errorMessage="Revisá el CUIT" />);
    expect(screen.getByLabelText('CUIT')).toHaveAttribute('id', id);
    expect(screen.getByLabelText('CUIT')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('CUIT')).toHaveAccessibleDescription('Revisá el CUIT');
  });

  it('prevents a loading action from being submitted twice', () => {
    const action = vi.fn();
    render(<Button isLoading onClick={action}>Guardar</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('navigates tabs by keyboard, skips disabled tabs and does not submit the form', () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(<form onSubmit={submit}><Tabs defaultTab="one"><TabList>
      <Tab id="one">Uno</Tab><Tab id="two" disabled>Dos</Tab><Tab id="three">Tres</Tab>
    </TabList><TabPanel id="one">Primer panel</TabPanel><TabPanel id="three">Tercer panel</TabPanel></Tabs></form>);
    const one = screen.getByRole('tab', { name: 'Uno' });
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowRight' });
    const three = screen.getByRole('tab', { name: 'Tres' });
    expect(three).toHaveFocus();
    expect(three).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', three.id);
    fireEvent.click(three);
    expect(submit).not.toHaveBeenCalled();
  });

  it('labels selectors and makes clearing a separate reachable action', () => {
    const change = vi.fn();
    render(<Select label="Estado" value="pending" options={[{ value: 'pending', label: 'Pendiente' }]} clearable onChange={change} />);
    expect(screen.getByLabelText('Estado')).toHaveAttribute('aria-haspopup', 'listbox');
    const clear = screen.getByRole('button', { name: 'Limpiar Estado' });
    expect(clear.closest('button')?.parentElement?.closest('button')).toBeNull();
    fireEvent.click(clear);
    expect(change).toHaveBeenCalledWith('');
    expect(screen.getByLabelText('Estado')).toHaveFocus();
  });

  it('opens a selector by keyboard and selects an enabled option', () => {
    const change = vi.fn();
    render(<Select label="Actor" options={[{ value: 'old', label: 'Inactivo', disabled: true }, { value: 'new', label: 'Generador' }]} onChange={change} />);
    fireEvent.keyDown(screen.getByLabelText('Actor'), { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeVisible();
    const option = screen.getByRole('option', { name: 'Generador' });
    expect(option).toHaveFocus();
    fireEvent.click(option);
    expect(change).toHaveBeenCalledWith('new');
    expect(screen.getByLabelText('Actor')).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
