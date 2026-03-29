/**
 * SITREP v6 - Not Found Page
 * ==========================
 * Página 404 rediseñada
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';

const NotFoundPage: React.FC = () => {
  const location = useLocation();
  // Removed isMobile — React Router handles basename

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center py-12 px-8">
        <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileQuestion size={48} className="text-neutral-400" />
        </div>
        
        <h1 className="text-6xl font-bold text-neutral-900 mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-neutral-800 mb-4">
          Página no encontrada
        </h2>
        <p className="text-neutral-600 mb-8">
          Lo sentimos, la página que estás buscando no existe o ha sido movida.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/dashboard">
            <Button leftIcon={<Home size={18} />}>
              Ir al Dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            leftIcon={<ArrowLeft size={18} />}
            onClick={() => window.history.back()}
          >
            Volver atrás
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default NotFoundPage;
