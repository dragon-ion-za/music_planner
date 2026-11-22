import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '@auth0/auth0-angular';
import moment from 'moment';
import { AuthErrorState } from '../auth-error-state.service';
import { ServicesApiService } from './services/services-api.service';
import { ConflictDetectionService } from './services/conflict-detection.service';
import { SlotSwapService } from './services/slot-swap.service';
import { buildServiceRows } from './services/service-rows.util';
import { MonthNavigatorComponent } from './components/month-navigator/month-navigator.component';
import { ServiceCardComponent } from './components/service-card/service-card.component';
import { AddServiceDialogComponent } from './components/add-service-dialog/add-service-dialog.component';
import {
  Service, ServiceViewModel, ServiceSlotViewModel, SlotGroup, ConflictMap, Song
} from './models/service.model';
import { getSlotLabel, formatHymnDisplayText } from './models/slot-labels';

@Component({
  selector: 'app-monthly-services-view',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatButtonModule,
    MonthNavigatorComponent,
    ServiceCardComponent
  ],
  templateUrl: './monthly-services-view.component.html',
  styleUrl: './monthly-services-view.component.css'
})
export class MonthlyServicesViewComponent implements OnInit {
  selectedMonth: moment.Moment = moment().startOf('month');
  displayServices: ServiceViewModel[] = [];
  servicePairs: (ServiceViewModel | null)[][] = [];
  conflictMap: ConflictMap = {};
  // Slot currently under a dragged item (valid swap target), for highlighting
  hoverSlotId: string | null = null;
  // Full ±12 month window used for conflict detection (superset of displayServices)
  private windowServices: Service[] = [];

