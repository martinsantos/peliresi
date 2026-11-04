import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
const mock = vi.hoisted(() => ({ user: { id: 'qa', rol: 'OPERADOR', esInspector: false, actorId: 'qa-actor' as string | undefined } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mock.user }) }));
vi.mock('../../components/SupportReportDialog', () => ({ SupportEntry: () => null }));
import WorkflowDiagram from '../../components/docs/WorkflowDiagram';
import AyudaPage from '../../pages/ayuda/AyudaPage';
afterEach(() => cleanup());
it('distinguishes three-party proposals, legacy drafts and explicit certificate issuance', () => {
 render(<WorkflowDiagram />);
 expect(screen.getByText(/En origen también aprueban generador, transporte y operador/)).toBeVisible();
 expect(screen.getByText(/sin viaje ni GPS/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Pendiente de aprobación',exact:true}));
 expect(screen.getByText(/cada parte confirma desde su propia cuenta/)).toBeVisible();
 expect(screen.getByText('(Generador + Transporte + Operador)')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Aprobado',exact:true}));
 expect(screen.getByRole('button',{name:'Aprobado',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(screen.getByText(/Tres aprobaciones completas en ambas modalidades/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Tratado',exact:true}));
 expect(screen.getByText(/emite el certificado final por separado/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Rechazado',exact:true}));
 expect(screen.getByText(/Una parte rechazó su participación o el operador rechazó la carga/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Borrador',exact:true}));
 expect(screen.getByText('Firma anterior (si está habilitada)')).toBeVisible();
});

it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('orients %s to a notified requirement without offering the inspection module', rol => {
 mock.user.rol=rol;mock.user.esInspector=false;mock.user.actorId='qa-actor';
 render(<MemoryRouter basename="/app" initialEntries={['/app/ayuda']}><AyudaPage /></MemoryRouter>);
 expect(screen.queryByRole('button',{name:'¿Dónde inicio una inspección?'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'¿Cómo respondo un requerimiento?'}));
 expect(screen.getByText(/Abrí el aviso recibido desde la campana o Avisos/)).toBeVisible();
 expect(screen.getByRole('link',{name:/Responder un requerimiento desde Avisos/})).toHaveAttribute('href','/manual/tutorial.html?guide=actor-mis-inspecciones');
 expect(screen.getByRole('link',{name:/Mis tickets de soporte/})).toHaveAttribute('href','/app/soporte');
 expect(screen.queryByText('Guías PDF')).not.toBeInTheDocument();
 expect(screen.queryByText('Videos tutoriales')).not.toBeInTheDocument();
 expect(!!screen.queryByRole('button',{name:'¿Cómo agrego un vehículo a mi flota?'})).toBe(rol==='TRANSPORTISTA');
 if(rol==='TRANSPORTISTA'){
  fireEvent.change(screen.getByRole('textbox',{name:'Buscar en la ayuda'}),{target:{value:'GPS'}});
  fireEvent.click(screen.getByRole('button',{name:'¿Qué hago si el GPS falla durante el viaje?'}));
  const answer=screen.getByText(/en el detalle del viaje revisá la hora de la última sincronización/);
  expect(answer).toHaveTextContent('En el detalle del viaje o en GPS de mis viajes, usá Reintentar GPS si aparece.');
  expect(answer).toHaveTextContent('Al reconectar, revisá los puntos pendientes y la confirmación del envío');
  expect(answer).toHaveTextContent('No se garantiza conservar todas las lecturas durante una desconexión.');
  expect(answer).toHaveTextContent('conservá este dispositivo y consultá a soporte antes de entregar.');
  expect(answer).toHaveTextContent('Administración puede consultar la posición recibida en Monitor, que puede ser anterior.');
  expect(answer).not.toHaveTextContent('Los puntos pendientes se reenvían al recuperar conexión');
 }
});

it('offers the inspection guide and workflow to an administrator', () => {
 mock.user.rol='ADMIN';mock.user.esInspector=false;
 render(<MemoryRouter initialEntries={['/ayuda']}><AyudaPage /></MemoryRouter>);
 expect(screen.getByRole('button',{name:'¿Dónde inicio una inspección?'})).toBeVisible();
 expect(screen.getByRole('link',{name:/Inspecciones, plazos y requerimientos/})).toHaveAttribute('href','/manual/tutorial.html?guide=psip-flujo-inspecciones');
 expect(screen.queryByRole('button',{name:'¿Cómo respondo un requerimiento?'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'¿Cómo creo un nuevo manifiesto?'}));
 expect(screen.getByText(/transporte aprobador/)).toHaveTextContent('aunque no haya viaje ni GPS');
});

it('does not offer an actor requirement to an inspector without a linked actor', () => {
 mock.user.rol='GENERADOR';mock.user.esInspector=true;mock.user.actorId=undefined;
 render(<MemoryRouter><AyudaPage /></MemoryRouter>);
 expect(screen.getByRole('button',{name:'¿Dónde inicio una inspección?'})).toBeVisible();
 expect(screen.queryByRole('button',{name:'¿Cómo respondo un requerimiento?'})).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:/Inspecciones, plazos y requerimientos/})).toBeVisible();
});

it('updates help when the active role changes without carrying the prior section', () => {
 mock.user.rol='GENERADOR';mock.user.esInspector=false;mock.user.actorId='qa-actor';
 const view=()=> <MemoryRouter><AyudaPage /></MemoryRouter>;
 const rendered=render(view());
 fireEvent.click(screen.getByRole('button',{name:'¿Cómo respondo un requerimiento?'}));
 expect(screen.getByText(/Abrí el aviso recibido desde la campana o Avisos/)).toBeVisible();
 mock.user.rol='ADMIN';rendered.rerender(view());
 expect(screen.queryByRole('button',{name:'¿Cómo respondo un requerimiento?'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'¿Dónde inicio una inspección?'})).toBeVisible();
 expect(screen.queryByText(/Abrí el aviso recibido desde la campana o Avisos/)).not.toBeInTheDocument();
});
