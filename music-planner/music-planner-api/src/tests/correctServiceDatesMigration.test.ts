import { testSequelize, setupTestDb, teardownTestDb } from './testDb';
import { Congregation } from '../models/Congregation';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { SlotTemplate } from '../models/SlotTemplate';
import * as m010 from '../db/migrations/010-correct-service-dates';

const ctx = { context: testSequelize.getQueryInterface() };

// `var`: jest.mock is hoisted above the imports (see brentwoodReimportMigration.test.ts).
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

const SCHEDULE = [
  // Affected: stored on the UTC date, belongs on the next day.
  { date: '2025-01-04T22:00:00.000Z', serviceType: 'Sunday Service', songs: [] },
  // Affected, but the target date is already taken (collision).
  { date: '2025-01-11T22:00:00.000Z', serviceType: 'Sunday Service', songs: [] },
  // Affected, but no service stored at the faulty date.
  { date: '2025-01-14T22:00:00.000Z', serviceType: 'Midweek Service', songs: [] },
  // Not affected.
  { date: '2025-01-19T00:00:00.000Z', serviceType: 'Sunday Service', songs: [] },
];

let congregationId: string;
let slotTemplateId: string;
let warnSpy: jest.SpyInstance;

async function addService(date: string, type: string, withSlot = false): Promise<Service> {
  const service = await Service.create({ congregationId, serviceDate: date, serviceType: type });
  if (withSlot) {
    await ServiceSlot.create({ serviceId: service.id, slotTemplateId, songId: null });
  }
  return service;
}

async function stored(): Promise<string[]> {
  const services = await Service.findAll({ where: { congregationId } });
  return services.map((s) => `${s.serviceDate}|${s.serviceType}`).sort();
}

beforeEach(async () => {
  await setupTestDb();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  mockFiles = { 'brentwood-schedule-latest.json': JSON.stringify(SCHEDULE) };

  const congregation = await Congregation.create({ name: 'Brentwood Park', timezone: 'Africa/Johannesburg' });
  congregationId = congregation.id;
  const template = await SlotTemplate.create({
    congregationId,
    serviceType: 'Sunday Service',
    slotKey: 'orchestra1',
    displayOrder: 1,
    category: 'orchestra',
  });
  slotTemplateId = template.id;
});

afterEach(() => {
  jest.restoreAllMocks();
  mockFiles = undefined;
});

afterAll(teardownTestDb);

describe('migration 010 up', () => {
  it('moves faulty rows, keeps correct, unmatched and colliding rows, and warns on the collision', async () => {
    await addService('2025-01-04', 'Sunday Service');
    await addService('2025-01-11', 'Sunday Service');
    await addService('2025-01-12', 'Sunday Service'); // occupies the collision target
    await addService('2025-01-19', 'Sunday Service'); // already correct
    await addService('2025-02-02', 'Sunday Service'); // matches no entry

    await m010.up(ctx);

    expect(await stored()).toEqual([
      '2025-01-05|Sunday Service',
      '2025-01-11|Sunday Service',
      '2025-01-12|Sunday Service',
      '2025-01-19|Sunday Service',
      '2025-02-02|Sunday Service',
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Sunday Service.*2025-01-11.*2025-01-12/),
    );
  });

  it('keeps the service id and its slots when a service moves', async () => {
    const service = await addService('2025-01-04', 'Sunday Service', true);
    const slot = (await ServiceSlot.findOne({ where: { serviceId: service.id } }))!;

    await m010.up(ctx);

    const moved = (await Service.findByPk(service.id))!;
    expect(moved.serviceDate).toBe('2025-01-05');
    const after = await ServiceSlot.findAll({ where: { serviceId: service.id } });
    expect(after.map((s) => s.id)).toEqual([slot.id]);
    expect(await ServiceSlot.count()).toBe(1);
  });

  it('changes nothing on a second run', async () => {
    await addService('2025-01-04', 'Sunday Service', true);
    await addService('2025-01-19', 'Sunday Service');

    await m010.up(ctx);
    const afterFirst = await stored();
    await m010.up(ctx);

    expect(await stored()).toEqual(afterFirst);
    expect(afterFirst).toEqual(['2025-01-05|Sunday Service', '2025-01-19|Sunday Service']);
  });

  it('logs and returns when the congregation does not exist', async () => {
    await Service.destroy({ where: { congregationId } });
    await Congregation.destroy({ where: { id: congregationId } });

    await expect(m010.up(ctx)).resolves.toBeUndefined();

    expect(await Service.count()).toBe(0);
  });
});

describe('migration 010 down', () => {
  it('moves corrected rows back to the faulty date and leaves other rows alone', async () => {
    await addService('2025-01-05', 'Sunday Service', true);
    await addService('2025-01-19', 'Sunday Service');
    await addService('2025-02-02', 'Sunday Service');

    await m010.down(ctx);

    expect(await stored()).toEqual([
      '2025-01-04|Sunday Service',
      '2025-01-19|Sunday Service',
      '2025-02-02|Sunday Service',
    ]);
    expect(await ServiceSlot.count()).toBe(1);
  });

  it('round-trips with up', async () => {
    await addService('2025-01-04', 'Sunday Service');
    await addService('2025-01-11', 'Sunday Service');

    await m010.up(ctx);
    expect(await stored()).toEqual(['2025-01-05|Sunday Service', '2025-01-12|Sunday Service']);
    await m010.down(ctx);

    expect(await stored()).toEqual(['2025-01-04|Sunday Service', '2025-01-11|Sunday Service']);
  });

  it('skips a revert whose faulty date is already taken', async () => {
    await addService('2025-01-05', 'Sunday Service');
    await addService('2025-01-04', 'Sunday Service');

    await m010.down(ctx);

    expect(await stored()).toEqual(['2025-01-04|Sunday Service', '2025-01-05|Sunday Service']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
