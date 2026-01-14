import React, { useState, useEffect, useCallback } from 'react';
import { catalogoService } from '../services/manifiesto.service';
import { usuarioService, configService, cronService, type Usuario, type CronTask } from '../services/admin.service';
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
    Save,
    X,
    Check,
    Sun,
    Moon,
    Monitor,
    UserPlus,
    Shield,
    Mail,
    Phone,
    Clock,
    Play,
    RefreshCw,
    HardDrive
} from 'lucide-react';
import './Configuracion.css';

// ===== Constants =====
const DEFAULT_RESIDUO_FORM = {
    codigo: '',
    nombre: '',
    descripcion: '',
    categoria: 'A',
    caracteristicas: '',
    peligrosidad: 'Alta'
};

const DEFAULT_USUARIO_FORM = {
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    rol: 'GENERADOR',
    activo: true
};

const DEFAULT_PARAMETROS = {
    vencimientoManifiestos: 30,
    alertaDesvioGPS: 5,
    tiempoMaxTransito: 48,
    emailNotificaciones: 'alertas@dgfa.mendoza.gov.ar',
    toleranciaPeso: 5,
    tiempoSesion: 60
};

const ROL_BADGE_CLASSES: Record<string, string> = {
    ADMIN: 'badge-admin',
    GENERADOR: 'badge-generador',
    TRANSPORTISTA: 'badge-transportista',
    OPERADOR: 'badge-operador'
};

const PELIGROSIDAD_BADGE_CLASSES: Record<string, string> = {
    Alta: 'badge-danger',
    Media: 'badge-warning',
    Baja: 'badge-success'
};

type TabType = 'usuarios' | 'residuos' | 'parametros' | 'tareas';
type ThemeType = 'dark' | 'light' | 'system';

