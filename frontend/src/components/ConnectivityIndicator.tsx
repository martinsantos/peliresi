import React from 'react';
import { Wifi, WifiOff, RefreshCw, Check } from 'lucide-react';
import { useConnectivity } from '../hooks/useConnectivity';
import './ConnectivityIndicator.css';

interface Props {
    showLabel?: boolean;
    size?: 'small' | 'medium' | 'large';
    position?: 'static' | 'fixed';
}

const ConnectivityIndicator: React.FC<Props> = ({
    showLabel = true,
    size = 'medium',
    position = 'static'
}) => {
    const { isOnline, syncPending } = useConnectivity();

    const iconSize = size === 'small' ? 14 : size === 'medium' ? 18 : 22;

    return (
        <div className={`connectivity-indicator ${isOnline ? 'online' : 'offline'} ${size} ${position}`}>
            <div className="connectivity-icon">
                {syncPending ? (
                    <RefreshCw size={iconSize} className="spinning" />
                ) : isOnline ? (
                    <Wifi size={iconSize} />
                ) : (
                    <WifiOff size={iconSize} />
                )}
            </div>
            {showLabel && (
                <span className="connectivity-label">
                    {syncPending ? 'Sincronizando...' : isOnline ? 'Conectado' : 'Sin conexión'}
                </span>
            )}
            {syncPending && (
                <div className="sync-badge">
                    <Check size={10} />
                </div>
            )}
        </div>
    );
};

export default ConnectivityIndicator;
