/**
 * SITREP - Página de Registro público
 */
import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Leaf, ArrowLeft, User, Mail, Lock, Phone, Building2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/auth.service';

type RolType = 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'ADMIN_TRANSPORTISTA' | 'ADMIN_GENERADOR' | 'ADMIN_OPERADOR';

const ROLES: { value: RolType; label: string; desc: string; group: string }[] = [
  { value: 'GENERADOR',           label: 'Generador',                 desc: 'Empresa generadora de residuos peligrosos',       group: 'Usuarios' },
  { value: 'TRANSPORTISTA',       label: 'Transportista',             desc: 'Empresa transportista habilitada',                group: 'Usuarios' },
  { value: 'OPERADOR',            label: 'Operador',                  desc: 'Planta de tratamiento y disposición final',       group: 'Usuarios' },
  { value: 'ADMIN_GENERADOR',     label: 'Admin de Generadores',      desc: 'Gestión del grupo de generadores',                group: 'Administradores de grupo' },
  { value: 'ADMIN_TRANSPORTISTA', label: 'Admin de Transportistas',   desc: 'Gestión del grupo de transportistas',             group: 'Administradores de grupo' },
  { value: 'ADMIN_OPERADOR',      label: 'Admin de Operadores',       desc: 'Gestión del grupo de operadores',                 group: 'Administradores de grupo' },
];

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { ok: password.length >= 8, label: 'Al menos 8 caracteres' },
    { ok: /[A-Z]/.test(password), label: 'Una mayúscula' },
    { ok: /[0-9]/.test(password), label: 'Un número' },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['bg-neutral-200', 'bg-red-400', 'bg-yellow-400', 'bg-green-500'];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1 h-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className={`flex-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-neutral-200'}`} />
        ))}
      </div>
      <div className="flex gap-4">
        {checks.map(({ ok, label }) => (
          <span key={label} className={`text-xs flex items-center gap-1 ${ok ? 'text-green-600' : 'text-neutral-400'}`}>
            <CheckCircle2 size={10} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

const RegistroPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [rol, setRol] = useState<RolType>((params.get('tipo') as RolType) || 'GENERADOR');
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '', cuit: '', telefono: '', empresa: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.register({ ...form, rol });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al registrarse. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-md text-center animate-fade-in-up">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">¡Revisá tu email!</h2>
        <p className="text-neutral-600 mb-6">
          Te enviamos un email de verificación. Hacé clic en el enlace para activar tu cuenta.
          Luego, el administrador deberá aprobar tu acceso.
        </p>
        <Link to="/login" className="inline-flex items-center gap-2 bg-[#1B5E3C] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#164D32] transition-colors">
          Ir al login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in-up">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 mb-6">
        <ArrowLeft size={16} /> Volver
      </Link>

      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-[#1B5E3C] rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Leaf size={26} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">Crear cuenta en SITREP</h2>
        <p className="text-sm text-neutral-500 mt-1">Una vez registrado, verificá tu email y aguardá la aprobación</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tipo de cuenta */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Tipo de cuenta</label>
          <select
            value={rol}
            onChange={e => setRol(e.target.value as RolType)}
            className="w-full h-11 px-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none"
          >
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nombre *</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input required value={form.nombre} onChange={set('nombre')} placeholder="Juan" className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Apellido</label>
            <input value={form.apellido} onChange={set('apellido')} placeholder="Pérez" className="w-full h-11 px-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email *</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input required type="email" value={form.email} onChange={set('email')} placeholder="tu@email.com" className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Contraseña *</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input required type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Mín. 8 caracteres" className="w-full h-11 pl-9 pr-10 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none" />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.password && <PasswordStrength password={form.password} />}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">CUIT</label>
            <input value={form.cuit} onChange={set('cuit')} placeholder="20-12345678-9" className="w-full h-11 px-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Teléfono</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={form.telefono} onChange={set('telefono')} placeholder="+54 261 ..." className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Empresa / Organización</label>
          <div className="relative">
            <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input value={form.empresa} onChange={set('empresa')} placeholder="Razón social" className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-[#1B5E3C] hover:bg-[#164D32] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Crear cuenta'}
        </button>

        <p className="text-center text-sm text-neutral-600">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-[#1B5E3C] font-semibold hover:underline">Ingresar</Link>
        </p>
      </form>
    </div>
  );
};

export default RegistroPage;
