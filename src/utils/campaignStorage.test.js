import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isQuotaError,
  getLastSaveError,
  getAllCampaigns,
  getActiveCampaignId,
  setActiveCampaignId,
  getCampaignById,
  saveCampaign,
  createNewCampaign,
  deleteCampaign,
  duplicateCampaign,
  importCampaignsFromJson,
} from './campaignStorage.js';

const CAMPAIGNS_KEY = 'tavern_saved_campaigns';
const ACTIVE_KEY = 'tavern_active_campaign_id';

const world = { name: 'Valle Umbrío', initialStory: 'La lluvia golpea las ventanas...' };
const character = { name: 'Aria', class: 'Pícara' };

const baseCampaign = (overrides = {}) => ({
  world,
  character,
  messages: [{ sender: 'duncan', text: 'Hola', timestamp: 't' }],
  suggestedActions: ['Mirar'],
  ...overrides,
});

const storeRaw = (list) => localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));

function quotaError() {
  const err = new Error('The quota has been exceeded.');
  err.name = 'QuotaExceededError';
  return err;
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('isQuotaError', () => {
  it('detects quota errors by name and code', () => {
    expect(isQuotaError(quotaError())).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError({ code: 1014 })).toBe(true);
  });

  it('returns false for other errors and falsy values', () => {
    expect(isQuotaError(new Error('boom'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});

describe('getAllCampaigns', () => {
  it('returns [] when nothing is stored', () => {
    expect(getAllCampaigns()).toEqual([]);
  });

  it('sorts by updatedAt descending', () => {
    storeRaw([
      { id: 'a', updatedAt: '2024-01-01T00:00:00.000Z' },
      { id: 'b', updatedAt: '2025-06-01T00:00:00.000Z' },
      { id: 'c' },
      { id: 'd', updatedAt: '2024-12-01T00:00:00.000Z' },
    ]);
    expect(getAllCampaigns().map((c) => c.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('returns [] on corrupt JSON', () => {
    localStorage.setItem(CAMPAIGNS_KEY, '{not valid json');
    expect(getAllCampaigns()).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify({ id: 'x' }));
    expect(getAllCampaigns()).toEqual([]);
  });
});

describe('active campaign id', () => {
  it('sets, reads and clears the active id', () => {
    expect(getActiveCampaignId()).toBeNull();
    setActiveCampaignId('abc');
    expect(getActiveCampaignId()).toBe('abc');
    setActiveCampaignId(null);
    expect(getActiveCampaignId()).toBeNull();
    expect(localStorage.getItem(ACTIVE_KEY)).toBeNull();
  });
});

describe('saveCampaign', () => {
  it('creates a new campaign with generated id, title and metadata', () => {
    const saved = saveCampaign(baseCampaign());
    expect(saved).not.toBeNull();
    expect(saved.id).toMatch(/^camp_\d+_[a-z0-9]+$/);
    expect(saved.title).toBe('Aria en Valle Umbrío');
    expect(saved.createdAt).toBeTruthy();
    expect(saved.updatedAt).toBeTruthy();
    expect(saved.messageCount).toBe(1);
    expect(saved.lastPreview).toBe('Hola');
    expect(getAllCampaigns()).toHaveLength(1);
    expect(getCampaignById(saved.id)).toEqual(saved);
    expect(getLastSaveError()).toBeNull();
  });

  it('uses the default preview when there are no messages', () => {
    const saved = saveCampaign(baseCampaign({ messages: [] }));
    expect(saved.messageCount).toBe(0);
    expect(saved.lastPreview).toBe('Inicio de la partida...');
  });

  it('keeps a provided non-empty title (trimmed)', () => {
    const saved = saveCampaign(baseCampaign({ title: '  Mi Partida  ' }));
    expect(saved.title).toBe('Mi Partida');
  });

  it('sets the saved campaign as active', () => {
    const saved = saveCampaign(baseCampaign());
    expect(getActiveCampaignId()).toBe(saved.id);
  });

  it('updates an existing campaign in place', () => {
    const first = saveCampaign(baseCampaign());
    const updated = saveCampaign({
      ...first,
      messages: [...first.messages, { sender: 'player', text: 'Una cerveza' }],
    });
    const all = getAllCampaigns();
    expect(all).toHaveLength(1);
    expect(updated.id).toBe(first.id);
    expect(updated.messageCount).toBe(2);
    expect(updated.lastPreview).toBe('Una cerveza');
  });

  it('preserves the existing createdAt when the update payload omits createdAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00.000Z'));
    const first = saveCampaign(baseCampaign());
    expect(first.createdAt).toBe('2024-01-01T10:00:00.000Z');

    vi.setSystemTime(new Date('2024-02-01T10:00:00.000Z'));
    // eslint-disable-next-line no-unused-vars
    const { createdAt, ...withoutCreatedAt } = first;
    const updated = saveCampaign({ ...withoutCreatedAt, title: 'Renombrada' });

    expect(updated.createdAt).toBe('2024-01-01T10:00:00.000Z');
    expect(updated.updatedAt).toBe('2024-02-01T10:00:00.000Z');
    expect(getCampaignById(first.id).createdAt).toBe('2024-01-01T10:00:00.000Z');
  });

  it('returns null and records the error when localStorage.setItem throws a quota error', () => {
    const err = quotaError();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw err;
    });

    const result = saveCampaign(baseCampaign());

    expect(result).toBeNull();
    expect(getLastSaveError()).not.toBeNull();
    expect(getLastSaveError()).toBe(err);
    expect(isQuotaError(getLastSaveError())).toBe(true);
  });

  it('clears the last save error after a successful save', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError();
    });
    saveCampaign(baseCampaign());
    expect(getLastSaveError()).not.toBeNull();

    spy.mockRestore();
    expect(saveCampaign(baseCampaign())).not.toBeNull();
    expect(getLastSaveError()).toBeNull();
  });
});

