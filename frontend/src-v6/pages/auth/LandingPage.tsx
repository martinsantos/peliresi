/**
 * SITREP - Landing pública institucional
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Factory, Truck, FlaskConical, Shield, ShieldCheck, ShieldPlus, Smartphone, Monitor, ArrowRight, LogIn, UserPlus, PlayCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { MendozaBrand } from '../../components/MendozaBrand';
import './institutional.css';

const PERFILES = [
  { tipo: 'generador',     label: 'Generador',     desc: 'Alta, documentación y firma de manifiestos', icon: Factory,      color: 'bg-purple-500', border: 'border-purple-200 hover:border-purple-400' },
  { tipo: 'transportista', label: 'Transportista', desc: 'Alta de flota, choferes y documentación',    icon: Truck,        color: 'bg-orange-500', border: 'border-orange-200 hover:border-orange-400' },
  { tipo: 'operador',      label: 'Operador',      desc: 'Alta, habilitación, recepción y tratamiento', icon: FlaskConical, color: 'bg-blue-500',   border: 'border-blue-200 hover:border-blue-400' },
];

const APP_URL = import.meta.env.VITE_APP_URL || '/app/';

const LandingPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const absoluteAppUrl = new URL(APP_URL, window.location.origin).href;

  // Si ya autenticado → redirigir
  React.useEffect(() => {
    if (currentUser) navigate('/dashboard', { replace: true });
  }, [currentUser, navigate]);

  return (
    <div className="institutional min-h-screen flex flex-col">
      <div className="institutional-stripe" aria-hidden="true" />
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="brand-icon w-9 h-9 rounded-xl flex items-center justify-center">
              <Leaf size={20} className="text-white" />
            </div>
            <span className="brand-link font-bold text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              SITREP
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a href="#instalar" className="brand-link hidden sm:flex items-center gap-1.5 text-sm transition-colors px-3 py-3">
              <Smartphone size={16} />
              Instalar App
            </a>
            <Link to="/login" className="brand-action flex items-center gap-1.5 text-sm px-4 py-3 rounded-lg transition-colors">
              <LogIn size={16} />
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="institutional-hero">
        <div className="institutional-hero-inner">
        <div>
          <p className="institutional-eyebrow">Provincia de Mendoza · SITREP</p>
          <h1 className="institutional-title" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Sistema de Trazabilidad de Residuos Peligrosos
          </h1>
          <p className="text-neutral-600 text-sm leading-relaxed mb-8 max-w-md">
            Dirección General de Fiscalización Ambiental.<br />
            Gestión y seguimiento de manifiestos, desde la generación hasta el tratamiento final.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/login"
              className="brand-action flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <LogIn size={18} />
              Iniciar sesión
            </Link>
            <a
              href="#perfiles"
              className="brand-secondary flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <UserPlus size={18} />
              Solicitar inscripción
            </a>
          </div>
        </div>
        <div className="institutional-hero-brand"><MendozaBrand /></div>
        </div>
      </section>

      {/* Perfiles */}
      <section id="perfiles" className="py-12 px-4 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-neutral-800 text-center mb-2">Seleccioná tu perfil para registrarte</h2>
          <p className="text-sm text-neutral-500 text-center mb-8">Cada perfil tiene acceso a las funciones correspondientes a su rol en el sistema</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PERFILES.map(({ tipo, label, desc, icon: Icon, color, border }) => (
              <article
                key={tipo}
                className={`p-4 bg-white rounded-xl border-2 ${border} transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-2`}
              >
                <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center`}>
                  <Icon size={18} className="text-white" />
                </div>
                <p className="font-semibold text-sm text-neutral-900">{label}</p>
                <p className="text-xs text-neutral-500 leading-snug">{desc}</p>
                <div className="mt-auto space-y-2 pt-2">
                  <Link
                    to={`/inscripcion/${tipo}`}
                    aria-label={`Iniciar alta de ${label}`}
                    className="brand-action flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
                  >
                    Iniciar alta
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                  <Link
                    to={`/inscripcion/${tipo}?modo=revision`}
                    aria-label={`Probar formulario de ${label} sin completar datos`}
                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
                  >
                    <PlayCircle size={14} aria-hidden="true" />
                    Probar formulario
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Instalar App */}
      <section id="instalar" className="bg-white border-t border-neutral-200 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-neutral-800 text-center mb-2">Instalar la App</h2>
          <p className="text-sm text-neutral-500 text-center mb-8">Los perfiles operativos (Generador, Transportista, Operador) tienen una app PWA instalable</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Perfiles con app */}
            <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone size={20} className="brand-link" />
                <h3 className="font-semibold text-neutral-800">App para dispositivos móviles</h3>
              </div>
              <p className="text-sm text-neutral-600 mb-4">Disponible para perfiles: <b>Generador, Transportista, Operador</b></p>
              <div className="bg-white rounded-lg p-4 inline-flex items-center justify-center border border-neutral-200 mb-4">
                <QRCodeSVG
                  value={absoluteAppUrl}
                  size={112}
                  level="M"
                  role="img"
                  aria-label="QR para abrir la App SITREP"
                />
              </div>
              <div className="space-y-2 text-sm text-neutral-600">
                <p className="font-medium">Pasos para instalar:</p>
                <p><b>Android:</b> Abrir Chrome → Menú → "Añadir a pantalla de inicio"</p>
                <p><b>iOS:</b> Abrir Safari → Compartir → "Agregar a pantalla de inicio"</p>
                <a href={APP_URL} className="brand-link font-medium hover:underline block mt-2">Abrir App SITREP</a>
              </div>
            </div>
            {/* Perfiles web */}
            <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
              <div className="flex items-center gap-2 mb-4">
                <Monitor size={20} className="brand-link" />
                <h3 className="font-semibold text-neutral-800">Acceso desde el navegador web</h3>
              </div>
              <p className="text-sm text-neutral-600 mb-4">Perfiles de administración acceden desde el navegador en computadora o tablet.</p>
              <div className="space-y-2">
                {[
                  { icon: Shield, label: 'Adm. Transportistas', color: 'bg-slate-500' },
                  { icon: ShieldCheck, label: 'Adm. Generadores', color: 'bg-green-600' },
                  { icon: ShieldPlus, label: 'Adm. Operadores', color: 'bg-teal-500' },
                ].map(({ icon: I, label, color }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-neutral-700">
                    <div className={`w-6 h-6 ${color} rounded flex items-center justify-center`}>
                      <I size={12} className="text-white" />
                    </div>
                    {label}
                  </div>
                ))}
              </div>
              <Link to="/login" className="brand-action mt-6 flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-lg transition-colors">
                <LogIn size={16} />
                Acceder al sistema
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="institutional-footer text-center py-6 px-4 text-xs mt-auto">
        <p className="font-medium text-neutral-200 mb-1">Provincia de Mendoza</p>
        <p>Dirección General de Fiscalización Ambiental (DGFA) — Sistema de Trazabilidad de Residuos Peligrosos</p>
      </footer>
    </div>
  );
};

export default LandingPage;
