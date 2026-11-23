# Requirements Document

## Introduction

The Service Dialog (`AddServiceDialogComponent`) is shared by the add and edit flows. Today each song slot shows a small colored dot (the conflict badge) beside its input, and song numbers must match the repertoire with exact letter case. This feature replaces the badge with a highlight on the song field itself, colors conflict-free songs light blue, and makes song entry case-insensitive so that, for example, `a10` is accepted and saved as `A10`.

Decisions confirmed with the user:

- The highlight applies in both add mode and edit mode.
- The tooltip listing conflicting dates stays, attached to the highlighted field.
- The highlight fills the field background with a tint, matching the tinted style of the service card.

## Glossary

- **Service_Dialog**: The `AddServiceDialogComponent` modal used to add a service and to edit an existing service.
- **Song_Field**: The `mat-form-field` containing the song number input of one slot in the Service_Dialog.
- **Slot**: One of the 14 song positions of a service, identified by a slot key such as `orchestra1`.
- **Repertoire**: The list of songs in `src/assets/repertoire.json`, each identified by a canonical song number such as `A10`.
- **Canonical_Number**: The song number exactly as written in the Repertoire (for example `A10`).
- **Song_Resolver**: The logic that maps typed text to a Canonical_Number, ignoring letter case and surrounding whitespace.
- **Empty_Slot**: A Slot whose input is blank or equals `N/A` in any letter case.
- **Known_Song**: A non-empty Slot input that the Song_Resolver maps to a Canonical_Number.
- **Unknown_Song**: A non-empty, non-`N/A` Slot input that the Song_Resolver cannot map to a Canonical_Number.
- **Conflict_Severity**: The worst conflict level of a Slot: `red` (within 56 days), `yellow` (57 to 90 days) or `green` (91 to 365 days), as computed by `buildModalConflictMap`.
- **Highlight**: A tinted background fill on a Song_Field.
- **Conflict_Window**: The services within 365 days before and after the service date, fetched from the services API.

## Requirements

### Requirement 1: Conflict Highlight on the Song Field

**User Story:** As a music planner, I want the song field itself to be highlighted when the song conflicts, so that I can see conflicts at a glance without looking for a separate badge.

#### Acceptance Criteria

1. WHEN a Slot holds a Known_Song with Conflict_Severity `red`, THE Service_Dialog SHALL apply a red Highlight to the Song_Field of that Slot.
2. WHEN a Slot holds a Known_Song with Conflict_Severity `yellow`, THE Service_Dialog SHALL apply a yellow Highlight to the Song_Field of that Slot.
3. WHEN a Slot holds a Known_Song with Conflict_Severity `green`, THE Service_Dialog SHALL apply a green Highlight to the Song_Field of that Slot.
4. THE Service_Dialog SHALL use the same red, yellow and green tint colors as the service card slot item.
5. THE Service_Dialog SHALL apply the same Highlight rules in add mode and in edit mode.
6. THE Service_Dialog SHALL render no conflict badge dot next to any Song_Field.

### Requirement 2: Light Blue for Conflict-Free Songs

**User Story:** As a music planner, I want songs without conflicts to be light blue, so that I can tell at a glance which songs are safe to use.

#### Acceptance Criteria

1. WHEN a Slot holds a Known_Song with no Conflict_Severity, THE Service_Dialog SHALL apply a light blue Highlight to the Song_Field of that Slot.
2. WHILE a Slot is an Empty_Slot, THE Service_Dialog SHALL render the Song_Field of that Slot without a Highlight.
3. WHILE a Slot holds an Unknown_Song, THE Service_Dialog SHALL render the Song_Field of that Slot without a Highlight.
4. WHILE the service date is not set, THE Service_Dialog SHALL render every Song_Field without a Highlight.
5. IF the request for the Conflict_Window fails, THEN THE Service_Dialog SHALL render every Song_Field without a Highlight and keep the form usable.

### Requirement 3: Conflict Tooltip on the Field

**User Story:** As a music planner, I want to hover a highlighted field to see which services conflict, so that I keep the detail the badge used to give me.

