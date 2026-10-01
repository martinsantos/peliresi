/**
 * Recovery through the mailbox already registered in SITREP.
 * Public identity data never authorizes a new email or password.
 */
import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Hash, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { SitrepMark } from '../../components/SitrepMark';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/ButtonV2';

const ReclamarCuentaPage: React.FC = () => {
  const [cuit, setCuit] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (cuit.replace(/[^0-9]/g, '').length < 8) { setError('El CUIT debe tener al menos 8 dígitos.'); return; }
    if (razonSocial.trim().length < 2) { setError('Ingresá la razón social.'); return; }
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      await authService.claimAccount({ cuit, razonSocial: razonSocial.trim() });
      setDone(true);
    } catch {
      setError('No se pudo solicitar el enlace. Intentá de nuevo.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">Revisá el correo registrado</h2>
        <p className="text-neutral-700 mb-6">
          Si los datos coinciden, recibirás un enlace en el correo ya registrado en SITREP.
          Desde ese enlace podrás elegir una nueva contraseña. Tu correo y el estado de tu cuenta no cambian.
        </p>
        <p className="text-sm text-neutral-600 mb-6">Si no tenés acceso a ese correo, contactá al administrador.</p>
        <Link to="/login" className="inline-flex items-center gap-2 bg-[#1B5E3C] text-white hover:text-white focus:text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#164D32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700">
          Ir al login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 mb-6">
        <ArrowLeft size={16} /> Volver al login
      </Link>
      <div className="text-center mb-6">
        <SitrepMark size={56} className="mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-neutral-900">Recuperar acceso a tu cuenta</h2>
        <p className="text-sm text-neutral-700 mt-2">
          Identificá tu empresa. El enlace se enviará únicamente al correo ya registrado en SITREP.
        </p>
      </div>
      {error && <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
        <AlertCircle size={16} className="shrink-0" />{error}
      </div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="CUIT *" required value={cuit} onChange={event => setCuit(event.target.value)} autoComplete="off"
          leftIcon={<Hash size={16} />} placeholder="Con o sin guiones" />
        <Input label="Razón social *" required value={razonSocial} onChange={event => setRazonSocial(event.target.value)}
          autoComplete="organization" leftIcon={<Building2 size={16} />} placeholder="Nombre de tu empresa" />
        <Button type="submit" fullWidth isLoading={loading}>Enviar enlace al correo registrado</Button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        Si no tenés acceso al correo registrado o nunca se cargó uno válido, contactá al administrador.
        Este formulario no modifica el correo de la cuenta.
      </p>
    </div>
  );
};

export default ReclamarCuentaPage;
