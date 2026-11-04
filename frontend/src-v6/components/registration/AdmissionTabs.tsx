import { Link, useLocation } from 'react-router-dom';
import { useAdmissionContext } from '../../hooks/useAdmissionContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { applicationReturn } from '../../utils/admissionReview';

export function AdmissionTabs({ active }: { active: 'solicitudes' | 'renovaciones' }) {
  const { role, owner } = useAdmissionContext(), location = useLocation(), mp = useMobilePrefix();
  if (!['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'].includes(role)) return null;
  const saved = location.state?.admissionSectionReturn;
  return <nav aria-label="Tipo de solicitud" className="flex gap-4 border-b border-neutral-200">
    {(['solicitudes', 'renovaciones'] as const).map(section => <Link key={section} aria-current={active === section ? 'page' : undefined}
      to={active === section ? location.pathname + location.search : applicationReturn({ admissionReturn: saved }, mp('/admin/' + section), owner)}
      state={{ admissionSectionReturn: { owner, path: location.pathname + location.search } }}
      className={'flex min-h-11 items-center border-b-2 px-1 text-sm font-semibold ' + (active === section ? 'border-primary-700 text-primary-800' : 'border-transparent text-neutral-600 hover:text-primary-800')}>
      {section === 'solicitudes' ? 'Inscripciones' : 'Renovaciones'}
    </Link>)}
  </nav>;
}
