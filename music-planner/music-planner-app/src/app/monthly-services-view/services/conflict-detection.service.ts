import { Injectable } from '@angular/core';
import moment from 'moment';
import { Service, ConflictMap, SlotConflictStatus } from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class ConflictDetectionService {
  buildConflictMap(allServices: Service[]): ConflictMap {
    const conflictMap: ConflictMap = {};

    // Build flat list of all occupied slot occurrences
    const occurrences = allServices.flatMap(svc =>
      svc.serviceSlots
        .filter(slot => slot.songId !== null && slot.song !== null)
        .map(slot => ({
          slotId: slot.id,
          serviceId: svc.id,
          serviceDate: svc.serviceDate,
          serviceType: svc.serviceType,
          canonicalNumber: slot.song!.translationOf?.number ?? slot.song!.number
        }))
    );

    for (const occ of occurrences) {
      let worstSeverity: 'red' | 'yellow' | 'green' | null = null;
      const conflictingDates: Array<{ date: string; serviceType: string }> = [];

      for (const other of occurrences) {
        // Skip same slot (same service + same slot id); same service different slot is included (Req 7.7)
        if (other.serviceId === occ.serviceId && other.slotId === occ.slotId) continue;
        if (other.canonicalNumber !== occ.canonicalNumber) continue;

        const diffDays = Math.abs(moment(occ.serviceDate).diff(moment(other.serviceDate), 'days'));
        let severity: 'red' | 'yellow' | 'green' | null = null;

        if (diffDays <= 56) severity = 'red';
        else if (diffDays <= 90) severity = 'yellow';
        else if (diffDays <= 365) severity = 'green';

        if (severity !== null) {
          conflictingDates.push({ date: other.serviceDate, serviceType: other.serviceType });
          // Apply worst severity precedence: red > yellow > green > null
          if (severity === 'red') worstSeverity = 'red';
          else if (severity === 'yellow' && worstSeverity !== 'red') worstSeverity = 'yellow';
          else if (severity === 'green' && worstSeverity === null) worstSeverity = 'green';
        }
      }

      conflictMap[occ.slotId] = {
        severity: worstSeverity,
        conflictingDates
      };
    }

    return conflictMap;
  }
}
