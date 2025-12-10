import React, { useState, useEffect } from 'react';
import {
    X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2,
    FileText, Truck, MapPin, Users, BarChart3, Scale,
    Bell, QrCode, Shield, Factory, Building2, Server,
    ClipboardCheck, Zap, AlertTriangle, Wifi, WifiOff,
    Database, Smartphone, Globe, Settings, Download, Upload,
    Clock, Eye, Plus, Search
} from 'lucide-react';
import './OnboardingTour.css';

// System Preview Component
const SystemPreview: React.FC<{ type: string }> = ({ type }) => {
    const [animStep, setAnimStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setAnimStep(s => (s + 1) % 4);
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    const renderPreview = () => {
        switch (type) {
            case 'dashboard':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Dashboard</span>
                            <div className="preview-user">Admin ▼</div>
                        </div>
                        <div className="preview-content">
                            <div className="preview-stats">
                                {[
                                    { icon: '📄', val: '70', label: 'TOTAL', bg: '#3b82f6' },
                                    { icon: '📝', val: '4', label: 'BORRADOR', bg: '#f59e0b' },
                                    { icon: '🚛', val: '4', label: 'TRÁNSITO', bg: '#8b5cf6' },
                                    { icon: '✅', val: '40', label: 'CERRADOS', bg: '#10b981' }
                                ].map((s, i) => (
                                    <div key={i} className={`preview-stat ${animStep === i ? 'active' : ''}`}>
                                        <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
                                        <div className="stat-value">{s.val}</div>
                                        <div className="stat-label">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="preview-chart">
                                <div className="mini-chart-bars">
                                    {[60, 80, 45, 90, 70].map((h, i) => (
                                        <div key={i} className="mini-bar" style={{ height: `${h}%` }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'manifiestos':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Manifiestos</span>
                            <button className="preview-btn-new">+ Nuevo</button>
                        </div>
                        <div className="preview-content">
                            <div className="preview-table">
                                <div className="preview-table-header">
                                    <span>NÚMERO</span><span>GENERADOR</span><span>ESTADO</span>
                                </div>
                                {[
                                    { num: 'M-2024-001002', gen: 'Industrias SA', status: 'transit' },
                                    { num: 'M-2024-001012', gen: 'Química SRL', status: 'pending' },
                                    { num: 'M-2024-001007', gen: 'Petroquímica', status: 'complete' }
                                ].map((row, i) => (
                                    <div key={i} className={`preview-table-row ${animStep === i ? 'highlight' : ''}`}>
                                        <span>{row.num}</span>
                                        <span>{row.gen}</span>
                                        <span className={`status-badge ${row.status}`}>
                                            {row.status === 'transit' ? '🚛' : row.status === 'pending' ? '📝' : '✅'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'tracking':
                return (
                    <div className="preview-screen preview-map">
                        <div className="preview-header">
                            <span className="preview-title">Tracking GPS</span>
                            <span className="preview-live">● EN VIVO</span>
                        </div>
                        <div className="preview-content map-content">
                            <div className="map-area">
                                <div className="map-grid" />
                                <div className={`truck-marker step-${animStep}`}>
                                    <Truck size={14} />
                                </div>
                                <div className="location-pin origin">A</div>
                                <div className="location-pin dest">B</div>
                                <div className="route-line" />
                            </div>
                            <div className="map-panel">
                                <div className="panel-title">Activos (4)</div>
                                {['M-001002', 'M-001012'].map((m, i) => (
                                    <div key={i} className={`transport-item ${animStep === i ? 'active' : ''}`}>
                                        <span className="dot" />{m}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'actores':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Gestión de Actores</span>
                        </div>
                        <div className="preview-content">
                            <div className="preview-tabs">
                                {['Generadores', 'Transportistas', 'Operadores'].map((tab, i) => (
                                    <div key={i} className={`preview-tab ${animStep === i ? 'active' : ''}`}>{tab}</div>
                                ))}
                            </div>
                            <div className="preview-cards">
                                <div className={`preview-card ${animStep === 3 ? 'highlight' : ''}`}>
                                    <div className="card-avatar">🏭</div>
                                    <div className="card-info">
                                        <div className="card-name">Industrias Mendoza SA</div>
                                        <div className="card-detail">CUIT: 30-70123456-7</div>
                                    </div>
                                    <span className="badge-active">Activo</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'alertas':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Sistema de Alertas</span>
                        </div>
                        <div className="preview-content">
                            <div className="alert-rules">
                                {[
                                    { name: 'Tiempo excesivo', desc: '> 48 horas' },
                                    { name: 'Desvío de ruta', desc: '> 5km' }
                                ].map((rule, i) => (
                                    <div key={i} className={`alert-rule ${animStep === i ? 'highlight' : ''}`}>
                                        <div className={`rule-toggle ${animStep >= i ? 'on' : ''}`} />
                                        <div className="rule-info">
                                            <div className="rule-name">{rule.name}</div>
                                            <div className="rule-desc">{rule.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className={`alert-notification ${animStep >= 2 ? 'show' : ''}`}>
                                <AlertTriangle size={14} /> Desvío detectado: 8.5km
                            </div>
                        </div>
                    </div>
                );

            case 'qr':
                return (
                    <div className="preview-screen preview-qr">
                        <div className="preview-header">
                            <span className="preview-title">Escanear QR</span>
                        </div>
                        <div className="preview-content qr-content">
                            <div className={`qr-frame ${animStep === 1 ? 'scanning' : ''} ${animStep >= 2 ? 'success' : ''}`}>
                                <QrCode size={50} />
                                {animStep === 1 && <div className="scan-line" />}
                            </div>
                            {animStep >= 2 && (
                                <div className="qr-result">
                                    <CheckCircle2 size={16} /> M-2024-001002 ✓
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'form':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Nuevo Manifiesto</span>
                        </div>
                        <div className="preview-content form-content">
                            {[
                                { label: 'Tipo Residuo', value: 'Y1 - Residuos clínicos' },
                                { label: 'Cantidad', value: '150 kg' },
                                { label: 'Transportista', value: 'Transportes Andes' }
                            ].map((field, i) => (
                                <div key={i} className={`form-field ${animStep === i ? 'focus' : ''}`}>
                                    <label>{field.label}</label>
                                    <div className="form-value">{field.value}</div>
                                </div>
                            ))}
                            <button className={`form-submit ${animStep === 3 ? 'clicked' : ''}`}>
                                <ClipboardCheck size={14} /> Firmar
                            </button>
                        </div>
                    </div>
                );

            case 'offline':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Modo Offline</span>
                            <WifiOff size={16} className="wifi-off" />
                        </div>
                        <div className="preview-content offline-content">
                            <div className={`offline-status ${animStep < 2 ? 'disconnected' : 'connected'}`}>
                                {animStep < 2 ? <WifiOff size={32} /> : <Wifi size={32} />}
                                <span>{animStep < 2 ? 'Sin conexión' : 'Sincronizando...'}</span>
                            </div>
                            <div className="offline-queue">
                                <div className="queue-item synced">✓ Retiro M-001002</div>
                                <div className={`queue-item ${animStep >= 2 ? 'syncing' : 'pending'}`}>
                                    {animStep >= 2 ? '↻' : '⏳'} Firma pendiente
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'arquitectura':
                return (
                    <div className="preview-screen arquitectura">
                        <div className="preview-header">
                            <span className="preview-title">Arquitectura</span>
                        </div>
                        <div className="preview-content arq-content">
                            <div className="arq-layers">
                                <div className={`arq-layer ${animStep === 0 ? 'active' : ''}`}>
                                    <Globe size={16} /> Frontend React
                                </div>
                                <div className="arq-arrow">↓</div>
                                <div className={`arq-layer ${animStep === 1 ? 'active' : ''}`}>
                                    <Server size={16} /> API Node.js
                                </div>
                                <div className="arq-arrow">↓</div>
                                <div className={`arq-layer ${animStep === 2 ? 'active' : ''}`}>
                                    <Database size={16} /> PostgreSQL
                                </div>
                                <div className={`arq-layer mobile ${animStep === 3 ? 'active' : ''}`}>
                                    <Smartphone size={16} /> App Móvil
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'mobile':
                return (
                    <div className="preview-screen mobile-preview">
                        <div className="mobile-device">
                            <div className="mobile-notch" />
                            <div className="mobile-screen">
                                <div className="mobile-header">
                                    <span>Transportista</span>
                                    <Wifi size={12} />
                                </div>
                                <div className="mobile-content">
                                    <div className={`mobile-card ${animStep === 0 ? 'active' : ''}`}>
                                        <FileText size={16} />
                                        <span>M-2024-001002</span>
                                    </div>
                                    <div className={`mobile-btn ${animStep === 1 ? 'pulse' : ''}`}>
                                        <QrCode size={18} /> Escanear QR
                                    </div>
                                    <div className={`mobile-btn ${animStep === 2 ? 'pulse' : ''}`}>
                                        <MapPin size={18} /> Iniciar Viaje
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="preview-screen preview-welcome">
                        <div className="preview-logo">
                            <Shield size={36} />
                        </div>
                        <div className="preview-welcome-title">Sistema DGFA</div>
                        <div className="preview-welcome-sub">Trazabilidad de Residuos Peligrosos</div>
                        <div className="preview-welcome-features">
                            <span>✓ Manifiestos digitales</span>
                            <span>✓ Tracking GPS</span>
                            <span>✓ Firma electrónica</span>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="system-preview-container">
            <div className="preview-browser">
                <div className="browser-bar">
                    <div className="browser-dots">
                        <span className="dot red" />
                        <span className="dot yellow" />
                        <span className="dot green" />
                    </div>
                    <div className="browser-url">ultimamilla.com.ar/demoambiente</div>
                </div>
                {renderPreview()}
            </div>
        </div>
    );
};

// Slide definitions
interface TourSlide {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    features: string[];
    color: string;
    previewType: string;
    cuRef?: string;
}

// ADMIN slides
const slidesAdmin: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido al Sistema DGFA!', subtitle: 'Plataforma de Gestión Ambiental',
        description: 'Sistema integral para la trazabilidad de residuos peligrosos según Ley 24.051.',
        icon: <Shield />, features: ['Control total', 'Supervisión en tiempo real', 'Cumplimiento normativo'],
        color: '#10b981', previewType: 'welcome'
    },
    {
        id: 'cambio-perfil', title: '⭐ CAMBIO DE PERFIL', subtitle: 'Función Importante',
        description: 'Haz clic en tu nombre en la esquina superior derecha para cambiar entre roles: Administrador, Generador, Transportista u Operador.',
        icon: <Users />, features: ['Menú superior derecha', '4 perfiles disponibles', 'Cambio instantáneo'],
        color: '#f59e0b', previewType: 'dashboard'
    },
    {
        id: 'dashboard', title: 'Dashboard Ejecutivo', subtitle: 'Panel de Control CU-A02',
        description: 'KPIs actualizados: manifiestos activos, en tránsito, completados. Gráficos y alertas.',
        icon: <BarChart3 />, features: ['Métricas en tiempo real', 'Gráficos de tendencias', 'Alertas pendientes'],
        color: '#3b82f6', previewType: 'dashboard', cuRef: 'CU-A02'
    },
    {
        id: 'usuarios', title: 'Gestión de Usuarios', subtitle: 'Administración CU-A03',
        description: 'Crea y administra usuarios. Asigna roles y permisos específicos.',
        icon: <Users />, features: ['CRUD usuarios', 'Roles', 'Permisos'],
        color: '#8b5cf6', previewType: 'actores', cuRef: 'CU-A03'
    },
    {
        id: 'catalogo', title: 'Catálogo de Residuos', subtitle: 'Ley 24.051 CU-A05',
        description: 'Catálogo oficial: categorías Y, códigos, características de peligrosidad.',
        icon: <FileText />, features: ['Categorías Y', 'Códigos oficiales', 'Características H'],
        color: '#f59e0b', previewType: 'form', cuRef: 'CU-A05'
    },
    {
        id: 'generadores', title: 'Gestionar Generadores', subtitle: 'Registro CU-A06',
        description: 'Padrón de generadores de residuos peligrosos. Alta, baja, habilitaciones.',
        icon: <Factory />, features: ['Padrón', 'Inscripción', 'Habilitación'],
        color: '#ec4899', previewType: 'actores', cuRef: 'CU-A06'
    },
    {
        id: 'transportistas', title: 'Gestionar Transportistas', subtitle: 'Flota CU-A07',
        description: 'Empresas transportistas, vehículos autorizados y choferes habilitados.',
        icon: <Truck />, features: ['Empresas', 'Flota', 'Choferes'],
        color: '#f59e0b', previewType: 'actores', cuRef: 'CU-A07'
    },
    {
        id: 'operadores', title: 'Gestionar Operadores', subtitle: 'Tratamiento CU-A08',
        description: 'Plantas de tratamiento y disposición final. Métodos autorizados.',
        icon: <Building2 />, features: ['Plantas', 'Métodos', 'Capacidad'],
        color: '#14b8a6', previewType: 'actores', cuRef: 'CU-A08'
    },
    {
        id: 'monitoreo', title: 'Monitoreo GPS', subtitle: 'Tiempo Real CU-A09',
        description: 'Mapa interactivo con ubicación de transportes. Actualización cada 30s.',
        icon: <MapPin />, features: ['Mapa en vivo', 'ETA', 'Alertas desvío'],
        color: '#ef4444', previewType: 'tracking', cuRef: 'CU-A09'
    },
    {
        id: 'alertas', title: 'Sistema de Alertas', subtitle: 'Notificaciones CU-A13',
        description: 'Reglas para alertas: vencimientos, desvíos, tiempos excesivos.',
        icon: <Bell />, features: ['Reglas', 'Email/Push', 'Historial'],
        color: '#f59e0b', previewType: 'alertas', cuRef: 'CU-A13'
    },
    {
        id: 'auditoria', title: 'Log de Auditoría', subtitle: 'Trazabilidad CU-A10',
        description: 'Registro inmutable de operaciones: fecha, usuario, datos.',
        icon: <Eye />, features: ['Registro', 'Detalle', 'Exportación'],
        color: '#64748b', previewType: 'manifiestos', cuRef: 'CU-A10'
    },
    {
        id: 'reportes', title: 'Reportes', subtitle: 'Estadísticas CU-A11',
        description: 'Informes por período, tipo de residuo, actor. PDF/CSV/XML.',
        icon: <Download />, features: ['Reportes', 'Gráficos', 'Formatos'],
        color: '#3b82f6', previewType: 'dashboard', cuRef: 'CU-A11'
    },
    {
        id: 'exportar', title: 'Exportar Datos', subtitle: 'Formatos CU-A12',
        description: 'Descarga información en PDF, CSV o XML para uso externo o integración con otros sistemas.',
        icon: <Download />, features: ['PDF', 'CSV', 'XML'],
        color: '#0ea5e9', previewType: 'manifiestos', cuRef: 'CU-A12'
    },
    {
        id: 'parametros', title: 'Parámetros del Sistema', subtitle: 'Configuración CU-A14',
        description: 'Valores globales: tiempos de vencimiento, formatos, umbrales de alerta y parámetros operativos.',
        icon: <Settings />, features: ['Tiempos', 'Umbrales', 'Formatos'],
        color: '#6366f1', previewType: 'form', cuRef: 'CU-A14'
    },
    {
        id: 'carga', title: 'Carga Masiva', subtitle: 'Importación CU-A15',
        description: 'Importa padrón histórico desde Excel/CSV. Validación automática.',
        icon: <Upload />, features: ['Importación', 'Validación', 'Errores'],
        color: '#8b5cf6', previewType: 'form', cuRef: 'CU-A15'
    },
    {
        id: 'arq-web', title: 'Arquitectura Web', subtitle: 'Stack Tecnológico',
        description: 'React + TypeScript, Node.js + Express, PostgreSQL, API RESTful.',
        icon: <Globe />, features: ['React', 'Node.js', 'PostgreSQL'],
        color: '#0ea5e9', previewType: 'arquitectura'
    },
    {
        id: 'arq-mobile', title: 'Arquitectura Móvil', subtitle: 'Offline-First',
        description: 'App nativa offline. IndexedDB local, sincronización automática.',
        icon: <Smartphone />, features: ['Offline', 'Sync', 'GPS'],
        color: '#22c55e', previewType: 'offline'
    },
    {
        id: 'pwa-install', title: 'App PWA Instalable', subtitle: 'Sin App Store',
        description: 'Instala la app directamente desde el navegador. Funciona como app nativa en Android e iOS.',
        icon: <Download />, features: ['Sin tienda', 'Acceso directo', 'Actualizaciones automáticas'],
        color: '#8b5cf6', previewType: 'mobile'
    },
    {
        id: 'mobile-roles', title: '4 Roles Móviles', subtitle: 'Interfaz Adaptada',
        description: 'Cada rol tiene su dashboard optimizado: Admin, Generador, Transportista, Operador.',
        icon: <Users />, features: ['Menú personalizado', 'Acciones rápidas', 'Stats por rol'],
        color: '#f59e0b', previewType: 'mobile'
    },
    {
        id: 'mobile-dashboard', title: 'Dashboard Móvil', subtitle: 'Vista Compacta',
        description: 'Estadísticas principales en tarjetas. Manifiestos recientes y acciones frecuentes.',
        icon: <BarChart3 />, features: ['Stats visuales', 'Acceso rápido', 'Alertas pendientes'],
        color: '#3b82f6', previewType: 'dashboard'
    },
    {
        id: 'mobile-qr', title: 'Escaneo QR Móvil', subtitle: 'Cámara Nativa',
        description: 'Escanea QR de manifiestos con la cámara. Carga instantánea de datos.',
        icon: <QrCode />, features: ['Scan rápido', 'Auto-detección', 'Modo manual'],
        color: '#10b981', previewType: 'qr'
    },
    {
        id: 'mobile-gps', title: 'GPS en Tiempo Real', subtitle: 'Tracking Activo',
        description: 'Ubicación GPS automática al iniciar viaje. Registro de ruta completa.',
        icon: <MapPin />, features: ['Tracking continuo', 'Historial de ruta', 'ETA calculado'],
        color: '#ef4444', previewType: 'tracking'
    },
    {
        id: 'mobile-trip', title: 'Viaje Activo', subtitle: 'Panel de Control',
        description: 'Pantalla dedicada durante el transporte: estado, mapa, tiempo transcurrido.',
        icon: <Truck />, features: ['Estado en vivo', 'Paradas', 'Finalizar viaje'],
        color: '#f59e0b', previewType: 'tracking'
    },
    {
        id: 'mobile-alerts', title: 'Notificaciones Push', subtitle: 'Alertas Instantáneas',
        description: 'Recibe alertas push: nuevos manifiestos, cambios de estado, urgencias.',
        icon: <Bell />, features: ['Push nativas', 'Badge contador', 'Historial'],
        color: '#ec4899', previewType: 'alertas'
    },
    {
        id: 'mobile-offline', title: 'Modo Offline Completo', subtitle: 'Sin Conexión',
        description: 'Todas las operaciones funcionan offline. Sincroniza al recuperar conexión.',
        icon: <WifiOff />, features: ['Base local', 'Cola de sync', 'Sin pérdida de datos'],
        color: '#64748b', previewType: 'offline'
    },
    {
        id: 'complete', title: '¡Tour Completado!', subtitle: 'Listo para Administrar',
        description: 'Conoces todas las funciones. Botón "?" disponible para ayuda.',
        icon: <CheckCircle2 />, features: ['Ayuda', 'Documentación', 'Soporte'],
        color: '#10b981', previewType: 'welcome'
    },
];

// GENERADOR slides
const slidesGenerador: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido, Generador!', subtitle: 'Portal de Gestión',
        description: 'Declara residuos peligrosos mediante manifiestos electrónicos con firma digital.',
        icon: <Factory />, features: ['Manifiestos', 'Firma', 'Tracking'],
        color: '#10b981', previewType: 'welcome'
    },
    {
        id: 'dashboard', title: 'Tu Dashboard', subtitle: 'Resumen CU-G02',
        description: 'Contadores de manifiestos: borradores, pendientes, en tránsito, completados.',
        icon: <BarChart3 />, features: ['Estado', 'Alertas', 'Accesos'],
        color: '#3b82f6', previewType: 'dashboard', cuRef: 'CU-G02'
    },
    {
        id: 'crear', title: 'Crear Manifiesto', subtitle: 'Declaración CU-G03',
        description: 'Selecciona residuo, cantidad, transportista y operador destino.',
        icon: <Plus />, features: ['Catálogo', 'Datos', 'Validación'],
        color: '#8b5cf6', previewType: 'form', cuRef: 'CU-G03'
    },
    {
        id: 'residuo', title: 'Seleccionar Residuo', subtitle: 'Catálogo CU-G04',
        description: 'Busca en catálogo oficial: categorías Y, características de peligrosidad.',
        icon: <Search />, features: ['Búsqueda', 'Categorías', 'Descripción'],
        color: '#f59e0b', previewType: 'form', cuRef: 'CU-G04'
    },
    {
        id: 'actores', title: 'Asignar Actores', subtitle: 'Transportista/Operador CU-G05',
        description: 'Selecciona transportista y operador habilitados para el tipo de residuo.',
        icon: <Users />, features: ['Filtro', 'Contacto', 'Habilitación'],
        color: '#ec4899', previewType: 'actores', cuRef: 'CU-G05'
    },
    {
        id: 'firma', title: 'Firma Digital', subtitle: 'Validez Legal CU-G07',
        description: 'Firma electrónica con usuario + token. Genera QR único.',
        icon: <ClipboardCheck />, features: ['Firma', 'QR', 'Notificación'],
        color: '#10b981', previewType: 'qr', cuRef: 'CU-G07'
    },
    {
        id: 'tracking', title: 'Seguimiento GPS', subtitle: 'Tiempo Real CU-G08',
        description: 'Mapa con ubicación exacta del transporte. ETA y ruta.',
        icon: <MapPin />, features: ['Mapa', 'ETA', 'Historial'],
        color: '#ef4444', previewType: 'tracking', cuRef: 'CU-G08'
    },
    {
        id: 'historial', title: 'Historial y PDF', subtitle: 'Consultas CU-G09',
        description: 'Listado de manifiestos emitidos. Filtros y descarga PDF con QR.',
        icon: <FileText />, features: ['Filtros', 'PDF', 'QR'],
        color: '#3b82f6', previewType: 'manifiestos', cuRef: 'CU-G09'
    },
    {
        id: 'notif', title: 'Notificaciones', subtitle: 'Alertas CU-G11',
        description: 'Recibe alertas sobre cambios de estado: retiro, llegada, cierre.',
        icon: <Bell />, features: ['Email', 'Push', 'Acceso'],
        color: '#f59e0b', previewType: 'alertas', cuRef: 'CU-G11'
    },
    {
        id: 'mobile-pwa', title: 'App Móvil PWA', subtitle: 'Acceso Rápido',
        description: 'Instala la app desde el navegador. Crea manifiestos desde tu teléfono.',
        icon: <Smartphone />, features: ['Instalable', 'Acceso directo', 'Sin tienda'],
        color: '#8b5cf6', previewType: 'mobile'
    },
    {
        id: 'mobile-crear', title: 'Crear desde Móvil', subtitle: 'Formulario Optimizado',
        description: 'Interfaz táctil para crear manifiestos rápidamente desde cualquier lugar.',
        icon: <Plus />, features: ['UI optimizada', 'Selección rápida', 'Firma touch'],
        color: '#10b981', previewType: 'form'
    },
    {
        id: 'mobile-qr', title: 'Escanear QR', subtitle: 'Verificación Rápida',
        description: 'Usa la cámara para escanear y verificar manifiestos existentes.',
        icon: <QrCode />, features: ['Scan rápido', 'Verificación', 'Historial'],
        color: '#0ea5e9', previewType: 'qr'
    },
    {
        id: 'perfil', title: 'Mi Perfil', subtitle: 'Configuración CU-G12',
        description: 'Modifica datos de contacto, configuración de notificaciones y preferencias.',
        icon: <Settings />, features: ['Contacto', 'Notificaciones', 'Preferencias'],
        color: '#6366f1', previewType: 'form', cuRef: 'CU-G12'
    },
    {
        id: 'complete', title: '¡Listo para Operar!', subtitle: 'Primer Manifiesto',
        description: 'Al firmar, el transportista será notificado. Recibirás actualizaciones.',
        icon: <CheckCircle2 />, features: ['Simple', 'Seguimiento', 'Ayuda'],
        color: '#10b981', previewType: 'welcome'
    },
];

// TRANSPORTISTA slides
const slidesTransportista: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido, Transportista!', subtitle: 'App de Gestión',
        description: 'App 100% OFFLINE. Sincroniza automáticamente al recuperar conexión.',
        icon: <Truck />, features: ['Offline', 'GPS', 'Sync'],
        color: '#10b981', previewType: 'welcome'
    },
    {
        id: 'dashboard', title: 'Manifiestos Asignados', subtitle: 'Lista CU-T02',
        description: 'Manifiestos pendientes: número, generador, residuo, dirección.',
        icon: <FileText />, features: ['Lista', 'Direcciones', 'Prioridad'],
        color: '#3b82f6', previewType: 'manifiestos', cuRef: 'CU-T02'
    },
    {
        id: 'offline', title: 'Modo Offline', subtitle: 'Sin Conexión CU-T09',
        description: 'Todas las operaciones funcionan sin internet. Datos cifrados.',
        icon: <WifiOff />, features: ['Base local', 'Validación', 'Sync'],
        color: '#64748b', previewType: 'offline', cuRef: 'CU-T09'
    },
    {
        id: 'retiro', title: 'Confirmar Retiro', subtitle: 'Origen CU-T03',
        description: 'Verifica bultos. GPS automático. Firma del generador en pantalla.',
        icon: <ClipboardCheck />, features: ['GPS', 'Firma', 'Local'],
        color: '#8b5cf6', previewType: 'form', cuRef: 'CU-T03'
    },
    {
        id: 'qr', title: 'Escaneo QR', subtitle: 'Carga Rápida CU-T08',
        description: 'Escanea QR del manifiesto para carga instantánea.',
        icon: <QrCode />, features: ['Lectura', 'Verificación', 'Manual'],
        color: '#0ea5e9', previewType: 'qr', cuRef: 'CU-T08'
    },
    {
        id: 'iniciar', title: 'Iniciar Transporte', subtitle: 'Tracking CU-T04',
        description: 'Activa tracking GPS automático. Calcula ruta y ETA.',
        icon: <MapPin />, features: ['Tracking', 'Ruta', 'ETA'],
        color: '#22c55e', previewType: 'tracking', cuRef: 'CU-T04'
    },
    {
        id: 'transito', title: 'Durante el Viaje', subtitle: 'Eventos CU-T05',
        description: 'Registra paradas, demoras, cambios. Cada evento geolocalizado.',
        icon: <Clock />, features: ['Paradas', 'GPS', 'Timeline'],
        color: '#f59e0b', previewType: 'tracking', cuRef: 'CU-T05'
    },
    {
        id: 'incidente', title: 'Registrar Incidentes', subtitle: 'Anomalías CU-T06',
        description: 'Documenta accidentes, derrames con fotos y GPS. Alerta a DGFA.',
        icon: <AlertTriangle />, features: ['Fotos', 'GPS', 'Alerta'],
        color: '#ef4444', previewType: 'alertas', cuRef: 'CU-T06'
    },
    {
        id: 'entrega', title: 'Confirmar Entrega', subtitle: 'Destino CU-T07',
        description: 'Registra llegada. Verifica GPS. Firma de entrega.',
        icon: <CheckCircle2 />, features: ['GPS', 'Firma', 'Confirmación'],
        color: '#10b981', previewType: 'qr', cuRef: 'CU-T07'
    },
    {
        id: 'sync', title: 'Sincronización', subtitle: 'Datos Actualizados',
        description: 'Al recuperar conexión, sync automática en segundo plano.',
        icon: <Wifi />, features: ['Background', 'Sin pérdida', 'Conflictos'],
        color: '#0ea5e9', previewType: 'offline'
    },
    {
        id: 'mobile', title: 'App Móvil', subtitle: 'Interfaz Optimizada',
        description: 'Diseño para uso en campo. Botones grandes, información clara.',
        icon: <Smartphone />, features: ['UI optimizada', 'Una mano', 'Nocturno'],
        color: '#8b5cf6', previewType: 'mobile'
    },
    {
        id: 'complete', title: '¡Listo para la Ruta!', subtitle: 'App Lista',
        description: 'Funciona sin conexión. Datos se sincronizan al recuperar señal.',
        icon: <Zap />, features: ['Offline', 'GPS', 'Soporte'],
        color: '#10b981', previewType: 'welcome'
    },
];

// OPERADOR slides
const slidesOperador: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido, Operador!', subtitle: 'Portal de Recepción',
        description: 'Gestiona recepción, pesaje, tratamiento y disposición final.',
        icon: <Building2 />, features: ['Recepción', 'Pesaje', 'Certificados'],
        color: '#10b981', previewType: 'welcome'
    },
    {
        id: 'dashboard', title: 'Entregas Entrantes', subtitle: 'En Camino CU-O02',
        description: 'Transportes en camino: número, generador, residuo, ETA.',
        icon: <Truck />, features: ['Esperados', 'ETA', 'Preparación'],
        color: '#3b82f6', previewType: 'manifiestos', cuRef: 'CU-O02'
    },
    {
        id: 'recepcion', title: 'Recepción QR', subtitle: 'Ingreso CU-O03',
        description: 'Escanea QR en garita. Funciona OFFLINE contra lista de esperados.',
        icon: <QrCode />, features: ['Escaneo', 'Offline', 'Ingreso'],
        color: '#8b5cf6', previewType: 'qr', cuRef: 'CU-O03'
    },
    {
        id: 'pesaje', title: 'Registro de Pesaje', subtitle: 'Comparación CU-O04',
        description: 'Ingresa peso de báscula. Compara con declarado.',
        icon: <Scale />, features: ['Declarado', 'Real', 'Diferencia'],
        color: '#f59e0b', previewType: 'form', cuRef: 'CU-O04'
    },
    {
        id: 'diferencias', title: 'Registrar Diferencias', subtitle: 'Discrepancias CU-O05',
        description: 'Documenta faltante/excedente con descripción y fotos.',
        icon: <AlertTriangle />, features: ['Tipo', 'Fotos', 'Notificación'],
        color: '#ef4444', previewType: 'alertas', cuRef: 'CU-O05'
    },
    {
        id: 'rechazo', title: 'Rechazar Carga', subtitle: 'Documentar CU-O06',
        description: 'Si rechazas: motivo, descripción, foto. Notifica a todos.',
        icon: <X />, features: ['Motivos', 'Evidencia', 'Alerta DGFA'],
        color: '#dc2626', previewType: 'alertas', cuRef: 'CU-O06'
    },
    {
        id: 'firma', title: 'Firma de Recepción', subtitle: 'Conformidad CU-O07',
        description: 'Revisa resumen, acepta, firma electrónica. Notifica generador.',
        icon: <ClipboardCheck />, features: ['Resumen', 'Firma', 'Notificación'],
        color: '#10b981', previewType: 'qr', cuRef: 'CU-O07'
    },
    {
        id: 'tratamiento', title: 'Registrar Tratamiento', subtitle: 'Método CU-O08',
        description: 'Selecciona método de tratamiento autorizado. Registra fecha.',
        icon: <Settings />, features: ['Métodos', 'Validación', 'Registro'],
        color: '#8b5cf6', previewType: 'form', cuRef: 'CU-O08'
    },
    {
        id: 'cierre', title: 'Cerrar Manifiesto', subtitle: 'Disposición CU-O09',
        description: 'Finaliza ciclo con firma de cierre. Genera certificado.',
        icon: <CheckCircle2 />, features: ['Verificación', 'Cierre', 'Certificado'],
        color: '#10b981', previewType: 'qr', cuRef: 'CU-O09'
    },
    {
        id: 'certificado', title: 'Certificado de Disposición', subtitle: 'PDF CU-O10',
        description: 'Documento con datos del residuo, tratamiento, firmas. Envío automático.',
        icon: <Download />, features: ['PDF', 'Envío', 'Archivo'],
        color: '#3b82f6', previewType: 'manifiestos', cuRef: 'CU-O10'
    },
    {
        id: 'mobile-pwa', title: 'App Móvil PWA', subtitle: 'Recepción Móvil',
        description: 'Instala la app para recepción rápida en garita. Funciona offline.',
        icon: <Smartphone />, features: ['Instalable', 'Offline', 'Garita'],
        color: '#8b5cf6', previewType: 'mobile'
    },
    {
        id: 'mobile-qr', title: 'Escaneo QR Garita', subtitle: 'Ingreso Rápido',
        description: 'Escanea QR del camión al llegar. Valida contra lista de esperados.',
        icon: <QrCode />, features: ['Scan rápido', 'Validación', 'Registro'],
        color: '#10b981', previewType: 'qr'
    },
    {
        id: 'mobile-pesaje', title: 'Pesaje Móvil', subtitle: 'Registro en Campo',
        description: 'Ingresa peso directamente desde el dispositivo. Compara con declarado.',
        icon: <Scale />, features: ['Input numérico', 'Comparación', 'Alertas'],
        color: '#f59e0b', previewType: 'form'
    },
    {
        id: 'historial', title: 'Historial de Recepciones', subtitle: 'Consulta CU-O11',
        description: 'Registro histórico de todos los manifiestos procesados por la planta.',
        icon: <FileText />, features: ['Filtros', 'Búsqueda', 'Exportar'],
        color: '#64748b', previewType: 'manifiestos', cuRef: 'CU-O11'
    },
    {
        id: 'reportes', title: 'Reportes del Operador', subtitle: 'Estadísticas CU-O12',
        description: 'Informes de residuos recibidos y tratados por período, tipo, generador.',
        icon: <BarChart3 />, features: ['Por período', 'Por tipo', 'Exportar'],
        color: '#3b82f6', previewType: 'dashboard', cuRef: 'CU-O12'
    },
    {
        id: 'complete', title: '¡Listo para Operar!', subtitle: 'Sistema Configurado',
        description: 'Cada cierre genera certificado. Trazabilidad completa.',
        icon: <Zap />, features: ['Proceso', 'Certificados', 'Ayuda'],
        color: '#10b981', previewType: 'welcome'
    },
];

// Main component
interface OnboardingTourProps {
    userRole: 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
    onComplete: () => void;
    isOpen: boolean;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ userRole, onComplete, isOpen }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [direction, setDirection] = useState<'next' | 'prev'>('next');

    const getSlides = () => {
        switch (userRole) {
            case 'ADMIN': return slidesAdmin;
            case 'GENERADOR': return slidesGenerador;
            case 'TRANSPORTISTA': return slidesTransportista;
            case 'OPERADOR': return slidesOperador;
            default: return slidesAdmin;
        }
    };

    const slides = getSlides();
    const slide = slides[currentSlide];
    const progress = ((currentSlide + 1) / slides.length) * 100;

    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(0);
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            setIsVisible(false);
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            setDirection('next');
            setCurrentSlide(currentSlide + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            setDirection('prev');
            setCurrentSlide(currentSlide - 1);
        }
    };

    const handleComplete = () => {
        setIsVisible(false);
        localStorage.setItem('tourCompleted', 'true');
        localStorage.setItem('tourVersion', '2.0');
        setTimeout(onComplete, 300);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isVisible) return;
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') handleComplete();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, currentSlide]);

    if (!isOpen) return null;

    return (
        <div className={`tour-overlay ${isVisible ? 'visible' : ''}`}>
            <div className="tour-backdrop" onClick={handleComplete} />

            <div className={`tour-modal floating ${isVisible ? 'visible' : ''}`}>
                <div className="tour-progress" style={{ background: `${slide.color}22` }}>
                    <div className="tour-progress-fill" style={{ width: `${progress}%`, background: slide.color }} />
                </div>

                <button className="tour-close" onClick={handleComplete}><X size={20} /></button>
                <div className="tour-step-indicator">{currentSlide + 1} / {slides.length}</div>

                <div className={`tour-content ${direction}`} key={currentSlide}>
                    <SystemPreview type={slide.previewType} />

                    <div className="tour-text">
                        {slide.cuRef && <span className="tour-cu-ref">{slide.cuRef}</span>}
                        <div className="tour-icon" style={{ background: slide.color }}>
                            {slide.icon}
                        </div>
                        <h1 className="tour-title">{slide.title}</h1>
                        <h2 className="tour-subtitle" style={{ color: slide.color }}>{slide.subtitle}</h2>
                        <p className="tour-description">{slide.description}</p>

                        <div className="tour-features">
                            {slide.features.map((feature, idx) => (
                                <div key={idx} className="tour-feature" style={{ background: `${slide.color}12`, borderColor: `${slide.color}40` }}>
                                    <CheckCircle2 size={14} style={{ color: slide.color }} />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="tour-footer">
                    <div className="tour-dots">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                className={`tour-dot ${idx === currentSlide ? 'active' : ''} ${idx < currentSlide ? 'completed' : ''}`}
                                onClick={() => { setDirection(idx > currentSlide ? 'next' : 'prev'); setCurrentSlide(idx); }}
                                style={idx === currentSlide ? { background: slide.color } : {}}
                            />
                        ))}
                    </div>

                    <div className="tour-nav">
                        <button className="tour-btn tour-btn-secondary" onClick={handlePrev} disabled={currentSlide === 0}>
                            <ChevronLeft size={18} /> Anterior
                        </button>
                        <button className="tour-btn tour-btn-skip" onClick={handleComplete}>Saltar</button>
                        <button
                            className="tour-btn tour-btn-primary"
                            onClick={handleNext}
                            style={{ background: slide.color }}
                        >
                            {currentSlide === slides.length - 1 ? (
                                <>¡Comenzar! <Sparkles size={18} /></>
                            ) : (
                                <>Siguiente <ChevronRight size={18} /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingTour;
