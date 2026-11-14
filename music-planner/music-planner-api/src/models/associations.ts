import { Congregation } from './Congregation';
import { SlotTemplate } from './SlotTemplate';
import { Song } from './Song';
import { Service } from './Service';
import { ServiceSlot } from './ServiceSlot';

export function initAssociations(): void {
  // Idempotent: several callers (migrations, seeds, routes) invoke this in the
  // same process, and Sequelize throws on duplicate aliased associations.
  // Checked per model class so tests that re-create models still get wired up.
  if (Song.associations?.translationOf) return;

  Congregation.hasMany(SlotTemplate, { foreignKey: 'congregationId', onDelete: 'CASCADE' });
  Congregation.hasMany(Service, { foreignKey: 'congregationId', onDelete: 'CASCADE' });

  Service.belongsTo(Congregation, { foreignKey: 'congregationId' });
  // Explicit aliases so the JSON shape matches the API contract
  // (serviceSlots / slotTemplate / song). Without `as`, Sequelize would emit
  // ServiceSlots / SlotTemplate / Song, so each relation must be defined once.
  Service.hasMany(ServiceSlot, { foreignKey: 'serviceId', as: 'serviceSlots', onDelete: 'CASCADE' });

  ServiceSlot.belongsTo(Service, { foreignKey: 'serviceId' });
  ServiceSlot.belongsTo(SlotTemplate, { foreignKey: 'slotTemplateId', as: 'slotTemplate' });
  ServiceSlot.belongsTo(Song, { foreignKey: 'songId', as: 'song' });

  SlotTemplate.belongsTo(Congregation, { foreignKey: 'congregationId' });
  SlotTemplate.hasMany(ServiceSlot, { foreignKey: 'slotTemplateId' });

  Song.hasMany(ServiceSlot, { foreignKey: 'songId' });
  Song.belongsTo(Song, { foreignKey: 'translationOfId', as: 'translationOf', onDelete: 'SET NULL' });
  Song.hasMany(Song, { foreignKey: 'translationOfId', as: 'translations' });
}
