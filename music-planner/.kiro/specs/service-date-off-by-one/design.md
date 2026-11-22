# Service Date Off-By-One Bugfix Design

## Overview

Imported Brentwood Park services are stored one day early. The schedule file holds each service date as a UTC instant. Local midnight in Africa/Johannesburg (UTC+2) is written as `T22:00:00.000Z` on the previous UTC day, and `parseDate` in `music-planner-api/src/db/importers/brentwoodSchedule.ts` keeps `isoString.substring(0, 10)`, which is the UTC date. 204 of the 207 entries are affected.

The fix has two parts:

1. Change `parseDate` to convert the instant to the congregation timezone before taking the calendar date. This corrects fresh databases (migrations 007 and 009 both use this importer).
2. Add migration 010 that moves already-imported services to the correct date. It matches stored rows against the schedule file by (faulty date, service type), so in-app edits and user-added services are preserved. **This migration changes stored `service_date` values.**

The Angular app and the API were checked and need no change. The dialog parses and formats with local `moment(..., 'YYYY-MM-DD')` and `.format('YYYY-MM-DD')`, the API stores and returns `DATEONLY` strings, and `service-card` prints the string as is. The legacy `schedule` component works on file-supplied instants and is out of scope.

## Glossary

- **Bug_Condition (C)**: A schedule entry whose UTC calendar date differs from its Africa/Johannesburg calendar date (any instant from 22:00:00Z to 23:59:59Z).
- **Property (P)**: The stored `service_date` equals the calendar date of the instant in Africa/Johannesburg.
- **Preservation**: Entries whose UTC and local dates agree, the API/dialog date handling, and all non-date import behavior must not change.
- **parseDate**: Function in `brentwoodSchedule.ts` that converts a schedule entry's `date` string into the `YYYY-MM-DD` value stored in `services.service_date`.
- **CONGREGATION_TIMEZONE**: Constant `'Africa/Johannesburg'` (UTC+2, no DST) in the same file.
- **Faulty date**: The date the old `parseDate` stored, `date.substring(0, 10)`.
- **Correct date**: The Johannesburg calendar date of the instant.

## Bug Details

### Bug Condition

The bug manifests when the importer processes an entry whose `date` is a UTC instant that lies on a different calendar day in Africa/Johannesburg. `parseDate` ignores the time portion and the time zone, so it returns the UTC calendar date.

**Formal Specification:**
```
FUNCTION isBugCondition(entry)
  INPUT: entry of type ScheduleEntry (entry.date is an ISO-8601 UTC string)
  OUTPUT: boolean

  RETURN utcDate(entry.date) != localDate(entry.date, "Africa/Johannesburg")
END FUNCTION
```

### Examples

- `2025-01-04T22:00:00.000Z`, Sunday Service: stored `2025-01-04` (Saturday); expected `2025-01-05` (Sunday).
- `Tuesday 22:00Z`, Midweek Service: stored on Tuesday; expected Wednesday.
- Good Friday at `Thursday 22:00Z`: stored on Thursday; expected Friday.
- `2025-01-05T00:00:00.000Z` (not affected): stored and expected `2025-01-05`.
- `T11:48:00.000Z` on a Sunday (not affected): stored and expected the same Sunday.
- Edge case: `…T21:59:59.999Z` is 23:59 local on the same UTC day, so it is not affected. `…T22:00:00.000Z` is the first affected instant.

Data check on the current file: 204 entries at 22:00Z (Saturday → Sunday Service and most holidays, Tuesday → Midweek Service, Wednesday → Ascension/Christmas, Thursday → Good Friday/Christmas), 2 at 00:00Z, 1 at 11:48Z. No two entries share (correct date, type), and no shifted entry's faulty (date, type) equals another entry's correct (date, type), so the migration has no internal collisions.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Entries at `T00:00:00.000Z` and `T11:48:00.000Z` keep their date.
- Dialog and API handling of `YYYY-MM-DD` strings is untouched.
- Service type, slot keys, song resolution and empty/`N/A` handling in `importSchedule` are untouched.
- Services that match no schedule entry are not modified by the migration.

