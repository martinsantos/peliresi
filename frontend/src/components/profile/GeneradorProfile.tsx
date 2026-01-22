/**
 * GeneradorProfile - Componente de perfil para usuarios tipo Generador
 * Muestra información completa del generador incluyendo categorías Y-code
 * y todos los datos extendidos de inscripción, actividad y cumplimiento
 */

import React from 'react';
import {
  Factory,
  Building2,
  MapPin,
  Phone,
  Mail,
  Hash,
  AlertTriangle,
  FileText,
  Award,
  Briefcase,
  ClipboardList,
  BookOpen,
  CheckCircle,
  XCircle,
  FileCheck,
  MapPinned
} from 'lucide-react';
import { CategoriaBadges, CategoriasDetalle } from '../CategoriaBadges';
import type { GeneradorConCategorias } from '../../hooks/useCurrentActor';

interface GeneradorProfileProps {
  actor: GeneradorConCategorias;
}

export const GeneradorProfile: React.FC<GeneradorProfileProps> = ({ actor }) => {
  // Helper para formatear domicilio completo
  const formatDomicilio = (calle?: string, localidad?: string, depto?: string) => {
    const parts = [calle, localidad, depto].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const domicilioLegal = formatDomicilio(
    actor.domicilioLegalCalle,
    actor.domicilioLegalLocalidad,
    actor.domicilioLegalDepartamento
  );

  const domicilioReal = formatDomicilio(
    actor.domicilioRealCalle,
    actor.domicilioRealLocalidad,
    actor.domicilioRealDepartamento
  );

  return (
    <div className="actor-profile">
      <div className="actor-profile-header" style={{ borderLeft: '3px solid #a78bfa' }}>
        <Factory size={20} style={{ color: '#a78bfa' }} />
        <h2>Información del Generador</h2>
        {actor.cuitValido === false && (
          <span style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            background: 'rgba(251, 191, 36, 0.15)',
            color: '#fbbf24',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600
          }}>
            CUIT PENDIENTE VERIFICACIÓN
          </span>
        )}
      </div>

      <div className="actor-profile-content">
        {/* Sección: Datos de Inscripción */}
        {(actor.certificado || actor.expedienteInscripcion || actor.resolucionInscripcion) && (
          <div className="profile-section">
            <h3 className="profile-section-title">
              <Award size={16} style={{ color: '#22d3ee' }} />
              Datos de Inscripción
            </h3>
            <div className="actor-profile-grid">
              {actor.certificado && (
                <div className="actor-field">
                  <div className="actor-field-icon" style={{ background: 'rgba(34, 211, 238, 0.15)' }}>
                    <FileCheck size={16} style={{ color: '#22d3ee' }} />
                  </div>
                  <div className="actor-field-content">
                    <span className="actor-field-label">Certificado</span>
                    <span className="actor-field-value" style={{ fontFamily: 'monospace', color: '#22d3ee' }}>
                      {actor.certificado}
                    </span>
                  </div>
                </div>
              )}

              {actor.expedienteInscripcion && (
                <div className="actor-field">
                  <div className="actor-field-icon">
                    <FileText size={16} />
                  </div>
                  <div className="actor-field-content">
                    <span className="actor-field-label">Expediente de Inscripción</span>
                    <span className="actor-field-value" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                      {actor.expedienteInscripcion}
                    </span>
                  </div>
                </div>
              )}

              {actor.resolucionInscripcion && (
                <div className="actor-field">
                  <div className="actor-field-icon">
                    <ClipboardList size={16} />
                  </div>
                  <div className="actor-field-content">
                    <span className="actor-field-label">Resolución de Inscripción</span>
                    <span className="actor-field-value">{actor.resolucionInscripcion}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sección: Datos Principales */}
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

            {actor.actividad && (
              <div className="actor-field">
                <div className="actor-field-icon">
                  <Briefcase size={16} />
                </div>
                <div className="actor-field-content">
                  <span className="actor-field-label">Actividad</span>
                  <span className="actor-field-value">{actor.actividad}</span>
                </div>
              </div>
            )}

            {actor.rubro && (
              <div className="actor-field">
                <div className="actor-field-icon">
                  <Factory size={16} />
                </div>
                <div className="actor-field-content">
                  <span className="actor-field-label">Rubro</span>
                  <span className="actor-field-value">{actor.rubro}</span>
                </div>
              </div>
            )}

            {actor.clasificacion && (
              <div className="actor-field">
                <div className="actor-field-icon" style={{
                  background: actor.clasificacion === 'INDIVIDUAL' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(100, 116, 139, 0.15)'
                }}>
                  <Award size={16} style={{
                    color: actor.clasificacion === 'INDIVIDUAL' ? '#fbbf24' : '#64748b'
                  }} />
                </div>
                <div className="actor-field-content">
                  <span className="actor-field-label">Clasificación</span>
                  <span className="actor-field-value" style={{
                    color: actor.clasificacion === 'INDIVIDUAL' ? '#fbbf24' : '#94a3b8'
                  }}>
                    {actor.clasificacion}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha - Contacto */}
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
                <span className="actor-field-value" style={{ wordBreak: 'break-all' }}>
                  {actor.email || 'No registrado'}
                </span>
              </div>
            </div>

            <div className="actor-field">
              <div className="actor-field-icon" style={{ background: actor.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }}>
                {actor.activo ? (
                  <CheckCircle size={16} style={{ color: '#34d399' }} />
                ) : (
                  <XCircle size={16} style={{ color: '#f87171' }} />
                )}
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">Estado</span>
                <span className="actor-field-value" style={{ color: actor.activo ? '#34d399' : '#f87171' }}>
                  {actor.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>

            {actor.certificacionIso && (
              <div className="actor-field">
                <div className="actor-field-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                  <Award size={16} style={{ color: '#34d399' }} />
                </div>
                <div className="actor-field-content">
                  <span className="actor-field-label">Certificación ISO</span>
                  <span className="actor-field-value" style={{ color: '#34d399' }}>
                    {actor.certificacionIso}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sección: Domicilios */}
        <div className="profile-section" style={{ marginTop: '24px' }}>
          <h3 className="profile-section-title">
            <MapPinned size={16} style={{ color: '#a78bfa' }} />
            Domicilios
          </h3>
          <div className="actor-profile-grid">
            <div className="actor-field">
              <div className="actor-field-icon">
                <Building2 size={16} />
              </div>
              <div className="actor-field-content">
                <span className="actor-field-label">Domicilio Legal</span>
                <span className="actor-field-value">{domicilioLegal || actor.domicilio}</span>
              </div>
            </div>

            {domicilioReal && domicilioReal !== domicilioLegal && (
              <div className="actor-field">
                <div className="actor-field-icon">
                  <MapPin size={16} />
                </div>
                <div className="actor-field-content">
                  <span className="actor-field-label">Domicilio Real</span>
                  <span className="actor-field-value">{domicilioReal}</span>
                </div>
              </div>
            )}

            {actor.latitud && actor.longitud && (
              <div className="actor-field">
                <div className="actor-field-icon" style={{ background: 'rgba(167, 139, 250, 0.15)' }}>
                  <MapPin size={16} style={{ color: '#a78bfa' }} />
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
        </div>

        {/* Sección: Cumplimiento */}
        {(actor.libroOperatoria !== undefined || actor.tef || actor.ddjj2024 || actor.ddjj2025) && (
          <div className="profile-section" style={{ marginTop: '24px' }}>
            <h3 className="profile-section-title">
              <BookOpen size={16} style={{ color: '#4ade80' }} />
              Cumplimiento Normativo
            </h3>
            <div className="actor-profile-grid">
              {actor.libroOperatoria !== undefined && (
                <div className="actor-field">
                  <div className="actor-field-icon" style={{
                    background: actor.libroOperatoria ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'
                  }}>
                    <BookOpen size={16} style={{
                      color: actor.libroOperatoria ? '#34d399' : '#f87171'
                    }} />
                  </div>
                  <div className="actor-field-content">
                    <span className="actor-field-label">Libro de Operatoria</span>
                    <span className="actor-field-value" style={{
                      color: actor.libroOperatoria ? '#34d399' : '#f87171'
                    }}>
                      {actor.libroOperatoria ? 'SI' : 'NO'}
                    </span>
                  </div>
                </div>
              )}

              {actor.tef && (
                <div className="actor-field">
                  <div className="actor-field-icon">
                    <FileText size={16} />
                  </div>
                  <div className="actor-field-content">
                    <span className="actor-field-label">TEF 2025</span>
                    <span className="actor-field-value" style={{ fontFamily: 'monospace' }}>
                      {actor.tef}
                    </span>
                  </div>
                </div>
              )}

              {/* DDJJ más recientes */}
              {(actor.ddjj2025 || actor.ddjj2024) && (
                <div className="actor-field">
                  <div className="actor-field-icon">
                    <ClipboardList size={16} />
                  </div>
                  <div className="actor-field-content">
                    <span className="actor-field-label">DDJJ Recientes</span>
                    <div className="ddjj-list" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {actor.ddjj2025 && (
                        <span className="ddjj-badge" style={{
                          padding: '2px 8px',
                          background: 'rgba(34, 211, 238, 0.15)',
                          color: '#22d3ee',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}>
                          2025: {actor.ddjj2025}
                        </span>
                      )}
                      {actor.ddjj2024 && (
                        <span className="ddjj-badge" style={{
                          padding: '2px 8px',
                          background: 'rgba(100, 116, 139, 0.15)',
                          color: '#94a3b8',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}>
                          2024: {actor.ddjj2024}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Métricas de residuos */}
              {(actor.residuosR || actor.residuosMxR) && (
                <div className="actor-field">
                  <div className="actor-field-icon" style={{ background: 'rgba(251, 191, 36, 0.15)' }}>
                    <AlertTriangle size={16} style={{ color: '#fbbf24' }} />
                  </div>
                  <div className="actor-field-content">
                    <span className="actor-field-label">Métricas de Residuos</span>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                      {actor.residuosR && (
                        <span style={{ fontSize: '12px' }}>
                          <strong style={{ color: '#fbbf24' }}>R:</strong> {actor.residuosR}
                        </span>
                      )}
                      {actor.residuosMxR && (
                        <span style={{ fontSize: '12px' }}>
                          <strong style={{ color: '#fbbf24' }}>M×R:</strong> {actor.residuosMxR}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
};

export default GeneradorProfile;
