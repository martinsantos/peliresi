/**
 * MiPerfil - Página de perfil del usuario actual
 * Muestra información del usuario y su actor asociado (Generador/Transportista/Operador)
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  useCurrentActor,
  type GeneradorConCategorias,
  type TransportistaExtendido,
  type OperadorConCategorias
} from '../hooks/useCurrentActor';
import {
  User,
  Mail,
  Phone,
  Shield,
  Building2,
  Truck,
  Factory,
  RefreshCw,
  CheckCircle,
  XCircle,
  FileText,
  Calendar
} from 'lucide-react';
import { GeneradorProfile } from '../components/profile/GeneradorProfile';
import { TransportistaProfile } from '../components/profile/TransportistaProfile';
import { OperadorProfile } from '../components/profile/OperadorProfile';
import './MiPerfil.css';

const MiPerfil: React.FC = () => {
  const { user, effectiveRole, effectiveRoleName } = useAuth();
  const { actor, tipoActor, loading, error, stats, refetch } = useCurrentActor();

  // Determinar si estamos viendo un perfil de actor (modo demo o usuario actor real)
  const isActorProfile = tipoActor && actor;

  // Obtener nombre del perfil a mostrar
  const getProfileName = () => {
    if (isActorProfile && actor) {
      return (actor as any).razonSocial || `${user?.nombre} ${user?.apellido}`;
    }
    return `${user?.nombre} ${user?.apellido}`;
  };

  const getRolIcon = () => {
    switch (effectiveRole) {
      case 'ADMIN':
        return <Shield size={48} />;
      case 'GENERADOR':
      case 'ADMIN_GENERADORES':
        return <Factory size={48} />;
      case 'TRANSPORTISTA':
      case 'ADMIN_TRANSPORTISTAS':
        return <Truck size={48} />;
      case 'OPERADOR':
      case 'ADMIN_OPERADORES':
        return <Building2 size={48} />;
      default:
        return <User size={48} />;
    }
  };

  const getRolColor = () => {
    switch (effectiveRole) {
      case 'ADMIN':
        return '#4d9fff';
      case 'GENERADOR':
      case 'ADMIN_GENERADORES':
        return '#a78bfa';
      case 'TRANSPORTISTA':
      case 'ADMIN_TRANSPORTISTAS':
        return '#fbbf24';
      case 'OPERADOR':
      case 'ADMIN_OPERADORES':
        return '#4ade80';
      default:
        return '#94a3b8';
    }
  };

  // Determinar si el actor está activo
  const isActorActivo = isActorProfile ? (actor as any)?.activo : user?.activo;

  return (
    <div className="mi-perfil">
      {/* Header con Avatar */}
      <div className="perfil-header" style={{ borderColor: getRolColor() }}>
        <div className="perfil-avatar" style={{ background: `${getRolColor()}20`, color: getRolColor() }}>
          {getRolIcon()}
        </div>
        <div className="perfil-header-info">
          <h1>{getProfileName()}</h1>
          <div className="perfil-rol" style={{ color: getRolColor() }}>
            {effectiveRoleName}
          </div>
          <div className="perfil-badges">
            {isActorActivo ? (
              <span className="perfil-badge perfil-badge--success">
                <CheckCircle size={12} />
                Activo
              </span>
            ) : (
              <span className="perfil-badge perfil-badge--danger">
                <XCircle size={12} />
                Inactivo
              </span>
            )}
          </div>
        </div>
        <button className="perfil-refresh-btn" onClick={refetch} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Grid de contenido */}
      <div className="perfil-grid">
        {/* Información - Solo mostrar cuando no hay actor (es admin sin demo mode) */}
        {!isActorProfile && (
          <div className="perfil-section">
            <h2 className="perfil-section-title">
              <User size={20} />
              Información del Usuario
            </h2>
            <div className="perfil-card">
              <div className="perfil-field">
                <Mail size={16} className="perfil-field-icon" />
                <div>
                  <span className="perfil-field-label">Email</span>
                  <span className="perfil-field-value">{user?.email}</span>
                </div>
              </div>
              {user?.telefono && (
                <div className="perfil-field">
                  <Phone size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">Teléfono</span>
                    <span className="perfil-field-value">{user.telefono}</span>
                  </div>
                </div>
              )}
              {user?.empresa && (
                <div className="perfil-field">
                  <Building2 size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">Empresa</span>
                    <span className="perfil-field-value">{user.empresa}</span>
                  </div>
                </div>
              )}
              <div className="perfil-field">
                <Calendar size={16} className="perfil-field-icon" />
                <div>
                  <span className="perfil-field-label">Registro</span>
                  <span className="perfil-field-value">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-AR') : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Estadísticas */}
        {stats && (
          <div className="perfil-section">
            <h2 className="perfil-section-title">
              <FileText size={20} />
              Estadísticas
            </h2>
            <div className="perfil-stats-grid">
              <div className="perfil-stat-card">
                <div className="perfil-stat-value">{stats.manifiestosTotales}</div>
                <div className="perfil-stat-label">Manifiestos Totales</div>
              </div>
              <div className="perfil-stat-card">
                <div className="perfil-stat-value">{stats.manifestosMes}</div>
                <div className="perfil-stat-label">Este Mes</div>
              </div>
              <div className="perfil-stat-card">
                <div className="perfil-stat-value">{stats.manifestosActivos}</div>
                <div className="perfil-stat-label">Activos</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Información del Actor */}
      {loading ? (
        <div className="perfil-loading">
          <RefreshCw size={24} className="spin" />
          <span>Cargando información del perfil...</span>
        </div>
      ) : error && effectiveRole !== 'ADMIN' ? (
        <div className="perfil-error">
          <XCircle size={24} />
          <span>{error}</span>
          <button onClick={refetch}>Reintentar</button>
        </div>
      ) : tipoActor === 'generador' && actor ? (
        <GeneradorProfile actor={actor as GeneradorConCategorias} />
      ) : tipoActor === 'transportista' && actor ? (
        <TransportistaProfile actor={actor as TransportistaExtendido} />
      ) : tipoActor === 'operador' && actor ? (
        <OperadorProfile actor={actor as OperadorConCategorias} />
      ) : effectiveRole === 'ADMIN' ? (
        <div className="perfil-admin-notice">
          <Shield size={32} />
          <h3>Administrador del Sistema</h3>
          <p>Como administrador, tienes acceso completo a todas las funciones del sistema.</p>
          <p className="perfil-admin-hint">Usa el modo demo para visualizar el sistema como otro rol.</p>
        </div>
      ) : null}
    </div>
  );
};

export default MiPerfil;
