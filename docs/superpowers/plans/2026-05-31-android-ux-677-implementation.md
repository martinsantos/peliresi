# Android UX 677 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SITREP Android PWA/TWA feel like a reliable field app by improving role home screens, transportista trip mode, GPS/offline feedback, operator mobile actions, and emulator-backed QA evidence.

**Architecture:** Keep the existing React/Vite PWA under `/app/` and the current Android TWA packaging. Add focused mobile components under `frontend/src-v6/components/mobile/`, integrate them into `MobileLayout`, `MobileDashboardPage`, and `ViajeEnCursoTransportista`, and keep backend contracts unchanged.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, Tailwind CSS, Lucide React, Vitest, Playwright, adb Android emulator QA, existing Bubblewrap/TWA APK artifacts.

---

## File Structure

Create:

- `frontend/src-v6/components/mobile/AndroidPermissionGuide.tsx`: reusable recovery UI for denied/unavailable Android permissions.
- `frontend/src-v6/components/mobile/GpsStatusPanel.tsx`: standalone GPS state panel for trip mode.
- `frontend/src-v6/components/mobile/TripActionBar.tsx`: stable field-mode action controls for pickup, pause, incident, delivery, and retry.
- `frontend/src-v6/components/mobile/MobileRoleHero.tsx`: role-aware dashboard header that answers "what do I do now?"
- `frontend/src-v6/components/mobile/TransportistaTripQueue.tsx`: transportista active/pending trip queue for dashboard.
- `frontend/src-v6/components/mobile/OperatorActionQueue.tsx`: operador mobile action queue for receipts and treatment states.
- `frontend/src-v6/__tests__/components/mobile/AndroidPermissionGuide.test.tsx`
- `frontend/src-v6/__tests__/components/mobile/GpsStatusPanel.test.tsx`
- `frontend/src-v6/__tests__/components/mobile/TripActionBar.test.tsx`
- `frontend/src-v6/__tests__/components/mobile/MobileRoleHero.test.tsx`
- `frontend/src-v6/__tests__/components/mobile/TransportistaTripQueue.test.tsx`
- `frontend/src-v6/__tests__/components/mobile/OperatorActionQueue.test.tsx`
- `frontend/src-v6/__tests__/hooks/useGPSTracking.test.tsx`
- `frontend/e2e/android-ux.spec.ts`
- `backend/tests/android-ux-readiness-static-test.sh`
- `docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md`
- `docs/ANDROID_UX_READY_REPORT_2026-05-31.md`

Modify:

- `frontend/src-v6/hooks/useGPSTracking.ts`: expose observable sync metadata.
- `frontend/src-v6/pages/transporte/ViajeEnCursoTransportista.tsx`: replace inline GPS/action UI with mobile components.
- `frontend/src-v6/pages/mobile/MobileDashboardPage.tsx`: use role hero, transportista queue, and operator queue.
- `frontend/src-v6/layouts/MobileLayout.tsx`: strengthen bottom navigation labels, active trip surface, and Android back-safe layout spacing.
- `frontend/e2e/pwa-load.spec.ts`: include the most important mobile field routes if production IDs are available.
- `docs/ANDROID_APP_READY_REPORT_2026-05-29.md`: link the new UX report after QA.

## Task 1: Android UX Evidence Documents And Static Gate

**Files:**

- Create: `docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md`
- Create: `docs/ANDROID_UX_READY_REPORT_2026-05-31.md`
- Create: `backend/tests/android-ux-readiness-static-test.sh`

- [ ] **Step 1: Write the gap matrix document**

Create `docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md`:

```markdown
# SITREP Android UX Gap Matrix - 2026-05-31

## Scope

This matrix tracks Android-specific UI/UX gaps for the SITREP TWA/PWA app. It uses the completed security, quality, APK readiness, and E2E work as baseline.

## Severity

- Blocker: prevents field testing or causes crashes/data loss.
- High friction: app works but field users are likely to fail or lose confidence.
- Polish: visible quality issue that does not block core work.
- Technical debt: implementation quality issue that raises future risk.

## Current Matrix

| Area | Gap | Severity | Evidence | Resolution Target |
| --- | --- | --- | --- | --- |
| Android install | APK install and launch evidence must be refreshed after UX changes | High friction | Existing APK artifacts in `/private/tmp/sitrep-android-twa-build/` | Final Android UX QA report |
| Mobile navigation | Active field task must remain visible outside trip page | High friction | `MobileLayout` has a compact active trip banner | Stronger field status surface |
| Transportista trip | GPS, sync, pause, incident, and delivery actions are mixed in one large page | High friction | `ViajeEnCursoTransportista.tsx` owns all UI state inline | Extract field-mode components |
| GPS/offline | Pending GPS queue count is not reliably observable by React renders | High friction | `useGPSTracking` returns `pendingUpdatesRef.current.length` | State-backed sync metadata |
| Operador mobile | Operator actions are not first-class on Android dashboard | High friction | Mobile dashboard prioritizes generic stats | Operator action queue |
| Android permissions | Permission recovery text is embedded in GPS panel only | Polish | Inline denied copy in trip page | Reusable permission guide |

## Evidence Artifacts

Artifacts produced during execution must be stored outside the repo under `/private/tmp` and referenced in the final report.
```

- [ ] **Step 2: Write the final report shell**

Create `docs/ANDROID_UX_READY_REPORT_2026-05-31.md`:

```markdown
# SITREP Android UX Ready Report - 2026-05-31

## Goal

Validate that the SITREP Android TWA/PWA behaves like a field-grade mobile app for transportistas, operadores, and administrators.

## Build Under Test

- APK path: `/private/tmp/sitrep-android-twa-build/app-release-signed.apk`
- Package: `ar.com.ultimamilla.sitrep`
- Web origin: `https://sitrep.ultimamilla.com.ar/app/`

## UX Changes Covered

- Mobile role home screen.
- Transportista field mode.
- GPS permission and sync feedback.
- Operator mobile action queue.
- Android/PWA E2E route and visual checks.

## Emulator Evidence

| Flow | Screenshot | UI Dump | Logcat | Result |
| --- | --- | --- | --- | --- |
| Install and launch | `/private/tmp/sitrep-android-ux-launch.png` | `/private/tmp/sitrep-android-ux-launch.xml` | `/private/tmp/sitrep-android-ux-logcat.txt` | Pending QA run |
| Dashboard | `/private/tmp/sitrep-android-ux-dashboard.png` | `/private/tmp/sitrep-android-ux-dashboard.xml` | `/private/tmp/sitrep-android-ux-logcat.txt` | Pending QA run |
| Trip mode | `/private/tmp/sitrep-android-ux-trip.png` | `/private/tmp/sitrep-android-ux-trip.xml` | `/private/tmp/sitrep-android-ux-logcat.txt` | Pending QA run |
| GPS permission | `/private/tmp/sitrep-android-ux-gps.png` | `/private/tmp/sitrep-android-ux-gps.xml` | `/private/tmp/sitrep-android-ux-logcat.txt` | Pending QA run |

## Verification Commands

- `npm test`
- `npm run build`
- `npm run test:e2e -- e2e/android-ux.spec.ts --reporter=line`
- `bash backend/tests/android-ux-readiness-static-test.sh`
- `git diff --check`

