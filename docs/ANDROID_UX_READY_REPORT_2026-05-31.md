# SITREP Android UX Ready Report - 2026-05-31

## Goal

Validate that the SITREP Android TWA/PWA behaves like a field-grade mobile app for transportistas, operadores, and administrators.

## Build Under Test

- APK path: `/private/tmp/sitrep-android-twa-build/app-release-signed.apk`
- Package: `ar.com.ultimamilla.sitrep`
- Web origin: `https://sitrep.ultimamilla.com.ar/app/`
- Emulator: `emulator-5554` (`sitrep_pixel7_api35`)
- Note: the installed APK is a TWA shell for the production origin. Local branch UI changes are covered by the Playwright `/app/` build evidence; emulator evidence confirms Android install, launch, authenticated shell, and production deep-link behavior.

## UX Changes Covered

- Mobile role home screen.
- Transportista field mode.
- GPS permission and sync feedback.
- Operator mobile action queue.
- Android/PWA E2E route and visual checks.

## Emulator Evidence

| Flow | Screenshot | UI Dump | Logcat | Result |
| --- | --- | --- | --- | --- |
| Install and launch | `/private/tmp/sitrep-android-ux-launch.png` | `/private/tmp/sitrep-android-ux-launch.xml` | `/private/tmp/sitrep-android-ux-logcat.txt` | Pass: APK installed with `adb install -r`, TWA launched via `.LauncherActivity` |
| Dashboard | `/private/tmp/sitrep-android-ux-dashboard.png` | `/private/tmp/sitrep-android-ux-dashboard.xml` | `/private/tmp/sitrep-android-ux-logcat.txt` | Pass: authenticated SITREP mobile dashboard rendered |
| Trip mode | `/private/tmp/sitrep-android-ux-trip.png` | `/private/tmp/sitrep-android-ux-trip.xml` | `/private/tmp/sitrep-android-ux-logcat.txt` | Pass: production deep link rendered manifiesto `2026-000150` without 404 |
| GPS permission | `/private/tmp/sitrep-android-ux-gps.png` | `/private/tmp/sitrep-android-ux-gps.xml`; `/private/tmp/sitrep-android-ux-package.txt` | `/private/tmp/sitrep-android-ux-logcat.txt` | Blocked: production deep-link manifest did not enter GPS-active state; runtime `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` permissions remain `granted=false` |

## Logcat Summary

- Crash buffer: `/private/tmp/sitrep-android-ux-logcat.txt` was empty after launch/dashboard/trip capture, so no Android crash-buffer fatal was observed.
- App shell: `adb shell cmd package resolve-activity --brief -c android.intent.category.LAUNCHER ar.com.ultimamilla.sitrep` resolved `ar.com.ultimamilla.sitrep/.LauncherActivity`.
- Install: `adb install -r /private/tmp/sitrep-android-twa-build/app-release-signed.apk` returned `Success`.
- Permissions: `/private/tmp/sitrep-android-ux-package.txt` shows `android.permission.ACCESS_FINE_LOCATION: granted=false` and `android.permission.ACCESS_COARSE_LOCATION: granted=false`.

## Verification Commands

These are final GOAL gates. The Android UX E2E command becomes runnable after Task 8 creates `frontend/e2e/android-ux.spec.ts`; until then, Task 1 is verified by the static gate.

- `cd frontend && npm test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e -- e2e/android-ux.spec.ts --project=mobile --reporter=line`
- `bash backend/tests/android-ux-readiness-static-test.sh`
- `git diff --check`

## Remaining Gaps

- GPS permission UI still needs a production/seeded `EN_TRANSITO` or `APROBADO` transportista scenario to validate Android permission prompts end-to-end in the TWA.
- The installed APK points to the production web origin, so branch-local UX changes are validated by local Playwright PWA evidence until deployed.
