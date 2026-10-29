import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {activeTripKey,clearTripSnapshot,readActiveTrip,readInitialTripStatus,readTripSnapshot,readTripStatus,tripAccessDenied,tripSnapshotKey,tripStatusKey,writeTripSnapshot} from '../../services/tripSnapshot';

beforeEach(()=>localStorage.clear());
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();});

it('keeps the saved trip and pause state isolated by complete context',()=>{
 const first='account:transport:company-a',second='account:transport:company-b';
 writeTripSnapshot(first,'trip',{id:'trip',numero:'QA-A'});
 localStorage.setItem(tripStatusKey(first,'trip'),'PAUSADO');
 expect(readActiveTrip(first)).toBe('trip');expect(readTripSnapshot(first,'trip')).toMatchObject({numero:'QA-A'});
 expect(readActiveTrip(second)).toBeNull();expect(readTripSnapshot(second,'trip')).toBeNull();expect(readTripStatus(second,'trip')).toBeNull();
 expect(readTripStatus(first,'trip')).toBe('PAUSADO');
});

it('does not read an older unscoped or mismatched snapshot',()=>{
 localStorage.setItem('viaje_snapshot_trip',JSON.stringify({id:'trip',numero:'QA-LEGACY'}));
 localStorage.setItem(tripSnapshotKey('owner','trip'),JSON.stringify({id:'other',numero:'QA-OTHER'}));
 expect(readTripSnapshot('owner','trip')).toBeNull();expect(readActiveTrip('owner')).toBeNull();
});

it('preserves legacy pauses without accepting an unscoped active state over the current pause',()=>{
 const owner='account:transport:company-a';
 localStorage.setItem('viaje_status_trip','PAUSADO');
 expect(readInitialTripStatus(owner,'trip')).toBe('PAUSADO');
 localStorage.setItem(tripStatusKey(owner,'trip'),'ACTIVO');
 expect(readInitialTripStatus(owner,'trip')).toBe('ACTIVO');
 localStorage.setItem('viaje_status_trip','ACTIVO');
 localStorage.setItem(tripStatusKey(owner,'trip'),'PAUSADO');
 expect(readInitialTripStatus(owner,'trip')).toBe('PAUSADO');
 expect(readInitialTripStatus('','trip')).toBe('PAUSADO');
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('storage unavailable');});
 expect(readInitialTripStatus(owner,'trip')).toBe('PAUSADO');
});

it('clears only the delivered trip in its own context',()=>{
 writeTripSnapshot('a','trip',{id:'trip'});writeTripSnapshot('b','trip',{id:'trip'});
 clearTripSnapshot('a','trip');
 expect(readTripSnapshot('a','trip')).toBeNull();expect(readActiveTrip('a')).toBeNull();
 expect(readTripSnapshot('b','trip')).not.toBeNull();expect(localStorage.getItem(activeTripKey('b'))).toBe('trip');
});

it('treats explicit authorization and missing-record responses as unavailable',()=>{
 for(const status of [401,403,404])expect(tripAccessDenied({response:{status}})).toBe(true);
 for(const error of [new Error('offline'),{response:{status:500}},null])expect(tripAccessDenied(error)).toBe(false);
});
