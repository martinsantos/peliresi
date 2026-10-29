import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimeline } from '../../pages/monitor/hooks/useTimeline';
import type { TimelineEvent } from '../../pages/monitor/api/monitor-api';
const events:TimelineEvent[]=['CREACION','FIRMA','RETIRO'].map((eventoTipo,index)=>({
  timestamp:new Date(1700000000000+index*1000).toISOString(),type:'EVENTO',eventoTipo,
  manifiestoId:'qa-trip',manifiestoNumero:'QA-0001',descripcion:'QA '+eventoTipo,
}));
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('Historial: velocidad indicada y motor real',()=>{
  it.each([{label:'Rápido',value:100,interval:500},{label:'Normal',value:50,interval:1500},{label:'Lento',value:10,interval:3000}])('$label corresponde al intervalo real entre eventos',({value,interval})=>{
    const {result}=renderHook(()=>useTimeline(events));
    act(()=>result.current.setSpeed(value));act(()=>result.current.play());
    expect(result.current.currentEventIndex).toBe(0);
    act(()=>vi.advanceTimersByTime(interval-1));expect(result.current.currentEventIndex).toBe(0);
    act(()=>vi.advanceTimersByTime(1));expect(result.current.currentEventIndex).toBe(1);
  });
  it('buscar un evento pausa, conserva sus datos y libera todos los timers al salir',()=>{
    const {result,unmount}=renderHook(()=>useTimeline(events));
    act(()=>result.current.play());expect(vi.getTimerCount()).toBe(1);
    act(()=>result.current.seek(1));expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentEvent?.manifiestoNumero).toBe('QA-0001');
    expect(result.current.currentEventIndex).toBe(2);expect(vi.getTimerCount()).toBe(0);
    act(()=>result.current.play());unmount();expect(vi.getTimerCount()).toBe(0);
  });
  const history=(entries:Array<{kind:string;id:string}>)=>entries.map(({kind,id},index):TimelineEvent=>({
    timestamp:new Date(1700000000000+index*1000).toISOString(),type:'EVENTO',eventoTipo:kind,
    manifiestoId:id,manifiestoNumero:id,descripcion:kind,latitud:-32.9,longitud:-68.8,
  }));
  it('un cierre directo desde recibido no cuenta dos veces el mismo manifiesto',()=>{
    const timeline=history([{kind:'RECEPCION',id:'QA-A'},{kind:'CIERRE',id:'QA-A'}]);
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.seek(1));
    expect(result.current.counters.recibido).toBe(0);
    expect(result.current.counters.tratado).toBe(1);
    act(()=>result.current.skipToPrevEvent());
    expect(result.current.counters.recibido).toBe(1);
    expect(result.current.counters.tratado).toBe(0);
  });
  it.each(['CANCELACION','RECHAZO'])('%s retira el viaje y su estado activo del historial',kind=>{
    const timeline=history([{kind:'RETIRO',id:'QA-A'},{kind,id:'QA-A'}]);
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.seek(1));
    expect(result.current.counters.enTransito).toBe(0);
    expect(result.current.activeTrips.has('QA-A')).toBe(false);
    expect(result.current.counters[kind==='CANCELACION'?'cancelado':'rechazado']).toBe(1);
  });
  it('el primer evento del día de un manifiesto no resta el estado de otro',()=>{
    const timeline=history([{kind:'ENTREGA',id:'QA-A'},{kind:'RECEPCION',id:'QA-B'}]);
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.seek(1));
    expect(result.current.counters.entregado).toBe(1);
    expect(result.current.counters.recibido).toBe(1);
  });
  it('un GPS tardío no reactiva un viaje cancelado al avanzar el historial',()=>{
    const timeline=history([{kind:'RETIRO',id:'QA-A'},{kind:'CANCELACION',id:'QA-A'},{kind:'CREACION',id:'QA-B'}]);
    timeline.splice(2,0,{timestamp:new Date(1700000001500).toISOString(),type:'GPS',manifiestoId:'QA-A',manifiestoNumero:'QA-A',descripcion:'GPS tardío',latitud:-32.8,longitud:-68.7});
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.seek(1));
    expect(result.current.activeTrips.has('QA-A')).toBe(false);
    expect(result.current.counters.cancelado).toBe(1);
    expect(result.current.counters.borrador).toBe(1);
  });
  it('reiniciar y saltar diez eventos conserva el mismo estado y ruta que recorrer uno por uno',()=>{
    const timeline=history([{kind:'CREACION',id:'QA-A'},{kind:'RETIRO',id:'QA-A'},{kind:'INCIDENTE',id:'QA-A'}]);
    timeline.splice(2,0,{timestamp:new Date(1700000001500).toISOString(),type:'GPS',manifiestoId:'QA-A',manifiestoNumero:'QA-A',descripcion:'Posición',latitud:-32.8,longitud:-68.7});
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.skipToNextEvent());act(()=>result.current.skipToNextEvent());act(()=>result.current.skipToNextEvent());
    const counters=result.current.counters, trips=result.current.activeTrips;
    expect(trips.get('QA-A')?.lat).toBe(-32.8);
    act(()=>result.current.reset());act(()=>result.current.skipEvents(10));
    expect(result.current.counters).toEqual(counters);expect(result.current.activeTrips).toEqual(trips);
    act(()=>result.current.reset());act(()=>result.current.play());
    expect(result.current.counters.totalCreated).toBe(1);expect(result.current.counters.borrador).toBe(1);
  });
  it('distingue el lugar de retiro de las posiciones GPS recibidas en la secuencia',()=>{
    const timeline=history([{kind:'RETIRO',id:'QA-A'},{kind:'INCIDENTE',id:'QA-A'},{kind:'INCIDENTE',id:'QA-A'}]);
    timeline[0].manifiestoNumero='QA-MANIFIESTO-1';
    timeline.splice(2,0,{timestamp:new Date(1700000001500).toISOString(),type:'GPS',manifiestoId:'QA-A',manifiestoNumero:'QA-MANIFIESTO-1',descripcion:'GPS',latitud:-32.8,longitud:-68.7});
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.skipToNextEvent());
    expect(result.current.activeTrips.get('QA-A')).toMatchObject({numero:'QA-MANIFIESTO-1',gpsCount:0,lastGpsReceivedAt:null,positionSource:'retiro',trail:[]});
    act(()=>result.current.skipToNextEvent());act(()=>result.current.skipToNextEvent());
    expect(result.current.activeTrips.get('QA-A')).toMatchObject({numero:'QA-MANIFIESTO-1',gpsCount:1,lastGpsReceivedAt:timeline[2].timestamp,positionSource:'gps',trail:[[-32.8,-68.7]]});
  });
  it('usa el par completo de coordenadas del generador si falta una coordenada del retiro',()=>{
    const timeline=history([{kind:'RETIRO',id:'QA-A'}]);
    timeline[0].latitud=-32.7; timeline[0].longitud=undefined;
    timeline[0].generador={razonSocial:'QA',lat:-32.9,lng:-68.8};
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.skipToNextEvent());
    expect(result.current.activeTrips.get('QA-A')).toMatchObject({lat:-32.9,lng:-68.8,positionSource:'generador',gpsCount:0});
  });
  it('no inventa un marcador si ninguna fuente tiene un par de coordenadas completo',()=>{
    const timeline=history([{kind:'RETIRO',id:'QA-A'}]);
    timeline[0].latitud=-32.7; timeline[0].longitud=undefined;
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.skipToNextEvent());
    expect(result.current.activeTrips.has('QA-A')).toBe(false);
  });
  it('al avanzar y retroceder cuenta sólo las posiciones GPS recibidas hasta ese evento',()=>{
    const timeline=history([{kind:'RETIRO',id:'QA-A'},{kind:'INCIDENTE',id:'QA-A'},{kind:'INCIDENTE',id:'QA-A'}]);
    timeline.splice(1,0,{timestamp:new Date(1700000000500).toISOString(),type:'GPS',manifiestoId:'QA-A',manifiestoNumero:'QA-A',descripcion:'GPS 1',latitud:-32.8,longitud:-68.7});
    timeline.splice(3,0,{timestamp:new Date(1700000001500).toISOString(),type:'GPS',manifiestoId:'QA-A',manifiestoNumero:'QA-A',descripcion:'GPS 2',latitud:-32.7,longitud:-68.6});
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.seek(1));
    expect(result.current.activeTrips.get('QA-A')).toMatchObject({gpsCount:2,lastGpsReceivedAt:timeline[3].timestamp});
    act(()=>result.current.skipToPrevEvent());
    expect(result.current.activeTrips.get('QA-A')).toMatchObject({gpsCount:1,lastGpsReceivedAt:timeline[1].timestamp});
  });
  it.each([
    ['2026-10-29T15:21:00.000Z',12],
    ['2026-10-29T03:00:00.000Z',0],
    ['2026-10-29T02:59:00.000Z',23],
  ])('muestra la hora %s en Mendoza aunque el navegador use otra zona',(timestamp,hour)=>{
    const timeline=history([{kind:'RETIRO',id:'QA-A'}]);
    timeline[0].timestamp=timestamp;
    const {result}=renderHook(()=>useTimeline(timeline));
    act(()=>result.current.skipToNextEvent());
    expect(result.current.currentHour).toBe(hour);
  });
});
