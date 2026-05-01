# SITREP — Testing Strategy

## Test Suite Overview

| Suite | Framework | Location | Count | Runtime |
|-------|-----------|----------|-------|---------|
| Backend Unit | Vitest | `backend/src/__tests__/` | 70 | ~500ms |
| Frontend Unit | Vitest | `frontend/src-v6/__tests__/` | 63 | ~2.5s |
| E2E | Playwright | `frontend/e2e/` | 13 | ~30s |
| API Smoke | Bash/curl | `backend/tests/` | 124+ | ~60s |
| Blockchain Compile | Hardhat | `blockchain/` | 1 contract | ~2s |

**Total: 270+ automated tests/checks**

## Running Tests

```bash
# Backend unit tests
cd backend && npm test

# Frontend unit tests
cd frontend && npm test

# Frontend lint + production build
cd frontend && npm run lint
cd frontend && npm run build

# Blockchain compile
cd blockchain && npm run compile

# Frontend E2E (requires production or local server)
cd frontend && npm run test:e2e

# All tests (orchestrated)
bash scripts/test-all.sh

# Certification runner profiles
bash scripts/certification/run-certification-suite.sh quick
RUN_PROFILE=post-deploy bash scripts/certification/run-certification-suite.sh
RUN_PROFILE=production-smoke bash scripts/certification/run-certification-suite.sh
RUN_PROFILE=certification ALLOW_AUTOFIX=true bash scripts/certification/run-certification-suite.sh

# With coverage
cd backend && npm run test:coverage
cd frontend && npm run test:coverage

# Watch mode (development)
cd backend && npm run test:watch
cd frontend && npm run test:watch
```

## Backend Tests

### Structure
```
backend/src/__tests__/
  setup.ts                          # Vitest setup
  mocks/prisma.ts                   # PrismaClient deep mock
  middlewares/
    auth.middleware.test.ts          # JWT validation, role checks
    push.controller.test.ts          # Push feature flag response
    errorHandler.test.ts            # AppError, Prisma errors, 500s
  utils/
    asyncHandler.test.ts            # Express async wrapper
    manifiestoNumber.test.ts        # Numero generation algorithm
    pagination.test.ts              # parsePagination utility
    roleFilter.test.ts              # Role-based query filtering + manifiesto ownership guard
```

### Prisma Mocking
Tests use `vitest-mock-extended` to create a deep mock of PrismaClient. The mock is auto-reset before each test via `backend/src/__tests__/mocks/prisma.ts`.

### Adding Tests
1. Create `src/__tests__/<category>/<name>.test.ts`
2. Import the Prisma mock if needed: `import { prismaMock } from '../mocks/prisma'`
3. Mock module if testing a controller: `vi.mock('../../lib/prisma', ...)`
4. Run: `npm test`

## Frontend Tests

### Structure
```
frontend/src-v6/__tests__/
  setup.ts                          # DOM mocks (matchMedia, IntersectionObserver, geolocation)
  components/
    ErrorBoundary.test.tsx          # Error boundary render + recovery
  contexts/
    AuthContext.test.tsx             # Auth state, login/logout, role booleans
  hooks/
    useManifiestos.test.ts          # Hook exports verification
  services/
    api.test.ts                     # Token helpers, axios config
  utils/
    formatters.test.ts              # 30 tests: date, number, CUIT, patente formatting
```

### Key Patterns
- React Testing Library for component tests
- `vi.mock()` for service/module mocking
- `QueryClientProvider` wrapper for hooks using React Query
- `@testing-library/jest-dom` for extended matchers

## E2E Tests (Playwright)

### Structure
```
frontend/e2e/
  api-health.spec.ts               # Health endpoints, auth API
  auth.spec.ts                     # Login, logout, invalid credentials
  dashboard.spec.ts                # Dashboard load, navigation
```

### Configuration
- **Base URL**: `https://sitrep.ultimamilla.com.ar` (override with `PLAYWRIGHT_BASE_URL`)
- **Projects**: chromium (desktop) + Pixel 7 (mobile)
- **Retries**: 2 in CI, 0 locally

### Running
```bash
cd frontend
npx playwright test                    # Headless
npx playwright test --ui               # Interactive UI mode
npx playwright test --project=chromium # Desktop only
PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test  # Local
```

## Lint Baseline

Frontend lint is now part of CI, but existing React/type debt is treated as warnings so it can be reduced incrementally without blocking deployments.

Current expected state:

- `npm run lint`: exits 0.
- Existing debt remains visible as warnings, mainly `any`, unused symbols, React Compiler memoization warnings, and hook-effect cleanup candidates.
- New hard errors such as conditional hook calls should still fail lint.

## Bash Smoke Tests

The original test suite (124+ tests) using curl against the live API. These remain the production verification standard.