## Remaining Gaps

The implementation team must update this section after emulator QA with any gaps that remain open.
```

- [ ] **Step 3: Write the static gate**

Create `backend/tests/android-ux-readiness-static-test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md"
  "docs/ANDROID_UX_READY_REPORT_2026-05-31.md"
  "docs/superpowers/specs/2026-05-31-android-ux-677-design.md"
  "docs/superpowers/plans/2026-05-31-android-ux-677-implementation.md"
)

for file in "${required_files[@]}"; do
  if [[ ! -s "$file" ]]; then
    echo "Missing required Android UX artifact: $file" >&2
    exit 1
  fi
done

grep -q "SITREP Android UX Gap Matrix" docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md
grep -q "SITREP Android UX Ready Report" docs/ANDROID_UX_READY_REPORT_2026-05-31.md
grep -q "Android UX 677" docs/superpowers/specs/2026-05-31-android-ux-677-design.md

echo "Android UX readiness static artifacts present"
```

- [ ] **Step 4: Make the gate executable**

Run:

```bash
chmod +x backend/tests/android-ux-readiness-static-test.sh
```

Expected: exits 0.

- [ ] **Step 5: Run the gate**

Run:

```bash
bash backend/tests/android-ux-readiness-static-test.sh
```

Expected: prints `Android UX readiness static artifacts present`.

- [ ] **Step 6: Commit**

```bash
git add docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md docs/ANDROID_UX_READY_REPORT_2026-05-31.md backend/tests/android-ux-readiness-static-test.sh
git commit -m "docs: add android ux readiness evidence gate"
```

## Task 2: GPS Status Panel Component

**Files:**

- Create: `frontend/src-v6/components/mobile/AndroidPermissionGuide.tsx`
- Create: `frontend/src-v6/components/mobile/GpsStatusPanel.tsx`
- Test: `frontend/src-v6/__tests__/components/mobile/AndroidPermissionGuide.test.tsx`
- Test: `frontend/src-v6/__tests__/components/mobile/GpsStatusPanel.test.tsx`
- Modify: `frontend/src-v6/pages/transporte/ViajeEnCursoTransportista.tsx`

- [ ] **Step 1: Write AndroidPermissionGuide test**

Create `frontend/src-v6/__tests__/components/mobile/AndroidPermissionGuide.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AndroidPermissionGuide } from '../../../components/mobile/AndroidPermissionGuide';

