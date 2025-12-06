import React, { useState } from 'react';
import MobileFrame from '../components/MobileFrame';
import TransportistaApp from './mobile/TransportistaApp';
import OperadorApp from './mobile/OperadorApp';
import { ArrowLeft, Truck, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './DemoApp.css';

type AppRole = 'transportista' | 'operador' | null;

const DemoApp: React.FC = () => {
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState<AppRole>(null);

    if (!selectedRole) {
        return (
            <div className="demo-app-page">
                <div className="demo-nav">
                    <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={20} />
                        Volver al Dashboard Web
                    </button>
                </div>

                <div className="role-selector">
                    <div className="selector-header">
                        <h1>Simulador de App Móvil</h1>
                        <p>Selecciona el rol que deseas visualizar</p>
                    </div>

                    <div className="role-cards">
                        <div className="role-card transportista" onClick={() => setSelectedRole('transportista')}>
                            <div className="role-icon">
                                <Truck size={48} />
                            </div>
                            <h3>Transportista</h3>
                            <p>Gestión de retiros, entregas y tracking GPS en ruta</p>
                            <ul className="role-features">
                                <li>✓ Hoja de ruta diaria</li>
                                <li>✓ Confirmación de retiros</li>
                                <li>✓ Registro de eventos</li>
                                <li>✓ Escaneo de QR</li>
                            </ul>
                            <button className="btn btn-primary">Ver Demo</button>
                        </div>

                        <div className="role-card operador" onClick={() => setSelectedRole('operador')}>
                            <div className="role-icon">
                                <Package size={48} />
                            </div>
                            <h3>Operador</h3>
                            <p>Recepción, pesaje y tratamiento de residuos peligrosos</p>
                            <ul className="role-features">
                                <li>✓ Manifiestos entrantes</li>
                                <li>✓ Pesaje y verificación</li>
                                <li>✓ Aprobación/Rechazo</li>
                                <li>✓ Registro de tratamiento</li>
                            </ul>
                            <button className="btn btn-success">Ver Demo</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="demo-app-page">
            <div className="demo-nav">
                <button className="btn btn-ghost" onClick={() => setSelectedRole(null)}>
                    <ArrowLeft size={20} />
                    Cambiar Rol
                </button>
                <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
                    Volver al Dashboard
                </button>
            </div>

            <MobileFrame title={selectedRole === 'transportista' ? 'App Transportista' : 'App Operador'}>
                {selectedRole === 'transportista' ? <TransportistaApp /> : <OperadorApp />}
            </MobileFrame>
        </div>
    );
};

export default DemoApp;
