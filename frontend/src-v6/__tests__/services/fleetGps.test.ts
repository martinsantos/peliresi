import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({post:vi.fn(),manifest:vi.fn(),relay:vi.fn()}));
vi.mock('../../services/api',()=>({api:{post:mocks.post}}));
vi.mock('../../services/manifiesto.service',()=>({manifiestoService:{actualizarUbicacion:mocks.manifest}}));
vi.mock('../../services/limited-transport-gps',()=>({limitedLegRequest:mocks.relay}));
import {fleetGpsService,type FleetGpsLoad} from '../../services/fleet-gps.service';
const point={latitud:-33,longitud:-69,precision:10,velocidad:2,direccion:90};
const reference='1949916e-22df-4dc1-9d1e-98f98a3eab26';
const base={key:'a',id:'manifest',numero:'QA',origen:'QA',destino:'QA',fechaInicio:null,referenciaTiempo:'',patente:null,puedeEntregar:true,gpsDisponible:true} satisfies Omit<FleetGpsLoad,'kind'>;
beforeEach(()=>{vi.resetAllMocks();mocks.manifest.mockResolvedValue(undefined);mocks.relay.mockResolvedValue({});});
it('passes the retry reference to the versioned manifest GPS contract',async()=>{
  await fleetGpsService.send({...base,kind:'MANIFIESTO'},point,new Map(),reference);
  expect(mocks.manifest).toHaveBeenCalledWith('manifest',-33,-69,2,90,reference);expect(mocks.relay).not.toHaveBeenCalled();
});
it('passes the same reference to the authorised replacement GPS contract',async()=>{
  mocks.post.mockResolvedValue({data:{data:{acceso:'synthetic-leg-token'}}});
  const credentials=new Map<string,string>();
  await fleetGpsService.send({...base,kind:'RELEVO'},point,credentials,reference);
  expect(mocks.relay).toHaveBeenCalledWith('manifest','synthetic-leg-token',point,reference);
  expect(credentials.get('a')).toBe('synthetic-leg-token');
});
