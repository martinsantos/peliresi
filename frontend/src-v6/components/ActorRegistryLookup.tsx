import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from './ui/ButtonV2';
import api, { getAccessToken } from '../services/api';
import { registrationSessionOwner } from '../services/registrationSession';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { getApiErrorMessage } from '../utils/api-error';

export function ActorRegistryLookup({ type, cuit }: { type: 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA'; cuit: string }) {
  const navigate = useNavigate(), mp = useMobilePrefix();
  const [found, setFound] = useState<{ id: string; razonSocial: string; cuit: string } | null>(null);
  const [checking, setChecking] = useState(false), [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0), querying = useRef(false);
  const digits = cuit.replace(/\D/g, '');
  useEffect(() => { generation.current++; setFound(null); setNotice(null); }, [digits, type]);
  useEffect(() => {
    const clear = () => { generation.current++; setFound(null); setNotice(null); };
    window.addEventListener('storage', clear); return () => window.removeEventListener('storage', clear);
  }, []);
  const plural = type === 'GENERADOR' ? 'generadores' : type === 'OPERADOR' ? 'operadores' : 'transportistas';
  const lookup = async () => {
    if (querying.current) return;
    querying.current = true; setChecking(true); setNotice(null);
    const request = generation.current, owner = registrationSessionOwner(getAccessToken());
    try {
      if (!owner) throw new Error('Iniciá sesión para consultar el padrón.');
      const normalized = `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
      const response = await api.get(`/actores/${plural}`, { params: { search: normalized, limit: 20 } });
      if (generation.current !== request || registrationSessionOwner(getAccessToken()) !== owner) return;
      const entries = response.data.data[plural] || [];
      const exact = entries.find((actor: { cuit: string }) => String(actor.cuit).replace(/\D/g, '') === digits);
      setFound(exact ? { id: exact.id, razonSocial: exact.razonSocial, cuit: exact.cuit } : null);
      if (!exact) setNotice('No hay una ficha de esta categoría con ese CUIT en SITREP. Podés continuar el alta.');
    } catch (error) { setNotice(getApiErrorMessage(error, 'No se pudo consultar el padrón. Los campos siguen en pantalla.')); }
    finally { querying.current = false; setChecking(false); }
  };
  if (digits.length !== 11) return null;
  return <div className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-neutral-700">¿Ya estaba registrado? Recuperá su ficha para no duplicar el alta.</p><Button variant="outline" isLoading={checking} leftIcon={<Search size={16} />} onClick={() => void lookup()}>Buscar en padrón</Button></div>
    {found && <div role="status" className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-neutral-900">{found.razonSocial} · {found.cuit}</p><Button onClick={() => navigate(mp(`/admin/actores/${plural}/${found.id}/editar`))}>Usar ficha existente</Button></div>}
    {notice && <p role="status" className="text-neutral-700">{notice}</p>}
  </div>;
}
