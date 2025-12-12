import React, { useState } from 'react';
import { Shield } from 'lucide-react';

interface PasswordGateProps {
    children: React.ReactNode;
}

const DEMO_PASSWORD = 'mimi88';
const AUTH_KEY = 'dashboardAuth';

const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        return localStorage.getItem(AUTH_KEY) === 'true';
    });
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    // Función para notificar login exitoso via PHP endpoint
    const notifyLogin = async () => {
        try {
            await fetch('https://viveroloscocos.com.ar/sitrep-notify.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            console.log('[SITREP] Notificación de acceso enviada');
        } catch {
            // Silent fail - no bloquear el acceso si la notificación falla
            console.log('[SITREP] Notificación fallida (silenciosa)');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === DEMO_PASSWORD) {
            setIsAuthenticated(true);
            localStorage.setItem(AUTH_KEY, 'true');
            setError(false);
            // Notificar acceso exitoso
            notifyLogin();
        } else {
            setError(true);
            setTimeout(() => setError(false), 2000);
        }
    };

    if (isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            padding: '20px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                {/* Logo */}
                <div style={{
                    width: '80px',
                    height: '80px',
                    margin: '0 auto 24px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)'
                }}>
                    <Shield size={40} color="white" strokeWidth={2} />
                </div>

                <h1 style={{
                    color: '#f8fafc',
                    fontSize: '28px',
                    fontWeight: 700,
                    marginBottom: '8px'
                }}>
                    SITREP
                </h1>
                <p style={{
                    color: '#94a3b8',
                    fontSize: '14px',
                    marginBottom: '32px'
                }}>
                    Sistema de Trazabilidad de Residuos Peligrosos
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.8)',
                        borderRadius: '16px',
                        padding: '24px',
                        border: error ? '2px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                        marginBottom: '16px'
                    }}>
                        <label style={{
                            display: 'block',
                            color: '#94a3b8',
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '12px',
                            textAlign: 'left'
                        }}>
                            Contraseña de acceso a la demo
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Ingrese la contraseña"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '10px',
                                color: '#f8fafc',
                                fontSize: '16px',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                        {error && (
                            <p style={{
                                color: '#ef4444',
                                fontSize: '13px',
                                marginTop: '12px',
                                textAlign: 'left'
                            }}>
                                Contraseña incorrecta
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.3)';
                        }}
                    >
                        Ingresar
                    </button>
                </form>

                <p style={{
                    color: '#64748b',
                    fontSize: '12px',
                    marginTop: '24px'
                }}>
                    Esta demo está protegida con contraseña
                </p>
            </div>
        </div>
    );
};

export default PasswordGate;
