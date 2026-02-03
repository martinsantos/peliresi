/**
 * SITREP v6 - Configuración Page
 * ==============================
 * Página de configuración del sistema
 */

import React, { useState } from 'react';
import {
  User,
  Bell,
  Shield,
  Palette,
  Mail,
  Smartphone,
  Save,
  Moon,
  Sun,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { toast } from '../../components/ui/Toast';

// Secciones de configuración
const configSections = [
  { id: 'perfil', label: 'Perfil', icon: User },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { id: 'seguridad', label: 'Seguridad', icon: Shield },
  { id: 'apariencia', label: 'Apariencia', icon: Palette },
];

const ConfiguracionPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('perfil');
  const [isSaving, setIsSaving] = useState(false);

  // Profile form state
  const [profile, setProfile] = useState({
    nombre: 'Administrador',
    email: 'admin@dgfa.mendoza.gov.ar',
    telefono: '+54 261 123 4567',
    cargo: 'Administrador de Sistema',
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    manifiestos: true,
    alertas: true,
    reportes: false,
  });

  // Appearance settings
  const [appearance, setAppearance] = useState({
    theme: 'light',
    language: 'es',
  });

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast.success('Configuración guardada', 'Los cambios se han guardado correctamente.');
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
                <Button variant="outline" size="sm">Cambiar foto</Button>
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
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
              <Input
                label="Teléfono"
                value={profile.telefono}
                onChange={(e) => setProfile({ ...profile, telefono: e.target.value })}
              />
              <Input
                label="Cargo"
                value={profile.cargo}
                onChange={(e) => setProfile({ ...profile, cargo: e.target.value })}
              />
            </div>
          </div>
        );

      case 'notificaciones':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h4 className="font-medium text-neutral-900 mb-4">Canales de notificación</h4>
              <div className="space-y-4 animate-fade-in">
                {[
                  { key: 'email', label: 'Correo electrónico', icon: Mail, desc: 'Recibir notificaciones por email' },
                  { key: 'push', label: 'Notificaciones push', icon: Smartphone, desc: 'Recibir notificaciones en el navegador' },
                  { key: 'sms', label: 'SMS', icon: Smartphone, desc: 'Recibir notificaciones por mensaje de texto' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl cursor-pointer hover:bg-neutral-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg text-neutral-600">
                        <item.icon size={18} />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">{item.label}</p>
                        <p className="text-sm text-neutral-500">{item.desc}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications[item.key as keyof typeof notifications]}
                      onChange={(e) =>
                        setNotifications({ ...notifications, [item.key]: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'seguridad':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h4 className="font-medium text-neutral-900 mb-4">Cambiar contraseña</h4>
              <div className="space-y-4 max-w-md">
                <Input type="password" label="Contraseña actual" placeholder="••••••••" />
                <Input type="password" label="Nueva contraseña" placeholder="••••••••" />
                <Input type="password" label="Confirmar contraseña" placeholder="••••••••" />
                <Button>Cambiar contraseña</Button>
              </div>
            </div>
          </div>
        );

      case 'apariencia':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h4 className="font-medium text-neutral-900 mb-4">Tema</h4>
              <div className="flex gap-4">
                <button
                  onClick={() => setAppearance({ ...appearance, theme: 'light' })}
                  className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
                    appearance.theme === 'light'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="w-16 h-16 bg-white rounded-lg shadow-2 flex items-center justify-center">
                    <Sun size={28} className="text-warning-500" />
                  </div>
                  <span className="font-medium text-neutral-900">Claro</span>
                </button>
                <button
                  onClick={() => setAppearance({ ...appearance, theme: 'dark' })}
                  className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
                    appearance.theme === 'dark'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="w-16 h-16 bg-neutral-800 rounded-lg shadow-2 flex items-center justify-center">
                    <Moon size={28} className="text-primary-400" />
                  </div>
                  <span className="font-medium text-neutral-900">Oscuro</span>
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
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
