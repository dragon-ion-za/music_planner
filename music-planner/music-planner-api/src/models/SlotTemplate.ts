import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/sequelize';

export class SlotTemplate extends Model {
  declare id: string;
  declare congregationId: string;
  declare serviceType: string;
  declare slotKey: string;
  declare displayOrder: number;
  declare category: string;
}

SlotTemplate.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    congregationId: { type: DataTypes.UUID, allowNull: false },
    serviceType: { type: DataTypes.STRING(100), allowNull: false },
    slotKey: { type: DataTypes.STRING(100), allowNull: false },
    displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    category: { type: DataTypes.STRING(50), allowNull: false },
  },
  {
    sequelize,
    tableName: 'slot_templates',
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ['congregation_id', 'service_type', 'slot_key'] }],
  }
);
