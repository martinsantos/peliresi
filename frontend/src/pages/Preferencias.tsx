/**
 * Preferencias - Configuración personal del usuario
 * CU-G12: Configurar preferencias de usuario
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    ArrowLeft,
    User,
    Lock,
    Bell,
    Moon,
    Sun,
    Monitor,
    Save,
    Check,
    AlertTriangle,
    Eye,
    EyeOff,
    Mail,
    Phone,
    Shield,
    Globe,
    Smartphone
} from 'lucide-react';
import './Preferencias.css';

type ThemeType = 'dark' | 'light' | 'system';

interface NotificationSettings {
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
    alertasCriticas: boolean;
    alertasTransito: boolean;
    alertasVencimiento: boolean;
    resumenDiario: boolean;
}

const Preferencias: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Profile state
    const [nombre, setNombre] = useState(user?.nombre || '');
    const [apellido, setApellido] = useState(user?.apellido || '');
    const [email, setEmail] = useState(user?.email || '');
    const [telefono, setTelefono] = useState(user?.telefono || '');

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Theme state
    const [theme, setTheme] = useState<ThemeType>(() => {
        return (localStorage.getItem('sitrep_theme') as ThemeType) || 'dark';
    });

    // Language state
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('sitrep_language') || 'es';
    });

    // Notification settings
    const [notifications, setNotifications] = useState<NotificationSettings>(() => {
        const saved = localStorage.getItem('sitrep_notifications');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                // Return defaults on parse error
            }
        }
        return {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
            alertasCriticas: true,
            alertasTransito: true,
            alertasVencimiento: true,
            resumenDiario: false
        };
    });

    // UI state
    const [activeSection, setActiveSection] = useState<'profile' | 'password' | 'notifications' | 'appearance'>('profile');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

    // Save language
    useEffect(() => {
        localStorage.setItem('sitrep_language', language);
    }, [language]);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const handleSaveProfile = async () => {
        if (!nombre.trim() || !email.trim()) {
            showMessage('error', 'Nombre y email son requeridos');
            return;
        }

        setSaving(true);
        try {
            // Simular guardado - en producción llamar al backend
            await new Promise(resolve => setTimeout(resolve, 800));

            // Guardar en localStorage como demo
            localStorage.setItem('sitrep_user_profile', JSON.stringify({
                nombre, apellido, email, telefono
            }));

            showMessage('success', 'Perfil actualizado correctamente');
        } catch (err) {
            showMessage('error', 'Error al guardar el perfil');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword) {
            showMessage('error', 'Ingrese su contraseña actual');
            return;
        }
        if (!newPassword || newPassword.length < 8) {
            showMessage('error', 'La nueva contraseña debe tener al menos 8 caracteres');
            return;
        }
        if (newPassword !== confirmPassword) {
            showMessage('error', 'Las contraseñas no coinciden');
            return;
        }

        setSaving(true);
        try {
            // Simular cambio - en producción llamar al backend
            await new Promise(resolve => setTimeout(resolve, 800));

            showMessage('success', 'Contraseña actualizada correctamente');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            showMessage('error', 'Error al cambiar la contraseña');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNotifications = async () => {
        setSaving(true);
        try {
            localStorage.setItem('sitrep_notifications', JSON.stringify(notifications));
            await new Promise(resolve => setTimeout(resolve, 500));
            showMessage('success', 'Preferencias de notificaciones guardadas');
        } catch (err) {
            showMessage('error', 'Error al guardar las notificaciones');
        } finally {
            setSaving(false);
        }
    };

    const updateNotification = (key: keyof NotificationSettings, value: boolean) => {
        setNotifications(prev => ({ ...prev, [key]: value }));
    };

    const renderProfileSection = () => (
        <div className="pref-section animate-fadeIn">
            <div className="section-header">
                <User size={24} />
                <div>
                    <h3>Información Personal</h3>
                    <p>Actualiza tus datos de perfil</p>
                </div>
            </div>

            <div className="pref-form">
                <div className="form-row">
                    <div className="form-group">
                        <label>Nombre *</label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Tu nombre"
                        />
                    </div>
                    <div className="form-group">
                        <label>Apellido</label>
                        <input
                            type="text"
                            value={apellido}
                            onChange={(e) => setApellido(e.target.value)}
                            placeholder="Tu apellido"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label><Mail size={16} /> Email *</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                    />
                </div>

                <div className="form-group">
                    <label><Phone size={16} /> Teléfono</label>
                    <input
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        placeholder="+54 261 ..."
                    />
                    <span className="form-help">Usado para notificaciones SMS y verificación</span>
                </div>

                <div className="user-info-box">
                    <Shield size={18} />
                    <div>
                        <span className="label">Rol en el sistema</span>
                        <span className="value">{user?.rol || 'GENERADOR'}</span>
                    </div>
                </div>

                <button
                    className="btn btn-primary btn-save"
                    onClick={handleSaveProfile}
                    disabled={saving}
                >
                    {saving ? (
                        <><span className="spinner" /> Guardando...</>
                    ) : (
                        <><Save size={18} /> Guardar Cambios</>
                    )}
                </button>
            </div>
        </div>
    );

    const renderPasswordSection = () => (
        <div className="pref-section animate-fadeIn">
            <div className="section-header">
                <Lock size={24} />
                <div>
                    <h3>Cambiar Contraseña</h3>
                    <p>Mantén tu cuenta segura</p>
                </div>
            </div>

            <div className="pref-form">
                <div className="form-group">
                    <label>Contraseña Actual</label>
                    <div className="password-input">
                        <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Tu contraseña actual"
                        />
                        <button
                            type="button"
                            className="toggle-password"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                            {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div className="form-group">
                    <label>Nueva Contraseña</label>
                    <div className="password-input">
                        <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mínimo 8 caracteres"
                        />
                        <button
                            type="button"
                            className="toggle-password"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <div className="password-strength">
                        <div className={`strength-bar ${newPassword.length >= 8 ? 'strong' : newPassword.length >= 4 ? 'medium' : 'weak'}`} />
                        <span>{newPassword.length >= 8 ? 'Fuerte' : newPassword.length >= 4 ? 'Media' : 'Débil'}</span>
                    </div>
                </div>

                <div className="form-group">
                    <label>Confirmar Nueva Contraseña</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite la nueva contraseña"
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                        <span className="form-error">Las contraseñas no coinciden</span>
                    )}
                </div>

                <button
                    className="btn btn-primary btn-save"
                    onClick={handleChangePassword}
                    disabled={saving || !currentPassword || !newPassword || newPassword !== confirmPassword}
                >
                    {saving ? (
                        <><span className="spinner" /> Cambiando...</>
                    ) : (
                        <><Lock size={18} /> Cambiar Contraseña</>
                    )}
                </button>
            </div>
        </div>
    );

    const renderNotificationsSection = () => (
        <div className="pref-section animate-fadeIn">
            <div className="section-header">
                <Bell size={24} />
                <div>
                    <h3>Notificaciones</h3>
                    <p>Configura cómo quieres recibir alertas</p>
                </div>
            </div>

            <div className="pref-form">
                <h4 className="subsection-title">Canales de Notificación</h4>

                <div className="notification-options">
                    <label className="toggle-option">
                        <div className="option-info">
                            <Mail size={20} />
                            <div>
                                <span className="option-title">Notificaciones por Email</span>
                                <span className="option-desc">Recibir alertas en tu correo electrónico</span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={notifications.emailNotifications}
                            onChange={(e) => updateNotification('emailNotifications', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>

                    <label className="toggle-option">
                        <div className="option-info">
                            <Smartphone size={20} />
                            <div>
                                <span className="option-title">Notificaciones Push</span>
                                <span className="option-desc">Alertas en tiempo real en tu dispositivo</span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={notifications.pushNotifications}
                            onChange={(e) => updateNotification('pushNotifications', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>

                    <label className="toggle-option">
                        <div className="option-info">
                            <Phone size={20} />
                            <div>
                                <span className="option-title">Notificaciones SMS</span>
                                <span className="option-desc">Mensajes de texto para alertas críticas</span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={notifications.smsNotifications}
                            onChange={(e) => updateNotification('smsNotifications', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>
                </div>

                <h4 className="subsection-title">Tipos de Alertas</h4>

                <div className="notification-options">
                    <label className="toggle-option">
                        <div className="option-info">
                            <AlertTriangle size={20} className="text-danger" />
                            <div>
                                <span className="option-title">Alertas Críticas</span>
                                <span className="option-desc">Desvíos de ruta, anomalías de peso, etc.</span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={notifications.alertasCriticas}
                            onChange={(e) => updateNotification('alertasCriticas', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>

                    <label className="toggle-option">
                        <div className="option-info">
                            <div className="icon-transit" />
                            <div>
                                <span className="option-title">Alertas de Tránsito</span>
                                <span className="option-desc">Retiros, entregas y cambios de estado</span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={notifications.alertasTransito}
                            onChange={(e) => updateNotification('alertasTransito', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>

                    <label className="toggle-option">
                        <div className="option-info">
                            <div className="icon-calendar" />
                            <div>
                                <span className="option-title">Alertas de Vencimiento</span>
                                <span className="option-desc">Manifiestos próximos a vencer</span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={notifications.alertasVencimiento}
                            onChange={(e) => updateNotification('alertasVencimiento', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>

                    <label className="toggle-option">
                        <div className="option-info">
                            <div className="icon-summary" />
                            <div>
                                <span className="option-title">Resumen Diario</span>
                                <span className="option-desc">Email con resumen de actividad del día</span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={notifications.resumenDiario}
                            onChange={(e) => updateNotification('resumenDiario', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>
                </div>

                <button
                    className="btn btn-primary btn-save"
                    onClick={handleSaveNotifications}
                    disabled={saving}
                >
                    {saving ? (
                        <><span className="spinner" /> Guardando...</>
                    ) : (
                        <><Save size={18} /> Guardar Preferencias</>
                    )}
                </button>
            </div>
        </div>
    );

    const renderAppearanceSection = () => (
        <div className="pref-section animate-fadeIn">
            <div className="section-header">
                <Moon size={24} />
                <div>
                    <h3>Apariencia</h3>
                    <p>Personaliza la interfaz</p>
                </div>
            </div>

            <div className="pref-form">
                <h4 className="subsection-title">Tema</h4>

                <div className="theme-selector">
                    <button
                        className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                        onClick={() => setTheme('dark')}
                    >
                        <Moon size={24} />
                        <span>Oscuro</span>
                        {theme === 'dark' && <Check size={16} className="check-icon" />}
                    </button>
                    <button
                        className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                        onClick={() => setTheme('light')}
                    >
                        <Sun size={24} />
                        <span>Claro</span>
                        {theme === 'light' && <Check size={16} className="check-icon" />}
                    </button>
                    <button
                        className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                        onClick={() => setTheme('system')}
                    >
                        <Monitor size={24} />
                        <span>Sistema</span>
                        {theme === 'system' && <Check size={16} className="check-icon" />}
                    </button>
                </div>

                <h4 className="subsection-title">Idioma</h4>

                <div className="language-selector">
                    <button
                        className={`language-option ${language === 'es' ? 'active' : ''}`}
                        onClick={() => setLanguage('es')}
                    >
                        <Globe size={20} />
                        <span>Español</span>
                        {language === 'es' && <Check size={16} className="check-icon" />}
                    </button>
                    <button
                        className={`language-option ${language === 'en' ? 'active' : ''}`}
                        onClick={() => setLanguage('en')}
                    >
                        <Globe size={20} />
                        <span>English</span>
                        {language === 'en' && <Check size={16} className="check-icon" />}
                    </button>
                </div>

                <p className="appearance-note">
                    Los cambios de tema se aplican inmediatamente. El idioma se aplicará en la próxima sesión.
                </p>
            </div>
        </div>
    );

    return (
        <div className="preferencias-page">
            {/* Header */}
            <div className="pref-header">
                <button className="btn-back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                <div className="header-info">
                    <h1>Preferencias</h1>
                    <p>Configuración de tu cuenta</p>
                </div>
            </div>

            {/* Message Banner */}
            {message && (
                <div className={`message-banner ${message.type}`}>
                    {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Content */}
            <div className="pref-content">
                {/* Navigation */}
                <div className="pref-nav">
                    <button
                        className={`nav-item ${activeSection === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveSection('profile')}
                    >
                        <User size={20} />
                        <span>Perfil</span>
                    </button>
                    <button
                        className={`nav-item ${activeSection === 'password' ? 'active' : ''}`}
                        onClick={() => setActiveSection('password')}
                    >
                        <Lock size={20} />
                        <span>Contraseña</span>
                    </button>
                    <button
                        className={`nav-item ${activeSection === 'notifications' ? 'active' : ''}`}
                        onClick={() => setActiveSection('notifications')}
                    >
                        <Bell size={20} />
                        <span>Notificaciones</span>
                    </button>
                    <button
                        className={`nav-item ${activeSection === 'appearance' ? 'active' : ''}`}
                        onClick={() => setActiveSection('appearance')}
                    >
                        <Moon size={20} />
                        <span>Apariencia</span>
                    </button>
                </div>

                {/* Sections */}
                <div className="pref-sections">
                    {activeSection === 'profile' && renderProfileSection()}
                    {activeSection === 'password' && renderPasswordSection()}
                    {activeSection === 'notifications' && renderNotificationsSection()}
                    {activeSection === 'appearance' && renderAppearanceSection()}
                </div>
            </div>
        </div>
    );
};

export default Preferencias;
