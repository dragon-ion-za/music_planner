# Tasks

## Task List

- [x] 1. Install dependencies and configure Sequelize connection
  - [x] 1.1 Add `sequelize`, `pg`, `pg-hstore`, and `umzug` to package.json
  - [x] 1.2 Create `src/server/db/sequelize.ts` that initialises and exports the Sequelize instance using environment variables for connection config
  - [x] 1.3 Add `.env.example` entries for `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

- [x] 2. Define Sequelize models
  - [x] 2.1 Create `src/server/models/Congregation.ts` — `Congregation` model with `id`, `name`, `timezone` fields per Requirement 1
  - [x] 2.2 Create `src/server/models/SlotTemplate.ts` — `SlotTemplate` model with `id`, `congregationId`, `serviceType`, `slotKey`, `displayOrder`, `category` fields per Requirement 2
  - [x] 2.3 Create `src/server/models/Song.ts` — `Song` model with `id`, `number`, `hymnal`, `translationOfId`, `signature`, `tempo`, `familiarity` fields per Requirement 3; add beforeCreate/beforeUpdate hook to uppercase `number` and extract `hymnal`
  - [x] 2.4 Create `src/server/models/Service.ts` — `Service` model with `id`, `congregationId`, `serviceDate`, `serviceType` fields per Requirement 4
  - [x] 2.5 Create `src/server/models/ServiceSlot.ts` — `ServiceSlot` model with `id`, `serviceId`, `slotTemplateId`, `songId` (nullable) fields per Requirement 5
  - [x] 2.6 Create `src/server/models/associations.ts` — define all Sequelize associations (hasMany, belongsTo, self-ref) per Requirement 6; export an `initAssociations()` function

- [x] 3. Write Umzug migrations
  - [x] 3.1 Create migration `001-create-congregations.ts` — creates `congregations` table with all columns, constraints per Requirement 1
  - [x] 3.2 Create migration `002-create-songs.ts` — creates `songs` table with unique constraint on `number`, index on `hymnal`, self-ref FK with SET NULL per Requirement 3
  - [x] 3.3 Create migration `003-create-slot-templates.ts` — creates `slot_templates` table with unique constraint on `(congregation_id, service_type, slot_key)`, CASCADE DELETE FK per Requirement 2
  - [x] 3.4 Create migration `004-create-services.ts` — creates `services` table with unique constraint on `(congregation_id, service_date, service_type)`, composite index on `(congregation_id, service_date)`, CASCADE DELETE FK per Requirement 4
  - [x] 3.5 Create migration `005-create-service-slots.ts` — creates `service_slots` table with unique constraint on `(service_id, slot_template_id)`, composite index on `(song_id, service_id)`, CASCADE DELETE FK per Requirement 5
  - [x] 3.6 Create `src/server/db/migrate.ts` — Umzug runner that applies/rolls back migrations per Requirement 9

- [x] 4. Implement query layer
  - [x] 4.1 Create `src/server/repositories/ServiceRepository.ts` — `findByCongreation(congregationId, dateRange?)` with eager-loading of service slots, slot templates, songs, and song translations per Requirements 6.6 and 10.1
  - [x] 4.2 Create `src/server/repositories/ConflictRepository.ts` — `findConflicts(songId, congregationId, targetDate, windowDays)` implementing the date-range self-join query per Requirement 7; always excludes target service and scopes to congregation

- [x] 5. Write data migration / seed scripts
  - [x] 5.1 Create `src/server/seeds/seedSongs.ts` — reads `src/assets/repertoire.json`, upserts song rows (uppercase number, extract hymnal) per Requirement 8.1
  - [x] 5.2 Create `src/server/seeds/seedSlotTemplates.ts` — inserts the 14 default slot templates for `'Sunday Service'` per Requirements 2.5 and 8.5
  - [x] 5.3 Create `src/server/seeds/importSchedule.ts` — reads `.data/scheduleExample.json`, upserts congregation, inserts services and service slots (NULL for empty/N/A songs) per Requirements 8.2–8.6

- [x] 6. Write tests
  - [x] 6.1 Write model constraint tests (unique violations, cascade deletes, SET NULL) covering Properties 2–10 — use a test PostgreSQL schema or SQLite in-memory instance
  - [x] 6.2 Write conflict query tests covering Properties 11–13 — seed known service dates and verify boundary values (exactly 56, 57, 90, 91, 365 days apart)
  - [x] 6.3 Write tenant isolation tests covering Property 14 — create two congregations with overlapping data and verify queries never return cross-tenant rows
  - [x] 6.4 Write song hook tests covering Properties 5 and 6 — generate mixed-case song numbers and verify stored values are uppercase with correct hymnal prefix
