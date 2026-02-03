/**
 * SITREP v6 - Recuperar Password Page
 * ===================================
 * Página para recuperar contraseña
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/CardV2';

const RecuperarPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simular envío
    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
    }, 1500);
  };

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <button
        onClick={() => navigate('/login')}
        className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Volver al login</span>
      </button>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-neutral-900 mb-2">
          Recuperar contraseña
        </h2>
        <p className="text-neutral-600">
          Ingresa tu email y te enviaremos instrucciones para restablecer tu contraseña
        </p>
      </div>

      {!isSent ? (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
              <Input
                type="email"
                label="Correo electrónico"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail size={18} />}
                isFullWidth
                required
              />

              {error && (
                <div className="p-3 bg-error-50 text-error-600 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                fullWidth
                isLoading={isLoading}
                leftIcon={<RefreshCw size={18} />}
              >
                Enviar instrucciones
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-success-600" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">
              ¡Email enviado!
            </h3>
            <p className="text-neutral-600 mb-6">
              Revisa tu bandeja de entrada en <strong>{email}</strong> y sigue las instrucciones para restablecer tu contraseña.
            </p>
            <Button
              variant="outline"
              fullWidth
              onClick={() => navigate('/login')}
            >
              Volver al login
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <p className="mt-8 text-center text-sm text-neutral-500">
        ¿No recibiste el email?{' '}
        <button 
          onClick={() => setIsSent(false)}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Intentar de nuevo
        </button>
      </p>
    </div>
  );
};

export default RecuperarPasswordPage;