describe('AndroidPermissionGuide', () => {
  it('renders GPS recovery steps for denied location permission', () => {
    render(<AndroidPermissionGuide permission="gps" state="denied" />);

    expect(screen.getByText('Permiso de ubicacion bloqueado')).toBeInTheDocument();
    expect(screen.getByText(/Ajustes de Android/i)).toBeInTheDocument();
    expect(screen.getByText(/Ubicacion/i)).toBeInTheDocument();
  });

  it('renders notification recovery copy', () => {
    render(<AndroidPermissionGuide permission="notifications" state="denied" />);

    expect(screen.getByText('Notificaciones desactivadas')).toBeInTheDocument();
    expect(screen.getByText(/avisos de viaje/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run permission guide test to verify it fails**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/AndroidPermissionGuide.test.tsx
```

Expected: FAIL because `AndroidPermissionGuide.tsx` does not exist.

- [ ] **Step 3: Implement AndroidPermissionGuide**

Create `frontend/src-v6/components/mobile/AndroidPermissionGuide.tsx`:

```tsx
import React from 'react';
import { Bell, MapPin, Settings } from 'lucide-react';
import { Card, CardContent } from '../ui/CardV2';

type PermissionKind = 'gps' | 'notifications';
type PermissionState = 'denied' | 'unavailable';

interface AndroidPermissionGuideProps {
  permission: PermissionKind;
  state: PermissionState;
}

const COPY: Record<PermissionKind, Record<PermissionState, { title: string; body: string; steps: string[]; icon: React.ReactNode }>> = {
  gps: {
    denied: {
      title: 'Permiso de ubicacion bloqueado',
      body: 'SITREP necesita ubicacion para registrar el viaje y validar entregas.',
      steps: ['Abrir Ajustes de Android', 'Entrar en Apps > SITREP', 'Permitir Ubicacion mientras se usa la app'],
      icon: <MapPin size={18} />,
    },
    unavailable: {
      title: 'GPS no disponible',
      body: 'Activa la ubicacion del dispositivo antes de continuar el viaje.',
      steps: ['Abrir ajustes rapidos', 'Activar Ubicacion', 'Volver a SITREP y esperar la senal GPS'],
      icon: <MapPin size={18} />,
    },
  },
  notifications: {
    denied: {
      title: 'Notificaciones desactivadas',
      body: 'Activalas para recibir avisos de viaje, incidentes y cambios de estado.',
      steps: ['Abrir Ajustes de Android', 'Entrar en Apps > SITREP', 'Permitir Notificaciones'],
      icon: <Bell size={18} />,
    },
    unavailable: {
      title: 'Notificaciones no disponibles',
      body: 'El dispositivo no permite notificaciones para esta instalacion.',
      steps: ['Revisar permisos de la app', 'Confirmar que Android permite notificaciones', 'Volver a intentar desde Configuracion'],
      icon: <Bell size={18} />,
    },
  },
};

export const AndroidPermissionGuide: React.FC<AndroidPermissionGuideProps> = ({ permission, state }) => {
  const copy = COPY[permission][state];

  return (
    <Card className="border-2 border-warning-200 bg-warning-50">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-warning-700 shadow-sm">
            {copy.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-warning-700" />
              <h3 className="text-sm font-bold text-warning-900">{copy.title}</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-warning-800">{copy.body}</p>
            <ol className="mt-2 space-y-1 text-xs text-warning-800">
              {copy.steps.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="font-bold">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AndroidPermissionGuide;
```

- [ ] **Step 4: Run permission guide test to verify it passes**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/AndroidPermissionGuide.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Write GPS status panel test**

Create `frontend/src-v6/__tests__/components/mobile/GpsStatusPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GpsStatusPanel } from '../../../components/mobile/GpsStatusPanel';

describe('GpsStatusPanel', () => {
  it('shows active GPS coordinates, accuracy, and pending sync count', () => {
    render(
      <GpsStatusPanel
        status="active"
        sendStatus="error"
        position={[-32.92871, -68.85352]}
        details={{ accuracy: 8, speed: 10, heading: 90, altitude: null, lastUpdate: new Date('2026-05-31T10:00:00Z') }}
        pendingCount={3}
        lastSyncAt={null}
      />,
    );

    expect(screen.getByText('GPS activo')).toBeInTheDocument();
    expect(screen.getByText(/-32.92871, -68.85352/)).toBeInTheDocument();
    expect(screen.getByText('3 pendientes')).toBeInTheDocument();
  });

  it('shows Android recovery guidance when GPS is denied', () => {
    render(
      <GpsStatusPanel
        status="denied"
        sendStatus="idle"
        position={null}
        details={{ accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null }}
        pendingCount={0}
        lastSyncAt={null}
      />,
    );

    expect(screen.getByText('Permiso GPS denegado')).toBeInTheDocument();
    expect(screen.getByText('Permiso de ubicacion bloqueado')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run GPS status panel test to verify it fails**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/GpsStatusPanel.test.tsx
```

Expected: FAIL because `GpsStatusPanel.tsx` does not exist.

- [ ] **Step 7: Implement GPS status panel**

Create `frontend/src-v6/components/mobile/GpsStatusPanel.tsx`:

```tsx
import React from 'react';
import { AlertTriangle, Compass, Crosshair, Gauge, LocateFixed, MapPin, WifiOff, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/CardV2';
import { Badge } from '../ui/BadgeV2';
import { AndroidPermissionGuide } from './AndroidPermissionGuide';
import { headingToCompass, type GpsDetails, type GpsStatus } from '../../hooks/useGPSTracking';

interface GpsStatusPanelProps {
  status: GpsStatus;
  sendStatus: 'ok' | 'error' | 'idle';
  position: [number, number] | null;
  details: GpsDetails;
  pendingCount: number;
  lastSyncAt: Date | null;
}

const STATUS_COPY: Record<GpsStatus, { label: string; tone: string; icon: React.ReactNode }> = {
  checking: { label: 'Verificando GPS', tone: 'bg-neutral-100 text-neutral-700', icon: <Loader2 size={14} className="animate-spin" /> },
  acquiring: { label: 'Adquiriendo senal GPS', tone: 'bg-warning-50 text-warning-700', icon: <LocateFixed size={14} className="animate-pulse" /> },
  active: { label: 'GPS activo', tone: 'bg-success-50 text-success-700', icon: <span className="h-2.5 w-2.5 rounded-full bg-success-500 animate-pulse" /> },
  denied: { label: 'Permiso GPS denegado', tone: 'bg-error-50 text-error-700', icon: <WifiOff size={14} /> },
  unavailable: { label: 'GPS no disponible', tone: 'bg-error-50 text-error-700', icon: <WifiOff size={14} /> },
  error: { label: 'Error GPS', tone: 'bg-error-50 text-error-700', icon: <AlertTriangle size={14} /> },
};

function formatLastSync(lastSyncAt: Date | null) {
  if (!lastSyncAt) return 'Sin sincronizar';
  return `Sync ${lastSyncAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

export const GpsStatusPanel: React.FC<GpsStatusPanelProps> = ({
  status,
  sendStatus,
  position,
  details,
  pendingCount,
  lastSyncAt,
}) => {
  const copy = STATUS_COPY[status];

  return (
    <div className="space-y-2">
      <Card className={`${copy.tone} border-none`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {copy.icon}
              <span className="truncate text-sm font-bold">{copy.label}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {pendingCount > 0 && <Badge color="warning" variant="solid" size="sm">{pendingCount} pendientes</Badge>}
              {sendStatus === 'ok' && <Badge color="success" variant="soft" size="sm">{formatLastSync(lastSyncAt)}</Badge>}
              {sendStatus === 'error' && <Badge color="error" variant="soft" size="sm">Guardando local</Badge>}
            </div>
          </div>

          {status === 'active' && position && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-700">
              <div className="flex items-center gap-1.5">
                <Crosshair size={13} className="text-neutral-400" />
                <span>{position[0].toFixed(5)}, {position[1].toFixed(5)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-neutral-400" />
                <span>{details.accuracy != null ? `+-${Math.round(details.accuracy)}m` : 'Precision -'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge size={13} className="text-neutral-400" />
                <span>{details.speed != null ? `${Math.round(details.speed * 3.6)} km/h` : '- km/h'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Compass size={13} className="text-neutral-400" />
                <span>{headingToCompass(details.heading)}</span>
              </div>
            </div>
          )}

          {status === 'acquiring' && (
            <p className="mt-2 text-xs text-warning-700">Manten la app abierta hasta fijar posicion.</p>
          )}
        </CardContent>
      </Card>

      {status === 'denied' && <AndroidPermissionGuide permission="gps" state="denied" />}
      {status === 'unavailable' && <AndroidPermissionGuide permission="gps" state="unavailable" />}
    </div>
  );
};

export default GpsStatusPanel;
```

- [ ] **Step 8: Integrate GPS status panel in trip page**

In `frontend/src-v6/pages/transporte/ViajeEnCursoTransportista.tsx`, add the import:

```tsx
import { GpsStatusPanel } from '../../components/mobile/GpsStatusPanel';
```

Delete the inline `const GpsStatusPanel = () => { ... };` function. Replace the JSX usage:

```tsx
<GpsStatusPanel
  status={gpsStatus}
  sendStatus={gpsSendStatus}
  position={currentPosition}
  details={gpsDetails}
  pendingCount={gps.pendingCount}
  lastSyncAt={gps.lastSyncAt}
/>
```

- [ ] **Step 9: Run tests**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/AndroidPermissionGuide.test.tsx src-v6/__tests__/components/mobile/GpsStatusPanel.test.tsx
```

Expected: both files pass.

- [ ] **Step 10: Commit**

```bash
git add frontend/src-v6/components/mobile/AndroidPermissionGuide.tsx frontend/src-v6/components/mobile/GpsStatusPanel.tsx frontend/src-v6/__tests__/components/mobile/AndroidPermissionGuide.test.tsx frontend/src-v6/__tests__/components/mobile/GpsStatusPanel.test.tsx frontend/src-v6/pages/transporte/ViajeEnCursoTransportista.tsx
git commit -m "feat: add android gps status panel"
```

## Task 3: Observable GPS Sync Metadata

**Files:**

- Modify: `frontend/src-v6/hooks/useGPSTracking.ts`
- Test: `frontend/src-v6/__tests__/hooks/useGPSTracking.test.tsx`

- [ ] **Step 1: Write GPS hook tests**

Create `frontend/src-v6/__tests__/hooks/useGPSTracking.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EstadoManifiesto } from '../../types/models';

const actualizarUbicacion = vi.fn();

vi.mock('../../services/manifiesto.service', () => ({
  manifiestoService: {
    actualizarUbicacion,
  },
}));

describe('useGPSTracking', () => {
  beforeEach(() => {
    localStorage.clear();
    actualizarUbicacion.mockReset();
  });

  it('exports compass conversion', async () => {
    const { headingToCompass } = await import('../../hooks/useGPSTracking');
    expect(headingToCompass(0)).toBe('N');
    expect(headingToCompass(90)).toBe('E');
    expect(headingToCompass(225)).toBe('SO');
    expect(headingToCompass(null)).toBe('-');
  });

  it('restores pending GPS points from localStorage and exposes observable pending count', async () => {
    actualizarUbicacion.mockRejectedValueOnce(new Error('offline'));
    localStorage.setItem('gps_pending_trip-1', JSON.stringify([{ lat: -32.9, lng: -68.8, speed: null, heading: null }]));

    const { useGPSTracking } = await import('../../hooks/useGPSTracking');
    const { result } = renderHook(() => useGPSTracking({
      manifiestoId: 'trip-1',
      estado: EstadoManifiesto.EN_TRANSITO,
      viajeStatus: 'ACTIVO',
    }));

    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    expect(result.current.hasPending).toBe(true);
    expect(result.current.lastSyncAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run GPS hook tests to verify they fail**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/hooks/useGPSTracking.test.tsx
```

Expected: FAIL because `hasPending` and `lastSyncAt` are not returned.

- [ ] **Step 3: Update hook return types**

In `frontend/src-v6/hooks/useGPSTracking.ts`, update `UseGPSTrackingReturn`:

```ts
interface UseGPSTrackingReturn {
  position: [number, number] | null;
  trackPoints: [number, number][];
  status: GpsStatus;
  details: GpsDetails;
  sendStatus: 'ok' | 'error' | 'idle';
  pendingCount: number;
  hasPending: boolean;
  lastSyncAt: Date | null;
  cleanupGps: () => void;
}
```

- [ ] **Step 4: Add state-backed pending metadata**

In `useGPSTracking`, after `gpsSendStatus` state, add:

```ts
const [pendingCount, setPendingCount] = useState(0);
const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

const setPendingUpdates = useCallback((points: PendingGpsPoint[]) => {
  pendingUpdatesRef.current = points;
  setPendingCount(points.length);
  if (id) {
    if (points.length > 0) {
      localStorage.setItem(`gps_pending_${id}`, JSON.stringify(points));
    } else {
      localStorage.removeItem(`gps_pending_${id}`);
    }
  }
}, [id]);
```

Replace direct assignments to `pendingUpdatesRef.current = ...` with `setPendingUpdates(...)`. When a send succeeds, set:

```ts
setLastSyncAt(new Date());
setGpsSendStatus('ok');
```

When a send fails, call:

```ts
setPendingUpdates([...pendingUpdatesRef.current, point].slice(-500));
setGpsSendStatus('error');
```

- [ ] **Step 5: Return sync metadata**

Return:

```ts
return {
  position: currentPosition,
  trackPoints,
  status: gpsStatus,
  details: gpsDetails,
  sendStatus: gpsSendStatus,
  pendingCount,
  hasPending: pendingCount > 0,
  lastSyncAt,
  cleanupGps,
};
```

- [ ] **Step 6: Run GPS hook tests**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/hooks/useGPSTracking.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run GPS panel tests again**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/GpsStatusPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src-v6/hooks/useGPSTracking.ts frontend/src-v6/__tests__/hooks/useGPSTracking.test.tsx
git commit -m "fix: expose android gps sync metadata"
```

## Task 4: Trip Action Bar For Field Mode

**Files:**

- Create: `frontend/src-v6/components/mobile/TripActionBar.tsx`
- Test: `frontend/src-v6/__tests__/components/mobile/TripActionBar.test.tsx`
- Modify: `frontend/src-v6/pages/transporte/ViajeEnCursoTransportista.tsx`

- [ ] **Step 1: Write TripActionBar tests**

Create `frontend/src-v6/__tests__/components/mobile/TripActionBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EstadoManifiesto } from '../../../types/models';
import { TripActionBar } from '../../../components/mobile/TripActionBar';

describe('TripActionBar', () => {
  it('renders pickup as the primary action for approved trips', () => {
    const onConfirmPickup = vi.fn();
    render(
      <TripActionBar
        estado={EstadoManifiesto.APROBADO}
        viajeStatus="ACTIVO"
        isPending={false}
        hasPendingSync={false}
        onConfirmPickup={onConfirmPickup}
        onTogglePause={vi.fn()}
        onReportIncident={vi.fn()}
        onConfirmDelivery={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirmar retiro/i }));
    expect(onConfirmPickup).toHaveBeenCalledTimes(1);
  });

  it('renders pause, incident, and delivery actions for active trips', () => {
    render(
      <TripActionBar
        estado={EstadoManifiesto.EN_TRANSITO}
        viajeStatus="ACTIVO"
        isPending={false}
        hasPendingSync
        onConfirmPickup={vi.fn()}
        onTogglePause={vi.fn()}
        onReportIncident={vi.fn()}
        onConfirmDelivery={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Pausar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Incidente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar entrega/i })).toBeInTheDocument();
    expect(screen.getByText('Sync pendiente')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run TripActionBar test to verify it fails**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/TripActionBar.test.tsx
```

Expected: FAIL because `TripActionBar.tsx` does not exist.

- [ ] **Step 3: Implement TripActionBar**

Create `frontend/src-v6/components/mobile/TripActionBar.tsx`:

```tsx
import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Pause, Play, RotateCcw, Truck } from 'lucide-react';
import { EstadoManifiesto } from '../../types/models';
import { Button } from '../ui/ButtonV2';
import { Badge } from '../ui/BadgeV2';

interface TripActionBarProps {
  estado: EstadoManifiesto;
  viajeStatus: 'ACTIVO' | 'PAUSADO';
  isPending: boolean;
  hasPendingSync: boolean;
  onConfirmPickup: () => void;
  onTogglePause: () => void;
  onReportIncident: () => void;
  onConfirmDelivery: () => void;
}

export const TripActionBar: React.FC<TripActionBarProps> = ({
  estado,
  viajeStatus,
  isPending,
  hasPendingSync,
  onConfirmPickup,
  onTogglePause,
  onReportIncident,
  onConfirmDelivery,
}) => {
  if (estado === EstadoManifiesto.APROBADO) {
    return (
      <div className="sticky bottom-20 z-30 rounded-2xl border border-primary-100 bg-white/95 p-3 shadow-xl backdrop-blur">
        <Button
          fullWidth
          size="lg"
          onClick={onConfirmPickup}
          disabled={isPending}
          leftIcon={isPending ? <Loader2 size={20} className="animate-spin" /> : <Truck size={20} />}
        >
          Confirmar retiro
        </Button>
      </div>
    );
  }

  if (estado !== EstadoManifiesto.EN_TRANSITO) return null;

  return (
    <div className="sticky bottom-20 z-30 space-y-2 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Acciones de campo</span>
        {hasPendingSync && <Badge color="warning" variant="soft" size="sm" dot>Sync pendiente</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onTogglePause}
          disabled={isPending}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-warning-200 bg-warning-50 px-3 text-sm font-bold text-warning-800 disabled:opacity-50"
        >
          {viajeStatus === 'ACTIVO' ? <Pause size={18} /> : <Play size={18} />}
          {viajeStatus === 'ACTIVO' ? 'Pausar' : 'Reanudar'}
        </button>
        <button
          type="button"
          onClick={onReportIncident}
          disabled={isPending}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-error-200 bg-error-50 px-3 text-sm font-bold text-error-800 disabled:opacity-50"
        >
          <AlertTriangle size={18} />
          Incidente
        </button>
      </div>
      <Button
        fullWidth
        size="lg"
        onClick={onConfirmDelivery}
        disabled={isPending}
        leftIcon={isPending ? <Loader2 size={20} className="animate-spin" /> : hasPendingSync ? <RotateCcw size={20} /> : <CheckCircle2 size={20} />}
      >
        Confirmar entrega
      </Button>
    </div>
  );
};

export default TripActionBar;
```

- [ ] **Step 4: Integrate TripActionBar in trip page**

In `frontend/src-v6/pages/transporte/ViajeEnCursoTransportista.tsx`, add:

```tsx
import { TripActionBar } from '../../components/mobile/TripActionBar';
```

Replace the pickup `Button`, the pause/incident grid, and the delivery `Button` with:

```tsx
<TripActionBar
  estado={m.estado}
  viajeStatus={viajeStatus}
  isPending={isActionPending}
  hasPendingSync={gps.hasPending}
  onConfirmPickup={handleConfirmarRetiro}
  onTogglePause={handlePausar}
  onReportIncident={() => setShowIncidenteModal(true)}
  onConfirmDelivery={() => setShowFinalizarModal(true)}
/>
```

Keep the existing modals and mutation handlers unchanged.

- [ ] **Step 5: Run tests**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/TripActionBar.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src-v6/components/mobile/TripActionBar.tsx frontend/src-v6/__tests__/components/mobile/TripActionBar.test.tsx frontend/src-v6/pages/transporte/ViajeEnCursoTransportista.tsx
git commit -m "feat: add android trip action bar"
```

## Task 5: Role Hero And Transportista Trip Queue

**Files:**

- Create: `frontend/src-v6/components/mobile/MobileRoleHero.tsx`
- Create: `frontend/src-v6/components/mobile/TransportistaTripQueue.tsx`
- Test: `frontend/src-v6/__tests__/components/mobile/MobileRoleHero.test.tsx`
- Test: `frontend/src-v6/__tests__/components/mobile/TransportistaTripQueue.test.tsx`
- Modify: `frontend/src-v6/pages/mobile/MobileDashboardPage.tsx`

- [ ] **Step 1: Write role hero test**

Create `frontend/src-v6/__tests__/components/mobile/MobileRoleHero.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MobileRoleHero } from '../../../components/mobile/MobileRoleHero';

describe('MobileRoleHero', () => {
  it('prioritizes transportista field work', () => {
    render(<MobileRoleHero role="TRANSPORTISTA" userName="Transporte Andes" activeCount={1} pendingCount={2} />);

    expect(screen.getByText('Modo transporte')).toBeInTheDocument();
    expect(screen.getByText(/1 viaje activo/i)).toBeInTheDocument();
    expect(screen.getByText(/2 asignados/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run role hero test to verify it fails**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/MobileRoleHero.test.tsx
```

Expected: FAIL because `MobileRoleHero.tsx` does not exist.

- [ ] **Step 3: Implement MobileRoleHero**

Create `frontend/src-v6/components/mobile/MobileRoleHero.tsx`:

```tsx
import React from 'react';
import { ClipboardCheck, FlaskConical, Shield, Truck } from 'lucide-react';
import { Card, CardContent } from '../ui/CardV2';
import { Badge } from '../ui/BadgeV2';

type MobileRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | string;

interface MobileRoleHeroProps {
  role: MobileRole;
  userName: string;
  activeCount: number;
  pendingCount: number;
}

const ROLE_COPY: Record<string, { label: string; title: string; icon: React.ReactNode; className: string }> = {
  TRANSPORTISTA: {
    label: 'Modo transporte',
    title: 'Viajes y GPS primero',
    icon: <Truck size={22} />,
    className: 'from-orange-600 to-amber-500',
  },
  OPERADOR: {
    label: 'Modo operador',
    title: 'Recepcion y tratamiento',
    icon: <FlaskConical size={22} />,
    className: 'from-blue-700 to-cyan-600',
  },
  ADMIN: {
    label: 'Modo control',
    title: 'Alertas y supervision',
    icon: <Shield size={22} />,
    className: 'from-emerald-700 to-green-600',
  },
  GENERADOR: {
    label: 'Modo generador',
    title: 'Manifiestos pendientes',
    icon: <ClipboardCheck size={22} />,
    className: 'from-purple-700 to-indigo-600',
  },
};

export const MobileRoleHero: React.FC<MobileRoleHeroProps> = ({ role, userName, activeCount, pendingCount }) => {
  const copy = ROLE_COPY[role] || ROLE_COPY.ADMIN;

  return (
    <Card className={`overflow-hidden border-none bg-gradient-to-br ${copy.className} text-white shadow-lg`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              {copy.icon}
              {copy.label}
            </div>
            <p className="text-sm text-white/80">Hola, {userName}</p>
            <h2 className="mt-1 text-xl font-black leading-tight">{copy.title}</h2>
          </div>
          <div className="space-y-1 text-right">
            <Badge color="success" variant="solid">{activeCount} viaje{activeCount === 1 ? ' activo' : 's activos'}</Badge>
            <Badge color="warning" variant="solid">{pendingCount} asignado{pendingCount === 1 ? '' : 's'}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MobileRoleHero;
```

- [ ] **Step 4: Write transportista queue test**

Create `frontend/src-v6/__tests__/components/mobile/TransportistaTripQueue.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransportistaTripQueue } from '../../../components/mobile/TransportistaTripQueue';

const activeTrip = { id: 'trip-active', numero: 'M-001', operador: { razonSocial: 'Planta Sur' }, generador: { razonSocial: 'Generador Norte' } };
const pendingTrip = { id: 'trip-pending', numero: 'M-002', operador: { razonSocial: 'Planta Norte' }, generador: { razonSocial: 'Generador Centro' } };

describe('TransportistaTripQueue', () => {
  it('routes to active trip first', () => {
    const onOpenTrip = vi.fn();
    render(<TransportistaTripQueue activeTrips={[activeTrip]} pendingTrips={[pendingTrip]} onOpenTrip={onOpenTrip} />);

    fireEvent.click(screen.getByRole('button', { name: /Ir al viaje M-001/i }));
    expect(onOpenTrip).toHaveBeenCalledWith('trip-active');
  });

  it('shows empty state when there are no trips', () => {
    render(<TransportistaTripQueue activeTrips={[]} pendingTrips={[]} onOpenTrip={vi.fn()} />);

    expect(screen.getByText('Sin viajes asignados')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run transportista queue test to verify it fails**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/TransportistaTripQueue.test.tsx
```

Expected: FAIL because `TransportistaTripQueue.tsx` does not exist.

- [ ] **Step 6: Implement TransportistaTripQueue**

Create `frontend/src-v6/components/mobile/TransportistaTripQueue.tsx`:

```tsx
import React from 'react';
import { ChevronRight, Radio, Truck } from 'lucide-react';
import { Card, CardContent } from '../ui/CardV2';
import { Badge } from '../ui/BadgeV2';

interface TripLike {
  id: string;
  numero?: string;
  operador?: { razonSocial?: string };
  generador?: { razonSocial?: string };
}

interface TransportistaTripQueueProps {
  activeTrips: TripLike[];
  pendingTrips: TripLike[];
  onOpenTrip: (id: string) => void;
}

export const TransportistaTripQueue: React.FC<TransportistaTripQueueProps> = ({ activeTrips, pendingTrips, onOpenTrip }) => {
  if (activeTrips.length === 0 && pendingTrips.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-sm font-bold text-neutral-800">Sin viajes asignados</p>
          <p className="mt-1 text-xs text-neutral-500">Cuando haya un manifiesto aprobado aparecera aqui.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-2" aria-label="Viajes del transportista">
      {activeTrips.map((trip) => {
        const label = trip.numero || trip.id.slice(0, 8);
        return (
          <button
            key={trip.id}
            type="button"
            onClick={() => onOpenTrip(trip.id)}
            aria-label={`Ir al viaje ${label}`}
            className="w-full rounded-2xl border-2 border-success-200 bg-success-50 p-4 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-100 text-success-700">
                  <Radio size={18} className="animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-success-900">Viaje en curso {label}</p>
                  <p className="truncate text-xs text-success-800">Destino: {trip.operador?.razonSocial || '-'}</p>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-success-700" />
            </div>
          </button>
        );
      })}

      {pendingTrips.map((trip) => {
        const label = trip.numero || trip.id.slice(0, 8);
        return (
          <button
            key={trip.id}
            type="button"
            onClick={() => onOpenTrip(trip.id)}
            aria-label={`Abrir viaje asignado ${label}`}
            className="w-full rounded-2xl border border-warning-200 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-700">
                  <Truck size={17} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-neutral-900">{label}</p>
                    <Badge color="warning" variant="soft" size="sm">Retiro pendiente</Badge>
                  </div>
                  <p className="truncate text-xs text-neutral-500">{trip.generador?.razonSocial || '-'}</p>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-neutral-400" />
            </div>
          </button>
        );
      })}
    </section>
  );
};

export default TransportistaTripQueue;
```

- [ ] **Step 7: Integrate hero and queue in mobile dashboard**

In `frontend/src-v6/pages/mobile/MobileDashboardPage.tsx`, add imports:

```tsx
import { MobileRoleHero } from '../../components/mobile/MobileRoleHero';
import { TransportistaTripQueue } from '../../components/mobile/TransportistaTripQueue';
```

Replace the welcome section and the transportista trip assignment blocks with:

```tsx
<MobileRoleHero
  role={currentUser?.rol || 'ADMIN'}
  userName={currentUser?.nombre || 'Usuario'}
  activeCount={activeTrips.length}
  pendingCount={pendingTrips.length}
/>

{isTransportista && (
  <TransportistaTripQueue
    activeTrips={activeTrips.length > 0 ? activeTrips : savedTripSnapshot ? [{ id: savedTripId!, numero: savedTripSnapshot.numero, operador: { razonSocial: savedTripSnapshot.operador }, generador: { razonSocial: savedTripSnapshot.generador } }] : []}
    pendingTrips={pendingTrips}
    onOpenTrip={(tripId) => navigate(mp(`/transporte/viaje/${tripId}`))}
  />
)}
```

Keep stats, quick access, recent activity, and daily summary below the role-specific work queue.

- [ ] **Step 8: Run focused tests**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/MobileRoleHero.test.tsx src-v6/__tests__/components/mobile/TransportistaTripQueue.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src-v6/components/mobile/MobileRoleHero.tsx frontend/src-v6/components/mobile/TransportistaTripQueue.tsx frontend/src-v6/__tests__/components/mobile/MobileRoleHero.test.tsx frontend/src-v6/__tests__/components/mobile/TransportistaTripQueue.test.tsx frontend/src-v6/pages/mobile/MobileDashboardPage.tsx
git commit -m "feat: improve android role dashboard"
```

## Task 6: Operator Mobile Action Queue

**Files:**

- Create: `frontend/src-v6/components/mobile/OperatorActionQueue.tsx`
- Test: `frontend/src-v6/__tests__/components/mobile/OperatorActionQueue.test.tsx`
- Modify: `frontend/src-v6/pages/mobile/MobileDashboardPage.tsx`

- [ ] **Step 1: Write operator queue test**

Create `frontend/src-v6/__tests__/components/mobile/OperatorActionQueue.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EstadoManifiesto } from '../../../types/models';
import { OperatorActionQueue } from '../../../components/mobile/OperatorActionQueue';

const item = { id: 'm1', numero: 'M-300', estado: EstadoManifiesto.ENTREGADO, generador: { razonSocial: 'Generador Sur' }, transportista: { razonSocial: 'Transporte Uno' } };

describe('OperatorActionQueue', () => {
  it('renders receipt action for delivered manifests', () => {
    const onOpen = vi.fn();
    render(<OperatorActionQueue manifiestos={[item]} onOpenManifiesto={onOpen} />);

    expect(screen.getByText('Recepcion pendiente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Abrir manifiesto M-300/i }));
    expect(onOpen).toHaveBeenCalledWith('m1');
  });

  it('renders empty state', () => {
    render(<OperatorActionQueue manifiestos={[]} onOpenManifiesto={vi.fn()} />);

    expect(screen.getByText('Sin acciones de operador')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run operator queue test to verify it fails**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/OperatorActionQueue.test.tsx
```

Expected: FAIL because `OperatorActionQueue.tsx` does not exist.

- [ ] **Step 3: Implement OperatorActionQueue**

Create `frontend/src-v6/components/mobile/OperatorActionQueue.tsx`:

```tsx
import React from 'react';
import { ChevronRight, FlaskConical, Scale } from 'lucide-react';
import { EstadoManifiesto } from '../../types/models';
import { Card, CardContent } from '../ui/CardV2';
import { Badge } from '../ui/BadgeV2';

interface OperatorManifestLike {
  id: string;
  numero?: string;
  estado: EstadoManifiesto;
  generador?: { razonSocial?: string };
  transportista?: { razonSocial?: string };
}

interface OperatorActionQueueProps {
  manifiestos: OperatorManifestLike[];
  onOpenManifiesto: (id: string) => void;
}

function actionLabel(estado: EstadoManifiesto) {
  if (estado === EstadoManifiesto.ENTREGADO) return 'Recepcion pendiente';
  if (estado === EstadoManifiesto.RECIBIDO) return 'Pesaje o tratamiento';
  if (estado === EstadoManifiesto.EN_TRATAMIENTO) return 'Cerrar tratamiento';
  return 'Revisar manifiesto';
}

export const OperatorActionQueue: React.FC<OperatorActionQueueProps> = ({ manifiestos, onOpenManifiesto }) => {
  if (manifiestos.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-sm font-bold text-neutral-800">Sin acciones de operador</p>
          <p className="mt-1 text-xs text-neutral-500">Las recepciones y tratamientos pendientes apareceran aqui.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-2" aria-label="Acciones del operador">
      {manifiestos.map((m) => {
        const label = m.numero || m.id.slice(0, 8);
        return (
          <button
            key={m.id}
            type="button"
            aria-label={`Abrir manifiesto ${label}`}
            onClick={() => onOpenManifiesto(m.id)}
            className="w-full rounded-2xl border border-blue-100 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  {m.estado === EstadoManifiesto.ENTREGADO ? <Scale size={18} /> : <FlaskConical size={18} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-neutral-900">{label}</p>
                    <Badge color="info" variant="soft" size="sm">{actionLabel(m.estado)}</Badge>
                  </div>
                  <p className="truncate text-xs text-neutral-500">{m.generador?.razonSocial || m.transportista?.razonSocial || '-'}</p>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-neutral-400" />
            </div>
          </button>
        );
      })}
    </section>
  );
};

export default OperatorActionQueue;
```

- [ ] **Step 4: Integrate operator queue in mobile dashboard**

In `frontend/src-v6/pages/mobile/MobileDashboardPage.tsx`, add:

```tsx
import { OperatorActionQueue } from '../../components/mobile/OperatorActionQueue';
```

Add operator queries near the transportista queries:

```tsx
const isOperador = currentUser?.rol === 'OPERADOR';
const { data: entregadosOperador } = useManifiestos(
  isOperador ? { estado: EstadoManifiesto.ENTREGADO, limit: 5 } : undefined,
  { enabled: isOperador },
);
const { data: recibidosOperador } = useManifiestos(
  isOperador ? { estado: EstadoManifiesto.RECIBIDO, limit: 5 } : undefined,
  { enabled: isOperador },
);
const operatorQueue = [
  ...(entregadosOperador?.items || []),
  ...(recibidosOperador?.items || []),
];
```

Render below `MobileRoleHero`:

```tsx
{isOperador && (
  <OperatorActionQueue
    manifiestos={operatorQueue}
    onOpenManifiesto={(manifiestoId) => navigate(mp(`/manifiestos/${manifiestoId}`))}
  />
)}
```

- [ ] **Step 5: Run operator queue tests**

Run:

```bash
cd frontend
npm test -- src-v6/__tests__/components/mobile/OperatorActionQueue.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src-v6/components/mobile/OperatorActionQueue.tsx frontend/src-v6/__tests__/components/mobile/OperatorActionQueue.test.tsx frontend/src-v6/pages/mobile/MobileDashboardPage.tsx
git commit -m "feat: add operator android action queue"
```

## Task 7: Android Shell Refinement

**Files:**

- Modify: `frontend/src-v6/layouts/MobileLayout.tsx`
- Test: use existing Playwright visual audit and Android UX spec from Task 8.

- [ ] **Step 1: Strengthen bottom nav labels and active trip surface**

In `frontend/src-v6/layouts/MobileLayout.tsx`, change transportista bottom nav labels in `bottomNavItems`:

```tsx
items.push({
  to: isTransportista ? mp('/transporte/perfil') : mp('/manifiestos'),
  icon: isTransportista ? <Truck size={22} /> : <FileText size={22} />,
  label: isTransportista ? 'Viajes' : 'Manifiestos',
});
```

Replace the active trip banner button with:

```tsx
<button
  onClick={() => navigate(mp(`/transporte/viaje/${activeTripId}`))}
  className="fixed left-3 right-3 bottom-[76px] z-40 flex min-h-[56px] items-center gap-3 rounded-2xl bg-emerald-700 px-4 py-3 text-white shadow-xl active:scale-[0.99]"
  aria-label="Volver al viaje en curso"
>
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
    <Navigation size={20} />
  </div>
  <span className="flex-1 text-left text-sm font-black">Viaje en curso</span>
  <ChevronRight size={18} className="shrink-0 opacity-80" />
</button>
```

- [ ] **Step 2: Prevent active trip page from double headers**

In `MobileLayout`, detect trip mode:

```tsx
const isFieldTripRoute = location.pathname.includes('/transporte/viaje/');
```

Change main padding:

```tsx
<div className={cn('p-4', isFieldTripRoute ? 'pb-6' : 'pb-28')}>
  <Outlet />
</div>
```

Keep the existing page-level header in `ViajeEnCursoTransportista` until that page is split further.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src-v6/layouts/MobileLayout.tsx
git commit -m "feat: refine android mobile shell"
```

## Task 8: Android UX Playwright Coverage

**Files:**

- Create: `frontend/e2e/android-ux.spec.ts`
- Modify: `frontend/e2e/pwa-load.spec.ts`
- Modify: `backend/tests/android-ux-readiness-static-test.sh`

- [ ] **Step 1: Write Android UX E2E spec**

Create `frontend/e2e/android-ux.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASS, loginWithCredentials } from './helpers/auth';

const KNOWN = {
  manifiestoId: 'cmnajhaw206fhga9dgw6pg3qh',
};

async function loginPwa(page: import('@playwright/test').Page) {
  await loginWithCredentials(page, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
    onboardingRole: 'ADMIN',
    startPath: '/app/',
    clickLoginLink: false,
  });
}

test.describe('Android UX field-grade PWA checks', () => {
  test.use({ viewport: { width: 393, height: 873 }, isMobile: true, hasTouch: true });

  test('dashboard has no horizontal overflow and exposes mobile navigation', async ({ page }) => {
    await loginPwa(page);
    await page.goto('/app/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    await expect(page.getByRole('navigation').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test('trip route renders as a field screen and never 404s', async ({ page }) => {
    await loginPwa(page);
    await page.goto(`/app/transporte/viaje/${KNOWN.manifiestoId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const notFound = await page.getByText(/pagina no encontrada|página no encontrada|404/i).first().isVisible().catch(() => false);
    expect(notFound).toBe(false);
    await expect(page.getByText(/Viaje|Retiro|Entrega|Manifiesto/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('common touch targets meet minimum Android size', async ({ page }) => {
    await loginPwa(page);
    await page.goto('/app/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const smallTargets = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a')).filter((el) => {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        const inPrimaryChrome = el.closest('nav, header, main');
        return visible && inPrimaryChrome && (rect.width < 40 || rect.height < 40);
      }).map((el) => ({
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }));
    });

    expect(smallTargets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run Android UX E2E spec**

Run:

```bash
cd frontend
npm run test:e2e -- e2e/android-ux.spec.ts --reporter=line
```

Expected: PASS. If production auth rate-limits, rerun once after the helper retry window.

- [ ] **Step 3: Add field route to PWA load routes**

In `frontend/e2e/pwa-load.spec.ts`, add this route after the existing manifest detail route:

```ts
`/transporte/viaje/${KNOWN.manifiestoId}`,
```

- [ ] **Step 4: Expand static gate**

In `backend/tests/android-ux-readiness-static-test.sh`, expand `required_files`:

```bash
required_files=(
  "docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md"
  "docs/ANDROID_UX_READY_REPORT_2026-05-31.md"
  "docs/superpowers/specs/2026-05-31-android-ux-677-design.md"
  "docs/superpowers/plans/2026-05-31-android-ux-677-implementation.md"
  "frontend/src-v6/components/mobile/AndroidPermissionGuide.tsx"
  "frontend/src-v6/components/mobile/GpsStatusPanel.tsx"
  "frontend/src-v6/components/mobile/TripActionBar.tsx"
  "frontend/src-v6/components/mobile/MobileRoleHero.tsx"
  "frontend/src-v6/components/mobile/TransportistaTripQueue.tsx"
  "frontend/src-v6/components/mobile/OperatorActionQueue.tsx"
  "frontend/e2e/android-ux.spec.ts"
)
```

Add:

```bash
grep -q "GpsStatusPanel" frontend/src-v6/components/mobile/GpsStatusPanel.tsx
grep -q "TripActionBar" frontend/src-v6/components/mobile/TripActionBar.tsx
grep -q "Android UX field-grade PWA checks" frontend/e2e/android-ux.spec.ts
```

- [ ] **Step 5: Run static gate**

Run:

```bash
bash backend/tests/android-ux-readiness-static-test.sh
```

Expected: prints `Android UX readiness static artifacts present`.

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/android-ux.spec.ts frontend/e2e/pwa-load.spec.ts backend/tests/android-ux-readiness-static-test.sh
git commit -m "test: add android ux pwa coverage"
```

## Task 9: Android Emulator QA Evidence

**Files:**

- Modify: `docs/ANDROID_UX_READY_REPORT_2026-05-31.md`
- Modify: `docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md`
- Optional source APK: `/private/tmp/sitrep-android-twa-build/app-release-signed.apk`

- [ ] **Step 1: Confirm adb target**

Run:

```bash
adb devices
```

Expected: at least one emulator or device in `device` state.

- [ ] **Step 2: Install APK**

Run:

```bash
adb install -r /private/tmp/sitrep-android-twa-build/app-release-signed.apk
```

Expected: `Success`.

- [ ] **Step 3: Launch app**

Run:

```bash
adb shell am start -n ar.com.ultimamilla.sitrep/.LauncherActivity
```

Expected: Android reports `Status: ok` or the app opens without shell error.

- [ ] **Step 4: Capture launch evidence**

Run:

```bash
adb exec-out screencap -p > /private/tmp/sitrep-android-ux-launch.png
adb shell uiautomator dump /sdcard/sitrep-android-ux-launch.xml
adb exec-out cat /sdcard/sitrep-android-ux-launch.xml > /private/tmp/sitrep-android-ux-launch.xml
adb logcat -b crash -d > /private/tmp/sitrep-android-ux-logcat.txt
```

Expected: screenshot file exists, UI XML exists, crash log has no SITREP fatal crash.

- [ ] **Step 5: Sign in and capture dashboard and trip evidence**

Use the quick-login buttons from the Android UI tree. Run:

```bash
adb shell uiautomator dump /sdcard/sitrep-android-ux-login.xml
adb exec-out cat /sdcard/sitrep-android-ux-login.xml > /private/tmp/sitrep-android-ux-login.xml
coords="$(python3 /Users/santosma/.codex/plugins/cache/openai-curated/test-android-apps/fef63ecf/skills/android-emulator-qa/scripts/ui_pick.py /private/tmp/sitrep-android-ux-login.xml "Transportista")"
adb shell input tap $coords
adb shell uiautomator dump /sdcard/sitrep-android-ux-login-filled.xml
adb exec-out cat /sdcard/sitrep-android-ux-login-filled.xml > /private/tmp/sitrep-android-ux-login-filled.xml
coords="$(python3 /Users/santosma/.codex/plugins/cache/openai-curated/test-android-apps/fef63ecf/skills/android-emulator-qa/scripts/ui_pick.py /private/tmp/sitrep-android-ux-login-filled.xml "Ingresar")"
adb shell input tap $coords
sleep 8
```

Capture dashboard:

```bash
adb exec-out screencap -p > /private/tmp/sitrep-android-ux-dashboard.png
adb shell uiautomator dump /sdcard/sitrep-android-ux-dashboard.xml
adb exec-out cat /sdcard/sitrep-android-ux-dashboard.xml > /private/tmp/sitrep-android-ux-dashboard.xml
```

Open trip mode with the production deep link and capture it:

```bash
adb shell am start -a android.intent.action.VIEW -d "https://sitrep.ultimamilla.com.ar/app/transporte/viaje/cmnajhaw206fhga9dgw6pg3qh" ar.com.ultimamilla.sitrep
sleep 5
adb exec-out screencap -p > /private/tmp/sitrep-android-ux-trip.png
adb shell uiautomator dump /sdcard/sitrep-android-ux-trip.xml
adb exec-out cat /sdcard/sitrep-android-ux-trip.xml > /private/tmp/sitrep-android-ux-trip.xml
```

Expected: dashboard and trip screenshots show SITREP authenticated UI, not browser error pages.

- [ ] **Step 6: Update final report evidence table**

Edit `docs/ANDROID_UX_READY_REPORT_2026-05-31.md` and replace `Pending QA run` cells with `Pass` or `Blocked: <specific reason>`. Include a short `Logcat Summary` section:

```markdown
## Logcat Summary

- Crash buffer: no SITREP fatal crash observed during launch/dashboard/trip capture.
- App process logs: Android TWA rendered authenticated PWA surfaces.
```

If a flow is blocked by auth, rate limiting, missing emulator, or unavailable test data, record the exact blocker and the command output that proves it.

- [ ] **Step 7: Update gap matrix**

For each matrix row in `docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md`, update the `Evidence` and `Resolution Target` columns with the implemented file or captured artifact path.

- [ ] **Step 8: Commit**

```bash
git add docs/ANDROID_UX_READY_REPORT_2026-05-31.md docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md
git commit -m "docs: record android ux emulator evidence"
```

## Task 10: Final Verification

**Files:**

- Verify all files changed in this plan.

- [ ] **Step 1: Run unit tests**

Run:

```bash
cd frontend
npm test
```

Expected: all Vitest files pass.

- [ ] **Step 2: Run production build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Run Android UX E2E**

Run:

```bash
cd frontend
npm run test:e2e -- e2e/android-ux.spec.ts --reporter=line
```

Expected: all Android UX PWA checks pass.

- [ ] **Step 4: Run full PWA E2E**

Run:

```bash
cd frontend
npm run test:e2e -- --reporter=line
```

Expected: full Playwright suite passes. If production rate limiting blocks a login after helper retry, record the exact failed test and rerun once after 65 seconds.

- [ ] **Step 5: Run static readiness gate**

Run:

```bash
bash backend/tests/android-ux-readiness-static-test.sh
```

Expected: prints `Android UX readiness static artifacts present`.

- [ ] **Step 6: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: exits 0.

- [ ] **Step 7: Commit final verification docs if changed**

If Task 10 changes the final report, run:

```bash
git add docs/ANDROID_UX_READY_REPORT_2026-05-31.md docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md
git commit -m "docs: finalize android ux readiness report"
```

If no files changed, do not create an empty commit.

## Task 11: Publish Review Branch

**Files:**

- Use the branch created for this work.

- [ ] **Step 1: Inspect final diff**

Run:

```bash
git status --short
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
```

Expected: only Android UX implementation, tests, and reports are included.

- [ ] **Step 2: Push branch**

Run:

```bash
git push -u origin codex/android-ux-677-spec
```

Expected: branch pushes to GitHub.

- [ ] **Step 3: Create draft PR**

Create `/private/tmp/android-ux-677-pr-body.md` with:

```markdown
## Summary

- Improves Android/PWA field UX for transportista and operador flows.
- Adds GPS permission/sync components, mobile role dashboard, and Android UX E2E coverage.
- Documents Android emulator QA evidence and remaining gaps.

## Verification

- `npm test`
- `npm run build`
- `npm run test:e2e -- e2e/android-ux.spec.ts --reporter=line`
- `bash backend/tests/android-ux-readiness-static-test.sh`
- `git diff --check`
```

Then run:

```bash
gh pr create --draft --title "[codex] improve android ux field mode" --body-file /private/tmp/android-ux-677-pr-body.md --base main --head codex/android-ux-677-spec
```

Expected: GitHub returns a PR URL.

## Self-Review Checklist

- Spec coverage: Tasks 1 and 9 cover audit/evidence, Tasks 2-4 cover GPS and transportista field mode, Task 5 covers role dashboard, Task 6 covers operator mobile actions, Task 7 covers Android shell, Task 8 covers PWA E2E, Task 10 covers verification, Task 11 covers publication.
- No backend workflow changes are required.
- No native Android rewrite is included.
- Every new component has a focused test.
- Emulator artifacts stay under `/private/tmp` and are referenced in docs, not committed.
