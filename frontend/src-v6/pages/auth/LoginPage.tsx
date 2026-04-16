/**
 * SITREP v6 - Login Page
 * ======================
 * Pagina de inicio de sesion - Real API + Demo fallback
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Leaf, AlertCircle, Factory, Truck, FlaskConical, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Accesos rápidos — siempre visibles para facilitar el testing
const QUICK_LOGINS = [
  { label: 'Administrador', sublabel: 'DGFA',               color: 'bg-primary-500', email: 'admin@dgfa.mendoza.gov.ar',          password: 'admin123'  },
  { label: 'Generador',     sublabel: 'Química Mendoza',    color: 'bg-purple-500',  email: 'quimica.mendoza@industria.com',       password: 'gen123'    },
  { label: 'Transportista', sublabel: 'Transportes Andes',  color: 'bg-orange-500',  email: 'transportes.andes@logistica.com',     password: 'trans123'  },
  { label: 'Operador',      sublabel: 'Tratamiento Residuos',color: 'bg-blue-500',   email: 'tratamiento.residuos@planta.com',     password: 'op123'     },
];

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Ingresa email y contrasena');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(authError || err?.response?.data?.message || 'Error al iniciar sesion. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (q: typeof QUICK_LOGINS[number], idx: number) => {
    setSelectedUserId(idx);
    setEmail(q.email);
    setPassword(q.password);
    setShowPassword(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-start md:items-center justify-center px-4 py-8 md:py-12">
    <div className="w-full max-w-md animate-fade-in-up">
      {/* Header — Gobierno de Mendoza + SITREP */}
      <div className="text-center mb-4 md:mb-6">
        <div className="hidden lg:flex items-center justify-center gap-2.5 mb-2">
          <img src="/escudo-mendoza-color.webp" alt="Escudo Provincia de Mendoza" className="h-9 w-auto" />
          <span className="text-left leading-tight" style={{ fontFamily: "'Lato', sans-serif" }}>
            <span className="block text-sm font-bold text-[#007F90] tracking-tight">MENDOZA</span>
            <span className="block text-[11px] font-light text-[#007F90]">GOBIERNO</span>
          </span>
          <div className="w-px h-8 bg-neutral-300" />
          <div className="flex items-center gap-1.5">
            <div className="w-9 h-9 bg-[#1B5E3C] rounded-xl flex items-center justify-center shadow-lg">
              <Leaf size={20} className="text-white" />
            </div>
            <span className="text-sm font-extrabold text-neutral-900 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>SITREP</span>
          </div>
        </div>
        <p className="text-xs md:text-sm text-neutral-600">
          Sistema de Trazabilidad de Residuos Peligrosos
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-3 bg-error-50 border border-error-200 rounded-xl flex items-center gap-2 text-sm text-error-700 animate-fade-in">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Demo users - PRINCIPAL */}
      <div className="mb-6 md:mb-8">
        <p className="text-xs md:text-sm text-neutral-500 text-center mb-3 md:mb-4 font-medium">
          Selecciona un perfil para ingresar
        </p>
        <div className="grid grid-cols-2 gap-2 md:gap-3 stagger-children">
          {QUICK_LOGINS.map((q, idx) => {
            const isSelected = selectedUserId === idx;
            return (
              <button
                key={idx}
                onClick={() => handleQuickLogin(q, idx)}
                disabled={loading}
                className={`p-3 md:p-4 text-left rounded-xl border-2 transition-all active:scale-[0.97] disabled:opacity-50 ${
                  isSelected
                    ? 'border-[#1B5E3C] bg-emerald-50 shadow-md'
                    : 'border-neutral-200 bg-white hover:border-primary-500 hover:bg-primary-50'
                }`}
              >
                <div className={`w-7 h-7 md:w-8 md:h-8 ${q.color} rounded-lg flex items-center justify-center text-white text-xs font-bold mb-1.5 md:mb-2`}>
                  {q.label[0]}
                </div>
                <p className="font-semibold text-sm text-neutral-900">{q.label}</p>
                <p className="text-xs text-neutral-500">{q.sublabel}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-[10px] md:text-xs text-neutral-400 font-medium whitespace-nowrap">o ingresa con credenciales</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4 bg-white rounded-2xl p-4 md:p-0 md:bg-transparent border border-neutral-100 md:border-0 shadow-sm md:shadow-none">
        <div>
          <label className="block text-xs md:text-sm font-medium text-neutral-700 mb-1 md:mb-1.5">Email o CUIT</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="tu@email.com o 20-12345678-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 md:h-11 pl-10 pr-4 border border-neutral-200 rounded-xl text-sm bg-neutral-50 md:bg-white focus:bg-white focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-neutral-700 mb-1 md:mb-1.5">Contrasena</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 md:h-11 pl-10 pr-10 border border-neutral-200 rounded-xl text-sm bg-neutral-50 md:bg-white focus:bg-white focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link to="/recuperar" className="text-xs md:text-sm text-[#1B5E3C] hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 md:h-11 bg-[#1B5E3C] hover:bg-[#164D32] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Ingresar
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Inscripcion de Actores — destacado */}
      <div className="mt-6 md:mt-8 p-3 md:p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl">
        <h3 className="text-center text-xs md:text-sm font-bold text-emerald-800 mb-0.5 md:mb-1">
          Inscripcion Provincial de Actores
        </h3>
        <p className="text-center text-[10px] md:text-xs text-emerald-600 mb-3 md:mb-4">
          Registra tu empresa en el sistema de trazabilidad
        </p>
        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
          <Link
            to="/inscripcion/generador"
            className="flex flex-col items-center gap-1.5 md:gap-2 p-2 md:p-3 bg-white rounded-xl border border-emerald-200 hover:border-purple-400 hover:shadow-md transition-all group"
          >
            <div className="w-9 h-9 md:w-10 md:h-10 bg-purple-100 group-hover:bg-purple-500 rounded-xl flex items-center justify-center transition-colors">
              <Factory size={18} className="text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-[10px] md:text-xs font-semibold text-neutral-700 text-center leading-tight">Generador</span>
          </Link>
          <Link
            to="/inscripcion/transportista"
            className="flex flex-col items-center gap-1.5 md:gap-2 p-2 md:p-3 bg-white rounded-xl border border-emerald-200 hover:border-orange-400 hover:shadow-md transition-all group"
          >
            <div className="w-9 h-9 md:w-10 md:h-10 bg-orange-100 group-hover:bg-orange-500 rounded-xl flex items-center justify-center transition-colors">
              <Truck size={18} className="text-orange-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-[10px] md:text-xs font-semibold text-neutral-700 text-center leading-tight">Transportista</span>
          </Link>
          <Link
            to="/inscripcion/operador"
            className="flex flex-col items-center gap-1.5 md:gap-2 p-2 md:p-3 bg-white rounded-xl border border-emerald-200 hover:border-blue-400 hover:shadow-md transition-all group"
          >
            <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 group-hover:bg-blue-500 rounded-xl flex items-center justify-center transition-colors">
              <FlaskConical size={18} className="text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-[10px] md:text-xs font-semibold text-neutral-700 text-center leading-tight">Operador</span>
          </Link>
        </div>

        {/* Administradores Sectoriales */}
        <div className="mt-2.5 md:mt-3 pt-2.5 md:pt-3 border-t border-emerald-200">
          <p className="text-center text-[9px] md:text-[10px] text-emerald-600 mb-1.5 md:mb-2 uppercase tracking-wider font-semibold">
            Administradores Sectoriales
          </p>
          <div className="grid grid-cols-3 gap-1.5 md:gap-2">
            <Link
              to="/registro?tipo=ADMIN_GENERADOR"
              className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-2.5 bg-white rounded-xl border border-emerald-200 hover:border-purple-400 hover:shadow-md transition-all group"
            >
              <div className="w-7 h-7 md:w-8 md:h-8 bg-purple-50 group-hover:bg-purple-500 rounded-lg flex items-center justify-center transition-colors">
                <ShieldCheck size={14} className="text-purple-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-[9px] md:text-[10px] font-semibold text-neutral-600 text-center leading-tight">Admin Gen.</span>
            </Link>
            <Link
              to="/registro?tipo=ADMIN_TRANSPORTISTA"
              className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-2.5 bg-white rounded-xl border border-emerald-200 hover:border-orange-400 hover:shadow-md transition-all group"
            >
              <div className="w-7 h-7 md:w-8 md:h-8 bg-orange-50 group-hover:bg-orange-500 rounded-lg flex items-center justify-center transition-colors">
                <ShieldCheck size={14} className="text-orange-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-[9px] md:text-[10px] font-semibold text-neutral-600 text-center leading-tight">Admin Trans.</span>
            </Link>
            <Link
              to="/registro?tipo=ADMIN_OPERADOR"
              className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-2.5 bg-white rounded-xl border border-emerald-200 hover:border-blue-400 hover:shadow-md transition-all group"
            >
              <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-50 group-hover:bg-blue-500 rounded-lg flex items-center justify-center transition-colors">
                <ShieldCheck size={14} className="text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-[9px] md:text-[10px] font-semibold text-neutral-600 text-center leading-tight">Admin Oper.</span>
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-neutral-600">
        ¿Ya tenes cuenta?{' '}
        <Link to="/reclamar" className="text-[#1B5E3C] font-semibold hover:underline">
          Reclama tu cuenta
        </Link>
      </p>

      {/* Gobierno de Mendoza — pie */}
      <div className="mt-6 flex items-center justify-center gap-1.5 opacity-50">
        <img src="/escudo-mendoza-color.webp" alt="Gobierno de Mendoza" className="h-6 md:h-7 w-auto" />
        <span className="text-[10px] md:text-xs text-neutral-500" style={{ fontFamily: "'Lato', sans-serif" }}>
          <span className="font-bold">MENDOZA</span> <span className="font-light">GOBIERNO</span>
        </span>
      </div>
    </div>
    </div>
  );
};

export default LoginPage;