**Scope:**
All inputs where the UTC and Johannesburg dates agree are unaffected by the `parseDate` change. Everything outside `parseDate` and the new migration is unchanged.

## Hypothesized Root Cause

Confirmed by inspecting the data and code, not a hypothesis only:

1. **UTC date used as local date (confirmed)**: `parseDate` uses `substring(0, 10)` on a UTC instant. The code comment says it stores "the calendar date portion", but the calendar date of the UTC string is not the local date. `CONGREGATION_TIMEZONE` is defined in the same file and is not used for dates.
2. **Frontend (ruled out)**: `buildServicePayload` formats a local moment; `AddServiceDialogComponent` parses `svc.serviceDate` with `moment(str, 'YYYY-MM-DD')`; no `toISOString()` or `new Date(string)` touches `serviceDate` in `monthly-services-view`.
3. **API serialization (ruled out)**: `Service.serviceDate` is `DATEONLY`; Sequelize returns a string and writes the given string without conversion. No `timezone` option is configured and none is needed for `DATEONLY`.
4. **Migration 009 deletes and re-imports**: it reproduced the same faulty dates. It does not need a change, but it will use the fixed `parseDate` on fresh databases.

## Correctness Properties

Property 1: Bug Condition - Import uses the congregation-local date

_For any_ schedule entry where the bug condition holds (isBugCondition returns true), the fixed `parseDate` SHALL return the Africa/Johannesburg calendar date of the instant, so the imported service is stored on that date, and the correction migration SHALL move an existing service stored under the faulty date and same service type to that date while keeping its id and slots.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Unaffected dates and data are unchanged

_For any_ schedule entry where the bug condition does NOT hold, the fixed `parseDate` SHALL return the same value as the original, and the correction migration SHALL leave the matching service unchanged. Services matching no entry, all slots and songs, and the API/dialog date handling SHALL be unchanged, and a second run of the migration SHALL change nothing.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `music-planner-api/src/db/importers/brentwoodSchedule.ts`

**Function**: `parseDate`

**Specific Changes**:
1. **Convert to local date**: Format the parsed instant with `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })` using `formatToParts` and assemble `YYYY-MM-DD`. This avoids adding a dependency such as `moment-timezone` (the API already depends on `moment`, which has no zone data).
2. **Signature**: `parseDate(isoString: string, timeZone: string = CONGREGATION_TIMEZONE): string`.
3. **Date-only input**: If the string already matches `^\d{4}-\d{2}-\d{2}$`, return it as is, since there is no instant to convert.
4. **Invalid input**: Throw an `Error` naming the value if `new Date(isoString)` is invalid, so a bad entry fails the import instead of storing garbage.
5. **Comment**: Replace the misleading comment to say the instant is converted to the congregation timezone.

**File**: `music-planner-api/src/db/migrations/010-correct-service-dates.ts` (new)

**Function**: `up` / `down`

**Specific Changes**:
1. **Pre-flight**: `readSchedule(resolveScheduleFile())` before opening a transaction, as migration 009 does.
2. **Plan**: For each entry compute `faultyDate = entry.date.substring(0, 10)` and `correctDate = parseDate(entry.date)`. Keep entries where they differ. Sort by `correctDate` descending, so a service is never moved onto a date a not-yet-moved service still occupies.
3. **Apply in one transaction**: Resolve the Brentwood Park congregation id (no seeding). For each planned entry, find the service by (congregationId, faultyDate, serviceType). If none exists, skip. If a service already exists at (congregationId, correctDate, serviceType), skip and `console.warn` with both dates and the type. Otherwise update `serviceDate` to `correctDate`. Use `Service.update`, not destroy/upsert, so ids, slots and `created_at` are kept.
4. **Log**: Print counts of moved, missing and skipped services.
5. **Idempotent and safe on fresh databases**: After the fixed 007/009 run, no row exists at a faulty (date, type), so the migration moves nothing.
6. **down**: Reverse the moves with the same matching (correct date → faulty date), applying the same skip-on-collision rule. Document that it only reverts rows still at their corrected date.
7. **Header comment**: State plainly that the migration changes stored `service_date` values and does not delete data.

