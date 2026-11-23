// The saved campaigns as stored in this browser, read without bringing them up
// to date. The landing page only needs to know which campaign to resume, its
// title and how many there are: reading them raw keeps the game engine (the
// migrations in campaignStorage.js) out of the landing page's bundle. The game
// screen migrates the campaign it receives.

export const CAMPAIGNS_STORAGE_KEY = 'tavern_saved_campaigns';
export const ACTIVE_CAMPAIGN_ID_KEY = 'tavern_active_campaign_id';

/** The saved campaigns as stored (not migrated), most recently updated first. */
export function readSavedCampaigns() {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  } catch (error) {
    console.error('Error al recuperar campañas guardadas:', error);
    return [];
  }
}

/** One saved campaign as stored (not migrated), or null. */
export function readSavedCampaign(id) {
  if (!id) return null;
  return readSavedCampaigns().find(c => c?.id === id) || null;
}

/**
 * Get active campaign ID
 */
export function getActiveCampaignId() {
  try {
    return localStorage.getItem(ACTIVE_CAMPAIGN_ID_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Set active campaign ID
 */
export function setActiveCampaignId(id) {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_CAMPAIGN_ID_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CAMPAIGN_ID_KEY);
    }
  } catch (error) {
    console.error('Error al guardar activeCampaignId:', error);
  }
}
