# SITREP Android UX 677% Design

## Goal

Convert SITREP Android from a functional TWA/PWA wrapper into a field-grade mobile app experience for transportistas, operadores, and administrators. The work builds on the completed security, quality, Android readiness, APK, and E2E baseline, and focuses on making the Android experience feel reliable, tactile, fast, and operationally native.

The "677%" target is treated as a measurable improvement program rather than a literal visual claim: the implementation must reduce critical flow friction, close Android-specific UX gaps, and produce emulator-backed evidence for the app's core field workflows.

## Baseline Integration

The previous GOAL, "Auditar seguridad y calidad de SITREP...", is complete and becomes the baseline for this initiative. That baseline provides:

- Security and quality audit coverage across backend, frontend web/PWA, and Android experience.
- Production-oriented E2E coverage for web/PWA.
- Android readiness evidence, APK/TWA validation artifacts, and current runbooks.
- A known signed APK artifact for internal Android testing.

This GOAL does not replace that work. It raises the product bar from "ready to test" to "credible as a real Android field app."

## Target Users

### Transportista

Primary Android user. Needs a high-confidence trip mode that works under field constraints: glare, movement, intermittent connectivity, GPS permission prompts, urgent incidents, and repeated start/stop interactions.

### Operador

Needs fast mobile access to receive, inspect, weigh, treat, reject, and close manifests. The UX must make status, pending actions, and evidence capture obvious.

### Administrador

Needs mobile oversight, not full desktop parity. The Android UI should prioritize monitoring, alerts, quick search, and actor/manifiesto inspection, while heavier CRUD can remain optimized for web.

## Experience Principles

1. Field first: trip, GPS, incident, delivery, receive, and sync states take priority over generic dashboards.
2. Native-feeling interactions: large touch targets, persistent bottom navigation, predictable Android back behavior, clear loading states, and immediate tap feedback.
3. Trust under poor connectivity: offline queue, failed sync, retry, and reconnect states must be visible and understandable.
4. Role clarity: each role lands on a screen that answers "what do I need to do now?"
5. No hidden operational state: GPS permission, GPS accuracy, active trip, paused trip, pending updates, and sync health must be surfaced.
6. Stable visual density: mobile screens must avoid desktop-style tables, cramped cards, clipped labels, and controls that shift after data loads.

## Recommended Approach

Use the existing React/Vite PWA and TWA architecture, but introduce Android-focused UX surfaces inside the PWA app. This avoids a risky native rewrite while still giving Android users app-grade workflows.

Rejected alternatives:

- Full native rewrite: higher ceiling, but not justified before proving the operational flow with the current deployed app and existing codebase.
- Pure visual polish: improves screenshots but does not close the operational gaps around GPS, offline, permissions, and field workflows.

## Product Scope

### Phase 1: Android UX Audit

Audit the installed APK/TWA in an Android emulator with adb-driven evidence:

- Install and launch signed APK.
- Capture login, role dashboard, trip list, active trip, GPS permission, offline, reconnect, and error states.
- Capture screenshots, UI tree dumps, and logcat.
- Produce a gap matrix with severity: blocker, high friction, polish, technical debt.

### Phase 2: Mobile Navigation Foundation

Create a stronger Android app shell:

- Bottom navigation for primary mobile destinations.
- Role-aware start screen.
- Predictable Android back behavior.
- Safe-area and viewport handling for TWA/mobile browser.
- Consistent app-level loading, empty, error, and offline banners.

### Phase 3: Transportista Field Mode

Redesign the transportista trip experience around an operational "field mode":

- Active trip header with manifest number, current state, next action, GPS status, and sync state.
- Large primary action per state: Confirmar Retiro, Finalizar Entrega, Reintentar Sync.
- Secondary actions grouped as icon buttons: pause/resume, incident, call/contact, map recenter.
- GPS status component with permission, acquiring, active, degraded, denied, unavailable, and offline states.
- Pending GPS updates visible with count and last sync time.
- Incident and pause flows optimized for one-handed use.

### Phase 4: Operador Mobile Actions

Improve mobile flows for operator tasks:

