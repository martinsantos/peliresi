import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('react-router-dom',()=>({useParams:()=>({tramoId:'leg-qa'})}));
import RelevoGpsPage from '../../pages/transporte/RelevoGpsPage';
let success:PositionCallback;const clearWatch=vi.fn();
const info={tramoId:'leg-qa',numero:'QA-001',empresa:'Auxilio artificial',destino:'Planta QA',domicilioDestino:'QA 100',orden:1,training:true,ultimaPosicion:null,vence:'2099-01-01'};
beforeEach(()=>{
  sessionStorage.clear();history.replaceState({},'','/relevo/leg-qa#qa-limited-token');
  vi.stubGlobal('fetch',vi.fn(async(_url:string,options:RequestInit)=>({ok:true,status:200,json:async()=>({data:options.method==='POST'?{tracking:{timestamp:new Date().toISOString()}}:info})})));
  vi.stubGlobal('navigator',{geolocation:{watchPosition:vi.fn((ok:PositionCallback)=>{success=ok;return 17;}),clearWatch}});clearWatch.mockClear();
});
afterEach(()=>vi.unstubAllGlobals());
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
