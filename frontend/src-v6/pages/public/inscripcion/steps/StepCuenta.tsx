/**
 * Step Cuenta — Phase 1 account creation form
 */
import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Factory, FlaskConical, Truck, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '../../../../components/ui/ButtonV2';
import axios from 'axios';
import {
  type RegistrationData,
  type TipoActor,
  validateCuit,
  validatePassword,
  inputCls,
  labelCls,
} from '../shared';
import { FieldError } from '../FieldError';
import { getApiErrorMessage } from '../../../../utils/api-error';
import { setTokensDurably } from '../../../../services/api';
import { RegisteredAccount } from '../RegisteredAccount';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface StepCuentaProps {
  tipoActor: TipoActor;
  isGenerador: boolean;
  isOperador: boolean;
  isTransportista: boolean;
  reg: RegistrationData;
  onRegChange: (field: string, value: string) => void;
  onPhase2: (solicitudId: string) => void;
}

export const StepCuenta: React.FC<StepCuentaProps> = ({
  tipoActor,
  isGenerador,
  isOperador,
  reg,
  onRegChange,
  onPhase2,
}) => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regAttempted, setRegAttempted] = useState(false);
  const registrationInFlight = useRef(false);

  const regErrors = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!reg.nombre.trim()) e.nombre = 'Nombre es obligatorio';
    if (!reg.email.trim()) e.email = 'Email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) e.email = 'Email invalido';
    if (!reg.cuit.trim()) e.cuit = 'CUIT es obligatorio';
    else if (!validateCuit(reg.cuit)) e.cuit = 'CUIT debe tener 11 digitos';
    if (!reg.password) e.password = 'La contraseña es obligatoria';
    else {
      const pw = validatePassword(reg.password);
      if (!pw.valid) e.password = pw.errors.join(', ');
    }
    if (reg.password !== reg.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
    return e;
  }, [reg]);

  const handleRegistration = async () => {
    if (registrationInFlight.current) return;
    setRegAttempted(true);
    const errors = regErrors();
    if (Object.keys(errors).length > 0) {
      const field = { nombre: 'name', email: 'email', cuit: 'cuit', password: 'password', confirmPassword: 'confirm' }[Object.keys(errors)[0] as keyof RegistrationData];
      document.getElementById(`registration-${field}`)?.focus(); return;
    }

    registrationInFlight.current = true;
    setRegSubmitting(true);
    setRegError(null);
    try {
      const res = await axios.post(`${API_BASE}/solicitudes/iniciar`, {
        nombre: reg.nombre,
        email: reg.email,
        password: reg.password,
        cuit: reg.cuit.replace(/\D/g, ''),
        tipoActor,
      });
      const data = res.data?.data || res.data;
      const solId = data.solicitudId || data.id;

      if (!solId || !data.tokens?.accessToken || !data.tokens?.refreshToken) {
        throw new Error('La solicitud se creó, pero no se recibió una sesión para completar el formulario. Iniciá sesión para recuperarla.');
      }
      await setTokensDurably(data.tokens.accessToken, data.tokens.refreshToken);
      try { localStorage.setItem('sitrep_pending_solicitud', JSON.stringify({ id: solId, tipoActor })); } catch { /* the server-owned session hint also recovers the draft */ }

      onPhase2(solId);
    } catch (err: unknown) {
      setRegError(getApiErrorMessage(err, 'Error al crear la cuenta'));
    } finally {
      registrationInFlight.current = false;
      setRegSubmitting(false);
    }
  };

  const rErr = regAttempted ? regErrors() : {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${isGenerador ? 'bg-purple-100' : isOperador ? 'bg-blue-100' : 'bg-orange-100'}`}>
            {isGenerador
              ? <Factory size={28} className="text-purple-600" />
              : isOperador ? <FlaskConical size={28} className="text-blue-600" />
              : <Truck size={28} className="text-orange-600" />
            }
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Inscripcion como {isGenerador ? 'Generador' : isOperador ? 'Operador' : 'Transportista'}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Registro Provincial de {isGenerador ? 'Generadores' : isOperador ? 'Operadores' : 'Transportistas'} de RRPP - Ley 5917
          </p>
        </div>

        {/* Registration Form */}
        <RegisteredAccount type={tipoActor}>
        <form noValidate onSubmit={event => { event.preventDefault(); void handleRegistration(); }} className="bg-white rounded-2xl border border-neutral-200 shadow-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-neutral-800">Crear cuenta</h3>

          <div>
            <label htmlFor="registration-name" className={labelCls}>Nombre completo *</label>
            <input
              id="registration-name" autoComplete="name"
              aria-invalid={Boolean(rErr.nombre)} aria-describedby={rErr.nombre ? 'registration-name-error' : undefined}
              type="text" value={reg.nombre}
              onChange={e => onRegChange('nombre', e.target.value)}
              placeholder="Juan Perez"
              className={inputCls(!!rErr.nombre)}
            />
            <FieldError id="registration-name-error" show={!!rErr.nombre} msg={rErr.nombre || ''} />
          </div>

          <div>
            <label htmlFor="registration-email" className={labelCls}>Email *</label>
            <input
              id="registration-email" autoComplete="email" inputMode="email"
              aria-invalid={Boolean(rErr.email)} aria-describedby={rErr.email ? 'registration-email-error' : undefined}
              type="email" value={reg.email}
              onChange={e => onRegChange('email', e.target.value)}
              placeholder="correo@empresa.com"
              className={inputCls(!!rErr.email)}
            />
            <FieldError id="registration-email-error" show={!!rErr.email} msg={rErr.email || ''} />
          </div>

          <div>
            <label htmlFor="registration-cuit" className={labelCls}>CUIT *</label>
            <input
              id="registration-cuit" inputMode="numeric"
              aria-invalid={Boolean(rErr.cuit)} aria-describedby={rErr.cuit ? 'registration-cuit-error' : undefined}
              type="text" value={reg.cuit}
              onChange={e => onRegChange('cuit', e.target.value)}
              placeholder="30-12345678-9"
              className={inputCls(!!rErr.cuit)}
            />
            <FieldError id="registration-cuit-error" show={!!rErr.cuit} msg={rErr.cuit || ''} />
          </div>

          <div>
            <label htmlFor="registration-password" className={labelCls}>Contraseña *</label>
            <div className="relative">
              <input
                id="registration-password" autoComplete="new-password"
                aria-invalid={Boolean(rErr.password)} aria-describedby={rErr.password ? 'registration-password-error' : undefined}
                type={showPassword ? 'text' : 'password'}
                value={reg.password}
                onChange={e => onRegChange('password', e.target.value)}
                placeholder="Mínimo 8 caracteres, una mayúscula y un número"
                className={`${inputCls(!!rErr.password)} pr-14`}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword}
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <FieldError id="registration-password-error" show={!!rErr.password} msg={rErr.password || ''} />
          </div>

          <div>
            <label htmlFor="registration-confirm" className={labelCls}>Confirmar contraseña *</label>
            <input
              id="registration-confirm" autoComplete="new-password"
              aria-invalid={Boolean(rErr.confirmPassword)} aria-describedby={rErr.confirmPassword ? 'registration-confirm-error' : undefined}
              type="password"
              value={reg.confirmPassword}
              onChange={e => onRegChange('confirmPassword', e.target.value)}
              placeholder="Repetí la contraseña"
              className={inputCls(!!rErr.confirmPassword)}
            />
            <FieldError id="registration-confirm-error" show={!!rErr.confirmPassword} msg={rErr.confirmPassword || ''} />
          </div>

          {regError && (
            <div role="alert" className="bg-error-50 border border-error-200 rounded-xl p-3 text-sm text-error-800">
              {regError}
            </div>
          )}

          <Button
            variant="primary" fullWidth
            isLoading={regSubmitting}
            type="submit"
            rightIcon={<ArrowRight size={16} />}
          >
            Crear cuenta y continuar
          </Button>

          <p className="text-sm text-neutral-700 text-center mt-2">
            ¿Ya estabas en el padrón o tenés un borrador?{' '}
            <button type="button" onClick={() => navigate('/login', { state: { from: `/inscripcion/${tipoActor.toLowerCase()}` } })} className="min-h-11 text-primary-800 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2">
              Iniciá sesión para recuperar tus datos
            </button>
          </p>
          <p className="text-sm text-neutral-700 text-center"><button type="button" className="min-h-11 font-medium text-primary-800 hover:underline" onClick={() => navigate('/reclamar')}>Recuperar acceso al correo ya registrado</button></p>
        </form>
        </RegisteredAccount>
      </div>
    </div>
  );
};
