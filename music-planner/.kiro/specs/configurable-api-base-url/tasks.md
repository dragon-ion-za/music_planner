# Implementation Plan: Configurable API Base URL

## Overview

This plan adds a configurable `apiBaseUrl` field to the Angular environment configuration and updates `ServicesApiService` to prepend it to every API path via a small, slash-safe URL-composition helper. An empty base preserves today's relative-path behavior; a non-empty base produces absolute, origin-aware URLs. The existing test suite is updated to assert base-URL-prefixed URLs and new property tests validate the composition rule. No backend or component changes are required. All work is in TypeScript (Angular 17).

## Tasks

- [x] 1. Add `apiBaseUrl` to environment configuration
  - [x] 1.1 Add `apiBaseUrl` field to development environment
    - Add `apiBaseUrl: 'http://localhost:3000'` to the exported object in `music-planner-app/src/environments/environment.ts`
    - Keep `production`, `auth0Domain`, `auth0ClientId`, and `auth0Audience` fields unchanged
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 1.2 Add `apiBaseUrl` field to production environment
    - Add `apiBaseUrl: ''` to the exported object in `music-planner-app/src/environments/environment.prod.ts`
    - Keep `production`, `auth0Domain`, `auth0ClientId`, and `auth0Audience` fields unchanged
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 2. Implement URL composition in ServicesApiService
  - [x] 2.1 Add the `buildUrl` helper and route all paths through it
    - Import `environment` into `music-planner-app/src/app/monthly-services-view/services/services-api.service.ts`
    - Add a private `buildUrl(path: string): string` that returns `path` unchanged when `apiBaseUrl` is empty, and otherwise returns `apiBaseUrl` with a single trailing slash stripped concatenated with `path`
    - Route `getServices` (`/api/services`), `updateServiceSlots` (`/api/services/${id}`), and `createService` (`/api/services`) through `buildUrl`
    - Leave the `withToken` wrapper, `Authorization` header, `from`/`to` params, and request bodies untouched
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3_

  - [ ]* 2.2 Write property test for non-empty base URL composition
    - **Property 1: Non-empty base URL is prepended with exactly one join slash**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6, 3.2, 3.3**
    - Use fast-check with `{ numRuns: 100 }`; generate non-empty base URLs (with and without trailing slash) and arbitrary service IDs
    - Assert the intercepted request URL starts with the normalized base, ends with the API_Path, and has no `//` at the join; assert `from`/`to` params (get) and request bodies (update/create) are preserved
    - Match requests via `HttpTestingController`; override the statically imported `apiBaseUrl` at test time without changing the public API

  - [ ]* 2.3 Write property test for empty base URL identity
    - **Property 2: Empty base URL yields the relative path unchanged**
    - **Validates: Requirements 3.1**
    - Use fast-check with `{ numRuns: 100 }`; with base set to `''`, assert the intercepted request URL equals the relative API_Path exactly

  - [ ]* 2.4 Write property test for Bearer token invariant
    - **Property 3: Bearer token is attached to every request**
    - **Validates: Requirements 2.4, 5.2**
    - Retain/extend the existing token property tests; generate arbitrary token strings and assert `Authorization: Bearer {token}` on get/update/create requests regardless of configured base URL

  - [ ]* 2.5 Write example test for canonical composition cases
    - Assert the three Architecture-table cases each produce the expected URL: `''` -> `/api/services`, `http://localhost:3000` -> `http://localhost:3000/api/services`, `http://localhost:3000/` -> `http://localhost:3000/api/services`
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Update the existing Service_Test_Suite for base-URL-prefixed URLs
  - [x] 3.1 Update URL assertions in the spec file
    - Update `music-planner-app/src/app/monthly-services-view/services/services-api.service.spec.ts` so existing `HttpTestingController` matchers expect URLs consistent with the `apiBaseUrl` used during testing
    - Keep the existing `Authorization: Bearer {token}` assertions in place
    - _Requirements: 5.1, 5.2_

- [x] 4. Final checkpoint - Ensure all tests pass
  - Run the frontend unit suite in single-run mode (e.g. `ng test --watch=false --browsers=ChromeHeadless`) and confirm it passes with the updated URL assertions
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 5.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate the universal URL-composition and token invariants (Properties 1–3)
- The example test complements the property tests with concrete, readable cases
- Requirements 4.1 and 4.2 (no proxy; reliance on existing CORS `ALLOWED_ORIGINS`) require no code change and are satisfied by the design's origin-direct approach; verify by config/architecture review during implementation
- `npm test` runs in watch mode and opens a browser by default; use single-run flags for one-shot verification

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.1"] }
  ]
}
```
