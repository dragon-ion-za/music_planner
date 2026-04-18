import * as fs from 'fs';
import * as path from 'path';
import { initAssociations } from '../models/associations';
import { Song } from '../models/Song';

interface RepertoireEntry {
  number: string;
  translation: string;
  signature: string;
  tempo: string;
  familiarity: number;
}

interface Repertoire {
  songs: RepertoireEntry[];
}

export async function seedSongs(): Promise<void> {
  initAssociations();

  const filePath = path.join(__dirname, '../../assets/repertoire.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: Repertoire = JSON.parse(raw);

  for (const entry of data.songs) {
    const number = entry.number.toUpperCase();
    const hymnal = number.match(/^[A-Z]+/)?.[0] ?? '';
    await Song.upsert({
      number,
      hymnal,
      signature: entry.signature || null,
      tempo: entry.tempo || null,
      familiarity: entry.familiarity ?? 0,
      translationOfId: null,
    });
  }

  for (const entry of data.songs) {
    if (!entry.translation) continue;
    const source = await Song.findOne({ where: { number: entry.number.toUpperCase() } });
    const target = await Song.findOne({ where: { number: entry.translation.toUpperCase() } });
    if (source && target) {
      await source.update({ translationOfId: target.id });
    } else if (source && !target) {
      console.warn(`Translation target not found: ${entry.translation.toUpperCase()} (for ${entry.number.toUpperCase()})`);
    }
  }

  console.log(`Seeded ${data.songs.length} songs.`);
}

if (require.main === module) {
  seedSongs()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
