/**
 * ActiveTripBanner - Banner de viaje activo para WEB TRANSPORTISTA
 * Muestra el estado del viaje en curso con timer, ubicación y controles
 */

import React, { useState, useEffect } from 'react';
import {
    Truck,
    Clock,
    MapPin,
    Navigation,
    CheckCircle,
    AlertTriangle,
    Map,
    X
} from 'lucide-react';
import './ActiveTripBanner.css';

interface Manifiesto {
    id: string;
    numero: string;
    generador?: { razonSocial: string };
    operador?: { razonSocial: string };
}

interface ActiveTripBannerProps {
    manifiesto: Manifiesto;
    startTime: number; // timestamp de inicio
    ubicacionActual?: { lat: number; lng: number };
    onVerMapa: () => void;
    onFinalizarViaje: () => void;
    onCerrar?: () => void;
}

const ActiveTripBanner: React.FC<ActiveTripBannerProps> = ({
    manifiesto,
    startTime,
    ubicacionActual,
    onVerMapa,
    onFinalizarViaje,
    onCerrar
}) => {
    const [elapsedTime, setElapsedTime] = useState('00:00:00');
    const [showConfirmFinish, setShowConfirmFinish] = useState(false);

    // Timer en tiempo real
    useEffect(() => {
        const updateTimer = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            setElapsedTime(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const handleFinalizarClick = () => {
        setShowConfirmFinish(true);
    };

    const handleConfirmFinalizar = () => {
        setShowConfirmFinish(false);
        onFinalizarViaje();
    };

    return (
        <div className="active-trip-banner">
            <div className="trip-banner-pulse" />

            <div className="trip-banner-content">
                {/* Icono animado */}
                <div className="trip-icon-container">
                    <Truck className="trip-icon" size={28} />
                    <div className="trip-icon-pulse" />
                </div>

                {/* Info del viaje */}
                <div className="trip-info">
                    <div className="trip-header">
                        <span className="trip-status-badge">
                            <span className="status-dot" />
                            VIAJE EN CURSO
                        </span>
                        <span className="trip-numero">#{manifiesto.numero}</span>
                    </div>

                    <div className="trip-details">
                        <div className="trip-route">
                            <span className="route-from">
                                <MapPin size={14} />
                                {manifiesto.generador?.razonSocial || 'Origen'}
                            </span>
                            <Navigation size={14} className="route-arrow" />
                            <span className="route-to">
                                <MapPin size={14} />
                                {manifiesto.operador?.razonSocial || 'Destino'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Timer */}
                <div className="trip-timer">
                    <Clock size={18} />
                    <span className="timer-value">{elapsedTime}</span>
                </div>

                {/* GPS Status */}
                {ubicacionActual && (
                    <div className="trip-gps">
                        <span className="gps-indicator">
                            <span className="gps-dot" />
                            GPS
                        </span>
                    </div>
                )}

                {/* Acciones */}
                <div className="trip-actions">
                    <button className="trip-btn map" onClick={onVerMapa}>
                        <Map size={18} />
                        <span>Ver Mapa</span>
                    </button>

                    <button className="trip-btn finish" onClick={handleFinalizarClick}>
                        <CheckCircle size={18} />
                        <span>Finalizar Entrega</span>
                    </button>
                </div>

                {/* Cerrar banner (minimizar) */}
                {onCerrar && (
                    <button className="trip-close" onClick={onCerrar} title="Minimizar">
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Modal de confirmación */}
            {showConfirmFinish && (
                <div className="confirm-modal-overlay">
                    <div className="confirm-modal">
                        <div className="confirm-icon">
                            <AlertTriangle size={48} />
                        </div>
                        <h3>Confirmar Entrega</h3>
                        <p>
                            ¿Estás seguro de finalizar el viaje del manifiesto <strong>#{manifiesto.numero}</strong>?
                        </p>
                        <p className="confirm-note">
                            Se registrará tu ubicación actual y la hora de entrega.
                        </p>
                        <div className="confirm-actions">
                            <button className="btn-cancel" onClick={() => setShowConfirmFinish(false)}>
                                Cancelar
                            </button>
                            <button className="btn-confirm" onClick={handleConfirmFinalizar}>
                                <CheckCircle size={18} />
                                Confirmar Entrega
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActiveTripBanner;
