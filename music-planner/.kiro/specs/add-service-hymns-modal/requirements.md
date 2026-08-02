# Requirements Document

## Introduction

This document defines the requirements for the Add Service Hymns Modal — a popup dialog in the Angular 17 music planner application that allows a music planner to create a new worship service and assign hymns/songs to all of its slots in a single interaction. The modal is opened from the Monthly Services View, supports selecting any service date (not restricted to the currently viewed month), groups song slots by category (orchestra, choir, congregation), and provides real-time conflict feedback as song numbers are entered, using the same conflict detection logic already present in the application.

## Glossary

- **Modal**: The Angular Material dialog (`MatDialog`) that overlays the Monthly Services View and contains the service creation form.
- **Add_Service_Form**: The template-driven form inside the Modal that captures the service date, service type, and all song slot assignments.
- **Service_Date**: The calendar date of the new worship service, selected via an Angular Material datepicker backed by `MomentDateAdapter`.
- **Service_Type**: A free-text string identifying the type of service (e.g. "Sunday Service", "Midweek Service").
- **Slot_Category**: One of three groupings of song slots: `orchestra` (5 slots), `choir` (4 slots), `congregation` (5 slots).
- **Song_Slot**: A single assignable position within a service, identified by a `slotKey` and belonging to a `Slot_Category`.
- **Song_Number**: The hymn/song identifier entered by the planner for a given Song_Slot (e.g. "A10", "E7", "BB5"). Must exist in the Repertoire.
- **Repertoire**: The client-side song catalogue loaded from `src/assets/repertoire.json`, containing all valid song numbers and their translations. Used for autocomplete suggestions and validation.
- **Hymnal**: The hymnal prefix of a Song_Number (e.g. "A", "E", "BB"), derived from the leading non-numeric characters of the Song_Number.
- **Conflict_Window**: The date range `[Service_Date − 365 days, Service_Date + 365 days]` used to fetch services for conflict computation.
- **Conflict**: A song used in two services whose dates are 56 days apart or fewer (displayed in red).
- **Quarter_Conflict**: A song used in two services whose dates are between 57 and 90 days apart (displayed in yellow).
- **Year_Conflict**: A song used in two services whose dates are between 91 and 365 days apart (displayed in green).
- **Conflict_Indicator**: The per-slot visual element (color badge or icon) that reflects the current conflict severity for the entered song number.
- **ConflictDetectionService**: The existing Angular service at `monthly-services-view/services/conflict-detection.service.ts` whose `buildConflictMap` method computes conflict status from a list of services.
- **ServicesApiService**: The existing Angular service at `monthly-services-view/services/services-api.service.ts` that handles HTTP calls to the REST API.
- **API**: The REST API exposing `POST /api/services` and `GET /api/services` endpoints.
- **Auth0_Service**: The `@auth0/auth0-angular` `AuthService` that provides the current user's access token.

---

## Requirements

### Requirement 1: Open the Modal from the Monthly Services View

**User Story:** As a music planner, I want a button in the Monthly Services View that opens the Add Service Hymns Modal, so that I can create a new service without leaving the monthly view.

#### Acceptance Criteria

1. THE Monthly_Services_View SHALL display an "Add Service" button that is always visible when the view is loaded.
2. WHEN the user activates the "Add Service" button, THE Monthly_Services_View SHALL open the Modal as an Angular Material dialog overlaying the current view.
3. WHEN the Modal is open, THE Monthly_Services_View SHALL remain visible in the background but SHALL NOT be interactive.

---

### Requirement 2: Service Date Selection

**User Story:** As a music planner, I want to select the date of the new service using a date picker, so that I can schedule services on any date regardless of the month currently displayed.

#### Acceptance Criteria

1. THE Add_Service_Form SHALL include a date input field backed by an Angular Material datepicker using `MomentDateAdapter`.
2. THE Add_Service_Form SHALL accept any valid calendar date as the Service_Date — it SHALL NOT restrict selection to the currently viewed month.
3. WHEN the user selects a date, THE Add_Service_Form SHALL store the Service_Date as a `moment.Moment` value and display it in `YYYY-MM-DD` format.
4. WHEN the Service_Date field is empty and the user attempts to submit, THE Add_Service_Form SHALL display a validation error message and SHALL NOT submit the form.
5. WHEN the Service_Date changes, THE Modal SHALL re-fetch services for the updated Conflict_Window and recompute conflict status for all currently entered song numbers.

---

### Requirement 3: Service Type Input

**User Story:** As a music planner, I want to enter the service type for the new service, so that the service is correctly categorized in the schedule.

#### Acceptance Criteria

1. THE Add_Service_Form SHALL include a text input field for the Service_Type.
2. WHEN the Service_Type field is empty and the user attempts to submit, THE Add_Service_Form SHALL display a validation error message and SHALL NOT submit the form.
3. THE Add_Service_Form SHALL accept any non-empty string as a valid Service_Type value.

---

### Requirement 4: Song Slot Entry Grouped by Category

**User Story:** As a music planner, I want to enter songs for all slot categories (orchestra, choir, congregation) in a single form, so that I can capture the complete programme for a service in one interaction.

#### Acceptance Criteria

