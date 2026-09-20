import { Component, OnInit, ViewChildren, QueryList, AfterViewInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDropList, CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
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
import { MonthNavigatorComponent } from './components/month-navigator/month-navigator.component';
import { ServiceCardComponent } from './components/service-card/service-card.component';
import { AddServiceDialogComponent } from './components/add-service-dialog/add-service-dialog.component';
import {
  Service, ServiceViewModel, ServiceSlotViewModel, SlotGroup, ConflictMap
} from './models/service.model';

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
export class MonthlyServicesViewComponent implements OnInit, AfterViewInit {
  @ViewChildren(CdkDropList) dropLists!: QueryList<CdkDropList>;

  selectedMonth: moment.Moment = moment().startOf('month');
  displayServices: ServiceViewModel[] = [];
  servicePairs: (ServiceViewModel | null)[][] = [];
  conflictMap: ConflictMap = {};
  allDropLists: CdkDropList[] = [];

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

  ngAfterViewInit(): void {
    this.dropLists.changes.subscribe(() => {
      this.allDropLists = this.dropLists.toArray();
      this.cdr.detectChanges();
    });
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
        this.conflictMap = this.conflictDetectionService.buildConflictMap(allSvcs);
        this.displayServices = displaySvcs.map(svc => this.toViewModel(svc));
        this.servicePairs = this.chunkPairs(this.displayServices);
        this.loading = false;
        // A successful load means auth is healthy again; clear any lingering
        // initiation-failure message so the banner does not stay stuck.
        this.authErrors.clear();
        this.cdr.detectChanges();
        this.allDropLists = this.dropLists.toArray();
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

  onDrop(event: CdkDragDrop<ServiceSlotViewModel[]>): void {
    if (event.previousContainer === event.container) return;

    const sourceSlot: ServiceSlotViewModel = event.item.data;
    const targetSlot: ServiceSlotViewModel = event.container.data[event.currentIndex];
    if (!targetSlot) return;

    const sourceServiceId = sourceSlot.serviceId;
    const targetServiceId = targetSlot.serviceId;

    const sourceService = this.displayServices.find(s => s.id === sourceServiceId);
    const targetService = this.displayServices.find(s => s.id === targetServiceId);
    if (!sourceService || !targetService) return;

    // Optimistic swap
    const origSourceSongId = sourceSlot.songId;
    const origTargetSongId = targetSlot.songId;
    sourceSlot.songId = origTargetSongId;
    targetSlot.songId = origSourceSongId;

    this.swapping = true;

    this.slotSwapService.swap(sourceSlot, targetSlot, sourceService, targetService).subscribe({
      next: ([updatedSource, updatedTarget]) => {
        const srcIdx = this.displayServices.findIndex(s => s.id === updatedSource.id);
        const tgtIdx = this.displayServices.findIndex(s => s.id === updatedTarget.id);
        if (srcIdx !== -1) this.displayServices[srcIdx] = this.toViewModel(updatedSource);
        if (tgtIdx !== -1) this.displayServices[tgtIdx] = this.toViewModel(updatedTarget);
        this.servicePairs = this.chunkPairs(this.displayServices);
        this.conflictMap = this.conflictDetectionService.buildConflictMap(this.displayServices);
        this.swapping = false;
      },
      error: () => {
        // Revert optimistic swap
        sourceSlot.songId = origSourceSongId;
        targetSlot.songId = origTargetSongId;
        this.swapping = false;
        this.snackBar.open('Failed to swap songs. Please try again.', 'Dismiss', { duration: 4000 });
      }
    });
  }

  private toViewModel(svc: Service): ServiceViewModel {
    const slotViewModels: ServiceSlotViewModel[] = svc.serviceSlots.map(slot => ({
      ...slot,
      canonicalNumber: slot.song?.translationOf?.number ?? slot.song?.number ?? ''
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

  private chunkPairs(services: ServiceViewModel[]): (ServiceViewModel | null)[][] {
    const pairs: (ServiceViewModel | null)[][] = [];
    for (let i = 0; i < services.length; i += 2) {
      pairs.push([services[i], services[i + 1] ?? null]);
    }
    return pairs;
  }
}
