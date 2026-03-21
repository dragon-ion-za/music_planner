# Implementation Plan: Docker Containerisation

## Overview

Create all Docker-related configuration files for the `music-planner` Angular SPA, ordered by dependency: build context exclusions and Nginx config first, then the Dockerfile that references them, then environment files, and finally Docker Compose which ties everything together.

## Tasks

- [x] 1. Create `.dockerignore`
  - Exclude `node_modules`, `dist`, `.angular`, `.git`, `.env`, and `.env.*` from the Docker build context
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. Create `nginx.conf`
  - Write an Nginx server block listening on port 80 with root `/usr/share/nginx/html`
  - Add `try_files $uri $uri/ /index.html` under `location /` for SPA fallback
  - Add `location ~* \.(js|css|png|jpg|ico|woff2?)$` block with `expires 1y` and `Cache-Control: public, immutable`
  - Add `location = /index.html` block with `Cache-Control: no-cache, no-store, must-revalidate`
  - Enable `gzip on` with `gzip_types text/plain text/css application/javascript application/json`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Create `Dockerfile`
  - Define `builder` stage from `node:20-alpine`; `WORKDIR /app`, `COPY package*.json .`, `RUN npm ci`, `COPY . .`, `RUN npm run build`
  - Define `runner` stage from `nginx:alpine`; copy `dist/music-planner` from `builder` into `/usr/share/nginx/html`
  - Copy `nginx.conf` into `/etc/nginx/conf.d/default.conf`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 4. Create `.env.example`
  - Add placeholder entries for `POSTGRES_DB=music_planner`, `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=changeme`
  - _Requirements: 4.4_

- [x] 5. Update `.gitignore` to exclude `.env`
  - Append `.env` and `.env.*` entries to the existing `.gitignore` if not already present
  - _Requirements: 4.5_

- [x] 6. Create `docker-compose.yml`
  - Define `angular-app` service built from `.` with port mapping `4200:80` on `music-planner-net`
  - Define `postgres` service using `postgres:16-alpine` with port mapping `5432:5432` on `music-planner-net`
  - Set `POSTGRES_DB`, `POSTGRES_USER` with defaults and `POSTGRES_PASSWORD` with no default
  - Mount named volume `postgres_data` at `/var/lib/postgresql/data`
  - Declare `music-planner-net` network and `postgres_data` volume at the top level
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.6_

- [x] 7. Final checkpoint
  - Verify `docker build -t music-planner-test .` completes without error
  - Verify `docker compose up --build` starts both services
  - Ensure all tests pass, ask the user if questions arise.
