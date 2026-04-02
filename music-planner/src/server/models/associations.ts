import { Congregation } from './Congregation';
import { SlotTemplate } from './SlotTemplate';
import { Song } from './Song';
import { Service } from './Service';
import { ServiceSlot } from './ServiceSlot';

export function initAssociations(): void {
  Congregation.hasMany(SlotTemplate, { foreignKey: 'congregationId', onDelete: 'CASCADE' });
  Congregation.hasMany(Service, { foreignKey: 'congregationId', onDelete: 'CASCADE' });

  Service.belongsTo(Congregation, { foreignKey: 'congregationId' });
  Service.hasMany(ServiceSlot, { foreignKey: 'serviceId', onDelete: 'CASCADE' });

  ServiceSlot.belongsTo(Service, { foreignKey: 'serviceId' });
  ServiceSlot.belongsTo(SlotTemplate, { foreignKey: 'slotTemplateId' });
  ServiceSlot.belongsTo(Song, { foreignKey: 'songId' });

  SlotTemplate.belongsTo(Congregation, { foreignKey: 'congregationId' });
  SlotTemplate.hasMany(ServiceSlot, { foreignKey: 'slotTemplateId' });

  Song.hasMany(ServiceSlot, { foreignKey: 'songId' });
  Song.belongsTo(Song, { foreignKey: 'translationOfId', as: 'translationOf', onDelete: 'SET NULL' });
  Song.hasMany(Song, { foreignKey: 'translationOfId', as: 'translations' });
}
