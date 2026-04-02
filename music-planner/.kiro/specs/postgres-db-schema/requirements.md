# Requirements Document

## Introduction

This document defines the requirements for the PostgreSQL database schema of the Music Planner application, implemented via Sequelize ORM in TypeScript/Node.js. The schema replaces the current JSON-file-based data layer with a persistent, multi-tenant relational database supporting configurable song slot templates, cross-series song translation, and computed conflict detection.

## Glossary

- **Congregation**: A tenant unit; the root anchor for all schedule and slot configuration data.
- **Service**: A scheduled worship event on a specific date with a specific service type, belonging to one congregation.
- **SlotTemplate**: A named, ordered song slot definition scoped to a congregation and service type (e.g. `orchestra1`, `congregationBS`).
- **Song**: A shared hymnal entry identified by a unique number (e.g. `A10`, `E7`). Shared across all congregations.
- **ServiceSlot**: A junction record linking a service, a slot template, and an optionally assigned song.
- **Hymnal**: The prefix extracted from a song number (e.g. `A`, `E`, `BB`).
- **Translation**: A relationship between two songs where one is a version of the other in a different hymnal series.
- **Conflict**: A song used in another service within 56 days of a target service date.
- **Quarter Conflict**: A song used in another service between 57 and 90 days of a target service date.
- **Year Conflict**: A song used in another service between 91 and 365 days of a target service date.
- **ORM**: Object-Relational Mapper — Sequelize in this context.
- **Migration**: A versioned, repeatable database schema change script managed by Umzug.
- **Familiarity**: A numeric flag on a song indicating whether it is in normal rotation (`0`) or excluded/unfamiliar (`-1`).

---

## Requirements

### Requirement 1: Congregation Table

**User Story:** As a system administrator, I want congregations stored as first-class entities, so that the application can support multiple independent tenants sharing the same database.

#### Acceptance Criteria

1. THE Database SHALL contain a `congregations` table with columns: `id` (UUID PK), `name` (VARCHAR 255, NOT NULL, UNIQUE), `timezone` (VARCHAR 64, NOT NULL, default `'UTC'`), `created_at`, `updated_at`.
2. WHEN a congregation is created without a timezone, THE Database SHALL default the timezone to `'UTC'`.
3. IF two congregations with the same name are inserted, THEN THE Database SHALL reject the second insert with a unique constraint violation.
4. THE Sequelize_Model SHALL expose `id`, `name`, and `timezone` as typed properties on the `Congregation` class.

---

### Requirement 2: Slot Templates Table

**User Story:** As a congregation administrator, I want configurable slot templates per service type, so that the set of song slots is not hardcoded and can vary between congregations.

#### Acceptance Criteria

1. THE Database SHALL contain a `slot_templates` table with columns: `id` (UUID PK), `congregation_id` (UUID FK → `congregations.id`, NOT NULL), `service_type` (VARCHAR 100), `slot_key` (VARCHAR 100), `display_order` (INTEGER, default 0), `category` (VARCHAR 50), `created_at`, `updated_at`.
2. WHEN a congregation is deleted, THE Database SHALL cascade-delete all associated slot template rows.
3. IF a duplicate `(congregation_id, service_type, slot_key)` combination is inserted, THEN THE Database SHALL reject the insert with a unique constraint violation.
4. THE Sequelize_Model SHALL expose `congregationId`, `serviceType`, `slotKey`, `displayOrder`, and `category` as typed properties on the `SlotTemplate` class.
5. WHEN slot templates are seeded for a congregation, THE System SHALL create the 14 default slots (`orchestra1–5`, `choir1–4`, `congregationBS`, `congregationOH`, `congregationRP`, `congregationCM1`, `congregationCM2`) for the `'Sunday Service'` service type.

---

### Requirement 3: Songs Table

**User Story:** As a music planner, I want a shared song repertoire, so that all congregations of the same denomination reference the same hymnal entries without duplication.

#### Acceptance Criteria

