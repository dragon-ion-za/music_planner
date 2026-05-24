# Implementation Plan: Monthly Services View

## Overview

Implement the Monthly Services View as a standalone Angular 17 component at `/monthly`. The feature fetches services from the REST API using Auth0 JWT authentication, displays them in a two-column alternating layout with conflict highlighting, and supports CDK drag-and-drop song swapping between services.

## Tasks

- [x] 1. Install dependencies and create environment configuration
  - Run `npm install @auth0/auth0-angular` in `music-planner-app/`
  - Run `npm install --save-dev fast-check` in `music-planner-app/`
  - Create `src/environments/environment.ts` with `auth0Domain`, `auth0ClientId`, and `auth0Audience` placeholder values
  - Create `src/environments/environment.prod.ts` with the same shape
  - _Requirements: 9.1_

- [x] 2. Define data models
  - Create `src/app/monthly-services-view/models/service.model.ts`
  - Define `Song`, `SlotTemplate`, `ServiceSlot`, `Service`, `SlotInput` interfaces matching the API response shape
  - Define view-model types: `SlotConflictStatus`, `ConflictMap`, `ServiceSlotViewModel`, `SlotGroup`, `ServiceViewModel`
  - Define `MonthState` interface for month navigation state
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

- [x] 3. Configure Auth0 and HttpClient in app.config.ts
  - Update `src/app/app.config.ts` to add `provideHttpClient(withInterceptorsFromDi())` and `provideAuth0(...)` using values from `environment.ts`
  - _Requirements: 9.1, 3.6_

- [x] 4. Implement ServicesApiService
  - Create `src/app/monthly-services-view/services/services-api.service.ts`
  - Inject `AuthService` from `@auth0/auth0-angular` and `HttpClient`
  - Implement `getServices(from: string, to: string): Observable<Service[]>` — calls `GET /api/services?from=&to=` with Bearer token
  - Implement `updateServiceSlots(serviceId: string, slots: SlotInput[]): Observable<Service>` — calls `PUT /api/services/:id` with Bearer token
  - Use `switchMap` on `getAccessTokenSilently()` to attach the `Authorization: Bearer <token>` header
  - _Requirements: 3.1, 3.6, 8.3, 9.1, 9.3_

  - [ ]* 4.1 Write property test for ServicesApiService — Bearer token attachment
    - **Property 4: Bearer token is attached to every API request**
    - **Validates: Requirements 3.6, 9.1**
    - Use `fc.string({ minLength: 10 })` as token; assert `Authorization` header equals `Bearer <token>` for both `getServices` and `updateServiceSlots`
    - Tag: `// Feature: monthly-services-view, Property 4: Bearer token is attached to every API request`

- [x] 5. Implement ConflictDetectionService
  - Create `src/app/monthly-services-view/services/conflict-detection.service.ts`
  - Implement `buildConflictMap(allServices: Service[]): ConflictMap`
  - Build flat list of occupied slot occurrences with `canonicalNumber = translationOf?.number ?? song.number`
  - For each occurrence, find all others with the same canonical number (excluding same slot, including same-service different-slot per Req 7.7)
  - Classify by `|diffDays|`: ≤56 → red, 57–90 → yellow, 91–365 → green, >365 → null
  - Apply worst-severity precedence (red > yellow > green > null); accumulate all conflicting dates for tooltip
  - Use `moment(a).diff(moment(b), 'days')` for day difference
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 5.1 Write property test for ConflictDetectionService — conflict classification
    - **Property 8: Conflict classification is correct for all day-difference ranges**
    - **Validates: Requirements 7.3, 7.4, 7.5**
    - Use `fc.integer({ min: 0, max: 400 })` as day diff; generate two slots with same canonical number at dates D and D+diffDays; assert severity matches threshold rules
    - Tag: `// Feature: monthly-services-view, Property 8: Conflict classification is correct for all day-difference ranges`

  - [ ]* 5.2 Write property test for ConflictDetectionService — canonical number resolution
    - **Property 9: Canonical number uses translationOf when present**
    - **Validates: Requirements 7.6**
    - Generate two slots with different `song.number` but same `translationOf.number`; assert conflict is detected
    - Tag: `// Feature: monthly-services-view, Property 9: Canonical number uses translationOf when present`

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement MonthNavigatorComponent
  - Create `src/app/monthly-services-view/components/month-navigator/month-navigator.component.ts` (standalone)
  - Input: `selectedMonth: moment.Moment`; Output: `monthChange: EventEmitter<moment.Moment>`
  - `prev()` emits `selectedMonth.clone().subtract(1, 'month')`; `next()` emits `selectedMonth.clone().add(1, 'month')`
  - Template: previous button, `{{ selectedMonth | date:'MMMM yyyy' }}` label, next button using `mat-icon-button`
  - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 7.1 Write property test for MonthNavigatorComponent — month navigation round trip
    - **Property 1: Month navigation is a round trip**
    - **Validates: Requirements 2.2, 2.3**
    - Use `fc.integer({ min: 0, max: 11 })` for month and `fc.integer({ min: 2000, max: 2099 })` for year; assert `next().prev()` returns original month
    - Tag: `// Feature: monthly-services-view, Property 1: Month navigation is a round trip`

