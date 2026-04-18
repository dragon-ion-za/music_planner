# Requirements Document

## Introduction

This document defines the requirements for the Music Planner Service API — a REST API layer built on Node.js/Express that exposes endpoints for listing and creating worship services. The API uses Auth0 JWT authentication with claims-based authorization, deriving the user's congregation from their token so that all data access is automatically scoped to the correct tenant. The API sits between the Angular 17 frontend and the existing Sequelize-based data layer.

## Glossary

- **API**: The Node.js/Express REST server exposing HTTP endpoints to clients.
- **Auth0**: The third-party identity provider used for authentication and JWT issuance.
- **JWT**: JSON Web Token — a signed bearer token issued by Auth0 and presented by clients on every request.
- **Claims**: Key-value pairs embedded in a JWT payload (e.g. `congregation_id`, `sub`, `permissions`).
- **Congregation_Claim**: The `congregation_id` value extracted from the Auth0 JWT, used to scope all data access to a single tenant.
- **Bearer_Token**: An Authorization header value of the form `Bearer <jwt>`.
- **Service**: A scheduled worship event with a date and service type, belonging to one congregation.
- **ServiceRepository**: The existing Sequelize repository at `src/server/repositories/ServiceRepository.ts`.
- **Auth_Middleware**: Express middleware responsible for validating JWTs and attaching decoded claims to the request context.
- **Route_Handler**: An Express route function that processes an HTTP request and returns a response.
- **DateRange**: An optional filter with `from` and `to` fields in `YYYY-MM-DD` format.
- **CORS**: Cross-Origin Resource Sharing — HTTP headers that allow the Angular frontend to call the API from a different origin.

---

## Requirements

### Requirement 1: JWT Authentication

**User Story:** As a music planner, I want my API requests authenticated via Auth0, so that only authorised users can access service data.

#### Acceptance Criteria

1. WHEN a request arrives without an `Authorization` header, THE Auth_Middleware SHALL return a `401 Unauthorized` response with a JSON error body.
2. WHEN a request arrives with a malformed or expired JWT, THE Auth_Middleware SHALL return a `401 Unauthorized` response with a JSON error body.
3. WHEN a request arrives with a valid JWT signed by the configured Auth0 tenant, THE Auth_Middleware SHALL attach the decoded token claims to the request context and call the next middleware.
4. THE Auth_Middleware SHALL validate the JWT signature against the Auth0 JWKS endpoint for the configured tenant domain.
5. THE Auth_Middleware SHALL validate the JWT `aud` (audience) claim against the configured API identifier.
6. THE Auth_Middleware SHALL validate the JWT `iss` (issuer) claim against the configured Auth0 tenant domain.

---

### Requirement 2: Claims-Based Congregation Scoping

**User Story:** As a system architect, I want the user's congregation derived from their Auth0 token, so that users can only access their own congregation's data without any client-supplied tenant parameter.

#### Acceptance Criteria

1. WHEN a valid JWT is presented, THE Auth_Middleware SHALL extract the `congregation_id` claim from the token payload and attach it to the request context.
2. WHEN the JWT does not contain a `congregation_id` claim, THE Auth_Middleware SHALL return a `403 Forbidden` response with a JSON error body indicating the missing claim.
3. THE Route_Handler SHALL use only the `congregation_id` from the request context — never from query parameters or request body — when scoping database queries.
4. THE Route_Handler SHALL NOT accept a `congregation_id` override from the client in any request field.

---

### Requirement 3: List Services Endpoint

**User Story:** As a music planner, I want to retrieve a list of services for my congregation, so that I can view the schedule in the frontend application.

#### Acceptance Criteria

1. THE API SHALL expose a `GET /api/services` endpoint.
2. WHEN a valid authenticated request is received, THE Route_Handler SHALL call `ServiceRepository.findByCongregation` with the `congregation_id` from the token claims.
3. WHEN the request includes `from` and `to` query parameters in `YYYY-MM-DD` format, THE Route_Handler SHALL pass a `DateRange` object to `ServiceRepository.findByCongregation`.
4. WHEN the request omits `from` and `to` query parameters, THE Route_Handler SHALL call `ServiceRepository.findByCongregation` without a date range, returning all services for the congregation.
5. WHEN `ServiceRepository.findByCongregation` returns successfully, THE Route_Handler SHALL respond with `200 OK` and a JSON array of service objects.
6. WHEN `from` or `to` is provided but not in `YYYY-MM-DD` format, THE Route_Handler SHALL return a `400 Bad Request` response with a descriptive JSON error body.
7. WHEN `from` is provided without `to`, or `to` is provided without `from`, THE Route_Handler SHALL return a `400 Bad Request` response.

---

### Requirement 4: Create Service Endpoint

**User Story:** As a music planner, I want to create a new service for my congregation, so that I can add upcoming services to the schedule.

#### Acceptance Criteria

