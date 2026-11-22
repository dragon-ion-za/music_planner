// Preservation (service-date-off-by-one): the picked local calendar date is sent as YYYY-MM-DD.
// Validates: Requirements 3.2
import fc from 'fast-check';
import moment from 'moment';
import { buildServicePayload } from './service-form.util';

describe('buildServicePayload serviceDate', () => {
  it('returns the picked local calendar date as YYYY-MM-DD', () => {
    const payload = buildServicePayload(moment(new Date(2025, 0, 5, 0, 0, 0)), 'Sunday Service', []);
    expect(payload.serviceDate).toBe('2025-01-05');
  });

  it('keeps the local date for late-evening and early-morning picks', () => {
    expect(buildServicePayload(moment(new Date(2025, 11, 31, 23, 59, 59)), 'S', []).serviceDate).toBe('2025-12-31');
    expect(buildServicePayload(moment(new Date(2024, 1, 29, 0, 0, 1)), 'S', []).serviceDate).toBe('2024-02-29');
  });

  it('matches the local year, month and day for any picked date', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2000, 0, 1), max: new Date(2100, 11, 31), noInvalidDate: true }),
        (d) => {
          const pad = (n: number) => String(n).padStart(2, '0');
          const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          expect(buildServicePayload(moment(d), 'S', []).serviceDate).toBe(expected);
        },
      ),
    );
  });
});
