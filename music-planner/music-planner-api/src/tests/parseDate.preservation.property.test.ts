/**
 * Preservation tests (Property 2) for service-date-off-by-one.
 * Must PASS on unfixed code and keep passing after the fix.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
 */
import * as fc from 'fast-check';
import { setupTestDb, teardownTestDb } from './testDb';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import {
  importSchedule,
  parseDate,
  seedBrentwoodCongregation,
  ScheduleEntry,
} from '../db/importers/brentwoodSchedule';

describe('parseDate preservation (UTC 00:00:00.000Z-21:59:59.999Z and date-only)', () => {
  it('returns the UTC date portion for any instant before 22:00Z', () => {
    const unaffectedInstant = fc
      .tuple(
        fc.date({ min: new Date('2000-01-01T00:00:00Z'), max: new Date('2100-12-31T00:00:00Z'), noInvalidDate: true }),
        fc.integer({ min: 0, max: 22 * 3600000 - 1 }),
      )
      .map(([d, msOfDay]) => {
        const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        return new Date(midnight + msOfDay).toISOString();
      });

    fc.assert(
      fc.property(unaffectedInstant, (instant) => {
        expect(parseDate(instant)).toBe(instant.substring(0, 10));
      }),
    );
  });

  it.each([
    ['2025-01-05T00:00:00.000Z', '2025-01-05'],
    ['2025-01-05T11:48:00.000Z', '2025-01-05'],
    ['2025-01-05T21:59:59.999Z', '2025-01-05'],
    ['2025-01-05', '2025-01-05'],
  ])('parseDate(%s) returns %s', (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });
});

describe('importSchedule preservation (non-date data)', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setupTestDb();
  });
  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
  afterAll(teardownTestDb);

  it('keeps service types, slot keys, song ids and null songs', async () => {
    const a10 = await Song.create({ number: 'A10', hymnal: 'A' } as any);
    const b2 = await Song.create({ number: 'B2', hymnal: 'B' } as any);
    const congregationId = await seedBrentwoodCongregation();

    const schedule: ScheduleEntry[] = [
      {
        date: '2025-01-05T00:00:00.000Z',
        serviceType: 'Sunday Service',
        songs: [
          { type: 'orchestra1', number: 'A10' },
          { type: 'orchestra2', number: 'N/A' },
          { type: 'choir1', number: '' },
          { type: 'choir2', number: 'b2' },
          { type: 'congregationBS', number: 'Z99' },
        ],
      },
      {
        date: '2025-01-12T11:48:00.000Z',
        serviceType: 'Special Service',
        songs: [{ type: 'orchestra1', number: 'B2' }],
      },
    ];
    await importSchedule(congregationId, schedule);

    const templates = await SlotTemplate.findAll({ where: { congregationId } });
    const keyById = new Map(templates.map((t) => [t.id, t.slotKey]));
    const services = await Service.findAll({ where: { congregationId } });
    expect(services.map((s) => s.serviceType).sort()).toEqual(['Special Service', 'Sunday Service']);

    const result: Record<string, Record<string, string | null>> = {};
    for (const svc of services) {
      const slots = await ServiceSlot.findAll({ where: { serviceId: svc.id } });
      result[svc.serviceType] = Object.fromEntries(
        slots.map((s) => [keyById.get(s.slotTemplateId), s.songId]),
      );
    }

    expect(result['Sunday Service']).toEqual({
      orchestra1: a10.id,
      orchestra2: null,
      choir1: null,
      choir2: b2.id,
      congregationBS: null,
    });
    expect(result['Special Service']).toEqual({ orchestra1: b2.id });
  });
});
