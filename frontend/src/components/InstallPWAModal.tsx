import React from 'react';
import { X, Download, Smartphone, CheckCircle, Chrome, Apple, MoreVertical, ExternalLink } from 'lucide-react';
import './InstallPWAModal.css';

interface InstallPWAModalProps {
    isOpen: boolean;
    onClose: () => void;
    isIOS: boolean;
    canInstallNatively: boolean;
    onNativeInstall: () => void;
}

const InstallPWAModal: React.FC<InstallPWAModalProps> = ({
    isOpen,
    onClose,
    isIOS,
    canInstallNatively,
    onNativeInstall
}) => {
    if (!isOpen) return null;

    const handleNativeClick = () => {
        onNativeInstall();
        onClose();
    };

    return (
        <div className="install-modal-overlay" onClick={onClose}>
            <div className="install-modal" onClick={(e) => e.stopPropagation()}>
                <button className="install-modal-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="install-modal-header">
                    <div className="install-modal-icon">
                        <Smartphone size={32} />
                    </div>
                    <h2>Instalar App en tu Dispositivo</h2>
                    <p>Acceso directo desde tu pantalla de inicio</p>
                </div>

                {/* Si Chrome ofrece instalación nativa */}
                {canInstallNatively ? (
                    <div className="install-native-section">
                        <div className="install-native-badge">
                            <CheckCircle size={16} />
                            ¡Listo para instalar!
                        </div>
                        <button className="install-native-btn" onClick={handleNativeClick}>
                            <Download size={20} />
                            Instalar App Ahora
                        </button>
                        <p className="install-native-note">
                            Chrome detectó que puedes instalar la app. Haz clic para continuar.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Instrucciones para iOS */}
                        {isIOS ? (
                            <div className="install-steps">
                                <div className="install-browser-type">
                                    <Apple size={20} />
                                    <span>Safari (iOS)</span>
                                </div>

                                <div className="install-step">
                                    <div className="step-number">1</div>
                                    <div className="step-content">
                                        <div className="step-icon safari-share">
                                            <span className="safari-share-icon">⬆️</span>
                                        </div>
                                        <div className="step-text">
                                            <h4>Toca el botón Compartir</h4>
                                            <p>El ícono con la flecha hacia arriba ⬆️ en la barra inferior</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="install-step">
                                    <div className="step-number">2</div>
                                    <div className="step-content">
                                        <div className="step-icon">
                                            <span className="plus-icon">➕</span>
                                        </div>
                                        <div className="step-text">
                                            <h4>Agregar a pantalla de inicio</h4>
                                            <p>Busca esta opción en el menú que aparece</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="install-step">
                                    <div className="step-number">3</div>
                                    <div className="step-content">
                                        <div className="step-icon success-icon">
                                            <CheckCircle size={24} />
                                        </div>
                                        <div className="step-text">
                                            <h4>¡Listo!</h4>
                                            <p>La app aparecerá como ícono en tu pantalla de inicio</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Instrucciones para Chrome Android/Desktop */
                            <div className="install-steps">
                                <div className="install-browser-type">
                                    <Chrome size={20} />
                                    <span>Chrome (Android / Escritorio)</span>
                                </div>

                                <div className="install-step">
                                    <div className="step-number">1</div>
                                    <div className="step-content">
                                        <div className="step-icon chrome-menu">
                                            <MoreVertical size={24} />
                                        </div>
                                        <div className="step-text">
                                            <h4>Abre el menú de Chrome</h4>
                                            <p>Toca los <strong>⋮ tres puntos</strong> en la esquina superior derecha</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="install-step">
                                    <div className="step-number">2</div>
                                    <div className="step-content">
                                        <div className="step-icon install-option">
                                            <Download size={24} />
                                        </div>
                                        <div className="step-text">
                                            <h4>Selecciona "Instalar app"</h4>
                                            <p>También puede aparecer como "Agregar a pantalla de inicio" o "Instalar SITREP"</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="install-step">
                                    <div className="step-number">3</div>
                                    <div className="step-content">
                                        <div className="step-icon success-icon">
                                            <CheckCircle size={24} />
                                        </div>
                                        <div className="step-text">
                                            <h4>¡Listo!</h4>
                                            <p>La app se instala y abre como aplicación independiente</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Tip adicional para Chrome */}
                                <div className="install-tip">
                                    <ExternalLink size={16} />
                                    <span>
                                        <strong>Tip:</strong> Si ves un ícono <span className="url-bar-icon">📥</span> en la barra de direcciones, haz clic ahí para instalar directamente
                                    </span>
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="install-modal-footer">
                    <div className="install-features">
                        <div className="install-feature">
                            <CheckCircle size={14} />
                            <span>Sin conexión</span>
                        </div>
                        <div className="install-feature">
                            <CheckCircle size={14} />
                            <span>Notificaciones</span>
                        </div>
                        <div className="install-feature">
                            <CheckCircle size={14} />
                            <span>Acceso rápido</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallPWAModal;
