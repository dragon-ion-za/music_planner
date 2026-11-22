import { QueryTypes } from 'sequelize';
import { testSequelize, setupTestDb, teardownTestDb } from './testDb';
import { Congregation } from '../models/Congregation';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import * as m007 from '../db/migrations/007-import-brentwood-schedule';
import * as m009 from '../db/migrations/009-reimport-brentwood-schedule';

const ctx = { context: testSequelize.getQueryInterface() };

// Data files the migration reads, keyed by file-name suffix. Everything else
// passes through to the real fs module.
// `var` + function declaration: jest.mock is hoisted above the imports, and fs
// may be called while modules load, before a `const` would be initialised.
// eslint-disable-next-line no-var
var mockFiles: Record<string, string> | undefined;
// When true, the schedule file is reported as missing even if it exists on disk.
// eslint-disable-next-line no-var
var mockHideSchedule: boolean | undefined;
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
    existsSync: (p: any) => {
      if (mockHideSchedule && String(p).endsWith('brentwood-schedule-latest.json')) return false;
      return mockFakeFor(p) !== undefined ? true : actual.existsSync(p);
    },
    readFileSync: (p: any, ...rest: any[]) => mockFakeFor(p) ?? actual.readFileSync(p, ...rest),
  };
});

function mockSchedule(schedule: unknown): void {
  mockFiles = { 'brentwood-schedule-latest.json': JSON.stringify(schedule) };
}

const SCHEDULE = [
  {
    date: '2025-01-05T00:00:00.000Z',
    serviceType: 'Sunday Service',
    songs: [
      { type: 'orchestra1', number: 'a10' },
      { type: 'choir1', number: 'N/A' },
    ],
  },
  {
    date: '2025-01-12T00:00:00.000Z',
    serviceType: 'Sunday Service',
    songs: [{ type: 'orchestra1', number: ' E7 ' }],
  },
];

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

async function rows<T extends object = any>(table: string): Promise<T[]> {
  return testSequelize.query<T>(`SELECT * FROM ${table} ORDER BY id`, { type: QueryTypes.SELECT });
}

async function brentwood(): Promise<Congregation | null> {
  return Congregation.findOne({ where: { name: 'Brentwood Park' } });
}

/** Services of a congregation as `date|type -> { slotKey: songNumber|null }`. */
async function servicesOf(congregationId: string): Promise<Record<string, Record<string, string | null>>> {
  const services = await Service.findAll({ where: { congregationId } });
  const out: Record<string, Record<string, string | null>> = {};
  for (const s of services) {
    const slots = await ServiceSlot.findAll({ where: { serviceId: s.id } });
    const entry: Record<string, string | null> = {};
    for (const slot of slots) {
      const tpl = await SlotTemplate.findByPk(slot.slotTemplateId);
      const song = slot.songId ? await Song.findByPk(slot.songId) : null;
      entry[tpl!.slotKey] = song ? song.number : null;
    }
    out[`${s.serviceDate}|${s.serviceType}`] = entry;
  }
  return out;
}

beforeEach(async () => {
  await setupTestDb();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await Song.create({ number: 'A10', hymnal: 'A', name: 'Grote God' } as any);
  await Song.create({ number: 'E7', hymnal: 'E', name: 'Great God' } as any);
  mockSchedule(SCHEDULE);
});

afterEach(() => {
  jest.restoreAllMocks();
  mockFiles = undefined;
  mockHideSchedule = undefined;
});

afterAll(teardownTestDb);