#### Acceptance Criteria

1. WHEN the user hovers a Song_Field that has a red, yellow or green Highlight, THE Service_Dialog SHALL show a tooltip listing each conflicting date and service type, one per line.
2. WHILE a Song_Field has a light blue Highlight or no Highlight, THE Service_Dialog SHALL show no conflict tooltip for that Song_Field.

### Requirement 4: Highlight Follows Edits

**User Story:** As a music planner, I want the highlight to follow my edits, so that the colors always reflect what is currently typed.

#### Acceptance Criteria

1. WHEN the user changes the text of a Song_Field, THE Service_Dialog SHALL recompute the Highlight of every Song_Field.
2. WHEN the user selects a different service date, THE Service_Dialog SHALL fetch the Conflict_Window for that date and recompute the Highlight of every Song_Field.
3. WHEN the user clears the service date, THE Service_Dialog SHALL remove the Highlight from every Song_Field.
4. WHEN the Service_Dialog opens in edit mode, THE Service_Dialog SHALL exclude the service being edited from the Conflict_Window before computing Highlights.

### Requirement 5: Case-Insensitive Song Entry

**User Story:** As a music planner, I want song entry to ignore letter case, so that typing `a10` works the same as `A10`.

#### Acceptance Criteria

1. WHEN the input of a Slot matches a Repertoire song number when letter case and surrounding whitespace are ignored, THE Song_Resolver SHALL return the Canonical_Number of that song.
2. WHEN the input of a Slot matches no Repertoire song number when letter case and surrounding whitespace are ignored, THE Song_Resolver SHALL return no song.
3. FOR ALL inputs, WHEN the Song_Resolver returns a Canonical_Number, THE Song_Resolver SHALL return that same Canonical_Number when given it as input (idempotence).
4. THE Service_Dialog SHALL treat an input as an Unknown_Song only when the Song_Resolver returns no song for a non-empty, non-`N/A` input.
5. WHEN the user presses Save, THE Service_Dialog SHALL block the save and show the unknown song error on every Slot holding an Unknown_Song.
6. THE Service_Dialog SHALL treat the text `N/A` in any letter case as an Empty_Slot.

### Requirement 6: Conflicts Computed from the Canonical Song

**User Story:** As a music planner, I want conflicts computed from the song I meant, so that a lowercase entry is highlighted the same as the uppercase entry.

#### Acceptance Criteria

1. WHEN the input of a Slot differs from a Canonical_Number only in letter case or surrounding whitespace, THE Service_Dialog SHALL compute the Conflict_Severity and the conflicting dates for that Slot using the Canonical_Number.
2. FOR ALL Slot inputs that resolve to the same Canonical_Number, THE Service_Dialog SHALL produce the same Highlight and the same tooltip text.

### Requirement 7: Canonical Numbers in Saved Data

**User Story:** As a music planner, I want saved songs to use the repertoire spelling, so that stored data stays consistent regardless of how I typed it.

#### Acceptance Criteria

1. WHEN the user saves a service, THE Service_Dialog SHALL send the Canonical_Number for every Known_Song in the request payload.
2. WHEN the user saves a service, THE Service_Dialog SHALL send `null` as the song number for every Empty_Slot.
3. THE Service_Dialog SHALL send exactly 14 slot entries, in slot template order, in every create or update request payload.
4. WHEN a Slot input loses focus and holds a Known_Song, THE Service_Dialog SHALL replace the displayed text with the Canonical_Number.
5. WHEN the user selects an autocomplete option, THE Service_Dialog SHALL place the Canonical_Number of that option in the Song_Field.

### Requirement 8: Autocomplete Behavior

**User Story:** As a music planner, I want autocomplete suggestions to keep working, so that case-insensitive entry does not change how I pick songs.

#### Acceptance Criteria

1. WHEN the user types a prefix of a Canonical_Number in any letter case, THE Service_Dialog SHALL list every Repertoire song whose number starts with that prefix ignoring letter case.
2. WHILE a Song_Field is empty, THE Service_Dialog SHALL list no autocomplete options for that Song_Field.
