/**
 * SITREP v6 - Ayuda Page
 * =======================
 * Centro de ayuda y documentación
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  FileText,
  Video,
  MessageCircle,
  Phone,
  Mail,
  ChevronRight,
  ArrowLeft,
  Play,
  ExternalLink,
  HelpCircle,
  GitBranch
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Input } from '../../components/ui/Input';
import WorkflowDiagram from '../../components/docs/WorkflowDiagram';

// FAQ data
const faqs = [
  {
    category: 'Manifiestos',
    questions: [
      {
        q: '¿Cómo creo un nuevo manifiesto?',
        a: 'Ve a Manifiestos → Nuevo Manifiesto. El formulario multi-paso te guiará: selecciona el tipo de residuo, ingresa la cantidad, elige el transportista y el operador destino, y revisa el resumen antes de guardar como Borrador.'
      },
      {
        q: '¿Qué estados puede tener un manifiesto?',
        a: 'El ciclo completo es: Borrador → Aprobado → En tránsito → Entregado → Recibido → En tratamiento → Tratado. También puede ser Rechazado o Cancelado en determinadas condiciones.'
      },
      {
        q: '¿Cómo descargo el certificado de disposición final?',
        a: 'El certificado solo está disponible cuando el manifiesto alcanza el estado TRATADO. Abre el detalle del manifiesto y haz clic en "Descargar Certificado" (botón verde).'
      },
      {
        q: '¿Cómo edito un manifiesto?',
        a: 'Solo los manifiestos en estado BORRADOR pueden editarse. Abre el detalle y usa el botón de edición. Una vez aprobado, el manifiesto no puede modificarse.'
      },
      {
        q: '¿Cómo cancelo un manifiesto?',
        a: 'Un manifiesto puede cancelarse desde cualquier estado, excepto CANCELADO o TRATADO. Abre el detalle y usa la opción "Cancelar Manifiesto". Se solicitará confirmación.'
      },
      {
        q: '¿Cómo verifico un manifiesto con QR?',
        a: 'Usa el escáner QR desde la app móvil o ingresa el número de manifiesto en /manifiestos/verificar. La verificación es pública y no requiere autenticación.'
      }
    ]
  },
  {
    category: 'Transporte y GPS',
    questions: [
      {
        q: '¿Cómo inicio el tracking GPS de un viaje?',
        a: 'El transportista debe ir a Transporte → Perfil → tab Viaje. Si hay manifiestos APROBADOS asignados, aparece el botón "Tomar Viaje". Al confirmar el retiro, el GPS comienza a registrar la posición cada 30 segundos.'
      },
      {
        q: '¿Qué hago si el GPS falla durante el viaje?',
        a: 'La app almacena los puntos GPS pendientes localmente y los envía automáticamente al recuperar la conexión. El viaje no se interrumpe. Si la señal es persistentemente baja, ve a Configuración del teléfono y activa el modo de ubicación de alta precisión.'
      },
      {
        q: '¿Cómo registro un incidente durante el transporte?',
        a: 'En la pantalla de Viaje en Curso, usa el botón "Registrar Incidente". Ingresa el tipo de incidente (avería, accidente, etc.) y una descripción. El incidente queda registrado en el timeline del manifiesto sin cambiar su estado.'
      }
    ]
  },
  {
    category: 'Cuenta y Acceso',
    questions: [
      {
        q: '¿Cómo cambio mi contraseña?',
        a: 'Ve a Configuración → pestaña Seguridad → Cambiar contraseña. Necesitarás ingresar la contraseña actual y la nueva (mínimo 8 caracteres).'
      },
      {
        q: '¿Cuáles son los roles del sistema?',
        a: 'Existen 4 roles principales (ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR) y 3 sub-roles administrativos delegados (ADMIN_GENERADOR, ADMIN_TRANSPORTISTA, ADMIN_OPERADOR). Cada rol tiene acceso a un subconjunto diferente de páginas.'
      },
      {
        q: '¿Qué es la función Acceso Comodín?',
        a: 'El ADMIN puede "impersonar" a cualquier usuario activo para ver la aplicación exactamente como la ve ese usuario, sin necesitar su contraseña. Aparece un banner naranja durante la sesión de impersonación. Usar el botón "Volver a mi cuenta" para salir.'
      },
      {
        q: '¿Cómo uso la búsqueda global (Cmd+K)?',
        a: 'Presiona Cmd+K (macOS) o Ctrl+K (Windows/Linux) desde cualquier página autenticada. El panel de búsqueda global te permite encontrar manifiestos, generadores, transportistas y operadores de forma instantánea.'
      }
    ]
  },
  {
    category: 'Reportes y Exportación',
    questions: [
      {
        q: '¿Cómo exporto datos a CSV?',
        a: 'En la sección Reportes, usa el botón "Exportar" en la barra superior. Puedes exportar manifiestos, generadores, transportistas u operadores. El límite es 10,000 filas por exportación.'
      },
      {
        q: '¿Qué reportes están disponibles?',
        a: 'Hay 8 pestañas en el Centro de Reportes: Manifiestos, Residuos Tratados, Transporte, Generadores, Operadores, Tratamientos, Departamentos (mapa coroplético), y Mapa de Actores (Leaflet). Todos con gráficos interactivos y exportación PDF/CSV.'
      },
      {
        q: '¿Cómo configuro mis notificaciones por email?',
        a: 'Ve a Configuración → pestaña Notificaciones. Activa o desactiva el toggle "Recibir alertas por email". Los administradores tienen un toggle adicional para notificaciones de nuevos usuarios pendientes.'
      }
    ]
  },
  {
    category: 'Administración de Flota (Transportista)',
    questions: [
      {
        q: '¿Cómo agrego un vehículo a mi flota?',
        a: 'Ve a Transporte → Perfil → pestaña Info → "Gestionar vehículos y conductores". En la tabla de Vehículos, haz clic en "Agregar Vehículo". Completa patente, marca, modelo, año, capacidad y fecha de vencimiento de habilitación.'
      },
      {
        q: '¿Necesito pedirle al administrador que agregue mis vehículos?',
        a: 'No. Los transportistas pueden gestionar su propia flota de forma autónoma desde su perfil. Los cambios se reflejan inmediatamente en el sistema y están disponibles para futuros manifiestos.'
      }
    ]
  }
];

// Videos data
const videos = [
  { title: 'Login y Dashboard', animation: '/manual/screenshots/animations/login_dashboard.webp', duration: 'Demo' },
  { title: 'Navegacion del Admin', animation: '/manual/screenshots/animations/admin_menu_navegacion.webp', duration: 'Demo' },
  { title: 'Viaje del Transportista', animation: '/manual/screenshots/animations/transportista_viaje.webp', duration: 'Demo' },
  { title: 'Tracking GPS en Mapa', animation: '/manual/screenshots/animations/tracking_gps_mapa.webp', duration: 'Demo' },
  { title: 'Recepcion del Operador', animation: '/manual/screenshots/animations/operador_recepcion.webp', duration: 'Demo' },
  { title: 'Reportes y Exportacion', animation: '/manual/screenshots/animations/reportes_exportacion.webp', duration: 'Demo' },
  { title: 'Cambio de Perfil', animation: '/manual/screenshots/animations/cambio_perfil_menu.webp', duration: 'Demo' },
  { title: 'Onboarding de la App', animation: '/manual/screenshots/animations/demoapp_selector_onboarding.webp', duration: 'Demo' },
];

const AyudaPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const filteredFaqs = faqs.map(cat => ({
    ...cat,
    questions: cat.questions.filter(
      q => q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
           q.a.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(cat => cat.questions.length > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-neutral-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Centro de Ayuda</h2>
            <p className="text-neutral-600 mt-1">
              Encuentra respuestas y aprende a usar SITREP
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-2xl">
        <Input
          placeholder="Buscar en la ayuda..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search size={18} />}
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { icon: BookOpen, label: 'Manual completo', color: 'bg-primary-50 text-primary-600', href: '/manual/' },
          { icon: Video, label: 'Tutoriales', color: 'bg-secondary-50 text-secondary-600', href: undefined },
          { icon: MessageCircle, label: 'Chat de ayuda', color: 'bg-info-50 text-info-600', href: undefined },
          { icon: FileText, label: 'Guías PDF', color: 'bg-success-50 text-success-600', href: undefined },
        ].map((item) => (
          <Card
            key={item.label}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => item.href && (window.location.href = item.href)}
          >
            <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-3`}>
              <item.icon size={24} />
            </div>
            <p className="font-medium text-neutral-900">{item.label}</p>
            {item.href && (
              <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                <ChevronRight size={11} /> Ver manual del sistema
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Workflow Diagram */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitBranch className="text-primary-500" size={22} />
          <h3 className="text-lg font-semibold text-neutral-900">Ciclo de Vida del Manifiesto</h3>
        </div>
        <WorkflowDiagram />
      </Card>

      {/* FAQ Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <HelpCircle className="text-primary-500" size={24} />
              <h3 className="text-lg font-semibold text-neutral-900">
                Preguntas Frecuentes
              </h3>
            </div>

            {filteredFaqs.length === 0 ? (
              <p className="text-neutral-500 text-center py-8">
                No se encontraron resultados para tu búsqueda
              </p>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {filteredFaqs.map((category) => (
                  <div key={category.category}>
                    <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                      {category.category}
                    </h4>
                    <div className="space-y-2 animate-fade-in">
                      {category.questions.map((faq, idx) => {
                        const key = `${category.category}-${idx}`;
                        const isExpanded = expandedFaq === key;
                        
                        return (
                          <div 
                            key={key}
                            className="border border-neutral-200 rounded-xl overflow-hidden"
                          >
                            <button
                              onClick={() => setExpandedFaq(isExpanded ? null : key)}
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 transition-colors"
                            >
                              <span className="font-medium text-neutral-900">{faq.q}</span>
                              <ChevronRight 
                                size={18} 
                                className={`text-neutral-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 text-neutral-600">
                                {faq.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Contact */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              ¿Necesitas más ayuda?
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <a 
                href="mailto:soporte@sitrep.gob.ar"
                className="flex items-center gap-3 p-4 rounded-xl border border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Mail className="text-primary-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Email</p>
                  <p className="text-sm text-neutral-500">soporte@sitrep.gob.ar</p>
                </div>
              </a>
              <a 
                href="tel:08001234567"
                className="flex items-center gap-3 p-4 rounded-xl border border-neutral-200 hover:border-success-300 hover:bg-success-50 transition-colors"
              >
                <div className="w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
                  <Phone className="text-success-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Teléfono</p>
                  <p className="text-sm text-neutral-500">0800-123-4567</p>
                </div>
              </a>
            </div>
          </Card>
        </div>

        {/* Videos sidebar */}
        <div>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Videos tutoriales
            </h3>
            <div className="space-y-4 animate-fade-in">
              {videos.map((video) => (
                <div
                  key={video.title}
                  className="group cursor-pointer"
                  onClick={() => window.open(video.animation, '_blank')}
                >
                  <div className="relative aspect-video bg-neutral-100 rounded-lg mb-2 overflow-hidden">
                    <img
                      src={video.animation}
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-full object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                        <ExternalLink className="text-primary-600" size={16} />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-[10px] font-medium rounded">
                      {video.duration}
                    </span>
                  </div>
                  <p className="font-medium text-neutral-900 text-sm group-hover:text-primary-600 transition-colors">
                    {video.title}
                  </p>
                </div>
              ))}
            </div>
            <a href="/manual/#gal-acceso" className="w-full mt-4 flex items-center justify-center gap-2 text-primary-600 font-medium text-sm hover:underline">
              Ver galeria completa
              <ExternalLink size={14} />
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AyudaPage;
