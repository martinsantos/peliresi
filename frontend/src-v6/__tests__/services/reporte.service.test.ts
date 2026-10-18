import {beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../../services/api',()=>({default:api}));
import {reporteService} from '../../services/reporte.service';
const page=(rows:Record<string,unknown>[],number=1,total=rows.length,limit=500)=>({data:{data:{detalle:rows,transportistas:rows,pagination:{page:number,total,limit,pages:Math.ceil(total/limit)}}}});
const readBlob=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsText(blob);});
describe('report CSV matches its actual filtered report',()=>{
  beforeEach(()=>api.get.mockReset());
  it('exports treated rows from closure-period report, not all created manifests',async()=>{
    api.get.mockResolvedValue(page([{id:'closed',numero:'GR-001',generador:'QA',fechaTratamiento:'2026-09-30T10:00:00Z',metodoTratamiento:'Recuperación',residuos:[{codigo:'Y1',nombre:'Residuo',cantidad:4,unidad:'kg'}]}]));
    const blob=await reporteService.exportar('tratados','csv',{fechaDesde:'2026-09-01',fechaHasta:'2026-09-30'});
    expect(api.get).toHaveBeenCalledWith('/reportes/tratados',{params:expect.objectContaining({fechaInicio:'2026-09-01',fechaFin:'2026-09-30',page:1,limit:500})});
    const text=await readBlob(blob);expect(text).toContain('GR-001');expect(text).toContain('Y1');expect(text).toContain('Recuperación');
  });
  it('exports transport activity for the selected period, not lifetime registry counts',async()=>{
    api.get.mockResolvedValue(page([{transportistaId:'own',transportista:'QA Transporte',cuit:'20-1',totalViajes:3,completados:2,enTransito:1,pendientes:0,vehiculosRegistrados:4,choferesRegistrados:2,tasaCompletitud:'66.7%'}],1,1,200));
    const text=await readBlob(await reporteService.exportar('transporte','csv',{fechaDesde:'2026-09-01'}));
    expect(api.get).toHaveBeenCalledWith('/reportes/transporte',{params:expect.objectContaining({fechaInicio:'2026-09-01',page:1,limit:200})});
    expect(text).toContain('Viajes');expect(text).toContain('66.7%');expect(text).toContain('QA Transporte');
  });
  it('fetches every page in series with identical filters',async()=>{
    api.get.mockResolvedValueOnce(page(Array.from({length:500},(_,i)=>({id:String(i),numero:'N'+i})),1,501));
    api.get.mockResolvedValueOnce(page([{id:'500',numero:'LAST'}],2,501));
    const text=await readBlob(await reporteService.exportar('tratados','csv',{fechaHasta:'2026-09-30'}));
    expect(api.get).toHaveBeenNthCalledWith(2,'/reportes/tratados',{params:expect.objectContaining({page:2,limit:500,fechaFin:'2026-09-30'})});
    expect(text).toContain('LAST');expect(text.trim().split('\n')).toHaveLength(502);
  });
  it('does not generate a partial file if a later page fails',async()=>{
    api.get.mockResolvedValueOnce(page(Array.from({length:500},(_,i)=>({id:String(i)})),1,501));api.get.mockRejectedValueOnce(new Error('Offline'));
    await expect(reporteService.exportar('tratados','csv')).rejects.toThrow('Offline');
  });
  it('rejects changing totals or duplicate records instead of certifying an inconsistent file',async()=>{
    const rows=Array.from({length:500},(_,i)=>({id:String(i)}));
    api.get.mockResolvedValueOnce(page(rows,1,501)).mockResolvedValueOnce(page([{id:'0'}],2,501));
    await expect(reporteService.exportar('tratados','csv')).rejects.toThrow(/cambió|inconsistente/);
  });
  it('declares the 10000 record limit before downloading all pages',async()=>{
    api.get.mockResolvedValue(page([{id:'1'}],1,10001));
    await expect(reporteService.exportar('tratados','csv')).rejects.toThrow(/10.000|10000/);expect(api.get).toHaveBeenCalledOnce();
  });
  it('escapes CSV quotes and guards formula injection without losing numeric amounts',async()=>{
    api.get.mockResolvedValue(page([{id:'1',numero:'=1+1',generador:'QA "quoted"',residuos:[{codigo:'Y1',nombre:'Residuo, peligroso',cantidad:-3,unidad:'kg'}]}]));
    const text=await readBlob(await reporteService.exportar('tratados','csv'));
    expect(text).toContain('"\'=1+1"');expect(text).toContain('"QA ""quoted"""');expect(text).toContain('"Residuo, peligroso"');expect(text).toContain('"-3"');
  });
  it('preserves existing registry and manifest export contracts',async()=>{
    const blob=new Blob(['legacy']);api.get.mockResolvedValue({data:blob});
    expect(await reporteService.exportar('manifiestos','csv',{fechaDesde:'2026-09-01'})).toBe(blob);
    expect(api.get).toHaveBeenCalledWith('/reportes/exportar/manifiestos',{params:expect.objectContaining({formato:'csv',fechaInicio:'2026-09-01'}),responseType:'blob'});
  });
  it('sends real page and limit parameters without losing report filters',async()=>{
    api.get.mockResolvedValue(page([],2,0));await reporteService.manifiestos({page:2,limit:25,fechaDesde:'2026-09-01'});
    expect(api.get).toHaveBeenCalledWith('/reportes/manifiestos',{params:expect.objectContaining({page:2,limit:25,fechaInicio:'2026-09-01'})});
  });
  it('exports an empty period as headers only, never substitutes unrelated actors or records',async()=>{
    api.get.mockResolvedValue(page([]));const csv=await readBlob(await reporteService.exportar('tratados','csv'));
    expect(csv.trim().split('\n')).toHaveLength(1);expect(csv).toContain('Fecha de tratamiento');
  });
  it('rejects a changing total between pages',async()=>{
    api.get.mockResolvedValueOnce(page(Array.from({length:500},(_,i)=>({id:String(i)})),1,501)).mockResolvedValueOnce(page([{id:'500'},{id:'501'}],2,502));
    await expect(reporteService.exportar('tratados','csv')).rejects.toThrow(/cambió/);
  });
  it('rejects missing pagination metadata rather than silently exporting one incomplete page',async()=>{
    api.get.mockResolvedValue({data:{data:{detalle:[{id:'1'}]}}});
    await expect(reporteService.exportar('tratados','csv')).rejects.toThrow(/inconsistente/);
  });
});
