/**
 * OperadorProfile - Componente de perfil para usuarios tipo Operador
 * Muestra información del operador, categorías y tratamientos autorizados
 */

import React from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Hash,
  FileText,
  AlertTriangle,
  Recycle,
  Beaker
} from 'lucide-react';
import { CategoriaBadges, CategoriasDetalle } from '../CategoriaBadges';
import type { OperadorConCategorias } from '../../hooks/useCurrentActor';

interface OperadorProfileProps {
  actor: OperadorConCategorias;
}

export const OperadorProfile: React.FC<OperadorProfileProps> = ({ actor }) => {
  return (
    <div className="actor-profile">
      <div className="actor-profile-header" style={{ borderLeft: '3px solid #4ade80' }}>
        <Building2 size={20} style={{ color: '#4ade80' }} />
        <h2>Información del Operador</h2>
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

            {actor.latitud && actor.longitud && (
              <div className="actor-field">
                <div className="actor-field-icon">
                  <MapPin size={16} />
                </div>
                <div className="actor-field-content">
                  <span className="actor-field-label">Coordenadas GPS</span>
                  <span className="actor-field-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {actor.latitud.toFixed(6)}, {actor.longitud.toFixed(6)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha - Contacto e inscripción */}
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

            <div className="actor-field">
              <div className="actor-field-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                <Recycle size={16} style={{ color: '#34d399' }} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">Tratamientos Activos</span>
                <span className="actor-field-value" style={{ color: '#34d399', fontWeight: 600 }}>
                  {actor.tratamientosActivos} de {actor.tratamientos?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Categorías Autorizadas */}
        <div className="categorias-section">
          <h3>
            <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
            Categorías Autorizadas de Residuos
          </h3>

          {actor.categoriasParsed && actor.categoriasParsed.length > 0 ? (
            <>
              {/* Vista compacta */}
              <div style={{ marginBottom: '16px' }}>
                <CategoriaBadges
                  categorias={actor.categoria}
                  showPeligrosidad={true}
                  maxVisible={10}
                  size="sm"
                />
              </div>

              {/* Vista detallada */}
              <CategoriasDetalle categorias={actor.categoria} />
            </>
          ) : (
            <div style={{
              padding: '24px',
              background: 'rgba(100, 116, 139, 0.1)',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <AlertTriangle size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No hay categorías de residuos asignadas</p>
            </div>
          )}
        </div>

        {/* Lista de Tratamientos Autorizados */}
        {actor.tratamientos && actor.tratamientos.length > 0 && (
          <div className="categorias-section">
            <h3>
              <Beaker size={18} style={{ color: '#22d3ee' }} />
              Tratamientos Autorizados
            </h3>
            <div className="tratamientos-list">
              {actor.tratamientos.map((tratamiento) => (
                <div key={tratamiento.id} className="tratamiento-item">
                  <div className="tratamiento-item-icon">
                    <Recycle size={20} />
                  </div>
                  <div className="tratamiento-item-info">
                    <div className="tratamiento-item-name">
                      {tratamiento.metodo}
                    </div>
                    <div className="tratamiento-item-detail">
                      {tratamiento.tipoResiduo?.nombre || 'Tipo no especificado'}
                      {tratamiento.descripcion && ` - ${tratamiento.descripcion}`}
                      {tratamiento.capacidad && (
                        <> | Capacidad: {tratamiento.capacidad} kg/día</>
                      )}
                    </div>
                  </div>
                  <span className={`tratamiento-item-badge ${tratamiento.activo ? 'activo' : 'inactivo'}`}>
                    {tratamiento.activo ? 'Activo' : 'Inactivo'}
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

export default OperadorProfile;
