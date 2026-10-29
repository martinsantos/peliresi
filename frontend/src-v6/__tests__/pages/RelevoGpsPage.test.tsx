import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('react-router-dom',()=>({useParams:()=>({tramoId:'leg-qa'})}));
import RelevoGpsPage from '../../pages/transporte/RelevoGpsPage';
let success:PositionCallback;const clearWatch=vi.fn();
const info={tramoId:'leg-qa',numero:'QA-001',empresa:'Auxilio artificial',destino:'Planta QA',domicilioDestino:'QA 100',orden:1,training:true,ultimaPosicion:null,vence:'2099-01-01'};
beforeEach(()=>{
  sessionStorage.clear();history.replaceState({},'','/relevo/leg-qa#qa-limited-token');
  vi.stubGlobal('fetch',vi.fn(async(_url:string,options:RequestInit)=>({ok:true,status:200,json:async()=>({success:true,data:options.method==='POST'?{tracking:{timestamp:new Date().toISOString()},idempotencia:{version:1,puntoId:JSON.parse(options.body as string).puntoId,repetido:false}}:info})})));
  vi.stubGlobal('navigator',{geolocation:{watchPosition:vi.fn((ok:PositionCallback)=>{success=ok;return 17;}),clearWatch}});clearWatch.mockClear();
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('starts only by explicit tap, acknowledges actual uploads, and stops its watcher on exit',async()=>{
  const view=render(<RelevoGpsPage/>);await screen.findByText('Auxilio artificial');expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();expect(location.hash).toBe('');
  fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación'}));
  await waitFor(()=>expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce());
  const coords={latitude:-32.8,longitude:-68.8,accuracy:10,speed:0,heading:null};
  await act(async()=>success({coords,timestamp:Date.now()} as GeolocationPosition));
  expect(await screen.findByRole('status')).toHaveTextContent('Ubicación recibida por SITREP');
  const call=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST')!;
  expect(call[1]).toMatchObject({credentials:'omit',cache:'no-store',headers:expect.objectContaining({Authorization:'Bearer qa-limited-token'})});
  expect(JSON.parse(call[1]!.body as string)).toMatchObject({latitud:-32.8,longitud:-68.8});view.unmount();expect(clearWatch).toHaveBeenCalledWith(17);
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
