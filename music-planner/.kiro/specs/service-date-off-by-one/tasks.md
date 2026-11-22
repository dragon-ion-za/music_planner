# Implementation Plan: Service Date Off-By-One

## Overview

Fix the importer so schedule instants are converted to Africa/Johannesburg before the calendar date is taken, and add migration 010 to correct already-imported services. Work is in `music-planner-api/` (Jest, fast-check). Exploration and preservation tests are written and run on unfixed code first.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Import stores the UTC date instead of the Johannesburg date
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to instants where `isBugCondition` holds (UTC time of day from 22:00:00.000Z to 23:59:59.999Z, any date including month, year and leap-day boundaries)
  - Add the test in `music-planner-api/src/db/importers/` (Jest + fast-check, `*.test.ts` beside the existing importer tests)
  - Assert `parseDate(instant)` equals the Africa/Johannesburg calendar date, which is the UTC date plus one day
  - Include concrete cases: `2025-01-04T22:00:00.000Z` â†’ `2025-01-05`, `2025-12-31T22:00:00.000Z` â†’ `2026-01-01`, `2024-02-28T22:00:00.000Z` â†’ `2024-02-29`
  - Add a data check: every entry in `.data/brentwood-schedule-latest.json` at 22:00Z maps to the next day
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "parseDate('2025-01-04T22:00:00.000Z') returns '2025-01-04' instead of '2025-01-05'")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Unaffected dates and non-date import data
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: `parseDate('2025-01-05T00:00:00.000Z')` returns `'2025-01-05'`, `parseDate('2025-01-05T11:48:00.000Z')` returns `'2025-01-05'`, `parseDate('2025-01-05')` returns `'2025-01-05'`
  - Write property-based test: for all instants with UTC time of day from 00:00:00.000Z to 21:59:59.999Z, `parseDate(instant)` equals `instant.substring(0, 10)` (from Preservation Requirements in design)
  - Write a test that `importSchedule` on a small fixture still produces the same service types, slot keys, song ids and null songs for empty/`N/A` numbers (ignoring service date)
  - Write a test that `buildServicePayload` still returns the picked local calendar date as `YYYY-MM-DD` in `music-planner-app` (extend the existing `service-form.util` spec only if no equivalent exists)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 3. Fix for service dates stored one day early

  - [x] 3.1 Fix `parseDate` in the importer
    - In `music-planner-api/src/db/importers/brentwoodSchedule.ts`, convert the instant to `CONGREGATION_TIMEZONE` with `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })` and `formatToParts`, and return `YYYY-MM-DD`
    - New signature `parseDate(isoString: string, timeZone: string = CONGREGATION_TIMEZONE)`
    - Return date-only strings (`^\d{4}-\d{2}-\d{2}$`) unchanged
    - Throw an `Error` naming the value for an invalid date string
    - Replace the misleading "calendar date portion" comment
    - Do not change `.data/brentwood-schedule-latest.json`
    - _Bug_Condition: isBugCondition(entry) where utcDate(entry.date) != localDate(entry.date, "Africa/Johannesburg")_
    - _Expected_Behavior: parseDate(entry.date) = localDate(entry.date, "Africa/Johannesburg")_
    - _Preservation: entries with equal UTC and local dates, date-only strings and all non-date import fields are unchanged_
    - _Requirements: 2.1, 2.2, 3.1, 3.5_

  - [x] 3.2 Add data migration 010 to correct already-imported services
    - **WARNING: this migration changes stored `service_date` values for existing services.** It does not delete any rows. State this in the file header comment and in the final report
    - Create `music-planner-api/src/db/migrations/010-correct-service-dates.ts`
    - `up`: `initAssociations()`, `readSchedule(resolveScheduleFile())` before the transaction, find the Brentwood Park congregation (log and return if absent), then in one transaction apply the plan
    - Plan: for each entry compute `faultyDate = entry.date.substring(0, 10)` and `correctDate = parseDate(entry.date)`, keep entries where they differ, sort by `correctDate` descending
    - For each planned entry find the service by (congregationId, faultyDate, serviceType); skip if none; skip with `console.warn` if a service already exists at (congregationId, correctDate, serviceType); otherwise `Service.update` the `serviceDate` so id, slots and `created_at` are kept
    - Log counts of moved, not-found and skipped services
    - `down`: reverse the moves with the same matching and collision rule; document that only rows still at the corrected date are reverted
    - Add Jest tests with an in-memory database: faulty rows move, correct and unmatched rows stay, a collision is skipped with a warning, slots keep their `service_id`, a second run changes nothing
    - _Bug_Condition: isBugCondition(entry) for services already stored by migrations 007/009_
    - _Expected_Behavior: stored service_date = parseDate(entry.date); ids, slots and edits preserved_
    - _Preservation: services matching no entry, and rows already on the correct date, are untouched_
    - _Requirements: 1.3, 2.3, 2.4, 3.4, 3.6_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Import stores the Johannesburg date
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from task 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Unaffected dates and non-date import data
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from task 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

  - [x] 3.5 Integration check on a database
    - Fresh database: run migrations 007, 009, 010; confirm all 207 services sit on correct dates, Sunday Services fall on Sundays, and 010 moves 0 rows
    - Existing database: back up first (`pg_dump`), then run `npm run migrate` in `music-planner-api`; confirm 204 services moved, 3 unchanged, service and slot counts unchanged
    - Open the monthly view and confirm a known Sunday service shows on the Sunday

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npm test` in `music-planner-api` and `music-planner-app`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Migration 010 changes stored `service_date` values; back up the database before running it on existing data
- No Angular change is needed; the dialog and API already handle `YYYY-MM-DD` strings
- The legacy `schedule` component works on file-supplied instants and is out of scope
- Write and run tasks 1 and 2 on UNFIXED code before task 3.1

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["3.5"] },
    { "id": 5, "tasks": ["4"] }
  ]
}
```
