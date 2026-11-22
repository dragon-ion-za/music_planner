# Implementation Plan: Edit Service Modal

## Overview

Extend `PUT /api/services/:id` to update date, type and slots by song number, add pure form helpers in the Angular app, make `AddServiceDialogComponent` work in an edit mode, and add an Edit button to each service card. Backend work comes first so the frontend can call a real endpoint. Test sub-tasks are optional (marked `*`).

## Tasks

- [x] 1. Extend the update endpoint (music-planner-api)
  - [x] 1.1 Add `ServiceRepository.update` and `UnknownSongError`
    - Export `UnknownSongError` from `ServiceRepository.ts`
    - Extract a `resolveSongId` helper: `songId` present is used as-is (including null); otherwise null `songNumber` gives null; otherwise look up `Song` by number and throw `UnknownSongError` when absent (strict mode for update only; `create` keeps its lenient behavior)
    - Implement `update(service, congregationId, { serviceDate?, serviceType?, slots? })` in one Sequelize transaction: resolve all song ids first, update date/type, upsert slots using the new type (`findTemplate`), return `findByIdWithSlots`
    - Leave slot keys omitted from the request unchanged
    - Keep `upsertSlots` and its signature intact for drag-and-drop swaps
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.12_

  - [x] 1.2 Update the `PUT /api/services/:id` route in `routes/services.ts`
    - Keep the 404 and 403 checks
    - Respond 400 for a present but malformed `serviceDate` and for a present but blank `serviceType`
    - Call `ServiceRepository.update`; map `UnknownSongError` to 400 with an `error` message naming the number; let `UniqueConstraintError` reach the error handler (409)
    - Respond 200 with the updated service
    - _Requirements: 8.1, 8.2, 8.6, 8.8, 8.9, 8.10, 8.11, 8.12_

  - [ ]* 1.3 Write repository tests against the SQLite test DB
    - Date and type change; `songNumber` resolves to song id; `null` clears; `songId` used directly; omitted slot keys unchanged; missing `service_slots` row is created
    - Unknown `songNumber` throws and leaves the service and slots unchanged
    - Collision on date and type throws `UniqueConstraintError` and leaves the service unchanged
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 1.4 Extend `services.integration.test.ts` for PUT
    - 400 malformed date, 400 blank type, 404, 403, 200, 409 on `UniqueConstraintError`, 400 on `UnknownSongError`
    - A body with only `songId` slots is still accepted
    - _Requirements: 8.1, 8.2, 8.6, 8.8, 8.9, 8.10, 8.11, 8.12_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add frontend helpers and API client
  - [x] 3.1 Create `service-form.util.ts` and `UpdateServicePayload`
    - Add `UpdateServicePayload` (alias of `CreateServicePayload`) to `models/service.model.ts`
    - Create `services/service-form.util.ts` with `EMPTY_SONG = 'N/A'`, `normalizeSongInput`, `slotsFromService`, `buildServicePayload` (14 entries in `SLOT_TEMPLATES` order, trimmed service type)
    - _Requirements: 3.1, 3.3, 3.4, 5.3, 5.4, 7.1_

  - [ ]* 3.2 Write property test for payload normalization
    - **Property 1: Payload has one normalized entry per slot**
    - Use fast-check, at least 100 runs; install `fast-check` as a dev dependency in `music-planner-app` if missing
    - **Validates: Requirements 5.3, 5.4, 7.1**

  - [ ]* 3.3 Write property test for pre-fill round trip
    - **Property 2: Pre-fill then build payload preserves the service's songs**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 7.1**

  - [x] 3.4 Add `excludeServiceId` to `buildModalConflictMap`
    - Optional last parameter; filter matching services out of `windowServices` before building occurrences
    - Existing callers (add flow) are unaffected
    - _Requirements: 6.2_

  - [ ]* 3.5 Write property test for conflict exclusion
    - **Property 3: Edited service is excluded from conflict detection**
    - **Validates: Requirements 6.2**

  - [x] 3.6 Add `updateService` to `ServicesApiService`
    - `PUT` to `buildUrl('/api/services/:id')` with the payload and bearer token; leave `updateServiceSlots` untouched
    - _Requirements: 7.1, 7.2_

  - [x] 3.7 Write unit tests for `updateService`
    - Correct URL (with base URL), method, body and Authorization header
    - _Requirements: 7.1, 7.2_

- [x] 4. Make the dialog support edit mode
  - [x] 4.1 Update `AddServiceDialogComponent`
    - Inject `MAT_DIALOG_DATA` with `@Optional()`; add `editingService` and `isEditMode`
    - In `ngOnInit`, pre-fill date, type and slot numbers via `slotsFromService` when in edit mode, then fetch the conflict window
    - Title "Edit Service" in edit mode, "Add Service" otherwise
    - Pass `editingService?.id` to `buildModalConflictMap`
    - Treat `N/A` and blank as empty in conflict detection, the unknown-song check and the template `mat-error`
    - Build the payload with `buildServicePayload`; call `updateService(id, payload)` in edit mode and `createService` otherwise
    - Error messages: 409 duplicate text, 400 server `error` text, other "Failed to save service (status)."
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 4.2 Write unit tests for the dialog
    - Edit mode: title, pre-filled values, conflict window fetched on open, `updateService` called with the service id, closes with `'saved'`
    - 409, 400 and 500 messages; in-flight state disables controls
    - Clearing a slot and typing `N/A` send `songNumber: null`; unknown number blocks save
    - Add mode unchanged: title, blank form, `createService` called
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.5, 4.4, 4.5, 5.2, 5.3, 5.4, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 5. Add the Edit entry point
  - [x] 5.1 Add the Edit button to `ServiceCardComponent`
    - Add `@Output() editRequested`, import `MatButtonModule`, place a `mat-stroked-button` "Edit" in the card header, disable it while `swapping`, style it at the header's right edge
    - _Requirements: 1.1, 1.4_

  - [x] 5.2 Wire the card to the monthly view
    - Add `openEditServiceDialog(service)` to `MonthlyServicesViewComponent` using `{ width: '800px', disableClose: true, data: { service } }`
    - Bind `(editRequested)` on both `<app-service-card>` usages in the template
    - Reload services for the selected month when the dialog closes with `'saved'`
    - _Requirements: 1.2, 1.3, 1.5, 1.6_

  - [x] 5.3 Write unit tests for card and view
    - Card renders the Edit button, emits `editRequested`, disables it while swapping
    - View opens the dialog with the expected config, reloads on `'saved'`, does nothing otherwise
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests validate the three pure helpers; backend behavior is covered with example and integration tests
- `PUT` remains backward compatible with the drag-and-drop swap, which sends only `songId` slots

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "3.4", "5.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.2", "3.5", "3.6"] },
    { "id": 2, "tasks": ["1.4", "3.3", "3.7", "4.1", "5.2"] },
    { "id": 3, "tasks": ["4.2", "5.3"] }
  ]
}
```
