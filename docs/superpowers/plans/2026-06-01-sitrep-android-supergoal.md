# SITREP Android Supergoal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate security, quality, web/PWA, Android readiness, and Android UX goals into one field-app program and ship the first production-safe UI increment.

**Architecture:** Keep SITREP Android inside the existing React/Vite PWA under `/app/`. Add a small mobile component that reads existing auth, connectivity, and manifest queue state without changing backend contracts.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Vitest, Playwright Android/PWA checks.

---

## File Structure

- Create `docs/superpowers/specs/2026-06-01-sitrep-android-supergoal-design.md`: unified GOAL design.
- Create `docs/superpowers/plans/2026-06-01-sitrep-android-supergoal.md`: this implementation plan.
- Create `frontend/src-v6/components/mobile/AndroidFieldReadinessPanel.tsx`: mobile readiness score component.
- Create `frontend/src-v6/__tests__/components/mobile/AndroidFieldReadinessPanel.test.tsx`: component unit tests.
- Modify `frontend/src-v6/pages/mobile/MobileDashboardPage.tsx`: wire readiness panel into the dashboard.
- Modify `frontend/src-v6/__tests__/pages/mobile/MobileDashboardPage.test.tsx`: mock connectivity and assert panel integration.

## Task 1: Supergoal Documents

- [x] **Step 1: Write unified design spec**

Create `docs/superpowers/specs/2026-06-01-sitrep-android-supergoal-design.md` with baseline, outcomes, first increment, and acceptance criteria.

- [x] **Step 2: Write implementation plan**

Create `docs/superpowers/plans/2026-06-01-sitrep-android-supergoal.md` with file structure, tasks, and verification commands.

## Task 2: Android Field Readiness Panel

- [x] **Step 1: Write readiness panel unit tests**

Create `frontend/src-v6/__tests__/components/mobile/AndroidFieldReadinessPanel.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AndroidFieldReadinessPanel } from '../../../components/mobile/AndroidFieldReadinessPanel';

describe('AndroidFieldReadinessPanel', () => {
  it('shows ready status when connection, queue and app mode are healthy', () => {
    render(
      <AndroidFieldReadinessPanel
        role="TRANSPORTISTA"
        isOnline
        isApiReachable
        activeCount={1}
        pendingCount={0}
        isStandalone
      />,
    );

    expect(screen.getByText('Score operativo Android')).toBeInTheDocument();
    expect(screen.getByText('3/3 listo')).toBeInTheDocument();
    expect(screen.getByText('Viaje activo disponible')).toBeInTheDocument();
  });

  it('shows degraded status when offline and without assigned work', () => {
    render(
      <AndroidFieldReadinessPanel
        role="OPERADOR"
        isOnline={false}
        isApiReachable={false}
        activeCount={0}
        pendingCount={0}
        isStandalone={false}
      />,
    );

    expect(screen.getByText('1/3 listo')).toBeInTheDocument();
    expect(screen.getByText('Sin conexion operativa')).toBeInTheDocument();
    expect(screen.getByText('Sin acciones pendientes')).toBeInTheDocument();
    expect(screen.getByText('Abrir como app instalada')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run readiness panel test and verify it fails**

Run:

```bash
cd frontend && npm test -- src-v6/__tests__/components/mobile/AndroidFieldReadinessPanel.test.tsx
```

Expected: fails because the component does not exist.

- [x] **Step 3: Implement `AndroidFieldReadinessPanel`**

Create `frontend/src-v6/components/mobile/AndroidFieldReadinessPanel.tsx` using existing `CardV2` and `BadgeV2`. The component must calculate a 0-3 readiness score from connection/API, actionable queue, and Android app-shell availability, while showing standalone mode as an advisory.

- [x] **Step 4: Run readiness panel test and verify it passes**

Run:

```bash
cd frontend && npm test -- src-v6/__tests__/components/mobile/AndroidFieldReadinessPanel.test.tsx
```

Expected: test file passes.

## Task 3: Mobile Dashboard Integration

- [x] **Step 1: Mock connectivity in `MobileDashboardPage` test**

Modify `frontend/src-v6/__tests__/pages/mobile/MobileDashboardPage.test.tsx` with:

```tsx
vi.mock('../../../hooks/useConnectivity', () => ({
  useConnectivity: () => ({
    isOnline: true,
    isApiReachable: true,
    lastOnline: new Date('2026-06-01T00:00:00Z'),
  }),
}));
```

- [x] **Step 2: Add readiness panel assertion**

Add:

```tsx
expect(screen.getByText('Score operativo Android')).toBeInTheDocument();
```

- [x] **Step 3: Wire panel into `MobileDashboardPage`**

Import `AndroidFieldReadinessPanel` and `useConnectivity`, then render the panel after `MobileRoleHero`.

- [x] **Step 4: Run dashboard test**

Run:

```bash
cd frontend && npm test -- src-v6/__tests__/pages/mobile/MobileDashboardPage.test.tsx
```

Expected: passes.

## Task 4: Final Verification

- [x] **Step 1: Run focused unit tests**

```bash
cd frontend && npm test -- src-v6/__tests__/components/mobile/AndroidFieldReadinessPanel.test.tsx src-v6/__tests__/pages/mobile/MobileDashboardPage.test.tsx
```

Expected: passes.

- [x] **Step 2: Run all frontend unit tests**

```bash
cd frontend && npm test
```

Expected: passes.

- [x] **Step 3: Build main frontend**

```bash
cd frontend && npm run build
```

Expected: passes.

- [x] **Step 4: Build PWA app**

```bash
cd frontend && npx vite build --config vite.config.app.ts
```

Expected: passes.

- [x] **Step 5: Run Android static gate**

```bash
bash backend/tests/android-ux-readiness-static-test.sh
```

Expected: prints `Android UX readiness static artifacts present`.

- [x] **Step 6: Run diff check**

```bash
git diff --check
```

Expected: exits 0.

## Task 5: Android Field App Manifest Shortcuts

- [x] **Step 1: Write manifest shortcut static test**

Create `backend/tests/android-field-app-manifest-static-test.sh` to validate the Android/PWA manifest has app-grade properties and field launcher shortcuts.

Expected RED result before implementation:

```bash
bash backend/tests/android-field-app-manifest-static-test.sh
```

Fails with `field app must expose at least three Android shortcuts`.

- [x] **Step 2: Add field shortcuts to `manifest-app.json`**

Add shortcuts for:

- `Panel de campo` -> `/app/dashboard?source=shortcut-field`
- `Escanear QR` -> `/app/escaner-qr?source=shortcut-qr`
- `Centro de control` -> `/app/centro-control?source=shortcut-control`

- [x] **Step 3: Verify manifest shortcut gate**

```bash
bash backend/tests/android-field-app-manifest-static-test.sh
```

Expected: prints `Android field app manifest shortcuts present`.

- [x] **Step 4: Run final verification**

```bash
cd frontend && npm test
cd frontend && npm run build
cd frontend && npx vite build --config vite.config.app.ts
bash backend/tests/android-ux-readiness-static-test.sh
bash backend/tests/android-field-app-manifest-static-test.sh
git diff --check
```

Expected: all pass before merge/deploy.
