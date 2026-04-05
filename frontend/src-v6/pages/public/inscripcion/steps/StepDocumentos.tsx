/**
 * Step Documentos — File upload step for required documents
 */
import React, { useRef, useState } from 'react';
import { FileText, Paperclip, Upload, X } from 'lucide-react';
import { Button } from '../../../../components/ui/ButtonV2';
import { SectionTitle } from '../SectionTitle';
import type { DocDef } from '../shared';

interface StepDocumentosProps {
  docs: DocDef[];
  adjuntos: Record<string, File>;
  onAddFile: (tipo: string, file: File) => void;
  onRemoveFile: (tipo: string) => void;
}

export const StepDocumentos: React.FC<StepDocumentosProps> = ({
  docs,
  adjuntos,
  onAddFile,
  onRemoveFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocTipo, setActiveDocTipo] = useState<string | null>(null);

  const triggerFileInput = (tipo: string) => {
    setActiveDocTipo(tipo);
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeDocTipo) {
      onAddFile(activeDocTipo, file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <SectionTitle icon={FileText} title="Documentos" />
      <p className="text-sm text-neutral-500">
        Adjunte los documentos requeridos. Formatos aceptados: PDF, JPG, PNG (max 10MB).
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileSelect}
      />
      <div className="space-y-3">
        {docs.map(doc => {
          const attached = adjuntos[doc.tipo];
          return (
            <div key={doc.tipo} className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-3">
                <Paperclip size={16} className="text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-800">{doc.nombre}</p>
                  {attached && (
                    <p className="text-xs text-[#0D8A4F]">{attached.name} ({(attached.size / 1024).toFixed(0)} KB)</p>
                  )}
                </div>
              </div>
              {attached ? (
                <button onClick={() => onRemoveFile(doc.tipo)} className="p-1.5 rounded-lg hover:bg-error-100 text-error-500 transition-colors">
                  <X size={16} />
                </button>
              ) : (
                <Button variant="outline" size="sm" leftIcon={<Upload size={14} />} onClick={() => triggerFileInput(doc.tipo)}>
                  Adjuntar
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
