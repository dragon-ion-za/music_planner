import * as fs from 'fs';
import * as path from 'path';
import { Transaction } from 'sequelize';
import { Congregation } from '../../models/Congregation';
import { Service } from '../../models/Service';
import { ServiceSlot } from '../../models/ServiceSlot';
import { SlotTemplate } from '../../models/SlotTemplate';
import { Song } from '../../models/Song';
import { seedSlotTemplates } from '../../seeds/seedSlotTemplates';

/**
 * Shared import logic for the Brentwood Park schedule
 * (`.data/brentwood-schedule-latest.json`), used by migrations 007 and 009.
 *
 * Lives outside `migrations/` because Umzug loads every file in that folder
 * as a migration.
 */

export const CONGREGATION_NAME = 'Brentwood Park';
export const CONGREGATION_TIMEZONE = 'Africa/Johannesburg'; // UTC+2, no DST

export interface ScheduleSong {
  type: string;
  number: string;
  [key: string]: unknown;
}

export interface ScheduleEntry {
  date: string;
  serviceType: string;
  songs: ScheduleSong[];
}

export interface ImportOptions {
  transaction?: Transaction;
}

export interface ImportSummary {
  services: number;
  slots: number;
  slotsWithoutSong: number;
}

export function parseDate(
  isoString: string,
  timeZone: string = CONGREGATION_TIMEZONE,
): string {
  // Date-only values are already calendar dates; return them unchanged.
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return isoString;
  }
  const instant = new Date(isoString);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid date string: "${isoString}"`);
  }
  // The schedule stores instants (e.g. local midnight as a UTC timestamp), so the
  // calendar date must be taken in the congregation's timezone, not UTC.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isEmptySong(rawNumber: string): boolean {
  const n = rawNumber.trim().toUpperCase();
  // Tolerate stray punctuation seen in the data (e.g. "N/A`").
  return n === '' || n === 'N/A' || n.replace(/[^A-Z0-9/]/g, '') === 'N/A';
}

export function resolveScheduleFile(): string {
  // __dirname is src/db/importers (ts-node) or dist/db/importers (compiled);
  // the repo root is three levels up from either.
  const candidates = [
    path.resolve(__dirname, '../../../.data/brentwood-schedule-latest.json'),
    path.resolve(__dirname, '../../../../.data/brentwood-schedule-latest.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `brentwood-schedule-latest.json not found. Looked in:\n  ${candidates.join('\n  ')}`
  );
}

export function readSchedule(filePath: string): ScheduleEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse schedule file ${filePath}: ${message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Schedule file ${filePath} must contain a JSON array.`);
  }
  return parsed as ScheduleEntry[];
}

export async function seedBrentwoodCongregation(options: ImportOptions = {}): Promise<string> {
  // Be self-sufficient: callers may run before any seed step.
  await Congregation.upsert(
    { name: CONGREGATION_NAME, timezone: CONGREGATION_TIMEZONE },
    { transaction: options.transaction },
  );
  // Re-read by the unique name: on SQLite, upsert returns a generated id rather
  // than the id of an already existing row.
  const congregation = await Congregation.findOne({
    where: { name: CONGREGATION_NAME },
    transaction: options.transaction,
  });
  if (!congregation) {
    throw new Error(`Congregation "${CONGREGATION_NAME}" not found after upsert.`);
  }
  const congregationId = congregation.id;
  console.log(`Brentwood Park congregation id: ${congregationId}`);

  // Ensure default slot templates exist for this congregation.
  await seedSlotTemplates(congregationId, { transaction: options.transaction });

  return congregationId;
}

export async function importSchedule(
  congregationId: string,
  schedule: ScheduleEntry[],
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const slotTemplates = await SlotTemplate.findAll({
    where: { congregationId },
    transaction: options.transaction,
  });
  const slotKeyToId = new Map<string, string>();
  for (const st of slotTemplates) {
    slotKeyToId.set(st.slotKey, st.id);
  }

  const allSongs = await Song.findAll({
    attributes: ['id', 'number'],
    transaction: options.transaction,
  });
  const songNumberToId = new Map<string, string>();
  for (const song of allSongs) {
    songNumberToId.set(song.number.toUpperCase(), song.id);
  }

  let serviceCount = 0;
  let slotCount = 0;
  let nulledSlots = 0;
  const unknownNumbers = new Set<string>();

  for (const entry of schedule) {
    const serviceDate = parseDate(entry.date);
    const serviceType = entry.serviceType;

    await Service.upsert(
      { congregationId, serviceDate, serviceType },
      { transaction: options.transaction },
    );
    // Re-read by the unique key: on SQLite, upsert returns a generated id rather
    // than the id of an already existing row (e.g. a duplicate entry in the file).
    const service = await Service.findOne({
      where: { congregationId, serviceDate, serviceType },
      transaction: options.transaction,
    });
    if (!service) {
      throw new Error(`Service ${serviceDate} ${serviceType} not found after upsert.`);
    }
    serviceCount++;

    for (const songEntry of entry.songs) {
      const slotKey = songEntry.type;
      const slotTemplateId = slotKeyToId.get(slotKey);
      if (!slotTemplateId) {
        console.warn(`Skipping unknown slot key "${slotKey}" for ${serviceDate} ${serviceType}.`);
        continue;
      }

      const rawNumber = songEntry.number ?? '';
      let songId: string | null = null;
      if (!isEmptySong(rawNumber)) {
        songId = songNumberToId.get(rawNumber.trim().toUpperCase()) ?? null;
        if (songId === null) {
          unknownNumbers.add(rawNumber.trim().toUpperCase());
          nulledSlots++;
        }
      } else {
        nulledSlots++;
      }

      await ServiceSlot.upsert(
        { serviceId: service.id, slotTemplateId, songId },
        { transaction: options.transaction },
      );
      slotCount++;
    }
  }

  if (unknownNumbers.size > 0) {
    console.warn(
      `Song numbers not found in repertoire (stored as empty slots): ${[...unknownNumbers].sort().join(', ')}`
    );
  }
  console.log(
    `Imported ${serviceCount} services and ${slotCount} service slots ` +
    `(${nulledSlots} slots with no song).`
  );

  return { services: serviceCount, slots: slotCount, slotsWithoutSong: nulledSlots };
}
