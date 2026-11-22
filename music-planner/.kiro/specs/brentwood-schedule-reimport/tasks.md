# Implementation Plan: Brentwood Schedule Reimport

## Overview

Extract the Brentwood Park schedule import logic from migration 007 into a shared helper, refactor 007 to use it, and add migration 009, which deletes every Brentwood Park service and re-imports `.data/brentwood-schedule-latest.json` inside one transaction. All work is in `music-planner-api/` (TypeScript, Jest with in-memory SQLite, `fast-check` for property tests). Tests come after the implementation steps they cover, with a checkpoint running the full API Jest suite after each stage.

## Tasks

- [x] 1. Extract the import helper
  - [x] 1.1 Add an optional `transaction` parameter to `seedSlotTemplates`
    - Change the signature to `seedSlotTemplates(congregationId: string, options: { transaction?: Transaction } = {})`
    - Pass `{ transaction: options.transaction }` to `SlotTemplate.upsert`
    - Leave existing callers (`seedInit.ts`, the CLI entry point) unchanged
    - _Requirements: 1.1, 3.8_

  - [x] 1.2 Create `src/db/importers/brentwoodSchedule.ts`
    - Export `CONGREGATION_NAME`, `CONGREGATION_TIMEZONE`, and the `ScheduleSong`, `ScheduleEntry`, `ImportOptions` and `ImportSummary` types
    - Move `parseDate` and `isEmptySong` out of migration 007 unchanged
    - Add `resolveScheduleFile()`, which throws an error naming every path searched
    - Add `readSchedule(filePath)`, which throws with the file path and parse error on invalid JSON, and throws when the parsed value is not an array
    - Add `seedBrentwoodCongregation(options?)`, which upserts the congregation, calls `seedSlotTemplates` with the transaction, and returns the congregation id
    - Add `importSchedule(congregationId, schedule, options?)` with the existing 007 behavior: `slotKey` and song lookups, skip and warn on unknown slot keys, null `songId` for empty and unknown numbers, one de-duplicated unknown-number warning, summary counts logged and returned
    - Pass `{ transaction: options.transaction }` to every model call (`Congregation.upsert`, `SlotTemplate.findAll`, `Song.findAll`, `Service.upsert`, `ServiceSlot.upsert`)
    - _Requirements: 1.1, 1.4, 3.3, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1_

- [x] 2. Refactor migration 007 to use the helper
  - [x] 2.1 Rewrite `007-import-brentwood-schedule.ts`
    - Replace the inlined logic with `initAssociations()`, `readSchedule(resolveScheduleFile())`, `seedBrentwoodCongregation()` and `importSchedule(...)` with no transaction
    - Import `CONGREGATION_NAME` from the helper in `down`; keep `down` behavior unchanged
    - Remove the duplicated helper functions and constants from the migration file
    - _Requirements: 1.2, 1.5, 1.6, 2.5_

- [x] 3. Create migration 009
  - [x] 3.1 Create `src/db/migrations/009-reimport-brentwood-schedule.ts`
    - Add a header comment stating that `up` discards in-app edits to Brentwood Park services and that `down` cannot restore the schedule that existed before `up` ran
    - `up`: call `initAssociations()`, then `readSchedule(resolveScheduleFile())` before opening a transaction
    - Open `ctx.context.sequelize.transaction(async (transaction) => { ... })` and inside it call `seedBrentwoodCongregation({ transaction })`, `Service.destroy({ where: { congregationId }, transaction })`, log the removed count, then `importSchedule(congregationId, schedule, { transaction })`
    - `down`: find the Brentwood Park congregation; if absent, log that there is nothing to roll back and return; otherwise `Service.destroy` its services (cascade removes slots), log the count, and leave the congregation, slot templates and songs in place
    - Confirm the file name sorts after `008-add-song-name.ts` so Umzug runs it last
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.8, 5.1, 5.2, 5.3, 5.4, 6.1, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4_

- [x] 4. Checkpoint - Ensure the implementation compiles and existing tests pass
  - Run the full API Jest suite (`npm test` in `music-planner-api/`) and confirm `songNameMigration.test.ts` and the rest still pass.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Helper tests
  - [x] 5.1 Write unit tests for the import helper
    - Create `src/tests/brentwoodImporter.test.ts` with its own `jest.mock('fs', ...)` block and `mockFiles`, copied from `songNameMigration.test.ts`; silence and restore `console.log` and `console.warn`
    - `resolveScheduleFile` error lists both searched paths when the file is missing
    - `readSchedule` rejects invalid JSON and a JSON value that is not an array
    - `importSchedule` handles an Empty_Song_Value (null `songId`), an Unknown_Song_Number (null `songId`, one warning listing each distinct number once) and an unknown slot key (entry skipped, warning names key, date and service type)
    - `importSchedule` logs and returns the services, slots and no-song counts
    - _Requirements: 1.4, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.6, 9.1, 9.5_

  - [x]* 5.2 Write property test for song number resolution
    - **Property 2: Song number resolution**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Generate a repertoire of unique numbers and song numbers (known numbers with case and whitespace perturbations, empty variants, unknown numbers); assert empty and unknown values resolve to null and known values resolve to the matching song id
    - Run at least 100 iterations
    - Tag: `// Feature: brentwood-schedule-reimport, Property 2: Song number resolution`

  - [ ]* 5.3 Write property test for service date parsing
    - **Property 3: Service date is the first ten characters**
    - **Validates: Requirements 4.5**
    - Generate ISO 8601 date-time strings; assert `parseDate` returns the first 10 characters and the stored `serviceDate` equals that value
    - Run at least 100 iterations
    - Tag: `// Feature: brentwood-schedule-reimport, Property 3: Service date is the first ten characters`

