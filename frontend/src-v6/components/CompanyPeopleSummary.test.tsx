import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompanyPeopleSummary, type CompanyCapacity } from './CompanyPeopleSummary';

describe('company responsibility remains revocable after an account or role is disabled', () => {
  const capacity: CompanyCapacity = { maximo: 2, ocupados: 1, reservas: [], personas: [{ id:'person', nombre:'QA persona', email:'person@qa.invalid', activo:false, responsable:true, roles:[] }] };
  it('lets a current manager remove an inactive responsibility without granting access again', () => {
    const designate = vi.fn();
    render(<CompanyPeopleSummary capacity={capacity} canDelegate busy={false} designate={designate}/>);
    fireEvent.click(screen.getByRole('button', {name:'Retirar responsabilidad'}));
    expect(designate).toHaveBeenCalledWith('person@qa.invalid', true);
    expect(screen.queryByRole('button', {name:'Designar responsable'})).not.toBeInTheDocument();
  });
  it('never offers a new responsibility to an inactive person', () => {
    render(<CompanyPeopleSummary capacity={{...capacity,personas:[{...capacity.personas[0],responsable:false,roles:['GENERADOR']}]}} canDelegate busy={false} designate={vi.fn()}/>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
