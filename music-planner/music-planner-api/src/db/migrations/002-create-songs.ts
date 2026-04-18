import { QueryInterface, DataTypes } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('songs', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: queryInterface.sequelize.literal('gen_random_uuid()'),
    },
    number: { type: DataTypes.STRING(20), allowNull: false },
    hymnal: { type: DataTypes.STRING(10), allowNull: false },
    translation_of_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'songs', key: 'id' },
      onDelete: 'SET NULL',
    },
    signature: { type: DataTypes.STRING(100), allowNull: true },
    tempo: { type: DataTypes.STRING(50), allowNull: true },
    familiarity: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: queryInterface.sequelize.literal('NOW()'),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: queryInterface.sequelize.literal('NOW()'),
    },
  });
  await queryInterface.sequelize.query(
    'ALTER TABLE songs ADD CONSTRAINT songs_number_unique UNIQUE (number)'
  );
  await queryInterface.sequelize.query('CREATE INDEX songs_hymnal_idx ON songs (hymnal)');
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('songs');
}
