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
      {/* Left side - Branding (compact) */}
      <div className="hidden lg:flex lg:w-2/5 xl:w-1/3 bg-primary-500 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            {/* Gobierno de Mendoza + SITREP */}
            <div className="flex items-center gap-2.5 mb-6">
              <img src="/escudo-mendoza-blanco.webp" alt="Gobierno de Mendoza" className="h-11 w-auto" />
              <span className="leading-tight" style={{ fontFamily: "'Lato', sans-serif" }}>
                <span className="block text-base font-bold tracking-tight">MENDOZA</span>
                <span className="block text-sm font-light">GOBIERNO</span>
              </span>
              <div className="w-px h-9 bg-white/30 mx-1" />
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                <Leaf size={24} />
              </div>
              <span className="text-xl font-bold">SITREP</span>
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
      
      {/* Right side - Form (wider) */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Mobile logo — Gobierno de Mendoza + SITREP */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <img src="/escudo-mendoza-color.webp" alt="Gobierno de Mendoza" className="h-8 w-auto" />
            <span className="leading-tight" style={{ fontFamily: "'Lato', sans-serif" }}>
              <span className="block text-xs font-bold text-[#007F90] tracking-tight">MENDOZA</span>
              <span className="block text-[10px] font-light text-[#007F90]">GOBIERNO</span>
            </span>
            <div className="w-px h-7 bg-neutral-300 mx-0.5" />
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white">
              <Leaf size={16} />
            </div>
            <span className="text-sm font-bold text-neutral-900">SITREP</span>
          </div>
          
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
