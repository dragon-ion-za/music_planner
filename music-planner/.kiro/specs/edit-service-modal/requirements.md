# Requirements Document

## Introduction

Music planners can create a service through the Add Service dialog (spec: `add-service-hymns-modal`), but they cannot change a service afterwards except by dragging songs between slots. This feature adds an edit flow that reuses the Add Service dialog. The dialog opens pre-filled with a service's date, type and 14 song slots. The planner can change any of them, and the changes are saved through `PUT /api/services/:id`.

The existing `PUT /api/services/:id` endpoint only updates slots, identified by `songId`. It is used by drag-and-drop swaps. This feature extends the endpoint so it can also update `serviceDate` and `serviceType` and accept slots by `songNumber`, while keeping the existing `songId` behavior for swaps.

Decisions made with the user:
- Service date and service type are both editable.
- The entry point is an "Edit" button in the header of each service card.

## Glossary

- **Edit_Service_Dialog**: The existing `AddServiceDialogComponent`, opened in edit mode. It is one component with two modes (add and edit), not a second component.
- **Monthly_Services_View**: The Angular component that lists the services of the selected month as service cards.
- **Service_Card**: The `ServiceCardComponent` that shows one service, including its header and slots.
- **Services_API**: The Express routes under `/api/services` in `music-planner-api`.
- **Service_Repository**: The `ServiceRepository` module in `music-planner-api` that reads and writes services and service slots.
- **Services_API_Client**: The Angular `ServicesApiService` that calls the Services_API with an Auth0 bearer token.
- **Service**: A scheduled worship service with a `serviceDate` (YYYY-MM-DD), a `serviceType` and up to 14 song slots.
- **Slot_Key**: One of the 14 slot identifiers: `orchestra1`-`orchestra5`, `choir1`-`choir4`, `congregationBS`, `congregationOH`, `congregationRP`, `congregationCM1`, `congregationCM2`.
- **Song_Number**: The repertoire number of a song, such as "A10". The value `N/A` represents an empty slot.
- **Empty_Slot_Value**: An input that is blank or equals `N/A` (case-insensitive). It is saved as no song.
- **Edited_Service**: The Service currently open in the Edit_Service_Dialog.
- **Conflict_Window**: The services within 365 days before and after the date in the dialog's date field.
- **Conflict_Severity**: `red` (reused within 56 days), `yellow` (57 to 90 days), `green` (91 to 365 days).
- **Duplicate_Service**: Another service of the same congregation with the same `serviceDate` and `serviceType` as the Edited_Service's new values.

## Requirements

### Requirement 1: Edit entry point

**User Story:** As a music planner, I want an Edit button on each service card, so that I can open any service for editing.

#### Acceptance Criteria

1. THE Service_Card SHALL display an "Edit" button in its header for every service.
2. WHEN the planner clicks the Edit button of a Service_Card, THE Monthly_Services_View SHALL open the Edit_Service_Dialog in edit mode for that service.
3. WHEN the Monthly_Services_View opens the Edit_Service_Dialog, THE Monthly_Services_View SHALL set `disableClose` to true and a width of 800px, matching the add flow.
4. WHILE a slot swap is in progress, THE Service_Card SHALL disable the Edit button.
5. WHEN the Edit_Service_Dialog closes with the result `'saved'`, THE Monthly_Services_View SHALL reload the services of the selected month.
6. WHEN the Edit_Service_Dialog closes without the result `'saved'`, THE Monthly_Services_View SHALL leave the displayed services unchanged and make no API call.

### Requirement 2: Reuse of the add dialog

**User Story:** As a developer, I want the edit flow to reuse the add dialog, so that both flows share one form and one behavior.

#### Acceptance Criteria

1. THE Edit_Service_Dialog SHALL be the existing `AddServiceDialogComponent`, receiving an optional service through `MAT_DIALOG_DATA`.
2. WHEN the dialog receives no service, THE Edit_Service_Dialog SHALL behave as specified in `add-service-hymns-modal`.
3. WHEN the dialog receives a service, THE Edit_Service_Dialog SHALL display the title "Edit Service".
4. WHEN the dialog receives no service, THE Edit_Service_Dialog SHALL display the title "Add Service".
5. WHEN the dialog receives a service, THE Edit_Service_Dialog SHALL call the update operation of the Services_API_Client on save, and WHEN the dialog receives no service, THE Edit_Service_Dialog SHALL call the create operation.

### Requirement 3: Pre-filled form

**User Story:** As a music planner, I want the dialog to open with the service's current values, so that I only change what needs changing.

#### Acceptance Criteria

1. WHEN the Edit_Service_Dialog opens for a service, THE Edit_Service_Dialog SHALL set the date field to the service's `serviceDate`.
2. WHEN the Edit_Service_Dialog opens for a service, THE Edit_Service_Dialog SHALL set the service type field to the service's `serviceType`.
3. WHEN the Edit_Service_Dialog opens for a service, THE Edit_Service_Dialog SHALL set each of the 14 slot inputs to the Song_Number of the service slot with the same Slot_Key.
4. IF a service has no song, or no slot record, for a Slot_Key, THEN THE Edit_Service_Dialog SHALL leave that slot input empty.
5. WHEN the Edit_Service_Dialog opens for a service, THE Edit_Service_Dialog SHALL fetch the Conflict_Window for the service's date and display conflict badges for the pre-filled slots.
6. THE Edit_Service_Dialog SHALL display the 14 slots grouped as orchestra, choir and congregation, as in the add flow.

### Requirement 4: Editing date and type

