// Persistent Campaign Management for El Grifo Tuerto
// Handles multiple campaigns in localStorage, auto-saving, JSON export, and JSON import.

import { markCampaignsExported } from './backupReminder';
import { normalizeEquipment } from './equipment';
import { normalizeShops } from './shops';
import { normalizeConditions } from './conditions';
import { normalizeSnapshots } from './combatSnapshots';
import { normalizeQuests } from './quests';

const CAMPAIGNS_STORAGE_KEY = 'tavern_saved_campaigns';
const ACTIVE_CAMPAIGN_ID_KEY = 'tavern_active_campaign_id';

let lastSaveError = null;

/**
 * Returns true if the error was caused by localStorage being full
 */
export function isQuotaError(error) {
  if (!error) return false;
  return error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 || error.code === 1014;
}

/**
 * Last error produced by saveCampaign (null if the last save succeeded)
 */
export function getLastSaveError() {
  return lastSaveError;
}

/**
 * Generate a unique campaign ID
 */
export function generateCampaignId() {
  return `camp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Bring a campaign saved by an older version up to date. Characters without
 * hands get a valid set (first weapon and shield) and healthy limbs; without
 * an armor slot they wear their starting armor (same AC). Shops (stock kept
 * per shop) start empty. Heroes, and enemies of a fight in progress, without
 * conditions start with none (invalid entries are dropped). Snapshots of the
 * start of recent fights (for the combat simulator) start empty, and so does
 * the quest journal.
 */
export function migrateCampaign(campaign) {
  if (!campaign || typeof campaign !== 'object' || !campaign.character || typeof campaign.character !== 'object') return campaign;
  const character = { ...normalizeEquipment(campaign.character), conditions: normalizeConditions(campaign.character.conditions) };
  const encounter = campaign.encounter && Array.isArray(campaign.encounter.enemies)
    ? { ...campaign.encounter, enemies: campaign.encounter.enemies.map(e => ({ ...e, conditions: normalizeConditions(e?.conditions) })) }
    : campaign.encounter;
  return {
    ...campaign, character, encounter, shops: normalizeShops(campaign.shops), combatSnapshots: normalizeSnapshots(campaign.combatSnapshots),
    quests: normalizeQuests(campaign.quests)
  };
}

/**
 * Retrieve all saved campaigns, sorted by updatedAt descending
 */
export function getAllCampaigns() {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map(migrateCampaign).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  } catch (error) {
    console.error('Error al recuperar campañas guardadas:', error);
    return [];
  }
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

/**
 * Retrieve a single campaign by ID
 */
export function getCampaignById(id) {
  if (!id) return null;
  const list = getAllCampaigns();
  return list.find(c => c.id === id) || null;
}

/**
 * Save or update a campaign
 */
export function saveCampaign(campaignData) {
  try {
    const list = getAllCampaigns();
    const now = new Date().toISOString();

    const campaignId = campaignData.id || generateCampaignId();
    const existingIndex = list.findIndex(c => c.id === campaignId);

    const title = campaignData.title?.trim() || 
      `${campaignData.character?.name || 'Héroe'} en ${campaignData.world?.name || 'la Taberna'}`;

    const campaignRecord = {
      ...migrateCampaign(campaignData),
      id: campaignId,
      title,
      createdAt: campaignData.createdAt || list[existingIndex]?.createdAt || now,
      updatedAt: now,
      messageCount: campaignData.messages?.length || 0,
      lastPreview: campaignData.messages?.length > 0 
        ? campaignData.messages[campaignData.messages.length - 1].text?.slice(0, 120) 
        : 'Inicio de la partida...'
    };

    if (existingIndex >= 0) {
      list[existingIndex] = campaignRecord;
    } else {
      list.unshift(campaignRecord);
    }

    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(list));
    setActiveCampaignId(campaignId);
    lastSaveError = null;
    return campaignRecord;
  } catch (error) {
    console.error('Error al guardar campaña:', error);
    lastSaveError = error;
    return null;
  }
}

/**
 * Create a new brand-new campaign initialized with world & character
 */
export function createNewCampaign({ world, character, title }) {
  const initialMessages = [
    {
      sender: 'duncan',
      text: world.initialStory,
      timestamp: 'Inicio de Campaña'
    }
  ];

  const defaultActions = [
    'Preguntar a Maese Duncan por rumores locales',
    'Pedir una jarra de cerveza negra para entrar en calor',
    'Revisar tu equipo y afilar tus armas',
    'Salir de la taberna a explorar los alrededores'
  ];

  const newCampaign = {
    id: generateCampaignId(),
    title: title || `${character?.name || 'Aventurero'} — ${world?.name || 'Nueva Aventura'}`,
    world: JSON.parse(JSON.stringify(world)),
    character: JSON.parse(JSON.stringify(character)),
    messages: initialMessages,
    suggestedActions: defaultActions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return saveCampaign(newCampaign);
}

/**
 * Delete a campaign by ID
 */
export function deleteCampaign(id) {
  try {
    const list = getAllCampaigns().filter(c => c.id !== id);
    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(list));
    if (getActiveCampaignId() === id) {
      setActiveCampaignId(list.length > 0 ? list[0].id : null);
    }
    return true;
  } catch (error) {
    console.error('Error al borrar campaña:', error);
    return false;
  }
}

/**
 * Duplicate an existing campaign as a separate branching save slot
 */
export function duplicateCampaign(id) {
  const source = getCampaignById(id);
  if (!source) return null;

  const clone = {
    ...JSON.parse(JSON.stringify(source)),
    id: generateCampaignId(),
    title: `${source.title} (Copia / Rama)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return saveCampaign(clone);
}

