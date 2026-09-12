# Requirements Document

## Introduction

The Angular frontend (music-planner-app) currently issues HTTP requests to the backend using hardcoded relative paths (`/api/services`, `/api/services/{id}`) with no configurable base URL. This works only when the frontend and API are served from the same origin (or when a proxy is present), which is not the case in the docker-compose deployment where the Angular app (nginx on port 4200) and the API (port 3000) run as separate containers/origins, and no `/api` proxy is configured.

This feature introduces a configurable API base URL. A new `apiBaseUrl` field is added to the Angular environment files, and the `ServicesApiService` prepends this value to its request paths. Development and production builds can each supply an appropriate value. When `apiBaseUrl` is an empty string, the service preserves today's relative-path behavior for backward compatibility. Cross-origin requests rely on the API's existing CORS configuration (`ALLOWED_ORIGINS`) rather than introducing an nginx or dev-server proxy. Existing tests that assert exact request URLs are updated to reflect the base-URL-prefixed URLs.

## Glossary

- **Frontend_App**: The Angular 17 application in `music-planner-app` that runs in the user's browser.
- **Environment_Config**: The configuration object exported from `src/environments/environment.ts` (development) and `src/environments/environment.prod.ts` (production).
- **API_Base_URL**: The `apiBaseUrl` string field of the Environment_Config, representing the origin (and optional path prefix) of the backend API, for example `http://localhost:3000` or an empty string.
- **Services_Api_Service**: The Angular service `ServicesApiService` in `src/app/monthly-services-view/services/services-api.service.ts` that issues HTTP requests to the backend.
- **Request_URL**: The full URL string passed to Angular's `HttpClient` for a given API call.
- **API_Path**: The relative endpoint path for an operation, one of `/api/services` or `/api/services/{serviceId}`.
- **Backend_API**: The Express API in `music-planner-api` that serves the endpoints and enforces CORS via `ALLOWED_ORIGINS`.
- **Service_Test_Suite**: The Karma/Jasmine spec file `services-api.service.spec.ts` that verifies `ServicesApiService` behavior, including request URLs.

## Requirements

### Requirement 1: Configurable API base URL field in environment configuration

**User Story:** As a developer, I want an `apiBaseUrl` field in the environment configuration, so that I can point the frontend at the correct backend origin per build target without editing service code.

#### Acceptance Criteria

1. THE Environment_Config SHALL expose a string field named `apiBaseUrl`.
2. THE development Environment_Config (`environment.ts`) SHALL define `apiBaseUrl` with a value that enables local development against the Backend_API.
3. THE production Environment_Config (`environment.prod.ts`) SHALL define `apiBaseUrl` with the value used for production builds.
4. THE Environment_Config SHALL retain the existing `production`, `auth0Domain`, `auth0ClientId`, and `auth0Audience` fields unchanged.

### Requirement 2: Service prepends the base URL to request paths

**User Story:** As a developer, I want the Services_Api_Service to prepend the configured base URL to each API path, so that requests reach the correct backend origin.

#### Acceptance Criteria

1. WHEN the Services_Api_Service issues the get-services request, THE Services_Api_Service SHALL construct the Request_URL by concatenating the API_Base_URL with the `/api/services` API_Path.
2. WHEN the Services_Api_Service issues the update-service-slots request, THE Services_Api_Service SHALL construct the Request_URL by concatenating the API_Base_URL with the `/api/services/{serviceId}` API_Path.
3. WHEN the Services_Api_Service issues the create-service request, THE Services_Api_Service SHALL construct the Request_URL by concatenating the API_Base_URL with the `/api/services` API_Path.
4. THE Services_Api_Service SHALL attach the `Authorization: Bearer {token}` header to every request unchanged from current behavior.
5. THE Services_Api_Service SHALL preserve the existing `from` and `to` query parameters on the get-services request unchanged.
6. THE Services_Api_Service SHALL preserve the existing request bodies for the update-service-slots and create-service requests unchanged.

### Requirement 3: Backward-compatible behavior when base URL is empty

**User Story:** As a developer, I want an empty base URL to produce the same relative paths used today, so that same-origin or proxied deployments continue to work without change.

#### Acceptance Criteria

1. WHERE the API_Base_URL is an empty string, WHEN the Services_Api_Service issues any request, THE Services_Api_Service SHALL produce a Request_URL equal to the corresponding relative API_Path.
2. WHERE the API_Base_URL is a non-empty string, WHEN the Services_Api_Service issues any request, THE Services_Api_Service SHALL produce a Request_URL that begins with the API_Base_URL and ends with the corresponding API_Path.
3. IF the API_Base_URL ends with a trailing slash, THEN THE Services_Api_Service SHALL produce a Request_URL that does not contain a duplicated slash between the API_Base_URL and the API_Path.

### Requirement 4: Cross-origin requests rely on existing CORS configuration

**User Story:** As an operator, I want cross-origin requests to succeed using the API's existing CORS settings, so that no additional proxy component is required in the deployment.

#### Acceptance Criteria

1. THE Frontend_App SHALL issue API requests directly to the API_Base_URL origin without routing through an nginx or dev-server proxy.
2. WHERE the API_Base_URL origin differs from the Frontend_App origin, THE Frontend_App SHALL depend on the Backend_API CORS configuration (`ALLOWED_ORIGINS`) to authorize the request.

### Requirement 5: Update affected tests to reflect base-URL-prefixed URLs

**User Story:** As a developer, I want the Service_Test_Suite to assert the base-URL-prefixed URLs, so that the tests match the new behavior and continue to guard the service.

#### Acceptance Criteria

1. THE Service_Test_Suite SHALL assert Request_URLs that are consistent with the API_Base_URL value used during testing.
2. THE Service_Test_Suite SHALL continue to verify that the `Authorization: Bearer {token}` header is attached to every request.
3. WHEN the test suite is executed, THE Service_Test_Suite SHALL pass with the updated URL assertions.
