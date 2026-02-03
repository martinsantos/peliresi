/**
 * SITREP v6 - User Switcher Page
 * ===============================
 * Página dedicada para cambiar entre usuarios de demo
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Info } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { UserSwitcher } from '../../components/ui/UserSwitcher';
import { useAuth } from '../../contexts/AuthContext';

export const UserSwitcherPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            leftIcon={<ArrowLeft size={18} />}
            onClick={() => navigate(-1)}
          >
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Cambiar Usuario</h1>
            <p className="text-neutral-600">Selecciona un perfil para ver la interfaz</p>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 bg-gradient-to-r from-primary-500 to-primary-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info size={24} className="shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Modo Demo - User Switcher</h3>
                <p className="text-primary-100 text-sm">
                  Esta función te permite cambiar entre diferentes perfiles de usuario para ver 
                  cómo se adapta la interfaz según el rol. Cada perfil tiene permisos diferentes 
                  y verá opciones específicas para su función.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Switcher Component */}
        <Card>
          <CardContent className="p-6">
            <UserSwitcher variant="modal" />
          </CardContent>
        </Card>

        {/* Resumen de permisos por rol */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">Permisos por Rol</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Admin */}
            <Card className="border-l-4 border-l-primary-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-primary-100 rounded-lg">
                    <span className="text-primary-600 font-bold text-sm">A</span>
                  </div>
                  <h3 className="font-semibold text-neutral-900">Administrador</h3>
                </div>
                <p className="text-sm text-neutral-600">
                  Acceso completo a todas las funciones: gestión de usuarios, 
                  manifiestos, reportes, auditoría y configuración del sistema.
                </p>
              </CardContent>
            </Card>

            {/* Generador */}
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <span className="text-purple-600 font-bold text-sm">G</span>
                  </div>
                  <h3 className="font-semibold text-neutral-900">Generador</h3>
                </div>
                <p className="text-sm text-neutral-600">
                  Puede crear y gestionar manifiestos de residuos, ver el estado 
                  de sus envíos y acceder a reportes de su establecimiento.
                </p>
              </CardContent>
            </Card>

            {/* Transportista */}
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-orange-100 rounded-lg">
                    <span className="text-orange-600 font-bold text-sm">T</span>
                  </div>
                  <h3 className="font-semibold text-neutral-900">Transportista</h3>
                </div>
                <p className="text-sm text-neutral-600">
                  Acceso a manifiestos asignados para transporte, actualización 
                  de tracking en tiempo real y gestión de vehículos.
                </p>
              </CardContent>
            </Card>

            {/* Operador */}
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-green-100 rounded-lg">
                    <span className="text-green-600 font-bold text-sm">O</span>
                  </div>
                  <h3 className="font-semibold text-neutral-900">Operador</h3>
                </div>
                <p className="text-sm text-neutral-600">
                  Puede recibir manifiestos, registrar tratamiento/disposición 
                  de residuos y generar reportes de operación.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Button 
            variant="outline" 
            leftIcon={<RefreshCw size={18} />}
            onClick={() => window.location.reload()}
          >
            Recargar Aplicación
          </Button>
          <p className="text-xs text-neutral-400 mt-2">
            Recarga para aplicar completamente los cambios de permisos
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserSwitcherPage;
