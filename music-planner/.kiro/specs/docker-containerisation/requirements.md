# Requirements Document

## Introduction

This document defines the requirements for containerising the `music-planner` Angular 17 SPA using a multi-stage Docker build and Docker Compose orchestration. The Angular app is built with Node.js and served as static files by Nginx. A Postgres service is included in the Compose setup for future backend use. The goal is a reproducible, production-ready local development and deployment environment.

## Glossary

- **Dockerfile**: The multi-stage build file that produces the final container image
- **Builder_Stage**: The first Docker build stage using `node:20-alpine` that compiles the Angular app
- **Runner_Stage**: The second Docker build stage using `nginx:alpine` that serves the compiled static assets
- **Nginx**: The web server used to serve the Angular SPA in the final container image
- **Compose**: Docker Compose V2 (`docker compose`) used to orchestrate multiple services
- **Angular_App**: The `angular-app` service defined in `docker-compose.yml`, serving the SPA on port 4200
- **Postgres_Service**: The `postgres` service defined in `docker-compose.yml`, running `postgres:16-alpine`
- **SPA_Fallback**: The Nginx `try_files` directive that returns `index.html` for any unmatched route
- **Build_Context**: The set of files sent to the Docker daemon during `docker build`
- **music-planner-net**: The Docker bridge network shared by all Compose services
- **Env_File**: The `.env` file (gitignored) that supplies secret values to Compose at runtime
- **Env_Example**: The `.env.example` file (committed) that documents required environment variables with placeholder values

---

## Requirements

### Requirement 1: Multi-Stage Dockerfile

**User Story:** As a developer, I want a multi-stage Dockerfile, so that the final image contains only Nginx and compiled static assets with no Node.js runtime or source code.

#### Acceptance Criteria

1. THE Dockerfile SHALL define a `builder` stage using the `node:20-alpine` base image
2. WHEN the `builder` stage runs, THE Builder_Stage SHALL execute `npm ci` to install dependencies from `package-lock.json`
3. WHEN the `builder` stage runs, THE Builder_Stage SHALL execute `npm run build` to produce a production Angular build in `dist/music-planner`
4. THE Dockerfile SHALL define a `runner` stage using the `nginx:alpine` base image
5. WHEN the `runner` stage is assembled, THE Runner_Stage SHALL copy only the `dist/music-planner` output from the `builder` stage into `/usr/share/nginx/html`
6. THE Runner_Stage SHALL copy `nginx.conf` into `/etc/nginx/conf.d/default.conf`
7. IF the Angular build fails during the `builder` stage, THEN THE Dockerfile SHALL exit with a non-zero status and produce no image

---

### Requirement 2: Nginx SPA Configuration

**User Story:** As a user, I want deep links and client-side routes to work correctly, so that I can navigate directly to any Angular route without receiving a 404 error.

#### Acceptance Criteria

1. WHEN a request is received for a path that does not match a static file, THE Nginx SHALL serve `index.html` via the `try_files $uri $uri/ /index.html` directive
2. WHEN a request is received for a hashed static asset matching `*.js` or `*.css`, THE Nginx SHALL respond with a `Cache-Control: public, immutable` header and an `expires` value of 1 year
3. WHEN a request is received for `index.html`, THE Nginx SHALL respond with a `Cache-Control: no-cache, no-store, must-revalidate` header
4. THE Nginx SHALL have gzip compression enabled for `text/plain`, `text/css`, `application/javascript`, and `application/json` MIME types
5. THE Nginx SHALL listen on port 80

---

### Requirement 3: Docker Compose Orchestration

**User Story:** As a developer, I want a `docker-compose.yml` file, so that I can start the Angular app and Postgres with a single command.

#### Acceptance Criteria

1. THE Compose SHALL define an `angular-app` service built from the local `Dockerfile`
2. THE Compose SHALL map host port `4200` to container port `80` for the `angular-app` service
3. THE Compose SHALL define a `postgres` service using the `postgres:16-alpine` image
4. THE Compose SHALL map host port `5432` to container port `5432` for the `postgres` service
5. THE Compose SHALL attach both services to the `music-planner-net` bridge network
6. THE Compose SHALL define a named volume `postgres_data` mounted at `/var/lib/postgresql/data` in the `postgres` service to persist database state across restarts
7. WHEN `docker compose up --build` is run, THE Compose SHALL build the `angular-app` image and start both services

---

### Requirement 4: Environment Variable Configuration

**User Story:** As a developer, I want Postgres credentials supplied via environment variables, so that secrets are never hardcoded in version-controlled files.

#### Acceptance Criteria

1. THE Compose SHALL read `POSTGRES_PASSWORD` from the environment with no default value, so that Postgres refuses to start if the variable is unset
2. THE Compose SHALL read `POSTGRES_DB` from the environment with a default value of `music_planner`
3. THE Compose SHALL read `POSTGRES_USER` from the environment with a default value of `postgres`
4. THE Env_Example file SHALL be committed to the repository and contain placeholder values for `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`
5. THE Env_File (`.env`) SHALL be listed in `.gitignore` so that actual credentials are never committed
6. IF `POSTGRES_PASSWORD` is not set in the environment, THEN THE Postgres_Service SHALL fail to start with a descriptive error

---

### Requirement 5: Build Context Optimisation

**User Story:** As a developer, I want a `.dockerignore` file, so that unnecessary files are excluded from the Docker build context to keep builds fast and deterministic.

#### Acceptance Criteria

1. THE Build_Context SHALL exclude the `node_modules` directory
2. THE Build_Context SHALL exclude the `dist` directory
3. THE Build_Context SHALL exclude the `.angular` cache directory
4. THE Build_Context SHALL exclude the `.git` directory
5. THE Build_Context SHALL exclude `.env` and `.env.*` files so that secrets are never sent to the Docker daemon
