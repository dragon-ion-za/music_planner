import fc from 'fast-check';
import moment from 'moment';

import { buildServiceRows } from './service-rows.util';

interface TestService {
  id: number;
  serviceDate: string;
  serviceType: string;
}

const serviceTypeArb = fc.oneof(
  fc.constant('Sunday Service'),
  fc.constant('Morning'),
  fc.string()
);

// Sorted ascending list of services with dates drawn from a range of days.
const servicesArb: fc.Arbitrary<TestService[]> = fc
  .array(
    fc.record({
      offset: fc.integer({ min: 0, max: 120 }),
      serviceType: serviceTypeArb,
    }),
    { maxLength: 40 }
  )
  .map((items) =>
    items
      .sort((a, b) => a.offset - b.offset)
      .map((item, index) => ({
        id: index,
        serviceDate: moment('2025-01-01').add(item.offset, 'days').format('YYYY-MM-DD'),
        serviceType: item.serviceType,
      }))
  );

const isSunday = (date: string): boolean => moment(date, 'YYYY-MM-DD').day() === 0;

describe('buildServiceRows', () => {
  // Feature: sunday-services-right-column, Property 1: Placement by weekday
  // **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
  it('Property 1: places Sunday services right and non-Sunday services left', () => {
    fc.assert(
      fc.property(servicesArb, (services) => {
        const rows = buildServiceRows(services);
        return rows.every(([left, right]) => {
          const leftOk = left === null || !isSunday(left.serviceDate);
          const rightOk = right === null || isSunday(right.serviceDate);
          return leftOk && rightOk;
        });
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sunday-services-right-column, Property 2: Order and completeness
  // **Validates: Requirements 2.3, 4.1**
  it('Property 2: flattening rows left then right yields the input list exactly once each', () => {
    fc.assert(
      fc.property(servicesArb, (services) => {
        const flattened = buildServiceRows(services)
          .flat()
          .filter((cell): cell is TestService => cell !== null);
        return (
          flattened.length === services.length &&
          flattened.every((svc, i) => svc === services[i])
        );
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sunday-services-right-column, Property 3: Pairing with the preceding service
  // **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  it('Property 3: pairs a Sunday with the immediately preceding non-Sunday, else null', () => {
    fc.assert(
      fc.property(servicesArb, (services) => {
        return buildServiceRows(services).every(([left, right]) => {
          if (right === null) {
            return left !== null && !isSunday(left.serviceDate);
          }
          const index = services.indexOf(right);
          const prev = index > 0 ? services[index - 1] : null;
          const expectedLeft = prev !== null && !isSunday(prev.serviceDate) ? prev : null;
          return isSunday(right.serviceDate) && left === expectedLeft;
        });
      }),
      { numRuns: 100 }
    );
  });

  describe('examples', () => {
    const svc = (id: number, serviceDate: string, serviceType = 'Morning'): TestService => ({
      id,
      serviceDate,
      serviceType,
    });

    it('returns [] for empty input', () => {
      expect(buildServiceRows([])).toEqual([]);
    });

    it('handles the Wed/Sun/Wed/Fri/Sun/Sat example', () => {
      const wed1 = svc(1, '2025-01-01');
      const sun1 = svc(2, '2025-01-05');
      const wed2 = svc(3, '2025-01-08');
      const fri = svc(4, '2025-01-10');
      const sun2 = svc(5, '2025-01-12');
      const sat = svc(6, '2025-01-18');
      const rows = buildServiceRows([wed1, sun1, wed2, fri, sun2, sat]);
      expect(rows).toEqual([
        [wed1, sun1],
        [wed2, null],
        [fri, sun2],
        [sat, null],
      ]);
    });

    it('puts a leading Sunday in the right cell with an empty left cell', () => {
      const sun = svc(1, '2025-06-01');
      const mon = svc(2, '2025-06-02');
      const rows = buildServiceRows([sun, mon]);
      expect(rows).toEqual([
        [null, sun],
        [mon, null],
      ]);
    });

    it("places serviceType 'Sunday Service' on a weekday in the left cell", () => {
      const tue = svc(1, '2025-01-07', 'Sunday Service');
      const rows = buildServiceRows([tue]);
      expect(rows).toEqual([[tue, null]]);
    });
  });
});
