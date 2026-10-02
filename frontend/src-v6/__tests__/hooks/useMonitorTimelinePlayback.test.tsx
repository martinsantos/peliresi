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
});
