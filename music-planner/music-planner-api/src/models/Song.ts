import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/sequelize';

export class Song extends Model {
  declare id: string;
  declare number: string;
  declare hymnal: string;
  declare translationOfId: string | null;
  declare signature: string | null;
  declare tempo: string | null;
  declare familiarity: number;
}

Song.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    number: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    hymnal: { type: DataTypes.STRING(10), allowNull: false },
    translationOfId: { type: DataTypes.UUID, allowNull: true },
    signature: { type: DataTypes.STRING(100), allowNull: true },
    tempo: { type: DataTypes.STRING(50), allowNull: true },
    familiarity: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    tableName: 'songs',
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ['hymnal'] }],
    hooks: {
      beforeCreate(song: Song) {
        song.number = song.number.toUpperCase();
        song.hymnal = song.number.match(/^[A-Z]+/)?.[0] ?? '';
      },
      beforeUpdate(song: Song) {
        if (song.changed('number')) {
          song.number = song.number.toUpperCase();
          song.hymnal = song.number.match(/^[A-Z]+/)?.[0] ?? '';
        }
      },
    },
  }
);
