/**
 * SITREP v6 - Auth Layout
 * =======================
 * Layout para páginas de autenticación
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Leaf, FlaskConical, Truck, Factory } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-primary-50 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-primary-500 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Leaf size={28} />
              </div>
              <span className="text-2xl font-bold">SITREP v6</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
              Sistema de<br />
              Trazabilidad de<br />
              Residuos Peligrosos
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              Gestión integral de manifiestos digitales para el control 
              ambiental de la provincia de Mendoza.
            </p>
          </div>
          
          {/* Features */}
        <div className="grid grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Factory size={24} />
              </div>
              <span className="text-sm font-medium">Generadores</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Truck size={24} />
              </div>
              <span className="text-sm font-medium">Transportistas</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <FlaskConical size={24} />
              </div>
              <span className="text-sm font-medium">Operadores</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white">
              <Leaf size={20} />
            </div>
            <span className="text-xl font-bold text-neutral-900">SITREP v6</span>
          </div>
          
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
