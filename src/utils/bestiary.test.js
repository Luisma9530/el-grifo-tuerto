import { describe, it, expect } from 'vitest';
import {
  MONSTERS, getMonster, XP_BUDGET, encounterXp, difficultyOf, searchMonsters, suggestEncounter, WORLD_TAGS, formatCr
} from './bestiary';
import { createEncounter, runEnemyTurns, playerAction, isPlayerTurn } from './encounter';
import { buildCharacter, randomDraft } from './characterBuilder';
import { attackOptions } from './combat';
import { parseDice } from './spellcasting';

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('bestiary data', () => {
  it('has valid creatures for the combat engine', () => {
    expect(MONSTERS.length).toBeGreaterThan(100);
    expect(new Set(MONSTERS.map(m => m.id)).size).toBe(MONSTERS.length);
    MONSTERS.forEach(m => {
      const where = m.id;
      expect({ where, ok: m.ac > 0 && m.hp > 0 && m.xp >= 0 && m.cr >= 0 }).toEqual({ where, ok: true });
      expect({ where, actions: m.actions.length > 0 }).toEqual({ where, actions: true });
      m.actions.forEach(a => {
        expect({ where, kind: ['melee', 'ranged', 'save'].includes(a.kind) }).toEqual({ where, kind: true });
        if (a.kind === 'save') expect({ where, ok: Boolean(a.save && a.dc) }).toEqual({ where, ok: true });
        else expect({ where, ok: Number.isFinite(a.bonus) && Boolean(parseDice(a.damage)) }).toEqual({ where, ok: true });
        if (a.damage) expect({ where, dice: Boolean(parseDice(a.damage)) }).toEqual({ where, dice: true });
      });
      (m.multiattack || []).forEach(id => expect({ where, id, exists: m.actions.some(a => a.id === id) }).toEqual({ where, id, exists: true }));
    });
  });

  it('covers every tier of play', () => {
    expect(MONSTERS.filter(m => m.cr <= 1).length).toBeGreaterThan(20);
    expect(MONSTERS.filter(m => m.cr >= 17).length).toBeGreaterThan(5);
    expect(getMonster('nope')).toBeNull();
    expect(formatCr(0.25)).toBe('1/4');
    expect(formatCr(17)).toBe('17');
  });
});

describe('encounter building', () => {
  it('rates difficulty against the XP budget', () => {
    expect(XP_BUDGET[1]).toEqual([50, 75, 100]);
    expect(difficultyOf(1, 0).id).toBe('none');
    expect(difficultyOf(1, 20).id).toBe('trivial');
    expect(difficultyOf(1, 50).id).toBe('low');
    expect(difficultyOf(1, 75).id).toBe('moderate');
    expect(difficultyOf(1, 100).id).toBe('high');
    expect(difficultyOf(1, 140).id).toBe('deadly');
    expect(difficultyOf(1, 1000).id).toBe('suicidal');
    expect(encounterXp([{ monster: { xp: 50 }, count: 3 }, { monster: { xp: 200 } }])).toBe(350);
  });

  it('searches the bestiary', () => {
    const weak = searchMonsters({ maxCr: 1 });
    expect(weak.every(m => m.cr <= 1)).toBe(true);
    expect(weak[0].cr).toBeLessThanOrEqual(weak.at(-1).cr);
    const sea = searchMonsters({ tags: WORLD_TAGS['sunken-abyss'] });
    expect(sea.length).toBeGreaterThan(0);
    expect(sea.every(m => m.tags.some(t => WORLD_TAGS['sunken-abyss'].includes(t)))).toBe(true);
  });

  it('suggests encounters that fit the budget at every level', () => {
    const rng = seeded(9);
    for (let level = 1; level <= 20; level++) {
      ['low', 'moderate', 'high'].forEach((difficulty, index) => {
        const groups = suggestEncounter(level, { difficulty, rng });
        expect(groups.length).toBeGreaterThan(0);
        expect(encounterXp(groups)).toBeLessThanOrEqual(XP_BUDGET[level][index]);
        groups.forEach(g => expect(g.count).toBeLessThanOrEqual(6));
      });
    }
  });

  it('prefers creatures of the world', () => {
    const rng = seeded(3);
    const tags = WORLD_TAGS.oakhaven;
    for (let i = 0; i < 20; i++) {
      suggestEncounter(2, { tags, rng }).forEach(g => expect(g.monster.tags.some(t => tags.includes(t))).toBe(true));
    }
  });
});

describe('every creature can fight', () => {
  it('runs a few rounds against each creature of the bestiary without errors', () => {
    const rng = seeded(42);
    const die = sides => Math.floor(rng() * sides) + 1;
    let hero = buildCharacter(randomDraft(rng));
    hero = { ...hero, hp: 10000, maxHp: 10000 }; // survive long enough to see every enemy act
    MONSTERS.forEach(monster => {
      let enc = createEncounter([{ monster, count: 1 }], hero, die);
      let state = runEnemyTurns(enc, hero, die);
      enc = state.encounter;
      let current = state.character;
      for (let round = 0; round < 3 && enc.status === 'active'; round++) {
        expect(isPlayerTurn(enc)).toBe(true);
        const option = attackOptions(current)[0];
        const res = playerAction(enc, current, { type: 'attack', optionId: option.id, targetUid: enc.enemies[0].uid }, die);
        expect({ id: monster.id, ok: res.ok }).toEqual({ id: monster.id, ok: true });
        enc = res.encounter;
        current = res.character;
      }
      expect(enc.log.every(l => typeof l.text === 'string' && !l.text.includes('undefined') && !l.text.includes('NaN'))).toBe(true);
    });
  });
});
