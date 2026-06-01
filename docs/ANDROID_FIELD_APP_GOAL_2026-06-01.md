# SITREP Android Field App GOAL - 2026-06-01

## Objective

Continue the documented Android Supergoal by moving SITREP from a mobile PWA that can be installed toward an Android field app that exposes operational entry points from the launcher.

## Increment Shipped

The app manifest now exposes Android/PWA shortcuts for the highest-frequency field actions:

| Shortcut | URL | Purpose |
| --- | --- | --- |
| Panel de campo | `/app/dashboard?source=shortcut-field` | Open the role-aware field dashboard directly. |
| Escanear QR | `/app/escaner-qr?source=shortcut-qr` | Open QR verification/scanning without navigating through the dashboard. |
| Centro de control | `/app/centro-control?source=shortcut-control` | Open operations monitoring for active trips and alerts. |

The root service worker cache was bumped to `trazabilidad-rrpp-v29` / `runtime-cache-v29` so production clients can move onto the new web app metadata after deployment.

## Verification Evidence

| Gate | Result |
| --- | --- |
| Manifest shortcut RED test | Failed first with `field app must expose at least three Android shortcuts`. |
| `bash backend/tests/android-field-app-manifest-static-test.sh` | Passed: `Android field app manifest shortcuts present`. |
| `bash backend/tests/android-ux-readiness-static-test.sh` | Passed: `Android UX readiness static artifacts present`. |
| `cd frontend && npm test` | Passed: 15 test files, 84 tests. |
| `cd frontend && npm run build` | Passed. |
| `cd frontend && npx vite build --config vite.config.app.ts` | Passed. |
| Local `/app/manifest-app.json` check | Passed: manifest served with all three shortcuts. |
| Local Android UX E2E | Passed: 3/3 mobile Playwright tests. |
| `git diff --check` | Passed. |

## Remaining Android Gap

The signed APK at `/private/tmp/sitrep-android-twa-build/app-release-signed.apk` still needs to be rebuilt from the updated manifest/TWA source before launcher shortcuts are available in the APK itself. Chrome-installed PWA users can use the shortcuts once the updated `/app/manifest-app.json` is deployed and the install metadata refreshes.
