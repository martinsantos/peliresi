/**
 * SITREP v6 - Auditoría Page
 * ==========================
 * Logs y registro de actividad del sistema
 */

import React, { useState } from 'react';
import { 
  Shield, 
  Search, 
  Filter,
  Calendar,
  User,
  FileText,
  Edit,
  Trash2,
  LogIn,
  LogOut,
  Download,
  Activity
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';

// Mock data de logs
const logsData = [
  { id: 1, fecha: '2025-01-31 15:30:22', usuario: 'Juan Pérez', rol: 'ADMIN', accion: 'LOGIN', modulo: 'Sistema', detalle: 'Inicio de sesión exitoso', ip: '192.168.1.45' },
  { id: 2, fecha: '2025-01-31 15:28:15', usuario: 'María González', rol: 'GENERADOR', accion: 'CREATE', modulo: 'Manifiestos', detalle: 'Creó manifiesto M-2025-095', ip: '192.168.1.32' },
  { id: 3, fecha: '2025-01-31 15:25:00', usuario: 'Carlos Rodríguez', rol: 'TRANSPORTISTA', accion: 'UPDATE', modulo: 'Tracking', detalle: 'Actualizó ubicación de M-2025-090', ip: '10.0.0.15' },
  { id: 4, fecha: '2025-01-31 15:20:45', usuario: 'Admin', rol: 'ADMIN', accion: 'DELETE', modulo: 'Usuarios', detalle: 'Eliminó usuario ID 123', ip: '192.168.1.10' },
  { id: 5, fecha: '2025-01-31 15:15:30', usuario: 'Ana Martínez', rol: 'OPERADOR', accion: 'UPDATE', modulo: 'Manifiestos', detalle: 'Confirmó recepción de M-2025-088', ip: '172.16.0.22' },
  { id: 6, fecha: '2025-01-31 15:10:12', usuario: 'Juan Pérez', rol: 'ADMIN', accion: 'EXPORT', modulo: 'Reportes', detalle: 'Exportó reporte mensual', ip: '192.168.1.45' },
  { id: 7, fecha: '2025-01-31 15:05:00', usuario: 'Laura Torres', rol: 'ADMIN', accion: 'CREATE', modulo: 'Usuarios', detalle: 'Creó nuevo usuario transportista', ip: '192.168.1.50' },
  { id: 8, fecha: '2025-01-31 15:00:33', usuario: 'Pedro Sánchez', rol: 'GENERADOR', accion: 'LOGIN', modulo: 'Sistema', detalle: 'Inicio de sesión', ip: '192.168.2.12' },
];

const accionConfig: Record<string, { color: string; icon: any }> = {
  LOGIN: { color: 'success', icon: LogIn },
  LOGOUT: { color: 'neutral', icon: LogOut },
  CREATE: { color: 'primary', icon: FileText },
  UPDATE: { color: 'warning', icon: Edit },
  DELETE: { color: 'error', icon: Trash2 },
  EXPORT: { color: 'info', icon: Download },
};

const AuditoriaPage: React.FC = () => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('todas');

  const logsFiltrados = logsData.filter(log => {
    const matchBusqueda = 
      log.usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
      log.detalle.toLowerCase().includes(busqueda.toLowerCase()) ||
      log.modulo.toLowerCase().includes(busqueda.toLowerCase());
    const matchAccion = filtroAccion === 'todas' || log.accion === filtroAccion;
    return matchBusqueda && matchAccion;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-xl">
            <Shield size={24} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Auditoría</h2>
            <p className="text-neutral-600">Registro de actividad del sistema</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Calendar size={18} />}>
            Últimos 7 días
          </Button>
          <Button variant="outline" leftIcon={<Download size={18} />}>
            Exportar Logs
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-neutral-600 mb-1">Total Logs</p>
            <p className="text-2xl font-bold text-neutral-900">1,247</p>
          </CardContent>
        </Card>
        <Card className="bg-success-50 border-success-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-success-700 mb-1">Logins</p>
            <p className="text-2xl font-bold text-success-900">342</p>
          </CardContent>
        </Card>
        <Card className="bg-primary-50 border-primary-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-primary-700 mb-1">Creados</p>
            <p className="text-2xl font-bold text-primary-900">156</p>
          </CardContent>
        </Card>
        <Card className="bg-warning-50 border-warning-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-warning-700 mb-1">Actualizados</p>
            <p className="text-2xl font-bold text-warning-900">523</p>
          </CardContent>
        </Card>
        <Card className="bg-error-50 border-error-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-error-700 mb-1">Eliminados</p>
            <p className="text-2xl font-bold text-error-900">24</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por usuario, módulo o acción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filtroAccion}
              onChange={(e) => setFiltroAccion(e.target.value)}
              className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="todas">Todas las acciones</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="CREATE">Crear</option>
              <option value="UPDATE">Actualizar</option>
              <option value="DELETE">Eliminar</option>
              <option value="EXPORT">Exportar</option>
            </select>
            <Button variant="outline" leftIcon={<Filter size={18} />}>
              Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabla de logs */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Acción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Detalle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {logsFiltrados.map((log) => {
                const config = accionConfig[log.accion] || { color: 'neutral', icon: Activity };
                const Icon = config.icon;
                return (
                  <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-neutral-600 font-mono">
                      {log.fecha}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                          <User size={14} className="text-neutral-500" />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900 text-sm">{log.usuario}</p>
                          <Badge variant="outline" size="sm">{log.rol}</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-700`}>
                        <Icon size={12} />
                        {log.accion}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {log.modulo}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {log.detalle}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500 font-mono">
                      {log.ip}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between">
          <p className="text-sm text-neutral-600">
            Mostrando <span className="font-medium">1-8</span> de <span className="font-medium">1,247</span> registros
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm">Siguiente</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AuditoriaPage;
