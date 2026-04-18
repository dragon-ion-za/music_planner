import { Sequelize, DataTypes } from 'sequelize';
import { Congregation } from '../models/Congregation';
import { SlotTemplate } from '../models/SlotTemplate';
import { Song } from '../models/Song';
import { Service } from '../models/Service';
import { ServiceSlot } from '../models/ServiceSlot';
import { initAssociations } from '../models/associations';

export const testSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

function reinitModels(): void {
  Congregation.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'UTC' },
    },
    { sequelize: testSequelize, tableName: 'congregations', underscored: true, timestamps: true }
  );

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
      sequelize: testSequelize,
      tableName: 'slot_templates',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['congregation_id', 'service_type', 'slot_key'] }],
    }
  );

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
      sequelize: testSequelize,
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

  Service.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      congregationId: { type: DataTypes.UUID, allowNull: false },
      serviceDate: { type: DataTypes.DATEONLY, allowNull: false },
      serviceType: { type: DataTypes.STRING(100), allowNull: false },
    },
    {
      sequelize: testSequelize,
      tableName: 'services',
      underscored: true,
      timestamps: true,
      indexes: [
        { unique: true, fields: ['congregation_id', 'service_date', 'service_type'] },
        { fields: ['congregation_id', 'service_date'] },
      ],
    }
  );

  ServiceSlot.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      serviceId: { type: DataTypes.UUID, allowNull: false },
      slotTemplateId: { type: DataTypes.UUID, allowNull: false },
      songId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize: testSequelize,
      tableName: 'service_slots',
      underscored: true,
      timestamps: true,
      indexes: [
        { unique: true, fields: ['service_id', 'slot_template_id'] },
        { fields: ['song_id', 'service_id'] },
      ],
    }
  );
}

export async function setupTestDb(): Promise<void> {
  reinitModels();
  initAssociations();
  await testSequelize.sync({ force: true });
}

export async function teardownTestDb(): Promise<void> {
  await testSequelize.close();
}
