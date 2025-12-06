import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import './Login.css';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as any)?.from?.pathname || '/dashboard';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    // Usuarios de demo
    const demoUsers = [
        { email: 'admin@dgfa.mendoza.gov.ar', password: 'admin123', rol: 'Administrador DGFA' },
        { email: 'quimica.mendoza@industria.com', password: 'gen123', rol: 'Generador' },
        { email: 'transportes.andes@logistica.com', password: 'trans123', rol: 'Transportista' },
        { email: 'tratamiento.residuos@planta.com', password: 'op123', rol: 'Operador' },
    ];

    const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
        setEmail(demoEmail);
        setPassword(demoPassword);
    };

    return (
        <div className="login-page">
            <div className="login-background">
                <div className="login-gradient" />
                <div className="login-pattern" />
            </div>

            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <div className="login-logo">
                            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="30" cy="30" r="28" stroke="currentColor" strokeWidth="2" fill="none" />
                                <path d="M18 30L26 38L42 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M10 30C10 18.954 18.954 10 30 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M50 30C50 41.046 41.046 50 30 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <h1>Sistema de Trazabilidad</h1>
                        <p>Residuos Peligrosos - DGFA Mendoza</p>
                    </div>

                    <form className="login-form" onSubmit={handleSubmit}>
                        {error && (
                            <div className="login-error">
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Correo electrónico</label>
                            <input
                                id="email"
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="usuario@ejemplo.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Contraseña</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Iniciando sesión...
                                </>
                            ) : (
                                'Iniciar Sesión'
                            )}
                        </button>
                    </form>

                    <div className="login-divider">
                        <span>Usuarios de demostración</span>
                    </div>

                    <div className="demo-users">
                        {demoUsers.map((user) => (
                            <button
                                key={user.email}
                                className="demo-user-btn"
                                onClick={() => handleDemoLogin(user.email, user.password)}
                                type="button"
                            >
                                <span className="demo-user-rol">{user.rol}</span>
                                <span className="demo-user-email">{user.email}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <p className="login-footer">
                    Sistema desarrollado para la Dirección de Gestión y Fiscalización Ambiental
                    <br />
                    © {new Date().getFullYear()} Gobierno de Mendoza
                </p>
            </div>
        </div>
    );
};

export default Login;
