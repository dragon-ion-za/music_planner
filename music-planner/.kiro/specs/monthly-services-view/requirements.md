# Requirements Document

## Introduction

This document defines the requirements for the Monthly Services View — a new page in the Angular 17 music planner application that displays worship services grouped by month. The page fetches service data from the existing REST API using Auth0 JWT authentication, presents services in a two-column alternating layout with songs grouped by slot category (orchestra, choir, congregation), detects and highlights song conflicts, and supports drag-and-drop swapping of songs between services.

## Glossary

- **Monthly_Services_View**: The new Angular page component that displays services for a selected month.
- **Service**: A scheduled worship event with a date, service type, and a set of song slots, as returned by `GET /api/services`.
- **ServiceSlot**: A single song assignment within a service, containing a slot template (slotKey, category, displayOrder) and an optional song.
- **SlotTemplate**: Metadata for a service slot — includes `slotKey`, `category` (orchestra, choir, congregation), and `displayOrder`.
- **Song**: A hymn assigned to a slot, identified by `number` and `hymnal`; may have a `translationOf` reference pointing to the canonical song number.
- **Conflict**: A song used in two services within 56 days of each other (displayed in red).
- **Quarter_Conflict**: A song used in two services between 57 and 90 days apart (displayed in yellow).
- **Year_Conflict**: A song used in two services between 91 and 365 days apart (displayed in green).
- **Slot_Category**: The grouping of song slots — one of `orchestra`, `choir`, or `congregation`.
- **Month_Navigator**: The UI control that allows the user to page forward and backward between months.
- **API_Client**: The Angular service responsible for calling `GET /api/services` with a Bearer JWT.
- **Auth0_Service**: The Angular Auth0 SDK service that provides the current user's access token.
- **Drag_Source**: A song slot that the user begins dragging.
- **Drop_Target**: A song slot on a different service that receives the dragged song.

---

## Requirements

### Requirement 1: Page Navigation and Routing

**User Story:** As a music planner, I want a dedicated monthly services page accessible via the app's navigation, so that I can view the schedule without leaving the existing schedule tool.

#### Acceptance Criteria

1. THE Monthly_Services_View SHALL be accessible at the route `/monthly`.
2. WHEN the user navigates to `/monthly`, THE Monthly_Services_View SHALL display the current calendar month by default.
3. THE Monthly_Services_View SHALL be implemented as a standalone Angular component following the existing `schedule/` component pattern.

---

### Requirement 2: Month Navigation

**User Story:** As a music planner, I want to page forward and backward between months, so that I can review past and upcoming services.

#### Acceptance Criteria

1. THE Month_Navigator SHALL display the currently selected month and year in `MMMM YYYY` format (e.g. "July 2025").
2. WHEN the user activates the "previous month" control, THE Month_Navigator SHALL decrement the selected month by one calendar month and reload the services for that month.
3. WHEN the user activates the "next month" control, THE Month_Navigator SHALL increment the selected month by one calendar month and reload the services for that month.
4. WHEN the selected month changes, THE Monthly_Services_View SHALL call `GET /api/services` with `from` set to the first day of the selected month and `to` set to the last day of the selected month, both in `YYYY-MM-DD` format.

---

### Requirement 3: Fetching Services from the API

**User Story:** As a music planner, I want the page to load services from the REST API, so that I always see the latest data without manually uploading a file.

#### Acceptance Criteria

1. WHEN the Monthly_Services_View initialises or the selected month changes, THE API_Client SHALL call `GET /api/services?from=YYYY-MM-DD&to=YYYY-MM-DD` with a `Bearer` token obtained from Auth0_Service.
2. WHEN the API returns a `200 OK` response, THE Monthly_Services_View SHALL render the returned services.
3. IF the API returns a `401 Unauthorized` response, THEN THE Monthly_Services_View SHALL display a message indicating the user is not authenticated.
4. IF the API returns any non-200 response, THEN THE Monthly_Services_View SHALL display a descriptive error message and SHALL NOT render partial data.
5. WHILE a request is in flight, THE Monthly_Services_View SHALL display a loading indicator.
6. THE API_Client SHALL attach the Auth0 access token as a `Bearer` token in the `Authorization` header of every request to `GET /api/services`.

---

### Requirement 4: Two-Column Service Layout

**User Story:** As a music planner, I want services displayed in two alternating columns, so that I can compare adjacent services side by side.

#### Acceptance Criteria

1. THE Monthly_Services_View SHALL display services in a two-column grid layout.
2. THE Monthly_Services_View SHALL assign services to columns in alternating order by their `serviceDate` ascending — the first service in column 1, the second in column 2, the third in column 1, and so on.
3. WHEN the month contains no services, THE Monthly_Services_View SHALL display a message indicating no services are scheduled for that month.
4. WHEN the month contains an odd number of services, the last service SHALL occupy column 1 with column 2 empty for that row.

---

### Requirement 5: Service Card Display

**User Story:** As a music planner, I want each service card to show the date, service type, and all song slots, so that I can review the full programme at a glance.

#### Acceptance Criteria

