import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';
import { resolveCsvPath, parseCsv, CsvRow } from '../../seeds/seedSongsFromCsv';

/**
 * Adds a nullable `songs.name` column and backfills it from the repertoire CSV.
 * Uses raw queryInterface/SQL only so it depends on the schema at this point in
 * history, not on the current `Song` model.
 */
export async function backfillSongNames(qi: QueryInterface, rows: CsvRow[]): Promise<void> {
  const existing = await qi.sequelize.query<{ number: string }>(
    'SELECT number FROM songs',
    { type: QueryTypes.SELECT },
  );
  const known = new Set(existing.map((r) => r.number.toUpperCase()));

  for (const row of rows) {
    if (!row.number) continue;
    const key = row.number.toUpperCase();
    if (!known.has(key)) {
      console.warn(`Name backfill: no song for CSV number ${key}`);
      continue;
    }
    const name = (row.name ?? '').trim();
    if (!name) continue;
    await qi.sequelize.query(
      'UPDATE songs SET name = :name WHERE UPPER(number) = :number AND name IS NULL',
      { replacements: { name: name.slice(0, 255), number: key } },
    );
  }
}

export async function up({ context: qi }: { context: QueryInterface }): Promise<void> {
  const table = await qi.describeTable('songs');
  if (!table['name']) {
    await qi.addColumn('songs', 'name', { type: DataTypes.STRING(255), allowNull: true });
  }
  await backfillSongNames(qi, parseCsv(resolveCsvPath()));
}

export async function down({ context: qi }: { context: QueryInterface }): Promise<void> {
  await qi.removeColumn('songs', 'name');
}
