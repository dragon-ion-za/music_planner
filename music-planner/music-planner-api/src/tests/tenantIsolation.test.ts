import { setupTestDb, teardownTestDb } from './testDb';
import { Congregation } from '../models/Congregation';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { ServiceRepository } from '../repositories/ServiceRepository';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

async function seedTenant(name: string, dates: string[]): Promise<{ cong: Congregation; services: Service[] }> {
  const cong = await Congregation.create({ name, timezone: 'UTC' });
  const tmpl = await SlotTemplate.create({ congregationId: cong.id, serviceType: 'Sunday', slotKey: 'orchestra1', displayOrder: 1, category: 'orchestra' });
  const song = await Song.create({ number: `TI${Date.now()}${Math.random()}`, hymnal: 'TI', familiarity: 0 });
  const services: Service[] = [];
  for (const date of dates) {
    const svc = await Service.create({ congregationId: cong.id, serviceDate: date, serviceType: 'Sunday' });
    await ServiceSlot.create({ serviceId: svc.id, slotTemplateId: tmpl.id, songId: song.id });
    services.push(svc);
  }
  return { cong, services };
}

describe('Property 14 — ServiceRepository.findByCongregation returns only the requested tenant', () => {
  it('returns only services belonging to the requested congregation', async () => {
    const { cong: c1 } = await seedTenant('Tenant Church Alpha', ['2024-11-03', '2024-11-10', '2024-11-17']);
    await seedTenant('Tenant Church Beta', ['2024-11-03', '2024-11-10', '2024-11-17']);
    const results = await ServiceRepository.findByCongregation(c1.id);
    expect(results.length).toBeGreaterThan(0);
    for (const svc of results) expect(svc.congregationId).toBe(c1.id);
  });

  it('returns zero services for a congregation that has none', async () => {
    const empty = await Congregation.create({ name: `Empty Church ${Date.now()}`, timezone: 'UTC' });
    expect(await ServiceRepository.findByCongregation(empty.id)).toHaveLength(0);
  });

  it('date range filter still excludes cross-tenant rows', async () => {
    const { cong: c1 } = await seedTenant('Tenant Church Gamma', ['2025-01-05', '2025-01-12']);
    await seedTenant('Tenant Church Delta', ['2025-01-05', '2025-01-12']);
    const results = await ServiceRepository.findByCongregation(c1.id, { from: '2025-01-01', to: '2025-01-31' });
    expect(results.length).toBeGreaterThan(0);
    for (const svc of results) expect(svc.congregationId).toBe(c1.id);
  });
});
