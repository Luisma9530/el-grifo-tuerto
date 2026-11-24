import { describe, it, expect } from 'vitest';
import { quickHero, startSimulation, autoAction, simulateMany, dieFrom, setPotions, setHp, setSlotsUsed } from './simulator';
import { hitChance, saveChance, enemyThreat } from './simulatorAI';
import { playerAction, concentrationOf, heroUid } from './encounter';
import { getMonster } from './bestiary';
import { getSpell, slotTable } from './spellcasting';
import { hasCondition } from './conditions';

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const group = (id, count = 1) => ({ monster: getMonster(id), count });

/** A copy of the hero that knows (and has prepared) exactly these spells of its class. */
function withSpells(hero, ids) {
  const ability = hero.spellcasting.known.find(k => k.sourceKey === 'class')?.ability || 'int';
  const known = ids.map(id => ({ id, source: 'Clase', sourceKey: 'class', ability, prepared: true, freeCast: false }));
  return { ...hero, spellcasting: { ...hero.spellcasting, known, freeCastsUsed: [] } };
}

/** A hero's turn in a fight against these groups, with the enemies' HP set (null = full). */
function turnAgainst(party, groups, hps = []) {
  const { encounter } = startSimulation(party, groups, dieFrom(seeded(1)));
  return {
    ...encounter, status: 'active', actionUsed: false, bonusUsed: false,
    order: encounter.order, turn: encounter.order.findIndex(o => o.kind === 'player'),
    enemies: encounter.enemies.map((e, i) => ({ ...e, status: 'active', conditions: [], hp: hps[i] ?? e.maxHp }))
  };
}

const wizard = () => withSpells(quickHero({ classId: 'wizard', level: 5, rng: seeded(105) }), ['fireBolt', 'magicMissile', 'fireball', 'holdPerson']);

describe('the odds the AI reads', () => {
  it('hit and save chances follow the d20 as the engine rolls it', () => {
    expect(hitChance(5, 15)).toBeCloseTo(0.55);
    expect(hitChance(5, 15, 'advantage')).toBeCloseTo(1 - 0.45 ** 2);
    expect(hitChance(20, 10)).toBe(0.95);
    const captain = { ...getMonster('banditCaptain'), conditions: [] };
    expect(saveChance(captain, 'sab', 14)).toBeCloseTo(0.45);
    expect(saveChance({ ...captain, conditions: [{ id: 'paralizado' }] }, 'des', 14)).toBe(0);
    expect(enemyThreat({ ...captain, conditions: [] }, 12)).toBeGreaterThan(enemyThreat({ ...getMonster('bandit'), conditions: [] }, 12));
  });
});

