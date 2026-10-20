import type {Response,NextFunction} from 'express';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import prisma from '../lib/prisma';
import type {AuthRequest} from '../middlewares/auth.middleware';
import {AppError} from '../middlewares/errorHandler';
import {isTrainingSession} from '../lib/trainingScope';
import {applyRoleFilter} from '../utils/roleFilter';
import {readTransportAssignment} from '../domain/manifiestoTransportAssignment';

export function multiGpsEnabled(_req:AuthRequest,_res:Response,next:NextFunction) {
  return isTrainingSession()||process.env.TRANSPORT_MULTI_GPS_ENABLED==='true'?next():next(new AppError('Función no habilitada',404));
}
/** Only GPS targets of the authenticated carrier. A replacement gets its own
 * limited leg, never the original manifest's private dossier or actor records. */
export async function transportGpsTargets(req:AuthRequest,res:Response,next:NextFunction) {
  try{
    const carrierId=req.user.rol==='TRANSPORTISTA'?req.user.transportista?.id:undefined;
    if(!carrierId)throw new AppError('Transportista no asociada a la cuenta',403);
    const search=z.string().trim().max(80).default('').safeParse(req.query.search);
    if(!search.success)throw new AppError('Búsqueda de manifiesto inválida',400);
    const number=search.data?{contains:search.data,mode:'insensitive' as const}:undefined;
    const originalWhere:Prisma.ManifiestoWhereInput={estado:'EN_TRANSITO',...(number?{numero:number}:{}),tramosTransporte:{none:{fin:null,tipo:{not:'ORIGINAL'}}}};
    applyRoleFilter(originalWhere,req.user);
    const legWhere:Prisma.TramoTransporteWhereInput={transportistaId:carrierId,tipo:'REGISTRADO',fin:null,manifiesto:{estado:'EN_TRANSITO',...(number?{numero:number}:{})}};
    const [originals,legs,originalCount,legCount]=await Promise.all([
      prisma.manifiesto.findMany({where:originalWhere,orderBy:{fechaRetiro:'desc'},take:100,select:{id:true,numero:true,transportistaId:true,asignacionTransporte:true,fechaRetiro:true,generador:{select:{razonSocial:true}},operador:{select:{razonSocial:true}}}}),
      prisma.tramoTransporte.findMany({where:legWhere,orderBy:{inicio:'desc'},take:100,select:{id:true,manifiestoId:true,inicio:true,datos:true,accesoVersion:true,accesoHasta:true,manifiesto:{select:{numero:true,operador:{select:{razonSocial:true}}}}}}),
      prisma.manifiesto.count({where:originalWhere}),prisma.tramoTransporte.count({where:legWhere}),
    ]);
    const targets=[
      ...originals.map(m=>({key:'MANIFIESTO:'+m.id,kind:'MANIFIESTO' as const,id:m.id,numero:m.numero,origen:m.generador.razonSocial,destino:m.operador.razonSocial,
        fechaInicio:m.fechaRetiro,referenciaTiempo:'Desde el retiro',patente:readTransportAssignment(m.asignacionTransporte,m.transportistaId)?.vehiculo?.patente??null,puedeEntregar:true,gpsDisponible:true})),
      ...legs.map(leg=>{
        const declared=z.object({patente:z.string().optional()}).passthrough().safeParse(leg.datos);
        return {key:'RELEVO:'+leg.id,kind:'RELEVO' as const,id:leg.id,numero:leg.manifiesto.numero,origen:'Relevo asignado',destino:leg.manifiesto.operador.razonSocial,
          fechaInicio:leg.inicio,referenciaTiempo:'Desde el relevo',patente:declared.success?declared.data.patente??null:null,puedeEntregar:false,
          gpsDisponible:!!leg.accesoVersion&&!!leg.accesoHasta&&leg.accesoHasta>new Date()};
      }),
    ].sort((a,b)=>(b.fechaInicio?.getTime()??0)-(a.fechaInicio?.getTime()??0)).slice(0,100);
    res.setHeader('Cache-Control','private, no-store');
    res.json({success:true,data:{targets,total:originalCount+legCount,limit:100}});
  }catch(error){next(error);}
}
