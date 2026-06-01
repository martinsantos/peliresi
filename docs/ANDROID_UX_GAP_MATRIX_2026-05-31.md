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
| Android install | APK install and launch evidence must be refreshed after UX changes | High friction | `/private/tmp/sitrep-android-ux-launch.png`, `/private/tmp/sitrep-android-ux-dashboard.png`; `adb install -r` returned `Success` | Pass for APK shell; rerun after deployment of branch UI to production origin |
| Mobile navigation | Active field task must remain visible outside trip page | High friction | `frontend/src-v6/layouts/MobileLayout.tsx`; unit coverage in `frontend/src-v6/__tests__/layouts/MobileLayout.test.tsx`; dashboard screenshot `/private/tmp/sitrep-android-ux-dashboard.png` | Implemented: stronger active-trip surface and field-route spacing |
| Transportista trip | GPS, sync, pause, incident, and delivery actions are mixed in one large page | High friction | `frontend/src-v6/components/mobile/GpsStatusPanel.tsx`; `frontend/src-v6/components/mobile/TripActionBar.tsx`; trip deep-link screenshot `/private/tmp/sitrep-android-ux-trip.png` | Implemented in source; production trip test data did not expose GPS-active state |
| GPS/offline | Pending GPS queue count is not reliably observable by React renders | High friction | `frontend/src-v6/hooks/useGPSTracking.ts`; `frontend/src-v6/__tests__/hooks/useGPSTracking.test.tsx` | Implemented: state-backed `pendingCount`, `hasPending`, and `lastSyncAt` |
| Operador mobile | Operator actions are not first-class on Android dashboard | High friction | `frontend/src-v6/components/mobile/OperatorActionQueue.tsx`; `frontend/src-v6/__tests__/pages/mobile/MobileDashboardPage.test.tsx` covers `EN_TRATAMIENTO` queue count | Implemented: operator action queue for `ENTREGADO`, `RECIBIDO`, and `EN_TRATAMIENTO` |
| Android permissions | Permission recovery text is embedded in GPS panel only | Polish | `frontend/src-v6/components/mobile/AndroidPermissionGuide.tsx`; `/private/tmp/sitrep-android-ux-package.txt` shows GPS runtime permissions denied in emulator | Implemented reusable guide; end-to-end permission prompt still needs active GPS trip seed |

## Evidence Artifacts

Artifacts produced during execution must be stored outside the repo under `/private/tmp` and referenced in the final report.
