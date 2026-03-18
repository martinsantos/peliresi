/**
 * SITREP v6 - Configuración Page
 * ==============================
 * Página de configuración del sistema
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Shield,
  Palette,
  Bell,
  Save,
  ChevronRight,
  Download,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { resetOnboardingTour } from '../../components/OnboardingTour';
import { resetDemoOnboarding } from '../../components/DemoAppOnboarding';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { InstallPWAButton } from '../../components/InstallPWAButton';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { authService } from '../../services/auth.service';
import api from '../../services/api';
import { usuarioService } from '../../services/usuario.service';

// Secciones base de configuración
const BASE_SECTIONS = [
  { id: 'perfil', label: 'Perfil', icon: User },
  { id: 'seguridad', label: 'Seguridad', icon: Shield },
  { id: 'apariencia', label: 'Apariencia', icon: Palette },
];

const ConfiguracionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const validSections = [...BASE_SECTIONS, { id: 'notificaciones' }].map(s => s.id);
  const [activeSection, setActiveSection] = useState(
    tabParam && validSections.includes(tabParam) ? tabParam : 'perfil'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [notifNuevoRegistro, setNotifNuevoRegistro] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);
  const { currentUser, isAdmin } = useAuth();

  // Profile form state
  const [profile, setProfile] = useState({
    nombre: '',
    email: '',
    telefono: '',
    cargo: '',
  });

  // Load user data
  useEffect(() => {
    if (currentUser) {
      setProfile({
        nombre: currentUser.nombre || '',
        email: currentUser.email || '',
        telefono: currentUser.telefono || '',
        cargo: currentUser.rol || '',
      });
      // Cargar preferencia de notificaciones desde API (el profile trae el campo)
      authService.getMe().then(u => {
        if ((u as any).notifNuevoRegistro !== undefined) {
          setNotifNuevoRegistro((u as any).notifNuevoRegistro);
        }
        if ((u as any).notifEmail !== undefined) {
          setNotifEmail((u as any).notifEmail);
        }
      }).catch(() => {});
    }
  }, [currentUser]);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    nueva: '',
    confirmar: '',
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (currentUser?.id) {
        await usuarioService.update(String(currentUser.id), {
          nombre: profile.nombre,
          telefono: profile.telefono,
        });
      }
      toast.success('Configuración guardada', 'Los cambios se han guardado correctamente.');
    } catch {
      toast.error('Error al guardar', 'No se pudieron guardar los cambios. Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.nueva !== passwordForm.confirmar) {
      toast.error('Error', 'Las contraseñas no coinciden');
      return;
    }
    if (passwordForm.nueva.length < 6) {
      toast.error('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    try {
      await authService.changePassword({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.nueva,
      });
      toast.success('Contraseña cambiada', 'Tu contraseña se ha actualizado correctamente.');
      setPasswordForm({ current: '', nueva: '', confirmar: '' });
    } catch {
      toast.error('Error', 'No se pudo cambiar la contraseña. Verifica tu contraseña actual.');
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'perfil':
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                <User size={32} />
              </div>
              <div>
                <p className="text-xs text-neutral-500 mt-2">JPG, PNG o GIF. Máximo 2MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Nombre completo"
                value={profile.nombre}
                onChange={(e) => setProfile({ ...profile, nombre: e.target.value })}
              />
              <Input
                label="Correo electrónico"
                type="email"
                value={profile.email}
                readOnly
                disabled
                className="opacity-60 cursor-not-allowed"
              />
              <Input
                label="Teléfono"
                value={profile.telefono}
                onChange={(e) => setProfile({ ...profile, telefono: e.target.value })}
              />
              <Input
                label="Cargo / Rol"
                value={profile.cargo}
                readOnly
                disabled
                className="opacity-60 cursor-not-allowed"
              />
            </div>
          </div>
        );

      case 'seguridad':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h4 className="font-medium text-neutral-900 mb-4">Cambiar contraseña</h4>
              <div className="space-y-4 max-w-md">
                <Input
                  type="password"
                  label="Contraseña actual"
                  placeholder="••••••••"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                />
                <Input
                  type="password"
                  label="Nueva contraseña"
                  placeholder="••••••••"
                  value={passwordForm.nueva}
                  onChange={(e) => setPasswordForm({ ...passwordForm, nueva: e.target.value })}
                />
                <Input
                  type="password"
                  label="Confirmar contraseña"
                  placeholder="••••••••"
                  value={passwordForm.confirmar}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmar: e.target.value })}
                />
                <Button onClick={handleChangePassword}>Cambiar contraseña</Button>
              </div>
            </div>
          </div>
        );

      case 'apariencia':
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Tour & Onboarding reset */}
            <div>
              <h4 className="font-medium text-neutral-900 mb-4">Ayuda y tour</h4>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                    <HelpCircle size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900">Tour guiado</p>
                    <p className="text-sm text-neutral-500">
                      Reinicia el tour de bienvenida y las pantallas de introduccion por rol para verlos nuevamente.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={() => {
                    resetOnboardingTour();
                    resetDemoOnboarding();
                    toast.success('Tour reiniciado', 'El tour se mostrara al recargar la pagina.');
                  }}
                >
                  Reiniciar tour
                </Button>
              </div>
            </div>

            {/* PWA Install */}
            <div>
              <h4 className="font-medium text-neutral-900 mb-4">Aplicacion</h4>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                    <Download size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900">Instalar SITREP</p>
                    <p className="text-sm text-neutral-500">
                      Instala la app en tu dispositivo para acceso rapido, funcionamiento offline y notificaciones.
                    </p>
                  </div>
                </div>
                <div className="max-w-xs">
                  <InstallPWAButton />
                </div>
              </div>
            </div>
          </div>
        );

      case 'notificaciones':
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Visible a todos los usuarios */}
            <div>
              <h4 className="font-medium text-neutral-900 mb-1">Alertas del sistema</h4>
              <p className="text-sm text-neutral-500 mb-4">
                Configurá si querés recibir una copia por email de las alertas que te corresponden según tu rol.
              </p>
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-neutral-200">
                <div>
                  <p className="font-medium text-neutral-900 text-sm">Recibir alertas por email</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Las alertas del sistema también llegarán a tu correo registrado
                  </p>
                </div>
                <button
                  disabled={savingNotif}
                  onClick={() => handleToggleNotif('notifEmail', !notifEmail)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${notifEmail ? 'bg-[#1B5E3C]' : 'bg-neutral-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifEmail ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Solo para ADMIN */}
            {isAdmin && (
              <div>
                <h4 className="font-medium text-neutral-900 mb-1">Avisos de nuevos registros</h4>
                <p className="text-sm text-neutral-500 mb-4">
                  Configurá si querés recibir un email cuando un usuario verifique su dirección
                  y quede pendiente de tu aprobación.
                </p>
                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-neutral-200">
                  <div>
                    <p className="font-medium text-neutral-900 text-sm">Nuevos usuarios pendientes de aprobación</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Recibir email cuando un usuario verifica su cuenta y espera ser activado
                    </p>
                  </div>
                  <button
                    disabled={savingNotif}
                    onClick={() => handleToggleNotif('notifNuevoRegistro', !notifNuevoRegistro)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${notifNuevoRegistro ? 'bg-[#1B5E3C]' : 'bg-neutral-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifNuevoRegistro ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const configSections = [
    ...BASE_SECTIONS,
    { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
  ];

  const handleToggleNotif = async (field: 'notifNuevoRegistro' | 'notifEmail', val: boolean) => {
    setSavingNotif(true);
    try {
      await api.put('/admin/preferencias-notificacion', { [field]: val });
      if (field === 'notifNuevoRegistro') {
        setNotifNuevoRegistro(val);
        toast.success('Preferencia guardada', val ? 'Recibirás emails de nuevos registros.' : 'No recibirás emails de nuevos registros.');
      } else {
        setNotifEmail(val);
        toast.success('Preferencia guardada', val ? 'Recibirás alertas por email.' : 'No recibirás alertas por email.');
      }
    } catch {
      toast.error('Error', 'No se pudo guardar la preferencia.');
    } finally {
      setSavingNotif(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Configuración</h2>
        <p className="text-neutral-600 mt-1">Personaliza tu experiencia en el sistema</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <Card className="lg:w-64 shrink-0">
          <nav className="space-y-1 animate-fade-in">
            {configSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-medium transition-all duration-200 ${
                    activeSection === section.id
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Icon size={20} />
                  {section.label}
                  <ChevronRight size={16} className="ml-auto opacity-50" />
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Main content */}
        <div className="flex-1">
          <Card>
            <CardHeader
              title={configSections.find((s) => s.id === activeSection)?.label}
            />
            <CardContent>{renderSection()}</CardContent>
          </Card>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} isLoading={isSaving} leftIcon={<Save size={18} />}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracionPage;
