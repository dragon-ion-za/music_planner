import fc from 'fast-check';
import { DataTypes, QueryTypes } from 'sequelize';
import { testSequelize, bindTestModels, teardownTestDb } from './testDb';
import { backfillSongNames } from '../db/migrations/008-add-song-name';
import type { CsvRow } from '../seeds/seedSongsFromCsv';

const qi = testSequelize.getQueryInterface();

async function resetSongsTable(): Promise<void> {
  await qi.dropAllTables();
  await qi.createTable('songs', {
    id: { type: DataTypes.STRING, primaryKey: true },
    number: { type: DataTypes.STRING(20), allowNull: false },
    hymnal: { type: DataTypes.STRING(10), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: true },
  });
}

async function names(): Promise<Record<string, string | null>> {
  const rows = await testSequelize.query<{ id: string; name: string | null }>(
    'SELECT id, name FROM songs',
    { type: QueryTypes.SELECT },
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

const numberArb = fc
  .tuple(fc.constantFrom('A', 'E', 'B'), fc.integer({ min: 1, max: 30 }))
  .map(([h, n]) => `${h}${n}`);

// Songs: unique numbers, random stored case, optional pre-existing name.
const songsArb = fc.uniqueArray(
  fc.record({
    number: numberArb,
    lower: fc.boolean(),
    existingName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  }),
  { selector: (s) => s.number, maxLength: 15 },
);

// CSV rows may reference songs or unknown numbers, repeat numbers, and have blank/padded names.
const rowsArb = fc.array(
  fc.record({
    hymnal: fc.constant(''),
    number: fc.oneof(numberArb, fc.constant('')),
    name: fc.oneof(
      fc.string({ maxLength: 30 }),
      fc.string({ maxLength: 20 }).map((s) => `  ${s}  `),
      fc.constant('   '),
    ),
    translationNumber: fc.constant(''),
  }) as fc.Arbitrary<CsvRow>,
  { maxLength: 25 },
);

beforeAll(() => bindTestModels());
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});
afterAll(teardownTestDb);

describe('name backfill idempotence (property)', () => {
  // Feature: monthly-services-view, Property 15: Name backfill is idempotent
  // **Validates: Requirements 10.4**
  it('a second backfillSongNames run leaves every songs.name unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(songsArb, rowsArb, async (songs, rows) => {
        await resetSongsTable();
        for (const [i, s] of songs.entries()) {
          const stored = s.lower ? s.number.toLowerCase() : s.number;
          await testSequelize.query(
            'INSERT INTO songs (id, number, hymnal, name) VALUES (:id, :n, :h, :name)',
            {
              replacements: {
                id: `id-${i}`,
                n: stored,
                h: s.number.replace(/\d+/g, ''),
                name: s.existingName,
              },
            },
          );
        }

        await backfillSongNames(qi, rows);
        const first = await names();
        await backfillSongNames(qi, rows);
        const second = await names();

        expect(second).toEqual(first);
      }),
      { numRuns: 100 },
    );
  });
});
