import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/sequelize';

export class Congregation extends Model {
  declare id: string;
  declare name: string;
  declare timezone: string;
}

Congregation.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'UTC' },
  },
  {
    sequelize,
    tableName: 'congregations',
    underscored: true,
    timestamps: true,
  }
);
