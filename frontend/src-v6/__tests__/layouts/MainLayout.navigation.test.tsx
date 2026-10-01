import {render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe,it,expect,vi} from 'vitest';
import {MainLayout} from '../../layouts/MainLayout';
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'qa',rol:'ADMIN',nombre:'QA',email:'qa@example.invalid',avatar:'QA',permisos:[]},isAdmin:true,isLoading:false,canAccess:()=>true,logout:vi.fn()})}));
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
});
