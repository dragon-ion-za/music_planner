/**
 * Bug condition exploration test (Property 1) for service-date-off-by-one.
 * EXPECTED TO FAIL on unfixed code: parseDate returns the UTC date for
 * instants at 22:00:00Z-23:59:59.999Z instead of the Africa/Johannesburg date.
 *
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 */
import * as fc from 'fast-check';
import * as path from 'path';
import { parseDate, readSchedule } from '../db/importers/brentwoodSchedule';

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_FILE = path.resolve(__dirname, '../../../.data/brentwood-schedule-latest.json');

function nextUtcDate(instant: Date): string {
  const midnight = Date.UTC(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
  );
  return new Date(midnight + DAY_MS).toISOString().substring(0, 10);
}

describe('parseDate bug condition (UTC 22:00Z-23:59:59.999Z)', () => {
  it('maps any instant in the affected window to the UTC date plus one day', () => {
    const affectedInstant = fc
      .tuple(
        fc.date({ min: new Date('2000-01-01T00:00:00Z'), max: new Date('2100-12-31T00:00:00Z'), noInvalidDate: true }),
        fc.integer({ min: 22 * 3600000, max: 24 * 3600000 - 1 }),
      )
      .map(([d, msOfDay]) => {
        const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        return new Date(midnight + msOfDay);
      });

    fc.assert(
      fc.property(affectedInstant, (instant) => {
        expect(parseDate(instant.toISOString())).toBe(nextUtcDate(instant));
      }),
    );
  });

  it.each([
    ['2025-01-04T22:00:00.000Z', '2025-01-05'],
    ['2025-12-31T22:00:00.000Z', '2026-01-01'],
    ['2024-02-28T22:00:00.000Z', '2024-02-29'],
  ])('parseDate(%s) returns %s', (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it('maps every 22:00Z entry in the real schedule file to the next day', () => {
    const entries = readSchedule(SCHEDULE_FILE).filter((e) => e.date.substring(10, 16) === 'T22:00');
    expect(entries.length).toBeGreaterThan(0);
    const wrong = entries
      .filter((e) => parseDate(e.date) !== nextUtcDate(new Date(e.date)))
      .map((e) => e.date);
    expect(wrong).toEqual([]);
  });
});
