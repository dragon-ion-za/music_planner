# Implementation Plan: Service API

## Overview

Build the Express.js REST API layer in TypeScript that exposes `GET /api/services`, `POST /api/services`, and `PUT /api/services/:id`, enforcing Auth0 JWT authentication and claims-based multi-tenant scoping via the existing Sequelize data layer.

## Tasks

- [x] 1. Install dependencies
  - Run `npm install express cors express-oauth2-jwt-bearer`
  - Run `npm install --save-dev @types/express @types/cors @types/supertest supertest fast-check`
  - _Requirements: 1.4, 6.1, 7.1_

- [x] 2. Add Express Request type augmentation
  - Create `src/server/api/types/express.d.ts` declaring `congregationId: string` on the Express `Request` interface
  - _Requirements: 2.1, 2.3_

- [ ] 3. Implement auth middleware
  - [x] 3.1 Create `src/server/api/middleware/auth.ts` using `auth()` from `express-oauth2-jwt-bearer`, configured with `AUTH0_AUDIENCE` and `AUTH0_DOMAIN` env vars and `tokenSigningAlg: 'RS256'`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_
  - [ ]* 3.2 Write property test for invalid token rejection (Property 1)
    - **Property 1: Invalid tokens are rejected with 401**
    - **Validates: Requirements 1.2, 1.4, 1.5, 1.6**

- [ ] 4. Implement claims extraction middleware
  - [x] 4.1 Create `src/server/api/middleware/claims.ts` that reads `https://music-planner.app/congregation_id` from `req.auth?.payload`, attaches it to `req.congregationId`, and returns `403` if the claim is absent
    - _Requirements: 2.1, 2.2_
  - [ ]* 4.2 Write property test for congregation_id extraction (Property 2)
    - **Property 2: congregation_id claim is extracted and attached**
    - **Validates: Requirements 2.1**

- [x] 5. Implement error handling middleware
  - Create `src/server/api/middleware/errorHandler.ts` mapping `UnauthorizedError` → 401, `UniqueConstraintError` → 409, and all other errors → 500; never forward stack traces or DB error details to the client
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Implement Express app factory
  - Create `src/server/api/app.ts` that builds and exports the Express app (no `listen` call) with: `cors` middleware (origins from `ALLOWED_ORIGINS` env var, always including `http://localhost:4200`; allowed headers `Authorization`, `Content-Type`, `Accept`; `optionsSuccessStatus: 204`), then `jwtCheck`, then `extractClaims`, then the services router, then `errorHandler`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Implement GET /api/services handler
  - [x] 7.1 Create `src/server/api/routes/services.ts` with `GET /api/services`: validate that `from` and `to` are either both present and match `/^\d{4}-\d{2}-\d{2}$/` or both absent; call `ServiceRepository.findByCongregation(req.congregationId, dateRange?)` and return `200` with the result array
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [ ]* 7.2 Write property test for congregation scoping on GET (Property 3)
    - **Property 3: Congregation scoping invariant**
    - **Validates: Requirements 2.3, 2.4, 3.2**
  - [ ]* 7.3 Write property test for GET returning repository results as 200 JSON array (Property 4)
    - **Property 4: GET returns repository results as 200 JSON array**
    - **Validates: Requirements 3.5**
  - [ ]* 7.4 Write property test for date range forwarded unchanged (Property 5)
    - **Property 5: Date range is forwarded to the repository unchanged**
    - **Validates: Requirements 3.3**
  - [ ]* 7.5 Write property test for invalid date strings producing 400 on GET (Property 6)
    - **Property 6: Invalid date strings produce 400**
    - **Validates: Requirements 3.6**

- [ ] 8. Implement POST /api/services handler with slots bulk-create
  - [x] 8.1 Add `POST /api/services` to `src/server/api/routes/services.ts`: validate `serviceDate` (required, `YYYY-MM-DD`) and `serviceType` (required, non-empty); call `Service.create({ congregationId: req.congregationId, serviceDate, serviceType })`; pass `UniqueConstraintError` to `next()` for the error handler
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 4.8_
  - [x] 8.2 Add slots bulk-create logic to the POST handler: if the request body includes a `slots` array, look up each `SlotTemplate` by `(congregationId, serviceType, slotKey)`; for each matched template call `ServiceSlot.create({ serviceId, slotTemplateId, songId: entry.songId ?? null })`; silently skip entries whose `slotKey` does not match any template; eager-load `serviceSlots` on the response and return `201`
    - _Requirements: 4.3, 4.9, 4.10_
  - [ ]* 8.3 Write property test for congregation scoping on POST (Property 3)
    - **Property 3: Congregation scoping invariant**
    - **Validates: Requirements 2.3, 4.2, 4.8**
  - [ ]* 8.4 Write property test for successful POST returning 201 with correct congregationId (Property 7)
    - **Property 7: Successful POST returns 201 with the created service**
    - **Validates: Requirements 4.2, 4.3**
  - [ ]* 8.5 Write property test for missing/empty POST fields producing 400 (Property 8)
    - **Property 8: Missing required POST fields produce 400**
    - **Validates: Requirements 4.4, 4.5**
  - [ ]* 8.6 Write property test for invalid serviceDate producing 400 (Property 6)
    - **Property 6: Invalid date strings produce 400**
    - **Validates: Requirements 4.6**
  - [ ]* 8.7 Write property test for POST slots creating only matched ServiceSlots (Property 12)
    - **Property 12: POST with slots creates ServiceSlot rows scoped to congregation's SlotTemplates**
    - **Validates: Requirements 4.9, 4.10**

