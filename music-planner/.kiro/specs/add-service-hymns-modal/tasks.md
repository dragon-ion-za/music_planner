# Implementation Plan: Add Service Hymns Modal

## Overview

Implement the Add Service Hymns Modal end-to-end: frontend model additions, the new pure conflict helper, the `AddServiceDialogComponent`, updates to `ServicesApiService` and `MonthlyServicesViewComponent`, and the backend `ServiceRepository` change that resolves `songNumber` to a database `songId`.

## Tasks

- [x] 1. Add frontend data models
  - [x] 1.1 Add `RepertoireEntry` interface to `music-planner-app/src/app/monthly-services-view/models/repertoire.model.ts` (new file)
    - Define `interface RepertoireEntry { number: string; translation: string; }`
    - _Requirements: 4.7, 4.8, 4.10_
  - [x] 1.2 Add `CreateServiceSlotInput` and `CreateServicePayload` interfaces to `service.model.ts`
    - `CreateServiceSlotInput { slotKey: string; songNumber: string | null; }`
    - `CreateServicePayload { serviceDate: string; serviceType: string; slots: CreateServiceSlotInput[]; }`
    - _Requirements: 6.2, 6.3_

- [x] 2. Add `createService` method to `ServicesApiService`
  - [x] 2.1 Implement `createService(payload: CreateServicePayload): Observable<Service>` in `services-api.service.ts`
    - POST to `/api/services` with `Authorization: Bearer <token>` via the existing `withToken` helper
    - Import `CreateServicePayload` from `service.model.ts`
    - _Requirements: 6.2, 8.1, 8.2_
  - [ ]* 2.2 Write unit tests for `ServicesApiService.createService`
    - Test that it sends POST to `/api/services` with `Authorization: Bearer <token>` header
    - Test that it forwards the payload body unchanged
    - _Requirements: 6.2, 8.2_

- [x] 3. Implement `buildModalConflictMap` pure helper
  - [x] 3.1 Create `music-planner-app/src/app/monthly-services-view/services/modal-conflict.util.ts`
    - Export `DraftSlot` interface, `ModalConflictMap` type alias, and `buildModalConflictMap` function
    - Implement the algorithm from the design doc: build window occurrences, build draft occurrences using canonical number resolution via `repertoireMap`, combine, then compute worst severity per draft slot
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  - [ ]* 3.2 Write property test for canonical number resolution (Property 3)
    - **Property 3: Canonical number resolution uses translation when non-empty**
    - **Validates: Requirements 4.10, 5.8**
    - For any `{ number, translation }` entry: non-empty `translation` → canonical = `translation`; empty → canonical = `number`
    - Use `fast-check` with `fc.record({ number: fc.string({ minLength: 1 }), translation: fc.string() })`
    - Tag: `// Feature: add-service-hymns-modal, Property 3: Canonical number resolution uses translation when non-empty`
  - [ ]* 3.3 Write unit tests for `buildModalConflictMap`
    - Empty draft slots → empty conflict map
    - Draft slot whose song is in a window service within 56 days → `'red'`
    - Draft slot whose song is in a window service at 57–90 days → `'yellow'`
    - Draft slot whose song is in a window service at 91–365 days → `'green'`
    - Draft slot whose song last appeared > 365 days ago → `null` severity
    - Two draft slots with the same canonical number → cross-slot conflict detected
    - Song with non-empty translation: uses translation as canonical number
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.8_

