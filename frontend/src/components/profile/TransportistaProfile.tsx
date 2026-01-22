/**
 * TransportistaProfile - Componente de perfil para usuarios tipo Transportista
 * Muestra información del transportista, vehículos y choferes
 */

import React from 'react';
import {
  Truck,
  Building2,
  MapPin,
  Phone,
  Mail,
  Hash,
  User,
  FileText,
  Car,
  Users
} from 'lucide-react';
import type { TransportistaExtendido } from '../../hooks/useCurrentActor';

interface TransportistaProfileProps {
  actor: TransportistaExtendido;
}

export const TransportistaProfile: React.FC<TransportistaProfileProps> = ({ actor }) => {
  return (
    <div className="actor-profile">
      <div className="actor-profile-header" style={{ borderLeft: '3px solid #fbbf24' }}>
        <Truck size={20} style={{ color: '#fbbf24' }} />
        <h2>Información del Transportista</h2>
      </div>

      <div className="actor-profile-content">
        <div className="actor-profile-grid">
          {/* Columna izquierda - Datos básicos */}
          <div className="actor-profile-column">
            <div className="actor-field">
              <div className="actor-field-icon">
                <Building2 size={16} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">Razón Social</span>
                <span className="actor-field-value">{actor.razonSocial}</span>
              </div>
            </div>

            <div className="actor-field">
              <div className="actor-field-icon">
                <Hash size={16} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">CUIT</span>
                <span className="actor-field-value" style={{ fontFamily: 'monospace' }}>
                  {actor.cuit}
                </span>
              </div>
            </div>

            <div className="actor-field">
              <div className="actor-field-icon">
                <MapPin size={16} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">Domicilio</span>
                <span className="actor-field-value">{actor.domicilio}</span>
              </div>
            </div>

            <div className="actor-field">
              <div className="actor-field-icon">
                <FileText size={16} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">N° de Habilitación</span>
                <span className="actor-field-value" style={{ fontFamily: 'monospace', color: '#22d3ee' }}>
                  {actor.numeroHabilitacion || 'Sin número'}
                </span>
              </div>
            </div>
          </div>

          {/* Columna derecha - Contacto y resumen */}
          <div className="actor-profile-column">
            <div className="actor-field">
              <div className="actor-field-icon">
                <Phone size={16} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">Teléfono</span>
                <span className="actor-field-value">{actor.telefono || 'No registrado'}</span>
              </div>
            </div>

            <div className="actor-field">
              <div className="actor-field-icon">
                <Mail size={16} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">Email</span>
                <span className="actor-field-value">{actor.email || 'No registrado'}</span>
              </div>
            </div>

            <div className="actor-field">
              <div className="actor-field-icon" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
                <Car size={16} style={{ color: '#22d3ee' }} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">Vehículos Activos</span>
                <span className="actor-field-value" style={{ color: '#22d3ee', fontWeight: 600 }}>
                  {actor.vehiculosActivos} de {actor.vehiculos?.length || 0}
                </span>
              </div>
            </div>

            <div className="actor-field">
              <div className="actor-field-icon" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                <Users size={16} style={{ color: '#a78bfa' }} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">Choferes Activos</span>
                <span className="actor-field-value" style={{ color: '#a78bfa', fontWeight: 600 }}>
                  {actor.choferesActivos} de {actor.choferes?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Vehículos */}
        {actor.vehiculos && actor.vehiculos.length > 0 && (
          <div className="categorias-section">
            <h3>
              <Car size={18} style={{ color: '#22d3ee' }} />
              Flota de Vehículos
            </h3>
            <div className="vehiculos-list">
              {actor.vehiculos.map((vehiculo) => (
                <div key={vehiculo.id} className="vehiculo-item">
                  <div className="vehiculo-item-icon">
                    <Truck size={20} />
                  </div>
                  <div className="vehiculo-item-info">
                    <div className="vehiculo-item-name">
                      {vehiculo.patente}
                    </div>
                    <div className="vehiculo-item-detail">
                      {vehiculo.marca} {vehiculo.modelo} ({vehiculo.anio}) - Cap. {vehiculo.capacidad} kg
                    </div>
                  </div>
                  <span className={`vehiculo-item-badge ${vehiculo.activo ? 'activo' : 'inactivo'}`}>
                    {vehiculo.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Choferes */}
        {actor.choferes && actor.choferes.length > 0 && (
          <div className="categorias-section">
            <h3>
              <Users size={18} style={{ color: '#a78bfa' }} />
              Choferes Registrados
            </h3>
            <div className="choferes-list">
              {actor.choferes.map((chofer) => (
                <div key={chofer.id} className="chofer-item">
                  <div className="chofer-item-icon">
                    <User size={20} />
                  </div>
                  <div className="chofer-item-info">
                    <div className="chofer-item-name">
                      {chofer.nombre} {chofer.apellido}
                    </div>
                    <div className="chofer-item-detail">
                      DNI: {chofer.dni} | Lic: {chofer.licencia}
                      {chofer.vencimiento && (
                        <> | Vence: {new Date(chofer.vencimiento).toLocaleDateString('es-AR')}</>
                      )}
                    </div>
                  </div>
                  <span className={`chofer-item-badge ${chofer.activo ? 'activo' : 'inactivo'}`}>
                    {chofer.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransportistaProfile;