describe('migration 009 up', () => {
  it('creates the congregation, 14 slot templates and the services on a fresh database', async () => {
    expect(await brentwood()).toBeNull();

    await m009.up(ctx);

    const congregation = await brentwood();
    expect(congregation).not.toBeNull();
    expect(await SlotTemplate.count({ where: { congregationId: congregation!.id } })).toBe(14);
    expect(await servicesOf(congregation!.id)).toEqual({
      '2025-01-05|Sunday Service': { orchestra1: 'A10', choir1: null },
      '2025-01-12|Sunday Service': { orchestra1: 'E7' },
    });
  });

  it('imports into an existing congregation that has no services', async () => {
    const existing = await Congregation.create({ name: 'Brentwood Park', timezone: 'Africa/Johannesburg' });

    await expect(m009.up(ctx)).resolves.toBeUndefined();

    expect(await Congregation.count({ where: { name: 'Brentwood Park' } })).toBe(1);
    expect(Object.keys(await servicesOf(existing.id))).toHaveLength(2);
  });

  it('removes prior services that differ from the file and logs the deleted count', async () => {
    await m009.up(ctx);
    const congregation = (await brentwood())!;
    const tpl = (await SlotTemplate.findOne({ where: { congregationId: congregation.id, slotKey: 'choir2' } }))!;
    const song = (await Song.findOne({ where: { number: 'A10' } }))!;
    for (const date of ['2024-03-03', '2024-03-10', '2025-01-05']) {
      const old = await Service.create({
        congregationId: congregation.id,
        serviceDate: date,
        serviceType: 'Evening Service',
      });
      await ServiceSlot.create({ serviceId: old.id, slotTemplateId: tpl.id, songId: song.id });
    }
    const priorServices = await Service.count({ where: { congregationId: congregation.id } });
    expect(priorServices).toBe(5);
    logSpy.mockClear();

    await m009.up(ctx);

    expect(await servicesOf(congregation.id)).toEqual({
      '2025-01-05|Sunday Service': { orchestra1: 'A10', choir1: null },
      '2025-01-12|Sunday Service': { orchestra1: 'E7' },
    });
    // No orphaned slots from the removed services.
    expect(await ServiceSlot.count()).toBe(3);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed 5 existing services'));
  });

  it('creates exactly one service per distinct date and service type', async () => {
    mockSchedule([
      { date: '2025-02-02T00:00:00.000Z', serviceType: 'Sunday Service', songs: [{ type: 'orchestra1', number: 'A10' }] },
      { date: '2025-02-02T10:00:00.000Z', serviceType: 'Sunday Service', songs: [{ type: 'orchestra2', number: 'E7' }] },
      { date: '2025-02-02T00:00:00.000Z', serviceType: 'Evening Service', songs: [] },
    ]);

    await m009.up(ctx);

    const congregation = (await brentwood())!;
    expect(await Service.count({ where: { congregationId: congregation.id } })).toBe(2);
    const sunday = await Service.findOne({
      where: { congregationId: congregation.id, serviceType: 'Sunday Service' },
    });
    expect(await ServiceSlot.count({ where: { serviceId: sunday!.id } })).toBeGreaterThan(0);
  });

  it('leaves another congregation and the songs table unchanged', async () => {
    const other = await Congregation.create({ name: 'Other Church', timezone: 'UTC' });
    const tpl = await SlotTemplate.create({
      congregationId: other.id,
      serviceType: 'Sunday Service',
      slotKey: 'orchestra1',
      displayOrder: 1,
      category: 'orchestra',
    });
    const song = (await Song.findOne({ where: { number: 'A10' } }))!;
    const svc = await Service.create({
      congregationId: other.id,
      serviceDate: '2025-01-05',
      serviceType: 'Sunday Service',
    });
    await ServiceSlot.create({ serviceId: svc.id, slotTemplateId: tpl.id, songId: song.id });

    const before = {
      songs: await rows('songs'),
      congregations: (await rows<any>('congregations')).filter((c) => c.id === other.id),
      templates: (await rows<any>('slot_templates')).filter((t) => t.congregation_id === other.id),
      services: (await rows<any>('services')).filter((s) => s.congregation_id === other.id),
      slots: (await rows<any>('service_slots')).filter((s) => s.service_id === svc.id),
    };

    await m009.up(ctx);

    expect(await rows('songs')).toEqual(before.songs);
    expect((await rows<any>('congregations')).filter((c) => c.id === other.id)).toEqual(before.congregations);
    expect((await rows<any>('slot_templates')).filter((t) => t.congregation_id === other.id)).toEqual(before.templates);
    expect((await rows<any>('services')).filter((s) => s.congregation_id === other.id)).toEqual(before.services);
    expect((await rows<any>('service_slots')).filter((s) => s.service_id === svc.id)).toEqual(before.slots);
  });

  it('stores an empty song value as a slot with no song', async () => {
    mockSchedule([
      {
        date: '2025-03-02T00:00:00.000Z',
        serviceType: 'Sunday Service',
        songs: [
          { type: 'choir1', number: '' },
          { type: 'choir2', number: 'n/a' },
        ],
      },
    ]);

    await m009.up(ctx);

    const congregation = (await brentwood())!;
    expect(await servicesOf(congregation.id)).toEqual({
      '2025-03-02|Sunday Service': { choir1: null, choir2: null },
    });
  });

  it('stores an unknown song number as no song and warns once with distinct numbers', async () => {
    mockSchedule([
      {
        date: '2025-03-02T00:00:00.000Z',
        serviceType: 'Sunday Service',
        songs: [
          { type: 'choir1', number: 'Z99' },
          { type: 'choir2', number: 'z99' },
          { type: 'choir3', number: 'Y1' },
          { type: 'orchestra1', number: 'A10' },
        ],
      },
    ]);

    await m009.up(ctx);

    const congregation = (await brentwood())!;
    expect(await servicesOf(congregation.id)).toEqual({
      '2025-03-02|Sunday Service': { choir1: null, choir2: null, choir3: null, orchestra1: 'A10' },
    });
    const unknownWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('not found in repertoire'));
    expect(unknownWarnings).toHaveLength(1);
    expect(unknownWarnings[0][0]).toContain('Y1, Z99');
  });

  it('skips an unknown slot key and warns with the key, date and service type', async () => {
    mockSchedule([
      {
        date: '2025-03-02T00:00:00.000Z',
        serviceType: 'Sunday Service',
        songs: [
          { type: 'bogus9', number: 'A10' },
          { type: 'orchestra1', number: 'A10' },
        ],
      },
    ]);

    await m009.up(ctx);

    const congregation = (await brentwood())!;
    expect(await servicesOf(congregation.id)).toEqual({
      '2025-03-02|Sunday Service': { orchestra1: 'A10' },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/bogus9.*2025-03-02.*Sunday Service/),
    );
  });
});

