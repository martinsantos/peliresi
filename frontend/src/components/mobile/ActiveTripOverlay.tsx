/**
 * ActiveTripOverlay - FASE 3
 * Overlay que aparece cuando el usuario intenta navegar
 * fuera de la pantalla de viaje mientras hay un viaje activo
 */

import React from 'react';
import { Navigation, Clock, MapPin, ArrowRight, X } from 'lucide-react';

interface ActiveTripOverlayProps {
    duration: number; // segundos
    distance: number; // km
    manifiestoNumero?: string;
    isPaused: boolean;
    onGoToTrip: () => void;
    onStayHere: () => void;
}

const ActiveTripOverlay: React.FC<ActiveTripOverlayProps> = ({
    duration,
    distance,
    manifiestoNumero,
    isPaused,
    onGoToTrip,
    onStayHere
}) => {
    const formatTime = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            <div className="active-trip-overlay">
                <div className="overlay-content">
                    {/* Botón cerrar */}
                    <button className="close-btn" onClick={onStayHere} aria-label="Cerrar">
                        <X size={20} />
                    </button>

                    {/* Indicador de viaje */}
                    <div className="trip-indicator">
                        <div className={`nav-icon ${isPaused ? 'paused' : 'active'}`}>
                            <Navigation size={36} />
                        </div>
                        <h2>VIAJE {isPaused ? 'PAUSADO' : 'EN CURSO'}</h2>
                    </div>

                    {/* Resumen del viaje */}
                    <div className="trip-summary">
                        <div className="stat">
                            <Clock size={22} />
                            <span className="stat-value">{formatTime(duration)}</span>
                            <span className="stat-label">Tiempo</span>
                        </div>
                        <div className="stat-separator" />
                        <div className="stat">
                            <MapPin size={22} />
                            <span className="stat-value">{distance.toFixed(1)} km</span>
                            <span className="stat-label">Recorrido</span>
                        </div>
                    </div>

                    {/* Info del manifiesto */}
                    {manifiestoNumero && (
                        <div className="manifiesto-badge">
                            <span>Manifiesto #{manifiestoNumero}</span>
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="overlay-actions">
                        <button className="btn-go-trip" onClick={onGoToTrip}>
                            <Navigation size={20} />
                            <span>Ir al Viaje</span>
                            <ArrowRight size={18} />
                        </button>
                        <button className="btn-stay" onClick={onStayHere}>
                            Continuar navegando
                        </button>
                    </div>

                    {/* Advertencia */}
                    <p className="warning-text">
                        {isPaused
                            ? 'El viaje está pausado. Recuerde reanudarlo o finalizarlo.'
                            : 'El GPS continúa registrando su ubicación.'
                        }
                    </p>
                </div>
            </div>

            <style>{`
                .active-trip-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.9);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9998;
                    padding: 24px;
                    animation: overlayFadeIn 0.3s ease;
                }

                @keyframes overlayFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .overlay-content {
                    width: 100%;
                    max-width: 380px;
                    background: linear-gradient(180deg, #064e3b 0%, #0f172a 100%);
                    border-radius: 24px;
                    padding: 32px 24px;
                    text-align: center;
                    border: 2px solid #10b981;
                    box-shadow: 0 0 60px rgba(16, 185, 129, 0.3);
                    position: relative;
                    animation: contentSlideUp 0.4s ease;
                }

                @keyframes contentSlideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .close-btn {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .close-btn:active {
                    background: rgba(255, 255, 255, 0.2);
                    transform: scale(0.95);
                }

                .trip-indicator {
                    margin-bottom: 28px;
                }

                .nav-icon {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                }

                .nav-icon.active {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    animation: iconPulse 2s ease-in-out infinite;
                }

                .nav-icon.paused {
                    background: rgba(251, 191, 36, 0.2);
                    color: #fbbf24;
                }

                @keyframes iconPulse {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
                    }
                    50% {
                        transform: scale(1.05);
                        box-shadow: 0 0 0 15px rgba(16, 185, 129, 0);
                    }
                }

                .trip-indicator h2 {
                    font-family: 'Barlow Condensed', sans-serif;
                    font-size: 26px;
                    font-weight: 700;
                    letter-spacing: 3px;
                    color: #10b981;
                    margin: 0;
                    text-transform: uppercase;
                }

                .nav-icon.paused + h2 {
                    color: #fbbf24;
                }

                .trip-summary {
                    display: flex;
                    justify-content: center;
                    gap: 32px;
                    margin-bottom: 20px;
                    padding: 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 16px;
                }

                .stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                }

                .stat svg {
                    color: #a7f3d0;
                }

                .stat-value {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 24px;
                    font-weight: 700;
                    color: #ffffff;
                }

                .stat-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .stat-separator {
                    width: 1px;
                    background: rgba(255, 255, 255, 0.15);
                }

                .manifiesto-badge {
                    display: inline-block;
                    margin-bottom: 24px;
                    padding: 8px 20px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                }

                .manifiesto-badge span {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 13px;
                    font-weight: 600;
                    color: #ffffff;
                }

                .overlay-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .btn-go-trip {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    width: 100%;
                    padding: 18px 24px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border: none;
                    border-radius: 14px;
                    color: #ffffff;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 17px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
                }

                .btn-go-trip:active {
                    transform: scale(0.98);
                    box-shadow: 0 3px 12px rgba(16, 185, 129, 0.4);
                }

                .btn-stay {
                    width: 100%;
                    padding: 14px 24px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 12px;
                    color: #94a3b8;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .btn-stay:active {
                    background: rgba(255, 255, 255, 0.05);
                }

                .warning-text {
                    font-size: 12px;
                    color: #64748b;
                    margin: 0;
                    line-height: 1.5;
                }
            `}</style>
        </>
    );
};

export default ActiveTripOverlay;
