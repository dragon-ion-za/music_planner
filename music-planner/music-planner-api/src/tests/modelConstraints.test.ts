import { UniqueConstraintError } from 'sequelize';
import { setupTestDb, teardownTestDb } from './testDb';
import { Congregation } from '../models/Congregation';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

async function makeCongregation(name: string): Promise<Congregation> {
  return Congregation.create({ name, timezone: 'UTC' });
}
async function makeSlotTemplate(congregationId: string, serviceType = 'Sunday', slotKey = 'orchestra1'): Promise<SlotTemplate> {
  return SlotTemplate.create({ congregationId, serviceType, slotKey, displayOrder: 1, category: 'orchestra' });
}
async function makeSong(number: string): Promise<Song> {
  return Song.create({ number, hymnal: number.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? '', familiarity: 0 });
}
async function makeService(congregationId: string, serviceDate: string, serviceType = 'Sunday'): Promise<Service> {
  return Service.create({ congregationId, serviceDate, serviceType });
}

describe('Property 2 — congregation name uniqueness', () => {
  it('raises UniqueConstraintError when inserting two congregations with the same name', async () => {
    await makeCongregation('Alpha Church');
    await expect(makeCongregation('Alpha Church')).rejects.toThrow(UniqueConstraintError);
  });
});

describe('Property 3 — cascade delete removes all child rows', () => {
  it('deletes slot_templates, services, and service_slots when congregation is deleted', async () => {
    const cong = await makeCongregation('Cascade Church');
    const tmpl = await makeSlotTemplate(cong.id, 'Sunday', 'choir1');
    const svc  = await makeService(cong.id, '2024-01-07');
    const song = await makeSong('E100');
    await ServiceSlot.create({ serviceId: svc.id, slotTemplateId: tmpl.id, songId: song.id });
    await cong.destroy();
    expect(await SlotTemplate.findAll({ where: { congregationId: cong.id } })).toHaveLength(0);
    expect(await Service.findAll({ where: { congregationId: cong.id } })).toHaveLength(0);
    expect(await ServiceSlot.findAll({ where: { serviceId: svc.id } })).toHaveLength(0);
  });
});

describe('Property 4 — slot template uniqueness per congregation', () => {
  it('raises UniqueConstraintError for duplicate (congregationId, serviceType, slotKey)', async () => {
    const cong = await makeCongregation('Template Church');
    await makeSlotTemplate(cong.id, 'Sunday', 'orchestra1');
    await expect(makeSlotTemplate(cong.id, 'Sunday', 'orchestra1')).rejects.toThrow(UniqueConstraintError);
  });
  it('allows the same slotKey for a different congregation', async () => {
    const c1 = await makeCongregation('Template Church A');
    const c2 = await makeCongregation('Template Church B');
    await makeSlotTemplate(c1.id, 'Sunday', 'choir1');
    await expect(makeSlotTemplate(c2.id, 'Sunday', 'choir1')).resolves.toBeDefined();
  });
});

describe('Property 7 — song number uniqueness', () => {
  it('raises UniqueConstraintError when inserting two songs with the same number', async () => {
    await makeSong('A1');
    await expect(makeSong('A1')).rejects.toThrow(UniqueConstraintError);
  });
  it('treats numbers as unique after uppercase normalisation', async () => {
    await makeSong('A2');
    await expect(makeSong('a2')).rejects.toThrow(UniqueConstraintError);
  });
});

describe('Property 8 — translation_of_id SET NULL when target song is deleted', () => {
  it('sets translationOfId to NULL on songs pointing to the deleted song', async () => {
    const target      = await makeSong('E200');
    const translation = await Song.create({ number: 'A200', hymnal: 'A', translationOfId: target.id, familiarity: 0 });
    await target.destroy();
    await translation.reload();
    expect(translation.translationOfId).toBeNull();
  });
});

describe('Property 9 — service uniqueness per congregation', () => {
  it('raises UniqueConstraintError for duplicate (congregationId, serviceDate, serviceType)', async () => {
    const cong = await makeCongregation('Service Church');
    await makeService(cong.id, '2024-03-10', 'Sunday');
    await expect(makeService(cong.id, '2024-03-10', 'Sunday')).rejects.toThrow(UniqueConstraintError);
  });
  it('allows the same date+type for a different congregation', async () => {
    const c1 = await makeCongregation('Service Church A');
    const c2 = await makeCongregation('Service Church B');
    await makeService(c1.id, '2024-04-07', 'Sunday');
    await expect(makeService(c2.id, '2024-04-07', 'Sunday')).resolves.toBeDefined();
  });
});

describe('Property 10 — service slot uniqueness per service', () => {
  it('raises UniqueConstraintError for duplicate (serviceId, slotTemplateId)', async () => {
    const cong = await makeCongregation('Slot Church');
    const tmpl = await makeSlotTemplate(cong.id, 'Sunday', 'congregationBS');
    const svc  = await makeService(cong.id, '2024-05-05');
    const song = await makeSong('BB1');
    await ServiceSlot.create({ serviceId: svc.id, slotTemplateId: tmpl.id, songId: song.id });
    await expect(
      ServiceSlot.create({ serviceId: svc.id, slotTemplateId: tmpl.id, songId: null })
    ).rejects.toThrow(UniqueConstraintError);
  });
});