describe('migration 009 transaction wiring', () => {
  // The shared in-memory SQLite connection hides a missing `transaction` in a
  // rollback test, so check the options of every model call directly.
  it('passes a transaction to every model call made by up', async () => {
    const spies = {
      'Congregation.upsert': jest.spyOn(Congregation, 'upsert'),
      'Congregation.findOne': jest.spyOn(Congregation, 'findOne'),
      'SlotTemplate.upsert': jest.spyOn(SlotTemplate, 'upsert'),
      'SlotTemplate.findAll': jest.spyOn(SlotTemplate, 'findAll'),
      'Song.findAll': jest.spyOn(Song, 'findAll'),
      'Service.destroy': jest.spyOn(Service, 'destroy'),
      'Service.upsert': jest.spyOn(Service, 'upsert'),
      'Service.findOne': jest.spyOn(Service, 'findOne'),
      'ServiceSlot.upsert': jest.spyOn(ServiceSlot, 'upsert'),
    };

    await m009.up(ctx);

    for (const [name, spy] of Object.entries(spies)) {
      expect({ name, called: spy.mock.calls.length > 0 }).toEqual({ name, called: true });
      for (const call of spy.mock.calls) {
        const options = (call as unknown[]).find(
          (arg) => arg && typeof arg === 'object' && 'transaction' in (arg as object),
        ) as { transaction?: unknown } | undefined;
        expect({ name, hasTransaction: !!options?.transaction }).toEqual({ name, hasTransaction: true });
      }
    }
  });
});

