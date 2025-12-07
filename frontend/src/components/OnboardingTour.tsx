import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2, Target, Lightbulb,
    FileText, Truck, MapPin, Users, Bell, BarChart3, Settings, Shield,
    QrCode, Scale, ClipboardCheck, AlertTriangle, Download, Upload
} from 'lucide-react';
import './OnboardingTour.css';

interface TourStep {
    id: string;
    title: string;
    content: string;
    target?: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    icon?: React.ReactNode;
    highlight?: string;
    action?: string;
    category?: string;
}

// ==========================================
// TOUR ADMINISTRADOR - FLUJO COMPLETO
// ==========================================
const tourStepsAdmin: TourStep[] = [
    // BIENVENIDA
    {
        id: 'welcome',
        title: '👋 Bienvenido al Sistema de Trazabilidad RRPP',
        content: 'Sistema integral para la gestión del ciclo completo de residuos peligrosos. Este tour te guiará por todas las funciones según tu rol de Administrador DGFA.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
        category: 'Inicio',
    },
    // CU-A02: Dashboard Ejecutivo
    {
        id: 'dashboard',
        title: '📊 Dashboard Ejecutivo (CU-A02)',
        content: 'Panel de control con KPIs en tiempo real: manifiestos activos, en tránsito, completados. Actualización automática cada 5 minutos.',
        target: '.stats-grid',
        position: 'bottom',
        icon: <BarChart3 />,
        highlight: 'Indicadores clave de gestión',
        category: 'Supervisión',
    },
    // NAVEGACIÓN
    {
        id: 'sidebar',
        title: '📋 Menú de Navegación',
        content: 'Acceso a todos los módulos del sistema. El menú se adapta según tu rol y permisos asignados.',
        target: '.sidebar',
        position: 'right',
        icon: <Target />,
        highlight: 'Menú lateral',
        action: 'Explora las opciones disponibles',
    },
    // CU-A09: Monitoreo Tiempo Real
    {
        id: 'tracking',
        title: '🗺️ Monitoreo en Tiempo Real (CU-A09)',
        content: 'Visualiza en mapa interactivo la ubicación GPS de todos los transportes activos. Actualización cada 30 segundos con detección automática de desvíos.',
        target: '[href*="tracking"]',
        position: 'right',
        icon: <MapPin />,
        action: 'Click para ver mapa GPS',
        category: 'Monitoreo',
    },
    // MANIFIESTOS
    {
        id: 'manifiestos',
        title: '📄 Gestión de Manifiestos',
        content: 'Consulta, filtra y supervisa todos los manifiestos del sistema. Accede al ciclo de vida completo de cada documento.',
        target: '[href*="manifiestos"]',
        position: 'right',
        icon: <FileText />,
        action: 'Ver listado de manifiestos',
    },
    // CU-A03/A04: Gestión Usuarios
    {
        id: 'actores',
        title: '👥 Gestión de Actores (CU-A03/A04)',
        content: 'Administra Generadores, Transportistas y Operadores habilitados. Crea usuarios, asigna roles y permisos específicos.',
        target: '[href*="actores"]',
        position: 'right',
        icon: <Users />,
        action: 'Gestionar usuarios del sistema',
        category: 'Administración',
    },
    // CU-A13: Configurar Alertas
    {
        id: 'alertas',
        title: '🔔 Configurar Alertas (CU-A13)',
        content: 'Define reglas para alertas automáticas: vencimientos, desvíos de ruta, tiempos excesivos. Configura destinatarios y canales (email, push).',
        target: '[href*="alertas"]',
        position: 'right',
        icon: <Bell />,
        action: 'Configurar reglas de alerta',
        category: 'Configuración',
    },
    // CU-A15: Carga Masiva
    {
        id: 'carga-masiva',
        title: '📤 Carga Masiva Inicial (CU-A15)',
        content: 'Importa el padrón histórico de actores desde Excel/CSV. El sistema valida, detecta duplicados y reporta errores.',
        target: '[href*="carga-masiva"]',
        position: 'right',
        icon: <Upload />,
        action: 'Importar datos masivos',
    },
    // REPORTES
    {
        id: 'reportes',
        title: '📈 Reportes Estadísticos (CU-A11)',
        content: 'Genera informes personalizables por período, tipo de residuo, actor o zona. Exporta en PDF, CSV o XML.',
        target: '[href*="reportes"]',
        position: 'right',
        icon: <BarChart3 />,
        action: 'Generar reportes',
        category: 'Reportes',
    },
    // CU-A10: Auditoría
    {
        id: 'configuracion',
        title: '⚙️ Auditoría y Configuración (CU-A10)',
        content: 'Consulta el log de auditoría con todas las operaciones: fecha, usuario, IP, datos antes/después. Registro inmutable para cumplimiento legal.',
        target: '[href*="configuracion"]',
        position: 'right',
        icon: <Settings />,
        action: 'Ver logs de auditoría',
        category: 'Sistema',
    },
    // SEGURIDAD
    {
        id: 'seguridad',
        title: '🔒 Seguridad del Sistema',
        content: 'Autenticación JWT con refresh tokens, RBAC por rol, CORS configurado, API protegida. Cumplimiento normativo Ley 24.051.',
        position: 'center',
        icon: <Shield />,
        category: 'Seguridad',
    },
    // FINAL
    {
        id: 'complete',
        title: '✅ ¡Tour Completado!',
        content: 'Ya conoces todas las funciones de administración. Recuerda: puedes volver a ver esta guía desde el botón "Ayuda" en cualquier momento.',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

// ==========================================
// TOUR GENERADOR - FLUJO COMPLETO
// ==========================================
const tourStepsGenerador: TourStep[] = [
    // BIENVENIDA
    {
        id: 'welcome',
        title: '🏭 Bienvenido, Generador de Residuos',
        content: 'Este sistema te permite declarar y gestionar tus residuos peligrosos mediante manifiestos electrónicos con firma digital.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
        category: 'Inicio',
    },
    // CU-G02: Dashboard
    {
        id: 'dashboard-gen',
        title: '📊 Tu Panel de Control (CU-G02)',
        content: 'Resumen de tus manifiestos: borradores pendientes, en proceso de firma, en tránsito y completados. Accesos rápidos a funciones principales.',
        target: '.stats-grid',
        position: 'bottom',
        icon: <BarChart3 />,
        highlight: 'Contadores de manifiestos',
        category: 'Dashboard',
    },
    // CU-G03: Crear Manifiesto
    {
        id: 'nuevo-manifiesto',
        title: '➕ Crear Nuevo Manifiesto (CU-G03)',
        content: 'Inicia aquí la declaración de un nuevo envío. Tus datos como generador se precargan automáticamente.',
        target: '.btn-nuevo-manifiesto',
        position: 'bottom',
        icon: <FileText />,
        action: 'Click para crear manifiesto',
        category: 'Creación',
    },
    // CU-G04: Tipo de Residuo
    {
        id: 'tipo-residuo',
        title: '🧪 Seleccionar Tipo de Residuo (CU-G04)',
        content: 'Busca en el catálogo oficial (Ley 24.051). Categorías Y1-Y45 con códigos, nombres y características de peligrosidad.',
        position: 'center',
        icon: <AlertTriangle />,
        highlight: 'Catálogo de residuos peligrosos',
        category: 'Creación',
    },
    // CU-G05: Asignar Transportista
    {
        id: 'asignar-transportista',
        title: '🚛 Asignar Transportista (CU-G05)',
        content: 'Selecciona de la lista de transportistas habilitados. El sistema filtra los compatibles con tu tipo de residuo.',
        position: 'center',
        icon: <Truck />,
        highlight: 'Lista de transportistas autorizados',
        category: 'Asignación',
    },
    // CU-G06: Asignar Operador
    {
        id: 'asignar-operador',
        title: '♻️ Asignar Operador Destino (CU-G06)',
        content: 'Elige la planta de tratamiento. Visualiza métodos de tratamiento autorizados y capacidad disponible.',
        position: 'center',
        icon: <Target />,
        highlight: 'Plantas de tratamiento habilitadas',
        category: 'Asignación',
    },
    // CU-G07: Firma
    {
        id: 'firmar-manifiesto',
        title: '✍️ Firmar Manifiesto (CU-G07)',
        content: 'Aplica tu firma electrónica. El sistema genera automáticamente el código QR único. El transportista es notificado al instante.',
        position: 'center',
        icon: <ClipboardCheck />,
        highlight: 'Firma digital con validez legal',
        category: 'Firma',
    },
    // CU-G08: Consultar Estado
    {
        id: 'estado-manifiesto',
        title: '📍 Seguimiento en Tiempo Real (CU-G08)',
        content: 'Consulta el estado actual de tus manifiestos. Si está en tránsito, visualiza la ubicación GPS del transporte en el mapa.',
        target: '[href*="tracking"]',
        position: 'right',
        icon: <MapPin />,
        action: 'Ver ubicación del transporte',
        category: 'Seguimiento',
    },
    // CU-G09: Historial
    {
        id: 'historial-gen',
        title: '📋 Historial de Manifiestos (CU-G09)',
        content: 'Accede al listado completo de tus manifiestos. Filtra por período, estado o tipo de residuo. Timeline completo de cada documento.',
        target: '[href*="manifiestos"]',
        position: 'right',
        icon: <FileText />,
        action: 'Ver historial completo',
        category: 'Consulta',
    },
    // CU-G10: Descargar PDF
    {
        id: 'descargar-pdf',
        title: '📥 Descargar PDF con QR (CU-G10)',
        content: 'Genera copia PDF del manifiesto firmado. Incluye todos los datos, firmas digitales, código QR y timeline de eventos.',
        position: 'center',
        icon: <Download />,
        highlight: 'Documento oficial descargable',
        category: 'Documentos',
    },
    // CU-G11: Notificaciones
    {
        id: 'notificaciones-gen',
        title: '🔔 Notificaciones Automáticas (CU-G11)',
        content: 'Recibe alertas de cambios de estado: retiro confirmado, llegada a destino, cierre de manifiesto. Por email y notificaciones push.',
        position: 'center',
        icon: <Bell />,
        category: 'Notificaciones',
    },
    // FINAL
    {
        id: 'complete-gen',
        title: '✅ ¡Listo para Operar!',
        content: 'Ya conoces el flujo completo. Al firmar un manifiesto, el transportista será notificado y podrá iniciar el retiro.',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

// ==========================================
// TOUR TRANSPORTISTA - FLUJO COMPLETO
// ==========================================
const tourStepsTransportista: TourStep[] = [
    // BIENVENIDA
    {
        id: 'welcome',
        title: '🚛 Bienvenido, Transportista',
        content: 'Gestiona los retiros y entregas de residuos peligrosos. La app funciona offline y sincroniza automáticamente.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
        category: 'Inicio',
    },
    // CU-T01: Sincronización
    {
        id: 'sync',
        title: '🔄 Sincronización Automática (CU-T01)',
        content: 'Al iniciar sesión, el sistema descarga automáticamente: manifiestos asignados, catálogo de residuos y datos de operadores.',
        position: 'center',
        icon: <Target />,
        highlight: 'Base de datos local cifrada',
        category: 'Sincronización',
    },
    // CU-T02: Ver Asignados
    {
        id: 'asignados',
        title: '📋 Manifiestos Asignados (CU-T02)',
        content: 'Listado de manifiestos pendientes de retiro. Cada registro muestra: N° manifiesto, generador, tipo de residuo, dirección y fecha límite.',
        target: '[href*="manifiestos"]',
        position: 'right',
        icon: <FileText />,
        action: 'Ver manifiestos pendientes',
        category: 'Gestión',
    },
    // CU-T03: Confirmar Retiro
    {
        id: 'confirmar-retiro',
        title: '✅ Confirmar Retiro en Origen (CU-T03)',
        content: 'Registra el retiro en la ubicación del generador. El sistema captura GPS, hora y permite firma en pantalla. Funciona 100% OFFLINE.',
        position: 'center',
        icon: <ClipboardCheck />,
        highlight: 'Captura GPS + Firma digital',
        category: 'Operación',
    },
    // CU-T04: Iniciar Transporte
    {
        id: 'iniciar-viaje',
        title: '🚀 Iniciar Transporte (CU-T04)',
        content: 'Activa el seguimiento GPS automático. El sistema calcula ruta y ETA, notifica a generador y operador destino.',
        position: 'center',
        icon: <Truck />,
        highlight: 'Tracking GPS activado',
        category: 'Transporte',
    },
    // CU-T05: Actualizar Estado
    {
        id: 'actualizar-estado',
        title: '📝 Actualizar Estado en Tránsito (CU-T05)',
        content: 'Registra eventos durante el viaje: paradas programadas, demoras, cambio de conductor. Cada evento con ubicación GPS.',
        position: 'center',
        icon: <MapPin />,
        category: 'Transporte',
    },
    // CU-T06: Incidentes
    {
        id: 'registrar-incidente',
        title: '🚨 Registrar Incidentes (CU-T06)',
        content: 'Documenta anomalías: accidentes, derrames, robos. Incluye descripción, fotos y GPS. La DGFA es alertada inmediatamente.',
        position: 'center',
        icon: <AlertTriangle />,
        highlight: 'Alerta inmediata a autoridades',
        category: 'Incidentes',
    },
    // CU-T07: Confirmar Entrega
    {
        id: 'confirmar-entrega',
        title: '📦 Confirmar Entrega en Destino (CU-T07)',
        content: 'Registra llegada a la planta del operador. El sistema verifica GPS vs dirección destino y solicita confirmación del operador.',
        position: 'center',
        icon: <CheckCircle2 />,
        highlight: 'Verificación de ubicación',
        category: 'Entrega',
    },
    // CU-T08: Escanear QR
    {
        id: 'escanear-qr',
        title: '📱 Escanear QR de Manifiesto (CU-T08)',
        content: 'Lee el código QR para carga rápida de información y verificación de autenticidad. Si el QR es ilegible, permite ingreso manual.',
        position: 'center',
        icon: <QrCode />,
        action: 'Escanear para verificar',
        category: 'Verificación',
    },
    // CU-T09: Modo Offline
    {
        id: 'modo-offline',
        title: '📡 Operación Sin Conexión (CU-T09)',
        content: 'La app detecta pérdida de conectividad y activa modo offline transparente. Al recuperar señal, sincroniza automáticamente.',
        position: 'center',
        icon: <Target />,
        highlight: 'Service Worker + IndexedDB',
        category: 'Offline',
    },
    // FINAL
    {
        id: 'complete-trans',
        title: '✅ ¡Listo para Operar!',
        content: 'Ya conoces todas las funciones. Recuerda: la app funciona sin conexión y los datos se sincronizan al recuperar señal.',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

// ==========================================
// TOUR OPERADOR - FLUJO COMPLETO
// ==========================================
const tourStepsOperador: TourStep[] = [
    // BIENVENIDA
    {
        id: 'welcome',
        title: '♻️ Bienvenido, Operador de Tratamiento',
        content: 'Gestiona la recepción, pesaje, tratamiento y disposición final de residuos peligrosos en tu planta.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
        category: 'Inicio',
    },
    // CU-O02: Ver Entrantes
    {
        id: 'entrantes',
        title: '🚚 Manifiestos Entrantes (CU-O02)',
        content: 'Visualiza transportes en camino a tu planta. Cada registro muestra: generador, transportista, tipo de residuo y ETA estimado.',
        target: '[href*="manifiestos"]',
        position: 'right',
        icon: <Truck />,
        action: 'Ver entregas pendientes',
        category: 'Recepción',
    },
    // CU-O03: Recepción QR
    {
        id: 'recepcion-qr',
        title: '📱 Recepción con QR (CU-O03)',
        content: 'Escanea el QR del manifiesto al llegar el transporte. El sistema valida integridad y estado. Funciona OFFLINE contra lista de "Esperados".',
        position: 'center',
        icon: <QrCode />,
        highlight: 'Validación offline disponible',
        category: 'Recepción',
    },
    // CU-O04: Pesaje
    {
        id: 'pesaje',
        title: '⚖️ Registrar Pesaje (CU-O04)',
        content: 'Ingresa el peso real medido en báscula. El sistema compara con lo declarado y calcula diferencia porcentual.',
        position: 'center',
        icon: <Scale />,
        highlight: 'Comparación automática de pesos',
        category: 'Verificación',
    },
    // CU-O05: Diferencias
    {
        id: 'diferencias',
        title: '📊 Registrar Diferencias (CU-O05)',
        content: 'Si hay discrepancia >5%, documenta el faltante/excedente con justificación y fotos. El sistema notifica a todas las partes.',
        position: 'center',
        icon: <AlertTriangle />,
        highlight: 'Documentación de discrepancias',
        category: 'Verificación',
    },
    // CU-O06: Rechazo
    {
        id: 'rechazo',
        title: '❌ Rechazar Carga (CU-O06)',
        content: 'Si corresponde, registra el rechazo total o parcial. Selecciona motivo, documenta con fotos. El transportista debe retornar la carga.',
        position: 'center',
        icon: <X />,
        highlight: 'Documentación de rechazos',
        category: 'Rechazo',
    },
    // CU-O07: Firmar Recepción
    {
        id: 'firmar-recepcion',
        title: '✍️ Firmar Recepción Conforme (CU-O07)',
        content: 'Aplica firma electrónica de conformidad. El sistema actualiza estado a "Recibido - Pendiente Tratamiento" y notifica al generador.',
        position: 'center',
        icon: <ClipboardCheck />,
        highlight: 'Firma digital de recepción',
        category: 'Firma',
    },
    // CU-O08: Tratamiento
    {
        id: 'tratamiento',
        title: '⚗️ Registrar Tratamiento (CU-O08)',
        content: 'Documenta el método aplicado: incineración, neutralización, encapsulamiento, etc. El sistema valida que esté autorizado para el residuo.',
        position: 'center',
        icon: <Settings />,
        highlight: 'Métodos de tratamiento autorizados',
        category: 'Tratamiento',
    },
    // CU-O09: Cerrar Manifiesto
    {
        id: 'cerrar-manifiesto',
        title: '🔒 Cerrar Manifiesto (CU-O09)',
        content: 'Finaliza el ciclo con firma electrónica de disposición final. El sistema genera certificado automático y notifica a todas las partes.',
        position: 'center',
        icon: <CheckCircle2 />,
        highlight: 'TRAZABILIDAD COMPLETA',
        category: 'Cierre',
    },
    // CU-O10: Certificado
    {
        id: 'certificado',
        title: '📜 Certificado de Disposición (CU-O10)',
        content: 'Se genera automáticamente al cerrar. Incluye todos los datos del residuo, tratamiento, fechas y firmas. Enviado al generador.',
        position: 'center',
        icon: <Download />,
        highlight: 'Documento legal generado',
        category: 'Documentos',
    },
    // CU-O11/O12: Historial y Reportes
    {
        id: 'historial-op',
        title: '📋 Historial y Reportes (CU-O11/O12)',
        content: 'Accede al registro histórico de todos los manifiestos procesados. Genera reportes por período, generador o tipo de residuo.',
        target: '[href*="reportes"]',
        position: 'right',
        icon: <BarChart3 />,
        action: 'Ver historial y reportes',
        category: 'Consulta',
    },
    // FINAL
    {
        id: 'complete-op',
        title: '✅ ¡Listo para Operar!',
        content: 'Ya conoces el flujo completo de recepción y tratamiento. Cada cierre de manifiesto genera certificado automático para el generador.',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

interface OnboardingTourProps {
    userRole: 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
    onComplete: () => void;
    isOpen: boolean;
}

interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ userRole, onComplete, isOpen }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [showTour, setShowTour] = useState(isOpen);
    const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
    const tooltipRef = useRef<HTMLDivElement>(null);

    const getTourSteps = useCallback(() => {
        switch (userRole) {
            case 'ADMIN': return tourStepsAdmin;
            case 'GENERADOR': return tourStepsGenerador;
            case 'TRANSPORTISTA': return tourStepsTransportista;
            case 'OPERADOR': return tourStepsOperador;
            default: return tourStepsAdmin;
        }
    }, [userRole]);

    const steps = getTourSteps();
    const step = steps[currentStep];

    const updateTargetPosition = useCallback(() => {
        if (!step?.target) {
            setTargetRect(null);
            return;
        }

        const element = document.querySelector(step.target);
        if (element) {
            const rect = element.getBoundingClientRect();
            const padding = 8;
            setTargetRect({
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
            });
        }
    }, [step]);

    const updateTooltipPosition = useCallback(() => {
        if (!targetRect || !tooltipRef.current) {
            setTooltipStyle({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            });
            return;
        }

        const tooltip = tooltipRef.current;
        const tooltipRect = tooltip.getBoundingClientRect();
        const gap = 16;
        let style: React.CSSProperties = {};

        switch (step?.position) {
            case 'right':
                style = {
                    top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
                    left: targetRect.left + targetRect.width + gap,
                };
                break;
            case 'left':
                style = {
                    top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
                    left: targetRect.left - tooltipRect.width - gap,
                };
                break;
            case 'bottom':
                style = {
                    top: targetRect.top + targetRect.height + gap,
                    left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
                };
                break;
            case 'top':
                style = {
                    top: targetRect.top - tooltipRect.height - gap,
                    left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
                };
                break;
            default:
                style = {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                };
        }

        if (typeof style.left === 'number' && style.left < 20) style.left = 20;
        if (typeof style.top === 'number' && style.top < 20) style.top = 20;

        setTooltipStyle(style);
    }, [targetRect, step]);

    useEffect(() => {
        setShowTour(isOpen);
        if (isOpen) setCurrentStep(0);
    }, [isOpen]);

    useEffect(() => {
        if (showTour) {
            updateTargetPosition();
            const timer = setTimeout(updateTooltipPosition, 50);
            return () => clearTimeout(timer);
        }
    }, [showTour, currentStep, updateTargetPosition, updateTooltipPosition]);

    useEffect(() => {
        window.addEventListener('resize', updateTargetPosition);
        window.addEventListener('scroll', updateTargetPosition);
        return () => {
            window.removeEventListener('resize', updateTargetPosition);
            window.removeEventListener('scroll', updateTargetPosition);
        };
    }, [updateTargetPosition]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        setShowTour(false);
        localStorage.setItem('tourCompleted', 'true');
        onComplete();
    };

    if (!showTour) return null;

    const isCenter = !step?.target || step.position === 'center';

    return createPortal(
        <div className="onboarding-overlay">
            {/* SVG Mask */}
            <svg className="onboarding-mask" width="100%" height="100%">
                <defs>
                    <mask id="spotlight-mask">
                        <rect width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                x={targetRect.left}
                                y={targetRect.top}
                                width={targetRect.width}
                                height={targetRect.height}
                                rx="12"
                                fill="black"
                                className="spotlight-cutout"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.75)"
                    mask="url(#spotlight-mask)"
                />
            </svg>

            {/* Spotlight ring */}
            {targetRect && (
                <div
                    className="spotlight-ring"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                    }}
                />
            )}

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className={`onboarding-tooltip ${isCenter ? 'tooltip-center' : ''} tooltip-${step?.position}`}
                style={tooltipStyle}
            >
                {!isCenter && <div className={`tooltip-arrow arrow-${step?.position}`} />}

                <div className="tooltip-header">
                    <div className="tooltip-icon-wrapper">
                        {step?.icon || <Lightbulb />}
                    </div>
                    <div className="tooltip-meta">
                        <div className="tooltip-step-indicator">
                            Paso {currentStep + 1} de {steps.length}
                        </div>
                        {step?.category && (
                            <div className="tooltip-category">{step.category}</div>
                        )}
                    </div>
                    <button className="tooltip-close" onClick={handleComplete}>
                        <X size={18} />
                    </button>
                </div>

                <div className="tooltip-content">
                    <h3 className="tooltip-title">{step?.title}</h3>
                    <p className="tooltip-description">{step?.content}</p>

                    {step?.highlight && (
                        <div className="tooltip-highlight">
                            <Target size={14} />
                            <span>{step.highlight}</span>
                        </div>
                    )}

                    {step?.action && (
                        <div className="tooltip-action-hint">
                            <ChevronRight size={14} />
                            <span>{step.action}</span>
                        </div>
                    )}
                </div>

                <div className="tooltip-progress">
                    {steps.map((_, idx) => (
                        <button
                            key={idx}
                            className={`progress-dot ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
                            onClick={() => setCurrentStep(idx)}
                        />
                    ))}
                </div>

                <div className="tooltip-footer">
                    <button className="tooltip-skip" onClick={handleComplete}>
                        Omitir tour
                    </button>
                    <div className="tooltip-nav">
                        {currentStep > 0 && (
                            <button className="tooltip-btn tooltip-btn-secondary" onClick={handlePrev}>
                                <ChevronLeft size={18} />
                                Anterior
                            </button>
                        )}
                        <button className="tooltip-btn tooltip-btn-primary" onClick={handleNext}>
                            {currentStep === steps.length - 1 ? (
                                <>
                                    Comenzar
                                    <CheckCircle2 size={18} />
                                </>
                            ) : (
                                <>
                                    Siguiente
                                    <ChevronRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OnboardingTour;
