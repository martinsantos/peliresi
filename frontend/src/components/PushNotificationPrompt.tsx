/**
 * PushNotificationPrompt - Solicita permisos de notificaciones push
 * CU-T10: Activar permisos push notifications
 */

import React, { useState, useEffect } from 'react';
import { Bell, X, Check, AlertTriangle } from 'lucide-react';
import { usePushNotifications } from '../services/push.service';
import './PushNotificationPrompt.css';

interface PushNotificationPromptProps {
    /** Mostrar automáticamente después de X segundos (0 = inmediato, -1 = nunca auto) */
    autoShowDelay?: number;
    /** Callback cuando se acepta */
    onAccept?: () => void;
    /** Callback cuando se rechaza */
    onDismiss?: () => void;
}

const PushNotificationPrompt: React.FC<PushNotificationPromptProps> = ({
    autoShowDelay = 5000,
    onAccept,
    onDismiss
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const { isSupported, isSubscribed, permission, loading, subscribe } = usePushNotifications();

    // Check if user has already dismissed or been asked
    useEffect(() => {
        const wasAsked = localStorage.getItem('sitrep_push_asked');
        const wasDismissed = localStorage.getItem('sitrep_push_dismissed');

        if (wasAsked || wasDismissed) {
            setDismissed(true);
            return;
        }

        // Don't show if not supported, already subscribed, or permission already granted/denied
        if (!isSupported || isSubscribed || permission !== 'default' || loading) {
            return;
        }

        // Auto show after delay
        if (autoShowDelay >= 0) {
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, autoShowDelay);
            return () => clearTimeout(timer);
        }
    }, [isSupported, isSubscribed, permission, loading, autoShowDelay]);

    const handleAccept = async () => {
        localStorage.setItem('sitrep_push_asked', 'true');
        const result = await subscribe();

        if (result) {
            onAccept?.();
        }

        setIsVisible(false);
    };

    const handleDismiss = () => {
        localStorage.setItem('sitrep_push_dismissed', 'true');
        setDismissed(true);
        setIsVisible(false);
        onDismiss?.();
    };

    const handleLater = () => {
        // Just hide for now, will show again next session
        setIsVisible(false);
    };

    // Don't render anything if conditions aren't met
    if (!isVisible || dismissed || !isSupported || isSubscribed || permission !== 'default') {
        return null;
    }

    return (
        <div className="push-prompt-overlay">
            <div className="push-prompt">
                <button className="close-btn" onClick={handleDismiss}>
                    <X size={18} />
                </button>

                <div className="prompt-icon">
                    <Bell size={32} />
                </div>

                <h3>Activar Notificaciones</h3>
                <p>
                    Recibe alertas en tiempo real sobre el estado de tus manifiestos,
                    cambios de ruta y eventos importantes.
                </p>

                <div className="prompt-benefits">
                    <div className="benefit">
                        <Check size={16} />
                        <span>Alertas de retiro y entrega</span>
                    </div>
                    <div className="benefit">
                        <Check size={16} />
                        <span>Notificaciones de desvíos GPS</span>
                    </div>
                    <div className="benefit">
                        <Check size={16} />
                        <span>Avisos de vencimientos</span>
                    </div>
                </div>

                <div className="prompt-actions">
                    <button className="btn btn-ghost" onClick={handleLater}>
                        Más tarde
                    </button>
                    <button className="btn btn-primary" onClick={handleAccept} disabled={loading}>
                        {loading ? (
                            <span className="spinner" />
                        ) : (
                            <>
                                <Bell size={18} />
                                Activar
                            </>
                        )}
                    </button>
                </div>

                <p className="prompt-note">
                    Puedes cambiar esto en Preferencias
                </p>
            </div>
        </div>
    );
};

/**
 * Componente compacto para mostrar en settings/preferencias
 */
export const PushNotificationToggle: React.FC = () => {
    const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe, showNotification } = usePushNotifications();

    if (!isSupported) {
        return (
            <div className="push-toggle-unsupported">
                <AlertTriangle size={18} />
                <span>Las notificaciones push no están soportadas en este navegador</span>
            </div>
        );
    }

    const handleToggle = async () => {
        if (isSubscribed) {
            await unsubscribe();
        } else {
            const result = await subscribe();
            if (result) {
                // Show test notification
                showNotification('SITREP Activado', {
                    body: 'Recibirás notificaciones de tus manifiestos',
                    icon: '/pwa-192x192.png'
                });
            }
        }
    };

    return (
        <div className="push-toggle">
            <div className="toggle-info">
                <Bell size={20} />
                <div>
                    <span className="toggle-title">Notificaciones Push</span>
                    <span className="toggle-status">
                        {permission === 'denied' ? (
                            'Bloqueadas en el navegador'
                        ) : isSubscribed ? (
                            'Activadas'
                        ) : (
                            'Desactivadas'
                        )}
                    </span>
                </div>
            </div>

            <button
                className={`toggle-btn ${isSubscribed ? 'active' : ''}`}
                onClick={handleToggle}
                disabled={loading || permission === 'denied'}
            >
                {loading ? (
                    <span className="spinner-small" />
                ) : (
                    <span className="toggle-slider" />
                )}
            </button>

            {permission === 'denied' && (
                <p className="toggle-help">
                    Para activar, permite notificaciones en la configuración de tu navegador
                </p>
            )}
        </div>
    );
};

export default PushNotificationPrompt;
