import { authService } from '../services/auth.service';

const Login: React.FC = () => {
    const handleClick = async (role: string, email: string) => {
        try {
            // Determinar password según el seed
            let password = 'admin123';
            if (role === 'Generador') password = 'gen123';
            if (role === 'Transportista') password = 'trans123';
            if (role === 'Operador') password = 'op123';

            await authService.login(email, password);
            window.location.href = `${import.meta.env.BASE_URL}dashboard`.replace('//', '/');
        } catch (error) {
            console.error('Error en login:', error);
            alert('Error al ingresar: Verifique que el servidor esté respondiendo.');
        }
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
                onClick={() => handleClick('Administrador', 'admin@dgfa.mendoza.gov.ar')}
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
                🛡️ Administrador SITREP
            </button>

            <button
                onClick={() => handleClick('Generador', 'quimica.mendoza@industria.com')}
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
                onClick={() => handleClick('Transportista', 'transportes.andes@logistica.com')}
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
                onClick={() => handleClick('Operador', 'tratamiento.residuos@planta.com')}
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
