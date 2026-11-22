// Feature: monthly-services-view, Property 13: Slot label mapping with fallback
import fc from 'fast-check';

import { SLOT_LABEL_TABLE, getSlotLabel } from './slot-labels';

describe('getSlotLabel (Property 13)', () => {
  const listedKeys = Object.keys(SLOT_LABEL_TABLE);

  it('should list exactly 14 keys', () => {
    expect(listedKeys.length).toBe(14);
  });

  /** **Validates: Requirements 6.3** */
  it('returns the table value for each listed key', () => {
    fc.assert(
      fc.property(fc.constantFrom(...listedKeys), (key) => {
        expect(getSlotLabel(key)).toBe(SLOT_LABEL_TABLE[key]);
      }),
      { numRuns: 100 }
    );
  });

  /** **Validates: Requirements 6.5** */
  it('returns the raw key for any string not in the table', () => {
    const unknownKey = fc
      .oneof(
        fc.string(),
        fc.constantFrom('constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf', '')
      )
      .filter((s) => !listedKeys.includes(s));

    fc.assert(
      fc.property(unknownKey, (key) => {
        expect(getSlotLabel(key)).toBe(key);
      }),
      { numRuns: 100 }
    );
  });
});
