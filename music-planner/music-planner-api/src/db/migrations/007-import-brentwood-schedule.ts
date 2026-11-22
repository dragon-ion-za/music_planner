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
 * One-time data migration: load Brentwood Park's planned services from
 * `.data/brentwood-schedule-latest.json` into the database.
 *
 * This is intentionally run locally/manually (via `npm run migrate`) rather
 * than baked into the Docker image — the source JSON is not shipped in the
 * API container. Umzug records it in SequelizeMeta, so it applies exactly once.
 *
 * Empty ("") or "N/A" song slots are stored with a null songId, and song
 * numbers not present in the repertoire resolve to null (with a warning),
 * matching the schedule-import behaviour.
 *
 * The import logic lives in `../importers/brentwoodSchedule` (shared with
 * migration 009).
 */

export async function up(_ctx: { context: QueryInterface }): Promise<void> {
  initAssociations();

  const schedule = readSchedule(resolveScheduleFile());
  const congregationId = await seedBrentwoodCongregation();
  await importSchedule(congregationId, schedule);
}

export async function down(_ctx: { context: QueryInterface }): Promise<void> {
  initAssociations();

  const congregation = await Congregation.findOne({ where: { name: CONGREGATION_NAME } });
  if (!congregation) {
    console.log(`No "${CONGREGATION_NAME}" congregation found; nothing to roll back.`);
    return;
  }

  // Removing the services cascades to their service_slots (FK onDelete CASCADE).
  const removed = await Service.destroy({ where: { congregationId: congregation.id } });
  console.log(`Removed ${removed} services for "${CONGREGATION_NAME}".`);
}
