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
  HelpCircle
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Input } from '../../components/ui/Input';

// FAQ data
const faqs = [
  {
    category: 'Manifiestos',
    questions: [
      {
        q: '¿Cómo creo un nuevo manifiesto?',
        a: 'Ve a Manifiestos → Nuevo Manifiesto. Completa los datos del generador, los residuos y la información de transporte.'
      },
      {
        q: '¿Qué estados puede tener un manifiesto?',
        a: 'Borrador, Aprobado, En tránsito, Entregado, Recibido y Tratado. Cada estado representa una etapa del proceso.'
      },
      {
        q: '¿Cómo imprimo un manifiesto?',
        a: 'Abre el manifiesto y haz clic en el botón "Imprimir" en la parte superior derecha.'
      }
    ]
  },
  {
    category: 'Cuenta',
    questions: [
      {
        q: '¿Cómo cambio mi contraseña?',
        a: 'Ve a Configuración → Seguridad → Cambiar contraseña.'
      },
      {
        q: '¿Puedo tener varios roles?',
        a: 'No, cada usuario tiene un único rol asignado por el administrador.'
      }
    ]
  },
  {
    category: 'Reportes',
    questions: [
      {
        q: '¿Cómo exporto datos a Excel?',
        a: 'En cualquier lista, usa el botón "Exportar" en la parte superior derecha.'
      },
      {
        q: '¿Qué reportes están disponibles?',
        a: 'Manifiestos por período, residuos por tipo, actores activos, y más.'
      }
    ]
  }
];

// Videos data
const videos = [
  { title: 'Crear tu primer manifiesto', duration: '5:30', thumbnail: '📹' },
  { title: 'Gestión de transportistas', duration: '4:15', thumbnail: '🚛' },
  { title: 'Uso del escáner QR', duration: '3:45', thumbnail: '📱' },
  { title: 'Reportes avanzados', duration: '7:20', thumbnail: '📊' },
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: BookOpen, label: 'Documentación', color: 'bg-primary-50 text-primary-600' },
          { icon: Video, label: 'Tutoriales', color: 'bg-secondary-50 text-secondary-600' },
          { icon: MessageCircle, label: 'Chat de ayuda', color: 'bg-info-50 text-info-600' },
          { icon: FileText, label: 'Guías PDF', color: 'bg-success-50 text-success-600' },
        ].map((item) => (
          <Card 
            key={item.label}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-3`}>
              <item.icon size={24} />
            </div>
            <p className="font-medium text-neutral-900">{item.label}</p>
          </Card>
        ))}
      </div>

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
                >
                  <div className="relative aspect-video bg-neutral-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                    <span className="text-4xl">{video.thumbnail}</span>
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                        <Play className="text-primary-600 ml-1" size={20} />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      {video.duration}
                    </span>
                  </div>
                  <p className="font-medium text-neutral-900 text-sm group-hover:text-primary-600 transition-colors">
                    {video.title}
                  </p>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 flex items-center justify-center gap-2 text-primary-600 font-medium text-sm hover:underline">
              Ver todos los videos
              <ExternalLink size={14} />
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AyudaPage;
