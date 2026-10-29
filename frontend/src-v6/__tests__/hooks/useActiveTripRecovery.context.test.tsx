import {act,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {readActiveTrip,readTripSnapshot,writeTripSnapshot} from '../../services/tripSnapshot';

const mock=vi.hoisted(()=>({owner:'company-a',list:vi.fn()}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'same-account',rol:'TRANSPORTISTA'},isTransportista:true,isRestricted:false})}));
vi.mock('../../hooks/useQueryOwner',()=>({useQueryOwner:()=>mock.owner}));
vi.mock('../../services/manifiesto.service',()=>({manifiestoService:{list:mock.list}}));
import {useActiveTripRecovery} from '../../hooks/useActiveTripRecovery';

beforeEach(()=>{localStorage.clear();mock.owner='company-a';mock.list.mockReset();});

it('does not save a previous company response after the active context changes',async()=>{
 let finish!: (value:unknown)=>void;
 mock.list.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 mock.list.mockResolvedValueOnce({items:[{id:'trip-b',numero:'QA-B',estado:'EN_TRANSITO'}],total:1});
 const hook=renderHook(()=>useActiveTripRecovery());
 await waitFor(()=>expect(mock.list).toHaveBeenCalledTimes(1));
 mock.owner='company-b';hook.rerender();
 await waitFor(()=>expect(readActiveTrip('company-b')).toBe('trip-b'));
 await act(async()=>{finish({items:[{id:'trip-a',numero:'QA-A',estado:'EN_TRANSITO'}],total:1});});
 expect(readActiveTrip('company-a')).toBeNull();expect(readTripSnapshot('company-b','trip-a')).toBeNull();
 expect(readTripSnapshot('company-b','trip-b')).toMatchObject({numero:'QA-B'});
 hook.unmount();
});

it('does not let a saved trip in another company prevent recovery for this one',async()=>{
 writeTripSnapshot('company-a','trip-a',{id:'trip-a',estado:'EN_TRANSITO'});mock.owner='company-b';
 mock.list.mockResolvedValue({items:[{id:'trip-b',numero:'QA-B',estado:'EN_TRANSITO'}],total:1});
 const hook=renderHook(()=>useActiveTripRecovery());
 await waitFor(()=>expect(readActiveTrip('company-b')).toBe('trip-b'));
 expect(readActiveTrip('company-a')).toBe('trip-a');hook.unmount();
});
