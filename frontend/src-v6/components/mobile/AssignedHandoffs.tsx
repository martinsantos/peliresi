import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { handoffLink } from '../../services/transport-handoff.service';
import { manifestFeatureVisible } from '../../utils/manifestFeatures';
import { Card,CardHeader,CardContent } from '../ui/CardV2';
import { Button } from '../ui/ButtonV2';
export function AssignedHandoffs() {
  const {currentUser}=useAuth();const [error,setError]=useState(''),[busy,setBusy]=useState('');
  const [history,setHistory]=useState(false);
  const query=useQuery({queryKey:['relevos-asignados',currentUser?.id],enabled:currentUser?.rol==='TRANSPORTISTA'&&manifestFeatureVisible(import.meta.env.VITE_MANIFEST_TRANSPORT_HANDOFF_ENABLED,currentUser),
    queryFn:async()=>(await api.get<{data:{tramoId:string;numero:string;destino:string;fin:string|null;accesoDisponible:boolean}[]}>('/manifiestos/relevos-asignados')).data.data,retry:false,refetchInterval:15000});
  if(!query.data?.length)return null;
  const rows=query.data.filter(leg=>history?!!leg.fin:!leg.fin);
  return <Card role="region" aria-label="Relevos a mi cargo"><CardHeader title="Relevos a mi cargo" icon={<ArrowRightLeft size={20}/>}/><CardContent className="space-y-3">
    <div className="flex gap-2"><Button size="sm" variant={history?'outline':'primary'} onClick={()=>setHistory(false)}>En curso</Button><Button size="sm" variant={history?'primary':'outline'} onClick={()=>setHistory(true)}>Historial</Button></div>
    {rows.map(leg=><div key={leg.tramoId} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3"><div><strong className="text-sm text-neutral-900">{leg.numero}</strong><p className="text-xs text-neutral-600">{leg.destino}</p></div>{leg.fin?<span className="text-xs font-semibold text-neutral-600">Finalizado · {new Date(leg.fin).toLocaleDateString('es-AR')}</span>:<Button size="sm" variant="outline" disabled={!leg.accesoDisponible||!!busy} isLoading={busy===leg.tramoId} onClick={async()=>{
      setBusy(leg.tramoId);setError('');try{const result=await api.post<{data:{acceso:string}}>(`/manifiestos/relevos-asignados/${leg.tramoId}/acceso`,{});window.location.assign(handoffLink(leg.tramoId,result.data.data.acceso));}
      catch(err:any){setError(err?.response?.data?.message||'No se pudo abrir el seguimiento');setBusy('');}
    }}>{leg.accesoDisponible?'Compartir GPS':'Pedir nuevo enlace'}</Button>}</div>)}
    {rows.length===0&&<p className="text-sm text-neutral-600">{history?'Todavía no hay relevos finalizados.':'Sin relevos en curso.'}</p>}
    {error&&<p role="alert" className="text-sm text-error-800">{error}</p>}
  </CardContent></Card>;
}
