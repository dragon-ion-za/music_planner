import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/sequelize';

export class ServiceSlot extends Model {
  declare id: string;
  declare serviceId: string;
  declare slotTemplateId: string;
  declare songId: string | null;
}

ServiceSlot.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    serviceId: { type: DataTypes.UUID, allowNull: false },
    slotTemplateId: { type: DataTypes.UUID, allowNull: false },
    songId: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    tableName: 'service_slots',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['service_id', 'slot_template_id'] },
      { fields: ['song_id', 'service_id'] },
    ],
  }
);
