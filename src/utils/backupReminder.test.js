import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPendingBackupCampaigns,
  shouldShowBackupReminder,
  markCampaignsExported,
  getExportTimes,
  getLastBackupAt,
  dismissBackupReminder,
  getReminderDismissedAt
} from './backupReminder';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-20T12:00:00Z').getTime();
const daysAgo = n => new Date(NOW - n * DAY).toISOString();
const camp = (id, { created = 10, updated = 1, messages = 5 } = {}) => ({
  id,
  createdAt: daysAgo(created),
  updatedAt: daysAgo(updated),
  messageCount: messages
});

describe('getPendingBackupCampaigns', () => {
  it('ignores campaigns with only the opening message', () => {
    expect(getPendingBackupCampaigns([camp('a', { messages: 1 })], {})).toEqual([]);
  });
  it('includes played campaigns never exported or changed since export', () => {
    const list = [camp('never'), camp('changed', { updated: 1 }), camp('clean', { updated: 5 })];
    const exports = { changed: daysAgo(3), clean: daysAgo(2) };
    expect(getPendingBackupCampaigns(list, exports).map(c => c.id)).toEqual(['never', 'changed']);
  });
});

describe('shouldShowBackupReminder', () => {
  it('does not show without pending progress', () => {
    expect(shouldShowBackupReminder({ campaigns: [], now: NOW }).show).toBe(false);
  });
  it('waits 7 days after a campaign is created before reminding', () => {
    expect(shouldShowBackupReminder({ campaigns: [camp('a', { created: 3 })], now: NOW }).show).toBe(false);
    expect(shouldShowBackupReminder({ campaigns: [camp('a', { created: 8 })], now: NOW }).show).toBe(true);
  });
  it('counts from the last export when there is one', () => {
    const c = camp('a', { created: 30, updated: 1 });
    expect(shouldShowBackupReminder({ campaigns: [c], exports: { a: daysAgo(2) }, now: NOW }).show).toBe(false);
    expect(shouldShowBackupReminder({ campaigns: [c], exports: { a: daysAgo(9) }, now: NOW }).show).toBe(true);
  });
  it('respects a recent dismissal', () => {
    const c = camp('a', { created: 30 });
    expect(shouldShowBackupReminder({ campaigns: [c], dismissedAt: daysAgo(2), now: NOW }).show).toBe(false);
    expect(shouldShowBackupReminder({ campaigns: [c], dismissedAt: daysAgo(8), now: NOW }).show).toBe(true);
  });
  it('returns the pending campaigns', () => {
    const r = shouldShowBackupReminder({ campaigns: [camp('a', { created: 30 }), camp('b', { messages: 1 })], now: NOW });
    expect(r.pending.map(c => c.id)).toEqual(['a']);
  });
});

describe('persistence', () => {
  beforeEach(() => localStorage.clear());

  it('records exports and reports the last backup', () => {
    expect(getLastBackupAt()).toBeNull();
    markCampaignsExported(['a', 'b'], '2026-11-01T00:00:00Z');
    markCampaignsExported(['a'], '2026-11-05T00:00:00Z');
    expect(getExportTimes()).toEqual({ a: '2026-11-05T00:00:00Z', b: '2026-11-01T00:00:00Z' });
    expect(getLastBackupAt()).toBe('2026-11-05T00:00:00Z');
  });

  it('stores the dismissal time', () => {
    dismissBackupReminder('2026-11-02T00:00:00Z');
    expect(getReminderDismissedAt()).toBe('2026-11-02T00:00:00Z');
  });

  it('survives corrupt data', () => {
    localStorage.setItem('tavern_campaign_exports', '{oops');
    expect(getExportTimes()).toEqual({});
  });
});
