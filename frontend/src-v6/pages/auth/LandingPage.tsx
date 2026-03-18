/**
 * SITREP - Landing pública institucional
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Factory, Truck, FlaskConical, Shield, ShieldCheck, ShieldPlus, Smartphone, Monitor, ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const PERFILES = [
  { tipo: 'GENERADOR',           label: 'Generador',            desc: 'Registro y firma de manifiestos',       icon: Factory,     color: 'bg-purple-500',  border: 'border-purple-200 hover:border-purple-400' },
  { tipo: 'TRANSPORTISTA',       label: 'Transportista',        desc: 'Retiro y transporte de RRPP',           icon: Truck,       color: 'bg-orange-500',  border: 'border-orange-200 hover:border-orange-400' },
  { tipo: 'OPERADOR',            label: 'Operador',             desc: 'Recepción y tratamiento',               icon: FlaskConical,color: 'bg-blue-500',    border: 'border-blue-200 hover:border-blue-400' },
  { tipo: 'ADMIN_TRANSPORTISTA', label: 'Adm. Transportistas',  desc: 'Gestión del grupo transportista',       icon: Shield,      color: 'bg-slate-500',   border: 'border-slate-200 hover:border-slate-400' },
  { tipo: 'ADMIN_GENERADOR',     label: 'Adm. Generadores',     desc: 'Gestión del grupo generador',           icon: ShieldCheck, color: 'bg-green-600',   border: 'border-green-200 hover:border-green-400' },
  { tipo: 'ADMIN_OPERADOR',      label: 'Adm. Operadores',      desc: 'Gestión del grupo operador',            icon: ShieldPlus,  color: 'bg-teal-500',    border: 'border-teal-200 hover:border-teal-400' },
];

const APP_URL = 'https://sitrep.ultimamilla.com.ar/app/';

const LandingPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Si ya autenticado → redirigir
  React.useEffect(() => {
    if (currentUser) navigate('/dashboard', { replace: true });
  }, [currentUser, navigate]);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#1B5E3C] rounded-xl flex items-center justify-center">
              <Leaf size={20} className="text-white" />
            </div>
            <span className="font-bold text-[#1B5E3C] text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              SITREP
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a href="#instalar" className="hidden sm:flex items-center gap-1.5 text-sm text-neutral-600 hover:text-[#1B5E3C] transition-colors px-3 py-1.5">
              <Smartphone size={16} />
              Instalar App
            </a>
            <Link to="/login" className="flex items-center gap-1.5 text-sm bg-[#1B5E3C] text-white px-4 py-1.5 rounded-lg hover:bg-[#164D32] transition-colors">
              <LogIn size={16} />
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1B5E3C] to-[#0D8A4F] text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Leaf size={32} className="text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>
            SITREP
          </h1>
          <p className="text-lg text-green-100 mb-2">
            Sistema de Trazabilidad de Residuos Peligrosos
          </p>
          <p className="text-green-200 text-sm mb-8">
            Provincia de Mendoza — Dirección General de Fiscalización Ambiental
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 bg-white text-[#1B5E3C] font-semibold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors"
            >
              <LogIn size={18} />
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="flex items-center justify-center gap-2 bg-white/15 border border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/25 transition-colors"
            >
              <UserPlus size={18} />
              Registrarse
            </Link>
          </div>
        </div>
      </section>

      {/* Perfiles */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-neutral-800 text-center mb-2">Seleccioná tu perfil para registrarte</h2>
          <p className="text-sm text-neutral-500 text-center mb-8">Cada perfil tiene acceso a las funciones correspondientes a su rol en el sistema</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PERFILES.map(({ tipo, label, desc, icon: Icon, color, border }) => (
              <Link
                key={tipo}
                to={`/registro?tipo=${tipo}`}
                className={`p-4 bg-white rounded-xl border-2 ${border} transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-2`}
              >
                <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center`}>
                  <Icon size={18} className="text-white" />
                </div>
                <p className="font-semibold text-sm text-neutral-900">{label}</p>
                <p className="text-xs text-neutral-500 leading-snug">{desc}</p>
                <ArrowRight size={14} className="text-neutral-400 mt-auto" />
              </Link>
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
                <Smartphone size={20} className="text-[#1B5E3C]" />
                <h3 className="font-semibold text-neutral-800">App para dispositivos móviles</h3>
              </div>
              <p className="text-sm text-neutral-600 mb-4">Disponible para perfiles: <b>Generador, Transportista, Operador</b></p>
              <div className="bg-white rounded-lg p-4 inline-flex items-center justify-center border border-neutral-200 mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(APP_URL)}`}
                  alt="QR App SITREP"
                  className="w-28 h-28"
                />
              </div>
              <div className="space-y-2 text-sm text-neutral-600">
                <p className="font-medium">Pasos para instalar:</p>
                <p>📱 <b>Android:</b> Abrir Chrome → Menú → "Añadir a pantalla de inicio"</p>
                <p>🍎 <b>iOS:</b> Abrir Safari → Compartir → "Agregar a pantalla de inicio"</p>
                <a href={APP_URL} className="text-[#1B5E3C] font-medium hover:underline block mt-2">{APP_URL}</a>
              </div>
            </div>
            {/* Perfiles web */}
            <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
              <div className="flex items-center gap-2 mb-4">
                <Monitor size={20} className="text-[#1B5E3C]" />
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
              <Link to="/login" className="mt-6 flex items-center gap-2 bg-[#1B5E3C] text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-[#164D32] transition-colors">
                <LogIn size={16} />
                Acceder al sistema
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-800 text-neutral-400 text-center py-6 px-4 text-xs mt-auto">
        <p className="font-medium text-neutral-200 mb-1">Provincia de Mendoza</p>
        <p>Dirección General de Fiscalización Ambiental (DGFA) — Sistema de Trazabilidad de Residuos Peligrosos</p>
      </footer>
    </div>
  );
};

export default LandingPage;
