import * as fs from 'fs';
import * as path from 'path';
import { initAssociations } from '../models/associations';
import { Congregation } from '../models/Congregation';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import { seedSlotTemplates } from './seedSlotTemplates';

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

const CONGREGATION_NAME = 'Example Congregation';
const CONGREGATION_TIMEZONE = 'Europe/London';

function parseDate(isoString: string): string {
  // Extract YYYY-MM-DD from ISO date string
  return isoString.substring(0, 10);
}

function isEmptySong(number: string): boolean {
  return number === '' || number.toUpperCase() === 'N/A';
}

export async function importSchedule(): Promise<void> {
  initAssociations();

  // Upsert congregation
  const [congregation] = await Congregation.upsert({
    name: CONGREGATION_NAME,
    timezone: CONGREGATION_TIMEZONE,
  });
  const congregationId = congregation.id;
  console.log(`Congregation id: ${congregationId}`);

  // Seed slot templates for this congregation
  await seedSlotTemplates(congregationId);

  // Build slotKey -> slotTemplateId map
  const slotTemplates = await SlotTemplate.findAll({ where: { congregationId } });
  const slotKeyToId = new Map<string, string>();
  for (const st of slotTemplates) {
    slotKeyToId.set(st.slotKey, st.id);
  }

  // Build uppercase song number -> songId map
  const allSongs = await Song.findAll({ attributes: ['id', 'number'] });
  const songNumberToId = new Map<string, string>();
  for (const song of allSongs) {
    songNumberToId.set(song.number.toUpperCase(), song.id);
  }

  // Read schedule JSON
  const filePath = path.join(__dirname, '../../../.data/scheduleExample.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const schedule: ScheduleEntry[] = JSON.parse(raw);

  let serviceCount = 0;
  let slotCount = 0;

  for (const entry of schedule) {
    const serviceDate = parseDate(entry.date);
    const serviceType = entry.serviceType;

    // Upsert service row
    const [service] = await Service.upsert({
      congregationId,
      serviceDate,
      serviceType,
    });
    serviceCount++;

    // Insert service slots
    for (const songEntry of entry.songs) {
      const slotKey = songEntry.type;
      const slotTemplateId = slotKeyToId.get(slotKey);

      if (!slotTemplateId) {
        // Slot template not found for this slotKey — skip (e.g. non-Sunday service slots)
        continue;
      }

      const rawNumber = songEntry.number ?? '';
      const songId = isEmptySong(rawNumber)
        ? null
        : (songNumberToId.get(rawNumber.toUpperCase()) ?? null);

      await ServiceSlot.upsert({
        serviceId: service.id,
        slotTemplateId,
        songId,
      });
      slotCount++;
    }
  }

  console.log(`Imported ${serviceCount} services and ${slotCount} service slots.`);
}

// CLI invocation
if (require.main === module) {
  importSchedule()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
