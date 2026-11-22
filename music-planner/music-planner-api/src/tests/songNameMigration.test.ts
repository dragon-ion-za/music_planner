import { DataTypes, QueryTypes } from 'sequelize';
import { testSequelize, bindTestModels, teardownTestDb } from './testDb';
import * as m001 from '../db/migrations/001-create-congregations';
import * as m002 from '../db/migrations/002-create-songs';
import * as m003 from '../db/migrations/003-create-slot-templates';
import * as m004 from '../db/migrations/004-create-services';
import * as m005 from '../db/migrations/005-create-service-slots';
import * as m006 from '../db/migrations/006-load-song-repertoire';
import * as m007 from '../db/migrations/007-import-brentwood-schedule';
import * as m008 from '../db/migrations/008-add-song-name';

const qi = testSequelize.getQueryInterface();
const ctx = { context: qi };

const CSV = [
  'Hymnal|Number|Name|TranslationNumber_HymnalE',
  'A|A1|  Almagtig is ons God  |',
  'A|A10|Grote God|E7',
  'E|E7|Great God|',
  'A|A99|Not In Database|',
  'A|A5|   |',
].join('\n');

// Small schedule for migration 007 so the sequence test does not depend on the
// real Brentwood export.
const SCHEDULE = JSON.stringify([
  {
    date: '2025-01-05T00:00:00.000Z',
    serviceType: 'Sunday Service',
    songs: [
      { type: 'orchestra1', number: 'a10' },
      { type: 'choir1', number: 'N/A' },
    ],
  },
]);

// Data files the migrations read, keyed by file-name suffix. Everything else
// passes through to the real fs module.
// `var` + function declaration: jest.mock is hoisted above the imports, and fs
// may be called while modules load, before a `const` would be initialised.
// eslint-disable-next-line no-var
var mockFiles: Record<string, string> | undefined;
function mockFakeFor(p: unknown): string | undefined {
  if (!mockFiles) return undefined;
  const files = mockFiles;
  const key = Object.keys(files).find((suffix) => String(p).endsWith(suffix));
  return key === undefined ? undefined : files[key];
}

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: (p: any) => (mockFakeFor(p) !== undefined ? true : actual.existsSync(p)),
    readFileSync: (p: any, ...rest: any[]) => mockFakeFor(p) ?? actual.readFileSync(p, ...rest),
  };
});

function mockCsv(content: string): void {
  mockFiles = {
    'repertoir.csv': content,
    'brentwood-schedule-latest.json': SCHEDULE,
  };
}

/**
 * The real migrations target Postgres. Rewrite the few Postgres-only constructs
 * so the same migration files can run on the SQLite test database.
 */
function enableSqliteCompat(): void {
  const original = testSequelize.query.bind(testSequelize) as any;
  jest.spyOn(testSequelize, 'query').mockImplementation(((sql: any, options?: any) => {
    if (typeof sql === 'string') {
      sql = sql
        .replace(/ DEFAULT gen_random_uuid\(\)/g, '')
        .replace(/DEFAULT NOW\(\)/g, 'DEFAULT CURRENT_TIMESTAMP')
        .replace(
          /^ALTER TABLE (\w+) ADD CONSTRAINT (\w+) UNIQUE \(([^)]+)\)$/,
          'CREATE UNIQUE INDEX $2 ON $1 ($3)',
        );
    }
    return original(sql, options);
  }) as any);
}

async function createSongsTable(): Promise<void> {
  await qi.createTable('songs', {
    id: { type: DataTypes.STRING, primaryKey: true },
    number: { type: DataTypes.STRING(20), allowNull: false },
    hymnal: { type: DataTypes.STRING(10), allowNull: false },
  });
}

async function insertSongs(numbers: string[]): Promise<void> {
  for (const n of numbers) {
    await testSequelize.query('INSERT INTO songs (id, number, hymnal) VALUES (:id, :n, :h)', {
      replacements: { id: `id-${n}`, n, h: n.replace(/\d+/g, '') },
    });
  }
}

async function names(): Promise<Record<string, string | null>> {
  const rows = await testSequelize.query<{ number: string; name: string | null }>(
    'SELECT number, name FROM songs',
    { type: QueryTypes.SELECT },
  );
  return Object.fromEntries(rows.map((r) => [r.number, r.name]));
}

beforeAll(() => bindTestModels());
beforeEach(async () => {
  await qi.dropAllTables();
});
afterEach(() => {
  jest.restoreAllMocks();
});
afterAll(teardownTestDb);

describe('migration 008 — add song name', () => {
  beforeEach(async () => {
    await createSongsTable();
    await insertSongs(['A1', 'a10', 'E7', 'A5']);
    mockCsv(CSV);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('up adds a nullable name column', async () => {
    await m008.up(ctx);
    const table = await qi.describeTable('songs');
    expect(table['name']).toBeDefined();
    expect(table['name'].allowNull).toBe(true);
  });

  it('up backfills trimmed names, matching song numbers case-insensitively', async () => {
    await m008.up(ctx);
    const result = await names();
    expect(result['A1']).toBe('Almagtig is ons God');
    expect(result['a10']).toBe('Grote God'); // stored lower-case, CSV upper-case
    expect(result['E7']).toBe('Great God');
  });

  it('leaves the name null when the CSV name is blank', async () => {
    await m008.up(ctx);
    expect((await names())['A5']).toBeNull();
  });

  it('warns about and skips CSV rows with no matching song', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await m008.up(ctx);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('A99'));
    const rows = await testSequelize.query('SELECT 1 FROM songs WHERE UPPER(number) = :n', {
      replacements: { n: 'A99' },
      type: QueryTypes.SELECT,
    });
    expect(rows).toHaveLength(0);
  });

  it('a second up run does not error and keeps the names unchanged', async () => {
    await m008.up(ctx);
    const first = await names();
    await expect(m008.up(ctx)).resolves.toBeUndefined();
    expect(await names()).toEqual(first);
  });

  it('down removes the name column', async () => {
    await m008.up(ctx);
    await m008.down(ctx);
    const table = await qi.describeTable('songs');
    expect(table['name']).toBeUndefined();
    expect(table['number']).toBeDefined();
  });
});

describe('migrations 001–008 on a fresh SQLite database', () => {
  it('run in sequence while Song declares name', async () => {
    enableSqliteCompat();
    mockCsv(CSV);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    for (const migration of [m001, m002, m003, m004, m005, m006, m007, m008]) {
      await migration.up(ctx);
    }

    const table = await qi.describeTable('songs');
    expect(table['name']).toBeDefined();

    const result = await names();
    expect(result['A1']).toBe('Almagtig is ons God');
    expect(result['A10']).toBe('Grote God');
    expect(result['E7']).toBe('Great God');
    expect(result['A5']).toBeNull();
  });
});
