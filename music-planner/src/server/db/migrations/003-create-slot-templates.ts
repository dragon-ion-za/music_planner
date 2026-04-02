import { QueryInterface, DataTypes } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('slot_templates', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: queryInterface.sequelize.literal('gen_random_uuid()'),
    },
    congregation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'congregations',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    service_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slot_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
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
    'ALTER TABLE slot_templates ADD CONSTRAINT slot_templates_congregation_service_slot_unique UNIQUE (congregation_id, service_type, slot_key)'
  );
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('slot_templates');
}