**User Story:** As a music planner, I want to change a service's date and type, so that I can reschedule a service or correct its type.

#### Acceptance Criteria

1. THE Edit_Service_Dialog SHALL allow the planner to change the date field to any date.
2. THE Edit_Service_Dialog SHALL allow the planner to change the service type field to any non-empty text.
3. WHEN the planner changes the date field, THE Edit_Service_Dialog SHALL fetch the Conflict_Window for the new date and recompute all conflict badges.
4. IF the date field is empty on save, THEN THE Edit_Service_Dialog SHALL display "Service date is required." and make no API call.
5. IF the service type field is empty on save, THEN THE Edit_Service_Dialog SHALL display "Service type is required." and make no API call.

### Requirement 5: Editing song slots

**User Story:** As a music planner, I want to change, add or clear songs in any slot, so that I can correct the plan.

#### Acceptance Criteria

1. WHEN the planner types in a slot input, THE Edit_Service_Dialog SHALL offer autocomplete suggestions whose Song_Number starts with the typed text (case-insensitive), as in the add flow.
2. IF a slot input contains text that is not an Empty_Slot_Value and is not a Song_Number in the repertoire, THEN THE Edit_Service_Dialog SHALL display "Unknown song number." on that slot and make no API call on save.
3. WHEN a slot input contains an Empty_Slot_Value, THE Edit_Service_Dialog SHALL treat the slot as having no song.
4. WHEN a slot input is cleared, THE Edit_Service_Dialog SHALL send that slot as having no song so that the Services_API removes the previous song from the slot.

### Requirement 6: Conflict badges while editing

**User Story:** As a music planner, I want conflict badges to reflect my edits without counting the service's saved version against itself, so that the warnings are accurate.

#### Acceptance Criteria

1. WHEN the planner changes a slot input or the date field, THE Edit_Service_Dialog SHALL recompute conflict badges using the Conflict_Severity thresholds of 56, 90 and 365 days.
2. THE Edit_Service_Dialog SHALL exclude the Edited_Service's saved version from the services used for conflict detection.
3. WHEN a slot's Song_Number has a non-empty translation in the repertoire, THE Edit_Service_Dialog SHALL use the translation as the canonical number for conflict detection, as in the add flow.
4. IF fetching the Conflict_Window fails, THEN THE Edit_Service_Dialog SHALL hide conflict badges and keep the form usable.

### Requirement 7: Save request

**User Story:** As a music planner, I want my changes saved to the server, so that other users and later sessions see them.

#### Acceptance Criteria

1. WHEN the planner saves a valid form in edit mode, THE Services_API_Client SHALL send `PUT /api/services/:id` with `serviceDate` (YYYY-MM-DD), `serviceType` and 14 slot entries, one per Slot_Key, each with `slotKey` and `songNumber` (null for no song).
2. THE Services_API_Client SHALL attach the Auth0 bearer token and the configured API base URL to the update request, as for the other service requests.
3. WHILE the update request is in flight, THE Edit_Service_Dialog SHALL disable the Save and Cancel buttons and the form fields and display a spinner in the Save button.
4. WHEN the update request succeeds, THE Edit_Service_Dialog SHALL close with the result `'saved'`.
5. IF the update request fails with status 409, THEN THE Edit_Service_Dialog SHALL stay open and display "A service with this date and type already exists."
6. IF the update request fails with status 400, THEN THE Edit_Service_Dialog SHALL stay open and display the `error` message from the response.
7. IF the update request fails with any other status, THEN THE Edit_Service_Dialog SHALL stay open and display "Failed to save service (<status>)."
8. WHEN the planner clicks Cancel, THE Edit_Service_Dialog SHALL close without calling the Services_API.

### Requirement 8: Update endpoint

**User Story:** As a developer, I want `PUT /api/services/:id` to update date, type and slots, so that the edit dialog can save a whole service in one request.

#### Acceptance Criteria

1. WHEN a PUT request contains `serviceDate`, THE Services_API SHALL validate that it matches YYYY-MM-DD and respond with status 400 and an `error` message otherwise.
2. WHEN a PUT request contains `serviceType`, THE Services_API SHALL respond with status 400 and an `error` message IF the value is empty or whitespace.
3. WHEN a PUT request is valid, THE Service_Repository SHALL update the service's `serviceDate` and `serviceType` to the supplied values and leave omitted fields unchanged.
4. WHEN a slot entry contains `songNumber`, THE Service_Repository SHALL resolve it to the song with that number and store that song's id, and WHEN `songNumber` is null, THE Service_Repository SHALL store no song for the slot.
5. WHEN a slot entry contains `songId`, THE Service_Repository SHALL store that id directly, so that drag-and-drop swaps continue to work.
6. IF a slot entry contains a `songNumber` that does not match any song, THEN THE Services_API SHALL respond with status 400 with an `error` message naming the number, and SHALL leave the service unchanged.
7. WHEN the PUT request omits a Slot_Key, THE Service_Repository SHALL leave that slot unchanged.
8. IF the new `serviceDate` and `serviceType` equal those of a Duplicate_Service, THEN THE Services_API SHALL respond with status 409 and an `error` message, and SHALL leave the service unchanged.
9. IF the service does not exist, THEN THE Services_API SHALL respond with status 404.
10. IF the service belongs to a different congregation than the caller, THEN THE Services_API SHALL respond with status 403.
11. WHEN a PUT request is successful, THE Services_API SHALL respond with status 200 and the updated service including its slots, slot templates and songs.
12. THE Services_API SHALL accept a PUT request that contains only `slots` with `songId` values and update those slots as before.
