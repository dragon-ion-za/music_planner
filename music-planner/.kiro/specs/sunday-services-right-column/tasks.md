# Implementation Plan: Sunday Services Right Column

## Overview

Add a pure `buildServiceRows` function that places Sunday services (by date weekday) in the right column, use it in `MonthlyServicesViewComponent` in place of `chunkPairs`, and add a narrow-screen CSS rule. All paths are under `music-planner-app/src/app/monthly-services-view/`.

## Tasks

- [x] 1. Implement the row layout builder
  - [x] 1.1 Create `services/service-rows.util.ts`
    - Export `ServiceRow<T>`, `isSundayService` (Moment, `YYYY-MM-DD`, `day() === 0`) and `buildServiceRows`
    - Follow the algorithm in the design: a Sunday takes the latest pending non-Sunday on its left; earlier non-Sundays and trailing ones get their own rows with an empty right cell
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

  - [x]* 1.2 Write property test for placement by weekday
    - **Property 1: Placement by weekday**
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2**

  - [x]* 1.3 Write property test for order and completeness
    - **Property 2: Order and completeness**
    - **Validates: Requirements 2.3, 4.1**

  - [x]* 1.4 Write property test for pairing with the preceding service
    - **Property 3: Pairing with the preceding service**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x]* 1.5 Write unit tests for `buildServiceRows`
    - Cover empty input, the Wed/Sun/Wed/Fri/Sun/Sat example, a month starting on Sunday, and `serviceType` 'Sunday Service' on a weekday
    - Put all of 1.2 to 1.5 in `services/service-rows.util.spec.ts` with fast-check, at least 100 runs per property
    - _Requirements: 1.2, 3.2, 3.3, 3.4, 4.2_

- [x] 2. Wire the builder into the component and add responsive CSS
  - [x] 2.1 Update `monthly-services-view.component.ts`
    - Import `buildServiceRows`, remove `chunkPairs`, and use the builder in the load success handler and the swap success handler
    - Keep the error handler setting `servicePairs = []`
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 2.2 Update `monthly-services-view.component.css`
    - Add `@media (max-width: 799px)` with `.grid-row { grid-template-columns: 1fr; }` and `.grid-cell-empty { display: none; }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x]* 2.3 Write component tests in `monthly-services-view.component.spec.ts`
    - After load, `servicePairs` has Sundays on the right and a placeholder renders for null cells
    - After a successful swap, `servicePairs` is rebuilt
    - On load error, `servicePairs` is empty
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 3. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests validate universal correctness properties; unit and component tests cover examples and wiring
- The template needs no change because the existing `grid-cell-empty` placeholder already renders for null cells

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["1.3", "2.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["1.5"] }
  ]
}
```
