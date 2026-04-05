/**
 * Step Cuenta — Phase 1 account creation form
 */
import React, { useState, useCallback } from 'react';
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

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface StepCuentaProps {
  tipoActor: TipoActor;
  isGenerador: boolean;
  isOperador: boolean;
  isTransportista: boolean;
  reg: RegistrationData;
  onRegChange: (field: string, value: string) => void;
  onPhase2: (solicitudId: string) => void;
  /** Allow skipping to wizard (dev mode) */
  onSkip: () => void;
}

export const StepCuenta: React.FC<StepCuentaProps> = ({
  tipoActor,
  isGenerador,
  isOperador,
  isTransportista,
  reg,
  onRegChange,
  onPhase2,
  onSkip,
}) => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regAttempted, setRegAttempted] = useState(false);

  const regErrors = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!reg.nombre.trim()) e.nombre = 'Nombre es obligatorio';
    if (!reg.email.trim()) e.email = 'Email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) e.email = 'Email invalido';
    if (!reg.cuit.trim()) e.cuit = 'CUIT es obligatorio';
    else if (!validateCuit(reg.cuit)) e.cuit = 'CUIT debe tener 11 digitos';
    if (!reg.password) e.password = 'Password es obligatorio';
    else {
      const pw = validatePassword(reg.password);
      if (!pw.valid) e.password = pw.errors.join(', ');
    }
    if (reg.password !== reg.confirmPassword) e.confirmPassword = 'Las passwords no coinciden';
    return e;
  }, [reg]);

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
      });
      const data = res.data?.data || res.data;
      const solId = data.solicitudId || data.id;

      // If the response includes a token, store it for Phase 2 API calls
      if (data.token) {
        localStorage.setItem('sitrep_access_token', data.token);
      }
      if (data.refreshToken) {
        localStorage.setItem('sitrep_refresh_token', data.refreshToken);
      }

      onPhase2(solId);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al crear la cuenta';
      setRegError(msg);
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
            Inscripcion como {isGenerador ? 'Generador' : isOperador ? 'Operador' : 'Transportista'}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Registro Provincial de {isGenerador ? 'Generadores' : isOperador ? 'Operadores' : 'Transportistas'} de RRPP - Ley 5917
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-neutral-800">Paso 1: Crear cuenta</h3>

          <div>
            <label className={labelCls}>Nombre completo *</label>
            <input
              type="text" value={reg.nombre}
              onChange={e => onRegChange('nombre', e.target.value)}
              placeholder="Juan Perez"
              className={inputCls(!!rErr.nombre)}
            />
            <FieldError show={!!rErr.nombre} msg={rErr.nombre || ''} />
          </div>

          <div>
            <label className={labelCls}>Email *</label>
            <input
              type="email" value={reg.email}
              onChange={e => onRegChange('email', e.target.value)}
              placeholder="correo@empresa.com"
              className={inputCls(!!rErr.email)}
            />
            <FieldError show={!!rErr.email} msg={rErr.email || ''} />
          </div>

          <div>
            <label className={labelCls}>CUIT *</label>
            <input
              type="text" value={reg.cuit}
              onChange={e => onRegChange('cuit', e.target.value)}
              placeholder="30-12345678-9"
              className={inputCls(!!rErr.cuit)}
            />
            <FieldError show={!!rErr.cuit} msg={rErr.cuit || ''} />
          </div>

          <div>
            <label className={labelCls}>Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={reg.password}
                onChange={e => onRegChange('password', e.target.value)}
                placeholder="Min 8 chars, 1 mayuscula, 1 numero"
                className={inputCls(!!rErr.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <FieldError show={!!rErr.password} msg={rErr.password || ''} />
          </div>

          <div>
            <label className={labelCls}>Confirmar password *</label>
            <input
              type="password"
              value={reg.confirmPassword}
              onChange={e => onRegChange('confirmPassword', e.target.value)}
              placeholder="Repetir password"
              className={inputCls(!!rErr.confirmPassword)}
            />
            <FieldError show={!!rErr.confirmPassword} msg={rErr.confirmPassword || ''} />
          </div>

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

          <button
            onClick={onSkip}
            className="w-full mt-2 py-2 text-sm text-neutral-400 hover:text-[#0D8A4F] transition-colors"
          >
            Saltar al formulario (modo prueba) &rarr;
          </button>

          <p className="text-xs text-neutral-400 text-center mt-2">
            Ya tenes cuenta?{' '}
            <button onClick={() => navigate('/login')} className="text-[#0D8A4F] font-medium hover:underline">
              Inicia sesion
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
