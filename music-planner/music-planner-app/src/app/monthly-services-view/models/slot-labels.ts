import { Song } from './service.model';

export const SLOT_LABEL_TABLE: Readonly<Record<string, string>> = {
  orchestra1: '1',
  orchestra2: '2',
  orchestra3: '3',
  orchestra4: '4',
  orchestra5: '5',
  choir1: '1',
  choir2: '2',
  choir3: '3',
  choir4: '4',
  congregationBS: 'Before Service',
  congregationOH: 'Opening Hymn',
  congregationRP: 'Repentance',
  congregationCM1: 'Communion 1',
  congregationCM2: 'Communion 2',
};

/** Unknown keys fall back to the raw slotKey (Req 6.5). */
export function getSlotLabel(slotKey: string): string {
  return Object.prototype.hasOwnProperty.call(SLOT_LABEL_TABLE, slotKey)
    ? SLOT_LABEL_TABLE[slotKey]
    : slotKey;
}

/** "<number> <name> (<translationOf.number>)"; name omitted when null/blank, brackets omitted without translation. */
export function formatHymnDisplayText(song: Song): string {
  const parts: string[] = [song.number];
  if (song.name && song.name.trim() !== '') {
    parts.push(song.name);
  }
  if (song.translationOf) {
    parts.push(`(${song.translationOf.number})`);
  }
  return parts.join(' ');
}
