/** Role-specific introduction, also available from contextual help. */
import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Users, FileText, CheckCircle2, Truck, Bell, Award, LifeBuoy } from 'lucide-react';
import { SitrepMark } from './SitrepMark';
import { Modal } from './ui/Modal';
import { Button } from './ui/ButtonV2';
import { ROLE_GUIDANCE, presentationRole } from '../utils/roleGuidance';
import type { UserRole } from '../contexts/AuthContext';
const icons = { actors: Users, manifest: FileText, approve: CheckCircle2, trip: Truck, notice: Bell, certificate: Award, help: LifeBuoy };
interface Props { rol: UserRole; esInspector?: boolean; userId: string | number; onDismiss: () => void }
export default function OnboardingWizard({ rol, esInspector = false, userId, onDismiss }: Props) {
  const role = presentationRole(rol, esInspector);
  const steps = ROLE_GUIDANCE[role] || ROLE_GUIDANCE.AUDITOR;
  const [current, setCurrent] = useState(0);
  const step = steps[Math.min(current, steps.length - 1)], Icon = icons[step.icon];
  const finish = () => {
    localStorage.setItem(`sitrep_onboarding_${userId}`, 'done');
    localStorage.removeItem('sitrep_post_reset');
    onDismiss();
  };
  return <Modal isOpen onClose={finish} title="Bienvenido a SITREP" size="sm">
    <div className="mb-5 flex items-center gap-2 border-b border-neutral-100 pb-4"><SitrepMark size={32}/><span className="font-bold text-primary-800">SITREP</span><span className="ml-auto text-sm text-neutral-600">Paso {current + 1} de {steps.length}</span></div>
    <div className="space-y-3"><Icon size={30} className="text-primary-700" aria-hidden="true" /><h3 className="text-xl font-semibold leading-tight text-neutral-900">{step.title}</h3><p className="text-sm leading-relaxed text-neutral-600">{step.desc}</p></div>
    <div className="mt-6 flex flex-wrap justify-between gap-2">
      <Button variant="ghost" onClick={finish}>Saltar introducción</Button>
      <div className="flex gap-2">{current > 0 && <Button variant="outline" onClick={() => setCurrent(c => c - 1)} aria-label="Anterior"><ChevronLeft size={18}/></Button>}
      {current < steps.length - 1 ? <Button onClick={() => setCurrent(c => c + 1)} rightIcon={<ChevronRight size={18}/>}>Siguiente</Button> : <Button onClick={finish}>Empezar</Button>}</div>
    </div>
  </Modal>;
}
