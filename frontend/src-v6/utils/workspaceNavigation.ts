import {
  Home, FileText, Truck, ClipboardCheck, Command, Radio, Users, Factory,
  FlaskConical, Building2, FileCheck, BarChart3, AlertTriangle, Bell, Shield,
  ShieldCheck, Upload, ScanLine, HelpCircle, LifeBuoy, Settings, type LucideIcon,
} from 'lucide-react';
import type { User } from '../contexts/AuthContext';
import { canAccessMobilePath } from './mobileAccess';
import { canUseCompanySection } from '../services/companyContext';

export type WorkspaceItem = { path: string; label: string; icon: LucideIcon; section: 'main' | 'admin' | 'tools' };
export const ADMIN_ROLES = ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'];
export const isInspectionStaff = (user: Pick<User, 'rol' | 'esInspector'> | null | undefined) =>
  Boolean(user && (user.esInspector || ADMIN_ROLES.includes(user.rol)));
const catalog: WorkspaceItem[] = [
  {path:'/dashboard', label:'Inicio', icon:Home, section:'main'},
  {path:'/transporte/perfil', label:'Viajes', icon:Truck, section:'main'},
  {path:'/manifiestos', label:'Manifiestos', icon:FileText, section:'main'},
  {path:'/inspecciones', label:'Inspecciones', icon:ClipboardCheck, section:'main'},
  {path:'/centro-control', label:'Centro de control', icon:Command, section:'main'},
  {path:'/monitor', label:'Monitor', icon:Radio, section:'main'},
  {path:'/reportes', label:'Reportes', icon:BarChart3, section:'main'},
  {path:'/notificaciones', label:'Avisos', icon:Bell, section:'main'},
  {path:'/alertas', label:'Alertas operativas', icon:AlertTriangle, section:'main'},
  {path:'/actores', label:'Consultar actores', icon:Building2, section:'main'},
  {path:'/admin/actores', label:'Actores', icon:Building2, section:'admin'},
  {path:'/admin/actores/generadores', label:'Generadores', icon:Factory, section:'admin'},
  {path:'/admin/actores/transportistas', label:'Transportistas', icon:Truck, section:'admin'},
  {path:'/admin/actores/operadores', label:'Operadores', icon:FlaskConical, section:'admin'},
  {path:'/admin/solicitudes', label:'Solicitudes de inscripción', icon:FileCheck, section:'admin'},
  {path:'/admin/usuarios', label:'Usuarios', icon:Users, section:'admin'},
  {path:'/admin/vehiculos', label:'Vehículos', icon:Truck, section:'admin'},
  {path:'/admin/residuos', label:'Catálogo de residuos', icon:FlaskConical, section:'admin'},
  {path:'/admin/tratamientos', label:'Tratamientos', icon:BarChart3, section:'admin'},
  {path:'/admin/blockchain', label:'Certificación blockchain', icon:ShieldCheck, section:'admin'},
  {path:'/admin/auditoria', label:'Auditoría', icon:Shield, section:'admin'},
  {path:'/admin/carga-masiva', label:'Carga masiva', icon:Upload, section:'admin'},
  {path:'/escaner-qr', label:'Escanear QR', icon:ScanLine, section:'tools'},
  {path:'/configuracion', label:'Configuración', icon:Settings, section:'tools'},
  {path:'/ayuda', label:'Ayuda', icon:HelpCircle, section:'tools'},
  {path:'/soporte', label:'Soporte', icon:LifeBuoy, section:'tools'},
];
export function workspaceNavigation(user: User | null | undefined): WorkspaceItem[] {
  if (!user) return [];
  return catalog.filter(item =>
    canAccessMobilePath(user, item.path) && canUseCompanySection(user.empresaContexto, item.path)
    && (item.path !== '/actores' || Boolean(user.esInspector && !ADMIN_ROLES.includes(user.rol)))
    && (item.path !== '/transporte/perfil' || user.rol === 'TRANSPORTISTA')
  );
}
export function workspaceTitle(pathname: string): string {
  const path = pathname.replace(/^\/(?:app|mobile)(?=\/)/, '');
  const details: Array<[RegExp, string]> = [
    [/^\/(?:requerimientos|mis-inspecciones)(?:\/|$)/, 'Requerimiento'],
    [/^\/inspecciones\//, 'Inspección'],
    [/^\/manifiestos\/nuevo/, 'Nuevo manifiesto'],
    [/^\/manifiestos\/[^/]+\/adendas/, 'Adendas del manifiesto'],
    [/^\/manifiestos\/baja-intensidad/, 'Eventuales'],
    [/^\/transporte\/cargas/, 'GPS de mis viajes'],
    [/^\/transporte\/viaje\//, 'Viaje en curso'],
    [/^\/mi-perfil/, 'Mi perfil'],
    [/^\/empresas/, 'Empresas y establecimientos'],
    [/^\/tracking/, 'Seguimiento GPS'],
    [/^\/estadisticas/, 'Estadísticas'],
    [/^\/admin\/renovaciones/, 'Renovaciones'],
    [/^\/switch-user/, 'Cuenta'],
  ];
  return details.find(([rule]) => rule.test(path))?.[1]
    || [...catalog].sort((a,b) => b.path.length-a.path.length)
      .find(item => path === item.path || path.startsWith(item.path+'/'))?.label
    || 'SITREP';
}

/** Associate detail screens with the section that owns the work. */
export function workspaceSectionPath(pathname: string): string {
  const path = pathname.replace(/^\/(?:app|mobile)(?=\/)/, '');
  if (/^\/(?:requerimientos|mis-inspecciones)(?:\/|$)/.test(path)) return '/notificaciones';
  if (/^\/transporte\/(?:viaje|cargas)(?:\/|$)/.test(path)) return '/transporte/perfil';
  if (/^\/empresas(?:\/|$)/.test(path)) return '/mi-perfil';
  return path;
}

export function workspaceRoleLabel(role: string): string {
  return ({ADMIN:'Administrador',GENERADOR:'Generador',TRANSPORTISTA:'Transportista',OPERADOR:'Operador',
    AUDITOR:'Auditor',ADMIN_GENERADOR:'Adm. Generadores',ADMIN_TRANSPORTISTA:'Adm. Transportistas',ADMIN_OPERADOR:'Adm. Operadores'} as Record<string,string>)[role] || role;
}
