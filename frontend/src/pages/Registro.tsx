import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Building, Mail, Phone, Lock, ArrowRight, CheckCircle } from 'lucide-react';
import './Registro.css';

const API_URL = import.meta.env.VITE_API_URL || '';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  nombre: string;
  apellido: string;
  telefono: string;
  empresa: string;
  cuit: string;
  rol: string;
  motivoSolicitud: string;
}

const Registro: React.FC = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    nombre: '',
    apellido: '',
    telefono: '',
    empresa: '',
    cuit: '',
    rol: 'GENERADOR',
    motivoSolicitud: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('Complete todos los campos requeridos');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.nombre || !formData.rol) {
      setError('Complete todos los campos requeridos');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/registro/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar solicitud');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="registro-container">
        <div className="registro-card success">
          <CheckCircle className="success-icon" />
          <h2>¡Solicitud Enviada!</h2>
          <p>Su solicitud de registro ha sido enviada correctamente.</p>
          <p className="muted">
            Recibirá una notificación cuando el administrador apruebe su cuenta.
          </p>
          <Link to="/login" className="btn-primary">
            Volver al Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="registro-container">
      <div className="registro-card">
        <div className="registro-header">
          <img src="/icons/icon-192x192.png" alt="SITREP" className="logo" />
          <h1>Solicitar Acceso</h1>
          <p>Sistema de Trazabilidad de Residuos Peligrosos</p>
        </div>

        <div className="steps-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Cuenta</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Datos</div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="form-step">
              <div className="form-group">
                <label htmlFor="email">
                  <Mail size={18} /> Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="correo@empresa.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  <Lock size={18} /> Contraseña *
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">
                  <Lock size={18} /> Confirmar Contraseña *
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repita la contraseña"
                  required
                />
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={() => validateStep1() && setStep(2)}
              >
                Continuar <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="form-step">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="nombre">
                    <User size={18} /> Nombre *
                  </label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="apellido">Apellido</label>
                  <input
                    type="text"
                    id="apellido"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="empresa">
                    <Building size={18} /> Empresa
                  </label>
                  <input
                    type="text"
                    id="empresa"
                    name="empresa"
                    value={formData.empresa}
                    onChange={handleChange}
                    placeholder="Razón Social"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cuit">CUIT</label>
                  <input
                    type="text"
                    id="cuit"
                    name="cuit"
                    value={formData.cuit}
                    onChange={handleChange}
                    placeholder="XX-XXXXXXXX-X"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="telefono">
                  <Phone size={18} /> Teléfono
                </label>
                <input
                  type="tel"
                  id="telefono"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="+54 261 ..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="rol">Tipo de Usuario *</label>
                <select
                  id="rol"
                  name="rol"
                  value={formData.rol}
                  onChange={handleChange}
                  required
                >
                  <option value="GENERADOR">Generador de Residuos</option>
                  <option value="TRANSPORTISTA">Transportista</option>
                  <option value="OPERADOR">Operador/Planta de Tratamiento</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="motivoSolicitud">Motivo de la Solicitud</label>
                <textarea
                  id="motivoSolicitud"
                  name="motivoSolicitud"
                  value={formData.motivoSolicitud}
                  onChange={handleChange}
                  placeholder="Describa brevemente por qué necesita acceso..."
                  rows={3}
                />
              </div>

              <div className="form-buttons">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStep(1)}
                >
                  Atrás
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="registro-footer">
          <p>
            ¿Ya tiene cuenta? <Link to="/login">Iniciar Sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Registro;
