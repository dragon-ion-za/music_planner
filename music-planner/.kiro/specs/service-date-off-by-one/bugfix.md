# Bugfix Requirements Document

## Introduction

Imported Brentwood Park services appear one day earlier than they should. A Sunday Service shows on the Saturday, a Midweek Service on the Tuesday instead of the Wednesday, and Good Friday on the Thursday. The schedule file `.data/brentwood-schedule-latest.json` stores service dates as UTC instants. Of its 207 entries, 204 are local midnight in Africa/Johannesburg (UTC+2) written as `T22:00:00.000Z` on the previous UTC day. The importer takes the first 10 characters of that string, so the UTC calendar date is stored instead of the congregation's local date. The three remaining entries (two at `T00:00:00.000Z`, one at `T11:48:00.000Z`) already fall on the correct local date. The Angular add/edit dialog and the API serialization handle `YYYY-MM-DD` strings correctly and are not affected.

Fixing the importer corrects fresh databases. Databases that already ran migrations 007 and 009 keep the wrong dates, so a data migration is also required. **That migration changes stored `service_date` values.**

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the importer reads a schedule entry whose `date` is an ISO UTC instant that falls on a different calendar day in Africa/Johannesburg (for example `2025-01-04T22:00:00.000Z`) THEN the system stores the UTC calendar date (`2025-01-04`) instead of the local date (`2025-01-05`)

1.2 WHEN the importer runs on the current schedule file THEN the system stores 204 of 207 services one day early, so Sunday services land on Saturdays, midweek services on Tuesdays, and holiday services such as Good Friday on Thursdays

1.3 WHEN a database has already run migrations 007 and 009 with the current importer THEN the system keeps the one-day-early `service_date` values and shows them in the monthly view, the edit dialog and the conflict calculations

### Expected Behavior (Correct)

2.1 WHEN the importer reads a schedule entry whose `date` is an ISO UTC instant THEN the system SHALL store the calendar date of that instant in the congregation timezone (`Africa/Johannesburg`), so `2025-01-04T22:00:00.000Z` is stored as `2025-01-05`

2.2 WHEN the importer runs on the current schedule file THEN the system SHALL store every service on its correct local date, with Sunday services on Sundays, midweek services on their intended weekday, and holiday services on their holiday date

2.3 WHEN a new migration runs on a database that was imported with the faulty importer THEN the system SHALL move each service whose stored date and service type match a schedule entry's faulty date and type to that entry's correct local date, keeping the service's id, slots and any edits to its songs

2.4 WHEN the correction migration would move a service onto a date that already holds a service of the same congregation and service type THEN the system SHALL skip that service, log a warning naming it, and continue with the remaining services

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a schedule entry's UTC date and Johannesburg date are the same (for example `2025-01-05T00:00:00.000Z` or `T11:48:00.000Z`) THEN the system SHALL CONTINUE TO store that date unchanged, and the correction migration SHALL CONTINUE TO leave the matching stored service untouched

3.2 WHEN a user creates or edits a service in the Angular dialog THEN the system SHALL CONTINUE TO send the picked calendar date as `YYYY-MM-DD` and the API SHALL CONTINUE TO store and return it without any time zone shift

3.3 WHEN the API returns services THEN the system SHALL CONTINUE TO serialize `serviceDate` as a `YYYY-MM-DD` string, and the monthly view SHALL CONTINUE TO display it as is

3.4 WHEN the correction migration runs THEN the system SHALL CONTINUE TO leave services that match no schedule entry (user-added services, or services whose date or type a user edited) unchanged, and SHALL CONTINUE TO preserve all service slots, songs and congregation data

3.5 WHEN the importer processes the other schedule fields (service type, slot keys, song numbers, empty or `N/A` songs) THEN the system SHALL CONTINUE TO import them exactly as before

3.6 WHEN the correction migration is run a second time on already-corrected data THEN the system SHALL CONTINUE TO leave the data unchanged