- [x] 8. Implement SlotItemComponent
  - Create `src/app/monthly-services-view/components/slot-item/slot-item.component.ts` (standalone)
  - Inputs: `slot: ServiceSlotViewModel`, `conflict: SlotConflictStatus | null`
  - Display `slot.song.number`, `translationOf` number when present, `slotTemplate.category`, `slotTemplate.slotKey`
  - Apply CSS class `conflict-red`, `conflict-yellow`, or `conflict-green` based on `conflict.severity`
  - Show placeholder text when `slot.songId` is null
  - Add `matTooltip` listing conflicting dates and service types from `conflict.conflictingDates`
  - Mark element as `cdkDrag` with `[cdkDragData]="slot"`
  - _Requirements: 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 9. Implement ServiceCardComponent
  - Create `src/app/monthly-services-view/components/service-card/service-card.component.ts` (standalone)
  - Inputs: `service: ServiceViewModel`, `conflictMap: ConflictMap`, `allDropLists: CdkDropList[]`, `swapping: boolean`
  - Display `service.serviceDate` and `service.serviceType` in the card header
  - Render `service.slotGroups` — for each group show category label, then `<app-slot-item>` for each slot
  - Apply `cdkDropList` with `id="service-<service.id>"`, `[cdkDropListConnectedTo]="allDropLists"`, `cdkDropListSortingDisabled="true"`
  - Emit `dropped` output of type `CdkDragDrop<ServiceSlotViewModel[]>` from the `(cdkDropListDropped)` event
  - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 8.6_

- [x] 10. Implement SlotSwapService
  - Create `src/app/monthly-services-view/services/slot-swap.service.ts`
  - Implement `swap(sourceSlot, targetSlot, sourceService, targetService): Observable<[Service, Service]>`
  - Build updated `SlotInput[]` for each service by replacing the swapped slot's `songId`
  - Call `servicesApiService.updateServiceSlots(...)` for both services using `forkJoin`
  - Return the pair of updated services on success
  - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [ ]* 10.1 Write property test for SlotSwapService — swap exchanges songIds
    - **Property 10: Drag-drop swap exchanges songIds**
    - **Validates: Requirements 8.2**
    - Generate two slot arbitraries with different `serviceId`; after swap, assert slot A has B's original `songId` and vice versa
    - Tag: `// Feature: monthly-services-view, Property 10: Drag-drop swap exchanges songIds`

