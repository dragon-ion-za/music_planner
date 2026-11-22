import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
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

  async function setup(data: { service?: Service } | null) {
    api = jasmine.createSpyObj('ServicesApiService', ['getServices', 'createService', 'updateService']);
    api.getServices.and.returnValue(of([]));
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
});

import moment from 'moment';
function require_moment(s: string) {
  return moment(s, 'YYYY-MM-DD');
}
