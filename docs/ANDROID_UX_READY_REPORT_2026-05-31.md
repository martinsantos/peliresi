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

These are final GOAL gates. The Android UX E2E command becomes runnable after Task 8 creates `frontend/e2e/android-ux.spec.ts`; until then, Task 1 is verified by the static gate.

- `cd frontend && npm test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e -- e2e/android-ux.spec.ts --reporter=line`
- `bash backend/tests/android-ux-readiness-static-test.sh`
- `git diff --check`

## Remaining Gaps

The implementation team must update this section after emulator QA with any gaps that remain open.
