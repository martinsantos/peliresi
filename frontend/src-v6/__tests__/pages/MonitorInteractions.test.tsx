import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WarRoomHeader } from '../../pages/monitor/components/WarRoomHeader';
import { DashboardPanels } from '../../pages/monitor/components/DashboardPanels';
import { EventFeed } from '../../pages/monitor/components/EventFeed';
import { TimelineControls } from '../../pages/monitor/components/TimelineControls';
import { FloatingPanelLayer, useFloatingPanels } from '../../pages/monitor/components/FloatingPanelLayer';
import type { ForecastResponse, MonitorLiveResponse, TimelineResponse } from '../../pages/monitor/api/monitor-api';

const event={id:'qa-event',tipo:'RETIRO',descripcion:'Carga sintética retirada',timestamp:'2026-10-02T12:00:00Z',manifiestoNumero:'QA-00001'};
const forecast:ForecastResponse={pendienteRetiro:[],pendienteTratamiento:[],vencimientosProximos:[]};
beforeEach(()=>localStorage.clear());
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe('Monitor: controles operativos y datos sin simulación',()=>{
  it('nombra los tres modos y expone cuál está seleccionado',()=>{
    const onModeChange=vi.fn();
    render(<WarRoomHeader mode="LIVE" cinemaMode={false} onModeChange={onModeChange} onCinemaToggle={vi.fn()} onClose={vi.fn()}/>);
    expect(screen.getByRole('button',{name:'En vivo',exact:true})).toHaveAttribute('aria-pressed','true');
    fireEvent.click(screen.getByRole('button',{name:'Pendientes',exact:true}));
    expect(onModeChange).toHaveBeenCalledWith('FORECAST');
    expect(screen.getByRole('button',{name:'Historial',exact:true})).toHaveAttribute('aria-pressed','false');
  });
  it('usa la marca vigente, no un icono distinto para Monitor',()=>{
    const {container}=render(<WarRoomHeader mode="LIVE" cinemaMode={false} onModeChange={vi.fn()} onCinemaToggle={vi.fn()} onClose={vi.fn()}/>);
    expect(container.querySelector('img')).toHaveAttribute('src','/favicon.svg');
  });
  it('permite plegar y restaurar un panel por botones identificables',()=>{
    render(<MemoryRouter><DashboardPanels mode="LIVE" liveData={null} forecastData={null}/></MemoryRouter>);
    const toggle=screen.getByRole('button',{name:'Estados del manifiesto',exact:true});
    expect(toggle).toHaveAttribute('aria-expanded','true');
    fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-expanded','false');
    fireEvent.click(screen.getByRole('button',{name:'Ocultar Estados del manifiesto'}));
    expect(screen.queryByRole('button',{name:'Estados del manifiesto',exact:true})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Restaurar Estados del manifiesto'}));
    expect(screen.getByRole('button',{name:'Estados del manifiesto',exact:true})).toHaveAttribute('aria-expanded','true');
  });
  it('no mezcla estados en vivo ni eventos con el modo Pendientes',()=>{
    const live={estadisticas:{porEstado:{EN_TRANSITO:37}},eventosRecientes:[event]} as unknown as MonitorLiveResponse;
    render(<MemoryRouter><DashboardPanels mode="FORECAST" liveData={live} forecastData={forecast}/></MemoryRouter>);
    expect(screen.getByText('Pendiente Retiro (0)')).toBeInTheDocument();
    expect(screen.queryByText('Pipeline')).not.toBeInTheDocument();
    expect(screen.queryByText('Estados del manifiesto')).not.toBeInTheDocument();
    expect(screen.queryByText('Eventos')).not.toBeInTheDocument();
    expect(screen.queryByText('37')).not.toBeInTheDocument();
  });
  it('los retiros y tratamientos pendientes permiten abrir su manifiesto exacto',()=>{
    const data={...forecast,
      pendienteRetiro:[{manifiestoId:'qa-retiro',numero:'QA-RET',generador:'QA Origen',operador:'QA Destino',diasEspera:2}],
      pendienteTratamiento:[{manifiestoId:'qa-tratamiento',numero:'QA-TRAT',operador:'QA Destino',estado:'RECIBIDO',diasEnEspera:1}],
    } as ForecastResponse;
    render(<MemoryRouter><DashboardPanels mode="FORECAST" liveData={null} forecastData={data}/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'Abrir manifiesto QA-RET'})).toHaveAttribute('href','/manifiestos/qa-retiro');
    expect(screen.getByRole('link',{name:'Abrir manifiesto QA-TRAT'})).toHaveAttribute('href','/manifiestos/qa-tratamiento');
  });
  it('abre un evento con teclado sin depender de un div clickeable',async()=>{
    const onEventClick=vi.fn();const user=userEvent.setup();
    render(<EventFeed eventos={[event]} mode="LIVE" onEventClick={onEventClick}/>);
    const target=screen.getByRole('button',{name:'Abrir evento QA-00001: Carga sintética retirada'});
    target.focus();await user.keyboard(' ');
    expect(onEventClick).toHaveBeenCalledOnce();expect(onEventClick).toHaveBeenCalledWith(event);
  });
  it('conserva el ancho del evento seleccionado y elimina tarjetas anidadas',()=>{
    const {container,rerender}=render(<EventFeed eventos={[event]} mode="LIVE" currentEventId="qa-event"/>);
    const row=container.querySelector('.wr-event-item') as HTMLElement;
    expect(container.querySelector('.wr-panel')).toBeNull();
    const active=row.style.borderLeftWidth;
    rerender(<EventFeed eventos={[event]} mode="LIVE"/>);
    expect(row.style.borderLeftWidth).toBe(active);
  });
  it('abre un panel dentro de un teléfono estrecho, no en x=340',()=>{
    vi.spyOn(window,'innerWidth','get').mockReturnValue(360);
    const {result}=renderHook(()=>useFloatingPanels());
    act(()=>result.current.openPanel('manifiesto',{timestamp:event.timestamp,eventoTipo:event.tipo,manifiestoNumero:event.manifiestoNumero,descripcion:event.descripcion},'qa-panel'));
    expect(result.current.panels[0].pos.x+280).toBeLessThanOrEqual(360);
    act(()=>result.current.openPanel('manifiesto',{timestamp:event.timestamp,manifiestoNumero:event.manifiestoNumero,descripcion:event.descripcion},'qa-panel'));
    expect(result.current.panels).toHaveLength(1);
    act(()=>result.current.closePanel('qa-panel'));expect(result.current.panels).toHaveLength(0);
  });
  it('el deslizador avanza realmente el historial, no queda como una maqueta',()=>{
    const playback={isPlaying:false,speed:'normal' as const,currentEventIndex:2,totalEventCount:10,progress:.3,isDone:false,counters:{},play:vi.fn(),pause:vi.fn(),setSpeed:vi.fn(),skipToNext:vi.fn(),skipToPrev:vi.fn(),seek:vi.fn()};
    render(<TimelineControls mode="PLAYBACK" liveData={null} playbackDate="2026-10-02" onDateChange={vi.fn()} onSwitchToPlayback={vi.fn()} timelineData={null} isLoading={false} playback={playback}/>);
    const slider=screen.getByRole('slider',{name:'Recorrer historial'});
    expect(slider).toHaveValue('300');fireEvent.change(slider,{target:{value:'700'}});
    expect(playback.seek).toHaveBeenCalledWith(.7);
  });
  it('sin respuesta de la API muestra ausencia de datos, nunca ceros inventados',()=>{
    render(<TimelineControls mode="FORECAST" liveData={null} forecastData={null} playbackDate={null} onDateChange={vi.fn()} onSwitchToPlayback={vi.fn()} timelineData={null} isLoading={true} playback={null}/>);
    expect(screen.getAllByText('—',{exact:true})).toHaveLength(3);
    expect(screen.queryByText('0',{exact:true})).not.toBeInTheDocument();
  });
  it('una preferencia dañada no colapsa el espacio del panel ni produce NaN',()=>{
    localStorage.setItem('wr-divider-pct-v1','NaN');
    render(<MemoryRouter><DashboardPanels mode="LIVE" liveData={null} forecastData={null}/></MemoryRouter>);
    const divider=screen.getByRole('slider',{name:'Espacio para paneles del Monitor'});
    expect(divider).toHaveValue('55');fireEvent.change(divider,{target:{value:'70'}});
    expect(localStorage.getItem('wr-divider-pct-v1')).toBe('70');
  });
  it('al desplegar Actores conserva sus cifras reales y los iconos de cada categoría',()=>{
    const live={topGeneradores:[{razonSocial:'QA Generador',cantidad:12}],topOperadores:[{razonSocial:'QA Operador',cantidad:7}]} as MonitorLiveResponse;
    const {container}=render(<MemoryRouter><DashboardPanels mode="LIVE" liveData={live} forecastData={null}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Actores',exact:true}));
    expect(screen.getByText('QA Generador').parentElement).toHaveTextContent('12');
    expect(screen.getByText('QA Operador').parentElement).toHaveTextContent('7');
    expect(container.querySelector('svg.lucide-factory')).not.toBeNull();
    expect(container.querySelector('svg.lucide-flask-conical')).not.toBeNull();
  });
  it('no llama toneladas a una suma sin unidad; cuenta viajes con posición registrada',()=>{
    const live={estadisticas:{toneladas:123456},enTransito:[{ultimaPosicion:{latitud:-32,longitud:-68}},{ultimaPosicion:null}]} as MonitorLiveResponse;
    render(<TimelineControls mode="LIVE" liveData={live} playbackDate={null} onDateChange={vi.fn()} onSwitchToPlayback={vi.fn()} timelineData={null} isLoading={false} playback={null}/>);
    expect(screen.queryByText('Toneladas',{exact:true})).not.toBeInTheDocument();
    expect(screen.getByText('Viajes con GPS',{exact:true}).parentElement).toHaveTextContent('1');
  });
  it('en Historial los actores cuentan manifiestos únicos, no cada evento y punto GPS',()=>{
    const timeline={eventos:['CREACION','FIRMA','GPS'].map(kind=>({
      type:kind==='GPS'?'GPS':'EVENTO',eventoTipo:kind,manifiestoId:'QA-unique',
      generador:{razonSocial:'QA Origen'},operador:{razonSocial:'QA Destino'},
    }))} as TimelineResponse;
    render(<MemoryRouter><DashboardPanels mode="PLAYBACK" liveData={null} forecastData={null} timelineData={timeline}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Actores',exact:true}));
    expect(screen.getByText('QA Origen').parentElement?.lastElementChild).toHaveTextContent(/^1$/);
    expect(screen.getByText('QA Destino').parentElement?.lastElementChild).toHaveTextContent(/^1$/);
  });
  it('no mezcla cantidades sin unidad ni presenta una flota declarada como asignación confirmada',()=>{
    const live={topResiduos:[{nombre:'QA corriente',total:123456,categoria:null}]} as MonitorLiveResponse;
    const {container}=render(<MemoryRouter><DashboardPanels mode="LIVE" liveData={live} forecastData={null}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Residuos',exact:true}));
    expect(screen.getByText('QA corriente')).toBeInTheDocument();
    expect(container.textContent).not.toContain('123.456');
    expect(screen.getByRole('link',{name:'Cantidades por unidad en Reportes'})).toHaveAttribute('href','/reportes');
    cleanup();
    render(<FloatingPanelLayer panels={[{id:'qa-trip',type:'viaje',pos:{x:12,y:12},zIndex:1100,minimized:false,data:{manifiestoId:'qa-id',numero:'QA-0001',transportista:'QA Transporte',origen:{razonSocial:'QA Origen',lat:null,lng:null},destino:{razonSocial:'QA Destino',lat:null,lng:null},fechaRetiro:null,ultimaPosicion:null,ruta:[],vehiculo:{patente:'QA001AA',descripcion:'QA Vehículo'},chofer:{nombre:'QA Conductor'}}}]} onClose={vi.fn()} onBringToFront={vi.fn()} onMove={vi.fn()} onMinimize={vi.fn()}/>);
    expect(screen.getByText('Flota declarada · asignación del viaje no verificada')).toBeInTheDocument();
  });
});
