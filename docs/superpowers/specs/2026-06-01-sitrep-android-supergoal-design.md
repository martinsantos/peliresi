# SITREP Android Supergoal Design - 2026-06-01

## Unified GOAL

Turn SITREP into a trusted Android field app while preserving the deployed web/PWA architecture. This GOAL integrates the completed security and quality audit, Android APK readiness, PWA routing work, Android UX 677 work, and the production deployment that merged PR #11.

The target is not a cosmetic percentage claim. "677%" means a measurable jump in field reliability: fewer taps to act, clearer operational state, stronger offline/GPS confidence, production E2E evidence, and UI surfaces that feel like an Android app rather than a desktop web page inside a wrapper.

## Baseline

- Security and quality audit GOAL: completed.
- Android readiness and APK/TWA testing: completed with evidence.
- Android UX 677 PR: merged and deployed to production.
- Production verification after deploy: `/`, `/app/`, `/api/health`, service worker v27, and Android UX E2E passed.

## Integrated Outcomes

1. Security remains visible in the product workflow: role scoping, auth state, workflow actions, and offline queues must not hide failure or trust state.
2. Quality becomes measurable: unit tests, PWA E2E, Android emulator evidence, static gates, and production smoke checks are part of the definition of done.
3. Web/PWA and Android stay aligned: `/app/` is the Android source of truth, and TWA APK quality depends on production PWA quality.
4. Android UX becomes field-first: transportistas and operadores land on "what do I do now?" rather than generic dashboard data.
5. App confidence is surfaced: users can see online/API status, work queue readiness, app mode, and critical next actions.

## Product Strategy

Use the existing React/Vite PWA under `/app/` and continue packaging it through the TWA. Avoid a native rewrite until the current field workflows prove they need platform APIs that cannot be solved through the PWA.

Recommended execution path:

1. Add a mobile readiness surface to show Android operational confidence.
2. Continue improving transportista field mode and operador queues.
3. Add seeded or mocked GPS permission scenarios so the remaining Android permission blocker can be validated.
4. Keep all Android/PWA work behind unit, build, static, and E2E gates.
5. Update final reports after each production-impacting deploy.

## First Increment

Add an `AndroidFieldReadinessPanel` to the mobile dashboard. It summarizes:

- Connection and API reachability.
- Whether the current role has actionable work.
- Whether the app is running in standalone/TWA-like mode or browser mode.
- A simple readiness score that operators can understand quickly.

This increment is intentionally small and production-safe. It does not change backend contracts, workflow states, authentication, or data ownership rules.

## Acceptance Criteria

- Mobile dashboard shows an Android operational readiness panel.
- Transportista and operador users see role-aware queue readiness.
- Offline/API degraded state is visible.
- Unit tests cover ready and degraded states.
- Existing Android UX E2E remains green.
- `npm test`, `npm run build`, PWA build, static Android gate, and `git diff --check` pass before merge.

## Out Of Scope

- Native Android rewrite.
- New manifest workflow states.
- Backend schema changes.
- Reworking desktop admin pages.
