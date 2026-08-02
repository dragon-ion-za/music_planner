import moment from 'moment';
import { Service } from '../models/service.model';
import { RepertoireEntry } from '../models/repertoire.model';
import { SlotConflictStatus } from '../models/service.model';

export interface DraftSlot {
  slotKey: string;
  songNumber: string;  // non-empty, already validated as present in repertoire
}

export type ModalConflictMap = Record<string, SlotConflictStatus>;

export function buildModalConflictMap(
  windowServices: Service[],
  draftSlots: DraftSlot[],
  serviceDate: string,             // YYYY-MM-DD — date of the draft service
  repertoireMap: Map<string, RepertoireEntry>
): ModalConflictMap {
  // Step 1: Build occurrences from window services
  const windowOccurrences = windowServices.flatMap(svc =>
    svc.serviceSlots
      .filter(slot => slot.song !== null)
      .map(slot => ({
        slotId:          slot.id,
        serviceId:       svc.id,
        serviceDate:     svc.serviceDate,
        serviceType:     svc.serviceType,
        canonicalNumber: slot.song!.translationOf?.number ?? slot.song!.number
      }))
  );

  // Step 2: Build occurrences from draft slots
  const draftOccurrences = draftSlots
    .filter(slot => slot.songNumber.trim() !== '')
    .map(slot => {
      const entry = repertoireMap.get(slot.songNumber);
      const canonicalNumber = (entry?.translation && entry.translation !== '')
        ? entry.translation
        : slot.songNumber;
      return {
        slotId:          slot.slotKey,
        serviceId:       'draft',
        serviceDate:     serviceDate,
        serviceType:     'draft',
        canonicalNumber
      };
    });

  // Step 3: Combine all occurrences
  const allOccurrences = [...windowOccurrences, ...draftOccurrences];

  // Step 4+5: Build conflict map for each draft slot
  const conflictMap: ModalConflictMap = {};

  for (const D of draftOccurrences) {
    let worstSeverity: 'red' | 'yellow' | 'green' | null = null;
    const conflictingDates: Array<{ date: string; serviceType: string }> = [];

    for (const O of allOccurrences) {
      // Skip same draft slot
      if (O.serviceId === 'draft' && O.slotId === D.slotId) continue;
      // Skip different canonical number
      if (O.canonicalNumber !== D.canonicalNumber) continue;

      const diffDays = Math.abs(moment(D.serviceDate).diff(moment(O.serviceDate), 'days'));
      let severity: 'red' | 'yellow' | 'green' | null = null;

      if (diffDays <= 56) severity = 'red';
      else if (diffDays <= 90) severity = 'yellow';
      else if (diffDays <= 365) severity = 'green';
      // > 365 → null

      if (severity !== null) {
        conflictingDates.push({ date: O.serviceDate, serviceType: O.serviceType });
        // Update worst severity: red > yellow > green
        if (worstSeverity === null) worstSeverity = severity;
        else if (severity === 'red') worstSeverity = 'red';
        else if (severity === 'yellow' && worstSeverity === 'green') worstSeverity = 'yellow';
      }
    }

    conflictMap[D.slotId] = { severity: worstSeverity, conflictingDates };
  }

  return conflictMap;
}