describe('createNewCampaign', () => {
  it('creates and persists a campaign with the initial story and default actions', () => {
    const created = createNewCampaign({ world, character });
    expect(created).not.toBeNull();
    expect(created.title).toBe('Aria — Valle Umbrío');
    expect(created.messages).toHaveLength(1);
    expect(created.messages[0]).toMatchObject({ sender: 'duncan', text: world.initialStory });
    expect(created.suggestedActions).toHaveLength(4);
    expect(created.world).toEqual(world);
    expect(created.world).not.toBe(world);
    expect(created.character).toMatchObject(character); // plus hands and limbs (see equipment.js)
    expect(created.character.hands).toEqual({ main: null, off: null });
    expect(created.character).not.toBe(character);
    expect(getAllCampaigns()).toHaveLength(1);
    expect(getActiveCampaignId()).toBe(created.id);
  });

  it('uses a custom title when provided', () => {
    const created = createNewCampaign({ world, character, title: 'Custom' });
    expect(created.title).toBe('Custom');
  });
});

describe('deleteCampaign', () => {
  it('removes the campaign and reassigns the active id to the most recent remaining', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const a = saveCampaign(baseCampaign({ title: 'A' }));
    vi.setSystemTime(new Date('2024-01-02T00:00:00.000Z'));
    const b = saveCampaign(baseCampaign({ title: 'B' }));
    vi.setSystemTime(new Date('2024-01-03T00:00:00.000Z'));
    const c = saveCampaign(baseCampaign({ title: 'C' }));
    expect(getActiveCampaignId()).toBe(c.id);

    expect(deleteCampaign(c.id)).toBe(true);
    expect(getCampaignById(c.id)).toBeNull();
    expect(getAllCampaigns().map((x) => x.id)).toEqual([b.id, a.id]);
    expect(getActiveCampaignId()).toBe(b.id);
  });

  it('does not change the active id when deleting a non-active campaign', () => {
    const a = saveCampaign(baseCampaign({ title: 'A' }));
    const b = saveCampaign(baseCampaign({ title: 'B' }));
    expect(getActiveCampaignId()).toBe(b.id);
    deleteCampaign(a.id);
    expect(getActiveCampaignId()).toBe(b.id);
  });

  it('clears the active id when the last campaign is deleted', () => {
    const a = saveCampaign(baseCampaign());
    deleteCampaign(a.id);
    expect(getAllCampaigns()).toEqual([]);
    expect(getActiveCampaignId()).toBeNull();
  });
});

describe('duplicateCampaign', () => {
  it('creates a deep copy with a new id and suffixed title', () => {
    const source = saveCampaign(baseCampaign({ title: 'Original' }));
    const copy = duplicateCampaign(source.id);
    expect(copy).not.toBeNull();
    expect(copy.id).not.toBe(source.id);
    expect(copy.title).toBe('Original (Copia / Rama)');
    expect(copy.messages).toEqual(source.messages);
    expect(getAllCampaigns()).toHaveLength(2);
    expect(getActiveCampaignId()).toBe(copy.id);
    // source unchanged
    expect(getCampaignById(source.id).title).toBe('Original');
  });

  it('returns null for an unknown id', () => {
    expect(duplicateCampaign('missing')).toBeNull();
  });
});

