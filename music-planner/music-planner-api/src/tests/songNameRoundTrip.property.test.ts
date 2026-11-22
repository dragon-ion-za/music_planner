import * as fc from 'fast-check';
import { testSequelize, bindTestModels, teardownTestDb } from './testDb';
import { backfillSongNames } from '../db/migrations/008-add-song-name';
import { seedSongsFromCsv, CsvRow } from '../seeds/seedSongsFromCsv';
import { Congregation } from '../models/Congregation';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { ServiceRepository } from '../repositories/ServiceRepository';

// Feature: monthly-services-view, Property 14: Hymn name round trip through the API
// **Validates: Requirements 10.2, 10.3, 10.7, 10.9, 10.10, 10.11, 10.12**

// `var` + function declaration: jest.mock is hoisted above the imports.
// eslint-disable-next-line no-var
var mockCsvContent: string | undefined;
function fakeFor(p: unknown): string | undefined {
  return mockCsvContent !== undefined && String(p).endsWith('repertoir.csv') ? mockCsvContent : undefined;
}

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: (p: any) => (fakeFor(p) !== undefined ? true : actual.existsSync(p)),
    readFileSync: (p: any, ...rest: any[]) => fakeFor(p) ?? actual.readFileSync(p, ...rest),
  };
});

beforeAll(async () => {
  bindTestModels();
  await testSequelize.sync({ force: true });
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterAll(async () => {
  jest.restoreAllMocks();
  await teardownTestDb();
});

async function clearAll(): Promise<void> {
  await ServiceSlot.destroy({ where: {} });
  await Service.destroy({ where: {} });
  await SlotTemplate.destroy({ where: {} });
  await Congregation.destroy({ where: {} });
  await Song.destroy({ where: {} });
}

const NAME_CHARS = [...'abcXYZ, -éà'];
const spaces = fc.string({ unit: fc.constant(' '), maxLength: 3 });
const core = fc.string({ unit: fc.constantFrom(...NAME_CHARS), minLength: 1, maxLength: 30 });
/** Blank, spaces-only, or a name padded with whitespace. */
const rawName = fc.oneof(
  spaces,
  fc.tuple(spaces, core, spaces).map(([a, b, c]) => `${a}${b}${c}`),
);
const applyCase = (s: string, lower: boolean) => (lower ? s.toLowerCase() : s.toUpperCase());
const expectedName = (raw: string | undefined): string | null => (raw ?? '').trim() || null;

describe('Property 14: Hymn name round trip through the API', () => {
  it('backfilled names read back through ServiceRepository equal the trimmed CSV name or null', async () => {
    const songArb = fc.record({
      hymnal: fc.constantFrom('A', 'B', 'E'),
      lower: fc.boolean(),
      csvLower: fc.boolean(),
      row: fc.option(rawName, { nil: undefined }), // undefined = no CSV row for this song
      link: fc.option(fc.nat(), { nil: undefined }),
    });
    const scenario = fc.record({
      songs: fc.array(songArb, { minLength: 1, maxLength: 8 }),
      unmatched: fc.array(fc.tuple(fc.boolean(), rawName), { maxLength: 4 }),
    });

    await fc.assert(
      fc.asyncProperty(scenario, async ({ songs, unmatched }) => {
        await clearAll();
        const keys = songs.map((s, i) => `${s.hymnal}${i + 1}`);

        // Songs are loaded without a name, with the number stored in either case.
        const created = await Song.bulkCreate(
          songs.map((s, i) => ({
            number: applyCase(keys[i], s.lower),
            hymnal: s.hymnal,
            name: null,
            translationOfId: null,
          })),
        );
        const targetOf = songs.map((s, i) => {
          if (s.link === undefined) return -1;
          const t = s.link % songs.length;
          return t === i ? -1 : t;
        });
        for (let i = 0; i < songs.length; i++) {
          if (targetOf[i] >= 0) await created[i].update({ translationOfId: created[targetOf[i]].id });
        }

        const rows: CsvRow[] = [];
        songs.forEach((s, i) => {
          if (s.row !== undefined) {
            rows.push({
              hymnal: s.hymnal,
              number: applyCase(keys[i], s.csvLower),
              name: s.row.trim(),
              translationNumber: '',
            });
          }
        });
        unmatched.forEach(([lower, name], i) => {
          rows.push({ hymnal: 'Z', number: applyCase(`Z${i + 1}`, lower), name, translationNumber: '' });
        });

        await backfillSongNames(testSequelize.getQueryInterface(), rows);

        // One service with a slot per song, read back through the repository.
        const congregation = await Congregation.create({ name: 'Round trip' });
        const service = await Service.create({
          congregationId: congregation.id,
          serviceDate: '2025-01-05',
          serviceType: 'Sunday Service',
        });
        for (let i = 0; i < songs.length; i++) {
          const template = await SlotTemplate.create({
            congregationId: congregation.id,
            serviceType: 'Sunday Service',
            slotKey: `slot${i}`,
            displayOrder: i,
            category: 'orchestra',
          });
          await ServiceSlot.create({ serviceId: service.id, slotTemplateId: template.id, songId: created[i].id });
        }

        const [found] = await ServiceRepository.findByCongregation(congregation.id);
        const bySlot = new Map<string, any>(
          found.toJSON().serviceSlots.map((sl: any) => [sl.slotTemplate.slotKey, sl.song]),
        );
        songs.forEach((s, i) => {
          const song = bySlot.get(`slot${i}`);
          expect(song.name).toBe(expectedName(s.row));
          if (targetOf[i] >= 0) {
            expect(song.translationOf.name).toBe(expectedName(songs[targetOf[i]].row));
          } else {
            expect(song.translationOf).toBeNull();
          }
        });
      }),
      { numRuns: 100 },
    );
  }, 120000);

  it('seedSongsFromCsv with names enabled stores the trimmed CSV names', async () => {
    const rowArb = fc.record({
      lower: fc.boolean(),
      name: rawName,
      link: fc.option(fc.nat(), { nil: undefined }),
      linkLower: fc.boolean(),
    });

    await fc.assert(
      fc.asyncProperty(fc.array(rowArb, { minLength: 1, maxLength: 8 }), async (rows) => {
        await clearAll();
        const keys = rows.map((_, i) => `A${i + 1}`);
        const targetOf = rows.map((r, i) => {
          if (r.link === undefined) return -1;
          const t = r.link % rows.length;
          return t === i ? -1 : t;
        });
        mockCsvContent = [
          'Hymnal|Number|Name|TranslationNumber_HymnalE',
          ...rows.map(
            (r, i) =>
              `A|${applyCase(keys[i], r.lower)}|${r.name}|${
                targetOf[i] >= 0 ? applyCase(keys[targetOf[i]], r.linkLower) : ''
              }`,
          ),
        ].join('\n');

        try {
          await seedSongsFromCsv({ includeName: true });
        } finally {
          mockCsvContent = undefined;
        }

        for (let i = 0; i < rows.length; i++) {
          const song = await Song.findOne({
            where: { number: keys[i] },
            include: [{ model: Song, as: 'translationOf', attributes: ['number', 'name'] }],
          });
          const json = song!.toJSON() as any;
          expect(json.name).toBe(expectedName(rows[i].name));
          if (targetOf[i] >= 0) {
            expect(json.translationOf.name).toBe(expectedName(rows[targetOf[i]].name));
          } else {
            expect(json.translationOf).toBeNull();
          }
        }
      }),
      { numRuns: 100 },
    );
  }, 120000);
});