1. THE Database SHALL contain a `songs` table with columns: `id` (UUID PK), `number` (VARCHAR 20, NOT NULL, UNIQUE), `hymnal` (VARCHAR 10, NOT NULL), `translation_of_id` (UUID FK → `songs.id`, NULLABLE), `signature` (VARCHAR 100, NULLABLE), `tempo` (VARCHAR 50, NULLABLE), `familiarity` (SMALLINT, NOT NULL, default `0`), `created_at`, `updated_at`.
2. WHEN a song is inserted, THE System SHALL store the `number` value normalised to uppercase.
3. WHEN a song is inserted, THE System SHALL extract and store the hymnal prefix from the `number` into the `hymnal` column.
4. IF two songs with the same `number` are inserted, THEN THE Database SHALL reject the second insert with a unique constraint violation.
5. THE Database SHALL index the `hymnal` column to support efficient filtering by hymnal series.
6. WHEN the song referenced by `translation_of_id` is deleted, THE Database SHALL set `translation_of_id` to NULL on all songs pointing to it (SET NULL behaviour).
7. THE Sequelize_Model SHALL expose `id`, `number`, `hymnal`, `translationOfId`, `signature`, `tempo`, and `familiarity` as typed properties on the `Song` class.
8. THE Sequelize_Model SHALL define a self-referencing association `translationOf` (belongs-to) and `translations` (has-many) on the `Song` class.

---

### Requirement 4: Services Table

**User Story:** As a music planner, I want services stored per congregation with a date and type, so that I can manage the schedule for each congregation independently.

#### Acceptance Criteria

1. THE Database SHALL contain a `services` table with columns: `id` (UUID PK), `congregation_id` (UUID FK → `congregations.id`, NOT NULL), `service_date` (DATE, NOT NULL), `service_type` (VARCHAR 100), `created_at`, `updated_at`.
2. WHEN a congregation is deleted, THE Database SHALL cascade-delete all associated service rows.
3. IF a duplicate `(congregation_id, service_date, service_type)` combination is inserted, THEN THE Database SHALL reject the insert with a unique constraint violation.
4. THE Database SHALL maintain a composite index on `(congregation_id, service_date)` to support efficient date-range schedule queries.
5. THE Sequelize_Model SHALL expose `congregationId`, `serviceDate`, and `serviceType` as typed properties on the `Service` class.

---

### Requirement 5: Service Slots Table

**User Story:** As a music planner, I want each service to have a set of song slots linked to slot templates, so that song assignments are structured and configurable.

#### Acceptance Criteria

1. THE Database SHALL contain a `service_slots` table with columns: `id` (UUID PK), `service_id` (UUID FK → `services.id`, NOT NULL), `slot_template_id` (UUID FK → `slot_templates.id`, NOT NULL), `song_id` (UUID FK → `songs.id`, NULLABLE), `created_at`, `updated_at`.
2. WHEN a service is deleted, THE Database SHALL cascade-delete all associated service slot rows.
3. IF a duplicate `(service_id, slot_template_id)` combination is inserted, THEN THE Database SHALL reject the insert with a unique constraint violation.
4. WHEN a slot has no assigned song or the slot is intentionally empty, THE System SHALL store `song_id` as NULL.
5. THE Database SHALL maintain a composite index on `(song_id, service_id)` to support efficient conflict window queries.
6. THE Sequelize_Model SHALL expose `serviceId`, `slotTemplateId`, and `songId` as typed properties on the `ServiceSlot` class.

---

### Requirement 6: Sequelize Associations

**User Story:** As a developer, I want all Sequelize associations defined centrally, so that eager-loading and cascade behaviour work correctly across the entire model layer.

#### Acceptance Criteria

1. THE Sequelize_Model SHALL define `Congregation.hasMany(SlotTemplate)` with `onDelete: 'CASCADE'`.
2. THE Sequelize_Model SHALL define `Congregation.hasMany(Service)` with `onDelete: 'CASCADE'`.
3. THE Sequelize_Model SHALL define `Service.hasMany(ServiceSlot)` with `onDelete: 'CASCADE'`.
4. THE Sequelize_Model SHALL define `ServiceSlot.belongsTo(SlotTemplate)` and `ServiceSlot.belongsTo(Song)`.
5. THE Sequelize_Model SHALL define `Song.belongsTo(Song)` as `translationOf` with `onDelete: 'SET NULL'`.
6. WHEN a full schedule is loaded for a congregation, THE Query_Layer SHALL support eager-loading services with their service slots, slot templates, songs, and song translations in a single query.