describe('importCampaignsFromJson', () => {
  it('imports a single-campaign export', () => {
    const payload = { type: 'single_campaign', campaign: baseCampaign({ id: 'orig', title: 'Uno' }) };
    const res = importCampaignsFromJson(JSON.stringify(payload));
    expect(res.success).toBe(true);
    expect(res.count).toBe(1);
    const imported = getCampaignById(res.lastImportedId);
    expect(imported.id).not.toBe('orig');
    expect(imported.title).toBe('Uno (Importada)');
    expect(getActiveCampaignId()).toBe(res.lastImportedId);
  });

  it('imports a campaign bundle', () => {
    const payload = {
      type: 'campaign_bundle',
      campaigns: [baseCampaign({ title: 'A' }), baseCampaign({ title: 'B' })],
    };
    const res = importCampaignsFromJson(JSON.stringify(payload));
    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(getAllCampaigns()).toHaveLength(2);
  });

  it('imports a raw array of campaigns', () => {
    const res = importCampaignsFromJson(JSON.stringify([baseCampaign(), baseCampaign()]));
    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
  });

  it('imports a direct raw campaign object', () => {
    const res = importCampaignsFromJson(JSON.stringify(baseCampaign()));
    expect(res.success).toBe(true);
    expect(res.count).toBe(1);
  });

  it('keeps existing campaigns when importing', () => {
    saveCampaign(baseCampaign({ title: 'Existente' }));
    importCampaignsFromJson(JSON.stringify([baseCampaign()]));
    expect(getAllCampaigns()).toHaveLength(2);
  });

  it('fails on null input', () => {
    expect(importCampaignsFromJson('null').success).toBe(false);
    expect(importCampaignsFromJson(null).success).toBe(false);
    expect(getAllCampaigns()).toEqual([]);
  });

  it('skips null and invalid items', () => {
    const res = importCampaignsFromJson(
      JSON.stringify([null, 42, { world }, { character }, baseCampaign({ title: 'Ok' })]),
    );
    expect(res.success).toBe(true);
    expect(res.count).toBe(1);
    expect(getAllCampaigns()).toHaveLength(1);
  });

  it('coerces non-array messages to [] and drops invalid message entries', () => {
    const res = importCampaignsFromJson(
      JSON.stringify([
        baseCampaign({ title: 'NoArray', messages: 'not an array' }),
        baseCampaign({ title: 'Mixed', messages: [null, { text: 5 }, { text: 'ok' }] }),
      ]),
    );
    expect(res.success).toBe(true);
    const all = getAllCampaigns();
    const noArray = all.find((c) => c.title === 'NoArray (Importada)');
    const mixed = all.find((c) => c.title === 'Mixed (Importada)');
    expect(noArray.messages).toEqual([]);
    expect(mixed.messages).toEqual([{ text: 'ok' }]);
  });

  it('filters non-string suggestedActions and defaults non-arrays to []', () => {
    const res = importCampaignsFromJson(
      JSON.stringify([
        baseCampaign({ title: 'A', suggestedActions: ['Ir', 3, null, { x: 1 }, 'Volver'] }),
        baseCampaign({ title: 'B', suggestedActions: 'nope' }),
      ]),
    );
    expect(res.success).toBe(true);
    const all = getAllCampaigns();
    expect(all.find((c) => c.title === 'A (Importada)').suggestedActions).toEqual(['Ir', 'Volver']);
    expect(all.find((c) => c.title === 'B (Importada)').suggestedActions).toEqual([]);
  });

  it('returns success:false for an invalid file', () => {
    const notJson = importCampaignsFromJson('esto no es json');
    expect(notJson.success).toBe(false);
    expect(typeof notJson.error).toBe('string');

    const unknownShape = importCampaignsFromJson(JSON.stringify({ foo: 'bar' }));
    expect(unknownShape.success).toBe(false);

    const noValid = importCampaignsFromJson(JSON.stringify([null, { foo: 1 }]));
    expect(noValid.success).toBe(false);
    expect(getAllCampaigns()).toEqual([]);
  });
});

describe('older saves', () => {
  const oldHero = {
    name: 'Valeria', ac: 18,
    inventory: [
      { id: 'espada', name: 'Espada Larga Consagrada', type: 'weapon' },
      { id: 'escudo', name: 'Escudo de Acero', type: 'armor' },
      { id: 'arco', name: 'Arco largo', type: 'weapon', equipped: false }
    ]
  };

  it('load with a valid set of hands, healthy limbs and the same AC', () => {
    storeRaw([{ id: 'old', world, character: oldHero, messages: [] }]);
    const loaded = getCampaignById('old').character;
    expect(loaded.hands).toEqual({ main: 'espada', off: 'escudo' });
    expect(loaded.limbs).toEqual({ rightArm: 'ok', leftArm: 'ok', rightLeg: 'ok', leftLeg: 'ok' });
    expect(loaded).toMatchObject({ ac: 18, acBase: 16 });
    expect(loaded.inventory.find(i => i.id === 'arco')).not.toHaveProperty('equipped');
  });

  it('keep hands and limbs when saved again', () => {
    storeRaw([{ id: 'old', world, character: oldHero, messages: [] }]);
    const hurt = { ...getCampaignById('old').character, limbs: { rightArm: 'ok', leftArm: 'lost', rightLeg: 'ok', leftLeg: 'ok' }, hands: { main: 'espada', off: null } };
    saveCampaign({ id: 'old', world, character: hurt, messages: [] });
    const raw = JSON.parse(localStorage.getItem(CAMPAIGNS_KEY))[0].character;
    expect(raw).toMatchObject({ hands: { main: 'espada', off: null }, limbs: { leftArm: 'lost' }, ac: 16 });
  });

  it('are migrated when imported from JSON', () => {
    const res = importCampaignsFromJson(JSON.stringify({ campaign: { world, character: oldHero, messages: [] } }));
    expect(res.success).toBe(true);
    const raw = JSON.parse(localStorage.getItem(CAMPAIGNS_KEY))[0].character;
    expect(raw.hands).toEqual({ main: 'espada', off: 'escudo' });
  });
});
