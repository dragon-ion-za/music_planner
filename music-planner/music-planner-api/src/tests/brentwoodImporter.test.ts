import { setupTestDb, teardownTestDb } from './testDb';
import { Congregation } from '../models/Congregation';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { Song } from '../models/Song';
import {
  importSchedule,
  readSchedule,
  resolveScheduleFile,
  seedBrentwoodCongregation,
  ScheduleEntry,
} from '../db/importers/brentwoodSchedule';

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

const SCHEDULE_FILE = 'brentwood-schedule-latest.json';

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  mockFiles = undefined;
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  mockFiles = undefined;
});
afterAll(teardownTestDb);

describe('resolveScheduleFile', () => {
  it('lists both searched paths when the file is missing', () => {
    // Nothing mocked: the real fs has no such file at either candidate path
    // unless the real data file exists, so force a miss with a path-sensitive mock.
    const fs = require('fs');
    const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    try {
      expect(() => resolveScheduleFile()).toThrow(/not found/);
      let message = '';
      try {
        resolveScheduleFile();
      } catch (e) {
        message = (e as Error).message;
      }
      const paths = message.split('\n').slice(1).map((l) => l.trim());
      expect(paths).toHaveLength(2);
      for (const p of paths) {
        expect(p.replace(/\\/g, '/')).toMatch(/\.data\/brentwood-schedule-latest\.json$/);
      }
      expect(paths[0]).not.toEqual(paths[1]);
    } finally {
      spy.mockRestore();
    }
  });

  it('returns the path when the file exists', () => {
    mockFiles = { [SCHEDULE_FILE]: '[]' };
    expect(resolveScheduleFile()).toMatch(/brentwood-schedule-latest\.json$/);
  });
});

describe('readSchedule', () => {
  it('rejects invalid JSON', () => {
    mockFiles = { [SCHEDULE_FILE]: '{ not json' };
    expect(() => readSchedule('/x/brentwood-schedule-latest.json')).toThrow(/Failed to parse/);
  });

  it('rejects a JSON value that is not an array', () => {
    mockFiles = { [SCHEDULE_FILE]: '{"date":"2025-01-05"}' };
    expect(() => readSchedule('/x/brentwood-schedule-latest.json')).toThrow(/JSON array/);
  });

  it('returns the parsed array', () => {
    mockFiles = { [SCHEDULE_FILE]: '[{"date":"2025-01-05","serviceType":"S","songs":[]}]' };
    expect(readSchedule('/x/brentwood-schedule-latest.json')).toHaveLength(1);
  });
});

describe('importSchedule', () => {
  let congregationId: string;

  beforeEach(async () => {
    await setupTestDb();
    await Song.create({ number: 'A10', hymnal: 'A' } as any);
    congregationId = await seedBrentwoodCongregation();
    logSpy.mockClear();
  });

  async function slots() {
    return ServiceSlot.findAll();
  }

  it('stores a null songId for an empty song value', async () => {
    const schedule: ScheduleEntry[] = [
      { date: '2025-01-05T00:00:00.000Z', serviceType: 'Sunday Service', songs: [{ type: 'choir1', number: 'N/A' }] },
    ];
    await importSchedule(congregationId, schedule);
    const all = await slots();
    expect(all).toHaveLength(1);
    expect(all[0].songId).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('stores a null songId for unknown numbers and warns once with each distinct number', async () => {
    const schedule: ScheduleEntry[] = [
      {
        date: '2025-01-05T00:00:00.000Z',
        serviceType: 'Sunday Service',
        songs: [
          { type: 'orchestra1', number: 'x99' },
          { type: 'orchestra2', number: 'X99' },
          { type: 'orchestra3', number: 'Z5' },
          { type: 'orchestra4', number: 'A10' },
        ],
      },
    ];
    await importSchedule(congregationId, schedule);
    const all = await slots();
    expect(all).toHaveLength(4);
    expect(all.filter((s) => s.songId === null)).toHaveLength(3);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = String(warnSpy.mock.calls[0][0]);
    expect(msg).toContain('X99, Z5');
    expect(msg.match(/X99/g)).toHaveLength(1);
  });

  it('skips an unknown slot key and warns with key, date and service type', async () => {
    const schedule: ScheduleEntry[] = [
      { date: '2025-01-05T00:00:00.000Z', serviceType: 'Sunday Service', songs: [{ type: 'bogus9', number: 'A10' }] },
    ];
    const summary = await importSchedule(congregationId, schedule);
    expect(await slots()).toHaveLength(0);
    expect(summary.slots).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = String(warnSpy.mock.calls[0][0]);
    expect(msg).toContain('bogus9');
    expect(msg).toContain('2025-01-05');
    expect(msg).toContain('Sunday Service');
  });

  it('logs and returns services, slots and no-song counts', async () => {
    const schedule: ScheduleEntry[] = [
      {
        date: '2025-01-05T00:00:00.000Z',
        serviceType: 'Sunday Service',
        songs: [
          { type: 'orchestra1', number: 'A10' },
          { type: 'orchestra2', number: 'N/A' },
          { type: 'orchestra3', number: 'Q1' },
        ],
      },
      { date: '2025-01-12T00:00:00.000Z', serviceType: 'Sunday Service', songs: [{ type: 'choir1', number: 'a10' }] },
    ];
    const summary = await importSchedule(congregationId, schedule);
    expect(summary).toEqual({ services: 2, slots: 4, slotsWithoutSong: 2 });
    expect(logSpy).toHaveBeenCalledWith(
      'Imported 2 services and 4 service slots (2 slots with no song).',
    );
    expect(await Service.count({ where: { congregationId } })).toBe(2);
    expect(await Congregation.count()).toBe(1);
  });
});
