import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acknowledgeFleetGpsPoint, assertNoStoredFleetGpsForManifest, readFleetGpsPoints, saveFleetGpsPoint, type FleetStoredPoint } from '../../services/fleetGpsStorage';

const scope=(owner:string, id='trip')=>JSON.stringify([owner,'MANIFIESTO:'+id]);
const point=(targetKey:string,puntoId:string,observedAt=1000):FleetStoredPoint=>({targetKey,puntoId,observedAt,point:{latitud:-33,longitud:-69,precision:10,velocidad:2}});
const first='1949916e-22df-4dc1-9d1e-98f98a3eab26', second='3a999c28-2e6a-4fd0-9127-777a7db7af3e';
beforeEach(()=>localStorage.clear());
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

it('keeps separate, ordered records per observation and account until each is acknowledged',()=>{
  const a=point(scope('account-a'),first,2000),b=point(scope('account-a'),second),other=point(scope('account-b'),first);
  saveFleetGpsPoint(a);saveFleetGpsPoint(b);saveFleetGpsPoint(other);
  expect(readFleetGpsPoints(scope('account-a'))).toEqual([b,a]);
  expect(readFleetGpsPoints(scope('account-b'))).toEqual([other]);
  expect(JSON.stringify(localStorage)).not.toMatch(/Bearer|access_token/);
  acknowledgeFleetGpsPoint(b);
  expect(readFleetGpsPoints(scope('account-a'))).toEqual([a]);expect(readFleetGpsPoints(scope('account-b'))).toEqual([other]);
});

it('retains invalid records and refuses both recovery and a matching transition',()=>{
  const item=point(scope('account-a'),first);saveFleetGpsPoint(item);
  const key=localStorage.key(0)!;localStorage.setItem(key,'{invalid');
  expect(()=>readFleetGpsPoints(item.targetKey)).toThrow(/almacenamiento/i);
  expect(()=>assertNoStoredFleetGpsForManifest('trip')).toThrow(/sin confirmar/i);
  expect(localStorage.getItem(key)).toBe('{invalid');
  expect(()=>assertNoStoredFleetGpsForManifest('another-trip')).not.toThrow();
});

it('does not replace or remove a different value using an existing reference',()=>{
  const item=point(scope('account-a'),first);saveFleetGpsPoint(item);
  const conflict={...item,point:{...item.point,latitud:-34}};
  expect(()=>saveFleetGpsPoint(conflict)).toThrow();expect(()=>acknowledgeFleetGpsPoint(conflict)).toThrow();
  expect(readFleetGpsPoints(item.targetKey)).toEqual([item]);
});

it('reports storage failures instead of presenting an empty or saved queue',()=>{
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  expect(()=>saveFleetGpsPoint(point(scope('account-a'),first))).toThrow(/almacenamiento/i);
  vi.restoreAllMocks();
  const inaccessible=new Proxy(localStorage,{ownKeys(){throw new Error('storage unavailable');}});
  vi.stubGlobal('localStorage',inaccessible);
  expect(()=>readFleetGpsPoints(scope('account-a'))).toThrow(/almacenamiento/i);
  expect(()=>assertNoStoredFleetGpsForManifest('trip')).toThrow(/almacenamiento/i);
});
