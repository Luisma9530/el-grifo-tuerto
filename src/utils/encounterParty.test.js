import { describe, it, expect } from 'vitest';
import {
  createEncounter, runEnemyTurns, playerAction, isPlayerTurn, currentHeroUid, describeEncounterResult, wakeAfterFight,
  consciousHeroes
} from './encounter';
import { buildCharacter, emptyDraft, sanitizeDraft } from './characterBuilder';
import { attackOptions } from './combat';
import { hasCondition } from './conditions';

const dice = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

const goblin = {
  id: 'goblin', name: 'Goblin', type: 'humanoide', cr: 0.25, xp: 50, ac: 13, hp: 7, initiative: 2,
  stats: { fue: 8, des: 14, con: 10, int: 10, sab: 8, car: 8 },
  actions: [{ id: 'scimitar', name: 'Cimitarra', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'perforante' }]
};
const ogre = {
  id: 'ogre', name: 'Ogro', type: 'gigante', cr: 2, xp: 450, ac: 11, hp: 59, initiative: -1, fearless: true,
  stats: { fue: 19, des: 8, con: 16, int: 5, sab: 7, car: 7 },
  actions: [{ id: 'club', name: 'Garrote', kind: 'melee', bonus: 6, damage: '2d8+4', type: 'contundente' }]
};

const fighter = (name, id) => buildCharacter(sanitizeDraft({
  ...emptyDraft(), classId: 'fighter', backgroundId: 'soldier', speciesId: 'orc',
  baseScores: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['acrobatics', 'survival'], name, languages: ['Enano', 'Élfico']
}), { id });

