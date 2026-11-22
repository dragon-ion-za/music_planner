# Requirements Document

## Introduction

The Monthly_View currently splits the month's services, in date order, into consecutive pairs and renders each pair as a two-cell grid row. Services therefore alternate left and right by position, and a Sunday service can land in either column. This feature keeps the row-based, alternating layout but always places Sunday services in the right column and non-Sunday services in the left column. On narrow screens the grid collapses to a single column in chronological order.

## Glossary

- **Monthly_View**: The `MonthlyServicesViewComponent` that shows the selected month's services as service cards in a grid.
- **Service_Card**: The `app-service-card` element that displays one service.
- **Row_Layout_Builder**: The pure function that converts a chronologically ordered list of services into grid rows.
- **Grid_Row**: One row of the Monthly_View grid, with a Left_Cell and a Right_Cell.
- **Left_Cell**: The first cell of a Grid_Row.
- **Right_Cell**: The second cell of a Grid_Row.
- **Empty_Cell**: A cell that contains no Service_Card.
- **Sunday_Service**: A service whose `serviceDate` (format `YYYY-MM-DD`), parsed with Moment.js, falls on a Sunday. The `serviceType` value is not considered.
- **Non_Sunday_Service**: A service that is not a Sunday_Service.
- **Narrow_Viewport**: A viewport narrower than 800 CSS pixels.

## Requirements

### Requirement 1: Classify services by weekday

**User Story:** As a planner, I want Sunday services identified by their date, so that placement does not depend on the free-text service type.

#### Acceptance Criteria

1. WHEN a service has a `serviceDate` that falls on a Sunday, THE Row_Layout_Builder SHALL classify the service as a Sunday_Service.
2. WHEN a service has a `serviceDate` that does not fall on a Sunday, THE Row_Layout_Builder SHALL classify the service as a Non_Sunday_Service regardless of the `serviceType` value.

### Requirement 2: Place Sunday services in the right column

**User Story:** As a planner, I want Sunday services always in the right column, so that I can find them at a glance.

#### Acceptance Criteria

1. THE Row_Layout_Builder SHALL place every Sunday_Service in the Right_Cell of a Grid_Row.
2. THE Row_Layout_Builder SHALL place every Non_Sunday_Service in the Left_Cell of a Grid_Row.
3. THE Row_Layout_Builder SHALL place each service from the input list in exactly one cell.

### Requirement 3: Pair non-Sunday services with the following Sunday

**User Story:** As a planner, I want each Sunday shown next to the service that precedes it, so that the alternating layout is preserved.

#### Acceptance Criteria

1. WHEN a Sunday_Service is preceded by at least one Non_Sunday_Service since the previous Sunday_Service, THE Row_Layout_Builder SHALL place the latest of those Non_Sunday_Services in the Left_Cell of the same Grid_Row as the Sunday_Service.
2. WHEN more than one Non_Sunday_Service occurs between two Sunday_Services, THE Row_Layout_Builder SHALL place each earlier Non_Sunday_Service in the Left_Cell of its own Grid_Row with an Empty_Cell in the Right_Cell.
3. WHEN a Sunday_Service has no preceding Non_Sunday_Service since the previous Sunday_Service, THE Row_Layout_Builder SHALL place an Empty_Cell in the Left_Cell of the Grid_Row that contains the Sunday_Service.
4. WHEN Non_Sunday_Services follow the last Sunday_Service of the month, THE Row_Layout_Builder SHALL place each of them in the Left_Cell of its own Grid_Row with an Empty_Cell in the Right_Cell.

### Requirement 4: Preserve chronological order

**User Story:** As a planner, I want rows to remain in date order, so that the month reads from top to bottom.

#### Acceptance Criteria

1. THE Row_Layout_Builder SHALL order Grid_Rows so that reading the cells row by row, Left_Cell then Right_Cell, yields the services in the same order as the input list.
2. WHEN the input list is empty, THE Row_Layout_Builder SHALL return zero Grid_Rows.

### Requirement 5: Apply the layout in the Monthly_View

**User Story:** As a planner, I want the new layout everywhere the month is displayed, so that it stays consistent after edits.

#### Acceptance Criteria

1. WHEN the Monthly_View finishes loading the services of a month, THE Monthly_View SHALL render the Grid_Rows produced by the Row_Layout_Builder.
2. WHEN a slot swap completes successfully, THE Monthly_View SHALL rebuild the Grid_Rows with the Row_Layout_Builder.
3. WHEN a Grid_Row contains an Empty_Cell, THE Monthly_View SHALL render a placeholder element that keeps the other cell in its column.
4. IF loading the services fails, THEN THE Monthly_View SHALL display zero Grid_Rows.

### Requirement 6: Stack the grid on narrow screens

**User Story:** As a planner on a small screen, I want a single column, so that service cards stay readable.

#### Acceptance Criteria

1. WHILE the viewport is a Narrow_Viewport, THE Monthly_View SHALL render the Grid_Rows as a single column.
2. WHILE the viewport is a Narrow_Viewport, THE Monthly_View SHALL display the Service_Cards in chronological order.
3. WHILE the viewport is a Narrow_Viewport, THE Monthly_View SHALL hide Empty_Cells.
4. WHILE the viewport is not a Narrow_Viewport, THE Monthly_View SHALL render each Grid_Row as two equal-width columns.
