import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import { installMockGpsLocks } from '../utils/mockGpsLocks';
vi.mock('react-router-dom',()=>({useParams:()=>({tramoId:'leg-qa'})}));
import RelevoGpsPage from '../../pages/transporte/RelevoGpsPage';
let success:PositionCallback;let failGps:PositionErrorCallback;const clearWatch=vi.fn();
let restoreLocks:()=>void;
const access=`header.${btoa(JSON.stringify({jti:'1949916e-22df-4dc1-9d1e-98f98a3eab26'}))}.signature`;
const info={tramoId:'leg-qa',numero:'QA-001',empresa:'Auxilio artificial',destino:'Planta QA',domicilioDestino:'QA 100',orden:1,training:true,ultimaPosicion:null,vence:'2099-01-01'};
const confirmReceipt=(sent:any)=>vi.mocked(fetch).mockImplementation(async(url,options)=>{
  if(String(url).includes('/confirmacion')){
    const {latitud,longitud,precision,velocidad=null,direccion=null,puntoId}=sent;
    return {ok:true,status:200,json:async()=>({success:true,data:{idempotencia:{version:1,puntoId,confirmado:true},tracking:{latitud,longitud,precision,velocidad,direccion}}})} as Response;
  }
  if(options?.method==='POST')throw new Error('Un punto confirmado no debe reenviarse');
  return {ok:true,status:200,json:async()=>({success:true,data:info})} as Response;
});
beforeEach(()=>{
  sessionStorage.clear();localStorage.clear();history.replaceState({},'',`/relevo/leg-qa#${access}`);
  vi.stubGlobal('fetch',vi.fn(async(_url:string,options:RequestInit)=>({ok:true,status:200,json:async()=>({success:true,data:options.method==='POST'?{tracking:{timestamp:new Date().toISOString()},idempotencia:{version:1,puntoId:JSON.parse(options.body as string).puntoId,repetido:false}}:info})})));
  vi.stubGlobal('navigator',{geolocation:{watchPosition:vi.fn((ok:PositionCallback,fail:PositionErrorCallback)=>{success=ok;failGps=fail;return 17;}),clearWatch}});clearWatch.mockClear();
  restoreLocks=installMockGpsLocks();
});
afterEach(()=>{restoreLocks();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();});
it('starts only by explicit tap, acknowledges actual uploads, and stops its watcher on exit',async()=>{
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();expect(location.hash).toBe('');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  const coords={latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null};
  await act(async()=>success({coords,timestamp:Date.now()} as GeolocationPosition));
  expect(await screen.findByRole('status')).toHaveTextContent('Ubicación recibida por SITREP');
  const call=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST')!;
  expect(call[1]).toMatchObject({credentials:'omit',cache:'no-store',headers:expect.objectContaining({Authorization:'Bearer '+access})});
  expect(JSON.parse(call[1]!.body as string)).toMatchObject({latitud:-32.8,longitud:-68.8});view.unmount();expect(clearWatch).toHaveBeenCalledWith(17);
});
it('does not keep a green recent status after the sensor stops or the captured fix ages',async()=>{
  let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  const coords={latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null};
  await act(async()=>success({coords,timestamp:now} as GeolocationPosition));
  expect(await screen.findByRole('status')).toHaveTextContent('Ubicación recibida por SITREP');
  now+=61_000;view.rerender(<RelevoGpsPage/>);
  expect(screen.getByRole('status')).toHaveTextContent('Última ubicación sin actualización reciente');
  await act(async()=>failGps({code:1} as GeolocationPositionError));
  expect(screen.getByRole('status')).toHaveTextContent('GPS sin ubicación');
  expect(screen.getByRole('alert')).toHaveTextContent('Permití la ubicación');
  view.unmount();
});
it('shows a revoked access without trying to acquire location',async()=>{
  vi.mocked(fetch).mockResolvedValue({ok:false,status:403,json:async()=>({message:'Este seguimiento ya no está activo'})} as Response);
  render(<RelevoGpsPage/>);expect(await screen.findByRole('alert')).toHaveTextContent('ya no está activo');expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();expect(sessionStorage.getItem('sitrep-relevo:leg-qa')).toBeNull();
});
it('does not send an older callback after a newer replacement position',async()=>{
  let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  const coords={latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null};
  await act(async()=>success({coords,timestamp:now} as GeolocationPosition));
  await screen.findByText('Ubicación recibida por SITREP');
  now+=30_000;
  await act(async()=>success({coords:{...coords,latitude:-34},timestamp:now-31_000} as GeolocationPosition));
  const calls=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST');
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0][1]!.body as string)).toMatchObject({latitud:-32.8});
  view.unmount();
});
it('does not resend the same received fix but does send a new reading',async()=>{
  let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  const coords={latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null},captured=now;
  await act(async()=>success({coords,timestamp:captured} as GeolocationPosition));
  await screen.findByText('Ubicación recibida por SITREP');
  now+=30_000;
  await act(async()=>success({coords,timestamp:captured} as GeolocationPosition));
  expect(vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
  await act(async()=>success({coords:{...coords,latitude:-32.9},timestamp:now} as GeolocationPosition));
  const calls=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST');
  expect(calls).toHaveLength(2);
  expect(JSON.parse(calls[1][1]!.body as string)).toMatchObject({latitud:-32.9});
  view.unmount();
});
it('retries a failed replacement upload for the same fix',async()=>{
  let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
  const fetchMock=vi.mocked(fetch);
  fetchMock.mockImplementationOnce(async()=>({ok:true,status:200,json:async()=>({data:info})} as Response))
    .mockImplementationOnce(async()=>({ok:false,status:503,json:async()=>({message:'Sin conexión'})} as Response));
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  const point={coords:{latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null},timestamp:now} as GeolocationPosition;
  await act(async()=>success(point));expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
  now+=30_000;await act(async()=>success(point));
  expect(await screen.findByRole('status')).toHaveTextContent('Ubicación recibida por SITREP');
  expect(fetchMock.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(2);
  view.unmount();
});
it('reuses the same reference after the server accepts a point and its response is lost',async()=>{
  let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
  const fetchMock=vi.mocked(fetch);
  fetchMock.mockImplementationOnce(async()=>({ok:true,status:200,json:async()=>({data:info})} as Response))
    .mockRejectedValueOnce(new Error('Respuesta perdida'));
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  const point={coords:{latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null},timestamp:now} as GeolocationPosition;
  await act(async()=>success(point));expect(await screen.findByRole('alert')).toHaveTextContent('Respuesta perdida');
  now+=30_000;await act(async()=>success(point));
  const calls=fetchMock.mock.calls.filter(([,init])=>init?.method==='POST');
  expect(calls).toHaveLength(2);
  const first=JSON.parse(calls[0][1]!.body as string),retry=JSON.parse(calls[1][1]!.body as string);
  expect(String(calls[0][0])).toContain('/ubicacion-idempotente');
  expect(first.puntoId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(retry.puntoId).toBe(first.puntoId);
  view.unmount();
});
it('recovers the same failed point after reopening the link without persisting its bearer token',async()=>{
  const fetchMock=vi.mocked(fetch);
  fetchMock.mockImplementationOnce(async()=>({ok:true,status:200,json:async()=>({data:info})} as Response))
    .mockRejectedValueOnce(new Error('Respuesta perdida'));
  const first=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  const point={coords:{latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null},timestamp:Date.now()} as GeolocationPosition;
  await act(async()=>success(point));expect(await screen.findByRole('alert')).toHaveTextContent('Respuesta perdida');
  const initial=JSON.parse(fetchMock.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body as string);
  expect(JSON.stringify(localStorage)).not.toContain(access);first.unmount();
  const reopened=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(fetchMock.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(2));
  const retry=JSON.parse(fetchMock.mock.calls.filter(([,init])=>init?.method==='POST')[1][1]!.body as string);
  expect(retry).toEqual(initial);expect(await screen.findByRole('status')).toHaveTextContent('Ubicación recibida');
  reopened.unmount();
});
it('checks and confirms a saved point after a relay authorization is renewed',async()=>{
  const fetchMock=vi.mocked(fetch);
  fetchMock.mockImplementationOnce(async()=>({ok:true,status:200,json:async()=>({data:info})} as Response))
    .mockRejectedValueOnce(new Error('Respuesta perdida'));
  const first=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  await act(async()=>success({coords:{latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null},timestamp:Date.now()} as GeolocationPosition));
  await screen.findByRole('alert');first.unmount();
  const sent=JSON.parse(fetchMock.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body as string);confirmReceipt(sent);
  const rotated=`header.${btoa(JSON.stringify({jti:'3a999c28-2e6a-4fd0-9127-777a7db7af3e'}))}.signature`;
  history.replaceState({},'',`/relevo/leg-qa#${rotated}`);
  const reopened=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('confirmó una ubicación anterior'));
  expect(fetchMock.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
  expect(localStorage.length).toBe(0);reopened.unmount();
});
it('accepts a renewed link opened on the same page without replaying an earlier uncertain point',async()=>{
  const fetchMock=vi.mocked(fetch);
  fetchMock.mockImplementationOnce(async()=>({ok:true,status:200,json:async()=>({data:info})} as Response))
    .mockRejectedValueOnce(new Error('Respuesta perdida'));
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  await act(async()=>success({coords:{latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null},timestamp:Date.now()} as GeolocationPosition));
  await screen.findByRole('alert');
  const sent=JSON.parse(fetchMock.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body as string);confirmReceipt(sent);
  const rotated=`header.${btoa(JSON.stringify({jti:'3a999c28-2e6a-4fd0-9127-777a7db7af3e'}))}.signature`;
  await act(async()=>{history.pushState({},'',`/relevo/leg-qa#${rotated}`);window.dispatchEvent(new HashChangeEvent('hashchange'));});
  await waitFor(()=>expect(sessionStorage.getItem('sitrep-relevo:leg-qa')).toBe(rotated));expect(location.hash).toBe('');
  await screen.findByText('Auxilio artificial');fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('confirmó una ubicación anterior'));
  expect(fetchMock.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
  expect(localStorage.length).toBe(0);view.unmount();
});
it('does not acknowledge an in-flight old-link response after a renewed link is opened',async()=>{
  let finish!:(response:Response)=>void;
  const fetchMock=vi.mocked(fetch).mockImplementation(async(_url,options)=>{
    if(options?.method==='POST')return new Promise<Response>(resolve=>{finish=resolve;});
    return {ok:true,status:200,json:async()=>({data:info})} as Response;
  });
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  await act(async()=>success({coords:{latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null},timestamp:Date.now()} as GeolocationPosition));
  await waitFor(()=>expect(fetchMock.mock.calls.some(([,init])=>init?.method==='POST')).toBe(true));
  const sent=JSON.parse(fetchMock.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body as string);
  const rotated=`header.${btoa(JSON.stringify({jti:'3a999c28-2e6a-4fd0-9127-777a7db7af3e'}))}.signature`;
  await act(async()=>{history.pushState({},'',`/relevo/leg-qa#${rotated}`);window.dispatchEvent(new HashChangeEvent('hashchange'));});
  await waitFor(()=>expect(sessionStorage.getItem('sitrep-relevo:leg-qa')).toBe(rotated));
  await act(async()=>{finish({ok:true,status:200,json:async()=>({success:true,data:{tracking:{timestamp:new Date().toISOString()},idempotencia:{version:1,puntoId:sent.puntoId,repetido:false}}})} as Response);});
  expect(localStorage.length).toBeGreaterThan(0);confirmReceipt(sent);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('confirmó una ubicación anterior'));
  expect(fetchMock.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);view.unmount();
});
it('warns before leaving and retries in the same window when local storage fails',async()=>{
  const storage=Storage.prototype.setItem;let blocked=true;
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key,value){
    if(blocked&&key.startsWith('sitrep_fleet_gps_v1:'))throw new Error('quota');return storage.call(this,key,value);
  });
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  await act(async()=>success({coords:{latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null},timestamp:Date.now()} as GeolocationPosition));
  await screen.findByText('Ubicación GPS sin guardar');
  expect(vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
  const closing=new Event('beforeunload',{cancelable:true});window.dispatchEvent(closing);expect(closing.defaultPrevented).toBe(true);
  blocked=false;fireEvent.click(screen.getByRole('button',{name:'Reintentar envío'}));
  await waitFor(()=>expect(vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1));
  await waitFor(()=>expect(screen.queryByText('Ubicación GPS sin guardar')).toBeNull());
  const safeClose=new Event('beforeunload',{cancelable:true});window.dispatchEvent(safeClose);expect(safeClose.defaultPrevented).toBe(false);
  view.unmount();
});
it('continues sending after the device clock is corrected backwards',async()=>{
  let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  const coords={latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null};
  await act(async()=>success({coords,timestamp:now} as GeolocationPosition));
  await screen.findByText('Ubicación recibida por SITREP');
  now-=60_000;await act(async()=>success({coords:{...coords,latitude:-32.9},timestamp:now} as GeolocationPosition));
  const calls=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST');
  expect(calls).toHaveLength(2);
  expect(JSON.parse(calls[1][1]!.body as string)).toMatchObject({latitud:-32.9});
  view.unmount();
});
