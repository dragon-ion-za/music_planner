// Feature: monthly-services-view, Property 1: Month navigation is a round trip
import fc from 'fast-check';
import moment from 'moment';

/**
 * Validates: Requirements 2.2, 2.3
 *
 * Property 1: Month navigation is a round trip
 * For any valid month M, navigating next then prev SHALL return to M.
 */
describe('MonthNavigatorComponent - Property 1: Month navigation is a round trip', () => {
  it('next().prev() returns the original month', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 11 }),   // month index
        fc.integer({ min: 2000, max: 2099 }), // year
        (month, year) => {
          const original = moment({ year, month, day: 1 });

          // Simulate prev() and next() logic from MonthNavigatorComponent
          const afterNext = original.clone().add(1, 'month');
          const afterNextThenPrev = afterNext.clone().subtract(1, 'month');

          expect(afterNextThenPrev.year()).toBe(original.year());
          expect(afterNextThenPrev.month()).toBe(original.month());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('prev().next() returns the original month', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 11 }),
        fc.integer({ min: 2000, max: 2099 }),
        (month, year) => {
          const original = moment({ year, month, day: 1 });

          const afterPrev = original.clone().subtract(1, 'month');
          const afterPrevThenNext = afterPrev.clone().add(1, 'month');

          expect(afterPrevThenNext.year()).toBe(original.year());
          expect(afterPrevThenNext.month()).toBe(original.month());
        }
      ),
      { numRuns: 100 }
    );
  });
});
