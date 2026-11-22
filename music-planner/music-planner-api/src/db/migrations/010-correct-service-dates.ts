import { QueryInterface, Transaction } from 'sequelize';
import { initAssociations } from '../../models/associations';
import { Congregation } from '../../models/Congregation';
import { Service } from '../../models/Service';
import {
  CONGREGATION_NAME,
  ScheduleEntry,
  parseDate,
  readSchedule,
  resolveScheduleFile,
} from '../importers/brentwoodSchedule';

/**
 * Data migration: correct Brentwood Park services that were imported one day
 * early (the importer stored the UTC date instead of the Africa/Johannesburg
 * date).
 *
 * WARNING: this migration CHANGES STORED `service_date` VALUES of existing
 * services. It DELETES NO ROWS: service ids, slots, songs and `created_at` are
 * kept because rows are updated in place. Back up the database before running
 * it on existing data.
 *
 * Services are matched to schedule entries by (congregation, faulty date,
 * service type), so services edited in the app or added by users that match no
 * entry are left alone. A move is skipped (with a warning) when a service
 * already exists at the target (congregation, date, service type).
 *
 * `up` is idempotent: after it runs, no row sits at a faulty (date, type), so a
 * second run moves nothing. On a database imported with the fixed importer it
 * also moves nothing.
 *
 * `down` moves services from the corrected date back to the faulty date, with
 * the same matching and collision rule. It only reverts rows that are still at
 * their corrected date; rows that were edited to another date since are not
 * touched.
 */

interface PlannedMove {
  faultyDate: string;
  correctDate: string;
  serviceType: string;
}

/** Entries whose stored date differs from the correct one, in unique (dates, type) form. */
function planMoves(schedule: ScheduleEntry[]): PlannedMove[] {
  const seen = new Set<string>();
  const moves: PlannedMove[] = [];
  for (const entry of schedule) {
    const faultyDate = entry.date.substring(0, 10);
    const correctDate = parseDate(entry.date);
    if (faultyDate === correctDate) continue;
    const key = `${faultyDate}|${correctDate}|${entry.serviceType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    moves.push({ faultyDate, correctDate, serviceType: entry.serviceType });
  }
  return moves;
}

async function applyMoves(
  congregationId: string,
  moves: Array<{ from: string; to: string; serviceType: string }>,
  transaction: Transaction,
): Promise<void> {
  let moved = 0;
  let notFound = 0;
  let skipped = 0;

  for (const move of moves) {
    const service = await Service.findOne({
      where: { congregationId, serviceDate: move.from, serviceType: move.serviceType },
      transaction,
    });
    if (!service) {
      notFound++;
      continue;
    }
    const occupied = await Service.findOne({
      where: { congregationId, serviceDate: move.to, serviceType: move.serviceType },
      transaction,
    });
    if (occupied) {
      console.warn(
        `Skipping ${move.serviceType} on ${move.from}: a service already exists on ${move.to}.`,
      );
      skipped++;
      continue;
    }
    await Service.update(
      { serviceDate: move.to },
      { where: { id: service.id }, transaction },
    );
    moved++;
  }

  console.log(
    `Service dates: ${moved} moved, ${notFound} not found, ${skipped} skipped.`,
  );
}

export async function up(ctx: { context: QueryInterface }): Promise<void> {
  initAssociations();

  // Pre-flight: locate and parse the file before any database write.
  const schedule = readSchedule(resolveScheduleFile());

  await ctx.context.sequelize.transaction(async (transaction) => {
    const congregation = await Congregation.findOne({
      where: { name: CONGREGATION_NAME },
      transaction,
    });
    if (!congregation) {
      console.log(`No "${CONGREGATION_NAME}" congregation found; no service dates to correct.`);
      return;
    }

    // Latest dates first, so a service never moves onto a date that a
    // not-yet-moved service still occupies.
    const moves = planMoves(schedule).sort((a, b) => b.correctDate.localeCompare(a.correctDate));
    await applyMoves(
      congregation.id,
      moves.map((m) => ({ from: m.faultyDate, to: m.correctDate, serviceType: m.serviceType })),
      transaction,
    );
  });
}

export async function down(ctx: { context: QueryInterface }): Promise<void> {
  initAssociations();

  const schedule = readSchedule(resolveScheduleFile());

  await ctx.context.sequelize.transaction(async (transaction) => {
    const congregation = await Congregation.findOne({
      where: { name: CONGREGATION_NAME },
      transaction,
    });
    if (!congregation) {
      console.log(`No "${CONGREGATION_NAME}" congregation found; nothing to roll back.`);
      return;
    }

    // Earliest dates first: the reverse of `up`, so each service moves into a
    // date already vacated by the one before it.
    const moves = planMoves(schedule).sort((a, b) => a.correctDate.localeCompare(b.correctDate));
    await applyMoves(
      congregation.id,
      moves.map((m) => ({ from: m.correctDate, to: m.faultyDate, serviceType: m.serviceType })),
      transaction,
    );
  });
}
