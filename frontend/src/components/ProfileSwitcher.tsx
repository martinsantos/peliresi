/**
 * ProfileSwitcher - Componente para cambio de perfil en modo DEMO
 * Permite seleccionar rol y actor específico sin re-login
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  AlertCircle,
  Search,
  X
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

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedActors, setSearchedActors] = useState<DemoActor[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced search function
  const performSearch = useCallback(async (term: string, role: string) => {
    if (!term.trim()) {
      setSearchedActors(null);
      setSearchTotal(0);
      setHasMore(false);
      return;
    }

    setSearchLoading(true);
    try {
      const result = await demoService.searchActors(role, term, 50);
      setSearchedActors(result.actors);
      setSearchTotal(result.total);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Error buscando actores:', err);
      setSearchedActors([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Handle search input change with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      if (selectedRole) {
        performSearch(value, selectedRole.role);
      }
    }, 300);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchedActors(null);
    setSearchTotal(0);
    setHasMore(false);
    searchInputRef.current?.focus();
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Focus search input when selecting a role with actors
  useEffect(() => {
    if (selectedRole && selectedRole.actors.length > 0) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [selectedRole]);

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
    // Reset search state
    setSearchTerm('');
    setSearchedActors(null);
    setSearchTotal(0);
    setHasMore(false);
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
            // Lista de actores con búsqueda
            <div className="actors-list">
              <p className="actors-hint">{selectedRole.description}</p>

              {/* Search Input */}
              <div className="actors-search">
                <div className="actors-search-input-wrapper">
                  <Search size={16} className="actors-search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar por nombre o CUIT..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="actors-search-input"
                  />
                  {searchTerm && (
                    <button className="actors-search-clear" onClick={handleClearSearch}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                {searchLoading && (
                  <RefreshCw size={16} className="actors-search-loading spin" />
                )}
              </div>

              {/* Search Results Info */}
              {searchTerm && !searchLoading && searchedActors !== null && (
                <div className="actors-search-info">
                  {searchedActors.length === 0 ? (
                    <span className="actors-search-no-results">
                      No se encontraron resultados para "{searchTerm}"
                    </span>
                  ) : (
                    <span className="actors-search-count">
                      {searchTotal} resultado{searchTotal !== 1 ? 's' : ''}
                      {hasMore && ' (mostrando primeros 50)'}
                    </span>
                  )}
                </div>
              )}

              {/* Actors List - Scrollable */}
              <div className="actors-list-scrollable">
                {(searchedActors ?? selectedRole.actors).map(actor => {
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
