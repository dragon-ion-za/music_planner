import * as fs from 'fs';
import * as path from 'path';
import { initAssociations } from '../models/associations';
import { Song } from '../models/Song';

interface CsvRow {
  hymnal: string;
  number: string;
  name: string;
  translationNumber: string;
}

function parseCsv(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');

  // Skip header row
  const [, ...dataLines] = lines;

  return dataLines.map((line) => {
    // CSV format: Hymnal,Number,Name,TranslationNumber_HymnalE
    const parts = line.split(',');
    return {
      hymnal: parts[0]?.trim() ?? '',
      number: parts[1]?.trim() ?? '',
      name: parts[2]?.trim() ?? '',
      translationNumber: parts[3]?.trim() ?? '',
    };
  });
}

export async function seedSongsFromCsv(): Promise<void> {
  initAssociations();

  const filePath = path.resolve(__dirname, '../../../.data/repertoir.csv');
  const rows = parseCsv(filePath);

  console.log(`Parsed ${rows.length} rows from CSV.`);

  // Pass 1: upsert all songs
  let insertedCount = 0;
  for (const row of rows) {
    if (!row.number) continue;
    const number = row.number.toUpperCase();
    const hymnal = number.match(/^[A-Z]+/)?.[0] ?? '';

    await Song.upsert({
      number,
      hymnal,
      signature: null,
      tempo: null,
      familiarity: 0,
      translationOfId: null,
    });
    insertedCount++;
  }

  console.log(`Upserted ${insertedCount} songs.`);

  // Pass 2: link translations (column TranslationNumber_HymnalE)
  let linkedCount = 0;
  for (const row of rows) {
    if (!row.translationNumber) continue;

    const sourceNumber = row.number.toUpperCase();
    const targetNumber = row.translationNumber.toUpperCase();

    const source = await Song.findOne({ where: { number: sourceNumber } });
    const target = await Song.findOne({ where: { number: targetNumber } });

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
