/**
 * SITREP v6 - Ayuda Page
 * =======================
 * Centro de ayuda y documentación
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  FileText,
  MessageCircle,
  ChevronRight,
  ArrowLeft,
  HelpCircle,
  GitBranch
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Input } from '../../components/ui/Input';
import WorkflowDiagram from '../../components/docs/WorkflowDiagram';
import { SupportEntry } from '../../components/SupportReportDialog';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useAuth } from '../../contexts/AuthContext';
import { workspaceNavigation } from '../../utils/workspaceNavigation';

// FAQ data
const faqs = [
  {
    category: 'Manifiestos',
    questions: [
      {
        q: '¿Cómo creo un nuevo manifiesto?',
        a: 'Ingresá con tu propia cuenta y el rol correcto. Generador, transportista u operador pueden iniciar una propuesta: elegí las partes, declará los residuos y revisá el resumen. Queda Pendiente de aprobación hasta que las tres partes confirmen. En origen también elegís un transporte aprobador: aprueba junto con generador y operador, aunque no haya viaje ni GPS. Un borrador anterior puede requerir una nueva propuesta; su historial se conserva.'
      },
      {
        q: '¿Qué estados puede tener un manifiesto?',
        a: 'Una propuesta nueva pasa de Pendiente de aprobación a Aprobado cuando confirman generador, transporte y operador, tanto con traslado como en origen. Después inician la coordinación. Con traslado siguen retiro, En tránsito, Entregado, Recibido, En tratamiento y Tratado. En origen el operador confirma directamente la recepción: no hay viaje ni GPS. El detalle indica quién debe actuar; los registros anteriores conservan sus decisiones y algunos borradores pueden requerir una nueva propuesta.'
      },
      {
        q: '¿Cómo descargo el certificado de disposición final?',
        a: 'Abrí Certificaciones en el detalle del manifiesto. El operador emite y firma los certificados parciales y el final cuando se cumplen sus requisitos. El final requiere el cierre, las adendas resueltas y el tratamiento completo de las corrientes halladas: Tratado no significa que ya esté emitido. Una vez liberado, las partes involucradas reciben un aviso en la campana y pueden descargar el mismo documento. Los documentos históricos conservan su acceso.'
      },
      {
        q: '¿Cómo edito un manifiesto?',
        a: 'Los borradores del circuito anterior pueden editarse si tu rol tiene permiso. Una propuesta presentada conserva lo acordado: para corregirla, creá otra propuesta. Las diferencias constatadas durante el circuito se registran mediante una adenda, con su informe de hallazgo y las revisiones que correspondan; no se sobrescribe la declaración original.'
      },
      {
        q: '¿Cómo cancelo un manifiesto?',
        a: 'Abrí el detalle y revisá las acciones disponibles para tu rol y el estado actual. Si aparece Cancelar Manifiesto, indicá el motivo y confirmá. En una propuesta, rechazar la participación es una decisión distinta de cancelar. Las decisiones y el historial se conservan.'
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
        a: 'Abrí Mis viajes y elegí el manifiesto. Primero deben estar las aprobaciones necesarias. Confirmá el retiro sólo cuando recibas la carga y permití el acceso a ubicación. Revisá el indicador de GPS: iniciar la coordinación no inicia el viaje. Con varios viajes simultáneos, verificá cuáles están seleccionados para compartir ubicación.'
      },
      {
        q: '¿Qué hago si el GPS falla durante el viaje?',
        a: 'Revisá el indicador de ubicación y la conexión. Si se denegó el permiso, habilitalo en el navegador o teléfono. En el detalle del viaje o en GPS de mis viajes, usá Reintentar GPS si aparece. Al reconectar, revisá los puntos pendientes y la confirmación del envío; en el detalle del viaje revisá la hora de la última sincronización. Si la pantalla indica que una ubicación anterior no puede confirmarse, conservá este dispositivo y consultá a soporte antes de entregar. No se garantiza conservar todas las lecturas durante una desconexión. Administración puede consultar la posición recibida en Monitor, que puede ser anterior. Mantené la app abierta: no se garantiza GPS con la app cerrada.'
      },
      {
        q: '¿Cómo registro un incidente durante el transporte?',
        a: 'En la pantalla de Viaje en Curso, usa el botón "Registrar Incidente". Ingresa el tipo de incidente (avería, accidente, etc.) y una descripción. El incidente queda registrado en el timeline del manifiesto sin cambiar su estado.'
      }
    ]
  },
  {
    category: 'Inspecciones',
    questions: [
      {
        q: '¿Dónde inicio una inspección?',
        a: 'Las inspecciones se crean únicamente en Inspecciones. La pestaña Inspecciones de la ficha de un actor muestra sus expedientes relacionados, sin otro formulario de alta. La web y la app comparten el mismo expediente.'
      },
      {
        q: '¿Cómo adjunto una foto a un hallazgo?',
        a: 'Abrí el control del checklist o el dato declarado, indicá el resultado y usá Tomar foto o Elegir imagen dentro de ese control. Comprobá que aparezca la miniatura vinculada y que deje de figurar pendiente de sincronizar. Las fotos generales se agregan en Evidencias.'
      },
      {
        q: '¿Cómo sé que mis cambios se guardaron?',
        a: 'Usá Guardar cambios y esperá la confirmación del servidor. Recorrer pasos no guarda ni envía. Si falta señal, el borrador puede quedar en este dispositivo: al reconectar, verificá por separado el guardado del texto y de cada foto antes de enviar a revisión.'
      },
      {
        q: '¿Qué documentos se exportan?',
        a: 'Desde Exportar podés descargar el acta de campo y el informe técnico como documentos distintos. Revisá ambos antes de compartirlos. El QR permite verificar trazabilidad e integridad, pero no reemplaza una firma digital ni una notificación formal.'
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
        a: 'Hay generadores, transportistas, operadores, inspección, administración general, administraciones delegadas de cada actividad y auditoría. Una razón social puede tener varias actividades aprobadas. Elegí el rol y establecimiento correctos antes de actuar; cambiar de contexto no amplía tus permisos.'
      },
      {
        q: '¿Qué permite la Vista temporal (Acceso Comodín)?',
        a: 'La administración puede abrir una Vista temporal para asistir a un usuario, identificada por una banda amarilla. No sustituye la cuenta real para crear propuestas ni aprobar la participación de las partes. El formulario explica esta limitación antes de cargar datos. Usá Volver a mi cuenta para recuperar tu identidad administrativa y el contexto de origen.'
      },
      {
        q: '¿Cómo uso la búsqueda global (Cmd+K)?',
        a: 'Presioná Cmd+K (macOS) o Ctrl+K (Windows/Linux). El panel busca información disponible para tu cuenta, como manifiestos o actores autorizados.'
      }
    ]
  },
  {
    category: 'Reportes y Exportación',
    questions: [
      {
        q: '¿Cómo exporto datos a CSV?',
        a: 'En Reportes, elegí la sección y los filtros que necesitás. Si está disponible para tu cuenta, usá Exportar para descargar los datos de tu alcance.'
      },
      {
        q: '¿Qué reportes están disponibles?',
        a: 'Las secciones y los datos disponibles en Reportes dependen de tu función. Abrí la sección que necesitás y revisá los filtros y las opciones de exportación disponibles para tu cuenta.'
      },
      {
        q: '¿Cómo configuro mis notificaciones por email?',
        a: 'En Configuración → Notificaciones podés guardar tus preferencias. La entrega depende también de que el canal esté habilitado por la administración: activar una preferencia no habilita correos ni push del sistema. Si están apagados, no se envía nada por esos canales. Los avisos internos se consultan en la campana.'
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

const requirementFaq = {
  category: 'Requerimientos recibidos',
  questions: [{ q: '¿Cómo respondo un requerimiento?', a: 'Abrí el aviso recibido desde la campana o Avisos. Revisá el pedido y su plazo, elegí Responder y comprobá la confirmación. Podés volver al mismo aviso para consultar la decisión; la respuesta no cierra el expediente por sí sola.' }],
};

const AyudaPage: React.FC = () => {
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const navigation = workspaceNavigation(currentUser);
  const canInspect = navigation.some(item => item.path === '/inspecciones');
  const canManageFleet = navigation.some(item => item.path === '/transporte/perfil');
  const canTrack = canManageFleet || navigation.some(item => item.path === '/monitor');
  const actor = !!(currentUser?.actorId || currentUser?.empresaContexto?.actorId)
    && !!currentUser && ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(currentUser.rol);
  const availableFaqs = faqs.filter(cat => (cat.category !== 'Inspecciones' || canInspect)
    && (cat.category !== 'Administración de Flota (Transportista)' || canManageFleet)
    && (cat.category !== 'Transporte y GPS' || canTrack));
  if (actor) availableFaqs.splice(1, 0, requirementFaq);
  const filteredFaqs = availableFaqs.map(cat => ({
    ...cat,
    questions: cat.questions.filter(q => (q.q !== '¿Qué permite la Vista temporal (Acceso Comodín)?' || currentUser?.rol === 'ADMIN')
      && (q.q.toLowerCase().includes(searchTerm.toLowerCase()) || q.a.toLowerCase().includes(searchTerm.toLowerCase())))
  })).filter(cat => cat.questions.length > 0);

  const guides = [
    { title: 'Proponer y aprobar un manifiesto', id: 'manifiestos-tres-partes' },
    ...(actor ? [{ title: 'Responder un requerimiento desde Avisos', id: 'actor-mis-inspecciones' }] : []),
    ...(canInspect ? [{ title: 'Inspecciones, plazos y requerimientos', id: 'psip-flujo-inspecciones' }] : []),
    ...(canManageFleet ? [{ title: 'GPS y relevo de transporte', id: 'transporte-relevo' }] : []),
    { title: 'Continuar si el sistema pide esperar', id: 'resolver-espera-reintento' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button 
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"
              aria-label="Volver"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <p className="text-neutral-600">Encontrá respuestas y guías para tu trabajo en SITREP.</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-2xl">
        <Input
          aria-label="Buscar en la ayuda"
          placeholder="Buscar en la ayuda..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search size={18} />}
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4 md:max-w-2xl">
        <a href="/manual/" className="min-h-11 rounded-xl border border-neutral-200 bg-white p-4 hover:border-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
          <BookOpen size={24} className="mb-3 text-primary-700" aria-hidden="true" />
          <span className="font-medium text-neutral-900">Manual completo</span>
        </a>
        <Link to={mp('/soporte')} className="min-h-11 rounded-xl border border-neutral-200 bg-white p-4 hover:border-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
          <MessageCircle size={24} className="mb-3 text-primary-700" aria-hidden="true" />
          <span className="font-medium text-neutral-900">Mis tickets de soporte</span>
        </Link>
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
                      {category.questions.map((faq) => {
                        const key = `${category.category}-${faq.q}`;
                        const isExpanded = expandedFaq === key;
                        
                        return (
                          <div 
                            key={key}
                            className="border border-neutral-200 rounded-xl overflow-hidden"
                          >
                            <button
                              onClick={() => setExpandedFaq(isExpanded ? null : key)}
                              aria-expanded={isExpanded}
                              className="flex min-h-11 w-full items-center justify-between p-4 text-left hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"
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
            <div className="flex flex-wrap gap-3">
              <SupportEntry />
              <Link to={mp('/soporte')} className="inline-flex min-h-11 items-center rounded-lg border border-neutral-400 px-4 text-neutral-900 hover:bg-primary-50 focus-visible:outline-primary-700">Ver mis tickets</Link>
            </div>
          </Card>
        </div>

        {/* Relevant guides use the same manual in web and app. */}
        <div>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Guías paso a paso
            </h3>
            <div className="space-y-1">
              {guides.map(guide => <a key={guide.id} href={`/manual/tutorial.html?guide=${guide.id}`}
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-primary-800 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
                <FileText size={18} className="shrink-0" aria-hidden="true" />{guide.title}
              </a>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AyudaPage;
