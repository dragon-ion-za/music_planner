import { Component, Inject, OnInit, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import moment from 'moment';
import { ServicesApiService } from '../../services/services-api.service';
import { RepertoireEntry } from '../../models/repertoire.model';
import { Service, SlotConflictStatus } from '../../models/service.model';
import { buildModalConflictMap, DraftSlot } from '../../services/modal-conflict.util';
import { buildServicePayload, normalizeSongInput, slotsFromService } from '../../services/service-form.util';
import repertoireData from '../../../../assets/repertoire.json';

export const SLOT_TEMPLATES = [
  { slotKey: 'orchestra1',       category: 'orchestra'     as const, displayOrder: 1  },
  { slotKey: 'orchestra2',       category: 'orchestra'     as const, displayOrder: 2  },
  { slotKey: 'orchestra3',       category: 'orchestra'     as const, displayOrder: 3  },
  { slotKey: 'orchestra4',       category: 'orchestra'     as const, displayOrder: 4  },
  { slotKey: 'orchestra5',       category: 'orchestra'     as const, displayOrder: 5  },
  { slotKey: 'choir1',           category: 'choir'         as const, displayOrder: 6  },
  { slotKey: 'choir2',           category: 'choir'         as const, displayOrder: 7  },
  { slotKey: 'choir3',           category: 'choir'         as const, displayOrder: 8  },
  { slotKey: 'choir4',           category: 'choir'         as const, displayOrder: 9  },
  { slotKey: 'congregationBS',   category: 'congregation'  as const, displayOrder: 10 },
  { slotKey: 'congregationOH',   category: 'congregation'  as const, displayOrder: 11 },
  { slotKey: 'congregationRP',   category: 'congregation'  as const, displayOrder: 12 },
  { slotKey: 'congregationCM1',  category: 'congregation'  as const, displayOrder: 13 },
  { slotKey: 'congregationCM2',  category: 'congregation'  as const, displayOrder: 14 },
];

export const DIALOG_DATE_FORMATS = {
  parse: { dateInput: ['YYYY-MM-DD', 'LL'] },
  display: {
    dateInput: 'YYYY-MM-DD',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

export interface SlotState {
  slotKey: string;
  category: 'orchestra' | 'choir' | 'congregation';
  displayOrder: number;
  songNumber: string;
  filteredOptions: RepertoireEntry[];
  conflictStatus: SlotConflictStatus | null;
}

@Component({
  selector: 'app-add-service-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './add-service-dialog.component.html',
  styleUrl: './add-service-dialog.component.css',
  // Provided on the component (same approach as ScheduleComponent) rather than
  // via MatMomentDateModule: NgModule providers imported into a dialog's
  // standalone component are not reliably visible to the datepicker, which
  // caused "NullInjectorError: No provider for DateAdapter" (minified: "we").
  providers: [
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: DIALOG_DATE_FORMATS },
  ],
})
export class AddServiceDialogComponent implements OnInit {
  // --- form state ---
  serviceDate: moment.Moment | null = null;
  serviceType: string = '';
  submitAttempted: boolean = false;

  // --- slot state ---
  slotStates: SlotState[] = [];
  repertoire: RepertoireEntry[] = [];

  // --- conflict / save state ---
  saving: boolean = false;
  submitError: string | null = null;
  windowServices: Service[] = [];

  // --- private lookup structures ---
  protected repertoireMap = new Map<string, RepertoireEntry>();
  repertoireSet = new Set<string>();

  constructor(
    public dialogRef: MatDialogRef<AddServiceDialogComponent>,
    private servicesApiService: ServicesApiService,
    @Optional() @Inject(MAT_DIALOG_DATA) private data: { service?: Service } | null
  ) {}

  get editingService(): Service | null {
    return this.data?.service ?? null;
  }

  get isEditMode(): boolean {
    return this.editingService !== null;
  }

  hasSong(slot: SlotState): boolean {
    return normalizeSongInput(slot.songNumber) !== null;
  }

  /** True when the slot holds a non-empty, non-N/A value that is not in the repertoire. */
  isUnknownSong(slot: SlotState): boolean {
    const value = normalizeSongInput(slot.songNumber);
    return value !== null && !this.repertoireSet.has(value);
  }

  ngOnInit(): void {
    this.repertoire = (repertoireData as any).songs as RepertoireEntry[];
    this.repertoireMap = new Map(this.repertoire.map(e => [e.number, e]));
    this.repertoireSet = new Set(this.repertoire.map(e => e.number));
    this.slotStates = SLOT_TEMPLATES.map(t => ({
      ...t,
      songNumber: '',
      filteredOptions: [],
      conflictStatus: null,
    }));
    if (this.isEditMode) {
      const svc = this.editingService!;
      this.serviceDate = moment(svc.serviceDate, 'YYYY-MM-DD');
      this.serviceType = svc.serviceType;
      const numbers = slotsFromService(svc);
      for (const s of this.slotStates) {
        s.songNumber = numbers[s.slotKey] ?? '';
      }
    }
    this.buildSlotGroups();
    if (this.serviceDate) {
      this.fetchConflictWindow(this.serviceDate);
    }
  }

  // --- grouped slots for template rendering ---
  // Built once (not a getter): a getter returned fresh arrays/objects on every
  // change-detection pass, so *ngFor tore down and re-created all 14 inputs
  // (ngModel + autocomplete) each cycle and the page locked up.
  slotGroups: { category: string; slots: SlotState[] }[] = [];

  trackByCategory(_index: number, group: { category: string }): string {
    return group.category;
  }

  trackBySlotKey(_index: number, slot: SlotState): string {
    return slot.slotKey;
  }

  private buildSlotGroups(): void {
    this.slotGroups = (['orchestra', 'choir', 'congregation'] as const).map(category => ({
      category,
      slots: this.slotStates.filter(s => s.category === category),
    }));
  }

  // --- autocomplete ---
  filterOptions(slot: SlotState): void {
    const prefix = (slot.songNumber ?? '').toLowerCase();
    slot.filteredOptions = prefix.length === 0
      ? []
      : this.repertoire.filter(e => e.number.toLowerCase().startsWith(prefix));
    this.rebuildConflictMap();
  }

  optionDisplayFn(entry: RepertoireEntry | string | null): string {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    return entry.translation ? `${entry.number} (→ ${entry.translation})` : entry.number;
  }

  // --- validator factory ---
  repertoireValidatorFn(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const val: string = control.value ?? '';
      if (val === '') return null;
      return this.repertoireSet.has(val) ? null : { unknownSong: true };
    };
  }

  // --- conflict detection ---
  fetchConflictWindow(date: moment.Moment): void {
    const conflictFrom = date.clone().subtract(365, 'days').format('YYYY-MM-DD');
    const conflictTo = date.clone().add(365, 'days').format('YYYY-MM-DD');
    this.servicesApiService.getServices(conflictFrom, conflictTo).subscribe({
      next: (services) => {
        this.windowServices = services;
        this.rebuildConflictMap();
      },
      error: () => {
        // Suppress conflict badges on API error — form remains usable
        this.windowServices = [];
        this.rebuildConflictMap();
      }
    });
  }

  rebuildConflictMap(): void {
    if (!this.serviceDate) return;
    const serviceDateStr = this.serviceDate.format('YYYY-MM-DD');
    const draftSlots: DraftSlot[] = this.slotStates
      .filter(s => {
        const n = normalizeSongInput(s.songNumber);
        return n !== null && this.repertoireSet.has(n);
      })
      .map(s => ({ slotKey: s.slotKey, songNumber: normalizeSongInput(s.songNumber)! }));
    const conflictMap = buildModalConflictMap(
      this.windowServices,
      draftSlots,
      serviceDateStr,
      this.repertoireMap,
      this.editingService?.id
    );
    for (const slot of this.slotStates) {
      slot.conflictStatus = conflictMap[slot.slotKey] ?? null;
    }
  }

  onDateChange(date: moment.Moment | null): void {
    this.serviceDate = date;
    if (date) {
      this.fetchConflictWindow(date);
    } else {
      // Clear all conflict statuses when date is cleared
      this.windowServices = [];
      for (const slot of this.slotStates) {
        slot.conflictStatus = null;
      }
    }
  }

  // --- conflict tooltip ---
  getConflictTooltip(slot: SlotState): string {
    if (!slot.conflictStatus || !slot.conflictStatus.conflictingDates.length) return '';
    return slot.conflictStatus.conflictingDates
      .map(d => `${d.date} (${d.serviceType})`)
      .join('\n');
  }

  // --- dialog actions ---
  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(form: any): void {
    this.submitAttempted = true;
    // Also check that no slots have unknown songs
    const hasUnknownSong = this.slotStates.some(s => this.isUnknownSong(s));
    if (form.invalid || hasUnknownSong) return;

    this.saving = true;
    this.submitError = null;

    const payload = buildServicePayload(
      moment(this.serviceDate),
      this.serviceType,
      this.slotStates
    );

    const request$ = this.isEditMode
      ? this.servicesApiService.updateService(this.editingService!.id, payload)
      : this.servicesApiService.createService(payload);

    request$.subscribe({
      next: () => this.dialogRef.close('saved'),
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        if (err.status === 409) {
          this.submitError = 'A service with this date and type already exists.';
        } else if (err.status === 400 && typeof err.error?.error === 'string') {
          this.submitError = err.error.error;
        } else {
          this.submitError = `Failed to save service (${err.status}).`;
        }
      }
    });
  }
}
