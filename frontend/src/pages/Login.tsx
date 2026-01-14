/**
 * Login Page - Industrial Control Room Design
 * SITREP v4.0 Design System
 */

import React, { useState } from 'react';
import { authService } from '../services/auth.service';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import './Login.css';

const TEST_USERS = [
    { label: 'Admin', email: 'admin@dgfa.mendoza.gov.ar', pass: 'password' },
    { label: 'Generador', email: 'quimica.mendoza@industria.com', pass: 'password' },
    { label: 'Transporte', email: 'transportes.andes@logistica.com', pass: 'password' },
    { label: 'Operador', email: 'tratamiento.residuos@planta.com', pass: 'password' }
];

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await authService.login(email, password);
            window.location.href = `${import.meta.env.BASE_URL}dashboard`.replace('//', '/');
        } catch (err: any) {
            console.error('Error en login:', err);
            setError(err.response?.data?.message || 'Credenciales incorrectas o error en el servidor');
        } finally {
            setLoading(false);
        }
    };

    const handleTestUserClick = (user: typeof TEST_USERS[0]) => {
        setEmail(user.email);
        setPassword(user.pass);
    };

    return (
        <div className="login-page">
            <div className="login-card">
                {/* Header */}
                <div className="login-header">
                    <h1 className="login-title">SITREP</h1>
                    <p className="login-subtitle">Sistema de Trazabilidad de Residuos</p>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="login-error">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="login-input-group">
                        <Mail className="login-input-icon" size={20} />
                        <input
                            type="email"
                            className="login-input"
                            placeholder="Correo electrónico"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="login-input-group">
                        <Lock className="login-input-icon" size={20} />
                        <input
                            type="password"
                            className="login-input"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Ingresando...</span>
                            </>
                        ) : (
                            'Ingresar al sistema'
                        )}
                    </button>
                </form>

                {/* Test Users Section */}
                <div className="login-test-users">
                    <p className="login-test-label">Usuarios de prueba (Desarrollo)</p>
                    <div className="login-test-grid">
                        {TEST_USERS.map((user) => (
                            <div
                                key={user.label}
                                className="login-test-user"
                                onClick={() => handleTestUserClick(user)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && handleTestUserClick(user)}
                            >
                                <div className="login-test-user-role">{user.label}</div>
                                <div className="login-test-user-email">{user.email}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="login-footer">
                    <p className="login-footer-text">
                        Si tiene problemas para ingresar, contacte al administrador de la DGFA.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
