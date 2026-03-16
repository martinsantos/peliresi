/**
 * SITREP v6 - Perfil Page
 * =======================
 * Perfil de usuario y configuración personal
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Building2,
  Save,
  Key,
  Shield,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { usuarioService } from '../../services/usuario.service';


const PerfilPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [user, setUser] = useState({
    nombre: '',
    email: '',
    telefono: '',
    sector: '',
    rol: '',
    avatar: '',
  });
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Load user data from AuthContext
  useEffect(() => {
    if (currentUser) {
      const nombre = currentUser.nombre || 'Usuario';
      setUser({
        nombre,
        email: currentUser.email || '',
        telefono: currentUser.telefono || '',
        sector: currentUser.sector || 'DGFA Mendoza',
        rol: currentUser.rol || 'USUARIO',
        avatar: nombre.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
      });
    }
  }, [currentUser]);

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      if (currentUser?.id) {
        await usuarioService.update(String(currentUser.id), {
          nombre: user.nombre,
          telefono: user.telefono,
        });
      }
      toast.success('Perfil actualizado', 'Tus cambios se guardaron correctamente');
    } catch {
      toast.warning('Cambios locales', 'Los cambios se aplicaron localmente');
    } finally {
      setGuardando(false);
      setEditando(false);
    }
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
              </div>
              <h3 className="text-xl font-bold text-neutral-900">{user.nombre}</h3>
              <p className="text-neutral-600">{user.email}</p>
              <div className="mt-3">
                <Badge variant="soft" color="primary">
                  <Shield size={12} className="mr-1" />
                  {user.rol}
                </Badge>
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
                <Button variant="outline" size="sm" onClick={() => navigate('/configuracion?tab=seguridad')}>Cambiar</Button>
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
                  <Input label="Nombre" value={user.nombre} onChange={(e) => setUser({ ...user, nombre: e.target.value })} />
                  <Input label="Teléfono" value={user.telefono} onChange={(e) => setUser({ ...user, telefono: e.target.value })} />
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
                        <span className="text-xs font-medium uppercase">Sector</span>
                      </div>
                      <p className="font-medium text-neutral-900">{user.sector}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-2 text-neutral-500 mb-1">
                      <Mail size={14} />
                      <span className="text-xs font-medium uppercase">Email</span>
                    </div>
                    <p className="font-medium text-neutral-900">{user.email}</p>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-2 text-neutral-500 mb-1">
                      <Phone size={14} />
                      <span className="text-xs font-medium uppercase">Teléfono</span>
                    </div>
                    <p className="font-medium text-neutral-900">{user.telefono}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PerfilPage;
