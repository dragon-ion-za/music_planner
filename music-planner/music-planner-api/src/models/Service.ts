import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/sequelize';

export class Service extends Model {
  declare id: string;
  declare congregationId: string;
  declare serviceDate: string;
  declare serviceType: string;
}

Service.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    congregationId: { type: DataTypes.UUID, allowNull: false },
    serviceDate: { type: DataTypes.DATEONLY, allowNull: false },
    serviceType: { type: DataTypes.STRING(100), allowNull: false },
  },
  {
    sequelize,
    tableName: 'services',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['congregation_id', 'service_date', 'service_type'] },
      { fields: ['congregation_id', 'service_date'] },
    ],
  }
);
