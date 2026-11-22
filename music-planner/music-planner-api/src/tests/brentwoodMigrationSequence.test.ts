import { QueryTypes } from 'sequelize';
import { testSequelize, bindTestModels, teardownTestDb } from './testDb';
import * as m001 from '../db/migrations/001-create-congregations';
import * as m002 from '../db/migrations/002-create-songs';
import * as m003 from '../db/migrations/003-create-slot-templates';
import * as m004 from '../db/migrations/004-create-services';
import * as m005 from '../db/migrations/005-create-service-slots';
import * as m006 from '../db/migrations/006-load-song-repertoire';
import * as m007 from '../db/migrations/007-import-brentwood-schedule';
import * as m008 from '../db/migrations/008-add-song-name';
import * as m009 from '../db/migrations/009-reimport-brentwood-schedule';

const qi = testSequelize.getQueryInterface();
const ctx = { context: qi };

const CSV = [
  'Hymnal|Number|Name|TranslationNumber_HymnalE',
  'A|A1|Almagtig is ons God|',
  'A|A10|Grote God|E7',
  'E|E7|Great God|',
].join('\n');

const SCHEDULE = JSON.stringify([
  {
    date: '2025-01-05T00:00:00.000Z',
    serviceType: 'Sunday Service',
    songs: [
      { type: 'orchestra1', number: 'a10' },
      { type: 'choir1', number: 'N/A' },
      { type: 'congregationBS', number: 'E7' },
    ],
  },
  {
    date: '2025-01-12T10:00:00.000Z',
    serviceType: 'Sunday Service',
    songs: [
      { type: 'orchestra1', number: 'A1' },
      { type: 'orchestra2', number: 'Z999' },
      { type: 'notASlot', number: 'A1' },
    ],
  },
]);

// `var` + function declaration: jest.mock is hoisted above the imports.
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

/** Rewrites the Postgres-only constructs so the real migrations run on SQLite. */
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

beforeAll(() => bindTestModels());
beforeEach(async () => {
  await qi.dropAllTables();
});
afterEach(() => {
  jest.restoreAllMocks();
});
afterAll(teardownTestDb);

describe('migrations 001–009 on a fresh SQLite database', () => {
  it('leave Brentwood Park services and slots matching the schedule', async () => {
    enableSqliteCompat();
    mockCsv(CSV);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    for (const migration of [m001, m002, m003, m004, m005, m006, m007, m008, m009]) {
      await migration.up(ctx);
    }

    const services = await testSequelize.query<{ service_date: string; service_type: string }>(
      `SELECT s.service_date, s.service_type
         FROM services s JOIN congregations c ON c.id = s.congregation_id
        WHERE c.name = 'Brentwood Park'
        ORDER BY s.service_date`,
      { type: QueryTypes.SELECT },
    );
    expect(services.map((s) => [String(s.service_date).substring(0, 10), s.service_type])).toEqual([
      ['2025-01-05', 'Sunday Service'],
      ['2025-01-12', 'Sunday Service'],
    ]);

    const slots = await testSequelize.query<{
      service_date: string;
      slot_key: string;
      song_number: string | null;
    }>(
      `SELECT s.service_date, t.slot_key, so.number AS song_number
         FROM service_slots ss
         JOIN services s ON s.id = ss.service_id
         JOIN congregations c ON c.id = s.congregation_id
         JOIN slot_templates t ON t.id = ss.slot_template_id
         LEFT JOIN songs so ON so.id = ss.song_id
        WHERE c.name = 'Brentwood Park'
        ORDER BY s.service_date, t.slot_key`,
      { type: QueryTypes.SELECT },
    );
    expect(
      slots.map((r) => [String(r.service_date).substring(0, 10), r.slot_key, r.song_number]),
    ).toEqual([
      ['2025-01-05', 'choir1', null],
      ['2025-01-05', 'congregationBS', 'E7'],
      ['2025-01-05', 'orchestra1', 'A10'],
      ['2025-01-12', 'orchestra1', 'A1'],
      ['2025-01-12', 'orchestra2', null],
    ]);
  });
});
