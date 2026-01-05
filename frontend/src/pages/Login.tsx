import React, { useState } from 'react';
import { authService } from '../services/auth.service';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

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

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: 'rgba(30, 41, 59, 0.7)',
                backdropFilter: 'blur(10px)',
                padding: '40px',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '420px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
                        SITREP
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '15px' }}>
                        Sistema de Trazabilidad de Residuos
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#fca5a5',
                        padding: '12px',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ position: 'relative' }}>
                        <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
                        <input
                            type="email"
                            placeholder="Correo electrónico"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 42px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
                        <input
                            type="password"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 42px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '14px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            marginTop: '10px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Ingresar al sistema'}
                    </button>
                </form>

                <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Usuarios de prueba (Desarrollo)
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                            { label: 'Admin', email: 'admin@dgfa.mendoza.gov.ar', pass: 'admin123' },
                            { label: 'Generador', email: 'quimica.mendoza@industria.com', pass: 'gen123' },
                            { label: 'Transporte', email: 'transportes.andes@logistica.com', pass: 'trans123' },
                            { label: 'Operador', email: 'tratamiento.residuos@planta.com', pass: 'op123' }
                        ].map((u) => (
                            <div 
                                key={u.label} 
                                onClick={() => { setEmail(u.email); setPassword(u.pass); }}
                                style={{
                                    padding: '8px',
                                    background: 'rgba(15, 23, 42, 0.4)',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    color: '#cbd5e1',
                                    cursor: 'pointer',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ fontWeight: '700', color: '#10b981', marginBottom: '2px' }}>{u.label}</div>
                                <div style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <p style={{ color: '#64748b', fontSize: '13px' }}>
                        Si tiene problemas para ingresar, contacte al administrador de la DGFA.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
