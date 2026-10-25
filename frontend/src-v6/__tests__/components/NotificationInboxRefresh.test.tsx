import {beforeEach,expect,it,vi} from 'vitest';
import {act,render,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {NotificacionesPoller} from '../../components/NotificacionesPoller';
const mocks=vi.hoisted(()=>({add:vi.fn(()=> 'toast-id'),remove:vi.fn(),list:vi.fn()}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'g',rol:'GENERADOR'},isRestricted:false})}));
vi.mock('../../hooks/usePushNotifications',()=>({usePushNotifications:()=>({})}));
vi.mock('../../services/notificacion.service',()=>({notificacionService:{list:mocks.list}}));
vi.mock('../../components/ui/Toast',()=>({toast:{add:mocks.add,remove:mocks.remove}}));
beforeEach(() => vi.clearAllMocks());
it('a newly received certificate refreshes an open inbox and unread badge without re-polling or marking it read',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const initial={items:[{id:'existing',createdAt:'2026-10-24T12:00:00.000Z',titulo:'Aviso anterior'}],noLeidas:6};
 mocks.list.mockResolvedValue(initial);
 const view=render(<MemoryRouter><QueryClientProvider client={client}><NotificacionesPoller/></QueryClientProvider></MemoryRouter>);
 await waitFor(()=>expect(mocks.list).toHaveBeenCalledTimes(1));await waitFor(()=>expect(client.getQueryData(['notificaciones','poll','g'])).toEqual(initial));
 expect(mocks.add).not.toHaveBeenCalled();
 const spy=vi.spyOn(client,'invalidateQueries');
 client.setQueryData(['notificaciones','poll','g'],{items:[{id:'new',createdAt:'2026-10-24T12:01:00.000Z',titulo:'Certificación parcial disponible',mensaje:'M-P01',prioridad:'NORMAL',manifiestoId:'m',datos:JSON.stringify({tipo:'certificado_manifiesto',version:1,documentoId:'c',tipoCertificado:'PARCIAL'})}],noLeidas:1});
 await waitFor(()=>expect(spy).toHaveBeenCalledWith({queryKey:['notificaciones','list']}));
 expect(spy).toHaveBeenCalledWith({queryKey:['notificaciones','no-leidas']});expect(spy).toHaveBeenCalledWith({queryKey:['manifest-certificates']});
 expect(spy).toHaveBeenCalledWith({queryKey:['notificaciones','bell']});
 expect(spy).not.toHaveBeenCalledWith({queryKey:['notificaciones','poll','g']});
 expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({title:'Certificación parcial disponible',actionLabel:'Ver certificación y descargar →'}));
 view.unmount();client.clear();
});


it('does not announce an older unread notice exposed after reading the first page, but still announces new events once', async () => {
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const notices=Array.from({length:20},(_,index)=>({id:'old-'+index,titulo:'Anterior '+index,createdAt:new Date(Date.parse('2026-10-24T12:00:00Z')-index*60000).toISOString()}));
 mocks.list.mockResolvedValue({items:notices,noLeidas:35});
 const view=render(<MemoryRouter><QueryClientProvider client={client}><NotificacionesPoller/></QueryClientProvider></MemoryRouter>);
 await waitFor(()=>expect(client.getQueryData(['notificaciones','poll','g'])).toBeDefined());
 const older={id:'old-20',titulo:'Anterior fuera de página',createdAt:'2026-10-24T11:40:00Z'};
 await act(async()=>{client.setQueryData(['notificaciones','poll','g'],{items:[...notices.slice(1),older],noLeidas:34});});
 expect(mocks.add).not.toHaveBeenCalled();
 const fresh={id:'fresh',titulo:'Requerimiento nuevo',createdAt:'2026-10-24T12:01:00Z',datos:JSON.stringify({tipo:'intercambio_inspeccion',version:1,inspeccionId:'own',destino:'participacion'})};
 await act(async()=>{client.setQueryData(['notificaciones','poll','g'],{items:[fresh,...notices.slice(1,20)],noLeidas:35});});
 await waitFor(()=>expect(mocks.add).toHaveBeenCalledTimes(1));
 expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({title:'Requerimiento nuevo',actionLabel:'Consultar requerimiento y estado →'}));
 await act(async()=>{client.setQueryData(['notificaciones','poll','g'],{items:[fresh,...notices.slice(2),older],noLeidas:34});});
 expect(mocks.add).toHaveBeenCalledTimes(1);
 view.unmount();client.clear();
});

it('announces concurrent notices with the same server timestamp after an empty inbox', async () => {
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 mocks.list.mockResolvedValue({items:[],noLeidas:0});
 const view=render(<MemoryRouter><QueryClientProvider client={client}><NotificacionesPoller/></QueryClientProvider></MemoryRouter>);
 await waitFor(()=>expect(client.getQueryData(['notificaciones','poll','g'])).toBeDefined());
 const first={id:'first',titulo:'Primero',createdAt:'2026-10-24T12:00:00Z'};
 const second={...first,id:'second',titulo:'Segundo'};
 await act(async()=>{client.setQueryData(['notificaciones','poll','g'],{items:[first],noLeidas:1});});
 await waitFor(()=>expect(mocks.add).toHaveBeenCalledTimes(1));
 await act(async()=>{client.setQueryData(['notificaciones','poll','g'],{items:[second,first],noLeidas:2});});
 await waitFor(()=>expect(mocks.add).toHaveBeenCalledTimes(2));
 view.unmount();client.clear();
});
