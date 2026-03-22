/**
 * SITREP v6 - Solicitar Cambios Page
 * ====================================
 * Permite a GENERADOR/OPERADOR solicitar modificaciones de datos de su establecimiento.
 * Los cambios quedan como solicitud de renovacion CON_CAMBIOS para revision del ADMIN.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Building2,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  Award,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { renovacionService } from '../../services/renovacion.service';
import api from '../../services/api';

// Field definitions per actor type
interface FieldDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  type?: 'text' | 'email' | 'tel';
}

const GENERADOR_FIELDS: FieldDef[] = [
  { key: 'razonSocial', label: 'Razon Social', icon: <Building2 size={14} /> },
  { key: 'domicilio', label: 'Domicilio', icon: <MapPin size={14} /> },
  { key: 'telefono', label: 'Telefono', icon: <Phone size={14} />, type: 'tel' },
  { key: 'email', label: 'Email', icon: <Mail size={14} />, type: 'email' },
  { key: 'actividad', label: 'Actividad', icon: <Briefcase size={14} /> },
  { key: 'rubro', label: 'Rubro', icon: <Briefcase size={14} /> },
  { key: 'corrientesControl', label: 'Corrientes de Control', icon: <AlertTriangle size={14} /> },
  { key: 'categoria', label: 'Categoria', icon: <Award size={14} /> },
  { key: 'numeroInscripcion', label: 'Numero de Inscripcion', icon: <Award size={14} /> },
];

const OPERADOR_FIELDS: FieldDef[] = [
  { key: 'razonSocial', label: 'Razon Social', icon: <Building2 size={14} /> },
  { key: 'domicilio', label: 'Domicilio', icon: <MapPin size={14} /> },
  { key: 'telefono', label: 'Telefono', icon: <Phone size={14} />, type: 'tel' },
  { key: 'email', label: 'Email', icon: <Mail size={14} />, type: 'email' },
  { key: 'tipoOperador', label: 'Tipo de Operador', icon: <Briefcase size={14} /> },
  { key: 'tecnologia', label: 'Tecnologia', icon: <Briefcase size={14} /> },
  { key: 'corrientesY', label: 'Corrientes Y', icon: <AlertTriangle size={14} /> },
  { key: 'categoria', label: 'Categoria', icon: <Award size={14} /> },
  { key: 'numeroHabilitacion', label: 'Numero de Habilitacion', icon: <Award size={14} /> },
];

const SolicitarCambiosPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, isGenerador, isOperador } = useAuth();
  const [actorData, setActorData] = useState<Record<string, any> | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fields = isGenerador ? GENERADOR_FIELDS : OPERADOR_FIELDS;
  const actorId = currentUser?.actorId;

  // Fetch current actor data
  useEffect(() => {
    if (!actorId) {
      setLoading(false);
      return;
    }

    const tipo = isGenerador ? 'generadores' : 'operadores';
    api.get(`/actores/${tipo}/${actorId}`)
      .then(res => {
        const data = res.data.data;
        setActorData(data);
        // Initialize form with current values
        const initial: Record<string, string> = {};
        fields.forEach(f => {
          initial[f.key] = data[f.key] != null ? String(data[f.key]) : '';
        });
        setFormData(initial);
      })
      .catch(() => {
        toast.error('Error', 'No se pudieron cargar los datos del establecimiento');
      })
      .finally(() => setLoading(false));
  }, [actorId, isGenerador]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track which fields have been modified
  const changedKeys = useMemo(() => {
    if (!actorData) return [];
    return fields
      .map(f => f.key)
      .filter(key => {
        const original = actorData[key] != null ? String(actorData[key]) : '';
        return formData[key] !== original;
      });
  }, [formData, actorData, fields]);

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (changedKeys.length === 0) {
      toast.warning('Sin cambios', 'No has modificado ningun campo');
      return;
    }

    setSubmitting(true);
    try {
      const datosNuevos: Record<string, string> = {};
      changedKeys.forEach(key => {
        datosNuevos[key] = formData[key];
      });

      await renovacionService.create({
        anio: new Date().getFullYear(),
        tipoActor: isGenerador ? 'GENERADOR' : 'OPERADOR',
        generadorId: isGenerador ? actorId : undefined,
        operadorId: !isGenerador ? actorId : undefined,
        modalidad: 'CON_CAMBIOS',
        datosNuevos,
        camposModificados: Object.keys(datosNuevos),
      });

      setSubmitted(true);
      toast.success('Solicitud enviada', 'Tu solicitud de modificacion fue registrada y sera revisada por un administrador');
    } catch {
      toast.error('Error', 'No se pudo enviar la solicitud. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Guard: only GENERADOR/OPERADOR with an actorId
  if (!isGenerador && !isOperador) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center py-16">
          <AlertTriangle size={48} className="mx-auto text-warning-500 mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900">Acceso restringido</h3>
          <p className="text-neutral-600 mt-1">Esta pagina es solo para Generadores y Operadores.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/mi-perfil')}>
            Volver al perfil
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/mi-perfil')}>
            <ArrowLeft size={16} />
          </Button>
          <h2 className="text-2xl font-bold text-neutral-900">Solicitar Modificacion de Datos</h2>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-neutral-500 mt-3">Cargando datos...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/mi-perfil')}>
            <ArrowLeft size={16} />
          </Button>
          <h2 className="text-2xl font-bold text-neutral-900">Solicitud Enviada</h2>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle size={56} className="mx-auto text-success-500 mb-4" />
            <h3 className="text-xl font-bold text-neutral-900">Solicitud registrada exitosamente</h3>
            <p className="text-neutral-600 mt-2 max-w-md mx-auto">
              Tu solicitud de modificacion de datos fue enviada. Un administrador la revisara y aplicara los cambios correspondientes.
            </p>
            <div className="mt-2">
              <Badge variant="soft" color="info">
                {changedKeys.length} campo{changedKeys.length !== 1 ? 's' : ''} modificado{changedKeys.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <Button className="mt-6" onClick={() => navigate('/mi-perfil')}>
              Volver al perfil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/mi-perfil')}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Solicitar Modificacion de Datos</h2>
          <p className="text-neutral-600 mt-1">
            Modifica los campos que necesites actualizar. Los cambios seran revisados por un administrador.
          </p>
        </div>
      </div>

      {/* Info banner */}
      {changedKeys.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-warning-50 border border-warning-200 rounded-xl">
          <AlertTriangle size={18} className="text-warning-600 shrink-0" />
          <p className="text-sm text-warning-800">
            Has modificado <strong>{changedKeys.length}</strong> campo{changedKeys.length !== 1 ? 's' : ''}.
            Los cambios no se aplican inmediatamente, seran revisados por la autoridad competente.
          </p>
        </div>
      )}

      {/* Form */}
      <Card>
        <CardHeader
          title={isGenerador ? 'Datos del Generador' : 'Datos del Operador'}
          icon={<Building2 size={18} />}
          subtitle={actorData?.razonSocial || ''}
        />
        <CardContent>
          <div className="space-y-4">
            {fields.map(field => {
              const original = actorData?.[field.key] != null ? String(actorData[field.key]) : '';
              const isModified = changedKeys.includes(field.key);

              return (
                <div key={field.key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 text-neutral-500">
                      {field.icon}
                      <span className="text-xs font-medium uppercase">{field.label}</span>
                    </div>
                    {isModified && (
                      <Badge variant="soft" color="warning" size="sm">
                        Modificado
                      </Badge>
                    )}
                  </div>
                  <Input
                    type={field.type || 'text'}
                    value={formData[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    className={isModified ? 'border-warning-300 bg-warning-50/30' : ''}
                  />
                  {isModified && original && (
                    <p className="text-xs text-neutral-400 mt-1">
                      Valor actual: {original}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-neutral-100">
            <Button variant="outline" onClick={() => navigate('/mi-perfil')}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={submitting}
              leftIcon={<Save size={16} />}
              disabled={changedKeys.length === 0}
            >
              Enviar Solicitud ({changedKeys.length} cambio{changedKeys.length !== 1 ? 's' : ''})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SolicitarCambiosPage;