---

### Requirement 7: Conflict Detection Query

**User Story:** As a music planner, I want song conflicts computed at query time, so that conflict data is always accurate and never stale.

#### Acceptance Criteria

1. WHEN a conflict check is requested for a song on a given service date, THE Query_Layer SHALL return all service slots where the same song appears within a configurable day window for the same congregation.
2. WHEN the day window is 56 days, THE Query_Layer SHALL classify the result as a conflict.
3. WHEN the day window is between 57 and 90 days, THE Query_Layer SHALL classify the result as a quarter conflict.
4. WHEN the day window is between 91 and 365 days, THE Query_Layer SHALL classify the result as a year conflict.
5. THE Query_Layer SHALL exclude the target service itself from conflict results.
6. WHEN computing conflicts, THE Query_Layer SHALL scope results to the same congregation as the target service.
7. THE Database SHALL NOT store pre-computed conflict data — all conflict information SHALL be derived at query time.

---

### Requirement 8: Data Migration from JSON

**User Story:** As a developer, I want a migration path from the existing JSON data files, so that existing schedule and repertoire data can be imported into the new schema without loss.

#### Acceptance Criteria

1. WHEN importing from `repertoire.json`, THE Migration_Script SHALL upsert song rows, extracting the hymnal prefix from each song number and normalising numbers to uppercase.
2. WHEN importing from `scheduleExample.json`, THE Migration_Script SHALL insert a `services` row for each service entry.
3. WHEN importing service slots, THE Migration_Script SHALL look up `song_id` by the uppercase song number and insert a `service_slots` row.
4. WHEN a song number is empty or `'N/A'` during import, THE Migration_Script SHALL set `song_id` to NULL.
5. WHEN importing, THE Migration_Script SHALL seed `slot_templates` for each known `(service_type, slot_key)` combination before inserting service slots.
6. WHEN a duplicate service is encountered during import, THE Migration_Script SHALL upsert the row rather than failing.

---

### Requirement 9: Schema Migrations

**User Story:** As a developer, I want versioned, repeatable schema migrations, so that the database schema can be evolved safely across environments.

#### Acceptance Criteria

1. THE System SHALL use Umzug as the migration runner for all schema changes.
2. WHEN migrations are run, THE Migration_Runner SHALL apply pending migrations in order and record each applied migration.
3. WHEN migrations are rolled back, THE Migration_Runner SHALL reverse applied migrations in reverse order.
4. THE System SHALL create all five tables (`congregations`, `slot_templates`, `songs`, `services`, `service_slots`) via migration scripts, not via `sequelize.sync()`.

---

### Requirement 10: Multi-Tenancy Isolation

**User Story:** As a system architect, I want tenant isolation enforced at the application layer, so that one congregation cannot access another congregation's schedule data.

#### Acceptance Criteria

1. WHEN querying services, THE Repository_Layer SHALL always include `congregation_id` in the WHERE clause.
2. WHEN querying slot templates, THE Repository_Layer SHALL always include `congregation_id` in the WHERE clause.
3. WHEN querying conflict windows, THE Repository_Layer SHALL always scope results to the requesting congregation's `congregation_id`.
4. THE songs table SHALL NOT have a `congregation_id` column — song data is shared across all congregations.

---

### Requirement 11: Security and Data Integrity

**User Story:** As a developer, I want the data layer to be secure and consistent, so that the application is protected against injection attacks and data corruption.

#### Acceptance Criteria

1. THE System SHALL use Sequelize ORM for all database queries — no raw SQL strings SHALL be constructed by concatenating user input.
2. THE System SHALL use UUID primary keys on all tables to prevent enumeration attacks.
3. WHEN a song number is written to the database, THE System SHALL normalise it to uppercase before storage.
4. WHEN a congregation is not found, THE API_Layer SHALL return a 404 response before executing any database write.
