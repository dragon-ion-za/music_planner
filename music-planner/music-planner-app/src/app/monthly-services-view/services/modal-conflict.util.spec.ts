import fc from 'fast-check';
import { getSlotHighlight } from './modal-conflict.util';
import { SlotConflictStatus } from '../models/service.model';

describe('getSlotHighlight', () => {
  // Feature: dialog-conflict-field-highlight, Property 5: highlight mapping is total and follows the severity
  // **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
  it('Property 5: returns null without a known song or status, else the severity or free', () => {
    const statusArb: fc.Arbitrary<SlotConflictStatus | null> = fc.option(
      fc.record({
        severity: fc.constantFrom<'red' | 'yellow' | 'green' | null>('red', 'yellow', 'green', null),
        conflictingDates: fc.array(
          fc.record({ date: fc.string(), serviceType: fc.string() }),
          { maxLength: 5 }
        ),
      }),
      { nil: null }
    );

    expect(() =>
      fc.assert(
        fc.property(fc.boolean(), statusArb, (hasKnownSong, status) => {
          const result = getSlotHighlight(hasKnownSong, status);
          if (!hasKnownSong || status === null) {
            return result === null;
          }
          return status.severity !== null ? result === status.severity : result === 'free';
        }),
        { numRuns: 100 }
      )
    ).not.toThrow();
  });
});
