import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PartyApprovalStatus } from '../../components/PartyApprovalStatus';

afterEach(cleanup);
it.each([true, false])('changes only the actor that approved, compact=%s, without redundant badges', compact => {
  const partes = ['GENERADOR','TRANSPORTISTA','OPERADOR'].map(rol => ({ rol, aprobada:false }));
  const { rerender } = render(<PartyApprovalStatus partes={partes} compact={compact}/>);
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  for (const name of ['Generador','Transporte','Operador']) {
    expect(screen.getByLabelText(name+': Pendiente')).toHaveClass('text-neutral-600');
  }
  for (const [index,name] of ['Generador','Transporte','Operador'].entries()) {
    partes[index].aprobada = true;
    rerender(<PartyApprovalStatus partes={[...partes]} compact={compact}/>);
    expect(screen.getByLabelText(name+': Aprobado')).toHaveClass('text-emerald-900');
    expect(screen.queryByLabelText(name+': Pendiente')).not.toBeInTheDocument();
    const row=screen.getByLabelText(name+': Aprobado');
    expect(row).toHaveAttribute('title',name+': Aprobado');
    expect(row.querySelectorAll('svg')).toHaveLength(1);
    expect(within(screen.getByRole('list',{name:'Aprobaciones'})).getAllByRole('listitem')).toHaveLength(3);
  }
});
