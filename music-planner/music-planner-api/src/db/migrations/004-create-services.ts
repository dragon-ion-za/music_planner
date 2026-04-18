import { QueryInterface, DataTypes } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('services', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: queryInterface.sequelize.literal('gen_random_uuid()'),
    },
    congregation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'congregations', key: 'id' },
      onDelete: 'CASCADE',
    },
    service_date: { type: DataTypes.DATEONLY, allowNull: false },
    service_type: { type: DataTypes.STRING(100), allowNull: false },
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
    'ALTER TABLE services ADD CONSTRAINT services_congregation_date_type_unique UNIQUE (congregation_id, service_date, service_type)'
  );
  await queryInterface.sequelize.query(
    'CREATE INDEX services_congregation_date_idx ON services (congregation_id, service_date)'
  );
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('services');
}