- [x] 4. Checkpoint — verify helper and service compile cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement `AddServiceDialogComponent`
  - [x] 5.1 Create component scaffold and Material imports
    - Create `music-planner-app/src/app/monthly-services-view/components/add-service-dialog/add-service-dialog.component.ts` as a standalone component
    - Import `MatDialogModule`, `MatFormFieldModule`, `MatInputModule`, `MatButtonModule`, `MatDatepickerModule`, `MatMomentDateModule`, `MatAutocompleteModule`, `MatProgressSpinnerModule`, `MatTooltipModule`, `MatSnackBarModule`, `FormsModule`, `CommonModule`
    - Declare `SLOT_TEMPLATES` constant with all 14 slot definitions (slotKey, category, displayOrder)
    - Define `SlotState` interface with `slotKey`, `category`, `displayOrder`, `songNumber`, `filteredOptions`, `conflictStatus`
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 Implement template-driven form fields: date picker and service type
    - Add `serviceDate` (`moment.Moment | null`) and `serviceType` (string) component properties bound via `ngModel`
    - Wire `MatDatepicker` with `MomentDateAdapter`; display format `YYYY-MM-DD`
    - Add required validators for both fields; show `mat-error` messages on invalid submit attempt
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_
  - [x] 5.3 Implement 14 slot inputs with autocomplete and repertoire validator
    - On `ngOnInit`, import `repertoire.json`, build `repertoireMap` (`Map<string, RepertoireEntry>`) and `repertoireSet` (`Set<string>`)
    - Initialise `slotStates` as deep copies of `SLOT_TEMPLATES`
    - Implement `filterOptions(slot: SlotState): void` that filters by prefix (case-insensitive)
    - Implement `repertoireValidator(repertoireSet)` as a `ValidatorFn`; empty value → valid; non-empty not in set → `{ unknownSong: true }`
    - Display each autocomplete option as `number (→ translation)` when translation is non-empty, else just `number`
    - _Requirements: 4.3, 4.4, 4.5, 4.7, 4.8, 4.9_
  - [ ]* 5.4 Write property test for autocomplete prefix filter (Property 1)
    - **Property 1: Autocomplete filters by prefix**
    - **Validates: Requirements 4.8**
    - `filterOptions(prefix, repertoire)` returns exactly entries whose `number.toLowerCase().startsWith(prefix.toLowerCase())`
    - Use `fc.array(songEntryArb)` as repertoire and `fc.string()` as prefix; `numRuns: 100`
    - Tag: `// Feature: add-service-hymns-modal, Property 1: Autocomplete filters by prefix`
  - [ ]* 5.5 Write property test for repertoire validator (Property 2)
    - **Property 2: Repertoire validator rejects unknown numbers and accepts known ones**
    - **Validates: Requirements 4.9**
    - Unknown string → non-null error; known string → null; empty string → null
    - Use `fc.string()` for unknowns and `fc.constantFrom(...knownNumbers)` for known; `numRuns: 100`
    - Tag: `// Feature: add-service-hymns-modal, Property 2: Repertoire validator rejects unknown numbers and accepts known ones`
  - [x] 5.6 Implement real-time conflict detection in the dialog
    - Add `windowServices: Service[]`, `saving: boolean`, `submitError: string | null` properties
    - Implement `fetchConflictWindow(date: moment.Moment): void` — calls `servicesApiService.getServices(conflictFrom, conflictTo)` with ±365-day range; updates `windowServices`; calls `rebuildConflictMap()`
    - Implement `rebuildConflictMap(): void` — calls `buildModalConflictMap(windowServices, draftSlots, serviceDate, repertoireMap)` and updates each `slotState.conflictStatus`
    - Call `fetchConflictWindow` on date change and on `ngOnInit` if date is pre-set
    - Call `rebuildConflictMap` on every slot number change
    - _Requirements: 5.1, 5.2, 5.9_
  - [ ]* 5.7 Write property test for conflict window date range (Property 4)
    - **Property 4: Conflict window date range is exactly ±365 days**
    - **Validates: Requirements 5.1, 2.5, 5.9**
    - For any date D formatted as `YYYY-MM-DD`, `from = moment(D).subtract(365, 'days').format('YYYY-MM-DD')` and `to = moment(D).add(365, 'days').format('YYYY-MM-DD')`
    - Use `fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })` mapped to YYYY-MM-DD string; `numRuns: 100`
    - Tag: `// Feature: add-service-hymns-modal, Property 4: Conflict window date range is exactly ±365 days`
  - [x] 5.8 Implement conflict badge rendering in the component template
    - In `add-service-dialog.component.html`, render slots grouped by category using `slotGroups` getter
    - Show a colour badge (red/yellow/green CSS class) per slot when `conflictStatus.severity` is non-null
    - Hide badge when severity is null or slot is empty
    - Attach `matTooltip` to each badge listing `conflictingDates` (date + serviceType per line)
    - _Requirements: 4.1, 4.2, 4.3, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [x] 5.9 Implement Save and Cancel button logic
    - `onSave()`: validate form; build `CreateServicePayload` with 14 slot entries (`songNumber: null` for empty); call `servicesApiService.createService(payload)`; on success close with `'saved'`; on 409 show inline error; on other error show generic inline error with status code; set `saving = true` while in flight; re-enable on error
    - `onCancel()`: call `dialogRef.close()` with no argument
    - While `saving === true`: disable Save button, all form inputs, show spinner inside Save button
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.1, 7.2, 7.4_
  - [ ]* 5.10 Write property test for POST payload slot count (Property 5)
    - **Property 5: POST payload contains exactly 14 slot entries**
    - **Validates: Requirements 6.2, 6.3**
    - For any combination of 14 song number strings (some empty), `payload.slots.length === 14`; empty inputs → `songNumber: null`
    - Use `fc.array(fc.string(), { minLength: 14, maxLength: 14 })`; `numRuns: 100`
    - Tag: `// Feature: add-service-hymns-modal, Property 5: POST payload contains exactly 14 slot entries`
  - [ ]* 5.11 Write property test for service type validation (Property 6)
    - **Property 6: Service type field accepts any non-empty string**
    - **Validates: Requirements 3.3**
    - Any string with `minLength: 1` → validator returns null
    - Use `fc.string({ minLength: 1 })`; `numRuns: 100`
    - Tag: `// Feature: add-service-hymns-modal, Property 6: Service type field accepts any non-empty string`
  - [ ]* 5.12 Write unit tests for `AddServiceDialogComponent`
    - Dialog opens when "Add Service" button clicked (MatDialog mock); `disableClose: true` set
    - Save with empty `serviceDate` → form invalid, POST not called
    - Save with empty `serviceType` → form invalid, POST not called
    - Valid form → `createService` called with correct payload shape
    - 201 response → dialog closes with `'saved'`
    - 409 response → dialog stays open, error message rendered
    - 5xx response → dialog stays open, generic error with status code
    - POST in flight → Save button disabled, inputs disabled, spinner shown
    - Cancel button → `dialogRef.close()` called without `'saved'`
    - Conflict indicator renders in correct colour for red/yellow/green
    - Conflict indicator absent when slot is empty or severity is null
    - Tooltip on badge lists conflicting dates and service types
    - _Requirements: 1.2, 2.4, 3.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.4, 6.5, 6.6, 6.7, 6.8, 7.1, 7.2_