// ===== Modal Component =====
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps): React.ReactElement | null {
    if (!isOpen) return null;

    return (
        <div className="config-modal-overlay" onClick={onClose}>
            <div className={`config-modal config-modal-${size}`} onClick={e => e.stopPropagation()}>
                <div className="config-modal-header">
                    <h3>{title}</h3>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="config-modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
}

// ===== Toast Types =====
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface DeleteConfirmation {
    type: 'residuo' | 'usuario';
    id: string;
    nombre: string;
}

// ===== Main Component =====
function Configuracion(): React.ReactElement {
    const [activeTab, setActiveTab] = useState<TabType>('residuos');
    const [residuos, setResiduos] = useState<TipoResiduo[]>([]);
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Modal states
    const [showResiduoModal, setShowResiduoModal] = useState(false);
    const [showUsuarioModal, setShowUsuarioModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<DeleteConfirmation | null>(null);
    const [editingResiduo, setEditingResiduo] = useState<TipoResiduo | null>(null);
    const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);

    // Form states
    const [residuoForm, setResiduoForm] = useState(DEFAULT_RESIDUO_FORM);
    const [usuarioForm, setUsuarioForm] = useState(DEFAULT_USUARIO_FORM);
    const [parametros, setParametros] = useState(DEFAULT_PARAMETROS);
    const [cronTasks, setCronTasks] = useState<CronTask[]>([]);
    const [runningTask, setRunningTask] = useState<string | null>(null);

    // Theme state
    const [theme, setTheme] = useState<ThemeType>(() => {
        return (localStorage.getItem('sitrep_theme') as ThemeType) || 'dark';
    });

    // ===== Helpers =====
    const showToast = useCallback((message: string, type: Toast['type']) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    function getToastIcon(type: Toast['type']): React.ReactElement {
        switch (type) {
            case 'success': return <Check size={18} />;
            case 'error': return <X size={18} />;
            case 'info': return <AlertTriangle size={18} />;
        }
    }

    function getRolBadgeClass(rol: string): string {
        return ROL_BADGE_CLASSES[rol] || 'badge-info';
    }

    function getPeligrosidadBadgeClass(peligrosidad: string): string {
        return PELIGROSIDAD_BADGE_CLASSES[peligrosidad] || 'badge-info';
    }

    // ===== Data Loading =====
    const loadResiduos = useCallback(async () => {
        setLoading(true);
        try {
            const data = await catalogoService.getTiposResiduos();
            setResiduos(data || []);
        } catch {
            showToast('Error al cargar tipos de residuos', 'error');
            setResiduos([]);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const loadUsuarios = useCallback(async () => {
        setLoading(true);
        try {
            const response = await usuarioService.getUsuarios({ limit: 100 });
            setUsuarios(response.usuarios || []);
        } catch {
            showToast('Error al cargar usuarios', 'error');
            setUsuarios([]);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const loadParametros = useCallback(async () => {
        setLoading(true);
        try {
            const config = await configService.getConfig();
            setParametros({
                vencimientoManifiestos: config.vencimientoManifiestos,
                alertaDesvioGPS: config.alertaDesvioGPS,
                tiempoMaxTransito: config.tiempoMaxTransito,
                emailNotificaciones: config.emailNotificaciones,
                toleranciaPeso: config.toleranciaPeso,
                tiempoSesion: config.tiempoSesion
            });
        } catch (error) {
            console.error('[Configuracion] Error loading params:', error);
            showToast('Error al cargar parámetros', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const loadTareas = useCallback(async () => {
        setLoading(true);
        try {
            const { tasks } = await cronService.getStatus();
            setCronTasks(tasks);
        } catch (error) {
            console.error('[Configuracion] Error loading cron tasks:', error);
            showToast('Error al cargar tareas programadas', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        switch (activeTab) {
            case 'residuos':
                loadResiduos();
                break;
            case 'usuarios':
                loadUsuarios();
                break;
            case 'parametros':
                loadParametros();
                break;
            case 'tareas':
                loadTareas();
                break;
        }
    }, [activeTab, loadResiduos, loadUsuarios, loadParametros, loadTareas]);

    // Apply theme
    useEffect(() => {
        const html = document.documentElement;
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            html.setAttribute('data-theme', theme);
        }
        localStorage.setItem('sitrep_theme', theme);
    }, [theme]);

    // ===== Residuos Handlers =====
    function openResiduoModal(residuo?: TipoResiduo): void {
        if (residuo) {
            setEditingResiduo(residuo);
            setResiduoForm({
                codigo: residuo.codigo || '',
                nombre: residuo.nombre || '',
                descripcion: residuo.descripcion || '',
                categoria: residuo.categoria || 'A',
                caracteristicas: residuo.caracteristicas || '',
                peligrosidad: residuo.peligrosidad || 'Alta'
            });
        } else {
            setEditingResiduo(null);
            setResiduoForm(DEFAULT_RESIDUO_FORM);
        }
        setShowResiduoModal(true);
    }

    async function handleSaveResiduo(): Promise<void> {
        if (!residuoForm.codigo || !residuoForm.nombre) {
            showToast('Codigo y nombre son requeridos', 'error');
            return;
        }

        if (editingResiduo) {
            const updatedResiduos = residuos.map(r =>
                r.id === editingResiduo.id ? { ...r, ...residuoForm } : r
            );
            setResiduos(updatedResiduos);
            showToast('Residuo actualizado correctamente', 'success');
        } else {
            const newResiduo: TipoResiduo = {
                id: `residuo-${Date.now()}`,
                ...residuoForm,
                activo: true
            };
            setResiduos([...residuos, newResiduo]);
            showToast('Residuo creado correctamente', 'success');
        }
        setShowResiduoModal(false);
    }

    function handleDeleteResiduo(id: string): void {
        setResiduos(residuos.filter(r => r.id !== id));
        showToast('Residuo eliminado correctamente', 'success');
        setShowDeleteConfirm(null);
    }

    // ===== Usuarios Handlers =====
    function openUsuarioModal(usuario?: Usuario): void {
        if (usuario) {
            setEditingUsuario(usuario);
            setUsuarioForm({
                nombre: usuario.nombre || '',
                apellido: usuario.apellido || '',
                email: usuario.email || '',
                telefono: usuario.telefono || '',
                rol: usuario.rol || 'GENERADOR',
                activo: usuario.activo
            });
        } else {
            setEditingUsuario(null);
            setUsuarioForm(DEFAULT_USUARIO_FORM);
        }
        setShowUsuarioModal(true);
    }

    async function handleSaveUsuario(): Promise<void> {
        if (!usuarioForm.nombre || !usuarioForm.email) {
            showToast('Nombre y email son requeridos', 'error');
            return;
        }

        try {
            if (editingUsuario) {
                await usuarioService.updateUsuario(editingUsuario.id, usuarioForm);
                await loadUsuarios();
                showToast('Usuario actualizado correctamente', 'success');
            } else {
                const newUsuario: Usuario = {
                    id: `user-${Date.now()}`,
                    ...usuarioForm,
                    createdAt: new Date().toISOString()
                };
                setUsuarios([...usuarios, newUsuario]);
                showToast('Usuario creado correctamente', 'success');
            }
            setShowUsuarioModal(false);
        } catch {
            showToast('Error al guardar usuario', 'error');
        }
    }

    async function handleToggleUsuarioStatus(usuario: Usuario): Promise<void> {
        const newStatus = !usuario.activo;
        const statusMessage = newStatus ? 'activado' : 'desactivado';

        try {
            await usuarioService.updateUsuario(usuario.id, { activo: newStatus });
            await loadUsuarios();
        } catch {
            // Fallback to local update for demo
            setUsuarios(usuarios.map(u =>
                u.id === usuario.id ? { ...u, activo: newStatus } : u
            ));
        }
        showToast(`Usuario ${statusMessage} correctamente`, 'success');
    }

    // ===== Parametros Handlers =====
    async function handleSaveParametros(): Promise<void> {
        try {
            await configService.updateConfig(parametros);
            showToast('Parámetros guardados correctamente', 'success');
        } catch (error) {
            console.error('[Configuracion] Error saving params:', error);
            showToast('Error al guardar parámetros', 'error');
        }
    }

    function updateParametro(key: keyof typeof parametros, value: string): void {
        const numericKeys = ['vencimientoManifiestos', 'alertaDesvioGPS', 'tiempoMaxTransito', 'toleranciaPeso', 'tiempoSesion'];
        if (numericKeys.includes(key)) {
            setParametros(prev => ({ ...prev, [key]: parseInt(value) || DEFAULT_PARAMETROS[key as keyof typeof DEFAULT_PARAMETROS] }));
        } else {
            setParametros(prev => ({ ...prev, [key]: value }));
        }
    }

    // ===== Filtered Data =====
    const filteredResiduos = residuos.filter(r =>
        r?.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredUsuarios = usuarios.filter(u =>
        u?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u?.rol?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ===== Render Functions =====
    function renderToasts(): React.ReactElement {
        return (
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        {getToastIcon(toast.type)}
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        );
    }

    function renderSidebar(): React.ReactElement {
        const tabs: Array<{ id: TabType; icon: React.ReactElement; label: string }> = [
            { id: 'residuos', icon: <Database size={20} />, label: 'Catalogo de Residuos' },
            { id: 'usuarios', icon: <Users size={20} />, label: 'Gestion de Usuarios' },
            { id: 'parametros', icon: <Settings size={20} />, label: 'Parametros Generales' },
            { id: 'tareas', icon: <Clock size={20} />, label: 'Tareas Programadas' }
        ];

        return (
            <div className="config-sidebar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`config-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>
        );
    }

    function renderSearchBar(placeholder: string): React.ReactElement {
        return (
            <div className="search-bar">
                <Search size={18} />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        );
    }

    function renderResiduosTab(): React.ReactElement {
        return (
            <div className="config-section animate-fadeIn">
                <div className="section-header">
                    <h3>Catalogo de Residuos (Ley 24.051)</h3>
                    <button className="btn btn-primary" onClick={() => openResiduoModal()}>
                        <Plus size={18} />
                        Nuevo Residuo
                    </button>
                </div>

                {renderSearchBar('Buscar por codigo o nombre...')}

                {loading ? (
                    <div className="loading-state">Cargando catalogo...</div>
                ) : (
                    <>
                        {/* Mobile Cards View */}
                        <div className="config-cards">
                            {filteredResiduos.map(residuo => (
                                <div key={residuo.id} className="config-card">
                                    <div className="config-card-header">
                                        <span className="residuo-card-code">{residuo.codigo}</span>
                                        <div className="config-card-title">
                                            <span className="card-main-text">{residuo.nombre}</span>
                                        </div>
                                        <span className={`badge ${residuo.activo !== false ? 'badge-success' : 'badge-muted'}`}>
                                            {residuo.activo !== false ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                    <div className="config-card-body">
                                        <div className="card-details-grid">
                                            <div className="card-detail">
                                                <span className="card-detail-label">Categoria</span>
                                                <span className="card-detail-value">{residuo.categoria || '-'}</span>
                                            </div>
                                            <div className="card-detail">
                                                <span className="card-detail-label">Peligrosidad</span>
                                                <span className={`badge ${getPeligrosidadBadgeClass(residuo.peligrosidad)}`}>
                                                    {residuo.peligrosidad || 'N/A'}
                                                </span>
                                            </div>
                                            {residuo.caracteristicas && (
                                                <div className="card-detail" style={{ gridColumn: 'span 2' }}>
                                                    <span className="card-detail-label">Caracteristicas</span>
                                                    <span className="card-detail-value">{residuo.caracteristicas}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="config-card-actions">
                                        <button
                                            className="card-action-btn primary"
                                            onClick={() => openResiduoModal(residuo)}
                                        >
                                            <Edit2 size={18} />
                                            <span>Editar</span>
                                        </button>
                                        <button
                                            className="card-action-btn danger"
                                            onClick={() => setShowDeleteConfirm({
                                                type: 'residuo',
                                                id: residuo.id,
                                                nombre: residuo.nombre
                                            })}
                                        >
                                            <Trash2 size={18} />
                                            <span>Eliminar</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {filteredResiduos.length === 0 && (
                                <div className="empty-state">
                                    <Database size={48} />
                                    <p>No se encontraron residuos</p>
                                </div>
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Codigo</th>
                                        <th>Nombre</th>
                                        <th>Categoria</th>
                                        <th>Peligrosidad</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredResiduos.map(residuo => (
                                        <tr key={residuo.id}>
                                            <td><span className="badge badge-info">{residuo.codigo}</span></td>
                                            <td>{residuo.nombre}</td>
                                            <td>{residuo.categoria || '-'}</td>
                                            <td>
                                                <span className={`badge ${getPeligrosidadBadgeClass(residuo.peligrosidad)}`}>
                                                    {residuo.peligrosidad || 'N/A'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${residuo.activo !== false ? 'badge-success' : 'badge-muted'}`}>
                                                    {residuo.activo !== false ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-icon"
                                                        title="Editar"
                                                        onClick={() => openResiduoModal(residuo)}
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        className="btn-icon danger"
                                                        title="Eliminar"
                                                        onClick={() => setShowDeleteConfirm({
                                                            type: 'residuo',
                                                            id: residuo.id,
                                                            nombre: residuo.nombre
                                                        })}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredResiduos.length === 0 && (
                                <div className="empty-state">
                                    <Database size={48} />
                                    <p>No se encontraron residuos</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    }

    function renderUsuariosTab(): React.ReactElement {
        return (
            <div className="config-section animate-fadeIn">
                <div className="section-header">
                    <h3>Gestion de Usuarios</h3>
                    <button className="btn btn-primary" onClick={() => openUsuarioModal()}>
                        <UserPlus size={18} />
                        Nuevo Usuario
                    </button>
                </div>

                {renderSearchBar('Buscar por nombre, email o rol...')}

                {loading ? (
                    <div className="loading-state">Cargando usuarios...</div>
                ) : (
                    <>
                        {/* Mobile Cards View */}
                        <div className="config-cards">
                            {filteredUsuarios.map(usuario => (
                                <div key={usuario.id} className="config-card">
                                    <div className="config-card-header">
                                        <div className="user-card-avatar">
                                            {(usuario.nombre || 'U')[0].toUpperCase()}
                                        </div>
                                        <div className="config-card-title">
                                            <span className="card-main-text">{usuario.nombre} {usuario.apellido}</span>
                                            <span className="card-sub-text">{usuario.email}</span>
                                        </div>
                                        <span className={`badge ${getRolBadgeClass(usuario.rol)}`}>
                                            {usuario.rol}
                                        </span>
                                    </div>
                                    <div className="config-card-body">
                                        <div className="card-details-grid">
                                            <div className="card-detail">
                                                <span className="card-detail-label">Telefono</span>
                                                <span className="card-detail-value">{usuario.telefono || '—'}</span>
                                            </div>
                                            <div className="card-detail">
                                                <span className="card-detail-label">Estado</span>
                                                <span className={`badge ${usuario.activo ? 'badge-success' : 'badge-muted'}`}>
                                                    {usuario.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="config-card-actions">
                                        <button
                                            className="card-action-btn primary"
                                            onClick={() => openUsuarioModal(usuario)}
                                        >
                                            <Edit2 size={18} />
                                            <span>Editar</span>
                                        </button>
                                        <button
                                            className={`card-action-btn ${usuario.activo ? 'danger' : 'success'}`}
                                            onClick={() => handleToggleUsuarioStatus(usuario)}
                                        >
                                            {usuario.activo ? <AlertTriangle size={18} /> : <Check size={18} />}
                                            <span>{usuario.activo ? 'Desactivar' : 'Activar'}</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {filteredUsuarios.length === 0 && (
                                <div className="empty-state">
                                    <Users size={48} />
                                    <p>No se encontraron usuarios</p>
                                </div>
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Usuario</th>
                                        <th>Email</th>
                                        <th>Telefono</th>
                                        <th>Rol</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsuarios.map(usuario => (
                                        <tr key={usuario.id}>
                                            <td>
                                                <div className="user-cell">
                                                    <div className="user-avatar">
                                                        {(usuario.nombre || 'U')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <strong>{usuario.nombre} {usuario.apellido}</strong>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{usuario.email}</td>
                                            <td>{usuario.telefono || '-'}</td>
                                            <td>
                                                <span className={`badge ${getRolBadgeClass(usuario.rol)}`}>
                                                    {usuario.rol}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${usuario.activo ? 'badge-success' : 'badge-muted'}`}>
                                                    {usuario.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-icon"
                                                        title="Editar"
                                                        onClick={() => openUsuarioModal(usuario)}
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        className={`btn-icon ${usuario.activo ? 'danger' : 'success'}`}
                                                        title={usuario.activo ? 'Desactivar' : 'Activar'}
                                                        onClick={() => handleToggleUsuarioStatus(usuario)}
                                                    >
                                                        {usuario.activo ? <AlertTriangle size={18} /> : <Check size={18} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredUsuarios.length === 0 && (
                                <div className="empty-state">
                                    <Users size={48} />
                                    <p>No se encontraron usuarios</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    }

    function renderThemeSelector(): React.ReactElement {
        const themes: Array<{ id: ThemeType; icon: React.ReactElement; label: string }> = [
            { id: 'dark', icon: <Moon size={20} />, label: 'Oscuro' },
            { id: 'light', icon: <Sun size={20} />, label: 'Claro' },
            { id: 'system', icon: <Monitor size={20} />, label: 'Sistema' }
        ];

        return (
            <div className="theme-section">
                <h4>Tema de la Interfaz</h4>
                <div className="theme-selector">
                    {themes.map(t => (
                        <button
                            key={t.id}
                            className={`theme-option ${theme === t.id ? 'active' : ''}`}
                            onClick={() => setTheme(t.id)}
                        >
                            {t.icon}
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    function renderParametrosTab(): React.ReactElement {
        const paramFields = [
            { key: 'vencimientoManifiestos', label: 'Vencimiento de Manifiestos (dias)', type: 'number', help: 'Tiempo maximo para completar el ciclo' },
            { key: 'alertaDesvioGPS', label: 'Alerta de Desvio GPS (km)', type: 'number', help: 'Distancia permitida fuera de ruta' },
            { key: 'tiempoMaxTransito', label: 'Tiempo Maximo en Transito (horas)', type: 'number', help: 'Limite para generar alerta critica' },
            { key: 'emailNotificaciones', label: 'Email de Notificaciones DGFA', type: 'email', help: 'Direccion para alertas del sistema' },
            { key: 'toleranciaPeso', label: 'Tolerancia de Peso (%)', type: 'number', help: 'Diferencia maxima permitida en pesaje' },
            { key: 'tiempoSesion', label: 'Duracion de Sesion (minutos)', type: 'number', help: 'Tiempo de inactividad antes de cerrar sesion' }
        ] as const;

        return (
            <div className="config-section animate-fadeIn">
                <div className="section-header">
                    <h3>Parametros del Sistema</h3>
                    <button className="btn btn-primary" onClick={handleSaveParametros}>
                        <Save size={18} />
                        Guardar Cambios
                    </button>
                </div>

                {renderThemeSelector()}

                <div className="params-grid">
                    {paramFields.map(field => (
                        <div key={field.key} className="param-group">
                            <label>{field.label}</label>
                            <input
                                type={field.type}
                                value={parametros[field.key]}
                                onChange={e => updateParametro(field.key, e.target.value)}
                            />
                            <span className="param-help">{field.help}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    async function handleRunTask(taskName: string): Promise<void> {
        setRunningTask(taskName);
        try {
            const result = await cronService.runTask(taskName);
            if (result.success) {
                showToast(result.message, 'success');
            } else {
                showToast(result.message, 'error');
            }
        } catch {
            showToast('Error al ejecutar tarea', 'error');
        } finally {
            setRunningTask(null);
        }
    }

    async function handleRunBackup(tipo: 'daily' | 'weekly'): Promise<void> {
        setRunningTask(`backup_${tipo}`);
        try {
            const result = await cronService.runBackup(tipo);
            if (result.success) {
                showToast(result.message, 'success');
            } else {
                showToast(result.message, 'error');
            }
        } catch {
            showToast('Error al ejecutar backup', 'error');
        } finally {
            setRunningTask(null);
        }
    }

    function getTaskIcon(taskName: string): React.ReactElement {
        if (taskName.includes('backup')) return <HardDrive size={20} />;
        if (taskName.includes('limpieza')) return <Trash2 size={20} />;
        return <Clock size={20} />;
    }

    function renderTareasTab(): React.ReactElement {
        return (
            <div className="config-section animate-fadeIn">
                <div className="section-header">
                    <h3>Tareas Programadas (CRON)</h3>
                    <button className="btn btn-secondary" onClick={loadTareas}>
                        <RefreshCw size={18} />
                        Actualizar
                    </button>
                </div>

                {loading ? (
                    <div className="loading-state">Cargando tareas...</div>
                ) : (
                    <>
                        {/* Scheduled Tasks */}
                        <div className="cron-section">
                            <h4><Clock size={18} /> Reportes Automaticos</h4>
                            <div className="cron-tasks-grid">
                                {cronTasks.filter(t => !t.name.includes('backup') && !t.name.includes('limpieza')).map(task => (
                                    <div key={task.name} className="cron-task-card">
                                        <div className="cron-task-header">
                                            {getTaskIcon(task.name)}
                                            <div className="cron-task-info">
                                                <span className="cron-task-name">{task.name}</span>
                                                <span className="cron-task-schedule">{task.schedule}</span>
                                            </div>
                                        </div>
                                        <p className="cron-task-description">{task.description}</p>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => handleRunTask(task.name)}
                                            disabled={runningTask !== null}
                                        >
                                            {runningTask === task.name ? (
                                                <><RefreshCw size={16} className="spin" /> Ejecutando...</>
                                            ) : (
                                                <><Play size={16} /> Ejecutar Ahora</>
                                            )}
                                        </button>
                                    </div>
                                ))}
                                {cronTasks.filter(t => !t.name.includes('backup') && !t.name.includes('limpieza')).length === 0 && (
                                    <div className="empty-state small">
                                        <Clock size={32} />
                                        <p>No hay tareas de reportes configuradas</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Backup Tasks */}
                        <div className="cron-section">
                            <h4><HardDrive size={18} /> Backups Automaticos</h4>
                            <div className="cron-tasks-grid">
                                {cronTasks.filter(t => t.name.includes('backup') || t.name.includes('limpieza')).map(task => (
                                    <div key={task.name} className="cron-task-card">
                                        <div className="cron-task-header">
                                            {getTaskIcon(task.name)}
                                            <div className="cron-task-info">
                                                <span className="cron-task-name">{task.name}</span>
                                                <span className="cron-task-schedule">{task.schedule}</span>
                                            </div>
                                        </div>
                                        <p className="cron-task-description">{task.description}</p>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => handleRunTask(task.name)}
                                            disabled={runningTask !== null}
                                        >
                                            {runningTask === task.name ? (
                                                <><RefreshCw size={16} className="spin" /> Ejecutando...</>
                                            ) : (
                                                <><Play size={16} /> Ejecutar Ahora</>
                                            )}
                                        </button>
                                    </div>
                                ))}
                                {cronTasks.filter(t => t.name.includes('backup') || t.name.includes('limpieza')).length === 0 && (
                                    <div className="empty-state small">
                                        <HardDrive size={32} />
                                        <p>No hay tareas de backup configuradas</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Manual Backup Buttons */}
                        <div className="cron-section">
                            <h4><HardDrive size={18} /> Backup Manual</h4>
                            <div className="backup-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleRunBackup('daily')}
                                    disabled={runningTask !== null}
                                >
                                    {runningTask === 'backup_daily' ? (
                                        <><RefreshCw size={18} className="spin" /> Ejecutando...</>
                                    ) : (
                                        <><HardDrive size={18} /> Backup Diario</>
                                    )}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => handleRunBackup('weekly')}
                                    disabled={runningTask !== null}
                                >
                                    {runningTask === 'backup_weekly' ? (
                                        <><RefreshCw size={18} className="spin" /> Ejecutando...</>
                                    ) : (
                                        <><HardDrive size={18} /> Backup Semanal (Comprimido)</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="cron-info">
                            <AlertTriangle size={18} />
                            <p>
                                Las tareas programadas se ejecutan automaticamente segun el horario configurado.
                                Puede ejecutar cualquier tarea manualmente usando los botones de arriba.
                                Los backups se almacenan por 30 dias.
                            </p>
                        </div>
                    </>
                )}
            </div>
        );
    }

    function renderResiduoModal(): React.ReactElement {
        return (
            <Modal
                isOpen={showResiduoModal}
                onClose={() => setShowResiduoModal(false)}
                title={editingResiduo ? 'Editar Residuo' : 'Nuevo Residuo'}
                size="md"
            >
                <form className="config-form" onSubmit={e => { e.preventDefault(); handleSaveResiduo(); }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Codigo *</label>
                            <input
                                type="text"
                                value={residuoForm.codigo}
                                onChange={e => setResiduoForm({ ...residuoForm, codigo: e.target.value })}
                                placeholder="Ej: Y1, Y2, Y3..."
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Categoria</label>
                            <select
                                value={residuoForm.categoria}
                                onChange={e => setResiduoForm({ ...residuoForm, categoria: e.target.value })}
                            >
                                <option value="A">Categoria A - Corrientes de desechos</option>
                                <option value="B">Categoria B - Desechos segun caracteristicas</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Nombre *</label>
                        <input
                            type="text"
                            value={residuoForm.nombre}
                            onChange={e => setResiduoForm({ ...residuoForm, nombre: e.target.value })}
                            placeholder="Nombre del tipo de residuo"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Descripcion</label>
                        <textarea
                            value={residuoForm.descripcion}
                            onChange={e => setResiduoForm({ ...residuoForm, descripcion: e.target.value })}
                            placeholder="Descripcion detallada del residuo..."
                            rows={3}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Peligrosidad</label>
                            <select
                                value={residuoForm.peligrosidad}
                                onChange={e => setResiduoForm({ ...residuoForm, peligrosidad: e.target.value })}
                            >
                                <option value="Alta">Alta</option>
                                <option value="Media">Media</option>
                                <option value="Baja">Baja</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Caracteristicas</label>
                            <input
                                type="text"
                                value={residuoForm.caracteristicas}
                                onChange={e => setResiduoForm({ ...residuoForm, caracteristicas: e.target.value })}
                                placeholder="Ej: Inflamable, Corrosivo, Toxico..."
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowResiduoModal(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={18} />
                            {editingResiduo ? 'Guardar Cambios' : 'Crear Residuo'}
                        </button>
                    </div>
                </form>
            </Modal>
        );
    }

    function renderUsuarioModal(): React.ReactElement {
        return (
            <Modal
                isOpen={showUsuarioModal}
                onClose={() => setShowUsuarioModal(false)}
                title={editingUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}
                size="md"
            >
                <form className="config-form" onSubmit={e => { e.preventDefault(); handleSaveUsuario(); }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label><Users size={16} /> Nombre *</label>
                            <input
                                type="text"
                                value={usuarioForm.nombre}
                                onChange={e => setUsuarioForm({ ...usuarioForm, nombre: e.target.value })}
                                placeholder="Nombre"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Apellido</label>
                            <input
                                type="text"
                                value={usuarioForm.apellido}
                                onChange={e => setUsuarioForm({ ...usuarioForm, apellido: e.target.value })}
                                placeholder="Apellido"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label><Mail size={16} /> Email *</label>
                        <input
                            type="email"
                            value={usuarioForm.email}
                            onChange={e => setUsuarioForm({ ...usuarioForm, email: e.target.value })}
                            placeholder="usuario@empresa.com"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label><Phone size={16} /> Telefono</label>
                            <input
                                type="tel"
                                value={usuarioForm.telefono}
                                onChange={e => setUsuarioForm({ ...usuarioForm, telefono: e.target.value })}
                                placeholder="+54 261 ..."
                            />
                        </div>
                        <div className="form-group">
                            <label><Shield size={16} /> Rol *</label>
                            <select
                                value={usuarioForm.rol}
                                onChange={e => setUsuarioForm({ ...usuarioForm, rol: e.target.value })}
                            >
                                <option value="ADMIN">Administrador</option>
                                <option value="GENERADOR">Generador</option>
                                <option value="TRANSPORTISTA">Transportista</option>
                                <option value="OPERADOR">Operador</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={usuarioForm.activo}
                                onChange={e => setUsuarioForm({ ...usuarioForm, activo: e.target.checked })}
                            />
                            <span>Usuario activo</span>
                        </label>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowUsuarioModal(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={18} />
                            {editingUsuario ? 'Guardar Cambios' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </Modal>
        );
    }

    function renderDeleteConfirmModal(): React.ReactElement {
        return (
            <Modal
                isOpen={showDeleteConfirm !== null}
                onClose={() => setShowDeleteConfirm(null)}
                title="Confirmar Eliminacion"
                size="sm"
            >
                <div className="delete-confirm">
                    <AlertTriangle size={48} className="warning-icon" />
                    <p>Estas seguro de eliminar <strong>{showDeleteConfirm?.nombre}</strong>?</p>
                    <p className="warning-text">Esta accion no se puede deshacer.</p>
                    <div className="form-actions">
                        <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>
                            Cancelar
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={() => {
                                if (showDeleteConfirm?.type === 'residuo') {
                                    handleDeleteResiduo(showDeleteConfirm.id);
                                }
                            }}
                        >
                            <Trash2 size={18} />
                            Eliminar
                        </button>
                    </div>
                </div>
            </Modal>
        );
    }

    function renderActiveTab(): React.ReactElement {
        switch (activeTab) {
            case 'residuos': return renderResiduosTab();
            case 'usuarios': return renderUsuariosTab();
            case 'parametros': return renderParametrosTab();
            case 'tareas': return renderTareasTab();
        }
    }

    return (
        <div className="configuracion-page animate-fadeIn">
            {renderToasts()}

            <div className="config-header">
                <div className="header-title">
                    <Settings size={32} />
                    <div>
                        <h2>Configuracion del Sistema</h2>
                        <p>Administracion de catalogos, usuarios y parametros generales</p>
                    </div>
                </div>
            </div>

            <div className="config-container">
                {renderSidebar()}
                <div className="config-content">
                    {renderActiveTab()}
                </div>
            </div>

            {renderResiduoModal()}
            {renderUsuarioModal()}
            {renderDeleteConfirmModal()}
        </div>
    );
}

export default Configuracion;
