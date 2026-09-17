/**
 * Step Cuenta — Phase 1 account creation form
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
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

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void; 'error-callback'?: () => void }) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

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
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !captchaRef.current) return undefined;
    const render = () => {
      if (!captchaRef.current || !window.turnstile || captchaWidgetId.current) return;
      captchaWidgetId.current = window.turnstile.render(captchaRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      });
    };
    if (window.turnstile) render();
    else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => {
      captchaWidgetId.current = null;
      setCaptchaToken('');
    };
  }, []);

  const regErrors = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!reg.nombre.trim()) e.nombre = 'El nombre es obligatorio';
    if (!reg.email.trim()) e.email = 'El correo electrónico es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) e.email = 'El correo electrónico no es válido';
    if (!reg.cuit.trim()) e.cuit = 'El CUIT es obligatorio';
    else if (!validateCuit(reg.cuit)) e.cuit = 'El CUIT debe tener 11 dígitos';
    if (!reg.password) e.password = 'La contraseña es obligatoria';
    else {
      const pw = validatePassword(reg.password);
      if (!pw.valid) e.password = pw.errors.join(', ');
    }
    if (reg.password !== reg.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
    if (TURNSTILE_SITE_KEY && !captchaToken) e.captcha = 'Verificá que sos una persona';
    return e;
  }, [reg, captchaToken]);

  const handleRegistration = async () => {
    setRegAttempted(true);
    const errors = regErrors();
    if (Object.keys(errors).length > 0) return;

    setRegSubmitting(true);
    setRegError(null);
    try {
      const res = await axios.post(`${API_BASE}/solicitudes/iniciar`, {
        nombre: reg.nombre,
        email: reg.email,
        password: reg.password,
        cuit: reg.cuit.replace(/\D/g, ''),
        tipoActor,
        captchaToken: captchaToken || undefined,
      });
      const data = res.data?.data || res.data;
      const solId = data.solicitudId || data.id;

      // If the response includes a token, store it for Phase 2 API calls
      const accessToken = data.tokens?.accessToken || data.accessToken || data.token;
      const refreshToken = data.tokens?.refreshToken || data.refreshToken;
      if (accessToken) {
        localStorage.setItem('sitrep_access_token', accessToken);
      }
      if (refreshToken) {
        localStorage.setItem('sitrep_refresh_token', refreshToken);
      }
      if (solId) {
        // Keep the restricted draft session and its solicitud id across a
        // refresh.  The API only exposes the draft, never full application
        // data, until the account is verified and approved.
        localStorage.setItem('sitrep_restricted_session', '1');
        localStorage.setItem('sitrep_solicitud_id', solId);
        localStorage.setItem('sitrep_pending_solicitud', JSON.stringify({ id: solId, tipoActor }));
      }

      onPhase2(solId);
    } catch (err: unknown) {
      setRegError(getApiErrorMessage(err, 'Error al crear la cuenta'));
    } finally {
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
            Inscripción como {isGenerador ? 'Generador' : isOperador ? 'Operador' : 'Transportista'}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Registro Provincial de {isGenerador ? 'Generadores' : isOperador ? 'Operadores' : 'Transportistas'} de RRPP - Ley 5917
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-neutral-800">Paso 1: Crear cuenta</h3>

          <div>
            <label htmlFor="registration-name" className={labelCls}>Nombre completo *</label>
            <input
              id="registration-name"
              type="text" value={reg.nombre}
              autoComplete="name"
              onChange={e => onRegChange('nombre', e.target.value)}
              placeholder="Juan Pérez"
              aria-invalid={!!rErr.nombre}
              aria-describedby={rErr.nombre ? 'registration-name-error' : undefined}
              className={inputCls(!!rErr.nombre)}
            />
            <FieldError id="registration-name-error" show={!!rErr.nombre} msg={rErr.nombre || ''} />
          </div>

          <div>
            <label htmlFor="registration-email" className={labelCls}>Correo electrónico *</label>
            <input
              id="registration-email"
              type="email" value={reg.email}
              autoComplete="email"
              inputMode="email"
              onChange={e => onRegChange('email', e.target.value)}
              placeholder="correo@empresa.com"
              aria-invalid={!!rErr.email}
              aria-describedby={rErr.email ? 'registration-email-error' : undefined}
              className={inputCls(!!rErr.email)}
            />
            <FieldError id="registration-email-error" show={!!rErr.email} msg={rErr.email || ''} />
          </div>

          <div>
            <label htmlFor="registration-cuit" className={labelCls}>CUIT *</label>
            <input
              id="registration-cuit"
              type="text" value={reg.cuit}
              autoComplete="username"
              inputMode="numeric"
              onChange={e => onRegChange('cuit', e.target.value)}
              placeholder="30-12345678-9"
              aria-invalid={!!rErr.cuit}
              aria-describedby={rErr.cuit ? 'registration-cuit-error' : undefined}
              className={inputCls(!!rErr.cuit)}
            />
            <FieldError id="registration-cuit-error" show={!!rErr.cuit} msg={rErr.cuit || ''} />
          </div>

          <div>
            <label htmlFor="registration-password" className={labelCls}>Contraseña *</label>
            <div className="relative">
              <input
                id="registration-password"
                type={showPassword ? 'text' : 'password'}
                value={reg.password}
                autoComplete="new-password"
                onChange={e => onRegChange('password', e.target.value)}
                placeholder="Mínimo 8 caracteres, 1 mayúscula y 1 número"
                aria-invalid={!!rErr.password}
                aria-describedby={rErr.password ? 'registration-password-error' : undefined}
                className={inputCls(!!rErr.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            <FieldError id="registration-password-error" show={!!rErr.password} msg={rErr.password || ''} />
          </div>

          <div>
            <label htmlFor="registration-confirm-password" className={labelCls}>Confirmar contraseña *</label>
            <input
              id="registration-confirm-password"
              type="password"
              value={reg.confirmPassword}
              autoComplete="new-password"
              onChange={e => onRegChange('confirmPassword', e.target.value)}
              placeholder="Repetir contraseña"
              aria-invalid={!!rErr.confirmPassword}
              aria-describedby={rErr.confirmPassword ? 'registration-confirm-password-error' : undefined}
              className={inputCls(!!rErr.confirmPassword)}
            />
            <FieldError id="registration-confirm-password-error" show={!!rErr.confirmPassword} msg={rErr.confirmPassword || ''} />
          </div>

          {TURNSTILE_SITE_KEY && (
            <div>
              <div ref={captchaRef} aria-label="Verificación de seguridad" />
              <FieldError show={!!rErr.captcha} msg={rErr.captcha || ''} />
            </div>
          )}

          {regError && (
            <div className="bg-error-50 border border-error-200 rounded-xl p-3 text-sm text-error-700">
              {regError}
            </div>
          )}

          <Button
            variant="primary" fullWidth
            isLoading={regSubmitting}
            onClick={handleRegistration}
            rightIcon={<ArrowRight size={16} />}
          >
            Crear cuenta y continuar
          </Button>

          <p className="text-xs text-neutral-400 text-center mt-2">
            ¿Ya tenés cuenta?{' '}
            <button type="button" onClick={() => navigate('/login')} className="text-[#0D8A4F] font-medium hover:underline">
              Iniciá sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