## Testing Strategy

### Validation Approach

First surface the bug on the unfixed `parseDate`, then verify the fix and that unaffected inputs are unchanged. Tests use Jest and fast-check in `music-planner-api` (existing setup; SQLite is available for migration-level tests as in the existing importer tests).

### Exploratory Bug Condition Checking

**Goal**: Show that the unfixed `parseDate` returns the UTC date for 22:00Z instants.

**Test Plan**: Call `parseDate` with instants at 22:00:00Z to 23:59:59Z. Run on UNFIXED code.

**Test Cases**:
1. **Sunday Service**: `parseDate('2025-01-04T22:00:00.000Z')` expects `'2025-01-05'` (will fail on unfixed code, returns `'2025-01-04'`).
2. **Year boundary**: `parseDate('2025-12-31T22:00:00.000Z')` expects `'2026-01-01'` (will fail on unfixed code).
3. **Leap day**: `parseDate('2024-02-28T22:00:00.000Z')` expects `'2024-02-29'` (will fail on unfixed code).
4. **Real file**: Every entry at 22:00Z in `.data/brentwood-schedule-latest.json` maps to the next day (will fail on unfixed code).

**Expected Counterexamples**:
- `parseDate` returns the previous day for every instant in the 22:00Z–23:59:59Z range.
- Cause: substring of the UTC string; timezone never applied.

### Fix Checking

**Goal**: For all entries where the bug condition holds, the fixed code stores the local date.

**Pseudocode:**
```
FOR ALL entry WHERE isBugCondition(entry) DO
  result := parseDate_fixed(entry.date)
  ASSERT result = localDate(entry.date, "Africa/Johannesburg")
  ASSERT result = addDays(utcDate(entry.date), 1)
END FOR
```

### Preservation Checking

**Goal**: For all entries where the bug condition does not hold, results equal the original.

**Pseudocode:**
```
FOR ALL entry WHERE NOT isBugCondition(entry) DO
  ASSERT parseDate_original(entry.date) = parseDate_fixed(entry.date)
END FOR
```

**Testing Approach**: Property-based testing fits because the input domain is every instant, and fast-check generates boundary values (21:59:59.999Z, 22:00:00.000Z, month and year ends) that hand-written cases miss.

**Test Plan**: Record `substring(0, 10)` results on UNFIXED code for instants between 00:00:00Z and 21:59:59.999Z, then assert the fixed function agrees.

**Test Cases**:
1. **Daytime instants**: Instants between 00:00Z and 21:59:59.999Z return the same date before and after the fix.
2. **Date-only strings**: `'2025-01-05'` returns `'2025-01-05'`.
3. **Non-date import data**: Slot and song results of `importSchedule` are the same apart from the service date.

### Unit Tests

- `parseDate` for 22:00Z, 21:59:59.999Z, 00:00Z, 11:48Z, date-only, and an invalid string (throws).
- Migration 010 on an in-memory database: faulty rows move, correct rows stay, unmatched rows stay, a collision is skipped with a warning, slot rows keep their `service_id`.
- Migration 010 applied twice: second run changes nothing.

### Property-Based Tests

- For any instant, `parseDate(instant)` equals the UTC date plus 1 day when the UTC time is >= 22:00:00, else equals the UTC date.
- For any list of entries with distinct (correct date, type) and rows seeded at faulty dates, migration 010 leaves exactly one row per entry at the correct date and no rows at faulty dates.

### Integration Tests

- Run 007 then 009 then 010 on a fresh database with the real schedule file: all 207 services sit on their correct dates, weekday matches the service type for Sunday/Midweek services, and 010 moves 0 rows.
- Seed the database with the old importer's output, run 010: 204 services move, 3 stay, the service count and slot count are unchanged.
- API `GET /api/services` for a moved service returns the corrected `YYYY-MM-DD` string.
