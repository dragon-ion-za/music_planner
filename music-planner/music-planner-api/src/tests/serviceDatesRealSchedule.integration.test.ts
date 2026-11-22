/**
 * Integration check (spec service-date-off-by-one, task 3.5) against the REAL
 * .data/brentwood-schedule-latest.json on a throwaway in-memory SQLite database.
 * Only the repertoire CSV is mocked.
 */
import { QueryTypes } from 'sequelize';
import * as fs from 'fs';
import { testSequelize, bindTestModels, setupTestDb, teardownTestDb } from './testDb';
import { Congregation } from '../models/Congregation';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { SlotTemplate } from '../models/SlotTemplate';
import { parseDate, readSchedule, resolveScheduleFile } from '../db/importers/brentwoodSchedule';
import * as m001 from '../db/migrations/001-create-congregations';
import * as m002 from '../db/migrations/002-create-songs';
import * as m003 from '../db/migrations/003-create-slot-templates';
import * as m004 from '../db/migrations/004-create-services';
import * as m005 from '../db/migrations/005-create-service-slots';
import * as m006 from '../db/migrations/006-load-song-repertoire';
import * as m007 from '../db/migrations/007-import-brentwood-schedule';
import * as m008 from '../db/migrations/008-add-song-name';
import * as m009 from '../db/migrations/009-reimport-brentwood-schedule';
import * as m010 from '../db/migrations/010-correct-service-dates';

const qi = testSequelize.getQueryInterface();
const ctx = { context: qi };

const CSV = [
  'Hymnal|Number|Name|TranslationNumber_HymnalE',
  'A|A1|Almagtig is ons God|',
  'A|A10|Grote God|E7',
  'E|E7|Great God|',
].join('\n');

// `var`: jest.mock is hoisted above the imports. Only the CSV is faked;
// the schedule file is read from disk.
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

// Read the real file with the real fs (bypassing the mock, which has no entry for it).
const realSchedule = JSON.parse(
  (jest.requireActual('fs') as typeof fs).readFileSync(
    require('path').resolve(__dirname, '../../../.data/brentwood-schedule-latest.json'),
    'utf-8',
  ),
) as Array<{ date: string; serviceType: string }>;

const keyOf = (date: string, type: string) => `${date}|${type}`;
const distinct = (keys: string[]) => [...new Set(keys)];

const correctKeys = distinct(realSchedule.map((e) => keyOf(parseDate(e.date), e.serviceType)));
const faultyKeys = distinct(realSchedule.map((e) => keyOf(e.date.substring(0, 10), e.serviceType)));
const shiftedEntries = realSchedule.filter((e) => e.date.substring(0, 10) !== parseDate(e.date));

function weekday(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

let logSpy: jest.SpyInstance;

beforeAll(() => bindTestModels());
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  mockFiles = undefined;
});
afterAll(teardownTestDb);

describe('real schedule file: sanity', () => {
  it('has the expected shape (207 distinct services, 204 shifted by the fix)', () => {
    expect(resolveScheduleFile()).toMatch(/brentwood-schedule-latest\.json$/);
    expect(readSchedule(resolveScheduleFile()).length).toBe(realSchedule.length);
    expect(correctKeys.length).toBe(207);
    expect(faultyKeys.length).toBe(207);
    expect(shiftedEntries.length).toBe(204);
  });
});

describe('fresh database: 001-009 then 010', () => {
  it('imports every service on its correct date and 010 moves nothing', async () => {
    await qi.dropAllTables();
    enableSqliteCompat();
    mockFiles = { 'repertoir.csv': CSV };

    for (const m of [m001, m002, m003, m004, m005, m006, m007, m008, m009]) {
      await m.up(ctx);
    }

    const rows = await testSequelize.query<{ service_date: string; service_type: string }>(
      `SELECT s.service_date, s.service_type
         FROM services s JOIN congregations c ON c.id = s.congregation_id
        WHERE c.name = 'Brentwood Park'`,
      { type: QueryTypes.SELECT },
    );
    const before = rows.map((r) => keyOf(String(r.service_date).substring(0, 10), r.service_type));
    expect(before.length).toBe(207);
    expect([...before].sort()).toEqual([...correctKeys].sort());

    const sundays = rows.filter((r) => r.service_type === 'Sunday Service');
    expect(sundays.length).toBeGreaterThan(0);
    const notSunday = sundays.filter((r) => weekday(String(r.service_date).substring(0, 10)) !== 0);
    expect(notSunday.map((r) => r.service_date)).toEqual([]);

    logSpy.mockClear();
    await m010.up(ctx);

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^Service dates: 0 moved, 204 not found, 0 skipped\./));
    const after = await testSequelize.query<{ service_date: string; service_type: string }>(
      `SELECT service_date, service_type FROM services`,
      { type: QueryTypes.SELECT },
    );
    expect(after.map((r) => keyOf(String(r.service_date).substring(0, 10), r.service_type)).sort()).toEqual(
      [...before].sort(),
    );
  });
});

describe('simulated existing database with faulty dates', () => {
  it('moves 204 services, leaves 3, and keeps service and slot counts', async () => {
    await setupTestDb();
    const congregation = await Congregation.create({
      name: 'Brentwood Park',
      timezone: 'Africa/Johannesburg',
    });
    const types = distinct(realSchedule.map((e) => e.serviceType));
    const templates = new Map<string, string>();
    for (const t of types) {
      const tpl = await SlotTemplate.create({
        congregationId: congregation.id,
        serviceType: t,
        slotKey: 'orchestra1',
        displayOrder: 1,
        category: 'orchestra',
      });
      templates.set(t, tpl.id);
    }

    // Old importer behaviour: date.substring(0, 10), one slot per service.
    for (const key of faultyKeys) {
      const [date, type] = key.split('|');
      const service = await Service.create({
        congregationId: congregation.id,
        serviceDate: date,
        serviceType: type,
      });
      await ServiceSlot.create({
        serviceId: service.id,
        slotTemplateId: templates.get(type)!,
        songId: null,
      });
    }
    expect(await Service.count()).toBe(207);
    expect(await ServiceSlot.count()).toBe(207);
    const idsBefore = new Map(
      (await Service.findAll()).map((s) => [keyOf(s.serviceDate as unknown as string, s.serviceType), s.id]),
    );

    logSpy.mockClear();
    await m010.up(ctx);

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^Service dates: 204 moved, 0 not found, 0 skipped\./));
    expect(await Service.count()).toBe(207);
    expect(await ServiceSlot.count()).toBe(207);

    const now = await Service.findAll();
    expect(now.map((s) => keyOf(s.serviceDate as unknown as string, s.serviceType)).sort()).toEqual(
      [...correctKeys].sort(),
    );

    // Count moved vs unchanged by comparing each id's date before and after.
    const faultyById = new Map([...idsBefore].map(([k, id]) => [id, k.split('|')[0]]));
    const moved = now.filter((s) => (s.serviceDate as unknown as string) !== faultyById.get(s.id));
    expect(moved.length).toBe(204);
    expect(now.length - moved.length).toBe(3);

    // Each service kept its id and its single slot.
    for (const s of now) {
      expect(await ServiceSlot.count({ where: { serviceId: s.id } })).toBe(1);
    }

    const sundayNotSunday = now.filter(
      (s) => s.serviceType === 'Sunday Service' && weekday(s.serviceDate as unknown as string) !== 0,
    );
    expect(sundayNotSunday.map((s) => s.serviceDate)).toEqual([]);
  });
});
