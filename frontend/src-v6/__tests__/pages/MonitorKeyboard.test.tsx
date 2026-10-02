import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({navigate:vi.fn(),refetch:vi.fn(),error:false,updated:1700000000000}));
vi.mock('react-router-dom',async()=>({...await vi.importActual('react-router-dom'),useNavigate:()=>state.navigate}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:null})}));
vi.mock('../../hooks/useInspectionOperations',()=>({useInspectionOperations:()=>({data:null,isError:false,isPending:false})}));
vi.mock('../../pages/monitor/hooks/useWarRoomData',()=>({useWarRoomData:()=>({data:{actores:{generadores:[],transportistas:[],operadores:[]}},isError:state.error,isPending:false,isFetching:false,dataUpdatedAt:state.updated,refetch:state.refetch})}));
vi.mock('../../pages/monitor/hooks/useForecast',()=>({useForecast:()=>({data:null,isError:false,isPending:false,refetch:vi.fn()})}));
vi.mock('../../pages/monitor/hooks/useMonitorTimeline',()=>({useMonitorTimeline:()=>({data:null,isError:false,isPending:false,refetch:vi.fn()})}));
vi.mock('../../pages/monitor/api/monitor-api',()=>({fetchActiveDays:async()=>[],fetchTimeline:vi.fn()}));
vi.mock('../../pages/monitor/components/WarRoomMap',()=>({WarRoomMap:()=>null}));
vi.mock('../../pages/monitor/components/DashboardPanels',()=>({DashboardPanels:()=>null}));
vi.mock('../../pages/monitor/components/DepartureBoard',()=>({DepartureBoard:()=>null}));
vi.mock('../../pages/monitor/components/TimelineControls',()=>({TimelineControls:()=>null}));
import WarRoomPage from '../../pages/monitor/WarRoomPage';
const mount=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><WarRoomPage/></QueryClientProvider>);
beforeEach(()=>{state.error=false;state.updated=1700000000000;vi.clearAllMocks();});
afterEach(cleanup);
it('no roba Espacio a los botones ni flechas a los controles de formulario',()=>{
  mount();
  for(const tag of ['button','textarea','select']){
    const element=document.createElement(tag);document.body.append(element);
    for(const key of [' ','ArrowRight','ArrowLeft','c']){
      const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});
      element.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);
    }
    element.remove();
  }
});
it('en vivo no bloquea el desplazamiento nativo con Espacio o flechas',()=>{
  mount();for(const key of [' ','ArrowRight','ArrowLeft']){
    const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});
    document.body.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);
  }
});
it('no anuncia actualización vigente después de un error y permite reintentar',()=>{
  state.error=true;mount();
  expect(screen.getByRole('status')).toHaveTextContent('Sin actualizar');
  fireEvent.click(screen.getByRole('button',{name:'Actualizar datos del Monitor'}));
  expect(state.refetch).toHaveBeenCalledOnce();
});
it('volver tiene destino de SITREP también desde un enlace directo',()=>{
  mount();fireEvent.click(screen.getByRole('button',{name:/Cerrar/}));
  expect(state.navigate).toHaveBeenCalledWith('/centro-control');
});