- [x] 6. Checkpoint — verify dialog compiles and all existing tests still pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update `MonthlyServicesViewComponent` to open the dialog
  - [x] 7.1 Inject `MatDialog` and add `openAddServiceDialog()` to `monthly-services-view.component.ts`
    - Import `MatDialog` from `@angular/material/dialog` and add to `imports` array
    - Import `AddServiceDialogComponent`
    - Implement `openAddServiceDialog()`: open dialog with `width: '800px'`, `disableClose: true`; subscribe to `afterClosed()`; call `loadServices(this.selectedMonth)` when result is `'saved'`
    - _Requirements: 1.2, 1.3, 6.4_
  - [x] 7.2 Add "Add Service" button to `monthly-services-view.component.html`
    - Add a `mat-raised-button` labelled "Add Service" to the toolbar row; always visible
    - Bind `(click)` to `openAddServiceDialog()`
    - Import `MatButtonModule` in the component's `imports` array if not already present
    - _Requirements: 1.1, 1.2_
  - [ ]* 7.3 Write unit tests for `MonthlyServicesViewComponent` dialog integration
    - Monthly view reloads after dialog closes with `'saved'`
    - Monthly view does NOT reload after dialog closes with no result (undefined)
    - _Requirements: 1.2, 6.4_

- [x] 8. Update `ServiceRepository` in the backend to resolve `songNumber`
  - [x] 8.1 Extend `SlotInput` interface in `music-planner-api/src/repositories/ServiceRepository.ts`
    - Add optional `songNumber?: string | null` field alongside existing `songId?: string | null`
    - _Requirements: 6.3_
  - [x] 8.2 Add `songNumber` resolution logic in `ServiceRepository.create`
    - Per slot: if `songId` is provided and non-null → use it directly; else if `songNumber` is non-empty → call `Song.findOne({ where: { number: songNumber } })`; use found song's `id` or `null` if not found
    - _Requirements: 6.3_
  - [ ]* 8.3 Write unit tests for `ServiceRepository.create` slot resolution
    - Slot with `songNumber` present, no `songId` → looks up Song and uses found id
    - Slot with `songId` present → uses `songId` directly, no lookup
    - Slot with `songNumber` not found in DB → creates slot with `songId: null`
    - _Requirements: 6.3_

- [~] 9. Final checkpoint — full test suite passes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property-based tests use `fast-check` (install as dev dependency if not already present: `npm install --save-dev fast-check`)
- Each property test runs a minimum of 100 iterations (`numRuns: 100`)
- The `buildModalConflictMap` helper is pure (no Angular DI) — test it with plain TypeScript imports
- The `repertoireValidator` is a plain `ValidatorFn` factory — also testable without Angular TestBed
- Backend tests live in `music-planner-api/src/api/tests/` (Jest)
- Frontend tests use Karma + Jasmine (`.spec.ts` suffix)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "8.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "8.2"] },
    { "id": 3, "tasks": ["5.1", "8.3"] },
    { "id": 4, "tasks": ["5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "5.5", "5.6"] },
    { "id": 6, "tasks": ["5.7", "5.8", "5.11"] },
    { "id": 7, "tasks": ["5.9"] },
    { "id": 8, "tasks": ["5.10", "5.12", "7.1"] },
    { "id": 9, "tasks": ["7.2"] },
    { "id": 10, "tasks": ["7.3"] }
  ]
}
```
