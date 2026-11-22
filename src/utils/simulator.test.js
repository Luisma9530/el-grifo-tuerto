import { describe, it, expect, beforeEach } from 'vitest';
import {
  simulatorHero, quickHero, levelHeroTo, setHp, potionCount, setPotions, addCatalogItem, setSlotsUsed, setPrepared,
  setStartCondition, startSimulation, fightSummary, autoAction, autoFight, simulateMany, dieFrom, bestAttack
} from './simulator';
import { playerAction, isPlayerTurn } from './encounter';
import { makeSnapshot, groupsFromData } from './combatSnapshots';
import { getMonster, eliteVersion } from './bestiary';
import { saveCampaign, getAllCampaigns } from './campaignStorage';
import { slotTable, getSpell } from './spellcasting';
import { hasCondition, exhaustionLevel } from './conditions';
import { attackOptions } from './combat';
import { CLASSES } from '../data/srd';

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const deepFreeze = obj => {
  Object.values(obj).forEach(v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v); });
  return Object.freeze(obj);
};

const bandits = n => [{ monster: getMonster('bandit'), count: n }];

beforeEach(() => localStorage.clear());

describe('heroes for the simulator', () => {
  it('quick heroes of every class, up to level 20', () => {
    const rng = seeded(7);
    CLASSES.forEach(cls => {
      const h = quickHero({ classId: cls.id, level: 1, rng });
      expect(h.classId).toBe(cls.id);
      expect(h.level).toBe(1);
    });
    const high = quickHero({ classId: 'wizard', level: 20, rng });
    expect(high.level).toBe(20);
    expect(high.hp).toBe(high.maxHp);
    expect(slotTable(high.spellcasting).some(r => r.level === 9)).toBe(true);
  });

  it('copies of saved heroes level up only upwards', () => {
    const h = quickHero({ classId: 'fighter', level: 3, rng: seeded(1) });
    expect(levelHeroTo(h, 6).level).toBe(6);
    expect(levelHeroTo(h, 2).level).toBe(3);
    const legacy = { name: 'Viejo', level: 3, stats: {} };
    expect(levelHeroTo(legacy, 5)).toBe(legacy);
  });

  it('adjust HP, potions, gear, slots, prepared spells and conditions without touching the original', () => {
    const original = deepFreeze(quickHero({ classId: 'wizard', level: 5, rng: seeded(3) }));
    let h = simulatorHero(original);
    expect(setHp(h, 999).hp).toBe(h.maxHp);
    expect(setHp(h, 0).hp).toBe(1);
    h = setPotions(h, 'healing', 3);
    h = setPotions(h, 'greaterHealing', 1);
    expect(potionCount(h, 'healing')).toBe(3);
    expect(potionCount(h, 'greaterHealing')).toBe(1);
    expect(potionCount(setPotions(h, 'healing', 0), 'healing')).toBe(0);
    h = addCatalogItem(h, 'weapon:longsword');
    expect(h.inventory.some(i => i.weaponId === 'longsword')).toBe(true);
    h = setSlotsUsed(h, 1, 3);
    expect(slotTable(h.spellcasting).find(r => r.level === 1).used).toBe(3);
    const levelled = h.spellcasting.known.find(k => getSpell(k.id)?.level > 0 && !k.freeCast);
    expect(setPrepared(h, levelled.id, false).spellcasting.known.find(k => k.id === levelled.id).prepared).toBe(false);
    h = setStartCondition(h, 'envenenado', true);
    h = setStartCondition(h, 'agotamiento', true, 3);
    expect(hasCondition(h, 'envenenado')).toBe(true);
    expect(exhaustionLevel(h)).toBe(3);
    expect(hasCondition(setStartCondition(h, 'envenenado', false), 'envenenado')).toBe(false);
    expect(original.hp).toBe(original.maxHp);
    expect(potionCount(original, 'healing')).toBe(0);
    expect(original.conditions).toEqual([]);
  });
});

