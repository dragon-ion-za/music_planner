import sequelize from '../db/sequelize';
import { seedCongregation } from './seedCongregation';
import { seedSlotTemplates } from './seedSlotTemplates';
import { seedSongs } from './seedSongs';

/**
 * Idempotent initial-data seed used by the Docker one-shot init step.
 *
 * Seeds, in order:
 *  1. The first congregation ("Brentwood Park").
 *  2. Its default slot templates (congregation id passed in-process, no stdout
 *     parsing needed).
 *  3. The song repertoire from assets/repertoire.json (bundled into the API
 *     image; congregation-independent).
 *
 * All underlying seeds use find-or-create / upsert, so re-running is safe.
 */
export async function seedInit(): Promise<void> {
  const congregation = await seedCongregation();
  await seedSlotTemplates(congregation.id);
  await seedSongs();
  console.log('Initial data seed complete.');
}

if (require.main === module) {
  seedInit()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async (err: unknown) => {
      console.error('Initial data seed failed:', err);
      await sequelize.close();
      process.exit(1);
    });
}
