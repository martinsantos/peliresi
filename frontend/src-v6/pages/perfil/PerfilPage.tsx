/**
 * SITREP v6 - Perfil Page
 * =======================
 * Perfil de usuario y configuración personal
 */

import React, { useState } from 'react';
import { 
  User, 
  Camera, 
  Mail, 
  Phone, 
  Building2,
  MapPin,
  Save,
  Key,
  Bell,
  Shield,
  Activity
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { toast } from '../../components/ui/Toast';

// Mock user data
const userData = {
  nombre: 'Juan Pérez',
  email: 'juan.perez@dgfa.gob.ar',
  telefono: '+54 261 412-3456',
  cargo: 'Administrador de Sistema',
  sector: 'DGFA Mendoza',
  rol: 'ADMIN',
  domicilio: 'Av. San Martín 1234, Mendoza',
  fechaRegistro: '2024-03-15',
  ultimoAcceso: 'Hace 5 minutos',
  avatar: 'JP',
};

// Mock activity
const actividadReciente = [
  { id: 1, accion: 'Inicio de sesión', fecha: '31/01/2025 15:30', dispositivo: 'Chrome - Windows' },
  { id: 2, accion: 'Actualizó perfil', fecha: '30/01/2025 10:15', dispositivo: 'Chrome - Windows' },
  { id: 3, accion: 'Generó reporte', fecha: '29/01/2025 14:20', dispositivo: 'Chrome - Windows' },
  { id: 4, accion: 'Aprobó manifiesto M-2025-088', fecha: '28/01/2025 11:45', dispositivo: 'Safari - iPhone' },
];

const PerfilPage: React.FC = () => {
  const [user, setUser] = useState(userData);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardarCambios = async () => {
    setGuardando(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setGuardando(false);
    setEditando(false);
    toast.success('Perfil actualizado', 'Tus cambios se guardaron correctamente');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Mi Perfil</h2>
        <p className="text-neutral-600 mt-1">Gestiona tu información personal</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar - Info Principal */}
        <div className="space-y-4 animate-fade-in">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center text-2xl font-bold text-primary-600 mx-auto">
                  {user.avatar}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 transition-colors">
                  <Camera size={16} />
                </button>
              </div>
              <h3 className="text-xl font-bold text-neutral-900">{user.nombre}</h3>
              <p className="text-neutral-600">{user.email}</p>
              <div className="mt-3">
                <Badge variant="soft" color="primary" size="lg">
                  <Shield size={12} className="mr-1" />
                  {user.rol}
                </Badge>
              </div>
              <div className="mt-4 pt-4 border-t border-neutral-100 text-sm text-neutral-500 space-y-1">
                <p>Miembro desde: {user.fechaRegistro}</p>
                <p>Último acceso: {user.ultimoAcceso}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Seguridad" icon={<Shield size={18} />} />
            <CardContent className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Key size={16} className="text-neutral-500" />
                  <span className="text-sm font-medium">Contraseña</span>
                </div>
                <Button variant="outline" size="sm">Cambiar</Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-neutral-500" />
                  <span className="text-sm font-medium">2FA</span>
                </div>
                <Badge variant="soft" color="success">Activo</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader 
              title="Información Personal"
              action={
                !editando && (
                  <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                    Editar
                  </Button>
                )
              }
            />
            <CardContent>
              {editando ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Nombre" defaultValue={user.nombre} />
                    <Input label="Cargo" defaultValue={user.cargo} />
                  </div>
                  <Input label="Email" type="email" defaultValue={user.email} />
                  <Input label="Teléfono" defaultValue={user.telefono} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Sector" defaultValue={user.sector} />
                    <Input label="Domicilio" defaultValue={user.domicilio} />
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
                    <Button onClick={guardarCambios} isLoading={guardando} leftIcon={<Save size={16} />}>
                      Guardar Cambios
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-neutral-50 rounded-xl">
                      <div className="flex items-center gap-2 text-neutral-500 mb-1">
                        <User size={14} />
                        <span className="text-xs font-medium uppercase">Nombre</span>
                      </div>
                      <p className="font-medium text-neutral-900">{user.nombre}</p>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-xl">
                      <div className="flex items-center gap-2 text-neutral-500 mb-1">
                        <Building2 size={14} />
                        <span className="text-xs font-medium uppercase">Cargo</span>
                      </div>
                      <p className="font-medium text-neutral-900">{user.cargo}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-2 text-neutral-500 mb-1">
                      <Mail size={14} />
                      <span className="text-xs font-medium uppercase">Email</span>
                    </div>
                    <p className="font-medium text-neutral-900">{user.email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-neutral-50 rounded-xl">
                      <div className="flex items-center gap-2 text-neutral-500 mb-1">
                        <Phone size={14} />
                        <span className="text-xs font-medium uppercase">Teléfono</span>
                      </div>
                      <p className="font-medium text-neutral-900">{user.telefono}</p>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-xl">
                      <div className="flex items-center gap-2 text-neutral-500 mb-1">
                        <Building2 size={14} />
                        <span className="text-xs font-medium uppercase">Sector</span>
                      </div>
                      <p className="font-medium text-neutral-900">{user.sector}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-2 text-neutral-500 mb-1">
                      <MapPin size={14} />
                      <span className="text-xs font-medium uppercase">Domicilio</span>
                    </div>
                    <p className="font-medium text-neutral-900">{user.domicilio}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Actividad Reciente" icon={<Activity size={18} />} />
            <CardContent className="p-0">
              <div className="divide-y divide-neutral-100">
                {actividadReciente.map((actividad) => (
                  <div key={actividad.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                        <Activity size={18} className="text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">{actividad.accion}</p>
                        <p className="text-sm text-neutral-500">{actividad.dispositivo}</p>
                      </div>
                    </div>
                    <span className="text-sm text-neutral-400">{actividad.fecha}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PerfilPage;
