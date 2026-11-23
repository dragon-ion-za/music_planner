// Preservation (service-date-off-by-one): the picked local calendar date is sent as YYYY-MM-DD.
// Validates: Requirements 3.2
import fc from 'fast-check';
import moment from 'moment';
import { buildServicePayload, buildSongLookup, resolveSongNumber } from './service-form.util';
import repertoireData from '../../../assets/repertoire.json';

describe('buildServicePayload serviceDate', () => {
  it('returns the picked local calendar date as YYYY-MM-DD', () => {
    const payload = buildServicePayload(moment(new Date(2025, 0, 5, 0, 0, 0)), 'Sunday Service', []);
    expect(payload.serviceDate).toBe('2025-01-05');
  });

  it('keeps the local date for late-evening and early-morning picks', () => {
    expect(buildServicePayload(moment(new Date(2025, 11, 31, 23, 59, 59)), 'S', []).serviceDate).toBe('2025-12-31');
    expect(buildServicePayload(moment(new Date(2024, 1, 29, 0, 0, 1)), 'S', []).serviceDate).toBe('2024-02-29');
  });

  it('matches the local year, month and day for any picked date', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2000, 0, 1), max: new Date(2100, 11, 31), noInvalidDate: true }),
        (d) => {
          const pad = (n: number) => String(n).padStart(2, '0');
          const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          expect(buildServicePayload(moment(d), 'S', []).serviceDate).toBe(expected);
        },
      ),
    );
  });
});

describe('resolveSongNumber properties', () => {
  const songs: { number: string }[] = (repertoireData as { songs: { number: string }[] }).songs;
  const lookup = buildSongLookup(songs);
  const numbers = songs.map(s => s.number);
  const padding = fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 4 }).map(a => a.join(''));
  const flipCase = (s: string, flips: boolean[]) =>
    [...s].map((c, i) => (flips[i % flips.length] ? (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()) : c)).join('');

  // Feature: dialog-conflict-field-highlight, Property 1: Case-insensitive resolution returns the canonical number
  // **Validates: Requirements 5.1**
  it('Property 1: resolves any case variant with padding to the canonical number', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fc.constantFrom(...numbers),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
          padding,
          padding,
          (num, flips, pre, post) => {
            expect(resolveSongNumber(pre + flipCase(num, flips) + post, lookup)).toBe(num);
          },
        ),
        { numRuns: 100 },
      ),
    ).not.toThrow();
  });

  // Feature: dialog-conflict-field-highlight, Property 2: Non-matching input resolves to no song
  // **Validates: Requirements 5.2**
  it('Property 2: returns null when the trimmed lowercase text is not a lookup key', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fc.string().filter(s => !lookup.has(s.trim().toLowerCase())),
          s => {
            expect(resolveSongNumber(s, lookup)).toBeNull();
          },
        ),
        { numRuns: 100 },
      ),
    ).not.toThrow();
  });

  // Feature: dialog-conflict-field-highlight, Property 3: Resolution is idempotent
  // **Validates: Requirements 5.3**
  it('Property 3: resolving a resolved value yields the same value', () => {
    const input = fc.oneof(
      fc.string(),
      fc.tuple(fc.constantFrom(...numbers), fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }), padding).map(
        ([n, f, p]) => p + flipCase(n, f) + p,
      ),
    );
    expect(() =>
      fc.assert(
        fc.property(input, s => {
          const once = resolveSongNumber(s, lookup);
          expect(resolveSongNumber(once, lookup)).toBe(once);
        }),
        { numRuns: 100 },
      ),
    ).not.toThrow();
  });
});