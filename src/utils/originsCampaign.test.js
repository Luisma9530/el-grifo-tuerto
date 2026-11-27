import { describe, it, expect, beforeEach } from 'vitest';
import { PRESET_WORLDS } from '../data/gameData';
import { createNewCampaign, getCampaignById, migrateCampaign, importCampaignsFromJson } from './campaignStorage';
import { createParty } from './party';
import { startFromOrigins } from './origins';
import { isSplit } from './splitParty';

// Saving and loading campaigns that started apart, and the older ones (together)

const hero = (id, over = {}) => ({ id, name: id, race: 'Humano', class: 'Guerrero', hp: 10, maxHp: 10, ac: 12, gold: 10, inventory: [], stats: {}, ...over });

beforeEach(() => localStorage.clear());

describe('campañas que empiezan separadas', () => {
  it('se crean con la crónica de cada escena y se guardan tal cual', () => {
    const start = startFromOrigins(PRESET_WORLDS[0], [hero('a', { backgroundId: 'smith', speciesId: 'dwarf' }), hero('b', { backgroundId: 'acolyte' })]);
    const camp = createNewCampaign({ world: start.world, party: start.party, messages: start.messages, suggestedActions: start.suggestedActions, title: 'T' });
    const loaded = getCampaignById(camp.id);
    expect(isSplit(loaded.party)).toBe(true);
    expect(loaded.party.split.groups).toEqual(start.party.split.groups);
    expect(loaded.messages.map(m => m.groupId)).toEqual(start.messages.map(m => m.groupId));
    expect(loaded.world.startZones.length).toBeGreaterThanOrEqual(4);
  });

  it('se exportan e importan sin perder la separación', () => {
    const start = startFromOrigins(PRESET_WORLDS[1], [hero('a'), hero('b', { speciesId: 'dwarf', backgroundId: 'smith' })], ['zone-parias', 'zone-yunques']);
    const json = JSON.stringify({ campaign: { world: start.world, party: start.party, messages: start.messages, title: 'X' } });
    const res = importCampaignsFromJson(json);
    expect(res.success).toBe(true);
    expect(isSplit(getCampaignById(res.lastImportedId).party)).toBe(true);
  });
});

describe('compatibilidad', () => {
  it('las campañas de antes siguen juntas, sin cambios', () => {
    const old = { id: 'c1', world: PRESET_WORLDS[0], character: hero('a'), messages: [{ sender: 'duncan', text: 'Hola' }] };
    const migrated = migrateCampaign(old);
    expect(migrated.party.split).toBeUndefined();
    expect(migrated.party.startMode).toBeUndefined();
    const partyCamp = migrateCampaign({ id: 'c2', world: PRESET_WORLDS[0], party: createParty([hero('a'), hero('b')]), messages: [] });
    expect(partyCamp.party.split).toBeUndefined();
    expect(partyCamp.party.gold).toBe(20);
  });

  it('empezar juntos crea la campaña como siempre', () => {
    const camp = createNewCampaign({ world: PRESET_WORLDS[0], party: createParty([hero('a')]), title: 'Y' });
    expect(camp.messages[0].text).toBe(PRESET_WORLDS[0].initialStory);
    expect(camp.messages[0].groupId).toBeUndefined();
    expect(camp.world.startZones).toBeUndefined();
  });
});
