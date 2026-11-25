# Implementation Plan: Dialog Conflict Field Highlight

## Overview

Build the pure helpers first (song resolution, payload canonicalization, highlight mapping, draft slot building), then wire them into `AddServiceDialogComponent`, replace the badge with a tinted field highlight, and finish with component tests. All paths are under `music-planner-app/src/app/monthly-services-view/` unless stated otherwise. Tests use Karma/Jasmine and `fast-check`.

## Tasks

- [x] 1. Add pure helpers for case-insensitive songs and highlight mapping
  - [x] 1.1 Add song resolution and canonical payload building in `services/service-form.util.ts`
    - Add `buildSongLookup(entries)` returning a lowercase-to-canonical `Map`
    - Add `resolveSongNumber(value, lookup)` that trims, ignores letter case, and returns the canonical number or null (null for blank, `N/A` in any case, and unknown text)
    - Add an optional `songLookup` parameter to `buildServicePayload`; known songs send the canonical number, blank and `N/A` send null, unknown text passes through trimmed, and the result keeps exactly 14 entries in `SLOT_TEMPLATES` order
    - Keep `normalizeSongInput` and existing callers working
    - _Requirements: 5.1, 5.2, 5.6, 7.1, 7.2, 7.3_

  - [x] 1.2 Add `SlotHighlight`, `buildDraftSlots` and `getSlotHighlight` in `services/modal-conflict.util.ts`
    - `buildDraftSlots(slots, lookup)` returns `DraftSlot[]` for known songs only, using canonical numbers
    - `getSlotHighlight(hasKnownSong, status)` returns null when there is no known song or no status, the severity when it is non-null, and `'free'` when the status exists with null severity
    - Do not change `buildModalConflictMap`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 6.1_

  - [x]* 1.3 Write property tests for song resolution in `services/service-form.util.spec.ts`
    - **Property 1: Case-insensitive resolution returns the canonical number**
    - **Property 2: Non-matching input resolves to no song**
    - **Property 3: Resolution is idempotent**
    - Use entries from `assets/repertoire.json`, per-character case flips, whitespace padding; at least 100 runs each; tag each test with `Feature: dialog-conflict-field-highlight, Property N: ...`
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x]* 1.4 Write property test for the payload in `services/service-form.util.spec.ts`
    - **Property 4: Payload carries canonical numbers, nulls for empty slots, and 14 ordered entries**
    - Generate, per slot key, a case-varied repertoire number, blank text, or an `N/A` case variant
    - **Validates: Requirements 5.6, 7.1, 7.2, 7.3**

  - [x]* 1.5 Write property test for the highlight mapping in new `services/modal-conflict.util.spec.ts`
    - **Property 5: Highlight mapping is total and follows the severity**
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**

  - [-]* 1.6 Write property test for case-invariant conflicts in `services/modal-conflict.util.spec.ts`
    - **Property 6: Conflict results do not depend on input letter case**
    - Compare `buildModalConflictMap` results for case-varied inputs (through `buildDraftSlots`) and canonical inputs over generated window services
    - **Validates: Requirements 6.1, 6.2**

- [~] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Wire the helpers into the Service Dialog and replace the badge
  - [~] 3.1 Update `components/add-service-dialog/add-service-dialog.component.ts`
    - Replace `repertoireSet` with `songLookup` built from the repertoire; keep `repertoireMap` keyed by canonical number
    - Make `isUnknownSong` and `repertoireValidatorFn` use `resolveSongNumber`
    - Add `conflictWindowLoaded`: false before each fetch, true on success, false on error; in `rebuildConflictMap`, clear every `conflictStatus` and return when there is no date or the window is not loaded; otherwise use `buildDraftSlots`
    - Add `getHighlight(slot)` using `getSlotHighlight`; make `getConflictTooltip` return text only for red, yellow and green
    - Add `onSongBlur(slot)` that replaces a resolvable input with its canonical number and rebuilds the conflict map
    - Pass `songLookup` to `buildServicePayload` in `onSave`; remove the unused `hasSong`
    - _Requirements: 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 5.4, 5.5, 6.1, 7.1, 7.4_

  - [~] 3.2 Update the template and styles
    - In `add-service-dialog.component.html`: delete the `.conflict-badge` span; bind `[ngClass]` (`highlight-<kind>`), `matTooltip`, `matTooltipDisabled` and `matTooltipClass="conflict-tooltip"` on the slot `mat-form-field`; add `(blur)="onSongBlur(slot)"` to the input; keep `ngModel`
    - In `add-service-dialog.component.css`: remove `.conflict-badge` and `.conflict-red/yellow/green`; add `.slot-field.highlight-red|yellow|green|free ::ng-deep .mat-mdc-text-field-wrapper` background rules using the service card tints (red `rgba(244,67,54,.15)`, yellow `rgba(255,193,7,.15)`, green `rgba(76,175,80,.15)`) and light blue `rgba(79,195,247,.25)`
    - In `src/styles.css` (app root): add `.conflict-tooltip { white-space: pre-line; }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 3.1, 3.2, 7.5_

  - [~]* 3.3 Extend `components/add-service-dialog/add-service-dialog.component.spec.ts`
    - Highlight classes red, yellow, green and free appear on the right `.slot-field` in add mode and edit mode, and no `.conflict-badge` exists
    - Empty, `N/A`, unknown, no-date and failed-fetch states show no highlight; Save still works after a failed fetch
    - `getConflictTooltip` lists `date (type)` per line for conflicts and `''` for free slots
    - Typing updates highlights; date change refetches; clearing the date removes highlights; edit mode excludes the edited service
    - `a10` is not unknown and `ZZZ999` is; Save with an unknown song is blocked and shows the error
    - Blur rewrites `a10` to `A10` and the update payload contains `A10`; `filterOptions('a1')` returns `A1*` entries and empty text returns none
    - Existing tests must still pass
    - _Requirements: 1.1-1.6, 2.1-2.5, 3.1, 3.2, 4.1-4.4, 5.4, 5.5, 7.1, 7.4, 7.5, 8.1, 8.2_

- [~] 4. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests validate the universal properties in the design; component tests cover UI behavior, which is not suited to property testing
- Run tests with `npm test` in `music-planner-app` (Karma opens a browser)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.5", "3.1"] },
    { "id": 2, "tasks": ["1.4", "1.6", "3.2"] },
    { "id": 3, "tasks": ["3.3"] }
  ]
}
```
