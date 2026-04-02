/**
 * Conflict query tests — Properties 11–13
 *
 * Seeds known service dates and verifies boundary values:
 *   exactly 56 days apart → inside conflict window
 *   exactly 57 days apart → outside conflict window
 *
 * Uses in-memory SQLite via testDb.ts.
 *
 * Validates: Requirements 7.1, 7.5, 7.6
 */

import { setupTestDb, teardownTestDb } from './testDb';
import { Congregation } from '../models/Congregation';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { ConflictRepository } from '../repositories/ConflictRepository';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

// ─── helpers ────────────────────────────────────────────────────────────────

function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedBase() {
  const cong = await Congregation.create({ name: `Conflict Church ${Date.now()}`, timezone: 'UTC' });
  const tmpl = await SlotTemplate.create({
    congregationId: cong.id,
    serviceType: 'Sunday',
    slotKey: 'orchestra1',
    displayOrder: 1,
    category: 'orchestra',
  });
  const song = await Song.create({ number: `CQ${Date.now()}`, hymnal: 'CQ', familiarity: 0 });
  return { cong, tmpl, song };
}

async function makeServiceWithSong(
  congregationId: string,
  slotTemplateId: string,
  songId: string,
  date: string,
): Promise<Service> {
  const svc = await Service.create({ congregationId, serviceDate: date, serviceType: 'Sunday' });
  await ServiceSlot.create({ serviceId: svc.id, slotTemplateId, songId });
  return svc;
}

// ─── Property 11: Conflict window symmetry ───────────────────────────────────

describe('Property 11 — conflict window symmetry', () => {
  it('if A conflicts with B then B conflicts with A (56-day window)', async () => {
    const { cong, tmpl, song } = await seedBase();
    const baseDate = '2024-06-01';
    const svcA = await makeServiceWithSong(cong.id, tmpl.id, song.id, baseDate);
    const svcB = await makeServiceWithSong(cong.id, tmpl.id, song.id, addDays(baseDate, 56));

    const conflictsFromA = await ConflictRepository.findConflicts(
      song.id, cong.id, svcA.serviceDate, 56, svcA.id,
    );
    const conflictsFromB = await ConflictRepository.findConflicts(
      song.id, cong.id, svcB.serviceDate, 56, svcB.id,
    );

    // serviceId on the ServiceSlot row tells us which service it belongs to
    const serviceIdsFromA = conflictsFromA.map((s) => s.serviceId);
    const serviceIdsFromB = conflictsFromB.map((s) => s.serviceId);

    expect(serviceIdsFromA).toContain(svcB.id);
    expect(serviceIdsFromB).toContain(svcA.id);
  });

  it('services exactly 56 days apart appear in the conflict window', async () => {
    const { cong, tmpl, song } = await seedBase();
    const baseDate = '2024-07-01';
    const svcA = await makeServiceWithSong(cong.id, tmpl.id, song.id, baseDate);
    await makeServiceWithSong(cong.id, tmpl.id, song.id, addDays(baseDate, 56));

    const conflicts = await ConflictRepository.findConflicts(
      song.id, cong.id, svcA.serviceDate, 56, svcA.id,
    );
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('services exactly 57 days apart do NOT appear in the 56-day conflict window', async () => {
    const { cong, tmpl, song } = await seedBase();
    const baseDate = '2024-08-01';
    const svcA = await makeServiceWithSong(cong.id, tmpl.id, song.id, baseDate);
    await makeServiceWithSong(cong.id, tmpl.id, song.id, addDays(baseDate, 57));

    const conflicts = await ConflictRepository.findConflicts(
      song.id, cong.id, svcA.serviceDate, 56, svcA.id,
    );
    expect(conflicts.length).toBe(0);
  });
});

// ─── Property 12: Conflict query excludes target service ─────────────────────

describe('Property 12 — conflict query excludes the target service itself', () => {
  it('does not return the target service in conflict results', async () => {
    const { cong, tmpl, song } = await seedBase();
    const svcA = await makeServiceWithSong(cong.id, tmpl.id, song.id, '2024-09-01');
    // A second service so there is at least one result to check
    await makeServiceWithSong(cong.id, tmpl.id, song.id, addDays('2024-09-01', 10));

    const conflicts = await ConflictRepository.findConflicts(
      song.id, cong.id, svcA.serviceDate, 56, svcA.id,
    );

    const returnedServiceIds = conflicts.map((s) => s.serviceId);
    expect(returnedServiceIds).not.toContain(svcA.id);
  });
});

// ─── Property 13: Conflict query tenant isolation ────────────────────────────

describe('Property 13 — conflict query scoped to congregation', () => {
  it('does not return slots from a different congregation', async () => {
    const c1 = await Congregation.create({ name: `Conflict C1 ${Date.now()}`, timezone: 'UTC' });
    const c2 = await Congregation.create({ name: `Conflict C2 ${Date.now()}`, timezone: 'UTC' });

    const tmpl1 = await SlotTemplate.create({
      congregationId: c1.id, serviceType: 'Sunday', slotKey: 'orchestra1',
      displayOrder: 1, category: 'orchestra',
    });
    const tmpl2 = await SlotTemplate.create({
      congregationId: c2.id, serviceType: 'Sunday', slotKey: 'orchestra1',
      displayOrder: 1, category: 'orchestra',
    });

    const song = await Song.create({ number: `ISO${Date.now()}`, hymnal: 'ISO', familiarity: 0 });

    const date = '2024-10-06';
    const svcC1 = await makeServiceWithSong(c1.id, tmpl1.id, song.id, date);
    await makeServiceWithSong(c2.id, tmpl2.id, song.id, date);

    const conflicts = await ConflictRepository.findConflicts(
      song.id, c1.id, svcC1.serviceDate, 56, svcC1.id,
    );

    // Verify no returned slot belongs to a service in c2 by checking serviceIds
    const c2Services = await Service.findAll({ where: { congregationId: c2.id } });
    const c2ServiceIds = new Set(c2Services.map((s) => s.id));

    for (const slot of conflicts) {
      expect(c2ServiceIds.has(slot.serviceId)).toBe(false);
    }
  });
});
