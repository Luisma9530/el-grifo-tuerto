// Backup reminder: campaigns live only in this browser, so nudge the player
// to export a JSON copy when there is progress that was never backed up.

const EXPORTS_KEY = 'tavern_campaign_exports'; // { [campaignId]: lastExportedAtIso }
const DISMISSED_KEY = 'tavern_backup_reminder_dismissed_at';

export const REMIND_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function getExportTimes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPORTS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Record that these campaigns were just exported to a JSON file. */
export function markCampaignsExported(ids, at = new Date().toISOString()) {
  try {
    const exports = getExportTimes();
    ids.forEach(id => { exports[id] = at; });
    localStorage.setItem(EXPORTS_KEY, JSON.stringify(exports));
  } catch (error) {
    console.error('Error al registrar la exportación:', error);
  }
}

/** Most recent export of any campaign (null if never exported). */
export function getLastBackupAt() {
  const times = Object.values(getExportTimes()).filter(Boolean);
  if (times.length === 0) return null;
  return times.reduce((a, b) => (toTime(a) >= toTime(b) ? a : b));
}

export function getReminderDismissedAt() {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function dismissBackupReminder(at = new Date().toISOString()) {
  try {
    localStorage.setItem(DISMISSED_KEY, at);
  } catch {
    // ignore: worst case the reminder shows again
  }
}

// ---------------------------------------------------------------------------
// Pure logic
// ---------------------------------------------------------------------------

/** Campaigns with real progress (beyond the opening message) changed since their last export. */
export function getPendingBackupCampaigns(campaigns = [], exports = {}) {
  return campaigns.filter(c => {
    const played = (c.messageCount ?? c.messages?.length ?? 0) > 1;
    return played && toTime(c.updatedAt) > toTime(exports[c.id]);
  });
}

/**
 * Decide whether to show the reminder: there is un-backed-up progress whose
 * oldest pending change is at least REMIND_AFTER_DAYS old, and the player
 * hasn't dismissed the reminder in that period.
 */
export function shouldShowBackupReminder({ campaigns = [], exports = {}, dismissedAt = null, now = Date.now() }) {
  const pending = getPendingBackupCampaigns(campaigns, exports);
  if (pending.length === 0) return { show: false, pending };

  // When each campaign started having un-exported progress (approx.)
  const oldestPendingSince = Math.min(
    ...pending.map(c => Math.max(toTime(exports[c.id]), toTime(c.createdAt)))
  );
  const anchor = Math.max(oldestPendingSince, toTime(dismissedAt));
  return { show: now - anchor >= REMIND_AFTER_DAYS * DAY_MS, pending };
}
