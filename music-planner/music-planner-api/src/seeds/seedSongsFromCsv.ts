import * as fs from 'fs';
import * as path from 'path';
import { initAssociations } from '../models/associations';
import { Song } from '../models/Song';

export interface CsvRow {
  hymnal: string;
  number: string;
  name: string;
  translationNumber: string;
}

/**
 * Resolve the canonical pipe-delimited repertoire CSV. Prefers the copy bundled
 * into the API image under assets/, and falls back to the repo-root .data copy
 * for local development.
 */
export function resolveCsvPath(): string {
  const candidates = [
    path.resolve(__dirname, '../../assets/repertoir.csv'),
    path.resolve(__dirname, '../../../.data/repertoir.csv'),
    path.resolve(__dirname, '../../../../.data/repertoir.csv'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`repertoir.csv not found. Looked in:\n  ${candidates.join('\n  ')}`);
}

export function parseCsv(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');

  // Skip header row
  const [, ...dataLines] = lines;

  return dataLines.map((line) => {
    // Pipe-delimited format: Hymnal|Number|Name|TranslationNumber_HymnalE (names contain commas)
    const parts = line.split('|');
    return {
      hymnal: parts[0]?.trim() ?? '',
      number: parts[1]?.trim() ?? '',
      name: parts[2]?.trim() ?? '',
      translationNumber: parts[3]?.trim() ?? '',
    };
  });
}

export async function seedSongsFromCsv(options: { includeName?: boolean } = {}): Promise<void> {
  const includeName = options.includeName ?? true;
  initAssociations();

  const filePath = resolveCsvPath();
  const rows = parseCsv(filePath);

  console.log(`Parsed ${rows.length} rows from CSV.`);

  // Pass 1: upsert all songs
  let insertedCount = 0;
  for (const row of rows) {
    if (!row.number) continue;
    const number = row.number.toUpperCase();
    const hymnal = number.match(/^[A-Z]+/)?.[0] ?? '';

    const values = {
      number,
      hymnal,
      signature: null,
      tempo: null,
      familiarity: 0,
      translationOfId: null,
    };

    if (includeName) {
      await Song.upsert({ ...values, name: row.name.trim() || null });
    } else {
      // Omit name so the SQL never references a column that may not exist yet (migration 006).
      await Song.upsert(values, {
        fields: ['number', 'hymnal', 'signature', 'tempo', 'familiarity', 'translationOfId'],
      });
    }
    insertedCount++;
  }

  console.log(`Upserted ${insertedCount} songs.`);

  // Pass 2: link translations (column TranslationNumber_HymnalE)
  let linkedCount = 0;
  for (const row of rows) {
    if (!row.translationNumber) continue;

    const sourceNumber = row.number.toUpperCase();
    const targetNumber = row.translationNumber.toUpperCase();

    const source = await Song.findOne({ where: { number: sourceNumber }, attributes: ['id', 'number'] });
    const target = await Song.findOne({ where: { number: targetNumber }, attributes: ['id', 'number'] });

    if (source && target) {
      await source.update({ translationOfId: target.id });
      linkedCount++;
    } else if (source && !target) {
      console.warn(`Translation target not found: ${targetNumber} (for ${sourceNumber})`);
    }
  }

  console.log(`Linked ${linkedCount} translations.`);
}

if (require.main === module) {
  seedSongsFromCsv()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