describe('migration 009 pre-flight failures', () => {
  let priorServices: Record<string, Record<string, string | null>>;
  let congregationId: string;
  let transactionSpy: jest.SpyInstance;

  beforeEach(async () => {
    await m009.up(ctx);
    congregationId = (await brentwood())!.id;
    priorServices = await servicesOf(congregationId);
    expect(Object.keys(priorServices)).toHaveLength(2);
    transactionSpy = jest.spyOn(testSequelize, 'transaction');
  });

  async function expectUntouched(): Promise<void> {
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(await servicesOf(congregationId)).toEqual(priorServices);
  }

  it('rejects naming both searched paths when the schedule file is missing', async () => {
    mockFiles = undefined;
    mockHideSchedule = true;

    let message = '';
    await m009.up(ctx).catch((e: Error) => { message = e.message; });

    expect(message).toContain('not found');
    const searched = message.split('\n').filter((l) => l.trim().endsWith('brentwood-schedule-latest.json') && l.includes('.data'));
    expect(searched).toHaveLength(2);
    expect(new Set(searched).size).toBe(2);
    await expectUntouched();
  });

  it('rejects when the file is not valid JSON', async () => {
    mockFiles = { 'brentwood-schedule-latest.json': '{ not json' };

    await expect(m009.up(ctx)).rejects.toThrow();

    await expectUntouched();
  });

  it.each([['an object', '{"a":1}'], ['a string', '"text"'], ['null', 'null']])(
    'rejects when the JSON value is %s rather than an array',
    async (_label, json) => {
      mockFiles = { 'brentwood-schedule-latest.json': json };

      await expect(m009.up(ctx)).rejects.toThrow();

      await expectUntouched();
    },
  );
});

describe('migration 007', () => {
  it('up on an empty database creates the congregation, slot templates, services and slots; down removes the services', async () => {
    expect(await brentwood()).toBeNull();

    await m007.up(ctx);

    const congregation = (await brentwood())!;
    expect(congregation).not.toBeNull();
    expect(await SlotTemplate.count({ where: { congregationId: congregation.id } })).toBe(14);
    expect(await Service.count({ where: { congregationId: congregation.id } })).toBe(2);
    expect(await servicesOf(congregation.id)).toEqual({
      '2025-01-05|Sunday Service': { orchestra1: 'A10', choir1: null },
      '2025-01-12|Sunday Service': { orchestra1: 'E7' },
    });

    await m007.down(ctx);

    expect(await Service.count({ where: { congregationId: congregation.id } })).toBe(0);
    expect(await ServiceSlot.count()).toBe(0);
  });
});

describe('migration 009 down', () => {
  it('deletes the services and slots but keeps the congregation, templates, other congregations and songs', async () => {
    await m009.up(ctx);
    const congregation = (await brentwood())!;

    const other = await Congregation.create({ name: 'Other Church', timezone: 'UTC' });
    const otherTpl = await SlotTemplate.create({
      congregationId: other.id,
      serviceType: 'Sunday Service',
      slotKey: 'orchestra1',
      displayOrder: 1,
      category: 'orchestra',
    });
    const song = (await Song.findOne({ where: { number: 'A10' } }))!;
    const otherSvc = await Service.create({
      congregationId: other.id,
      serviceDate: '2025-01-05',
      serviceType: 'Sunday Service',
    });
    await ServiceSlot.create({ serviceId: otherSvc.id, slotTemplateId: otherTpl.id, songId: song.id });

    const songsBefore = await rows('songs');
    const templatesBefore = await SlotTemplate.count({ where: { congregationId: congregation.id } });
    expect(await Service.count({ where: { congregationId: congregation.id } })).toBe(2);

    await m009.down(ctx);

    expect(await Service.count({ where: { congregationId: congregation.id } })).toBe(0);
    expect(await ServiceSlot.count()).toBe(1); // only the other congregation's slot remains
    expect(await brentwood()).not.toBeNull();
    expect(await SlotTemplate.count({ where: { congregationId: congregation.id } })).toBe(templatesBefore);
    expect(await Congregation.findByPk(other.id)).not.toBeNull();
    expect(await Service.count({ where: { congregationId: other.id } })).toBe(1);
    expect(await SlotTemplate.count({ where: { congregationId: other.id } })).toBe(1);
    expect(await rows('songs')).toEqual(songsBefore);
  });

  it('logs that there is nothing to roll back when the congregation does not exist', async () => {
    expect(await brentwood()).toBeNull();

    await expect(m009.down(ctx)).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('nothing to roll back'));
  });
});
