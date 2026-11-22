import { Op, Transaction } from 'sequelize';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';

export interface DateRange {
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
}

export interface SlotInput {
  slotKey: string;
  songId?: string | null;       // pre-resolved UUID (used by existing PUT path)
  songNumber?: string | null;   // song number string (used by new POST path)
}

const SERVICE_INCLUDE = [
  {
    model: ServiceSlot,
    as: 'serviceSlots',
    include: [
      {
        model: SlotTemplate,
        as: 'slotTemplate',
        attributes: ['slotKey', 'displayOrder', 'category'],
      },
      {
        model: Song,
        as: 'song',
        attributes: ['number', 'hymnal', 'name', 'familiarity'],
        include: [
          {
            model: Song,
            as: 'translationOf',
            attributes: ['number', 'hymnal', 'name'],
          },
        ],
      },
    ],
  },
];

// Slot templates are only seeded for 'Sunday Service', but services of other
// types (Midweek Service, Palm Sunday, ...) share the same slot layout and were
// imported against those templates. Prefer an exact serviceType match, then fall
// back to any template for the congregation with the same slotKey. Without the
// fallback, updates for those services silently matched no template and were skipped.
async function findTemplate(
  congregationId: string,
  serviceType: string,
  slotKey: string,
  transaction?: Transaction,
): Promise<SlotTemplate | null> {
  const exact = await SlotTemplate.findOne({ where: { congregationId, serviceType, slotKey }, transaction });
  if (exact) return exact;
  return SlotTemplate.findOne({ where: { congregationId, slotKey }, order: [['serviceType', 'ASC']], transaction });
}

export class UnknownSongError extends Error {
  constructor(public songNumber: string) {
    super('Unknown song number: ' + songNumber);
    this.name = 'UnknownSongError';
    Object.setPrototypeOf(this, UnknownSongError.prototype);
  }
}

export interface ServiceChanges {
  serviceDate?: string;
  serviceType?: string;
  slots?: SlotInput[];
}

// songId present (even null) is used as-is; otherwise songNumber is looked up.
// strictNumbers: throw UnknownSongError for unknown numbers instead of returning null.
async function resolveSongId(
  entry: SlotInput,
  strictNumbers: boolean,
  transaction?: Transaction,
): Promise<string | null> {
  if (entry.songId !== undefined) return entry.songId;
  if (entry.songNumber === undefined || entry.songNumber === null) return null;
  const song = await Song.findOne({ where: { number: entry.songNumber }, transaction });
  if (!song) {
    if (strictNumbers) throw new UnknownSongError(entry.songNumber);
    return null;
  }
  return song.id;
}

export const ServiceRepository = {
  async findByCongregation(congregationId: string, dateRange?: DateRange): Promise<Service[]> {
    const where: Record<string, unknown> = { congregationId };

    if (dateRange) {
      where['serviceDate'] = { [Op.between]: [dateRange.from, dateRange.to] };
    }

    return Service.findAll({
      where,
      order: [['serviceDate', 'ASC']],
      include: SERVICE_INCLUDE,
    });
  },

  async findById(id: string): Promise<Service | null> {
    return Service.findByPk(id);
  },

  async findByIdWithSlots(id: string): Promise<Service | null> {
    return Service.findByPk(id, { include: SERVICE_INCLUDE });
  },

  async create(
    congregationId: string,
    serviceDate: string,
    serviceType: string,
    slots?: SlotInput[],
  ): Promise<Service> {
    const service = await Service.create({ congregationId, serviceDate, serviceType });

    if (Array.isArray(slots)) {
      for (const entry of slots) {
        const template = await findTemplate(congregationId, serviceType, entry.slotKey);
        if (template) {
          const resolvedSongId = await resolveSongId(entry, false);
          await ServiceSlot.create({
            serviceId: service.id,
            slotTemplateId: template.id,
            songId: resolvedSongId,
          });
        }
      }
    }

    return (await ServiceRepository.findByIdWithSlots(service.id))!;
  },

  async upsertSlots(
    service: Service,
    congregationId: string,
    slots: SlotInput[],
  ): Promise<Service> {
    for (const entry of slots) {
      const template = await findTemplate(congregationId, service.serviceType, entry.slotKey);
      if (!template) continue;

      const existing = await ServiceSlot.findOne({
        where: { serviceId: service.id, slotTemplateId: template.id },
      });
      if (existing) {
        await existing.update({ songId: entry.songId ?? null });
      } else {
        await ServiceSlot.create({
          serviceId: service.id,
          slotTemplateId: template.id,
          songId: entry.songId ?? null,
        });
      }
    }

    return (await ServiceRepository.findByIdWithSlots(service.id))!;
  },

  async update(
    service: Service,
    congregationId: string,
    changes: ServiceChanges,
  ): Promise<Service> {
    const sequelize = Service.sequelize!;
    await sequelize.transaction(async (transaction) => {
      const slots = changes.slots ?? [];
      const resolved: { entry: SlotInput; songId: string | null }[] = [];
      for (const entry of slots) {
        resolved.push({ entry, songId: await resolveSongId(entry, true, transaction) });
      }

      const fields: { serviceDate?: string; serviceType?: string } = {};
      if (changes.serviceDate !== undefined) fields.serviceDate = changes.serviceDate;
      if (changes.serviceType !== undefined) fields.serviceType = changes.serviceType;
      if (Object.keys(fields).length > 0) {
        await service.update(fields, { transaction });
      }

      for (const { entry, songId } of resolved) {
        const template = await findTemplate(congregationId, service.serviceType, entry.slotKey, transaction);
        if (!template) continue;
        const existing = await ServiceSlot.findOne({
          where: { serviceId: service.id, slotTemplateId: template.id },
          transaction,
        });
        if (existing) {
          await existing.update({ songId }, { transaction });
        } else {
          await ServiceSlot.create(
            { serviceId: service.id, slotTemplateId: template.id, songId },
            { transaction },
          );
        }
      }
    });

    return (await ServiceRepository.findByIdWithSlots(service.id))!;
  },
};
