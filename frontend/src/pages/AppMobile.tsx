import React from 'react';
import MobileApp from './MobileApp';

/**
 * AppMobile - Wrapper puro para PWA instalada
 * 
 * Este componente muestra MobileApp a pantalla completa sin el mockup de teléfono
 * ni el panel lateral de información. Diseñado para ser el start_url de la PWA.
 */
const AppMobile: React.FC = () => {
    return (
        <div style={{
            width: '100vw',
            height: '100dvh',
            minHeight: '100vh',
            background: '#0f172a',
            position: 'fixed',
            top: 0,
            left: 0
        }}>
            <MobileApp />
        </div>
    );
};

export default AppMobile;
