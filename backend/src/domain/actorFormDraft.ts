import { AppError } from '../middlewares/errorHandler';
export const DRAFT_LIFETIME = 30 * 86400000;
export function draftScope(scope: string, user: {rol:string;restricted?:boolean}) {
  const match = /^admin:(GENERADOR|OPERADOR|TRANSPORTISTA):([a-zA-Z0-9_-]{1,100})$/.exec(scope);
  if (!match) throw new AppError('Borrador inválido',400);
  const [,type,id]=match;
  if (user.restricted || !['ADMIN',`ADMIN_${type}`].includes(user.rol)) throw new AppError('No tiene acceso a este borrador',403);
  return {type,actorId:id==='new'?null:id};
}
export function draftVersion(value: unknown): number {
  if (value === null || value === undefined || !/^(0|[1-9]\d*)$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new AppError('La versión del borrador es obligatoria',400);
  return Number(value);
}
export function cleanDraftData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('Datos del borrador inválidos',400);
  const secret = /password|contrase|token|secret|credential/i;
  const clean = (item: unknown, depth: number): unknown => {
    if (depth>8) throw new AppError('Borrador demasiado complejo',400);
    if (item===null || typeof item==='string' || typeof item==='boolean') return item;
    if (typeof item==='number') return Number.isFinite(item)?item:null;
    if (Array.isArray(item)) { if(item.length>500)throw new AppError('Demasiados elementos en el borrador',400); return item.map(entry=>clean(entry,depth+1)); }
    if (item && typeof item==='object' && Object.getPrototypeOf(item)===Object.prototype) return Object.fromEntries(Object.entries(item)
      .filter(([key])=>!secret.test(key)&&!['__proto__','constructor','prototype'].includes(key)).map(([key,entry])=>[key,clean(entry,depth+1)]));
    return null;
  };
  const result=clean(value,0) as Record<string,unknown>;
  if(Buffer.byteLength(JSON.stringify(result))>256000)throw new AppError('El borrador supera el tamaño permitido',400);
  return result;
}
