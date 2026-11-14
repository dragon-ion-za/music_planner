import { Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { ServicesApiService } from './services-api.service';
import { Service, ServiceSlotViewModel, ServiceViewModel, SlotInput } from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class SlotSwapService {
  constructor(private servicesApiService: ServicesApiService) {}

  /**
   * Swap two slots that belong to the same service with a single PUT. Two
   * separate PUTs (as in swap()) would each send the whole slot list and the
   * second would overwrite the first.
   */
  swapWithinService(
    service: ServiceViewModel,
    slotA: ServiceSlotViewModel,
    slotB: ServiceSlotViewModel
  ): Observable<Service> {
    const slots: SlotInput[] = service.serviceSlots.map(s => ({
      slotKey: s.slotTemplate.slotKey,
      songId: s.id === slotA.id ? slotB.songId : s.id === slotB.id ? slotA.songId : s.songId
    }));
    return this.servicesApiService.updateServiceSlots(service.id, slots);
  }

  swap(
    sourceSlot: ServiceSlotViewModel,
    targetSlot: ServiceSlotViewModel,
    sourceService: ServiceViewModel,
    targetService: ServiceViewModel
  ): Observable<[Service, Service]> {
    const sourceSlots: SlotInput[] = sourceService.serviceSlots.map(s => ({
      slotKey: s.slotTemplate.slotKey,
      songId: s.id === sourceSlot.id ? targetSlot.songId : s.songId
    }));

    const targetSlots: SlotInput[] = targetService.serviceSlots.map(s => ({
      slotKey: s.slotTemplate.slotKey,
      songId: s.id === targetSlot.id ? sourceSlot.songId : s.songId
    }));

    return forkJoin([
      this.servicesApiService.updateServiceSlots(sourceService.id, sourceSlots),
      this.servicesApiService.updateServiceSlots(targetService.id, targetSlots)
    ]) as Observable<[Service, Service]>;
  }
}
