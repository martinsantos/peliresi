import React from 'react';
import './MobileFrame.css';

interface MobileFrameProps {
    children: React.ReactNode;
    title?: string;
}

const MobileFrame: React.FC<MobileFrameProps> = ({ children, title = 'Trazabilidad App' }) => {
    return (
        <div className="mobile-frame-container animate-fadeIn">
            <div className="phone-mockup">
                <div className="phone-bezel">
                    <div className="phone-camera"></div>
                    <div className="phone-screen">
                        <div className="app-status-bar">
                            <span>9:41</span>
                            <div className="status-icons">
                                <div className="signal-icon"></div>
                                <div className="wifi-icon"></div>
                                <div className="battery-icon"></div>
                            </div>
                        </div>
                        <div className="app-content">
                            {children}
                        </div>
                        <div className="app-home-indicator"></div>
                    </div>
                    <div className="phone-buttons side-button"></div>
                    <div className="phone-buttons volume-up"></div>
                    <div className="phone-buttons volume-down"></div>
                </div>
            </div>
            <div className="frame-info">
                <h2>{title}</h2>
                <p>Simulación de la experiencia de usuario en dispositivo móvil para el rol de <strong>Transportista</strong>.</p>
                <div className="features-list">
                    <div className="feature-item">
                        <span className="check-icon">✓</span>
                        Interfaz Táctil Optimizada
                    </div>
                    <div className="feature-item">
                        <span className="check-icon">✓</span>
                        Geolocalización en tiempo real
                    </div>
                    <div className="feature-item">
                        <span className="check-icon">✓</span>
                        Escaneo de QR
                    </div>
                    <div className="feature-item">
                        <span className="check-icon">✓</span>
                        Modo Offline
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileFrame;