/**
 * Export a single campaign as a downloaded .json file
 */
export function exportCampaignAsJson(id) {
  const campaign = getCampaignById(id);
  if (!campaign) {
    alert('No se encontró la campaña para exportar.');
    return;
  }

  const exportPayload = {
    app: 'El Grifo Tuerto RPG',
    version: '1.0',
    type: 'single_campaign',
    exportedAt: new Date().toISOString(),
    campaign
  };

  triggerDownload(
    `campana_${sanitizeFileName(campaign.title)}_${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(exportPayload, null, 2)
  );
  markCampaignsExported([campaign.id]);
}

/**
 * Export all campaigns as a single backup .json file
 */
export function exportAllCampaignsAsJson() {
  const campaigns = getAllCampaigns();
  if (campaigns.length === 0) {
    alert('No tienes campañas guardadas para exportar.');
    return;
  }

  const exportPayload = {
    app: 'El Grifo Tuerto RPG',
    version: '1.0',
    type: 'campaign_bundle',
    exportedAt: new Date().toISOString(),
    count: campaigns.length,
    campaigns
  };

  triggerDownload(
    `grifo_tuerto_todas_las_campanas_${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(exportPayload, null, 2)
  );
  markCampaignsExported(campaigns.map(c => c.id));
}

/**
 * Import a campaign or bundle of campaigns from a JSON string or file
 */
export function importCampaignsFromJson(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Formato de archivo de campaña no reconocido.');
    }
    let campaignsToImport = [];

    if (parsed.campaign && typeof parsed.campaign === 'object') {
      // Single campaign export
      campaignsToImport.push(parsed.campaign);
    } else if (Array.isArray(parsed.campaigns)) {
      // Campaign bundle export
      campaignsToImport = parsed.campaigns;
    } else if (parsed.world && parsed.character && Array.isArray(parsed.messages)) {
      // Direct raw campaign object
      campaignsToImport.push(parsed);
    } else if (Array.isArray(parsed)) {
      // Direct array of campaigns
      campaignsToImport = parsed;
    } else {
      throw new Error('Formato de archivo de campaña no reconocido.');
    }

    const currentList = getAllCampaigns();
    let importedCount = 0;
    let lastImportedId = null;

    campaignsToImport.forEach(item => {
      if (!item || typeof item !== 'object') return;
      if (!item.world || typeof item.world !== 'object') return;
      if (!item.character || typeof item.character !== 'object') return;

      // Assign a new ID to prevent colliding with existing ones unless desired
      const newId = generateCampaignId();
      const messages = Array.isArray(item.messages)
        ? item.messages.filter(m => m && typeof m === 'object' && typeof m.text === 'string')
        : [];
      const importedCampaign = {
        ...migrateCampaign(item),
        messages,
        suggestedActions: Array.isArray(item.suggestedActions)
          ? item.suggestedActions.filter(a => typeof a === 'string')
          : [],
        id: newId,
        title: item.title ? `${item.title} (Importada)` : `Campaña Importada (${new Date().toLocaleDateString()})`,
        updatedAt: new Date().toISOString()
      };

      currentList.unshift(importedCampaign);
      lastImportedId = newId;
      importedCount++;
    });

    if (importedCount === 0) {
      throw new Error('No se encontraron campañas válidas en el archivo seleccionado.');
    }

    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(currentList));
    if (lastImportedId) {
      setActiveCampaignId(lastImportedId);
    }

    return {
      success: true,
      count: importedCount,
      lastImportedId
    };
  } catch (error) {
    console.error('Error al importar campaña:', error);
    return {
      success: false,
      error: error.message || 'Error al procesar el archivo JSON.'
    };
  }
}

/**
 * Helper to download content as a local file
 */
function triggerDownload(fileName, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper to sanitize filenames
 */
function sanitizeFileName(str) {
  return (str || 'partida')
    .toLowerCase()
    .replace(/[áäàâ]/g, 'a')
    .replace(/[éëèê]/g, 'e')
    .replace(/[íïìî]/g, 'i')
    .replace(/[óöòô]/g, 'o')
    .replace(/[úüùû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30);
}