describe('the AI of "Simular N veces"', () => {
  it('casts a spell with a slot when it pays and keeps to cantrips when it does not', () => {
    const hero = wizard();
    const big = autoAction(turnAgainst(hero, [group('ogre')]), hero);
    expect(big).toMatchObject({ type: 'spell', spellId: 'fireball' });
    // The same ogre almost dead: no slot is spent on it
    const low = autoAction(turnAgainst(hero, [group('ogre')], [6]), hero);
    expect(getSpell(low.spellId)?.level || 0).toBe(0);
  });

  it('a fighter uses a weapon; a caster without spells worth it too', () => {
    const fighter = quickHero({ classId: 'fighter', level: 5, rng: seeded(3) });
    expect(autoAction(turnAgainst(fighter, [group('ogre')]), fighter).type).toBe('attack');
    const cleric = withSpells(quickHero({ classId: 'cleric', level: 5, rng: seeded(4) }), ['cureWounds']);
    expect(autoAction(turnAgainst(cleric, [group('bandit')]), cleric).type).toBe('attack');
  });

  it('keeps the high slots: no Fireball on a lone bandit, and the slots are not all spent in a short fight', () => {
    const hero = wizard();
    const action = autoAction(turnAgainst(hero, [group('bandit')]), hero);
    expect(action.spellId).not.toBe('fireball');
    const r = simulateMany(hero, [group('bandit', 2)], 40, { rng: seeded(8) });
    const slots = slotTable(hero.spellcasting).reduce((s, row) => s + row.max, 0);
    expect(r.ai.avgSlots).toBeLessThan(slots / 2);
  });

  it('heals a fallen ally (no potion) and whoever is below the threshold', () => {
    const cleric = setPotions(withSpells(quickHero({ classId: 'cleric', level: 3, rng: seeded(6) }), ['sacredFlame', 'cureWounds', 'guidingBolt']), 'healing', 0);
    const fighter = { ...quickHero({ classId: 'fighter', level: 3, rng: seeded(7) }), id: 'f1', hp: 0 };
    const party = [{ ...cleric, id: 'c1' }, fighter];
    const enc = turnAgainst(party, [group('bandit', 2)]);
    const turn = { ...enc, turn: enc.order.findIndex(o => o.kind === 'player' && o.uid === 'c1') };
    const action = autoAction(turn, party[0], { allies: party });
    expect(action).toMatchObject({ type: 'spell', spellId: 'cureWounds', targetUid: 'f1', ai: 'revive' });
    const res = playerAction(turn, party, action, dieFrom(seeded(9)));
    expect(res.ok).toBe(true);
    expect(res.heroes.find(h => h.id === 'f1').hp).toBeGreaterThan(0);
    // Hurt but standing (below the threshold): healed too
    const hurt = [party[0], { ...fighter, hp: 3 }];
    expect(autoAction(turn, hurt[0], { allies: hurt, healBelow: 0.35 })).toMatchObject({ spellId: 'cureWounds', targetUid: 'f1', ai: 'heal' });
    // Healthy: it fights
    const fine = [party[0], { ...fighter, hp: fighter.maxHp }];
    expect(autoAction(turn, fine[0], { allies: fine }).spellId).not.toBe('cureWounds');
  });

  it('holds a dangerous enemy and keeps the concentration while it works', () => {
    const hero = withSpells(quickHero({ classId: 'wizard', level: 5, rng: seeded(105) }), ['fireBolt', 'holdPerson', 'web']);
    const enc = turnAgainst(hero, [group('banditCaptain', 2)]);
    const first = autoAction(enc, hero);
    expect(first.ai).toBe('control');
    // Every die a 1: the captain fails the save
    const res = playerAction(enc, hero, first, () => 1);
    expect(res.ok).toBe(true);
    expect(concentrationOf(res.encounter, heroUid(hero))).toBeTruthy();
    const held = res.encounter.enemies.find(e => e.uid === first.targetUid);
    expect(hasCondition(held, 'paralizado') || hasCondition(held, 'apresado')).toBe(true);
    // Its next turn: no other concentration spell (it would end the first one)
    const next = { ...res.encounter, status: 'active', actionUsed: false, bonusUsed: false, turn: enc.turn };
    const second = autoAction(next, res.character);
    expect(getSpell(second.spellId)?.concentration).toBeFalsy();
    // Once nobody is held, it may control again
    const freed = { ...next, enemies: next.enemies.map(e => ({ ...e, conditions: [] })) };
    expect(autoAction(freed, res.character).ai).toBe('control');
  });

  it('a wizard wins more than with the old AI (weapons and cantrips only), with a seeded fight', () => {
    const hero = setPotions(wizard(), 'healing', 1);
    const groups = [group('ogre')];
    const before = simulateMany(hero, groups, 200, { rng: seeded(7), useSlots: false });
    const after = simulateMany(hero, groups, 200, { rng: seeded(7) });
    expect(after.winRate).toBeGreaterThan(before.winRate + 0.15);
    expect(before.ai.avgSlots).toBe(0);
    expect(after.ai.avgSlots).toBeGreaterThan(0);
    expect(after.ai.topSpells.map(s => s.name)).toContain('Bola de Fuego');
  });

  it('with no slots left it plays its cantrips', () => {
    let hero = wizard();
    slotTable(hero.spellcasting).forEach(row => { hero = setSlotsUsed(hero, row.level, row.max); });
    const action = autoAction(turnAgainst(setHp(hero, hero.maxHp), [group('ogre')]), hero);
    expect(action).toMatchObject({ type: 'spell', spellId: 'fireBolt' });
  });
});
