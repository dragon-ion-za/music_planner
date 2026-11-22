import { setupTestDb, teardownTestDb } from './testDb';
import { Congregation } from '../models/Congregation';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { ServiceRepository } from '../repositories/ServiceRepository';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

async function setup(songName: string | null, translationName: string | null) {
  const congregation = await Congregation.create({ name: `Cong ${Math.random()}` });
  const template = await SlotTemplate.create({
    congregationId: congregation.id,
    serviceType: 'Sunday Service',
    slotKey: 'orchestra1',
    displayOrder: 1,
    category: 'orchestra',
  });
  const translation = await Song.create({ number: `E${Date.now() % 100000}`, hymnal: 'E', name: translationName });
  const song = await Song.create({
    number: `A${Date.now() % 100000}`,
    hymnal: 'A',
    name: songName,
    translationOfId: translation.id,
  });
  const service = await Service.create({
    congregationId: congregation.id,
    serviceDate: '2025-01-05',
    serviceType: 'Sunday Service',
  });
  await ServiceSlot.create({ serviceId: service.id, slotTemplateId: template.id, songId: song.id });
  return { congregation, service };
}

describe('ServiceRepository hymn names', () => {
  it('returns name: null for a song and translation with no stored name', async () => {
    const { congregation, service } = await setup(null, null);

    const [found] = await ServiceRepository.findByCongregation(congregation.id);
    const slot = found.toJSON().serviceSlots[0];
    expect(slot.song.name).toBeNull();
    expect(slot.song.translationOf.name).toBeNull();

    const byId = (await ServiceRepository.findByIdWithSlots(service.id))!.toJSON();
    expect(byId.serviceSlots[0].song.name).toBeNull();
    expect(byId.serviceSlots[0].song.translationOf.name).toBeNull();
  });

  it('returns stored names for the song and translation', async () => {
    const { congregation } = await setup('Grote God', 'Great God');

    const [found] = await ServiceRepository.findByCongregation(congregation.id);
    const slot = found.toJSON().serviceSlots[0];
    expect(slot.song.name).toBe('Grote God');
    expect(slot.song.translationOf.name).toBe('Great God');
  });
});