1. THE Add_Service_Form SHALL display all 14 song slots grouped into three sections: `orchestra` (5 slots), `choir` (4 slots), and `congregation` (5 slots).
2. THE Add_Service_Form SHALL render slots within each category section in ascending `displayOrder` order as defined by the slot templates.
3. THE Add_Service_Form SHALL display the `slotKey` label for each slot so the planner can identify the slot position.
4. EACH Song_Slot SHALL include a single Song_Number input field; the Hymnal is derived automatically from the Song_Number prefix and does not require a separate input.
5. THE Add_Service_Form SHALL allow all song slot fields to remain empty — no slot assignment is required for form submission.
6. WHEN a Song_Number is entered for a slot, THE Add_Service_Form SHALL immediately trigger conflict detection for that slot without requiring any additional user action.
7. THE Add_Service_Form SHALL load the Repertoire from `src/assets/repertoire.json` on initialisation and use it to provide autocomplete suggestions as the planner types a Song_Number.
8. WHEN the planner types in a Song_Number field, THE Add_Service_Form SHALL display matching Repertoire entries as autocomplete options, showing the song number and its translation (if any).
9. WHEN a Song_Number field loses focus or the form is submitted, THE Add_Service_Form SHALL validate that the entered value exists in the Repertoire; IF the value does not exist, THE Add_Service_Form SHALL display a validation error on that slot and SHALL NOT count that slot as a valid song assignment.
10. WHEN a Song_Number is valid (exists in the Repertoire), THE Add_Service_Form SHALL resolve the canonical number for conflict detection using the Repertoire's `translation` field: IF the entry has a non-empty `translation`, the canonical number is the `translation` value; OTHERWISE the canonical number is the Song_Number itself.

---

### Requirement 5: Real-Time Conflict Detection

**User Story:** As a music planner, I want to see conflict indicators update in real time as I enter song numbers, so that I can identify scheduling problems before saving the service.

#### Acceptance Criteria

1. WHEN the Modal opens, THE Modal SHALL fetch services for the Conflict_Window `[Service_Date − 365 days, Service_Date + 365 days]` using `ServicesApiService.getServices` with a Bearer token from Auth0_Service.
2. WHEN a Song_Number is entered or changed in any slot, THE Modal SHALL recompute the conflict status for that slot using `ConflictDetectionService.buildConflictMap` applied to the fetched services combined with the songs currently entered in the form.
3. WHEN a slot's conflict status is `red`, THE Modal SHALL display a red Conflict_Indicator on that slot.
4. WHEN a slot's conflict status is `yellow`, THE Modal SHALL display a yellow Conflict_Indicator on that slot.
5. WHEN a slot's conflict status is `green`, THE Modal SHALL display a green Conflict_Indicator on that slot.
6. WHEN a slot has no conflict (status is `null` or the Song_Number field is empty), THE Modal SHALL display no Conflict_Indicator on that slot.
7. WHEN a Conflict_Indicator is visible, THE Modal SHALL display a tooltip on hover listing the conflicting service dates and service types.
8. THE Modal SHALL use the Repertoire for canonical number resolution during conflict detection: WHEN a Song_Number has a non-empty `translation` in the Repertoire, THE Modal SHALL use that `translation` value as the canonical identifier for conflict matching; OTHERWISE the Song_Number itself is the canonical identifier. This mirrors the `translationOf` resolution used by the existing conflict detection logic.
9. WHEN the Service_Date changes, THE Modal SHALL re-fetch services for the new Conflict_Window and recompute conflict status for all currently entered song numbers.

---

### Requirement 6: Submit — Create the Service

**User Story:** As a music planner, I want to save the new service and its hymns by clicking a submit button, so that the service is persisted to the database and immediately visible in the monthly view.

#### Acceptance Criteria

1. THE Add_Service_Form SHALL include a "Save" button that submits the form.
2. WHEN the user activates the "Save" button and the form is valid, THE Modal SHALL call `POST /api/services` via `ServicesApiService` with a JSON body containing `serviceDate` (in `YYYY-MM-DD` format), `serviceType`, and a `slots` array of all 14 slot entries.
3. THE `slots` array in the POST body SHALL contain one entry per Song_Slot with `slotKey` and `songNumber` fields; slots with no song entered SHALL have `songNumber` set to `null`. The API is responsible for resolving `songNumber` to the corresponding database record server-side.
4. WHEN `POST /api/services` returns `201 Created`, THE Modal SHALL close and THE Monthly_Services_View SHALL reload services for the currently displayed month.
5. IF `POST /api/services` returns `409 Conflict`, THEN THE Modal SHALL remain open and display an error message indicating that a service with the same date and type already exists.
6. IF `POST /api/services` returns any other non-2xx response, THEN THE Modal SHALL remain open and display a descriptive error message.
7. WHILE the POST request is in flight, THE Modal SHALL disable the "Save" button and all form fields to prevent concurrent submissions.
8. WHILE the POST request is in flight, THE Modal SHALL display a loading indicator.

---

### Requirement 7: Cancel and Close

**User Story:** As a music planner, I want to cancel the modal without saving, so that I can dismiss it if I change my mind without creating an unintended service.

#### Acceptance Criteria

1. THE Modal SHALL include a "Cancel" button that closes the Modal without making any API call.
2. WHEN the user activates the "Cancel" button, THE Modal SHALL close and THE Monthly_Services_View SHALL NOT reload or modify its current state.
3. WHEN the user presses the Escape key while the Modal is open, THE Modal SHALL close without making any API call.
4. WHEN the Modal is closed via Cancel or Escape, THE Add_Service_Form SHALL discard all entered data.

---

### Requirement 8: Authentication

**User Story:** As a music planner, I want the modal to use my existing Auth0 session for all API calls, so that I do not need to re-authenticate to create a service.

#### Acceptance Criteria

1. THE Modal SHALL use Auth0_Service to obtain a valid access token before making any call to `GET /api/services` or `POST /api/services`.
2. THE ServicesApiService SHALL attach the access token as a `Bearer` token in the `Authorization` header of every request made from the Modal.
3. IF Auth0_Service fails to provide a token, THEN THE Modal SHALL display an authentication error message and SHALL NOT attempt the API call.

