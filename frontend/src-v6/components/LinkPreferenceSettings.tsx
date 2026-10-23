import { useEffect, useState } from 'react';
import { Monitor, Smartphone, Compass } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';
import api from '../services/api';
import type { LinkPreference } from '../utils/linkPreference';
import { getApiErrorMessage } from '../utils/api-error';
const choices = [
  { value: 'AUTO', title: 'Según el dispositivo', text: 'App en el teléfono o instalada; web en escritorio.', Icon: Compass },
  { value: 'WEB', title: 'Siempre web', text: 'La vista web, también al abrir desde un teléfono.', Icon: Monitor },
  { value: 'APP', title: 'Siempre app', text: 'La vista de la app, con el navegador como alternativa.', Icon: Smartphone },
] as const;
export function LinkPreferenceSettings() {
  const { currentUser } = useAuth();
  const [preference, setPreference] = useState<LinkPreference>('AUTO');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let active = true; setLoading(true);
    authService.getMe().then(user => { if (active) setPreference(user.preferenciaEnlaces || 'AUTO'); })
      .catch(() => { if (active) setError('No pudimos cargar tu preferencia. Recargá esta pantalla para reintentar.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser?.id]);
  const save = async (value: LinkPreference) => {
    if (saving || value === preference) return;
    const previous = preference;
    setPreference(value); setSaving(true); setMessage(''); setError('');
    try { await api.put('/auth/preferencia-enlaces', { preferenciaEnlaces: value }); setPreference(value); setMessage('Preferencia guardada para tu cuenta. Se usará en el próximo enlace.'); }
    catch (e) { setPreference(previous); setError(getApiErrorMessage(e, 'No se guardó el cambio. Reintentá; conservamos tu preferencia anterior.')); }
    finally { setSaving(false); }
  };
  return <section aria-label="Dónde abrir los enlaces" className="space-y-3">
    <h4 className="font-semibold text-neutral-900">Dónde abrir los enlaces</h4>
    <p className="text-sm text-neutral-600">Elegí la vista de los enlaces que recibís por correo. La campana mantiene la vista en la que estás trabajando.</p>
    <fieldset disabled={loading || saving} className="space-y-2" aria-busy={loading || saving}><legend className="sr-only">Vista preferida</legend>
      {choices.map(({ value, title, text, Icon }) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${preference === value ? 'border-primary-600 bg-primary-50' : 'border-neutral-200 bg-white'}`}>
        <input type="radio" name="link-preference" value={value} checked={preference === value} onChange={() => void save(value)} className="h-5 w-5 accent-[#1B5E3C]" />
        <Icon size={22} aria-hidden="true" className="shrink-0 text-primary-700" /><span><strong className="block text-sm">{title}</strong><span className="text-sm text-neutral-600">{text}</span></span>
      </label>)}
    </fieldset>
    {message && <p role="status" className="text-sm text-primary-800">{message}</p>}{error && <p role="alert" className="text-sm text-error-700">{error}</p>}
    <p className="text-xs text-neutral-600">Se aplica después de ingresar con tu cuenta. Instalar la app o abrirla desde un correo depende del navegador y del dispositivo; siempre podés usar los enlaces Web y App del correo.</p>
  </section>;
}
