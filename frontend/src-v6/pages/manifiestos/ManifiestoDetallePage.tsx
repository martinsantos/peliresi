/**
 * SITREP v6 - Manifiesto Detail Page
 * ==================================
 * Detalle de manifiesto con timeline - Conectado a API
 */

import React from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  User,
  Truck,
  Building2,
  Calendar,
  Weight,
  Package,
  CheckCircle,
  Loader2,
  AlertCircle,
  QrCode,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Skeleton } from '../../components/ui/Skeleton';
import { useManifiesto } from '../../hooks/useManifiestos';
import { formatDateTime, formatNumber, formatWeight, formatEstado, formatCuit } from '../../utils/formatters';
import { ESTADO_COLORS } from '../../utils/constants';
import type { Manifiesto, EventoManifiesto } from '../../types/models';
import { EstadoManifiesto } from '../../types/models';

// Fallback mock timeline
const MOCK_TIMELINE = [
  { id: '1', date: '31/01/2025 14:30', title: 'Manifiesto creado', description: 'Por: Juan Pérez (Admin)', status: 'completed' },
  { id: '2', date: '31/01/2025 15:45', title: 'Aprobado por generador', description: 'Firma digital registrada', status: 'completed' },
  { id: '3', date: '31/01/2025 16:00', title: 'Retiro por transportista', description: 'Transportes Andes S.A.', status: 'completed' },
  { id: '4', date: '31/01/2025 18:30', title: 'En tránsito', description: 'Destino: Planta Las Heras', status: 'current' },
  { id: '5', date: 'Pendiente', title: 'Entrega en planta', description: 'ETA: 31/01/2025 20:00', status: 'pending' },
  { id: '6', date: 'Pendiente', title: 'Tratamiento', description: 'Método: Incineración', status: 'pending' },
];

// Fallback mock manifiesto
const MOCK_MANIFIESTO: Partial<Manifiesto> = {
  numero: 'M-2025-089',
  estado: EstadoManifiesto.EN_TRANSITO,
  fechaCreacion: '2025-01-31T14:30:00Z',
  generador: { razonSocial: 'Química Mendoza S.A.', cuit: '30123456789' } as any,
  transportista: { razonSocial: 'Transportes Andes S.A.' } as any,
  operador: { razonSocial: 'Planta Las Heras' } as any,
  residuos: [
    { id: '1', tipoResiduo: { codigo: 'Y02', nombre: 'Residuos de aceites minerales' } as any, cantidad: 1200, unidad: 'kg' } as any,
    { id: '2', tipoResiduo: { codigo: 'Y12', nombre: 'Residuos de solventes orgánicos' } as any, cantidad: 800, unidad: 'kg' } as any,
    { id: '3', tipoResiduo: { codigo: 'Y45', nombre: 'Residuos de empaques contaminados' } as any, cantidad: 450, unidad: 'kg' } as any,
  ],
};

function getEstadoBadgeColor(estado: EstadoManifiesto): 'info' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (estado) {
    case EstadoManifiesto.EN_TRANSITO: return 'info';
    case EstadoManifiesto.TRATADO:
    case EstadoManifiesto.RECIBIDO:
    case EstadoManifiesto.ENTREGADO: return 'success';
    case EstadoManifiesto.PENDIENTE_APROBACION:
    case EstadoManifiesto.EN_TRATAMIENTO: return 'warning';
    case EstadoManifiesto.RECHAZADO:
    case EstadoManifiesto.CANCELADO: return 'error';
    default: return 'neutral';
  }
}

