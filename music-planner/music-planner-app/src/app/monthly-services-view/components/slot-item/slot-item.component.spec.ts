import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { SlotItemComponent } from './slot-item.component';
import { ServiceSlotViewModel, Song } from '../../models/service.model';
import { formatHymnDisplayText, getSlotLabel } from '../../models/slot-labels';

function makeSlot(slotKey: string, song: Song | null, category: 'orchestra' | 'choir' | 'congregation' = 'congregation'): ServiceSlotViewModel {
  return {
    id: 'slot-1',
    serviceId: 'svc-1',
    slotTemplateId: 'tpl-1',
    songId: song ? 'song-1' : null,
    slotTemplate: { slotKey, category, displayOrder: 1 },
    song,
    canonicalNumber: song?.translationOf?.number ?? song?.number ?? '',
    slotLabel: getSlotLabel(slotKey),
    hymnDisplayText: song ? formatHymnDisplayText(song) : null,
  };
}

describe('SlotItemComponent', () => {
  let fixture: ComponentFixture<SlotItemComponent>;

  function render(slot: ServiceSlotViewModel): HTMLElement {
    fixture.componentRef.setInput('slot', slot);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SlotItemComponent],
      providers: [provideNoopAnimations()],
    });
    fixture = TestBed.createComponent(SlotItemComponent);
  });

  it('shows the label and hymn text for an occupied slot', () => {
    const el = render(makeSlot('congregationOH', {
      number: 'A10',
      hymnal: 'A',
      name: 'Grote God',
      translationOf: { number: 'E7', name: 'Great God', hymnal: 'E' },
    }));
    expect(el.querySelector('.slot-label')?.textContent?.trim()).toBe('Opening Hymn');
    expect(el.querySelector('.slot-song')?.textContent?.trim()).toBe('A10 Grote God (E7)');
    expect(el.querySelector('.empty-placeholder')).toBeNull();
  });

  it('renders only the number when name is null and there is no translation', () => {
    const el = render(makeSlot('orchestra1', { number: 'A10', hymnal: 'A', name: null }, 'orchestra'));
    expect(el.querySelector('.slot-song')?.textContent?.trim()).toBe('A10');
  });

  it('shows the Empty placeholder for an empty slot', () => {
    const el = render(makeSlot('congregationBS', null));
    const song = el.querySelector('.slot-song');
    expect(song?.classList).toContain('empty-placeholder');
    expect(song?.textContent?.trim()).toBe('Empty');
  });

  it('does not render the category or raw slotKey', () => {
    const el = render(makeSlot('congregationOH', { number: 'A10', hymnal: 'A', name: 'Grote God' }));
    const text = el.textContent ?? '';
    expect(text).not.toContain('congregationOH');
    expect(text).not.toContain('congregation');
    expect(text).not.toContain('Congregation');
  });
});
