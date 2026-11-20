// Campaign memory for the AI Dungeon Master, built to keep every request small.
//
// Instead of resending a long chronicle, each request carries:
// - a short summary of the campaign so far (written by the AI itself, in the
//   same call as a normal turn, only every few turns: no extra requests);
// - the messages not covered by that summary yet (a handful);
// - facts the game records by itself (travel, level ups...), at no AI cost.

/** Ask for a new summary once this many messages are not covered by it. */
export const SUMMARY_TRIGGER = 10;
/** Messages kept outside the summary after it is updated, for immediate context. */
export const KEEP_RECENT = 2;
/** Never send more than this many recent messages. */
export const MAX_RECENT = 14;
export const SUMMARY_MAX_CHARS = 1200;
export const MAX_EVENTS = 30;
export const EVENTS_IN_PROMPT = 8;

const coverageOf = (messages, coverage) => Math.min(Math.max(0, Number(coverage) || 0), messages.length);

/** Messages the next request has to include (those after the summary). */
export function historyForPrompt(messages = [], coverage = 0) {
  return messages.slice(coverageOf(messages, coverage)).slice(-MAX_RECENT);
}

/** True when the summary should be refreshed in this request. */
export function needsSummary(messages = [], coverage = 0) {
  return messages.length - coverageOf(messages, coverage) > SUMMARY_TRIGGER;
}

/**
 * Where the summary coverage moves after the AI wrote a new summary,
 * given the number of messages in the chronicle once its reply is added.
 */
export const coverageAfterSummary = messageCount => Math.max(0, messageCount - KEEP_RECENT);

/** Clean a summary written by the AI. */
export function cleanSummary(text) {
  if (typeof text !== 'string') return null;
  const clean = text.trim().replace(/\n{3,}/g, '\n\n');
  if (!clean) return null;
  return clean.length > SUMMARY_MAX_CHARS ? `${clean.slice(0, SUMMARY_MAX_CHARS - 1)}…` : clean;
}

/** Record a fact of the campaign (keeps the latest MAX_EVENTS; skips repeats in a row). */
export function addEvent(events = [], text) {
  const fact = String(text || '').trim();
  if (!fact || events[events.length - 1] === fact) return events;
  return [...events, fact].slice(-MAX_EVENTS);
}

/** The facts sent to the AI. */
export const eventsForPrompt = (events = []) => events.slice(-EVENTS_IN_PROMPT);
