import {render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {MainLayout} from '../../layouts/MainLayout';
const authState=vi.hoisted(()=>({rol:'ADMIN',esInspector:false}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'qa',rol:authState.rol,esInspector:authState.esInspector,nombre:'QA',email:'qa@example.invalid',avatar:'QA',permisos:[]},isAdmin:authState.rol==='ADMIN',isLoading:false,canAccess:()=>true,logout:vi.fn()})}));
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
  beforeEach(()=>{authState.rol='ADMIN';authState.esInspector=false;});
  it('exposes contextual technical help without requiring navigation to the desk',()=>{
    show('/inspecciones/qa-expediente');
    expect(screen.getByRole('button',{name:'Ayuda y soporte técnico',exact:true})).toBeVisible();
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
  it('keeps the base role outside the inspection workspace',()=>{
    authState.rol='GENERADOR';authState.esInspector=true;
    show('/mis-inspecciones/qa-expediente');
    expect(within(screen.getByRole('banner')).getByLabelText('Función actual')).toHaveTextContent(/^GENERADOR$/);
  });
  it.each([
    ['/admin/actores','Actores'],
    ['/admin/actores/generadores','Admin Generadores'],
    ['/admin/actores/generadores/qa-actor','Admin Generadores'],
    ['/admin/actores/operadores/qa-actor','Admin Operadores'],
    ['/admin/actores/transportistas/qa-actor','Admin Transporte'],
  ])('keeps only the most specific link current on %s',(path,label)=>{
    show(path);
    const sidebar=document.querySelector('aside')!;
    const current=sidebar.querySelectorAll('a[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
    expect(current[0]).toHaveClass('bg-white/20');
    if(label!=='Actores')expect(within(sidebar).getByRole('link',{name:'Actores',exact:true})).not.toHaveClass('bg-white/20');
  });
  it('keeps the section label on a detail route instead of the generic product title',()=>{
    show('/admin/actores/generadores/qa-actor');
    expect(within(screen.getByRole('banner')).getByText('Admin Generadores')).toBeVisible();
  });
  it('provides stable hover/focus and a 44px touch target without animating geometry',()=>{
    show('/admin/actores/generadores');
    const link=screen.getByRole('link',{name:'Admin Generadores',exact:true});
    expect(link).toHaveClass('min-h-11','transition-colors','focus-visible:outline-2');
    expect(link).not.toHaveClass('transition-all');
  });
  it.each([
    ['/centro-control','Centro de Control'],
    ['/admin/actores/generadores','Admin Generadores'],
    ['/inspecciones','Inspecciones'],
  ])('constrains the header without losing its full accessible title on %s',(path,label)=>{
    show(path);
    const header=screen.getByRole('banner');
    const title=within(header).getByRole('heading',{name:label,exact:true});
    expect(header).toHaveClass('h-16','shrink-0','min-w-0');
    expect(title).toHaveClass('min-w-0','whitespace-normal','break-words','sm:truncate');
    expect(title).toHaveAttribute('title',label);
    expect(title.parentElement).toHaveClass('min-w-0','flex-1');
    const help=within(header).getByRole('button',{name:'Ver tour de ayuda',exact:true});
    expect(help).toHaveClass('h-11','w-11','shrink-0');
    expect(help.parentElement).toHaveClass('shrink-0');
  });
});