- [x] 6. Migration tests
  - [x] 6.1 Write migration 009 `up` tests
    - Create `src/tests/brentwoodReimportMigration.test.ts` with its own `jest.mock('fs', ...)` block and `mockFiles`; call `setupTestDb()` in `beforeEach`, create songs with `Song.create`, and invoke `m009.up({ context: testSequelize.getQueryInterface() })`
    - Fresh database: no Brentwood Park congregation exists, so `up` creates it, 14 slot templates and the scheduled services
    - Existing congregation with no services: `up` imports without error
    - Prior services that differ from the file are gone and only the file's services remain, with exactly one service per distinct date and service type
    - A second congregation with its own slot templates, services and slots is unchanged, and the songs table is unchanged
    - Logs the count of deleted services, and the empty, unknown-number and unknown-slot-key cases behave as in the helper tests
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.3, 7.1, 7.2, 9.1, 9.3, 9.4, 9.5_

  - [x] 6.2 Write migration 007 and 009 `down` tests
    - `m007.up` on an empty database produces the expected congregation, slot templates, services and slots; `m007.down` removes the services
    - `m009.down` with an existing congregation deletes its services and slots and leaves the congregation, slot templates, other congregations and songs in place
    - `m009.down` with no Brentwood Park congregation logs that there is nothing to roll back and resolves
    - _Requirements: 1.5, 1.6, 8.1, 8.2, 8.3, 9.6, 9.7_

  - [x] 6.3 Write the migration sequence test
    - Run migrations 001 through 009 on an empty database using `enableSqliteCompat()` and `mockCsv()` as in `songNameMigration.test.ts`
    - Assert that the Brentwood Park services and slots match the mocked schedule
    - _Requirements: 2.4, 6.2, 9.2_

  - [x] 6.4 Write the transaction-wiring test
    - Spy on `Congregation.upsert`, `SlotTemplate.upsert`, `SlotTemplate.findAll`, `Song.findAll`, `Service.destroy`, `Service.upsert` and `ServiceSlot.upsert`
    - Run `m009.up` and assert every call received an options object containing a `transaction`
    - Needed because the shared in-memory SQLite connection hides a missing transaction in a rollback test
    - _Requirements: 3.8_

  - [x] 6.5 Write the pre-flight failure tests
    - With prior services present, a missing schedule file makes `up` reject with both searched paths in the message
    - With prior services present, malformed JSON makes `up` reject, and so does a JSON value that is not an array
    - In each case the prior services remain and `sequelize.transaction` was not called
    - _Requirements: 3.6, 3.7_

  - [ ]* 6.6 Write property test for re-import result
    - **Property 1: Re-import result depends only on the schedule**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.3, 7.1, 1.5**
    - Generate a prior Brentwood Park state (possibly empty) and a schedule with duplicate date and type pairs and unknown slot keys; run `m009.up` and compare Brentwood Park services and slots to an expected state computed by an independent model of the schedule; assert no slot references a missing service
    - Run at least 100 iterations
    - Tag: `// Feature: brentwood-schedule-reimport, Property 1: Re-import result depends only on the schedule`

  - [ ]* 6.7 Write property test for scope isolation
    - **Property 4: Other congregations, templates and songs are untouched**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 8.3**
    - Generate a second congregation with templates, services and slots, a song table and a schedule; snapshot all non-Brentwood rows (ignoring `updated_at`) and assert they are identical before and after `up`, and before and after `down`
    - Run at least 100 iterations
    - Tag: `// Feature: brentwood-schedule-reimport, Property 4: Other congregations, templates and songs are untouched`

  - [ ]* 6.8 Write property test for failed import rollback
    - **Property 5: A failed import leaves Brentwood Park unchanged**
    - **Validates: Requirements 3.8**
    - Generate a prior state and a schedule with at least one song entry; make the k-th `Service.upsert` or `ServiceSlot.upsert` call reject; assert `up` rejects and the Brentwood Park services and slots equal their prior state
    - Run at least 100 iterations
    - Tag: `// Feature: brentwood-schedule-reimport, Property 5: A failed import leaves Brentwood Park unchanged`

  - [ ]* 6.9 Write property test for `down`
    - **Property 6: `down` removes all Brentwood Park services**
    - **Validates: Requirements 8.1**
    - Generate a prior Brentwood Park state; run `m009.down`; assert no Brentwood Park service or slot remains and the congregation and its slot templates are still present
    - Run at least 100 iterations
    - Tag: `// Feature: brentwood-schedule-reimport, Property 6: down removes all Brentwood Park services`

- [x] 7. Final checkpoint - Ensure all tests pass
  - Run the full API Jest suite (`npm test` in `music-planner-api/`) and confirm it passes, including `songNameMigration.test.ts`.
  - _Requirements: 9.8_
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The helper lives in `src/db/importers/`, not `src/db/migrations/`, because Umzug loads every file in `migrations/` as a migration
- Every model call inside the 009 transaction must pass `{ transaction }`; task 6.4 guards this because the in-memory SQLite connection is shared
- Property tests use `fast-check` with at least 100 iterations, one property test per design property
- Both new test files declare their own `jest.mock('fs', ...)` block because `jest.mock` is hoisted
- Umzug's skip-if-recorded behavior (requirements 2.2, 2.3) belongs to the library and is not tested here

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2", "6.2"] },
    { "id": 5, "tasks": ["5.3", "6.3"] },
    { "id": 6, "tasks": ["6.4"] },
    { "id": 7, "tasks": ["6.5"] },
    { "id": 8, "tasks": ["6.6"] },
    { "id": 9, "tasks": ["6.7"] },
    { "id": 10, "tasks": ["6.8"] },
    { "id": 11, "tasks": ["6.9"] }
  ]
}
```
