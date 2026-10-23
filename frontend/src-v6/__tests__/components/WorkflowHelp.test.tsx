import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it } from 'vitest';
import WorkflowDiagram from '../../components/docs/WorkflowDiagram';
it('distinguishes three-party proposals, legacy drafts and explicit certificate issuance', () => {
 render(<WorkflowDiagram />);
 fireEvent.click(screen.getByRole('button',{name:'Pendiente de aprobación',exact:true}));
 expect(screen.getByText(/cada parte confirma desde su propia cuenta/)).toBeVisible();
 expect(screen.getByText('(Generador + Transporte + Operador)')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Tratado',exact:true}));
 expect(screen.getByText(/emite el certificado final por separado/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Rechazado',exact:true}));
 expect(screen.getByText(/Una parte rechazó su participación o el operador rechazó la carga/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Borrador',exact:true}));
 expect(screen.getByText('Firmar borrador anterior')).toBeVisible();
});
