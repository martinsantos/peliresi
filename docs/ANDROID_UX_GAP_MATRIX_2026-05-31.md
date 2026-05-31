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
