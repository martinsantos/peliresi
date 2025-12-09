import React from 'react';
import { Download, Check, Smartphone, Apple } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import './InstallPWAButton.css';

interface Props {
    variant?: 'card' | 'button' | 'inline';
    showIcon?: boolean;
}

const InstallPWAButton: React.FC<Props> = ({ variant = 'card', showIcon = true }) => {
    const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();

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
        <button
            className={`install-pwa ${variant} ${canInstall || isIOS ? 'available' : ''}`}
            onClick={promptInstall}
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
                            ? 'Disponible para Android e iOS'
                            : 'Usa Chrome para instalar'}
                </span>
            </div>
            {variant === 'card' && (
                <div className="install-badge">
                    <Smartphone size={16} />
                </div>
            )}
        </button>
    );
};

export default InstallPWAButton;
