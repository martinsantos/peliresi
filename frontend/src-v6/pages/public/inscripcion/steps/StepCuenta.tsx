import { identityCuit } from '../../../../utils/identityCuit';
/**
 * Step Cuenta — Phase 1 account creation form
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Eye, EyeOff,
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
  const attemptVersion = useRef(0);
  useEffect(() => {
    registrationInFlight.current = false;
    setRegSubmitting(false); setRegError(null); setRegAttempted(false); setRecovery(null);
    return () => { attemptVersion.current++; };
  }, [tipoActor]);
  const [recovery, setRecovery] = useState<'uncertain' | 'session' | null>(null);
  const recoveryHeading = useRef<HTMLHeadingElement>(null);
  const focusRetry = useRef(false);
  useEffect(() => {
    if (recovery) recoveryHeading.current?.focus();
    else if (focusRetry.current) { focusRetry.current = false; document.getElementById('registration-email')?.focus(); }
  }, [recovery]);
  const recoverAccount = () => navigate('/login', { state: { from: `/inscripcion/${tipoActor.toLowerCase()}` } });

  const regErrors = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!reg.nombre.trim()) e.nombre = 'Nombre es obligatorio';
    if (!reg.email.trim()) e.email = 'Email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email.trim())) e.email = 'Email invalido';
    if (!reg.cuit.trim()) e.cuit = 'CUIT es obligatorio';
    else if (!validateCuit(reg.cuit)) e.cuit = 'CUIT debe tener 11 digitos';
    else if(import.meta.env.VITE_ENTERPRISE_ENABLED==='true'&&!identityCuit(reg.cuit)) e.cuit='Revisá el prefijo y el dígito verificador del CUIT';
    if (!reg.password) e.password = 'La contraseña es obligatoria';
    else {
      const pw = validatePassword(reg.password);
      if (!pw.valid) e.password = pw.errors.join(', ');
    }
    if (reg.password !== reg.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
    return e;
  }, [reg]);

  const handleRegistration = async () => {
    if (registrationInFlight.current || recovery) return;
    setRegAttempted(true);
    const errors = regErrors();
    if (Object.keys(errors).length > 0) {
      const field = { nombre: 'name', email: 'email', cuit: 'cuit', password: 'password', confirmPassword: 'confirm' }[Object.keys(errors)[0] as keyof RegistrationData];
      document.getElementById(`registration-${field}`)?.focus(); return;
    }

    const attempt = ++attemptVersion.current;
    registrationInFlight.current = true;
    setRegSubmitting(true);
    setRegError(null);
    let confirmedReference = false;
    try {
      const res = await axios.post(`${API_BASE}/solicitudes/iniciar`, {
        nombre: reg.nombre,
        email: reg.email.trim().toLowerCase(),
        password: reg.password,
        cuit: reg.cuit.replace(/\D/g, ''),
        tipoActor,
      });
      if (attempt !== attemptVersion.current) return;
      const data = res.data?.data || res.data;
      const solId = data?.solicitudId || data?.id;
      confirmedReference = typeof solId === 'string' && solId.length > 0;

      if (!confirmedReference || !data?.tokens?.accessToken || !data?.tokens?.refreshToken) {
        throw new Error('La solicitud se creó, pero no se recibió una sesión para completar el formulario. Iniciá sesión para recuperarla.');
      }
      await setTokensDurably(data.tokens.accessToken, data.tokens.refreshToken);
      if (attempt !== attemptVersion.current) return;
      try { localStorage.setItem('sitrep_pending_solicitud', JSON.stringify({ id: solId, tipoActor })); } catch { /* the server-owned session hint also recovers the draft */ }

      onPhase2(solId);
    } catch (err: unknown) {
      if (attempt !== attemptVersion.current) return;
      const status = err && typeof err === 'object' ? (err as { response?: { status?: number } }).response?.status : undefined;
      if (confirmedReference) setRecovery('session');
      else if (typeof status !== 'number' || status >= 500 || status === 408) setRecovery('uncertain');
      else setRegError(getApiErrorMessage(err, 'No se pudo crear la cuenta. Revisá los datos antes de intentar nuevamente.'));
    } finally {
      if (attempt === attemptVersion.current) { registrationInFlight.current = false; setRegSubmitting(false); }
    }
  };

  const rErr = regAttempted ? regErrors() : {};

  return (
    <div className="w-full max-w-lg space-y-4">
      <Button variant="outline" disabled={regSubmitting} leftIcon={<ArrowLeft size={16}/>} onClick={() => navigate('/login')}>Volver al acceso</Button>
      <div>
        {/* Registration Form */}
        <RegisteredAccount type={tipoActor}>
        <form noValidate onSubmit={event => { event.preventDefault(); void handleRegistration(); }} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 sm:p-6 space-y-4">
          {!recovery && <h2 className="text-lg font-semibold text-neutral-800">Crear cuenta</h2>}
          <fieldset hidden={Boolean(recovery)} disabled={regSubmitting || Boolean(recovery)} className="min-w-0 space-y-4">

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

          </fieldset>

          {regError && (
            <div role="alert" className="bg-error-50 border border-error-200 rounded-xl p-3 text-sm text-error-800">
              {regError}
            </div>
          )}

          {recovery && <section role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <h2 ref={recoveryHeading} tabIndex={-1} className="font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-700">{recovery === 'session' ? 'Recuperá el acceso al alta' : 'No pudimos confirmar el alta'}</h2>
            <p className="break-all text-neutral-700">{reg.email.trim()}</p>
            <p>{recovery === 'session' ? 'Recibimos la referencia del alta, pero no pudimos conservar la sesión. Ingresá con el correo y la contraseña que usaste para continuar.' : 'La cuenta puede haberse creado aunque no haya llegado la confirmación. Ingresá con el correo y la contraseña que acabás de usar para comprobarlo y recuperar tu solicitud.'}</p>
            <Button fullWidth onClick={recoverAccount} rightIcon={<ArrowRight size={16}/>}>Ingresar y recuperar alta</Button>
            {recovery === 'uncertain' && <><p>Si el alta no llegó a registrarse, podés revisar los datos antes de intentar otra vez. No se reenvía automáticamente.</p><Button variant="outline" fullWidth onClick={()=>{focusRetry.current=true;setRecovery(null);setRegError(null);}}>Revisar datos y reintentar</Button></>}
          </section>}

          {!recovery && <Button
            variant="primary" fullWidth
            isLoading={regSubmitting}
            type="submit"
            rightIcon={<ArrowRight size={16} />}
          >
            Crear cuenta y continuar
          </Button>}

          {!recovery && <><p className="text-sm text-neutral-700 text-center mt-2">
            ¿Ya estabas en el padrón o tenés un borrador?{' '}
            <button type="button" disabled={regSubmitting} onClick={recoverAccount} className="min-h-11 text-primary-800 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2">
              Iniciá sesión para recuperar tus datos
            </button>
          </p>
          <p className="text-sm text-neutral-700 text-center"><button type="button" className="min-h-11 font-medium text-primary-800 hover:underline" disabled={regSubmitting} onClick={() => navigate('/reclamar')}>Recuperar acceso al correo ya registrado</button></p></>}
        </form>
        </RegisteredAccount>
      </div>
    </div>
  );
};
