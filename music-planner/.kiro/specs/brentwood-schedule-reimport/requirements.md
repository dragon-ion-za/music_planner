# Requirements Document

## Introduction

The file `.data/brentwood-schedule-latest.json` has been updated. Migration `007-import-brentwood-schedule.ts` imported the earlier version using upserts, and Umzug records it in `SequelizeMeta`, so databases that already ran it will not run it again. This feature adds a new migration, `009-reimport-brentwood-schedule.ts`, that replaces the Brentwood Park schedule with the contents of the updated file. The shared import logic is extracted from migration 007 into a helper used by both migrations, so the logic is not duplicated and migration 007 behaves as before.

Accepted consequence: the re-import deletes every Brentwood Park service and re-creates them from the JSON file. In-app edits made to Brentwood Park services since migration 007 ran (for example swapped songs and added services) are discarded.

## Glossary

- **Reimport_Migration**: The new migration `music-planner-api/src/db/migrations/009-reimport-brentwood-schedule.ts`.
- **Import_Migration**: The existing migration `music-planner-api/src/db/migrations/007-import-brentwood-schedule.ts`.
- **Import_Helper**: The shared module extracted from the Import_Migration that holds the schedule import logic.
- **Schedule_File**: The JSON file `.data/brentwood-schedule-latest.json`, an array of entries each holding a `date`, a `serviceType` and a list of `songs` (each with a `type` and a `number`).
- **Brentwood_Congregation**: The congregation named `Brentwood Park`, with timezone `Africa/Johannesburg`.
- **Other_Congregation**: Any congregation whose name is not `Brentwood Park`.
- **Service**: A row in the `services` table.
- **Service_Slot**: A row in the `service_slots` table, which references a Service through a foreign key with `ON DELETE CASCADE`.
- **Slot_Template**: A row in the `slot_templates` table, identified within a congregation by `slotKey`.
- **Empty_Song_Value**: A song `number` that is an empty string, `N/A` (case-insensitive), or `N/A` with stray punctuation.
- **Unknown_Song_Number**: A non-empty song `number` that matches no `songs.number` after trimming and upper-casing.
- **Migration_Runner**: The Umzug-based runner started by `npm run migrate`.
- **Test_Suite**: The Jest tests in `music-planner-api/src/tests`, which run against an in-memory SQLite database.

## Requirements

### Requirement 1: Shared import helper

**User Story:** As a developer, I want the schedule import logic in one shared module, so that migrations 007 and 009 do not duplicate it.

#### Acceptance Criteria

1. THE Import_Helper SHALL provide the following import logic: parsing the calendar date from an entry's `date`, detecting an Empty_Song_Value, resolving a song `type` to a Slot_Template, resolving a song `number` to a song, seeding the Brentwood_Congregation, and seeding its Slot_Templates.
2. THE Import_Migration SHALL call the Import_Helper for the schedule import logic.
3. THE Reimport_Migration SHALL call the Import_Helper for the schedule import logic.
4. THE Import_Helper SHALL accept the path of the Schedule_File to import.
5. WHEN the Import_Migration runs on a database that has not run it before, THE Import_Migration SHALL produce the same congregation, Slot_Templates, Services and Service_Slots as it produced before the extraction.
6. THE Import_Migration SHALL retain its existing `up` and `down` behavior.

### Requirement 2: Reimport migration registration and one-time execution

**User Story:** As a maintainer, I want a new migration to apply the updated schedule, so that databases that already ran migration 007 receive the update.

#### Acceptance Criteria

1. THE Reimport_Migration SHALL exist as `music-planner-api/src/db/migrations/009-reimport-brentwood-schedule.ts` and export `up` and `down` functions with the same signature as the other migrations.
2. WHEN the Migration_Runner runs on a database whose `SequelizeMeta` lacks migration 009, THE Migration_Runner SHALL execute the Reimport_Migration once and record it in `SequelizeMeta`.
3. WHEN the Migration_Runner runs on a database whose `SequelizeMeta` already contains migration 009, THE Migration_Runner SHALL skip the Reimport_Migration.
4. THE Reimport_Migration SHALL run after migration 008 (`008-add-song-name.ts`).
5. THE Reimport_Migration SHALL leave the behavior of the Import_Migration unchanged for databases that have already run it.

### Requirement 3: Replace the Brentwood Park schedule

**User Story:** As a planner, I want the Brentwood Park schedule to match the updated JSON file, so that the planner shows the current plan.

#### Acceptance Criteria

1. WHEN the Reimport_Migration runs `up`, THE Reimport_Migration SHALL delete every Service whose congregation is the Brentwood_Congregation.
2. WHEN a Service is deleted by the Reimport_Migration, THE database SHALL delete the Service_Slots of that Service through the foreign key cascade.
3. WHEN the Reimport_Migration has deleted the Brentwood_Congregation Services, THE Reimport_Migration SHALL import every entry of the Schedule_File as a Service of the Brentwood_Congregation.
4. WHEN the Reimport_Migration completes `up`, THE Brentwood_Congregation SHALL have exactly one Service per distinct `date` and `serviceType` pair in the Schedule_File and no other Services.
5. WHEN the Reimport_Migration imports a song entry, THE Reimport_Migration SHALL create one Service_Slot linking the Service, the Slot_Template whose `slotKey` equals the entry's `type`, and the resolved song.
6. IF the Schedule_File cannot be found, THEN THE Reimport_Migration SHALL fail with an error that names the paths searched, before deleting any Service.
7. IF the Schedule_File is not valid JSON, THEN THE Reimport_Migration SHALL fail with an error before deleting any Service.
8. IF the import fails after the deletion has begun, THEN THE Reimport_Migration SHALL leave the Brentwood_Congregation's Services unchanged from before the migration ran.

