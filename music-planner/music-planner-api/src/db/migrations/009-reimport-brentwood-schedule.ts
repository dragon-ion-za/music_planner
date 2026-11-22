import { QueryInterface } from 'sequelize';
import { initAssociations } from '../../models/associations';
import { Congregation } from '../../models/Congregation';
import { Service } from '../../models/Service';
import {
  CONGREGATION_NAME,
  importSchedule,
  readSchedule,
  resolveScheduleFile,
  seedBrentwoodCongregation,
} from '../importers/brentwoodSchedule';

/**
 * Data migration: replace the Brentwood Park schedule with the contents of
 * `.data/brentwood-schedule-latest.json`.
 *
 * WARNING: `up` deletes every Brentwood Park service (and, via FK cascade,
 * their service_slots) before re-importing, so any edits made to those
 * services in the app are discarded.
 *
 * `down` removes the Brentwood Park services only. It CANNOT restore the
 * schedule that existed before `up` ran; that data is gone once `up` commits.
 *
 * `up` reads and validates the schedule file before opening a transaction, then
 * runs the delete and re-import in a single transaction, so a failed import
 * leaves the previous services in place.
 *
 * The import logic lives in `../importers/brentwoodSchedule` (shared with
 * migration 007).
 */

export async function up(ctx: { context: QueryInterface }): Promise<void> {
  initAssociations();

  // Pre-flight: locate and parse the file before any database write.
  const schedule = readSchedule(resolveScheduleFile());

  await ctx.context.sequelize.transaction(async (transaction) => {
    const congregationId = await seedBrentwoodCongregation({ transaction });

    // Removing the services cascades to their service_slots (FK onDelete CASCADE).
    const removed = await Service.destroy({ where: { congregationId }, transaction });
    console.log(`Removed ${removed} existing services for "${CONGREGATION_NAME}".`);

    await importSchedule(congregationId, schedule, { transaction });
  });
}

export async function down(_ctx: { context: QueryInterface }): Promise<void> {
  initAssociations();

  const congregation = await Congregation.findOne({ where: { name: CONGREGATION_NAME } });
  if (!congregation) {
    console.log(`No "${CONGREGATION_NAME}" congregation found; nothing to roll back.`);
    return;
  }

  // The congregation, slot templates and songs are left in place.
  const removed = await Service.destroy({ where: { congregationId: congregation.id } });
  console.log(`Removed ${removed} services for "${CONGREGATION_NAME}".`);
}