function buildTimeline(manifiesto: Partial<Manifiesto>): typeof MOCK_TIMELINE {
  if (!manifiesto.eventos || manifiesto.eventos.length === 0) return MOCK_TIMELINE;

  const estadoOrder = [
    EstadoManifiesto.BORRADOR,
    EstadoManifiesto.PENDIENTE_APROBACION,
    EstadoManifiesto.APROBADO,
    EstadoManifiesto.EN_TRANSITO,
    EstadoManifiesto.ENTREGADO,
    EstadoManifiesto.RECIBIDO,
    EstadoManifiesto.EN_TRATAMIENTO,
    EstadoManifiesto.TRATADO,
  ];

  const currentIdx = estadoOrder.indexOf(manifiesto.estado || EstadoManifiesto.BORRADOR);

  return manifiesto.eventos.map((ev, i) => ({
    id: ev.id,
    date: formatDateTime(ev.createdAt),
    title: ev.tipo.replace(/_/g, ' '),
    description: ev.descripcion + (ev.usuario ? ` - ${ev.usuario.nombre}` : ''),
    status: i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'pending',
  }));
}

const ManifiestoDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const { data: apiData, isLoading, isError } = useManifiesto(id || '');
  const [qrCopied, setQrCopied] = React.useState(false);

  // Use API data or fallback
  const manifiesto = apiData?.data || apiData || MOCK_MANIFIESTO;
  const m = manifiesto as Partial<Manifiesto>;
  const timeline = buildTimeline(m);
  const totalPeso = m.residuos?.reduce((sum, r) => sum + (r.cantidad || 0), 0) || 2450;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <div className="flex-1">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={isMobile ? "/mobile/manifiestos" : "/manifiestos"}>
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />}>
            Volver
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-neutral-900">{m.numero || id}</h2>
            <Badge variant="soft" color={getEstadoBadgeColor(m.estado || EstadoManifiesto.BORRADOR)}>
              {formatEstado(m.estado || EstadoManifiesto.BORRADOR)}
            </Badge>
            {isError && (
              <Badge variant="soft" color="warning">
                <AlertCircle size={12} className="mr-1" />
                Datos de demo
              </Badge>
            )}
          </div>
          <p className="text-neutral-600 mt-1">
            Creado el {m.fechaCreacion ? formatDateTime(m.fechaCreacion) : '31/01/2025 14:30'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Descargar PDF</Button>
          <Button>Editar</Button>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Actores */}
          <Card>
            <CardHeader title="Información general" icon={<FileText size={20} />} />
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Generador</p>
                    <p className="font-medium text-neutral-900">{m.generador?.razonSocial || 'Química Mendoza S.A.'}</p>
                    <p className="text-sm text-neutral-600">CUIT: {m.generador?.cuit ? formatCuit(m.generador.cuit) : '30-12345678-9'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                    <Truck size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Transportista</p>
                    <p className="font-medium text-neutral-900">{m.transportista?.razonSocial || 'Transportes Andes S.A.'}</p>
                    <p className="text-sm text-neutral-600">Hab: {m.transportista?.numeroHabilitacion || 'AB-123-CD'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-50 rounded-lg text-green-600">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Operador</p>
                    <p className="font-medium text-neutral-900">{m.operador?.razonSocial || 'Planta Las Heras'}</p>
                    <p className="text-sm text-neutral-600">Hab: {m.operador?.numeroHabilitacion || '001234'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Residuos */}
          <Card>
            <CardHeader title="Residuos transportados" icon={<Package size={20} />} />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Descripción</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Unidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {(m.residuos || MOCK_MANIFIESTO.residuos)?.map((residuo) => (
                      <tr key={residuo.id}>
                        <td className="px-4 py-3 font-mono text-sm">{residuo.tipoResiduo?.codigo || '-'}</td>
                        <td className="px-4 py-3 text-neutral-700">{residuo.tipoResiduo?.nombre || residuo.descripcion || '-'}</td>
                        <td className="px-4 py-3 font-medium">{formatNumber(residuo.cantidad)}</td>
                        <td className="px-4 py-3 text-neutral-600">{residuo.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-4 bg-neutral-50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-600">
                  <Weight size={18} />
                  <span className="font-medium">Peso total:</span>
                </div>
                <span className="text-xl font-bold text-neutral-900">{formatWeight(totalPeso)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Historial de estados" icon={<Calendar size={20} />} />
            <CardContent>
              <div className="relative">
                {/* Line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-200" />

                {/* Events */}
                <div className="space-y-6 animate-fade-in">
                  {timeline.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Dot */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                          event.status === 'completed'
                            ? 'bg-success-500 text-white'
                            : event.status === 'current'
                            ? 'bg-info-500 text-white ring-4 ring-info-100'
                            : 'bg-neutral-200 text-neutral-400'
                        }`}
                      >
                        {event.status === 'completed' ? (
                          <CheckCircle size={16} />
                        ) : (
                          <span className="text-xs font-bold">{index + 1}</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className={`font-semibold ${
                              event.status === 'pending' ? 'text-neutral-400' : 'text-neutral-900'
                            }`}>
                              {event.title}
                            </p>
                            <p className={`text-sm mt-0.5 ${
                              event.status === 'pending' ? 'text-neutral-400' : 'text-neutral-600'
                            }`}>
                              {event.description}
                            </p>
                          </div>
                          <span className={`text-sm ${
                            event.status === 'pending' ? 'text-neutral-400' : 'text-neutral-500'
                          }`}>
                            {event.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 animate-fade-in">
          {/* QR Code */}
          <Card>
            <CardHeader title="QR de Control" icon={<QrCode size={20} />} />
            <CardContent>
              {(() => {
                const numero = m.numero || id || 'M-2025-089';
                const qrUrl = `${window.location.origin}/v6/manifiestos/verificar/${encodeURIComponent(numero)}`;
                return (
                  <div className="flex flex-col items-center gap-4">
                    <div className="qr-control-svg bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
                      <QRCodeSVG
                        value={qrUrl}
                        size={180}
                        level="H"
                        includeMargin={false}
                        bgColor="#FFFFFF"
                        fgColor="#1B5E3C"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-neutral-900">{numero}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Escanear para verificar estado
                      </p>
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        leftIcon={qrCopied ? <Check size={14} /> : <Copy size={14} />}
                        onClick={() => {
                          navigator.clipboard.writeText(qrUrl);
                          setQrCopied(true);
                          setTimeout(() => setQrCopied(false), 2000);
                        }}
                      >
                        {qrCopied ? 'Copiado' : 'Copiar enlace'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        leftIcon={<Download size={14} />}
                        onClick={() => {
                          const svg = document.querySelector('.qr-control-svg svg') as SVGElement;
                          if (!svg) return;
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement('canvas');
                          canvas.width = 400;
                          canvas.height = 400;
                          const ctx = canvas.getContext('2d');
                          const img = new Image();
                          img.onload = () => {
                            ctx?.drawImage(img, 0, 0, 400, 400);
                            const a = document.createElement('a');
                            a.download = `QR-${numero}.png`;
                            a.href = canvas.toDataURL('image/png');
                            a.click();
                          };
                          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                        }}
                      >
                        Descargar
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Acciones rápidas" />
            <CardContent>
              <div className="space-y-2 animate-fade-in">
                <Button variant="outline" fullWidth>
                  Ver en mapa
                </Button>
                <Button variant="outline" fullWidth>
                  Contactar transportista
                </Button>
                <Button variant="outline" fullWidth>
                  Descargar certificado
                </Button>
                <Button variant="danger" fullWidth>
                  Cancelar manifiesto
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Documentos adjuntos" />
            <CardContent>
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                  <FileText size={20} className="text-neutral-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-neutral-900 truncate">Manifiesto.pdf</p>
                    <p className="text-xs text-neutral-500">2.4 MB</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Ver
                  </Button>
                </div>
                <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                  <FileText size={20} className="text-neutral-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-neutral-900 truncate">Anexo_A.pdf</p>
                    <p className="text-xs text-neutral-500">1.1 MB</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Ver
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ManifiestoDetailPage;