1. THE API SHALL expose a `POST /api/services` endpoint.
2. WHEN a valid authenticated request is received with a JSON body containing `serviceDate` and `serviceType`, THE Route_Handler SHALL create a new service row scoped to the `congregation_id` from the token claims.
3. WHEN the service is created successfully, THE Route_Handler SHALL respond with `201 Created` and the created service object as JSON, including any created slots.
4. WHEN the request body is missing `serviceDate`, THE Route_Handler SHALL return a `400 Bad Request` response with a descriptive JSON error body.
5. WHEN the request body is missing `serviceType`, THE Route_Handler SHALL return a `400 Bad Request` response with a descriptive JSON error body.
6. WHEN `serviceDate` is not in `YYYY-MM-DD` format, THE Route_Handler SHALL return a `400 Bad Request` response with a descriptive JSON error body.
7. IF a service with the same `(congregation_id, serviceDate, serviceType)` already exists, THEN THE Route_Handler SHALL return a `409 Conflict` response with a descriptive JSON error body.
8. THE Route_Handler SHALL NOT use any `congregation_id` value from the request body — only the value from the token claims SHALL be used.
9. WHEN the request body includes an optional `slots` array, THE Route_Handler SHALL bulk-create `ServiceSlot` rows for each entry by looking up the `SlotTemplate` matching `(congregationId, serviceType, slotKey)`; entries whose `slotKey` does not match any `SlotTemplate` for the congregation SHALL be silently ignored.
10. WHEN a `slots` entry includes a `songId` field, THE Route_Handler SHALL set that value on the created `ServiceSlot`; when `songId` is omitted or `null`, the slot SHALL be created with `songId = null`.

---

---

### Requirement 8: Update Service Slots Endpoint

**User Story:** As a music planner, I want to update the song slots for an existing service, so that I can assign or change songs after the service has been created.

#### Acceptance Criteria

1. THE API SHALL expose a `PUT /api/services/:id` endpoint.
2. WHEN the service identified by `:id` does not exist, THE Route_Handler SHALL return a `404 Not Found` response with a descriptive JSON error body.
3. WHEN the service identified by `:id` exists but belongs to a different congregation than the caller's, THE Route_Handler SHALL return a `403 Forbidden` response with a descriptive JSON error body.
4. WHEN a valid authenticated request is received with a `slots` array, THE Route_Handler SHALL upsert `ServiceSlot` rows: updating `songId` if a slot for that `slotKey` already exists, or creating a new `ServiceSlot` if it does not.
5. WHEN a `slots` entry's `slotKey` does not match any `SlotTemplate` for the congregation, THE Route_Handler SHALL silently ignore that entry.
6. WHEN the update is successful, THE Route_Handler SHALL respond with `200 OK` and the updated service object including all its current slots.
7. THE Route_Handler SHALL NOT use any `congregation_id` value from the request body — only the value from the token claims SHALL be used for authorization.

---

### Requirement 5: Error Handling

**User Story:** As a frontend developer, I want consistent, machine-readable error responses, so that the Angular client can handle failures gracefully.

#### Acceptance Criteria

1. WHEN any unhandled error occurs during request processing, THE API SHALL return a `500 Internal Server Error` response with a JSON body containing an `error` field.
2. THE API SHALL return all error responses as JSON with at minimum an `error` string field.
3. WHEN a database unique constraint violation is detected on service creation, THE Route_Handler SHALL map it to a `409 Conflict` response rather than a `500` response.
4. THE API SHALL NOT expose internal stack traces or database error details in responses sent to clients.

---

### Requirement 6: CORS Configuration

**User Story:** As a frontend developer, I want the API to allow cross-origin requests from the Angular dev server and production origin, so that the Angular app can call the API without browser CORS errors.

#### Acceptance Criteria

1. THE API SHALL include CORS middleware that allows requests from the configured allowed origins.
2. WHEN a preflight `OPTIONS` request is received, THE API SHALL respond with the appropriate CORS headers and a `204 No Content` status.
3. THE API SHALL allow the `Authorization`, `Content-Type`, and `Accept` headers in cross-origin requests.
4. WHERE the environment is development, THE API SHALL allow `http://localhost:4200` as an allowed origin.

---

### Requirement 7: Environment Configuration

**User Story:** As a developer, I want all Auth0 credentials and server settings read from environment variables, so that secrets are never hardcoded and the API can be configured per environment.

#### Acceptance Criteria

1. THE API SHALL read the Auth0 domain from the `AUTH0_DOMAIN` environment variable.
2. THE API SHALL read the Auth0 API audience from the `AUTH0_AUDIENCE` environment variable.
3. THE API SHALL read the server port from the `PORT` environment variable, defaulting to `3000` if not set.
4. THE API SHALL read the allowed CORS origins from the `ALLOWED_ORIGINS` environment variable as a comma-separated list.
5. IF `AUTH0_DOMAIN` or `AUTH0_AUDIENCE` is not set at startup, THEN THE API SHALL log a descriptive error and exit with a non-zero status code.
