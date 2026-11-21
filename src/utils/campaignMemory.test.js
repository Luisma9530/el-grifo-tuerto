import { describe, it, expect } from 'vitest';
import {
  historyForPrompt, needsSummary, coverageAfterSummary, cleanSummary, addEvent, eventsForPrompt,
  SUMMARY_TRIGGER, KEEP_RECENT, MAX_RECENT, MAX_EVENTS
} from './campaignMemory';

const chronicle = n => Array.from({ length: n }, (_, i) => ({ sender: i % 2 ? 'duncan' : 'player', text: `m${i}` }));

describe('campaign memory', () => {
  it('sends only the messages after the summary', () => {
    expect(historyForPrompt(chronicle(10), 0)).toHaveLength(10);
    expect(historyForPrompt(chronicle(10), 6).map(m => m.text)).toEqual(['m6', 'm7', 'm8', 'm9']);
    expect(historyForPrompt(chronicle(40), 0)).toHaveLength(MAX_RECENT);
    expect(historyForPrompt(chronicle(5), 99)).toEqual([]);
  });

  it('asks for a summary when too many messages are uncovered', () => {
    expect(needsSummary(chronicle(SUMMARY_TRIGGER), 0)).toBe(false);
    expect(needsSummary(chronicle(SUMMARY_TRIGGER + 1), 0)).toBe(true);
    expect(needsSummary(chronicle(30), 20)).toBe(false);
  });

  it('a new summary covers all but the last few messages', () => {
    expect(coverageAfterSummary(15)).toBe(15 - KEEP_RECENT);
    expect(coverageAfterSummary(2)).toBe(0);
    // Over a long game the request never carries more than the trigger plus one turn
    let coverage = 0;
    let longest = 0;
    for (let n = 1; n <= 200; n += 2) {
      const messages = chronicle(n);
      longest = Math.max(longest, historyForPrompt(messages, coverage).length);
      if (needsSummary(messages, coverage)) coverage = coverageAfterSummary(n + 1);
    }
    expect(longest).toBeLessThanOrEqual(SUMMARY_TRIGGER + 2);
  });

  it('cleans summaries', () => {
    expect(cleanSummary('  hola \n\n\n\n adiós ')).toBe('hola \n\n adiós');
    expect(cleanSummary('')).toBeNull();
    expect(cleanSummary(42)).toBeNull();
    expect(cleanSummary('a'.repeat(2000))).toHaveLength(1200);
  });

  it('records game facts without repeats and with a limit', () => {
    let events = addEvent([], 'Viaja a: Molino');
    events = addEvent(events, 'Viaja a: Molino');
    events = addEvent(events, '  ');
    expect(events).toEqual(['Viaja a: Molino']);
    for (let i = 0; i < 50; i++) events = addEvent(events, `Hecho ${i}`);
    expect(events).toHaveLength(MAX_EVENTS);
    expect(eventsForPrompt(events)).toHaveLength(8);
    expect(eventsForPrompt(events).at(-1)).toBe('Hecho 49');
  });
});