describe('practice fights', () => {
  it('never change the hero or the saved campaign', () => {
    const hero = quickHero({ classId: 'fighter', level: 2, rng: seeded(5) });
    const snapshot = makeSnapshot({ character: hero, groups: bandits(2), id: 's1' });
    saveCampaign({ id: 'c1', title: 'Valle', world: { name: 'Valle' }, character: hero, messages: [], combatSnapshots: [snapshot] });
    const before = localStorage.getItem('tavern_saved_campaigns');
    const frozen = deepFreeze(getAllCampaigns()[0]);
    const groups = groupsFromData(frozen.combatSnapshots[0].groups, { getMonster, eliteVersion });
    const rng = seeded(9);
    for (let i = 0; i < 20; i++) autoFight(frozen.combatSnapshots[0].character, groups, dieFrom(rng));
    simulateMany(frozen.character, groups, 30, { rng });
    expect(localStorage.getItem('tavern_saved_campaigns')).toBe(before);
  });

  it('start like a campaign fight and are marked as a simulation', () => {
    const hero = quickHero({ classId: 'rogue', level: 3, rng: seeded(2) });
    const { encounter, character } = startSimulation(hero, bandits(2), dieFrom(seeded(4)));
    expect(encounter.simulation).toBe(true);
    expect(encounter.enemies).toHaveLength(2);
    expect(character).not.toBe(hero);
  });

  it('"Repetir igual": same hero and enemies, new dice', () => {
    const hero = deepFreeze(quickHero({ classId: 'fighter', level: 3, rng: seeded(11) }));
    const rng = seeded(12);
    const a = startSimulation(hero, bandits(3), dieFrom(rng));
    const b = startSimulation(hero, bandits(3), dieFrom(rng));
    expect(b.encounter.enemies.map(e => [e.monsterId, e.maxHp])).toEqual(a.encounter.enemies.map(e => [e.monsterId, e.maxHp]));
    expect(b.encounter.enemies.map(e => e.initiative)).not.toEqual(a.encounter.enemies.map(e => e.initiative));
  });

  it('"Cambiar y repetir": the same fight with more level and potions goes better', () => {
    const hero = setPotions(quickHero({ classId: 'fighter', level: 1, rng: seeded(21) }), 'healing', 0);
    const groups = bandits(3);
    const weak = simulateMany(hero, groups, 200, { rng: seeded(1) });
    const strong = simulateMany(setPotions(levelHeroTo(hero, 4), 'healing', 4), groups, 200, { rng: seeded(1) });
    expect(strong.winRate).toBeGreaterThan(weak.winRate);
  });

  it('a summary of what happened', () => {
    const hero = setPotions(quickHero({ classId: 'wizard', level: 3, rng: seeded(31) }), 'healing', 2);
    const rollDie = dieFrom(seeded(32));
    let { encounter, character } = startSimulation(hero, bandits(2), rollDie);
    let guard = 0;
    while (encounter.status === 'active' && isPlayerTurn(encounter) && guard++ < 100) {
      let r = playerAction(encounter, character, autoAction(encounter, character, { healBelow: 0.6 }), rollDie);
      if (!r.ok) r = playerAction(encounter, character, { type: 'endTurn' }, rollDie);
      if (!r.ok) break;
      ({ encounter, character } = r);
    }
    const s = fightSummary(encounter, hero, character);
    expect(s.status).toBe(encounter.status);
    expect(s.rounds).toBe(encounter.round);
    expect(s.taken).toBe(encounter.log.reduce((sum, e) => sum + (e.playerDamage || 0), 0));
    expect(s.dealt).toBe(encounter.enemies.reduce((sum, e) => sum + e.maxHp - Math.max(0, e.hp), 0));
    expect(s.potions).toBe(potionCount(hero, 'healing') - potionCount(character, 'healing'));
    expect(s.enemies).toHaveLength(2);
  });

  it('the summary lists spells cast and conditions suffered', () => {
    const encounter = {
      status: 'defeat', round: 3, enemies: [{ name: 'Bandido', status: 'active', hp: 5, maxHp: 11 }],
      log: [
        { kind: 'hit', text: 'Lyra lanza Proyectil Mágico sobre Bandido: impacto seguro, 7 de daño fuerza.' },
        { kind: 'enemyHit', text: 'Bandido ataca…', playerDamage: 6 },
        { kind: 'condition', change: 'add', target: 'player', condition: 'envenenado', text: '…' }
      ]
    };
    const s = fightSummary(encounter, { name: 'Lyra', hp: 10, inventory: [] }, { name: 'Lyra', hp: 0, inventory: [] });
    expect(s.spells).toEqual(['Proyectil Mágico']);
    expect(s.conditions).toEqual(['Envenenado']);
    expect(s).toMatchObject({ dealt: 6, taken: 6, hpLeft: 0 });
  });
});

describe('"Simular N veces"', () => {
  it('reports the win rate and always ends', () => {
    const hero = quickHero({ classId: 'barbarian', level: 5, rng: seeded(41) });
    const r = simulateMany(hero, bandits(2), 50, { rng: seeded(42) });
    expect(r.runs).toBe(50);
    expect(r.victory + r.defeat + r.fled + r.timeout).toBe(50);
    expect(r.winRate).toBeGreaterThan(0.8);
    const hopeless = simulateMany(quickHero({ classId: 'wizard', level: 1, rng: seeded(43) }), [{ monster: eliteVersion(getMonster('bandit')), count: 6 }], 30, { rng: seeded(44) });
    expect(hopeless.winRate).toBeLessThan(0.2);
  });

  it('the simple AI heals below the threshold and attacks the weakest enemy otherwise', () => {
    const hero = setPotions(quickHero({ classId: 'fighter', level: 2, rng: seeded(51) }), 'healing', 1);
    const { encounter } = startSimulation(hero, bandits(2), dieFrom(seeded(52)));
    const enc = { ...encounter, actionUsed: false, bonusUsed: false, enemies: encounter.enemies.map((e, i) => ({ ...e, status: 'active', hp: i === 1 ? 1 : e.maxHp })) };
    expect(autoAction(enc, setHp(hero, 1), { healBelow: 0.5 }).type).toBe('potion');
    const attack = autoAction(enc, hero, { healBelow: 0.5 });
    expect(attack.targetUid).toBe(enc.enemies[1].uid);
    expect(attack.type).toBe('attack');
    expect(attackOptions(hero).some(o => o.id === bestAttack(hero, enc.enemies[0]).optionId)).toBe(true);
    expect(autoAction({ ...enc, actionUsed: true, bonusUsed: true }, hero).type).toBe('endTurn');
  });
});
