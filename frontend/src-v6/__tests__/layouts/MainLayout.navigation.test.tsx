import {render,screen,within,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {MainLayout} from '../../layouts/MainLayout';
const authState=vi.hoisted(()=>({rol:'ADMIN',esInspector:false,training:false}));
const attention=vi.hoisted(()=>({support:0,applicationPending:0}));
vi.mock('../../hooks/useAttentionCounts',()=>({useAttentionCounts:()=>attention}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'qa',training:authState.training,rol:authState.rol,esInspector:authState.esInspector,nombre:'QA',email:'qa@example.invalid',avatar:'QA',permisos:[]},isAdmin:authState.rol==='ADMIN',isAdminGenerador:authState.rol==='ADMIN_GENERADOR',isAdminOperador:authState.rol==='ADMIN_OPERADOR',isAdminTransportista:authState.rol==='ADMIN_TRANSPORTISTA',isLoading:false,canAccess:()=>true,logout:vi.fn()})}));
vi.mock('../../contexts/ImpersonationContext',()=>({useImpersonation:()=>({impersonationData:null,exitImpersonation:vi.fn()})}));
vi.mock('../../components/GlobalSearchPanel',()=>({GlobalSearchPanel:()=>null}));
vi.mock('../../components/NotificationBell',()=>({NotificationBell:()=>null}));
vi.mock('../../components/NotificacionesPoller',()=>({NotificacionesPoller:()=>null}));
vi.mock('../../components/ConnectivityIndicator',()=>({ConnectivityIndicator:()=>null}));
vi.mock('../../components/SWUpdateBanner',()=>({SWUpdateBanner:()=>null}));
vi.mock('../../components/OnboardingTour',()=>({OnboardingTour:()=>null,resetOnboardingTour:vi.fn()}));
vi.mock('../../components/DemoAppOnboarding',()=>({DemoAppOnboarding:()=>null}));
vi.mock('../../components/ui/Toast',()=>({ToastContainer:()=>null}));
vi.mock('../../components/ui/UserSwitcher',()=>({UserSwitcher:()=>null}));
function show(path:string){render(<MemoryRouter initialEntries={[path]}><MainLayout/></MemoryRouter>);}
describe('Sidebar: one visible current destination',()=>{
  it.each(['generadores','transportistas','operadores'])('keeps %s creation help in the header',kind=>{
    show('/admin/actores/'+kind+'/nuevo');
    const help=screen.getByRole('button',{name:'Ayuda y soporte técnico',exact:true});
    expect(help.closest('header')).toBe(screen.getByRole('banner'));
    expect(help.parentElement).not.toHaveClass('fixed');
  });
  beforeEach(()=>{authState.rol='ADMIN';authState.esInspector=false;authState.training=false;attention.support=0;attention.applicationPending=0;});
  it.each(['button','Escape'])('closes the compact menu with %s and restores keyboard focus without leaving the page',method=>{
    show('/dashboard');
    const trigger=screen.getByRole('button',{name:'Abrir menú',exact:true});
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded','true');
    const close=screen.getByRole('button',{name:'Cerrar menú',exact:true});close.focus();
    if(method==='Escape')fireEvent.keyDown(document,{key:'Escape'});else fireEvent.click(close);
    expect(trigger).toHaveAttribute('aria-expanded','false');
    expect(trigger).toHaveFocus();
    expect(within(screen.getByRole('banner')).getByRole('heading',{name:'Inicio',exact:true})).toBeVisible();
  });
  it('identifies direct classroom sessions without an operational return or role switch',()=>{
    authState.training=true;show('/dashboard');
    expect(screen.getByRole('status',{name:'Modo capacitación'})).toHaveTextContent('Capacitación · sin validez oficial');
    expect(screen.queryByText('Volver a mi cuenta')).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:'Ver como otro usuario'})).not.toBeInTheDocument();
  });
  it('puts server-backed work counts on their actionable section links',()=>{
    attention.support=7;attention.applicationPending=26;show('/admin/solicitudes');
    expect(screen.getByLabelText('7 pendientes de atender').closest('a')).toHaveAttribute('href','/soporte');
    expect(screen.getByLabelText('26 pendientes de atender').closest('a')).toHaveAttribute('href','/admin/solicitudes');
  });
  it.each(['ADMIN_GENERADOR','ADMIN_OPERADOR','ADMIN_TRANSPORTISTA'])('provides the authorized registration desk for %s without a hidden-route dead end',rol=>{
    authState.rol=rol;
    show('/admin/solicitudes');
    expect(screen.getByRole('link',{name:'Solicitudes de inscripción',exact:true})).toHaveAttribute('href','/admin/solicitudes');
    expect(screen.getByRole('link',{name:'Solicitudes de inscripción',exact:true})).toHaveAttribute('aria-current','page');
    expect(screen.queryByRole('link',{name:'Usuarios',exact:true})).not.toBeInTheDocument();
  });
  it('exposes contextual technical help without requiring navigation to the desk',()=>{
    show('/inspecciones/qa-expediente');
    expect(screen.getByRole('button',{name:'Ayuda y soporte técnico',exact:true})).toBeVisible();
    expect(within(screen.getByRole('banner')).getByRole('heading',{name:'Inspección',exact:true})).toBeVisible();
    expect(screen.getByRole('button',{name:'Buscar en SITREP',exact:true})).toHaveClass('w-11','lg:w-52');
    expect(screen.getByRole('button',{name:'Ayuda y soporte técnico',exact:true}).closest('header')).toBe(screen.getByRole('banner'));
    expect(screen.getByRole('button',{name:'Ayuda y soporte técnico',exact:true}).parentElement).not.toHaveClass('fixed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('identifies the inspection function without changing the base actor role',()=>{
    authState.rol='GENERADOR';authState.esInspector=true;
    show('/inspecciones/qa-expediente');
    const badge=within(screen.getByRole('banner')).getByLabelText('Función actual');
    expect(badge).toHaveTextContent(/^Inspector$/);
    expect(badge).toHaveAttribute('title','Rol base: GENERADOR');
    expect(authState.rol).toBe('GENERADOR');
  });
  it.each(['/dashboard','/manifiestos','/transporte/perfil','/manifiestos/nuevo','/manifiestos/qa-record','/transporte/viaje/qa-trip','/manifiestos/qa-record/adendas','/app/manifiestos/qa-record/adendas','/mobile/manifiestos/qa-record/adendas'])('keeps help in the header, not over manifest controls on %s',path=>{
    show(path);
    const help=screen.getByRole('button',{name:'Ayuda y soporte técnico',exact:true});
    expect(help.closest('header')).toBe(screen.getByRole('banner'));
    expect(help.parentElement).not.toHaveClass('fixed');
    expect(screen.queryByRole('button',{name:'Ver tour de ayuda',exact:true})).not.toBeInTheDocument();
  });
  it('keeps the base role outside the inspection workspace',()=>{
    authState.rol='GENERADOR';authState.esInspector=true;
    show('/mis-inspecciones/qa-expediente');
    expect(within(screen.getByRole('banner')).getByRole('heading',{name:'Requerimiento',exact:true})).toBeVisible();
    expect(screen.getByRole('button',{name:'Ayuda y soporte técnico',exact:true}).closest('header')).toBe(screen.getByRole('banner'));
    expect(within(screen.getByRole('banner')).getByLabelText('Función actual')).toHaveTextContent(/^Generador$/);
  });
  it.each([
    ['/admin/actores','Actores'],
    ['/admin/actores/generadores','Generadores'],
    ['/admin/actores/generadores/qa-actor','Generadores'],
    ['/admin/actores/operadores/qa-actor','Operadores'],
    ['/admin/actores/transportistas/qa-actor','Transportistas'],
  ])('keeps only the most specific link current on %s',(path,label)=>{
    show(path);
    const sidebar=document.querySelector('aside')!;
    const current=sidebar.querySelectorAll('a[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
    expect(current[0]).toHaveClass('bg-white/20', 'text-white', 'hover:text-white');
    if(label!=='Actores')expect(within(sidebar).getByRole('link',{name:'Actores',exact:true})).not.toHaveClass('bg-white/20');
  });
  it('keeps the section label on a detail route instead of the generic product title',()=>{
    show('/admin/actores/generadores/qa-actor');
    expect(within(screen.getByRole('banner')).getByText('Ficha del generador')).toBeVisible();
  });
  it('retains Manifiestos as the current section when consulting a linked ficha',()=>{
    render(<MemoryRouter initialEntries={[{pathname:'/admin/actores/generadores/qa',state:{actorReturn:'/manifiestos/m-qa'}}]}><MainLayout/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'Manifiestos',exact:true})).toHaveAttribute('aria-current','page');
    expect(within(screen.getByRole('banner')).getByRole('heading',{name:'Ficha del generador'})).toBeVisible();
    expect(document.querySelectorAll('aside a[aria-current="page"]')).toHaveLength(1);
  });
  it('provides stable hover/focus and a 44px touch target without animating geometry',()=>{
    show('/admin/actores/generadores');
    const link=screen.getByRole('link',{name:'Generadores',exact:true});
    expect(link).toHaveClass('min-h-11','transition-colors','focus-visible:outline-2');
    expect(link).not.toHaveClass('transition-all');
  });
  it.each([
    ['/centro-control','Centro de control'],
    ['/admin/actores/generadores','Generadores'],
    ['/inspecciones','Inspecciones'],
  ])('constrains the header without losing its full accessible title on %s',(path,label)=>{
    show(path);
    const header=screen.getByRole('banner');
    const title=within(header).getByRole('heading',{name:label,exact:true});
    expect(header).toHaveClass('h-16','shrink-0','min-w-0');
    expect(title).toHaveClass('min-w-0','whitespace-normal','break-words','sm:truncate');
    expect(title).toHaveAttribute('title',label);
    expect(title.parentElement).toHaveClass('min-w-0','flex-1');
    const help=within(header).getByRole('button',{name:path.startsWith('/admin/actores')?'Ayuda y soporte técnico':'Ver tour de ayuda',exact:true});
    expect(help).toHaveClass('h-11','w-11');
    expect(help.parentElement).toHaveClass('shrink-0');
  });
});
describe('Header names pages that are not in the side menu',()=>{
  beforeEach(()=>{authState.rol='GENERADOR';authState.esInspector=false;});
  it.each([['/configuracion','Configuración'],['/mi-perfil/solicitar-cambios','Mi perfil'],['/mobile/notificaciones','Avisos'],['/estadisticas','Estadísticas']])('%s is titled %s instead of SITREP',(path,title)=>{
    show(path);
    expect(within(screen.getByRole('banner')).getByRole('heading',{name:title,exact:true})).toBeVisible();
  });
});


it('closes the compact menu and account menu when navigating to the profile',()=>{
  show('/dashboard');
  fireEvent.click(screen.getByRole('button',{name:'Abrir menú',exact:true}));
  fireEvent.click(screen.getByRole('button',{name:'Mi Cuenta qa@example.invalid'}));
  fireEvent.click(screen.getByRole('link',{name:'Mi perfil',exact:true}));
  expect(screen.getByRole('button',{name:'Abrir menú',exact:true})).toHaveAttribute('aria-expanded','false');
  expect(screen.queryByRole('link',{name:'Mi perfil',exact:true})).not.toBeInTheDocument();
});
