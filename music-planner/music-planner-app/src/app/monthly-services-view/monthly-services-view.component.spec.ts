import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import moment from 'moment';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '@auth0/auth0-angular';
import { Observable, of, Subject, throwError } from 'rxjs';
import { MonthlyServicesViewComponent } from './monthly-services-view.component';
import { AddServiceDialogComponent } from './components/add-service-dialog/add-service-dialog.component';
import { AuthErrorState } from './../auth-error-state.service';
import { ServicesApiService } from './services/services-api.service';
import { ConflictDetectionService } from './services/conflict-detection.service';
import { SlotSwapService } from './services/slot-swap.service';
import { Service, ServiceViewModel } from './models/service.model';

describe('MonthlyServicesViewComponent openEditServiceDialog', () => {
  const service: Service = {
    id: 'svc-1',
    congregationId: 'c1',
    serviceDate: '2024-05-05',
    serviceType: 'Morning',
    serviceSlots: [],
  };

  let afterClosed$: Subject<unknown>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let component: MonthlyServicesViewComponent;
  let loadSpy: jasmine.Spy;

  beforeEach(() => {
    afterClosed$ = new Subject<unknown>();
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialog.open.and.returnValue({ afterClosed: () => afterClosed$.asObservable() } as any);

    TestBed.configureTestingModule({
      imports: [MonthlyServicesViewComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open']) },
        { provide: AuthService, useValue: { error$: of() } },
        { provide: AuthErrorState, useValue: { message$: of(), clear: () => {} } },
        { provide: ServicesApiService, useValue: {} },
        { provide: ConflictDetectionService, useValue: {} },
        { provide: SlotSwapService, useValue: {} },
      ],
    });
    // ngOnInit is not run (no detectChanges), so no data is loaded here.
    component = TestBed.createComponent(MonthlyServicesViewComponent).componentInstance;
    loadSpy = spyOn(component, 'loadServices');
  });

  it('opens the dialog with width, disableClose and the service as data', () => {
    component.openEditServiceDialog(service);
    expect(dialog.open).toHaveBeenCalledOnceWith(AddServiceDialogComponent, {
      width: '800px',
      disableClose: true,
      data: { service },
    });
  });

  it('reloads the selected month when the dialog closes with "saved"', () => {
    component.openEditServiceDialog(service);
    afterClosed$.next('saved');
    expect(loadSpy).toHaveBeenCalledOnceWith(component.selectedMonth);
  });

  it('does nothing when the dialog closes without "saved"', () => {
    component.openEditServiceDialog(service);
    afterClosed$.next(undefined);
    afterClosed$.next('cancelled');
    expect(loadSpy).not.toHaveBeenCalled();
  });
});

describe('MonthlyServicesViewComponent servicePairs', () => {
  const makeService = (id: string, serviceDate: string, songId: string | null = null): Service => ({
    id,
    congregationId: 'c1',
    serviceDate,
    serviceType: 'Service',
    serviceSlots: [{
      id: `${id}-slot`,
      serviceId: id,
      slotTemplateId: 't1',
      songId,
      slotTemplate: { slotKey: 'orchestra1', category: 'orchestra', displayOrder: 1 },
      song: null,
    }],
  });

  // 2024-05-01 Wed, 05-05 Sun, 05-08 Wed, 05-10 Fri
  const services: Service[] = [
    makeService('wed1', '2024-05-01'),
    makeService('sun1', '2024-05-05'),
    makeService('wed2', '2024-05-08'),
    makeService('fri1', '2024-05-10'),
  ];

  let api: jasmine.SpyObj<ServicesApiService>;
  let conflicts: jasmine.SpyObj<ConflictDetectionService>;
  let swapService: jasmine.SpyObj<SlotSwapService>;
  let fixture: ComponentFixture<MonthlyServicesViewComponent>;
  let component: MonthlyServicesViewComponent;

  const ids = (rows: (ServiceViewModel | null)[][]) =>
    rows.map(r => r.map(s => s?.id ?? null));

  function setup(getServices$: () => Observable<Service[]>): void {
    api = jasmine.createSpyObj<ServicesApiService>('ServicesApiService', ['getServices']);
    api.getServices.and.callFake(getServices$);
    conflicts = jasmine.createSpyObj<ConflictDetectionService>('ConflictDetectionService', ['buildConflictMap']);
    conflicts.buildConflictMap.and.returnValue({});
    swapService = jasmine.createSpyObj<SlotSwapService>('SlotSwapService', ['swap', 'swapWithinService']);

    TestBed.configureTestingModule({
      imports: [MonthlyServicesViewComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open']) },
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open']) },
        { provide: AuthService, useValue: { error$: of() } },
        { provide: AuthErrorState, useValue: { message$: of(), clear: () => {} } },
        { provide: ServicesApiService, useValue: api },
        { provide: ConflictDetectionService, useValue: conflicts },
        { provide: SlotSwapService, useValue: swapService },
      ],
    });
    fixture = TestBed.createComponent(MonthlyServicesViewComponent);
    component = fixture.componentInstance;
    component.selectedMonth = moment('2024-05-01').startOf('month');
    fixture.detectChanges(); // runs ngOnInit -> loadServices
    fixture.detectChanges();
  }

  it('puts Sundays in the right cell and renders placeholders for null cells after load', () => {
    setup(() => of(services));

    expect(ids(component.servicePairs)).toEqual([
      ['wed1', 'sun1'],
      ['wed2', null],
      ['fri1', null],
    ]);

    const rows = fixture.nativeElement.querySelectorAll('.grid-row');
    expect(rows.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.grid-cell-empty').length).toBe(2);
    expect(rows[0].querySelector('.grid-cell-empty')).toBeNull();
    expect(rows[1].querySelectorAll('app-service-card').length).toBe(1);
    expect(rows[1].children[1].classList).toContain('grid-cell-empty');
  });

  it('rebuilds servicePairs after a successful swap', () => {
    setup(() => of([
      makeService('wed1', '2024-05-01', 'songA'),
      makeService('sun1', '2024-05-05', 'songB'),
    ]));
    expect(ids(component.servicePairs)).toEqual([['wed1', 'sun1']]);

    const before = component.servicePairs;
    const [wed, sun] = component.displayServices;
    const source = wed.serviceSlots[0];
    const target = sun.serviceSlots[0];
    spyOn(component as any, 'findSlotAtPoint').and.returnValue(target);

    const updatedWed = makeService('wed1', '2024-05-01', 'songB');
    const updatedSun = makeService('sun1', '2024-05-05', 'songA');
    swapService.swap.and.returnValue(of([updatedWed, updatedSun] as [Service, Service]));

    component.onSlotDropped({ slot: source, point: { x: 0, y: 0 } });

    expect(swapService.swap).toHaveBeenCalled();
    expect(component.servicePairs).not.toBe(before);
    expect(ids(component.servicePairs)).toEqual([['wed1', 'sun1']]);
    expect(component.servicePairs[0][0]!.serviceSlots[0].songId).toBe('songB');
    expect(component.servicePairs[0][1]!.serviceSlots[0].songId).toBe('songA');
  });

  it('leaves servicePairs empty when loading fails', () => {
    spyOn(console, 'log');
    setup(() => throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(component.servicePairs).toEqual([]);
    expect(component.error).toBeTruthy();
  });
});
