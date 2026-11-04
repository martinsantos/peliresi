import {it,expect} from 'vitest';
import {transportTrackSegments} from '../../utils/transportTrackSegments';
it('preserves legacy GPS and separates handoff boundaries without inventing continuity',()=>{
  const point=(n:number,tramoId?:string)=>({latitud:n,longitud:n,tramoId});
  expect(transportTrackSegments([point(1),point(2),point(3,'new'),point(4,'new'),point(5,'next')])).toEqual([[[1,1],[2,2]],[[3,3],[4,4]],[[5,5]]]);
  expect(transportTrackSegments([])).toEqual([]);
});