1. THE Monthly_Services_View SHALL display the `serviceDate` for each service in `YYYY-MM-DD` format.
2. THE Monthly_Services_View SHALL display the `serviceType` for each service.
3. THE Monthly_Services_View SHALL display all `ServiceSlot` entries for each service, ordered by `slotTemplate.displayOrder` ascending.
4. THE Monthly_Services_View SHALL group song slots within each service card into rows by `slotTemplate.category` — displaying all `orchestra` slots together, then all `choir` slots, then all `congregation` slots.
5. WHEN a `ServiceSlot` has no assigned song (`songId` is null), THE Monthly_Services_View SHALL display a placeholder indicating the slot is empty.

---

### Requirement 6: Song Slot Display

**User Story:** As a music planner, I want each song slot to show the song number, translation, category, and conflict status, so that I can quickly assess the programme quality.

#### Acceptance Criteria

1. THE Monthly_Services_View SHALL display the song `number` for each occupied slot.
2. WHEN the slot's song has a `translationOf` reference, THE Monthly_Services_View SHALL display the translated song number alongside the original number.
3. THE Monthly_Services_View SHALL display the `slotTemplate.category` label for each slot (e.g. "orchestra", "choir", "congregation").
4. THE Monthly_Services_View SHALL display the `slotTemplate.slotKey` to identify the specific slot position within its category.
5. WHEN a song has one or more Conflict entries (within 56 days), THE Monthly_Services_View SHALL apply a red visual indicator to that slot.
6. WHEN a song has Quarter_Conflict entries (57–90 days) but no Conflict entries, THE Monthly_Services_View SHALL apply a yellow visual indicator to that slot.
7. WHEN a song has Year_Conflict entries (91–365 days) but no Conflict or Quarter_Conflict entries, THE Monthly_Services_View SHALL apply a green visual indicator to that slot.
8. WHEN a slot has conflict indicators, THE Monthly_Services_View SHALL display a tooltip listing the conflicting service dates and service types on hover.

---

### Requirement 7: Conflict Detection

**User Story:** As a music planner, I want conflicts calculated automatically from the loaded data, so that I can identify scheduling problems without manual checking.

#### Acceptance Criteria

1. WHEN services are loaded for a selected month, THE Monthly_Services_View SHALL also fetch services for the ±365-day window (i.e. `from` = first day of selected month minus 12 months, `to` = last day of selected month plus 12 months) in order to compute accurate conflict status across the full window.
2. THE Monthly_Services_View SHALL compute conflict status for every occupied song slot in the current month's services using the full ±365-day window of loaded services, but SHALL only display the current month's services in the view.
3. THE Monthly_Services_View SHALL classify two slots as a Conflict WHEN the same song (matched by translated number) appears in two services whose `serviceDate` values are 56 days apart or fewer.
4. THE Monthly_Services_View SHALL classify two slots as a Quarter_Conflict WHEN the same song appears in two services whose `serviceDate` values are between 57 and 90 days apart (inclusive).
5. THE Monthly_Services_View SHALL classify two slots as a Year_Conflict WHEN the same song appears in two services whose `serviceDate` values are between 91 and 365 days apart (inclusive).
6. THE Monthly_Services_View SHALL match songs by translated number — WHEN a song has a `translationOf` reference, THE Monthly_Services_View SHALL use the `translationOf.number` as the canonical identifier for conflict matching.
7. WHEN two slots in the same service on the same date share the same song number but belong to different slot categories, THE Monthly_Services_View SHALL still detect and report that as a conflict.

---

### Requirement 8: Drag and Drop Song Swapping

**User Story:** As a music planner, I want to drag a song slot from one service and drop it onto a slot in another service, so that I can quickly rearrange songs between services.

#### Acceptance Criteria

1. THE Monthly_Services_View SHALL allow the user to drag any occupied song slot (Drag_Source) and drop it onto any song slot in a different service (Drop_Target), regardless of slot category — cross-category swaps (e.g. orchestra slot to choir slot) are permitted.
2. WHEN a drag-and-drop operation completes successfully, THE Monthly_Services_View SHALL swap the `songId` values of the Drag_Source slot and the Drop_Target slot.
3. WHEN a swap is performed, THE Monthly_Services_View SHALL call `PUT /api/services/:id` for both affected services with the updated slot assignments.
4. WHEN both `PUT` calls succeed, THE Monthly_Services_View SHALL re-render the affected service cards with the updated song assignments and recalculate conflict status.
5. IF either `PUT` call fails, THEN THE Monthly_Services_View SHALL revert the visual swap and display an error message to the user.
6. THE Monthly_Services_View SHALL NOT allow dropping a slot onto a slot within the same service.
7. WHILE a swap API call is in flight, THE Monthly_Services_View SHALL disable further drag-and-drop interactions to prevent concurrent modifications.

---

### Requirement 9: Authentication Integration

**User Story:** As a music planner, I want the page to use my existing Auth0 login session, so that I do not need to authenticate separately to view the monthly schedule.

#### Acceptance Criteria

1. THE Monthly_Services_View SHALL use the Auth0_Service to obtain a valid access token before making any API call.
2. WHEN the user is not authenticated, THE Monthly_Services_View SHALL display a prompt to log in rather than attempting to call the API.
3. WHEN the access token expires during a session, THE Monthly_Services_View SHALL obtain a refreshed token before retrying the failed request.