  loading = false;
  swapping = false;
  authError = false;
  authErrorMessage: string | null = null;
  error: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private servicesApiService: ServicesApiService,
    private conflictDetectionService: ConflictDetectionService,
    private slotSwapService: SlotSwapService,
    private auth: AuthService,
    private authErrors: AuthErrorState,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Surface Auth0 SDK authentication failures (e.g. a failed or cancelled
    // return from Auth0) in the Auth_Error_Banner. The SDK leaves
    // isAuthenticated$ at false, so the Auth_Control returns to the
    // Unauthenticated_State on its own. (Requirements 1.7, 5.4)
    this.auth.error$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.authError = true;
        this.cdr.detectChanges();
      });

    // Surface authentication *initiation* failures (a failed login/logout
    // redirect from AuthButtonComponent) in the Auth_Error_Banner via the
    // shared AuthErrorState channel — avoiding shell↔child coupling.
    // (Requirements 2.4, 3.4)
    this.authErrors.message$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(message => {
        if (message) {
          this.authError = true;
          this.authErrorMessage = message;
          this.cdr.detectChanges();
        }
      });

    this.loadServices(this.selectedMonth);
  }

  onMonthChange(month: moment.Moment): void {
    this.selectedMonth = month;
    this.loadServices(month);
  }

  openAddServiceDialog(): void {
    const dialogRef = this.dialog.open(AddServiceDialogComponent, {
      width: '800px',
      disableClose: true
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'saved') {
        this.loadServices(this.selectedMonth);
      }
    });
  }

  openEditServiceDialog(service: Service): void {
    const dialogRef = this.dialog.open(AddServiceDialogComponent, {
      width: '800px',
      disableClose: true,
      data: { service }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'saved') {
        this.loadServices(this.selectedMonth);
      }
    });
  }

  loadServices(month: moment.Moment): void {
    this.loading = true;
    this.error = null;
    this.authError = false;
    this.authErrorMessage = null;

    const displayFrom = month.clone().startOf('month').format('YYYY-MM-DD');
    const displayTo = month.clone().endOf('month').format('YYYY-MM-DD');
    const conflictFrom = month.clone().subtract(12, 'months').startOf('month').format('YYYY-MM-DD');
    const conflictTo = month.clone().add(12, 'months').endOf('month').format('YYYY-MM-DD');

    forkJoin([
      this.servicesApiService.getServices(displayFrom, displayTo),
      this.servicesApiService.getServices(conflictFrom, conflictTo)
    ]).subscribe({
      next: ([displaySvcs, allSvcs]) => {
        this.windowServices = allSvcs;
        this.conflictMap = this.conflictDetectionService.buildConflictMap(allSvcs);
        this.displayServices = displaySvcs.map(svc => this.toViewModel(svc));
        this.servicePairs = buildServiceRows(this.displayServices);
        this.loading = false;
        // A successful load means auth is healthy again; clear any lingering
        // initiation-failure message so the banner does not stay stuck.
        this.authErrors.clear();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.displayServices = [];
        this.servicePairs = [];
        console.log(err);
        if (err.status === 401) {
          this.authError = true;
        } else {
          this.error = err.status >= 500
            ? 'Server error, please try again.'
            : err.status === 403
              ? 'Access denied.'
              : `Error loading services (${err.status}).`;
        }
      }
    });
  }

  onSlotDragMoved(event: { slot: ServiceSlotViewModel; point: { x: number; y: number } }): void {
    const allSlots = this.displayServices.flatMap(s => s.serviceSlots);
    const target = this.findSlotAtPoint(event.point, allSlots, event.slot.id);
    const id = target ? target.id : null;
    if (id !== this.hoverSlotId) this.hoverSlotId = id;
  }

  onSlotDropped(event: { slot: ServiceSlotViewModel; point: { x: number; y: number } }): void {
    this.hoverSlotId = null;
    if (this.swapping) return;
    const sourceSlot = event.slot;

    // The drop lists are deliberately not connected, so the drag placeholder
    // never moves into another card (that made the first slot the pointer
    // touched the only possible target). Instead, find whichever slot is under
    // the pointer when the drag ends, in any service card.
    const allSlots = this.displayServices.flatMap(s => s.serviceSlots);
    const targetSlot = this.findSlotAtPoint(event.point, allSlots, sourceSlot.id);
    if (!targetSlot) return;

    const sourceServiceId = sourceSlot.serviceId;
    const targetServiceId = targetSlot.serviceId;

    const sourceService = this.displayServices.find(s => s.id === sourceServiceId);
    const targetService = this.displayServices.find(s => s.id === targetServiceId);
    if (!sourceService || !targetService) return;

    // Build the swap request BEFORE the optimistic update: swap() computes its
    // payload from the slots' current songIds, so mutating them first would make
    // both PUTs a no-op (each slot would be sent its own song back).
    // Same-service swaps use one PUT; cross-service swaps use one PUT per service.
    const swap$: Observable<[Service, Service]> = sourceService.id === targetService.id
      ? this.slotSwapService.swapWithinService(sourceService, sourceSlot, targetSlot)
          .pipe(map(updated => [updated, updated] as [Service, Service]))
      : this.slotSwapService.swap(sourceSlot, targetSlot, sourceService, targetService);

    // Optimistic swap
    const origSourceSongId = sourceSlot.songId;
    const origTargetSongId = targetSlot.songId;
    const origSourceSong = sourceSlot.song;
    const origTargetSong = targetSlot.song;
    this.applySong(sourceSlot, origTargetSongId, origTargetSong);
    this.applySong(targetSlot, origSourceSongId, origSourceSong);

    this.swapping = true;

    swap$.subscribe({
      next: ([updatedSource, updatedTarget]) => {
        const srcIdx = this.displayServices.findIndex(s => s.id === updatedSource.id);
        const tgtIdx = this.displayServices.findIndex(s => s.id === updatedTarget.id);
        if (srcIdx !== -1) this.displayServices[srcIdx] = this.toViewModel(updatedSource);
        if (tgtIdx !== -1) this.displayServices[tgtIdx] = this.toViewModel(updatedTarget);
        this.servicePairs = buildServiceRows(this.displayServices);
        // Rebuild against the full conflict window, with the two updated services swapped in
        this.windowServices = this.windowServices.map(s =>
          s.id === updatedSource.id ? updatedSource : s.id === updatedTarget.id ? updatedTarget : s
        );
        this.conflictMap = this.conflictDetectionService.buildConflictMap(this.windowServices);
        this.swapping = false;
      },
      error: () => {
        // Revert optimistic swap
        this.applySong(sourceSlot, origSourceSongId, origSourceSong);
        this.applySong(targetSlot, origTargetSongId, origTargetSong);
        this.swapping = false;
        this.snackBar.open('Failed to swap songs. Please try again.', 'Dismiss', { duration: 4000 });
      }
    });
  }

  private findSlotAtPoint(
    point: { x: number; y: number },
    candidates: ServiceSlotViewModel[],
    excludeSlotId: string
  ): ServiceSlotViewModel | undefined {
    const elements = document.elementsFromPoint(point.x, point.y);
    for (const el of elements) {
      const slotEl = el.closest('[data-slot-id]');
      const id = slotEl?.getAttribute('data-slot-id');
      if (!id || id === excludeSlotId) continue;
      const match = candidates.find(s => s.id === id);
      if (match) return match;
    }
    return undefined;
  }

  /** Sets a slot's song and recomputes every field derived from it. */
  private applySong(slot: ServiceSlotViewModel, songId: string | null, song: Song | null): void {
    slot.songId = songId;
    slot.song = song;
    slot.canonicalNumber = song?.translationOf?.number ?? song?.number ?? '';
    slot.slotLabel = getSlotLabel(slot.slotTemplate.slotKey);
    slot.hymnDisplayText = song ? formatHymnDisplayText(song) : null;
  }

  private toViewModel(svc: Service): ServiceViewModel {
    const slotViewModels: ServiceSlotViewModel[] = (svc.serviceSlots ?? []).map(slot => ({
      ...slot,
      canonicalNumber: slot.song?.translationOf?.number ?? slot.song?.number ?? '',
      slotLabel: getSlotLabel(slot.slotTemplate.slotKey),
      hymnDisplayText: slot.song ? formatHymnDisplayText(slot.song) : null
    }));

    const categoryOrder: Record<string, number> = { orchestra: 0, choir: 1, congregation: 2 };
    const grouped = slotViewModels.reduce((acc, slot) => {
      const cat = slot.slotTemplate.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(slot);
      return acc;
    }, {} as Record<string, ServiceSlotViewModel[]>);

    const slotGroups: SlotGroup[] = Object.entries(grouped)
      .sort(([a], [b]) => (categoryOrder[a] ?? 99) - (categoryOrder[b] ?? 99))
      .map(([category, slots]) => ({
        category: category as SlotGroup['category'],
        slots: slots.sort((a, b) => a.slotTemplate.displayOrder - b.slotTemplate.displayOrder)
      }));

    return { ...svc, serviceSlots: slotViewModels, slotGroups };
  }
}
