import React, { useState } from 'react';
import { Download, Check, Smartphone, Apple } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import InstallPWAModal from './InstallPWAModal';
import './InstallPWAButton.css';

interface Props {
    variant?: 'card' | 'button' | 'inline';
    showIcon?: boolean;
}

const InstallPWAButton: React.FC<Props> = ({ variant = 'card', showIcon = true }) => {
    const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
    const [showModal, setShowModal] = useState(false);

    const handleInstallClick = async () => {
        // Try native install first
        const nativeSuccess = await promptInstall();

        // If native prompt wasn't available, show our modal
        if (!nativeSuccess) {
            setShowModal(true);
        }
    };

    const handleNativeInstall = async () => {
        await promptInstall();
    };

    if (isInstalled) {
        return (
            <div className={`install-pwa ${variant} installed`}>
                {showIcon && <Check size={20} />}
                <div className="install-content">
                    <strong>App Instalada</strong>
                    <span>Ya tienes la app en tu dispositivo</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <button
                className={`install-pwa ${variant} ${canInstall || isIOS ? 'available' : ''}`}
                onClick={handleInstallClick}
            >
                {showIcon && (
                    <div className="install-icon">
                        {isIOS ? <Apple size={22} /> : <Download size={22} />}
                    </div>
                )}
                <div className="install-content">
                    <strong>Instalar como App</strong>
                    <span>
                        {isIOS
                            ? 'Toca para ver instrucciones'
                            : canInstall
                                ? '¡Listo para instalar!'
                                : 'Ver cómo instalar'}
                    </span>
                </div>
                {variant === 'card' && (
                    <div className="install-badge">
                        <Smartphone size={16} />
                    </div>
                )}
            </button>

            {/* Install Modal */}
            <InstallPWAModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                isIOS={isIOS}
                canInstallNatively={canInstall}
                onNativeInstall={handleNativeInstall}
            />
        </>
    );
};

export default InstallPWAButton;

