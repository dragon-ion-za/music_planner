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
  slots: { slotKey: string; songNumber: string }[]
): CreateServicePayload {
  const byKey = new Map(slots.map(s => [s.slotKey, s.songNumber]));
  return {
    serviceDate: serviceDate.format('YYYY-MM-DD'),
    serviceType: serviceType.trim(),
    slots: SLOT_TEMPLATES.map(t => ({
      slotKey: t.slotKey,
      songNumber: normalizeSongInput(byKey.get(t.slotKey))
    }))
  };
}