### Requirement 4: Song and slot handling

**User Story:** As a planner, I want songs resolved the same way as in the original import, so that the re-imported schedule is consistent with earlier data.

#### Acceptance Criteria

1. WHEN a song entry holds an Empty_Song_Value, THE Import_Helper SHALL store the Service_Slot with a null `songId`.
2. WHEN a song entry holds a number that matches a song after trimming and upper-casing, THE Import_Helper SHALL store the Service_Slot with that song's `id`.
3. IF a song entry holds an Unknown_Song_Number, THEN THE Import_Helper SHALL store the Service_Slot with a null `songId` and log one warning that lists every distinct Unknown_Song_Number.
4. IF a song entry's `type` matches no Slot_Template of the Brentwood_Congregation, THEN THE Import_Helper SHALL skip that entry and log a warning that names the slot key, date and service type.
5. WHEN the Import_Helper stores a Service, THE Import_Helper SHALL store only the calendar date (the first 10 characters of the entry's `date`) as `serviceDate`.
6. WHEN the Import_Helper completes, THE Import_Helper SHALL log the count of Services imported, the count of Service_Slots imported, and the count of slots with no song.

### Requirement 5: Scope limited to the Brentwood Park congregation

**User Story:** As an administrator of several congregations, I want the re-import to touch only Brentwood Park, so that other congregations keep their data.

#### Acceptance Criteria

1. WHEN the Reimport_Migration runs `up`, THE Reimport_Migration SHALL leave every Other_Congregation row unchanged.
2. WHEN the Reimport_Migration runs `up`, THE Reimport_Migration SHALL leave every Service and Service_Slot of every Other_Congregation unchanged.
3. WHEN the Reimport_Migration runs `up`, THE Reimport_Migration SHALL leave every Slot_Template of every Other_Congregation unchanged.
4. WHEN the Reimport_Migration runs `up`, THE Reimport_Migration SHALL leave the songs table unchanged.

### Requirement 6: Databases that never ran migration 007

**User Story:** As a developer setting up a new environment, I want migration 009 to work on a fresh database, so that a full migration run yields the current schedule.

#### Acceptance Criteria

1. WHEN the Reimport_Migration runs on a database where the Brentwood_Congregation does not exist, THE Reimport_Migration SHALL create the Brentwood_Congregation and its Slot_Templates and import the Schedule_File.
2. WHEN migrations 001 through 009 run in sequence on an empty database, THE Brentwood_Congregation SHALL hold exactly the Services described by the Schedule_File.
3. WHEN the Reimport_Migration runs on a database where the Brentwood_Congregation exists and has no Services, THE Reimport_Migration SHALL import the Schedule_File without error.

### Requirement 7: Accepted loss of in-app edits

**User Story:** As a maintainer, I want the data loss of the re-import documented, so that the effect on existing data is a recorded decision.

#### Acceptance Criteria

1. WHEN the Reimport_Migration runs `up` on a database that holds Brentwood_Congregation Services edited in the application since migration 007 ran, THE Reimport_Migration SHALL replace those Services with the Schedule_File contents, including swapped songs and added services.
2. WHEN the Reimport_Migration runs `up`, THE Reimport_Migration SHALL log the count of Brentwood_Congregation Services it deleted.
3. THE Reimport_Migration source file SHALL carry a header comment stating that in-app edits to Brentwood_Congregation Services are discarded.

### Requirement 8: Down behavior

**User Story:** As a maintainer, I want a defined rollback, so that reverting migration 009 has predictable results.

#### Acceptance Criteria

1. WHEN the Reimport_Migration runs `down`, THE Reimport_Migration SHALL delete every Service of the Brentwood_Congregation, cascading to its Service_Slots.
2. WHEN the Reimport_Migration runs `down` and the Brentwood_Congregation does not exist, THE Reimport_Migration SHALL log that there is nothing to roll back and complete without error.
3. WHEN the Reimport_Migration runs `down`, THE Reimport_Migration SHALL leave every Other_Congregation, Slot_Template and song unchanged.
4. THE Reimport_Migration source file SHALL carry a header comment stating that `down` cannot restore the schedule that existed before `up` ran.

### Requirement 9: Test coverage

**User Story:** As a developer, I want automated tests for the new migration, so that regressions in the import or its scoping are caught.

#### Acceptance Criteria

1. THE Test_Suite SHALL include tests for the Reimport_Migration that run against the in-memory SQLite database using the existing `testDb.ts` helpers and the file-mocking approach in `songNameMigration.test.ts`.
2. THE Test_Suite SHALL include a test that runs migrations 001 through 009 in sequence on an empty database and verifies the resulting Brentwood_Congregation Services and Service_Slots.
3. THE Test_Suite SHALL include a test in which a second congregation with its own Services exists, and verify that the Reimport_Migration `up` leaves those Services and Service_Slots unchanged.
4. THE Test_Suite SHALL include a test that seeds Brentwood_Congregation Services that differ from the Schedule_File, runs the Reimport_Migration `up`, and verifies that only the Schedule_File Services remain.
5. THE Test_Suite SHALL include tests for an Empty_Song_Value, an Unknown_Song_Number and an unknown slot key.
6. THE Test_Suite SHALL include tests for the Reimport_Migration `down` covering both an existing and an absent Brentwood_Congregation.
7. THE Test_Suite SHALL include a test that runs the Import_Migration `up` and verifies the output required by Requirement 1.5.
8. WHEN the existing tests in `songNameMigration.test.ts` and the rest of the Test_Suite run after this feature is implemented, THE Test_Suite SHALL pass.
