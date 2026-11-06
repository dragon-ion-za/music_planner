import * as fs from 'fs';
import * as path from 'path';
import { QueryInterface } from 'sequelize';
import { initAssociations } from '../../models/associations';
import { Congregation } from '../../models/Congregation';
import { Service } from '../../models/Service';
import { ServiceSlot } from '../../models/ServiceSlot';
import { SlotTemplate } from '../../models/SlotTemplate';
import { Song } from '../../models/Song';
import { seedSlotTemplates } from '../../seeds/seedSlotTemplates';

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
 */

const CONGREGATION_NAME = 'Brentwood Park';
const CONGREGATION_TIMEZONE = 'Africa/Johannesburg'; // UTC+2, no DST

interface ScheduleSong {
  type: string;
  number: string;
  [key: string]: unknown;
}

interface ScheduleEntry {
  date: string;
  serviceType: string;
  songs: ScheduleSong[];
}

function parseDate(isoString: string): string {
  // Store the calendar date portion only (matches Service.serviceDate DATEONLY).
  return isoString.substring(0, 10);
}

function isEmptySong(rawNumber: string): boolean {
  const n = rawNumber.trim().toUpperCase();
  // Tolerate stray punctuation seen in the data (e.g. "N/A`").
  return n === '' || n === 'N/A' || n.replace(/[^A-Z0-9/]/g, '') === 'N/A';
}

function resolveDataFile(): string {
  // Resolve relative to the repo `.data` folder. __dirname is
  // src/db/migrations (ts-node) or dist/db/migrations (compiled); the repo
  // root is three levels up from either.
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

export async function up(_ctx: { context: QueryInterface }): Promise<void> {
  initAssociations();

  // Be self-sufficient: this migration may run before any seed step.
  const [congregation] = await Congregation.upsert({
    name: CONGREGATION_NAME,
    timezone: CONGREGATION_TIMEZONE,
  });
  const congregationId = congregation.id;
  console.log(`Brentwood Park congregation id: ${congregationId}`);

  // Ensure default slot templates exist for this congregation.
  await seedSlotTemplates(congregationId);

  const slotTemplates = await SlotTemplate.findAll({ where: { congregationId } });
  const slotKeyToId = new Map<string, string>();
  for (const st of slotTemplates) {
    slotKeyToId.set(st.slotKey, st.id);
  }

  const allSongs = await Song.findAll({ attributes: ['id', 'number'] });
  const songNumberToId = new Map<string, string>();
  for (const song of allSongs) {
    songNumberToId.set(song.number.toUpperCase(), song.id);
  }

  const filePath = resolveDataFile();
  const raw = fs.readFileSync(filePath, 'utf-8');
  const schedule: ScheduleEntry[] = JSON.parse(raw);

  let serviceCount = 0;
  let slotCount = 0;
  let nulledSlots = 0;
  const unknownNumbers = new Set<string>();

  for (const entry of schedule) {
    const serviceDate = parseDate(entry.date);
    const serviceType = entry.serviceType;

    const [service] = await Service.upsert({ congregationId, serviceDate, serviceType });
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

      await ServiceSlot.upsert({ serviceId: service.id, slotTemplateId, songId });
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
