import { Op } from 'sequelize';
import { ServiceSlot } from '../models/ServiceSlot';
import { Service } from '../models/Service';
import { SlotTemplate } from '../models/SlotTemplate';
import moment from 'moment';

export const ConflictRepository = {
  async findConflicts(
    songId: string,
    congregationId: string,
    targetDate: string, // 'YYYY-MM-DD'
    windowDays: number,
    serviceId: string,  // target service to exclude
  ): Promise<ServiceSlot[]> {
    const from = moment(targetDate).subtract(windowDays, 'days').format('YYYY-MM-DD');
    const to   = moment(targetDate).add(windowDays, 'days').format('YYYY-MM-DD');

    return ServiceSlot.findAll({
      where: { songId },
      include: [
        {
          model: Service,
          where: {
            congregationId,
            serviceDate: { [Op.between]: [from, to] },
            id: { [Op.ne]: serviceId },
          },
          attributes: ['serviceDate', 'serviceType'],
          required: true,
        },
        {
          model: SlotTemplate,
          attributes: ['slotKey'],
        },
      ],
    });
  },
};
