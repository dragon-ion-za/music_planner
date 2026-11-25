import fc from 'fast-check';
import moment from 'moment';
import { buildDraftSlots, buildModalConflictMap, getSlotHighlight } from './modal-conflict.util';
import { buildSongLookup } from './service-form.util';
import { RepertoireEntry } from '../models/repertoire.model';
import { Service, SlotConflictStatus } from '../models/service.model';
import repertoireData from '../../../assets/repertoire.json';

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

describe('buildModalConflictMap letter case', () => {
  const songs = (repertoireData as { songs: RepertoireEntry[] }).songs;
  const lookup = buildSongLookup(songs);
  const repertoireMap = new Map<string, RepertoireEntry>(songs.map(s => [s.number, s]));
  const numbers = songs.map(s => s.number);
  const draftDate = '2024-06-15';
  const slotKeys = ['orchestra1', 'orchestra2', 'choir1', 'congregationBS', 'congregationOH'];

  const paddingArb = fc.array(fc.constantFrom(' ', '\t'), { maxLength: 3 }).map(a => a.join(''));
  const variedArb = fc.record({
    index: fc.nat({ max: numbers.length - 1 }),
    mask: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
    left: paddingArb,
    right: paddingArb,
  });
  const serviceArb = fc.record({
    offset: fc.integer({ min: -500, max: 500 }),
    slotSongs: fc.array(fc.nat({ max: numbers.length - 1 }), { minLength: 1, maxLength: 4 }),
  });

  // Feature: dialog-conflict-field-highlight, Property 6: conflict results do not depend on input letter case
  // **Validates: Requirements 6.1, 6.2**
  it('Property 6: case-varied, padded inputs give the same conflict map as canonical numbers', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fc.array(serviceArb, { maxLength: 5 }),
          fc.array(variedArb, { minLength: 1, maxLength: slotKeys.length }),
          (serviceSpecs, drafts) => {
            const windowServices: Service[] = serviceSpecs.map((spec, i) => ({
              id: 'svc' + i,
              congregationId: 'c',
              serviceDate: moment(draftDate).add(spec.offset, 'days').format('YYYY-MM-DD'),
              serviceType: 'Sunday',
              serviceSlots: spec.slotSongs.map((idx, j) => {
                const entry = songs[idx];
                return {
                  id: 'svc' + i + '-slot' + j,
                  serviceId: 'svc' + i,
                  slotTemplateId: 't' + j,
                  songId: entry.number,
                  slotTemplate: { slotKey: 'k' + j, category: 'orchestra' as const, displayOrder: j },
                  song: {
                    number: entry.number,
                    hymnal: '',
                    name: null,
                    ...(entry.translation ? { translationOf: { number: entry.translation, name: null, hymnal: '' } } : {}),
                  },
                };
              }),
            }));

            const variedInputs = drafts.map((d, i) => {
              const canonical = numbers[d.index];
              const varied = canonical
                .split('')
                .map((ch, k) => (d.mask[k % d.mask.length] ? ch.toLowerCase() : ch.toUpperCase()))
                .join('');
              return { slotKey: slotKeys[i], songNumber: d.left + varied + d.right };
            });
            const canonicalInputs = drafts.map((d, i) => ({ slotKey: slotKeys[i], songNumber: numbers[d.index] }));

            const fromVaried = buildModalConflictMap(
              windowServices, buildDraftSlots(variedInputs, lookup), draftDate, repertoireMap);
            const fromCanonical = buildModalConflictMap(
              windowServices, buildDraftSlots(canonicalInputs, lookup), draftDate, repertoireMap);

            expect(fromVaried).toEqual(fromCanonical);
            return true;
          }
        ),
        { numRuns: 100 }
      )
    ).not.toThrow();
  });
});