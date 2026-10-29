import {afterEach,expect,it,vi} from 'vitest';
import {limitedLegRequest} from '../../services/limited-transport-gps';

const point={latitud:-33,longitud:-69,precision:8};
const reference='1949916e-22df-4dc1-9d1e-98f98a3eab26';
afterEach(()=>vi.unstubAllGlobals());

it('requires the server to confirm the exact retry reference without sending cookies',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({success:true,data:{tracking:{timestamp:'2026-10-29T00:00:00Z'},idempotencia:{version:1,puntoId:reference,repetido:true}}})});
  vi.stubGlobal('fetch',fetchMock);
  await expect(limitedLegRequest('leg','token',point,reference)).resolves.toMatchObject({idempotencia:{puntoId:reference,repetido:true}});
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][0]).toContain('/seguimiento-relevo/leg/ubicacion-idempotente');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({...point,puntoId:reference});
});

it('does not treat an old or mismatched response as confirmation or fall back to the legacy endpoint',async()=>{
  const fetchMock=vi.fn()
    .mockResolvedValueOnce({ok:true,status:200,json:async()=>({success:true,data:{tracking:{id:'old'}}})})
    .mockResolvedValueOnce({ok:true,status:200,json:async()=>({success:true,data:{idempotencia:{version:1,puntoId:'another'}}})})
    .mockResolvedValueOnce({ok:false,status:404,json:async()=>({message:'No encontrado'})});
  vi.stubGlobal('fetch',fetchMock);
  await expect(limitedLegRequest('leg','token',point,reference)).rejects.toThrow('no confirmó');
  await expect(limitedLegRequest('leg','token',point,reference)).rejects.toThrow('no confirmó');
  await expect(limitedLegRequest('leg','token',point,reference)).rejects.toMatchObject({status:503});
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls.every(([url])=>String(url).endsWith('/ubicacion-idempotente'))).toBe(true);
});
