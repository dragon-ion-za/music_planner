import { Op } from 'sequelize';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';

export interface DateRange {
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
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
      include: [
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
      ],
    });
  },
};
