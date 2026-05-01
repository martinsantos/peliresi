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
bash backend/tests/smoke-test.sh http://localhost:3002

# Cross-platform workflow (59 tests)
bash backend/tests/cross-platform-workflow-test.sh
```

## Coverage Thresholds

Initial thresholds (ratchet up over time):
- **Lines**: 20%
- **Branches**: 20%
- **Functions**: 20%

## CI Integration

The production workflow validates backend, frontend, and blockchain before deploy:

- Backend: `npm ci`, audit high-level report, typecheck, tests, build.
- Frontend: `npm ci`, lint, tests, build.
- Blockchain: `npm ci`, Hardhat compile.

Playwright and bash smoke tests remain environment-dependent and should run manually, nightly, or post-deploy against a known seeded target.
