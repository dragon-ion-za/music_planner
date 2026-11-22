import { QueryInterface } from 'sequelize';
import { seedSongsFromCsv } from '../../seeds/seedSongsFromCsv';
import { Song } from '../../models/Song';

/**
 * One-time data migration: load the song repertoire from the pipe-delimited
 * `.data/repertoir.csv` (the canonical song source) into the `songs` table.
 *
 * Delegates to the shared `seedSongsFromCsv` loader so the parse/upsert logic
 * lives in one place. The loader upserts on the unique song `number`, so this
 * is safe to re-run; umzug also records it in SequelizeMeta to apply it once.
 *
 * Runs before the Brentwood schedule import (007), which resolves song numbers
 * against the rows loaded here.
 */
export async function up(_ctx: { context: QueryInterface }): Promise<void> {
  // `name` is omitted: the column does not exist yet at this point; it is added
  // by migration 008.
  await seedSongsFromCsv({ includeName: false });
}

export async function down(_ctx: { context: QueryInterface }): Promise<void> {
  // Unlink translation self-references first so the rows can be removed without
  // violating the songs.translation_of_id foreign key.
  await Song.update({ translationOfId: null }, { where: {} });
  const removed = await Song.destroy({ where: {} });
  console.log(`Removed ${removed} songs.`);
}
