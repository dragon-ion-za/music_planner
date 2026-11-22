import fc from 'fast-check';

import { formatHymnDisplayText } from './slot-labels';
import { Song } from './service.model';

// Feature: monthly-services-view, Property 12: Hymn display text formatting
// **Validates: Requirements 6.1, 6.2, 6.6**
describe('formatHymnDisplayText (property)', () => {
  const hymnNumber = fc.stringMatching(/^[A-Z][0-9]{1,3}$/);
  // Names exclude parentheses so bracket presence reflects only the translation.
  const hymnName = fc.option(
    fc.oneof(
      fc.constant(''),
      fc.constant('   '),
      fc.stringMatching(/^[A-Za-z0-9 ]{0,20}$/)
    ),
    { nil: null }
  );

  it('Property 12: formats number, optional name and optional translation', () => {
    fc.assert(
      fc.property(
        fc.record({
          number: hymnNumber,
          name: hymnName,
          translationNumber: fc.option(hymnNumber, { nil: undefined }),
        }),
        ({ number, name, translationNumber }) => {
          const song: Song = {
            number,
            hymnal: 'A',
            name,
            ...(translationNumber !== undefined
              ? { translationOf: { number: translationNumber, name: null, hymnal: 'E' } }
              : {}),
          };

          const result = formatHymnDisplayText(song);
          const nameIsNonBlank = name !== null && name.trim() !== '';

          expect(result.startsWith(number)).toBeTrue();
          if (nameIsNonBlank) {
            expect(result).toContain(name as string);
          }
          expect(result.includes('(')).toBe(translationNumber !== undefined);
          expect(result.includes(')')).toBe(translationNumber !== undefined);

          const expected = [
            number,
            ...(nameIsNonBlank ? [name as string] : []),
            ...(translationNumber !== undefined ? [`(${translationNumber})`] : []),
          ].join(' ');
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
