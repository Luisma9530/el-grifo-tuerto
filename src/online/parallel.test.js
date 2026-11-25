import { describe, it, expect } from 'vitest';
import { sanitizeIntent, applyIntent } from './protocol';
import { createRoom, joinPlayer, claimCharacter } from './room';
import { buildSections } from './snapshot';
import { migrateCampaign } from '../utils/campaignStorage';
import { createParty } from '../utils/party';
import { startApart } from '../utils/splitParty';

// A party apart online: each group is a system of its own, with its own fight

const CHARS = ['brena', 'tobias'];
const names = { brena: 'Brena', tobias: 'Tobías' };
const room0 = () => {
  let room = createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' });
  room = joinPlayer(room, { id: 'a', name: 'Ana' }).room;
  room = joinPlayer(room, { id: 'b', name: 'Bea' }).room;
  room = claimCharacter(room, 'a', 'brena', CHARS).room;
  return claimCharacter(room, 'b', 'tobias', CHARS).room;
};
// Brena fights (her turn); Tobías, in another group, is not fighting
const lanes = {
  brena: { inCombat: true, turnCharacterId: 'brena', combatBusy: false, finished: false },
  tobias: { inCombat: false, turnCharacterId: null, combatBusy: false, finished: false }
};
const game = (over = {}) => ({ characterIds: CHARS, names, inCombat: false, turnCharacterId: null, combatBusy: false, sceneOf: cid => ({ ...lanes[cid], ...(over[cid] || {}) }) });
const intent = raw => sanitizeIntent(raw).intent;

describe('combates simultáneos, uno por grupo', () => {
  it('cada uno juega el turno de su combate', () => {
    const res = applyIntent(room0(), game(), 'a', intent({ type: 'combat', characterId: 'brena', action: { type: 'dodge' } }));
    expect(res.ok).toBe(true);
    expect(res.combat.characterId).toBe('brena');
  });

  it('el combate de un grupo no frena las acciones del otro', () => {
    const res = applyIntent(room0(), game(), 'b', intent({ type: 'act', characterId: 'tobias', kind: 'text', payload: { text: 'Exploro la cueva' } }));
    expect(res.ok).toBe(true);
    // y quien está en combate sigue por turnos
    expect(applyIntent(room0(), game(), 'a', intent({ type: 'act', characterId: 'brena', kind: 'text', payload: { text: 'Hola' } })).ok).toBe(false);
    expect(applyIntent(room0(), game(), 'b', intent({ type: 'combat', characterId: 'tobias', action: { type: 'dodge' } })).error).toMatch(/ningún combate/);
  });

  it('dos combates a la vez: cada uno con su turno', () => {
    const both = game({ tobias: { inCombat: true, turnCharacterId: null } });
    expect(applyIntent(room0(), both, 'a', intent({ type: 'combat', characterId: 'brena', action: { type: 'dodge' } })).ok).toBe(true);
    expect(applyIntent(room0(), both, 'b', intent({ type: 'combat', characterId: 'tobias', action: { type: 'dodge' } })).error).toMatch(/enemigos/);
  });

  it('los jugadores cierran el combate terminado de su grupo', () => {
    expect(sanitizeIntent({ type: 'finish', characterId: 'a b' }).ok).toBe(false);
    const done = game({ brena: { inCombat: false, finished: true } });
    const res = applyIntent(room0(), done, 'a', intent({ type: 'finish', characterId: 'brena' }));
    expect(res.direct).toEqual({ kind: 'finish', characterId: 'brena' });
    expect(applyIntent(room0(), game(), 'a', intent({ type: 'finish', characterId: 'brena' })).ok).toBe(false);
    expect(applyIntent(room0(), done, 'b', intent({ type: 'finish', characterId: 'brena' })).ok).toBe(false);
  });

  it('sin grupos, el combate es el de la party como siempre', () => {
    const together = { characterIds: CHARS, names, inCombat: true, turnCharacterId: 'tobias', combatBusy: false };
    expect(applyIntent(room0(), together, 'b', intent({ type: 'combat', characterId: 'tobias', action: { type: 'dodge' } })).ok).toBe(true);
    expect(applyIntent(room0(), together, 'a', intent({ type: 'act', characterId: 'brena', kind: 'text', payload: { text: 'x' } })).ok).toBe(false);
  });
});

describe('lo que se comparte de cada grupo', () => {
  it('los combates y la actividad de cada grupo viajan aparte', () => {
    const fight = { status: 'active', round: 1, log: Array.from({ length: 80 }, (_, i) => ({ text: String(i) })), enemies: [], heroIds: ['brena'] };
    const sections = buildSections({
      encounter: null,
      encounters: { g1: fight, g2: null },
      lanes: { '': { generating: true }, g1: { combat: true }, g2: { generating: true } }
    });
    expect(Object.keys(sections.encounters)).toEqual(['g1']);
    expect(sections.encounters.g1.log).toHaveLength(50);
    expect(sections.meta.lanes).toEqual({ g1: { generating: false, combat: true }, g2: { generating: true, combat: false } });
    expect(sections.encounter).toBeNull();
  });
});

describe('guardado de los combates de cada grupo', () => {
  it('se migran con la campaña', () => {
    const hero = (id) => ({ id, name: id, race: 'Humano', class: 'Guerrero', hp: 10, maxHp: 10, ac: 12, gold: 0, inventory: [], stats: {} });
    const party = startApart(createParty([hero('brena'), hero('tobias')]), { brena: 'z1', tobias: 'z2' });
    const g1 = party.split.groups[0].id;
    const fight = { status: 'active', round: 1, turn: 0, log: [], heroIds: ['brena'], order: [], enemies: [{ uid: 'e1', name: 'Lobo', hp: 5, maxHp: 5, ac: 12, status: 'active' }] };
    const camp = migrateCampaign({ id: 'c', world: { name: 'W', mapNodes: [] }, party, messages: [], encounters: { [g1]: fight, x: null } });
    expect(Object.keys(camp.encounters)).toEqual([g1]);
    expect(camp.encounters[g1].enemies[0].conditions).toEqual([]);
    expect(migrateCampaign({ id: 'c', world: { name: 'W', mapNodes: [] }, party, messages: [] }).encounters).toBeUndefined();
  });
});