const cleric = (name, id) => buildCharacter(sanitizeDraft({
  ...emptyDraft(), classId: 'cleric', backgroundId: 'soldier', speciesId: 'orc',
  baseScores: { fue: 14, des: 8, con: 13, int: 10, sab: 15, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['medicine', 'religion'],
  spells: { class: { cantrips: ['sacredFlame', 'guidance', 'light'], spells: ['cureWounds', 'guidingBolt', 'bless', 'healingWord'] } },
  name, languages: ['Orco', 'Enano']
}), { id });

const potion = id => ({ id, name: 'Poción de curación', type: 'consumable', potionId: 'healing', uses: 1, effect: 'Recupera 2d4+2 PG' });

describe('a party in combat', () => {
  it('every hero gets a turn in the initiative, in order', () => {
    const party = [fighter('Brega', 'a'), fighter('Tora', 'b')];
    // goblin 5+2, Brega 15+2, Tora 10+2
    const enc = createEncounter([{ monster: goblin }], party, dice(5, 15, 10));
    expect(enc.order.map(o => o.uid)).toEqual(['a', 'b', 'goblin-1']);
    expect(enc.heroIds).toEqual(['a', 'b']);
    expect(currentHeroUid(enc)).toBe('a');
    expect(enc.log[0].text).toContain('Brega 17');
    expect(enc.log[0].text).toContain('Tora 12');

    // Brega dodges: the turn passes to Tora (no potion to drink)
    const res = playerAction(enc, party, { type: 'dodge' }, dice(3));
    expect(res.ok).toBe(true);
    expect(currentHeroUid(res.encounter)).toBe('b');
    expect(res.character.id).toBe('a');
    expect(res.heroes).toHaveLength(2);
    expect(res.encounter.dodging).toEqual(['a']);
  });

  it('an enemy goes for the hero who hit it last', () => {
    const party = [fighter('Brega', 'a'), fighter('Tora', 'b')];
    let enc = createEncounter([{ monster: ogre }], party, dice(1, 20, 19));
    // Brega dodges, Tora hits the ogre
    let res = playerAction(enc, party, { type: 'dodge' }, dice(3));
    const sword = attackOptions(res.heroes[1]).find(o => o.weapon);
    res = playerAction(res.encounter, res.heroes, { type: 'attack', optionId: sword.id, targetUid: 'ogre-1' }, dice(15, 3, 1, 1, 1));
    expect(res.encounter.enemies[0].targetUid).toBe('b');
    const swing = res.encounter.log.find(e => e.kind === 'enemyMiss' || e.kind === 'enemyHit');
    expect(swing.target).toBe('b');
    expect(swing.text).toContain('a Tora');
  });

  it('a hero at 0 HP falls unconscious, loses their turns, and the others go on', () => {
    const party = [{ ...fighter('Brega', 'a'), hp: 3 }, fighter('Tora', 'b')];
    // Ogre first (20-1), then Brega (2+2), Tora (1+2). The ogre picks Brega (d2 = 1) and hits.
    const enc = createEncounter([{ monster: ogre }], party, dice(20, 2, 1));
    const res = runEnemyTurns(enc, party, dice(1, 15, 5, 5));
    const brega = res.heroes.find(h => h.id === 'a');
    expect(brega.hp).toBe(0);
    expect(hasCondition(brega, 'inconsciente')).toBe(true);
    expect(res.encounter.status).toBe('active');
    expect(res.encounter.log.some(e => e.kind === 'herodown')).toBe(true);
    // Brega's turn is skipped: it is Tora's turn
    expect(currentHeroUid(res.encounter)).toBe('b');
    expect(consciousHeroes(res.heroes).map(h => h.id)).toEqual(['b']);
  });

  it('the fight is lost only when the whole party is down', () => {
    const party = [{ ...fighter('Brega', 'a'), hp: 1 }, { ...fighter('Tora', 'b'), hp: 1 }];
    const enc = createEncounter([{ monster: ogre }], party, dice(20, 2, 1));
    // The ogre fells one hero per round
    const res = runEnemyTurns(enc, party, dice(1, 15, 5, 5));
    expect(res.encounter.status).toBe('active');
    const tora = playerAction(res.encounter, res.heroes, { type: 'endTurn' }, dice(20, 5, 5));
    expect(tora.encounter.status).toBe('defeat');
    expect(tora.encounter.log.at(-1).text).toContain('Todo el grupo ha caído');
    expect(describeEncounterResult(tora.encounter, tora.heroes)).toContain('El grupo cae derrotado');
  });

  it('a potion given to an unconscious ally wakes them up (Bonus Action)', () => {
    const party = [{ ...fighter('Brega', 'a'), inventory: [potion('p')] }, { ...fighter('Tora', 'b'), hp: 0 }];
    let enc = createEncounter([{ monster: goblin }], party, dice(1, 20, 2));
    // Tora is already down: mark her so through a turn of the engine
    const res = playerAction(enc, party, { type: 'potion', itemId: 'p', targetUid: 'b' }, dice(4, 4));
    expect(res.ok).toBe(true);
    const tora = res.heroes.find(h => h.id === 'b');
    expect(tora.hp).toBe(10);
    expect(hasCondition(tora, 'inconsciente')).toBe(false);
    expect(res.heroes.find(h => h.id === 'a').inventory).toEqual([]);
    expect(res.encounter.bonusUsed).toBe(true);
    expect(res.encounter.log.at(-1).text).toContain('da Poción de curación a Tora');
  });

  it('a healing spell can target an ally', () => {
    const party = [cleric('Sor Ilda', 'c'), { ...fighter('Brega', 'a'), hp: 2 }];
    const enc = createEncounter([{ monster: goblin }], party, dice(1, 20, 2));
    const res = playerAction(enc, party, { type: 'spell', spellId: 'cureWounds', targetUid: 'a' }, dice(6, 6));
    expect(res.ok).toBe(true);
    const brega = res.heroes.find(h => h.id === 'a');
    const ilda = res.heroes.find(h => h.id === 'c');
    expect(brega.hp).toBeGreaterThan(2);
    expect(ilda.hp).toBe(party[0].hp);
    expect(ilda.spellcasting.slots.levels[1].used).toBe(1);
  });

  it('one successful flight gets the whole party out', () => {
    const party = [fighter('Brega', 'a'), fighter('Tora', 'b')];
    const enc = createEncounter([{ monster: ogre }], party, dice(1, 20, 19));
    const res = playerAction(enc, party, { type: 'flee' }, dice(18));
    expect(res.encounter.status).toBe('fled');
    expect(res.encounter.log.at(-1).text).toContain('el grupo logra escapar');
  });

  it('after a won fight, unconscious heroes get up with 1 HP', () => {
    const down = { ...fighter('Brega', 'a'), hp: 0, conditions: [{ key: 'k', id: 'inconsciente', duration: { type: 'down' } }] };
    const [brega, tora] = wakeAfterFight([down, fighter('Tora', 'b')]);
    expect(brega.hp).toBe(1);
    expect(hasCondition(brega, 'inconsciente')).toBe(false);
    expect(tora.hp).toBe(tora.maxHp);
  });

  it('the result line names the fallen and says the XP is shared', () => {
    const party = [{ ...fighter('Brega', 'a'), hp: 0 }, fighter('Tora', 'b')];
    const line = describeEncounterResult({ status: 'victory', round: 3, xp: 100, enemies: [{ name: 'Ogro', status: 'dead' }] }, party);
    expect(line).toContain('El grupo gana');
    expect(line).toContain('Cayeron inconscientes: Brega');
    expect(line).toContain('para repartir');
  });

  it('one hero still works as before', () => {
    const hero = fighter('Solo', 'solo');
    const enc = createEncounter([{ monster: goblin }], hero, dice(1, 20));
    expect(isPlayerTurn(enc)).toBe(true);
    const res = playerAction(enc, hero, { type: 'dodge' }, dice(3));
    expect(res.character.id).toBe('solo');
    expect(res.heroes).toHaveLength(1);
  });
});
