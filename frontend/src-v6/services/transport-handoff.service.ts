import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from '../contexts/AuthContext';
import { manifestFeatureVisible } from '../utils/manifestFeatures';

export interface TransportDeclaration { empresa?:string;cuit?:string;patente?:string;chofer?:string;documento?:string;telefono?:string;observaciones?:string }
export interface TransportLeg {
  id:string;manifiestoId:string;orden:number;tipo:'ORIGINAL'|'REGISTRADO'|'EXTERNO';datos:TransportDeclaration;
  transportistaId:string|null;motivo:string;inicio:string;fin:string|null;creadoPorId:string;
  accesoActivo:boolean;accesoHasta:string|null;
}
export interface TransportLegState {tramos:TransportLeg[];puedeRegistrar:boolean}
export const transportLegKey=(id:string,userId?:string|number)=>['tramos-transporte',id,userId];
export function useTransportLegs(id:string, contextKey?:string) {
  const {currentUser}=useAuth();
  const key=transportLegKey(id,currentUser?.id);
  return useQuery({queryKey:contextKey ? [...key,contextKey] : key,enabled:!!id&&manifestFeatureVisible(import.meta.env.VITE_MANIFEST_TRANSPORT_HANDOFF_ENABLED,currentUser),
    queryFn:async()=> (await api.get<{data:TransportLegState}>(`/manifiestos/${id}/tramos`)).data.data,
    retry:false,refetchInterval:15000});
}
export const transportHandoffService={
  create:async(id:string,command:unknown)=>(await api.post<{data:{tramo:TransportLeg;acceso:string|null}}>(`/manifiestos/${id}/tramos`,command)).data.data,
  access:async(id:string,tramoId:string,revocar:boolean)=>(await api.post<{data:{tramo:TransportLeg;acceso:string|null}}>(`/manifiestos/${id}/tramos/${tramoId}/acceso`,{revocar})).data.data,
};
export function handoffLink(id:string,token:string) {
  const prefix=window.location.pathname.startsWith('/app/')?'/app':'';
  return `${window.location.origin}${prefix}/relevo/${id}#${token}`;
}