- [ ] 9. Implement PUT /api/services/:id handler
  - [x] 9.1 Add `PUT /api/services/:id` to `src/server/api/routes/services.ts`: look up the service by `req.params.id`; return `404` with `{ error: 'Service not found' }` if not found; compare `service.congregationId` with `req.congregationId` and return `403` with `{ error: 'Forbidden' }` if they differ
    - _Requirements: 8.1, 8.2, 8.3, 8.7_
  - [x] 9.2 Add slot upsert logic to the PUT handler: for each entry in the `slots` array, look up the `SlotTemplate` by `(congregationId, serviceType, slotKey)`; silently skip unrecognised keys; for each matched template upsert the `ServiceSlot` on `(serviceId, slotTemplateId)` — update `songId` if the row exists, insert otherwise; eager-load all current `serviceSlots` and return `200` with the full updated service object
    - _Requirements: 8.4, 8.5, 8.6_
  - [ ]* 9.3 Write property test for PUT with unknown service id returning 404 (Property 13)
    - **Property 13: PUT with unknown service id returns 404**
    - **Validates: Requirements 8.2**
  - [ ]* 9.4 Write property test for PUT with service belonging to a different congregation returning 403 (Property 14)
    - **Property 14: PUT with service belonging to a different congregation returns 403**
    - **Validates: Requirements 8.3**
  - [ ]* 9.5 Write property test for PUT slots array upserting ServiceSlot rows correctly (Property 15)
    - **Property 15: PUT slots array upserts ServiceSlot rows correctly**
    - **Validates: Requirements 8.4, 8.5, 8.6**

- [x] 10. Implement server entry point
  - Create `src/server/api/server.ts` that validates `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` are set (exits with non-zero code if either is missing), then calls `app.listen(PORT ?? 3000)`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Write integration tests (Jest + supertest)
  - [x] 12.1 Create `src/server/api/tests/services.integration.test.ts`; mock `express-oauth2-jwt-bearer` with `jest.mock` so tests can inject arbitrary `req.auth` payloads; mock `ServiceRepository`, `Service`, `ServiceSlot`, and `SlotTemplate`
    - _Requirements: 1.1, 1.2, 2.2, 3.1, 3.5, 3.6, 3.7, 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 4.10, 5.1, 5.2, 5.4, 6.2, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 12.2 Write example test: `GET /api/services` with no `Authorization` header → 401
    - _Requirements: 1.1_
  - [x] 12.3 Write example test: `GET /api/services` with valid token but no `congregation_id` claim → 403
    - _Requirements: 2.2_
  - [x] 12.4 Write example test: `GET /api/services` with `from` but no `to` → 400
    - _Requirements: 3.7_
  - [x] 12.5 Write example test: `POST /api/services` with missing `serviceDate` → 400
    - _Requirements: 4.4_
  - [x] 12.6 Write example test: `POST /api/services` with missing `serviceType` → 400
    - _Requirements: 4.5_
  - [x] 12.7 Write example test: `POST /api/services` triggering `UniqueConstraintError` → 409
    - _Requirements: 4.7, 5.3_
  - [x] 12.8 Write example test: `POST /api/services` with a `slots` array — matched slotKeys create ServiceSlot rows, unknown slotKeys are silently ignored, response includes created slots
    - _Requirements: 4.9, 4.10_
  - [x] 12.9 Write example test: `PUT /api/services/:id` with a non-existent id → 404
    - _Requirements: 8.2_
  - [x] 12.10 Write example test: `PUT /api/services/:id` where service belongs to a different congregation → 403
    - _Requirements: 8.3_
  - [x] 12.11 Write example test: `PUT /api/services/:id` with a valid `slots` array — existing slot updated, new slot created, response is full updated service with all current slots
    - _Requirements: 8.4, 8.5, 8.6_
  - [x] 12.12 Write example test: `OPTIONS /api/services` preflight → 204 with CORS headers
    - _Requirements: 6.2, 6.3_
  - [x] 12.13 Write example test: unhandled error in route handler → 500 with no stack trace in body
    - _Requirements: 5.1, 5.4_

- [ ] 13. Write property-based tests (fast-check)
  - [x] 13.1 Create `src/server/api/tests/services.property.test.ts` with shared arbitraries: `dateArbitrary` (valid `YYYY-MM-DD`), `invalidDateArbitrary` (`fc.string()` filtered to non-`YYYY-MM-DD`), `serviceArbitrary`, `slotInputArbitrary`; configure `numRuns: 100`
    - _Requirements: 5.1, 5.2, 5.4_
  - [ ]* 13.2 Write property test for Property 9: all error responses carry a non-empty `error` string field
    - **Property 9: All error responses carry an `error` string field**
    - **Validates: Requirements 5.1, 5.2**
  - [ ]* 13.3 Write property test for Property 10: error responses do not contain stack traces or Sequelize class names
    - **Property 10: Error responses do not leak internal details**
    - **Validates: Requirements 5.4**
  - [ ]* 13.4 Write property test for Property 11: unhandled errors produce 500
    - **Property 11: Unhandled errors produce 500**
    - **Validates: Requirements 5.1**

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The Express app is exported from `app.ts` without calling `listen`, making it directly testable with `supertest`
- `congregation_id` is ALWAYS sourced from the JWT claim — never from query params or request body
- Property tests use `fast-check` with a minimum of 100 iterations per property
- Each property test is tagged with `// Feature: service-api, Property <N>: <property_text>`
- PUT handler upserts slots using `ServiceSlot.upsert` or findOrCreate on `(serviceId, slotTemplateId)`
