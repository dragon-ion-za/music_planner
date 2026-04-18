import path from 'path';
import { Umzug, SequelizeStorage } from 'umzug';
import sequelize from './sequelize';

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, 'migrations/*.ts'),
    resolve: ({ name, path: migrationPath, context }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const migration = require(migrationPath!);
      return {
        name,
        up: async () => migration.up({ context }),
        down: async () => migration.down({ context }),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

export async function runMigrations(): Promise<void> {
  await umzug.up();
}

export async function rollbackMigrations(): Promise<void> {
  await umzug.down();
}

if (require.main === module) {
  const command = process.argv[2] ?? 'up';
  const action = command === 'down' ? rollbackMigrations : runMigrations;
  action()
    .then(() => {
      console.log(`Migrations ${command} complete.`);
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
