/**
 * TripRecoveryModal - FASE 3
 * Modal que aparece cuando se detecta un viaje interrumpido
 * Permite al usuario recuperar o descartar el viaje
 */

import React from 'react';
import { Navigation, Clock, MapPin, AlertTriangle, Play, Trash2 } from 'lucide-react';
import type { ActiveTrip } from '../../services/offlineStorage';

interface TripRecoveryModalProps {
    savedTrip: ActiveTrip;
    onResume: () => void;
    onDiscard: () => void;
}

const TripRecoveryModal: React.FC<TripRecoveryModalProps> = ({
    savedTrip,
    onResume,
    onDiscard
}) => {
    // Calcular tiempo transcurrido
    const calculateElapsedTime = (): string => {
        const now = savedTrip.pausedAt || Date.now();
        const elapsed = Math.floor((now - savedTrip.startTimestamp - savedTrip.totalPausedMs) / 1000);
        const hrs = Math.floor(elapsed / 3600);
        const mins = Math.floor((elapsed % 3600) / 60);
        const secs = elapsed % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Calcular distancia
    const calculateDistance = (): string => {
        if (savedTrip.routePoints.length < 2) return '0.0';
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        let total = 0;
        for (let i = 1; i < savedTrip.routePoints.length; i++) {
            const lat1 = savedTrip.routePoints[i - 1].lat;
            const lon1 = savedTrip.routePoints[i - 1].lng;
            const lat2 = savedTrip.routePoints[i].lat;
            const lon2 = savedTrip.routePoints[i].lng;
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        return total.toFixed(1);
    };

    // Formatear fecha de inicio
    const formatStartTime = (): string => {
        const date = new Date(savedTrip.startTimestamp);
        return date.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleDiscard = () => {
        if (window.confirm('¿Seguro que desea descartar este viaje? Los datos se perderán.')) {
            onDiscard();
        }
    };

    return (
        <>
            <div className="trip-recovery-overlay">
                <div className="trip-recovery-modal">
                    {/* Header con icono */}
                    <div className="modal-header">
                        <div className="icon-container warning">
                            <AlertTriangle size={32} />
                        </div>
                        <h2>Viaje Interrumpido</h2>
                        <p>Se encontró un viaje sin finalizar</p>
                    </div>

                    {/* Info del viaje */}
                    <div className="trip-info-card">
                        <div className="info-row">
                            <span className="label">Iniciado</span>
                            <span className="value">{formatStartTime()}</span>
                        </div>

                        <div className="stats-row">
                            <div className="stat">
                                <Clock size={20} />
                                <span className="stat-value">{calculateElapsedTime()}</span>
                                <span className="stat-label">Duración</span>
                            </div>
                            <div className="stat-divider" />
                            <div className="stat">
                                <Navigation size={20} />
                                <span className="stat-value">{calculateDistance()} km</span>
                                <span className="stat-label">Distancia</span>
                            </div>
                            <div className="stat-divider" />
                            <div className="stat">
                                <MapPin size={20} />
                                <span className="stat-value">{savedTrip.routePoints.length}</span>
                                <span className="stat-label">Puntos GPS</span>
                            </div>
                        </div>

                        {savedTrip.isPaused && (
                            <div className="paused-badge">
                                <span>PAUSADO</span>
                            </div>
                        )}

                        {savedTrip.manifiestoId && (
                            <div className="manifiesto-info">
                                <span>Manifiesto #{savedTrip.manifiestoId}</span>
                            </div>
                        )}
                    </div>

                    {/* Acciones */}
                    <div className="modal-actions">
                        <button className="btn-primary" onClick={onResume}>
                            <Play size={20} />
                            <span>Continuar Viaje</span>
                        </button>
                        <button className="btn-danger" onClick={handleDiscard}>
                            <Trash2 size={18} />
                            <span>Descartar</span>
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .trip-recovery-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                    animation: fadeIn 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .trip-recovery-modal {
                    width: 100%;
                    max-width: 400px;
                    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 20px;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
                    animation: slideUp 0.4s ease;
                }

                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .modal-header {
                    text-align: center;
                    padding: 28px 24px 20px;
                    background: linear-gradient(180deg, rgba(251, 191, 36, 0.15) 0%, transparent 100%);
                }

                .icon-container {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                }

                .icon-container.warning {
                    background: rgba(251, 191, 36, 0.2);
                    color: #fbbf24;
                    animation: pulse 2s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }

                .modal-header h2 {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 22px;
                    font-weight: 700;
                    color: #ffffff;
                    margin: 0 0 8px;
                }

                .modal-header p {
                    font-size: 14px;
                    color: #94a3b8;
                    margin: 0;
                }

                .trip-info-card {
                    padding: 20px 24px;
                    background: rgba(255, 255, 255, 0.03);
                    margin: 0 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }

                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 16px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }

                .info-row .label {
                    font-size: 13px;
                    color: #94a3b8;
                }

                .info-row .value {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 13px;
                    font-weight: 600;
                    color: #ffffff;
                }

                .stats-row {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                }

                .stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .stat svg {
                    color: #10b981;
                }

                .stat-value {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 18px;
                    font-weight: 700;
                    color: #ffffff;
                }

                .stat-label {
                    font-size: 11px;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .stat-divider {
                    width: 1px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.1);
                }

                .paused-badge {
                    margin-top: 16px;
                    padding: 8px 16px;
                    background: rgba(251, 191, 36, 0.15);
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    border-radius: 8px;
                    text-align: center;
                }

                .paused-badge span {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: #fbbf24;
                }

                .manifiesto-info {
                    margin-top: 12px;
                    text-align: center;
                }

                .manifiesto-info span {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 12px;
                    color: #94a3b8;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 4px 12px;
                    border-radius: 4px;
                }

                .modal-actions {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .btn-primary {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 100%;
                    padding: 16px 24px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border: none;
                    border-radius: 12px;
                    color: #ffffff;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 16px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                }

                .btn-primary:active {
                    transform: scale(0.98);
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
                }

                .btn-danger {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    width: 100%;
                    padding: 14px 24px;
                    background: transparent;
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    border-radius: 12px;
                    color: #ef4444;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .btn-danger:active {
                    background: rgba(239, 68, 68, 0.1);
                }
            `}</style>
        </>
    );
};

export default TripRecoveryModal;