- [x] 11. Implement MonthlyServicesViewComponent (root page)
  - Create `src/app/monthly-services-view/monthly-services-view.component.ts` (standalone)
  - On `ngOnInit`: initialize `selectedMonth` to current month; compute `MonthState`; check auth; fetch services
  - Implement `loadServices(month: moment.Moment)`:
    - Compute display range (`from`/`to` = first/last day of month) and conflict window (`conflictFrom`/`conflictTo` = ±12 months)
    - Call `servicesApiService.getServices(displayFrom, displayTo)` and `getServices(conflictFrom, conflictTo)` in parallel via `forkJoin`
    - On success: build `ServiceViewModel[]` (map slots to view models, group by category sorted by `displayOrder`), call `conflictDetectionService.buildConflictMap(allServices)`, set `loading = false`
    - On 401: set `authError = true`; on other errors: set `error` message; clear services
  - Implement `onMonthChange(month)`: update `selectedMonth`, call `loadServices`
  - Implement `onDrop(event: CdkDragDrop<...>)`: ignore same-container drops; optimistically swap `songId`s; set `swapping = true`; call `slotSwapService.swap(...)`; on success update view models and recompute conflict map; on error revert swap and show snackbar; set `swapping = false`
  - Collect all `CdkDropList` references via `@ViewChildren(CdkDropList)` and pass to each `ServiceCardComponent`
  - Pair services into rows for the two-column grid: `servicePairs = chunk(displayServices, 2)`
  - _Requirements: 1.1, 1.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3_

  - [ ]* 11.1 Write property test for MonthlyServicesViewComponent — API date range matches selected month
    - **Property 2: API date range matches selected month**
    - **Validates: Requirements 2.4**
    - Use `fc.date(...)` mapped to month start; assert `from` = first day of M, `to` = last day of M in `YYYY-MM-DD`
    - Tag: `// Feature: monthly-services-view, Property 2: API date range matches selected month`

  - [ ]* 11.2 Write property test for MonthlyServicesViewComponent — conflict window spans ±12 months
    - **Property 3: Conflict window spans ±12 months**
    - **Validates: Requirements 7.1**
    - Use `fc.date(...)` mapped to a month; assert `conflictFrom` = month−12mo first day, `conflictTo` = month+12mo last day
    - Tag: `// Feature: monthly-services-view, Property 3: Conflict window spans ±12 months`

  - [ ]* 11.3 Write property test for MonthlyServicesViewComponent — non-200 responses produce no rendered services
    - **Property 5: Non-200 responses produce no rendered services**
    - **Validates: Requirements 3.4**
    - Use `fc.integer({ min: 400, max: 599 })` as status; assert zero service cards rendered and error message is non-empty
    - Tag: `// Feature: monthly-services-view, Property 5: Non-200 responses produce no rendered services`

  - [ ]* 11.4 Write property test for MonthlyServicesViewComponent — alternating column assignment
    - **Property 6: Services are assigned to columns in alternating order**
    - **Validates: Requirements 4.2, 4.4**
    - Use `fc.array(serviceArbitrary, { minLength: 1, maxLength: 20 })`; assert service at index i is in column `(i % 2) + 1`
    - Tag: `// Feature: monthly-services-view, Property 6: Services are assigned to columns in alternating order`

  - [ ]* 11.5 Write property test for ServiceCardComponent — slots ordered by displayOrder
    - **Property 7: Slots within a service card are ordered by displayOrder**
    - **Validates: Requirements 5.3**
    - Use `fc.array(slotArbitrary)` with shuffled `displayOrder`; assert rendered order matches ascending `displayOrder`
    - Tag: `// Feature: monthly-services-view, Property 7: Slots within a service card are ordered by displayOrder`

  - [ ]* 11.6 Write property test for drop predicate — same-service drops are rejected
    - **Property 11: Same-service drops are rejected**
    - **Validates: Requirements 8.6**
    - Generate slot arbitrary with same `serviceId` for source and target; assert CDK drop predicate returns `false`
    - Tag: `// Feature: monthly-services-view, Property 11: Same-service drops are rejected`

- [x] 12. Create MonthlyServicesViewComponent template and styles
  - Write `monthly-services-view.component.html`: month navigator, `mat-spinner` while loading, auth error prompt, error banner, empty-state message, two-column service grid using `*ngFor` over `servicePairs`
  - Write `monthly-services-view.component.css`: two-column grid layout, `.conflict-red` / `.conflict-yellow` / `.conflict-green` slot highlight styles, drag preview elevation, drop target hover highlight
  - _Requirements: 3.3, 3.5, 4.1, 4.3, 9.2_

- [x] 13. Register the `/monthly` route and wire up navigation
  - Add `{ path: 'monthly', component: MonthlyServicesViewComponent }` to `src/app/app.routes.ts`
  - Add a navigation link to `/monthly` in `app.component.html` alongside any existing navigation
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` with `numRuns: 100`; each test file is tagged with the feature and property number
- Unit tests use Karma + Jasmine (`.spec.ts` files co-located with each source file)
- The conflict detection algorithm mirrors `schedule.component.ts` `calculateConflicts` — same thresholds (≤56/57–90/91–365 days), same canonical number resolution via `translationOf`
- `@auth0/auth0-angular` and `fast-check` must be installed before starting implementation (Task 1)
- All components are standalone — import Angular Material, CDK, and other dependencies directly in each component's `imports` array
