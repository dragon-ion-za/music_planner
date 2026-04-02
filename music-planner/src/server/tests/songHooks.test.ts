/**
 * Song hook tests — Properties 5 and 6
 *
 * Generates mixed-case song numbers and verifies:
 *   Property 5: stored number is always uppercase
 *   Property 6: stored hymnal equals the leading alpha prefix of the stored number
 *
 * Uses in-memory SQLite via testDb.ts.
 *
 * Validates: Requirements 3.2, 3.3, 11.3
 */

import { setupTestDb, teardownTestDb } from './testDb';
import { Song } from '../models/Song';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

// ─── helpers ────────────────────────────────────────────────────────────────

async function createSong(number: string): Promise<Song> {
  return Song.create({ number, hymnal: 'placeholder', familiarity: 0 });
}

// ─── Property 5: Song number uppercase normalisation ─────────────────────────

describe('Property 5 — song number stored as uppercase', () => {
  const cases: [string, string][] = [
    ['a10',   'A10'],
    ['e7',    'E7'],
    ['bb1',   'BB1'],
    ['Bb12',  'BB12'],
    ['A3',    'A3'],
    ['cM1',   'CM1'],
    ['eE99',  'EE99'],
  ];

  test.each(cases)('input %s → stored as %s', async (input, expected) => {
    const song = await createSong(input);
    expect(song.number).toBe(expected);
  });
});

// ─── Property 6: Hymnal prefix extraction ────────────────────────────────────

describe('Property 6 — hymnal equals leading alpha prefix of stored number', () => {
  const cases: [string, string][] = [
    ['a10',   'A'],
    ['e7',    'E'],
    ['bb1',   'BB'],
    ['Bb12',  'BB'],
    ['cM1',   'CM'],
    ['eE99',  'EE'],
  ];

  test.each(cases)('input %s → hymnal %s', async (input, expectedHymnal) => {
    // Use unique numbers to avoid UniqueConstraintError from Property 5 tests
    const song = await createSong(`${input}H${Date.now()}${Math.random().toString(36).slice(2)}`);
    const prefix = song.number.match(/^[A-Z]+/)?.[0] ?? '';
    expect(song.hymnal).toBe(prefix);
    expect(song.hymnal).toBe(expectedHymnal);
  });

  it('hymnal is always the exact leading alpha prefix of the stored (uppercase) number', async () => {
    const inputs = ['x99', 'yZ3', 'abc1', 'ZZ10', 'mm5'];
    for (const input of inputs) {
      const song = await createSong(`${input}U${Date.now()}${Math.random().toString(36).slice(2)}`);
      const expectedPrefix = song.number.match(/^[A-Z]+/)?.[0] ?? '';
      expect(song.hymnal).toBe(expectedPrefix);
    }
  });
});

// ─── beforeUpdate hook ───────────────────────────────────────────────────────

describe('Song hooks on update', () => {
  it('re-normalises number and hymnal when number is updated', async () => {
    const song = await createSong(`upd${Date.now()}`);
    await song.update({ number: 'bb99' });
    expect(song.number).toBe('BB99');
    expect(song.hymnal).toBe('BB');
  });
});
