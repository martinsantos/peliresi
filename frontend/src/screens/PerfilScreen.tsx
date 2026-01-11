/**
 * PerfilScreen - FASE 4
 * Pantalla de perfil de usuario extraída de MobileApp.tsx
 * Incluye toggle de tema (dark/light)
 */

import React, { useState, useEffect } from 'react';
import { User, BarChart3, Settings, LogOut, Sun, Moon } from 'lucide-react';

interface PerfilScreenProps {
    roleName: string;
    onChangeRole: () => void;
}

const PerfilScreen: React.FC<PerfilScreenProps> = ({
    roleName,
    onChangeRole
}) => {
    const [isDarkTheme, setIsDarkTheme] = useState(true);

    useEffect(() => {
        // Check saved preference or default to dark
        const savedTheme = localStorage.getItem('sitrep-theme');
        const prefersDark = savedTheme ? savedTheme === 'dark' : true;
        setIsDarkTheme(prefersDark);
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDarkTheme;
        setIsDarkTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light');
        localStorage.setItem('sitrep-theme', newTheme ? 'dark' : 'light');
    };

    return (
        <div className="section">
            <div className="profile-card">
                <div className="profile-avatar"><User size={32} /></div>
                <h3>Usuario Demo</h3>
                <p>{roleName}</p>
            </div>
            <div className="settings-list">
                <button className="settings-item" onClick={toggleTheme}>
                    {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
                    <span>Tema: {isDarkTheme ? 'Oscuro' : 'Claro'}</span>
                    <span className="theme-indicator" style={{
                        marginLeft: 'auto',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: isDarkTheme ? 'var(--color-bg-void)' : 'var(--color-warning-bright)',
                        color: isDarkTheme ? 'var(--color-text-bright)' : 'var(--color-bg-void)'
                    }}>
                        {isDarkTheme ? '🌙' : '☀️'}
                    </span>
                </button>
                <button className="settings-item">
                    <BarChart3 size={18} />
                    <span>Estadisticas</span>
                </button>
                <button className="settings-item">
                    <Settings size={18} />
                    <span>Configuracion</span>
                </button>
                <button className="settings-item logout" onClick={onChangeRole}>
                    <LogOut size={18} />
                    <span>Cambiar Rol</span>
                </button>
            </div>
        </div>
    );
};

export default PerfilScreen;
