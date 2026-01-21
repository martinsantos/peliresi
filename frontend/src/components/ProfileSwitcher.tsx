/**
 * ProfileSwitcher - Componente para cambio de perfil en modo DEMO
 * Permite seleccionar rol y actor específico sin re-login
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Factory,
  Truck,
  Building2,
  ChevronRight,
  ChevronLeft,
  Check,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { demoService, type DemoRole, type DemoActor, type DemoProfilesResponse } from '../services/demo.service';
import './ProfileSwitcher.css';

interface ProfileSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileChanged: () => void;
  currentUserEmail?: string; // Optional, for future use
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  ADMIN: Shield,
  GENERADOR: Factory,
  TRANSPORTISTA: Truck,
  OPERADOR: Building2
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#8b5cf6',
  GENERADOR: '#f59e0b',
  TRANSPORTISTA: '#3b82f6',
  OPERADOR: '#10b981'
};

const ProfileSwitcher: React.FC<ProfileSwitcherProps> = ({
  isOpen,
  onClose,
  onProfileChanged
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DemoProfilesResponse | null>(null);
  const [selectedRole, setSelectedRole] = useState<DemoRole | null>(null);
  const [activeProfile, setActiveProfile] = useState(demoService.getActiveProfile());

  // Cargar perfiles al abrir
  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await demoService.getAvailableProfiles();
      setProfiles(data);
    } catch (err: any) {
      console.error('Error cargando perfiles:', err);
      if (err.response?.status === 403) {
        setError('El modo demo no está habilitado en este ambiente');
      } else {
        setError('Error al cargar perfiles disponibles');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = (role: DemoRole) => {
    if (role.actors.length === 0) {
      // Rol sin actores (ADMIN) - aplicar directamente
      applyProfile(role.role, role.name);
    } else {
      // Mostrar actores disponibles
      setSelectedRole(role);
    }
  };

  const handleSelectActor = (actor: DemoActor) => {
    if (selectedRole) {
      applyProfile(selectedRole.role, selectedRole.name, actor.id, actor.name);
    }
  };

  const applyProfile = async (role: string, roleName: string, actorId?: string, actorName?: string) => {
    try {
      // Validar perfil
      await demoService.validateProfile(role, actorId);

      // Aplicar perfil con nombres para mostrar en UI
      demoService.setActiveProfile({ role, roleName, actorId, actorName });
      setActiveProfile(demoService.getActiveProfile());

      // Notificar cambio
      onProfileChanged();

      // Cerrar después de un momento para mostrar feedback
      // NO reload - el evento demoProfileChanged ya actualiza AuthContext via React
      setTimeout(() => {
        onClose();
        navigate('/dashboard');
      }, 300);
    } catch (err: any) {
      console.error('Error aplicando perfil:', err);
      setError(err.response?.data?.error?.message || 'Error al aplicar perfil');
    }
  };

  const handleClearProfile = () => {
    demoService.clearProfile();
    setActiveProfile(null);
    onProfileChanged();
    // NO reload - React actualiza automáticamente
    setTimeout(() => {
      onClose();
      navigate('/dashboard');
    }, 300);
  };

  const handleBack = () => {
    setSelectedRole(null);
  };

  if (!isOpen) return null;

  const Icon = selectedRole ? ROLE_ICONS[selectedRole.role] : null;

  return (
    <div className="profile-switcher-overlay" onClick={onClose}>
      <div className="profile-switcher-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="profile-switcher-header">
          {selectedRole ? (
            <>
              <button className="back-btn" onClick={handleBack}>
                <ChevronLeft size={20} />
              </button>
              <div className="header-title">
                {Icon && <Icon size={20} style={{ color: ROLE_COLORS[selectedRole.role] }} />}
                <span>{selectedRole.name}</span>
              </div>
            </>
          ) : (
            <div className="header-title">
              <span>Cambiar Perfil Demo</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="profile-switcher-content">
          {loading ? (
            <div className="loading-state">
              <RefreshCw className="spin" size={24} />
              <span>Cargando perfiles...</span>
            </div>
          ) : error ? (
            <div className="error-state">
              <AlertCircle size={24} />
              <span>{error}</span>
              <button onClick={loadProfiles}>Reintentar</button>
            </div>
          ) : selectedRole ? (
            // Lista de actores
            <div className="actors-list">
              <p className="actors-hint">{selectedRole.description}</p>
              {selectedRole.actors.map(actor => {
                const isActive = activeProfile?.role === selectedRole.role &&
                                 activeProfile?.actorId === actor.id;
                return (
                  <button
                    key={actor.id}
                    className={`actor-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectActor(actor)}
                  >
                    <div className="actor-info">
                      <span className="actor-name">{actor.name}</span>
                      <span className="actor-detail">{actor.cuit} - {actor.detail}</span>
                    </div>
                    {isActive && <Check size={18} className="check-icon" />}
                  </button>
                );
              })}
            </div>
          ) : (
            // Lista de roles
            <div className="roles-list">
              {activeProfile && (
                <div className="current-profile-banner">
                  <span>Perfil activo: <strong>{activeProfile.roleName || activeProfile.role}</strong></span>
                  <button onClick={handleClearProfile}>Volver a mi perfil</button>
                </div>
              )}

              <p className="roles-hint">
                Selecciona un perfil para probar el sistema como otro usuario
              </p>

              {profiles?.availableRoles.map(role => {
                const RoleIcon = ROLE_ICONS[role.role] || Shield;
                const isActive = activeProfile?.role === role.role && !activeProfile?.actorId;
                const hasActors = role.actors.length > 0;

                return (
                  <button
                    key={role.role}
                    className={`role-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectRole(role)}
                    style={{ '--role-color': ROLE_COLORS[role.role] } as React.CSSProperties}
                  >
                    <div className="role-icon">
                      <RoleIcon size={24} />
                    </div>
                    <div className="role-info">
                      <span className="role-name">{role.name}</span>
                      <span className="role-desc">{role.description}</span>
                      {hasActors && (
                        <span className="role-count">{role.actors.length} disponibles</span>
                      )}
                    </div>
                    {hasActors ? (
                      <ChevronRight size={20} className="arrow-icon" />
                    ) : isActive ? (
                      <Check size={20} className="check-icon" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="profile-switcher-footer">
          <span className="footer-note">
            Los cambios son temporales y no afectan tu cuenta real
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfileSwitcher;
