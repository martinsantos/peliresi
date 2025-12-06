import React, { useState, useEffect } from 'react';
import { catalogoService } from '../services/manifiesto.service';
import type { TipoResiduo } from '../types';
import {
    Settings,
    Users,
    Database,
    AlertTriangle,
    Plus,
    Search,
    Edit2,
    Trash2,
    Save
} from 'lucide-react';
import './Configuracion.css';

const Configuracion: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'usuarios' | 'residuos' | 'parametros'>('residuos');
    const [residuos, setResiduos] = useState<TipoResiduo[]>([]);
    const [loading, setLoading] = useState(true);
    const [, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Mock de usuarios para la demo
    const [usuarios] = useState([
        { id: '1', nombre: 'Roberto Gómez', email: 'quimica.mendoza@industria.com', rol: 'GENERADOR', estado: 'ACTIVO' },
        { id: '2', nombre: 'Pedro Martínez', email: 'transportes.andes@logistica.com', rol: 'TRANSPORTISTA', estado: 'ACTIVO' },
        { id: '3', nombre: 'Miguel Fernández', email: 'tratamiento.residuos@planta.com', rol: 'OPERADOR', estado: 'ACTIVO' },
        { id: '4', nombre: 'Administrador DGFA', email: 'admin@dgfa.mendoza.gov.ar', rol: 'ADMIN', estado: 'ACTIVO' },
    ]);

    useEffect(() => {
        if (activeTab === 'residuos') {
            loadResiduos();
        }
    }, [activeTab]);

    const loadResiduos = async () => {
        try {
            setLoading(true);
            const data = await catalogoService.getTiposResiduos();
            setResiduos(data);
        } catch (err) {
            setError('Error al cargar tipos de residuos');
        } finally {
            setLoading(false);
        }
    };

    const filteredResiduos = residuos.filter(r =>
        r.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="configuracion-page animate-fadeIn">
            <div className="config-header">
                <div className="header-title">
                    <Settings size={32} />
                    <div>
                        <h2>Configuración del Sistema</h2>
                        <p>Administración de catálogos, usuarios y parámetros generales</p>
                    </div>
                </div>
            </div>

            <div className="config-container">
                {/* Sidebar de navegación */}
                <div className="config-sidebar">
                    <button
                        className={`config-nav-item ${activeTab === 'residuos' ? 'active' : ''}`}
                        onClick={() => setActiveTab('residuos')}
                    >
                        <Database size={20} />
                        <span>Catálogo de Residuos</span>
                    </button>
                    <button
                        className={`config-nav-item ${activeTab === 'usuarios' ? 'active' : ''}`}
                        onClick={() => setActiveTab('usuarios')}
                    >
                        <Users size={20} />
                        <span>Gestión de Usuarios</span>
                    </button>
                    <button
                        className={`config-nav-item ${activeTab === 'parametros' ? 'active' : ''}`}
                        onClick={() => setActiveTab('parametros')}
                    >
                        <Settings size={20} />
                        <span>Parámetros Generales</span>
                    </button>
                </div>

                {/* Contenido Principal */}
                <div className="config-content">
                    {activeTab === 'residuos' && (
                        <div className="config-section animate-fadeIn">
                            <div className="section-header">
                                <h3>Catálogo de Residuos (Ley 24.051)</h3>
                                <button className="btn btn-primary">
                                    <Plus size={18} />
                                    Nuevo Residuo
                                </button>
                            </div>

                            <div className="search-bar">
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar por código o nombre..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {loading ? (
                                <div className="loading-state">Cargando catálogo...</div>
                            ) : (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Código</th>
                                                <th>Nombre</th>
                                                <th>Categoría</th>
                                                <th>Peligrosidad</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResiduos.map((residuo) => (
                                                <tr key={residuo.id}>
                                                    <td><span className="badge badge-info">{residuo.codigo}</span></td>
                                                    <td>{residuo.nombre}</td>
                                                    <td>{residuo.categoria}</td>
                                                    <td>{residuo.peligrosidad}</td>
                                                    <td>
                                                        <div className="action-buttons">
                                                            <button className="btn-icon" title="Editar">
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button className="btn-icon danger" title="Desactivar">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'usuarios' && (
                        <div className="config-section animate-fadeIn">
                            <div className="section-header">
                                <h3>Gestión de Usuarios</h3>
                                <button className="btn btn-primary">
                                    <Plus size={18} />
                                    Nuevo Usuario
                                </button>
                            </div>

                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Usuario</th>
                                            <th>Email</th>
                                            <th>Rol</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usuarios.map((usuario) => (
                                            <tr key={usuario.id}>
                                                <td><strong>{usuario.nombre}</strong></td>
                                                <td>{usuario.email}</td>
                                                <td>
                                                    <span className={`badge ${usuario.rol === 'ADMIN' ? 'badge-primary' :
                                                        usuario.rol === 'GENERADOR' ? 'badge-info' :
                                                            usuario.rol === 'TRANSPORTISTA' ? 'badge-warning' : 'badge-success'
                                                        }`}>
                                                        {usuario.rol}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="badge badge-success">{usuario.estado}</span>
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button className="btn-icon" title="Editar">
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button className="btn-icon danger" title="Bloquear">
                                                            <AlertTriangle size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'parametros' && (
                        <div className="config-section animate-fadeIn">
                            <div className="section-header">
                                <h3>Parámetros del Sistema</h3>
                                <button className="btn btn-primary">
                                    <Save size={18} />
                                    Guardar Cambios
                                </button>
                            </div>

                            <div className="params-grid">
                                <div className="param-group">
                                    <label>Vencimiento de Manifiestos (días)</label>
                                    <input type="number" defaultValue={30} />
                                    <span className="param-help">Tiempo máximo para completar el ciclo</span>
                                </div>

                                <div className="param-group">
                                    <label>Alerta de Desvío GPS (km)</label>
                                    <input type="number" defaultValue={5} />
                                    <span className="param-help">Distancia permitida fuera de ruta</span>
                                </div>

                                <div className="param-group">
                                    <label>Tiempo Máximo en Tránsito (horas)</label>
                                    <input type="number" defaultValue={48} />
                                    <span className="param-help">Límite para generar alerta crítica</span>
                                </div>

                                <div className="param-group">
                                    <label>Email de Notificaciones DGFA</label>
                                    <input type="email" defaultValue="alertas@dgfa.mendoza.gov.ar" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Configuracion;
