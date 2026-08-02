import { Op } from 'sequelize';
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
    include: [
      {
        model: SlotTemplate,
        attributes: ['slotKey', 'displayOrder', 'category'],
      },
      {
        model: Song,
        attributes: ['number', 'hymnal', 'familiarity'],
        include: [
          {
            model: Song,
            as: 'translationOf',
            attributes: ['number', 'hymnal'],
          },
        ],
      },
    ],
  },
];

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
        const template = await SlotTemplate.findOne({
          where: { congregationId, serviceType, slotKey: entry.slotKey },
        });
        if (template) {
          let resolvedSongId: string | null = null;
          if (entry.songId !== undefined && entry.songId !== null) {
            resolvedSongId = entry.songId;
          } else if (entry.songNumber) {
            const song = await Song.findOne({ where: { number: entry.songNumber } });
            resolvedSongId = song?.id ?? null;
          }
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
      const template = await SlotTemplate.findOne({
        where: { congregationId, serviceType: service.serviceType, slotKey: entry.slotKey },
      });
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
};
