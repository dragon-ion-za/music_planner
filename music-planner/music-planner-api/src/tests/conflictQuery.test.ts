import { setupTestDb, teardownTestDb } from './testDb';
import { Congregation } from '../models/Congregation';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { ConflictRepository } from '../repositories/ConflictRepository';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedBase() {
  const cong = await Congregation.create({ name: `Conflict Church ${Date.now()}`, timezone: 'UTC' });
  const tmpl = await SlotTemplate.create({ congregationId: cong.id, serviceType: 'Sunday', slotKey: 'orchestra1', displayOrder: 1, category: 'orchestra' });
  const song = await Song.create({ number: `CQ${Date.now()}`, hymnal: 'CQ', familiarity: 0 });
  return { cong, tmpl, song };
}

async function makeServiceWithSong(congregationId: string, slotTemplateId: string, songId: string, date: string): Promise<Service> {
  const svc = await Service.create({ congregationId, serviceDate: date, serviceType: 'Sunday' });
  await ServiceSlot.create({ serviceId: svc.id, slotTemplateId, songId });
  return svc;
}

describe('Property 11 — conflict window symmetry', () => {
  it('if A conflicts with B then B conflicts with A (56-day window)', async () => {
    const { cong, tmpl, song } = await seedBase();
    const svcA = await makeServiceWithSong(cong.id, tmpl.id, song.id, '2024-06-01');
    const svcB = await makeServiceWithSong(cong.id, tmpl.id, song.id, addDays('2024-06-01', 56));
    const fromA = await ConflictRepository.findConflicts(song.id, cong.id, svcA.serviceDate, 56, svcA.id);
    const fromB = await ConflictRepository.findConflicts(song.id, cong.id, svcB.serviceDate, 56, svcB.id);
    expect(fromA.map(s => s.serviceId)).toContain(svcB.id);
    expect(fromB.map(s => s.serviceId)).toContain(svcA.id);
  });

  it('services exactly 56 days apart appear in the conflict window', async () => {
    const { cong, tmpl, song } = await seedBase();
    const svcA = await makeServiceWithSong(cong.id, tmpl.id, song.id, '2024-07-01');
    await makeServiceWithSong(cong.id, tmpl.id, song.id, addDays('2024-07-01', 56));
    const conflicts = await ConflictRepository.findConflicts(song.id, cong.id, svcA.serviceDate, 56, svcA.id);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('services exactly 57 days apart do NOT appear in the 56-day conflict window', async () => {
    const { cong, tmpl, song } = await seedBase();
    const svcA = await makeServiceWithSong(cong.id, tmpl.id, song.id, '2024-08-01');
    await makeServiceWithSong(cong.id, tmpl.id, song.id, addDays('2024-08-01', 57));
    const conflicts = await ConflictRepository.findConflicts(song.id, cong.id, svcA.serviceDate, 56, svcA.id);
    expect(conflicts.length).toBe(0);
  });
});

describe('Property 12 — conflict query excludes the target service itself', () => {
  it('does not return the target service in conflict results', async () => {
    const { cong, tmpl, song } = await seedBase();
    const svcA = await makeServiceWithSong(cong.id, tmpl.id, song.id, '2024-09-01');
    await makeServiceWithSong(cong.id, tmpl.id, song.id, addDays('2024-09-01', 10));
    const conflicts = await ConflictRepository.findConflicts(song.id, cong.id, svcA.serviceDate, 56, svcA.id);
    expect(conflicts.map(s => s.serviceId)).not.toContain(svcA.id);
  });
});

describe('Property 13 — conflict query scoped to congregation', () => {
  it('does not return slots from a different congregation', async () => {
    const c1 = await Congregation.create({ name: `Conflict C1 ${Date.now()}`, timezone: 'UTC' });
    const c2 = await Congregation.create({ name: `Conflict C2 ${Date.now()}`, timezone: 'UTC' });
    const tmpl1 = await SlotTemplate.create({ congregationId: c1.id, serviceType: 'Sunday', slotKey: 'orchestra1', displayOrder: 1, category: 'orchestra' });
    const tmpl2 = await SlotTemplate.create({ congregationId: c2.id, serviceType: 'Sunday', slotKey: 'orchestra1', displayOrder: 1, category: 'orchestra' });
    const song = await Song.create({ number: `ISO${Date.now()}`, hymnal: 'ISO', familiarity: 0 });
    const svcC1 = await makeServiceWithSong(c1.id, tmpl1.id, song.id, '2024-10-06');
    await makeServiceWithSong(c2.id, tmpl2.id, song.id, '2024-10-06');
    const conflicts = await ConflictRepository.findConflicts(song.id, c1.id, svcC1.serviceDate, 56, svcC1.id);
    const c2ServiceIds = new Set((await Service.findAll({ where: { congregationId: c2.id } })).map(s => s.id));
    for (const slot of conflicts) {
      expect(c2ServiceIds.has(slot.serviceId)).toBe(false);
    }
  });
});
