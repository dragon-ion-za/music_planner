import moment from 'moment';

import { CreateServicePayload, Service } from '../models/service.model';
import { SLOT_TEMPLATES } from '../components/add-service-dialog/add-service-dialog.component';

export const EMPTY_SONG = 'N/A';

/** Returns null for blank or 'N/A' (any case); otherwise the trimmed value. */
export function normalizeSongInput(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (trimmed === '' || trimmed.toUpperCase() === EMPTY_SONG) {
    return null;
  }
  return trimmed;
}

/** Lowercase song number -> canonical number. */
export function buildSongLookup(entries: { number: string }[]): Map<string, string> {
  return new Map(entries.map(e => [e.number.toLowerCase(), e.number]));
}

/**
 * Trims, ignores letter case, returns the canonical number.
 * Returns null for blank, 'N/A' (any case) and text not in the repertoire.
 */
export function resolveSongNumber(
  value: string | null | undefined,
  lookup: Map<string, string>
): string | null {
  const normalized = normalizeSongInput(value);
  if (normalized === null) {
    return null;
  }
  return lookup.get(normalized.toLowerCase()) ?? null;
}

/** Maps a service's slots to { [slotKey]: songNumber }. Slots without a song are omitted. */
export function slotsFromService(service: Service): Record<string, string> {
  const result: Record<string, string> = {};
  for (const slot of service.serviceSlots ?? []) {
    const key = slot.slotTemplate?.slotKey;
    if (key && slot.song) {
      result[key] = slot.song.number;
    }
  }
  return result;
}

/** Builds the PUT/POST body with exactly 14 slot entries in SLOT_TEMPLATES order. */
export function buildServicePayload(
  serviceDate: moment.Moment,
  serviceType: string,
  slots: { slotKey: string; songNumber: string }[],
  songLookup?: Map<string, string>
): CreateServicePayload {
  const byKey = new Map(slots.map(s => [s.slotKey, s.songNumber]));
  return {
    serviceDate: serviceDate.format('YYYY-MM-DD'),
    serviceType: serviceType.trim(),
    slots: SLOT_TEMPLATES.map(t => {
      const normalized = normalizeSongInput(byKey.get(t.slotKey));
      return {
        slotKey: t.slotKey,
        songNumber: normalized === null
          ? null
          : (songLookup?.get(normalized.toLowerCase()) ?? normalized)
      };
    })
  };
}
