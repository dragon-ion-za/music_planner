import { QueryInterface, DataTypes } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('service_slots', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: queryInterface.sequelize.literal('gen_random_uuid()'),
    },
    service_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'services',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    slot_template_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'slot_templates',
        key: 'id',
      },
    },
    song_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'songs',
        key: 'id',
      },
    },
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
    'ALTER TABLE service_slots ADD CONSTRAINT service_slots_service_slot_template_unique UNIQUE (service_id, slot_template_id)'
  );

  await queryInterface.sequelize.query(
    'CREATE INDEX service_slots_song_service_idx ON service_slots (song_id, service_id)'
  );
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('service_slots');
}