- Pending receipts and treatment queue as scannable cards, not dense tables.
- Clear action rail for Recibir, Rechazar, Registrar Pesaje, Registrar Tratamiento, Cerrar.
- Confirmation sheets that show the operational consequence before submitting.
- Error recovery when workflow state changed on another device.

### Phase 5: Android Permission And Install UX

Make Android-specific prompts recoverable:

- Pre-permission education screen for GPS and notifications.
- Denied permission recovery with Android settings guidance.
- Installability and trusted app checks documented in app-ready report.
- Splash/icon/manifest review for consistent SITREP identity.

### Phase 6: Performance And Visual QA

Validate perceived quality:

- Skeletons for dashboard, trip, manifests, and map load.
- Stable card heights for dynamic state changes.
- No clipped text in Spanish labels.
- Minimum touch targets of 44 CSS px for common actions.
- Map and chart screens must not block the primary field workflow.

## Architecture

The Android UX remains inside the PWA app served under `/app/` and packaged by the existing TWA. Implementation should favor existing `src-v6` patterns, hooks, services, and UI components.

Expected component boundaries:

- `MobileShell`: role-aware navigation, offline banner, Android-safe layout frame.
- `TransportistaFieldMode`: trip-focused orchestration for active and assigned trips.
- `GpsStatusPanel`: visual state machine for permission, acquisition, accuracy, offline queue, and sync.
- `TripActionBar`: primary and secondary trip actions with stable touch targets.
- `OperatorActionQueue`: operator mobile work queue with state-specific actions.
- `AndroidPermissionGuide`: recoverable permission and notification guidance.

Data should continue to flow through the existing services and hooks:

- `useManifiestos` for assigned, active, and terminal-state trips.
- GPS tracking hooks and local persistence for pending updates.
- Connectivity hook for online/offline and sync retry.
- Existing auth context for role and session state.

## Error Handling

Every critical mobile action must show one of these states:

- Pending: action is in flight and cannot be double-submitted.
- Success: state changed and next action is visible.
- Recoverable failure: retry is available and the original data is preserved.
- Permission blocked: recovery path is explicit.
- Conflict: backend state differs from local state and the screen refreshes before another action.

The Android UI must not silently fail when GPS, network, or workflow transitions fail.

## Testing Strategy

### Android Emulator QA

Use adb-driven validation:

- `adb install -r <apk>`
- Launch package/activity.
- Capture screenshots and UI tree dumps for login, dashboard, trip mode, GPS, offline, reconnect.
- Capture `logcat -b crash` and app process logs.
- Use mocked location where needed to validate GPS active state.

### Web/PWA E2E

Keep the production Playwright suite green:

- Auth and dashboard smoke.
- PWA routing.
- Full crawl.
- Rapid PWA navigation.
- Visual audit multi-viewport.

### Unit And Build Gates

Run frontend unit tests and production build after implementation:

- `npm test`
- `npm run build`
- Android static readiness scripts where applicable.

## Acceptance Criteria

The GOAL is complete only when all of the following are true:

- APK installs and launches on Android emulator.
- Login, role dashboard, and transportista field mode render without crash.
- "Tomar Viaje -> GPS -> Pausa/Incidente -> Entrega" is validated or explicitly blocked by test data constraints with evidence.
- GPS permission denied and allowed states are visible and recoverable.
- Offline queue state is visible, and reconnect flush behavior is validated or documented with blocker evidence.
- Android back behavior does not eject users from active trip unexpectedly.
- Core Android screens have no severe text clipping, overlapping controls, or unreachable actions.
- `npm test`, `npm run build`, and PWA E2E pass or any failure is documented as unrelated with evidence.
- Final report includes screenshots, UI dumps, logcat summary, closed gaps, remaining gaps, and APK path for testing.

## Out Of Scope

- Rewriting SITREP as a fully native Android app.
- Replacing the backend workflow model.
- Redesigning the desktop admin experience beyond what is required for mobile consistency.
- Adding new business states to the manifest workflow without a separate backend/product decision.

## Deliverables

- Android UX gap matrix.
- Mobile-first implementation plan.
- Updated Android QA runbook if flows or APK paths change.
- Implemented Android/PWA UI improvements.
- Emulator evidence artifacts.
- Final Android UX readiness report.
