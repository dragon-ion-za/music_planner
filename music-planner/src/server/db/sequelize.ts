import { Sequelize } from 'sequelize';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  database: process.env['DB_NAME'] ?? 'music_planner',
  username: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? '',
  logging: process.env['NODE_ENV'] === 'development' ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
  },
});

export default sequelize;
