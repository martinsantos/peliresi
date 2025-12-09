import React from 'react';

const Login: React.FC = () => {
    const handleClick = (role: string, email: string) => {
        alert('Clickeaste: ' + role);

        const user = {
            id: '1',
            email: email,
            nombre: role,
            apellido: 'Demo',
            rol: email === 'admin@example.com' ? 'ADMIN' : email.split('@')[0].toUpperCase()
        };

        localStorage.setItem('token', 'demo-token-' + Date.now());
        localStorage.setItem('user', JSON.stringify(user));

        window.location.href = '/demoambiente/dashboard';
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '20px',
            padding: '20px'
        }}>
            <h1 style={{ color: 'white', marginBottom: '20px' }}>
                Sistema de Trazabilidad
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '30px' }}>
                Seleccione su perfil para ingresar
            </p>

            <button
                onClick={() => handleClick('Administrador', 'admin@example.com')}
                style={{
                    padding: '20px 40px',
                    fontSize: '18px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    width: '300px'
                }}
            >
                🛡️ Administrador DGFA
            </button>

            <button
                onClick={() => handleClick('Generador', 'generador@example.com')}
                style={{
                    padding: '20px 40px',
                    fontSize: '18px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    width: '300px'
                }}
            >
                🏭 Generador
            </button>

            <button
                onClick={() => handleClick('Transportista', 'transportista@example.com')}
                style={{
                    padding: '20px 40px',
                    fontSize: '18px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    width: '300px'
                }}
            >
                🚛 Transportista
            </button>

            <button
                onClick={() => handleClick('Operador', 'operador@example.com')}
                style={{
                    padding: '20px 40px',
                    fontSize: '18px',
                    background: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    width: '300px'
                }}
            >
                🏢 Operador
            </button>
        </div>
    );
};

export default Login;
