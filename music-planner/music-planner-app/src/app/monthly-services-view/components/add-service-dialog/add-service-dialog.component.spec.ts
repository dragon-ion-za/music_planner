import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AddServiceDialogComponent } from './add-service-dialog.component';
import { ServicesApiService } from '../../services/services-api.service';
import { Service } from '../../models/service.model';

function makeService(): Service {
  const mk = (slotKey: string, category: any, order: number, number: string | null) => ({
    id: `slot-${slotKey}`,
    serviceId: 'svc-1',
    slotTemplateId: `t-${slotKey}`,
    songId: number ? `song-${number}` : null,
    slotTemplate: { slotKey, category, displayOrder: order },
    song: number ? { number, hymnal: 'A', name: null } : null,
  });
  return {
    id: 'svc-1',
    congregationId: 'c1',
    serviceDate: '2025-04-06',
    serviceType: 'Sunday Service',
    serviceSlots: [
      mk('orchestra1', 'orchestra', 1, 'A10'),
      mk('choir1', 'choir', 6, 'A100'),
      mk('congregationBS', 'congregation', 10, null),
    ],
  };
}

describe('AddServiceDialogComponent', () => {
  let fixture: ComponentFixture<AddServiceDialogComponent>;
  let component: AddServiceDialogComponent;
  let api: jasmine.SpyObj<ServicesApiService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<AddServiceDialogComponent>>;

  async function setup(data: { service?: Service } | null, windowResult: Observable<Service[]> = of([])) {
    api = jasmine.createSpyObj('ServicesApiService', ['getServices', 'createService', 'updateService']);
    api.getServices.and.returnValue(windowResult);
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    await TestBed.configureTestingModule({
      imports: [AddServiceDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ServicesApiService, useValue: api },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AddServiceDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(el().querySelectorAll('mat-dialog-actions button')) as HTMLButtonElement[];
  const saveButton = () => buttons()[1];
  const slot = (key: string) => component.slotStates.find(s => s.slotKey === key)!;

  async function clickSave() {
    saveButton().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  describe('edit mode', () => {
    beforeEach(async () => {
      await setup({ service: makeService() });
    });

    it('shows the Edit Service title', () => {
      expect(el().querySelector('h2')!.textContent).toContain('Edit Service');
    });

    it('pre-fills date, type and slots', () => {
      expect(component.serviceDate!.format('YYYY-MM-DD')).toBe('2025-04-06');
      expect(component.serviceType).toBe('Sunday Service');
      expect(slot('orchestra1').songNumber).toBe('A10');
      expect(slot('choir1').songNumber).toBe('A100');
      expect(slot('congregationBS').songNumber).toBe('');
      expect(slot('orchestra2').songNumber).toBe('');
    });

    it('fetches the conflict window on open', () => {
      expect(api.getServices).toHaveBeenCalledWith('2024-04-06', '2026-04-06');
    });

    it('calls updateService with the service id and closes with saved', async () => {
      api.updateService.and.returnValue(of({} as Service));
      await clickSave();
      expect(api.createService).not.toHaveBeenCalled();
      expect(api.updateService).toHaveBeenCalledTimes(1);
      const [id, payload] = api.updateService.calls.mostRecent().args;
      expect(id).toBe('svc-1');
      expect(payload.serviceDate).toBe('2025-04-06');
      expect(payload.serviceType).toBe('Sunday Service');
      expect(payload.slots.length).toBe(14);
      expect(payload.slots.find(s => s.slotKey === 'orchestra1')!.songNumber).toBe('A10');
      expect(dialogRef.close).toHaveBeenCalledWith('saved');
    });

    it('shows the duplicate message on 409', async () => {
      api.updateService.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
      await clickSave();
      expect(component.submitError).toBe('A service with this date and type already exists.');
      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(el().querySelector('.submit-error')!.textContent).toContain('already exists');
    });

    it('shows the server error text on 400', async () => {
      api.updateService.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { error: 'Unknown song number: A1' } }))
      );
      await clickSave();
      expect(component.submitError).toBe('Unknown song number: A1');
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('shows a generic message on 500', async () => {
      api.updateService.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      await clickSave();
      expect(component.submitError).toBe('Failed to save service (500).');
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('disables controls and shows a spinner while the request is in flight', async () => {
      const pending = new Subject<Service>();
      api.updateService.and.returnValue(pending);
      await clickSave();
      expect(component.saving).toBeTrue();
      expect(buttons()[0].disabled).toBeTrue();
      expect(saveButton().disabled).toBeTrue();
      expect(el().querySelector('form')!.classList).toContain('form-disabled');
      expect(el().querySelector('mat-spinner')).not.toBeNull();
      pending.complete();
    });

    it('sends songNumber null when a slot is cleared', async () => {
      api.updateService.and.returnValue(of({} as Service));
      slot('orchestra1').songNumber = '';
      await clickSave();
      const payload = api.updateService.calls.mostRecent().args[1];
      expect(payload.slots.find(s => s.slotKey === 'orchestra1')!.songNumber).toBeNull();
    });

    it('treats N/A as an empty slot and sends null', async () => {
      api.updateService.and.returnValue(of({} as Service));
      slot('choir1').songNumber = 'N/A';
      expect(component.isUnknownSong(slot('choir1'))).toBeFalse();
      await clickSave();
      expect(api.updateService).toHaveBeenCalled();
      const payload = api.updateService.calls.mostRecent().args[1];
      expect(payload.slots.find(s => s.slotKey === 'choir1')!.songNumber).toBeNull();
    });

    it('blocks save when a song number is unknown', async () => {
      slot('choir2').songNumber = 'ZZZ999';
      expect(component.isUnknownSong(slot('choir2'))).toBeTrue();
      await clickSave();
      expect(api.updateService).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('blocks save when the service type is empty', async () => {
      component.serviceType = '';
      fixture.detectChanges();
      await fixture.whenStable();
      await clickSave();
      expect(api.updateService).not.toHaveBeenCalled();
    });
  });

  describe('add mode', () => {
    beforeEach(async () => {
      await setup(null);
    });

    it('shows the Add Service title', () => {
      expect(el().querySelector('h2')!.textContent).toContain('Add Service');
    });

    it('starts with a blank form and no conflict fetch', () => {
      expect(component.isEditMode).toBeFalse();
      expect(component.serviceDate).toBeNull();
      expect(component.serviceType).toBe('');
      expect(component.slotStates.every(s => s.songNumber === '')).toBeTrue();
      expect(api.getServices).not.toHaveBeenCalled();
    });

    it('calls createService on save', async () => {
      api.createService.and.returnValue(of({} as Service));
      component.onDateChange(require_moment('2025-05-04'));
      component.serviceType = 'Sunday Service';
      fixture.detectChanges();
      await fixture.whenStable();
      await clickSave();
      expect(api.updateService).not.toHaveBeenCalled();
      expect(api.createService).toHaveBeenCalledTimes(1);
      expect(api.createService.calls.mostRecent().args[0].serviceDate).toBe('2025-05-04');
      expect(dialogRef.close).toHaveBeenCalledWith('saved');
    });
  });

  // --- field highlight and case-insensitive entry ---
  const BASE = '2025-04-06';
  const dayOffset = (days: number) => moment(BASE, 'YYYY-MM-DD').add(days, 'days').format('YYYY-MM-DD');

  // The API reports translationOf for songs that have a repertoire translation.
  const TRANSLATIONS: Record<string, string> = { A10: 'E7', A100: 'E139' };
  function windowService(id: string, date: string, type: string, number: string): Service {
    const tr = TRANSLATIONS[number];
    return {
      id,
      congregationId: 'c1',
      serviceDate: date,
      serviceType: type,
      serviceSlots: [{
        id: `${id}-slot`,
        serviceId: id,
        slotTemplateId: 't-x',
        songId: `song-${number}`,
        slotTemplate: { slotKey: 'orchestra1', category: 'orchestra', displayOrder: 1 },
        song: { number, hymnal: 'A', name: null, ...(tr ? { translationOf: { number: tr, name: null, hymnal: 'E' } } : {}) },
      }],
    } as Service;
  }

  // A10 -> 20 days away (red), A100 -> 70 days (yellow), A20 -> 200 days (green)
  const conflictWindow = () => [
    windowService('w1', dayOffset(-20), 'Sunday Service', 'A10'),
    windowService('w2', dayOffset(-70), 'Sunday Service', 'A100'),
    windowService('w3', dayOffset(-200), 'Sunday Service', 'A20'),
  ];

  const input = (key: string) => el().querySelector(`input[name="${key}"]`) as HTMLInputElement;
  const field = (key: string) => input(key).closest('.slot-field') as HTMLElement;
  const highlightOf = (key: string) =>
    Array.from(field(key).classList).filter(c => c.startsWith('highlight-'));

  async function type(key: string, value: string) {
    const i = input(key);
    i.value = value;
    i.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function blur(key: string) {
    input(key).dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setDate(date: string) {
    component.onDateChange(require_moment(date));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function typeAll() {
    await type('orchestra1', 'A10');
    await type('choir1', 'A100');
    await type('orchestra2', 'A20');
    await type('orchestra3', 'A30');
  }

  function expectHighlights() {
    expect(highlightOf('orchestra1')).toEqual(['highlight-red']);
    expect(highlightOf('choir1')).toEqual(['highlight-yellow']);
    expect(highlightOf('orchestra2')).toEqual(['highlight-green']);
    expect(highlightOf('orchestra3')).toEqual(['highlight-free']);
    expect(el().querySelector('.conflict-badge')).toBeNull();
  }

  describe('field highlight in add mode', () => {
    beforeEach(async () => {
      await setup(null, of(conflictWindow()));
      await setDate(BASE);
    });

    it('shows red, yellow, green and free highlights and no badge', async () => {
      await typeAll();
      expectHighlights();
    });

    it('shows no highlight for empty, N/A and unknown slots', async () => {
      await type('orchestra1', 'N/A');
      await type('orchestra2', 'ZZZ999');
      expect(highlightOf('orchestra1')).toEqual([]);
      expect(highlightOf('orchestra2')).toEqual([]);
      expect(highlightOf('orchestra3')).toEqual([]);
    });

    it('updates the highlight while typing', async () => {
      await type('orchestra1', 'A10');
      expect(highlightOf('orchestra1')).toEqual(['highlight-red']);
      await type('orchestra1', 'A30');
      expect(highlightOf('orchestra1')).toEqual(['highlight-free']);
      await type('orchestra1', '');
      expect(highlightOf('orchestra1')).toEqual([]);
    });

    it('refetches the window when the date changes', async () => {
      const calls = api.getServices.calls.count();
      await setDate('2025-06-01');
      expect(api.getServices.calls.count()).toBe(calls + 1);
      expect(api.getServices.calls.mostRecent().args).toEqual(['2024-06-01', '2026-06-01']);
    });

    it('removes highlights when the date is cleared', async () => {
      await typeAll();
      component.onDateChange(null);
      fixture.detectChanges();
      expect(el().querySelectorAll('.slot-field[class*="highlight-"]').length).toBe(0);
    });

    it('lists date (type) per line in the tooltip and is empty for free slots', async () => {
      await type('orchestra1', 'A10');
      await type('choir1', 'A100');
      await type('orchestra3', 'A30');
      expect(component.getConflictTooltip(slot('orchestra1'))).toBe(`${dayOffset(-20)} (Sunday Service)`);
      expect(component.getConflictTooltip(slot('choir1'))).toBe(`${dayOffset(-70)} (Sunday Service)`);
      expect(component.getConflictTooltip(slot('orchestra3'))).toBe('');
    });

    it('joins several conflicts with newlines', async () => {
      component.windowServices = [
        ...conflictWindow(),
        windowService('w4', dayOffset(40), 'Wednesday Service', 'A10'),
      ];
      await type('orchestra1', 'A10');
      expect(component.getConflictTooltip(slot('orchestra1')))
        .toBe(`${dayOffset(-20)} (Sunday Service)\n${dayOffset(40)} (Wednesday Service)`);
    });

    it('treats a10 as known and ZZZ999 as unknown', () => {
      slot('orchestra1').songNumber = 'a10';
      slot('orchestra2').songNumber = 'ZZZ999';
      expect(component.isUnknownSong(slot('orchestra1'))).toBeFalse();
      expect(component.isUnknownSong(slot('orchestra2'))).toBeTrue();
    });

    it('blocks save with an unknown song', async () => {
      component.serviceType = 'Sunday Service';
      await type('orchestra2', 'ZZZ999');
      await clickSave();
      expect(api.createService).not.toHaveBeenCalled();
      expect(component.submitAttempted).toBeTrue();
      expect(component.isUnknownSong(slot('orchestra2'))).toBeTrue();
    });

    it('filterOptions returns A1* entries and none for empty text', () => {
      const s = slot('orchestra1');
      s.songNumber = 'a1';
      component.filterOptions(s);
      expect(s.filteredOptions.length).toBeGreaterThan(0);
      expect(s.filteredOptions.every(o => o.number.toLowerCase().startsWith('a1'))).toBeTrue();
      s.songNumber = '';
      component.filterOptions(s);
      expect(s.filteredOptions).toEqual([]);
    });
  });

  describe('field highlight with a failed fetch', () => {
    beforeEach(async () => {
      await setup(null, throwError(() => new HttpErrorResponse({ status: 500 })));
      await setDate(BASE);
    });

    it('shows no highlight and Save still calls the API', async () => {
      api.createService.and.returnValue(of({} as Service));
      component.serviceType = 'Sunday Service';
      await typeAll();
      expect(el().querySelectorAll('.slot-field[class*="highlight-"]').length).toBe(0);
      await clickSave();
      expect(api.createService).toHaveBeenCalledTimes(1);
    });
  });

  describe('field highlight without a date', () => {
    it('shows no highlight when no date is set', async () => {
      await setup(null, of(conflictWindow()));
      await typeAll();
      expect(el().querySelectorAll('.slot-field[class*="highlight-"]').length).toBe(0);
    });
  });

  describe('field highlight in edit mode', () => {
    beforeEach(async () => {
      const own = windowService('svc-1', BASE, 'Sunday Service', 'A10');
      await setup({ service: makeService() }, of([own, ...conflictWindow()]));
    });

    it('shows red, yellow, green and free highlights and no badge', async () => {
      await type('orchestra2', 'A20');
      await type('orchestra3', 'A30');
      expectHighlights();
    });

    it('excludes the edited service from conflicts', async () => {
      component.windowServices = [windowService('svc-1', BASE, 'Sunday Service', 'A10')];
      component.rebuildConflictMap();
      fixture.detectChanges();
      expect(highlightOf('orchestra1')).toEqual(['highlight-free']);
    });

    it('rewrites a10 to A10 on blur and sends A10', async () => {
      api.updateService.and.returnValue(of({} as Service));
      await type('orchestra1', 'a10');
      await blur('orchestra1');
      expect(slot('orchestra1').songNumber).toBe('A10');
      expect(input('orchestra1').value).toBe('A10');
      await clickSave();
      const payload = api.updateService.calls.mostRecent().args[1];
      expect(payload.slots.find(s => s.slotKey === 'orchestra1')!.songNumber).toBe('A10');
    });
  });});

import moment from 'moment';
function require_moment(s: string) {
  return moment(s, 'YYYY-MM-DD');
}
