import { initAssociations } from '../models/associations';
import { Congregation } from '../models/Congregation';

const CONGREGATION_NAME = 'Brentwood Park';
const CONGREGATION_TIMEZONE = 'Africa/Johannesburg'; // UTC+2, no DST

export async function seedCongregation(): Promise<Congregation> {
  initAssociations();

  const [congregation, created] = await Congregation.findOrCreate({
    where: { name: CONGREGATION_NAME },
    defaults: { name: CONGREGATION_NAME, timezone: CONGREGATION_TIMEZONE },
  });

  // Keep the timezone in sync if the congregation already existed with a
  // different value (e.g. the default 'UTC' from an earlier seed run).
  if (!created && congregation.timezone !== CONGREGATION_TIMEZONE) {
    await congregation.update({ timezone: CONGREGATION_TIMEZONE });
  }

  console.log(
    `${created ? 'Created' : 'Found existing'} congregation "${CONGREGATION_NAME}" ` +
    `(${congregation.id}, ${CONGREGATION_TIMEZONE}).`
  );

  return congregation;
}

if (require.main === module) {
  seedCongregation()
    .then((congregation) => {
      console.log(congregation.id);
      process.exit(0);
    })
    .catch((err) => { console.error(err); process.exit(1); });
}
