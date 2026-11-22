import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ServiceCardComponent } from './service-card.component';
import { ServiceSlotViewModel, ServiceViewModel } from '../../models/service.model';

describe('ServiceCardComponent', () => {
  let fixture: ComponentFixture<ServiceCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ServiceCardComponent],
      providers: [provideNoopAnimations()],
    });
    fixture = TestBed.createComponent(ServiceCardComponent);
  });

  describe('Edit button', () => {
    const service: ServiceViewModel = {
      id: 'svc',
      congregationId: 'c1',
      serviceDate: '2024-05-05',
      serviceType: 'Morning',
      serviceSlots: [],
      slotGroups: [],
    };
    const getButton = () =>
      (fixture.nativeElement as HTMLElement).querySelector('button.edit-button') as HTMLButtonElement;

    beforeEach(() => {
      fixture.componentRef.setInput('service', service);
      fixture.detectChanges();
    });

    it('renders an Edit button in the header', () => {
      const button = getButton();
      expect(button).toBeTruthy();
      expect(button.textContent?.trim()).toBe('Edit');
      expect(button.closest('mat-card-header')).toBeTruthy();
      expect(button.disabled).toBeFalse();
    });

    it('emits editRequested with the service when clicked', () => {
      const emitted: ServiceViewModel[] = [];
      fixture.componentInstance.editRequested.subscribe(s => emitted.push(s));
      getButton().click();
      expect(emitted).toEqual([service]);
    });

    it('is disabled while swapping and does not emit', () => {
      fixture.componentRef.setInput('swapping', true);
      fixture.detectChanges();
      const emitted: ServiceViewModel[] = [];
      fixture.componentInstance.editRequested.subscribe(s => emitted.push(s));
      expect(getButton().disabled).toBeTrue();
      getButton().click();
      expect(emitted).toEqual([]);
    });
  });

  it('still renders the category heading above its slots', () => {
    const slot: ServiceSlotViewModel = {
      id: 's1',
      serviceId: 'svc',
      slotTemplateId: 't1',
      songId: null,
      slotTemplate: { slotKey: 'congregationOH', category: 'congregation', displayOrder: 1 },
      song: null,
      canonicalNumber: '',
      slotLabel: 'Opening Hymn',
      hymnDisplayText: null,
    };
    const service: ServiceViewModel = {
      id: 'svc',
      congregationId: 'c1',
      serviceDate: '2024-05-05',
      serviceType: 'Morning',
      serviceSlots: [slot],
      slotGroups: [{ category: 'congregation', slots: [slot] }],
    };
    fixture.componentRef.setInput('service', service);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.category-label')?.textContent?.trim()).toBe('congregation');
    expect(el.querySelector('app-slot-item .slot-label')?.textContent?.trim()).toBe('Opening Hymn');
  });
});