```bash
# Full smoke test
bash backend/tests/smoke-test.sh

# Against local
bash backend/tests/smoke-test.sh http://localhost:3010

# Cross-platform workflow (59 tests)
bash backend/tests/cross-platform-workflow-test.sh
```

## Coverage Thresholds

Coverage gates are set to the current verified baseline so the command is useful in CI and can be ratcheted up as new tests land.

Backend baseline:
- **Statements**: 2%
- **Branches**: 3%
- **Functions**: 2%
- **Lines**: 2%

Frontend baseline:
- **Statements**: 2%
- **Branches**: 0.8%
- **Functions**: 1%
- **Lines**: 2%

## CI Integration

The production workflow validates backend, frontend, and blockchain before deploy:

- Backend: `npm ci`, audit high-level report, typecheck, tests, build.
- Frontend: `npm ci`, lint, tests, build.
- Blockchain: `npm ci`, Hardhat compile.
- Deploy scripts are versioned in `scripts/cicd/` and copied to the VPS during each workflow run, avoiding drift between repository and server.

Playwright and bash smoke tests remain environment-dependent and should run manually, nightly, or post-deploy against a known seeded target.

Post-deploy test target in the current test VPS:

```bash
# From inside the VPS, this avoids public DNS noise while testing the deployed backend.
bash /tmp/sitrep-smoke-test.sh http://127.0.0.1:3010
```

## Certification Test Matrix

`scripts/certification/run-certification-suite.sh` is the formal runner for certification evidence. It wraps the existing unit, E2E, smoke, role, security, integrity, operational, and stress scripts and writes a timestamped report under `reports/test-runs/`.

Profiles:

| Profile | Purpose | Destructive |
|---------|---------|-------------|
| `quick` | Local/CI fast validation: dependencies, typecheck, unit, coverage, build, audits, blockchain compile. | No |
| `post-deploy` | Remote validation after deploy: API regression plus Playwright chromium. | No |
| `production-smoke` | Minimal no-destructive production/VPN validation. | No |
| `certification` | Full staging/test VPS matrix: static, config, API, workflow, security, integrity, frontend/PWA, accessibility, compatibility, ops/recovery, stress. | Only if explicitly enabled |

Example staging run:

```bash
RUN_PROFILE=certification \
TARGET_URL=https://sitrep.ultimamilla.com.ar \
API_URL=https://sitrep.ultimamilla.com.ar/api \
ALLOW_AUTOFIX=true \
ALLOW_DESTRUCTIVE_STAGING=true \
STAGING_SNAPSHOT_COMMAND='ssh root@23.105.176.45 /opt/scripts-cicd/backup_sitrep.sh' \
STAGING_RESTORE_COMMAND='echo restore-command-not-configured' \
bash scripts/certification/run-certification-suite.sh
```

Evidence generated per run:

- `summary.md`: human-readable certification report.
- `summary.json`: machine-readable report for CI or audit storage.
- one `.log` file per step with command output.
- each result includes a category: `APP_CHECK`, `APP_FAILURE`, `SECURITY_FAILURE`, `DEPENDENCY_CHECK`, `DEPENDENCY_RISK`, `ENVIRONMENT_CHECK`, `ENVIRONMENT_FAILURE`, `KNOWN_EXCEPTION`, or `SKIPPED_BY_POLICY`.
- non-stress certification coverage includes configuration, health/live/ready, security headers, rate-limit headers, PWA/manual surface, mobile viewport, and dependency-free accessibility heuristics.

Severity policy:

- `BLOCKER` and `HIGH` failures return non-zero and block certification.
- `MEDIUM`, `LOW`, and `WARN` failures are recorded but do not hide known exceptions, such as backend dependency advisories that require breaking upgrades.
- Destructive stress or restore drills are skipped unless `ALLOW_DESTRUCTIVE_STAGING=true`.
- DNS/registry failures are classified as `ENVIRONMENT_FAILURE`; they are warnings for local `quick` runs and blocking in `post-deploy`, `production-smoke`, `certification`, and GitHub Actions.
- `npm audit` results are classified separately from functional failures. The known backend advisories for `nodemailer`, `uuid`, and `xlsx` are recorded as `KNOWN_EXCEPTION` until the dependency migration backlog is executed.

Autocorrection policy:

- Disabled by default.
- When `ALLOW_AUTOFIX=true`, the runner may run non-forced dependency fixes, reinstall inconsistent `node_modules`, and re-run checks.
- It does not apply forced dependency upgrades, destructive migrations, or database cleanup unless destructive staging mode and explicit snapshot/restore commands are configured.
- `OFFLINE_SKIP_AUDIT=true` can skip npm audit only for local non-strict runs; CI and certification still require registry access.

GitHub Actions:

- `.github/workflows/certification-tests.yml` exposes the runner as a manual workflow.
- The production deploy workflow remains fast and keeps deploy validation separate from destructive certification testing.
