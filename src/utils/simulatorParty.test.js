import { describe, it, expect } from 'vitest';
import { quickHero, simulatorParty, startSimulation, autoFight, autoAction, simulateMany, fightSummary, dieFrom, setPotions } from './simulator';
import { makeSnapshot, normalizeSnapshots, snapshotHeroes } from './combatSnapshots';
import { getMonster } from './bestiary';

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bandits = n => [{ monster: getMonster('bandit'), count: n }];
const party = () => [
  setPotions(quickHero({ classId: 'fighter', level: 3, rng: seeded(1) }), 'healing', 2),
  setPotions(quickHero({ classId: 'cleric', level: 3, rng: seeded(2) }), 'healing', 1),
  quickHero({ classId: 'rogue', level: 3, rng: seeded(3) }),
  quickHero({ classId: 'wizard', level: 3, rng: seeded(4) })
];

describe('the simulator with a party', () => {
  it('gives every copy a unique id, even of the same hero, and never touches the originals', () => {
    const hero = quickHero({ classId: 'fighter', level: 1, rng: seeded(9) });
    const copies = simulatorParty([hero, hero, hero, hero, hero]);
    expect(copies).toHaveLength(4);
    expect(new Set(copies.map(h => h.id)).size).toBe(4);
    copies[0].hp = 0;
    expect(hero.hp).toBe(hero.maxHp);
  });

  it('a practice fight has a turn for every hero', () => {
    const { encounter, heroes } = startSimulation(party(), bandits(3), dieFrom(seeded(5)));
    expect(heroes).toHaveLength(4);
    expect(encounter.order.filter(o => o.kind === 'player')).toHaveLength(4);
    expect(encounter.simulation).toBe(true);
  });

  it('the simple AI plays the whole party to the end', () => {
    const { encounter, heroes } = autoFight(party(), bandits(4), dieFrom(seeded(6)));
    expect(['victory', 'defeat', 'fled', 'timeout']).toContain(encounter.status);
    expect(heroes).toHaveLength(4);
    const summary = fightSummary(encounter, party(), heroes);
    expect(summary.heroes).toHaveLength(4);
    expect(summary.heroes[0]).toMatchObject({ name: heroes[0].name, maxHp: heroes[0].maxHp });
  });

  it('the AI gives a potion to an unconscious ally first', () => {
    const [a, b] = simulatorParty(party());
    const action = autoAction({ enemies: [], actionUsed: false, bonusUsed: false }, a, { allies: [a, { ...b, hp: 0 }] });
    expect(action).toMatchObject({ type: 'potion', targetUid: b.id });
  });

  it('four heroes win more often than one against the same band', () => {
    const groups = bandits(6);
    const solo = simulateMany(party()[0], groups, 30, { rng: seeded(11) });
    const four = simulateMany(party(), groups, 30, { rng: seeded(11) });
    expect(four.winRate).toBeGreaterThan(solo.winRate);
    expect(four.avgFallen).toBeGreaterThanOrEqual(0);
  });
});

describe('snapshots keep the whole party', () => {
  it('saves every hero of the fight and reads older snapshots of one hero', () => {
    const heroes = party().slice(0, 2);
    const snap = makeSnapshot({ party: heroes, groups: bandits(2) });
    expect(snap.party.map(h => h.name)).toEqual(heroes.map(h => h.name));
    expect(snap.character.name).toBe(heroes[0].name);
    expect(snap.heroName).toBe(heroes.map(h => h.name).join(', '));
    const [restored] = normalizeSnapshots([snap]);
    expect(snapshotHeroes(restored)).toHaveLength(2);
    const old = { ...makeSnapshot({ character: heroes[0], groups: bandits(1) }), party: undefined };
    expect(snapshotHeroes(normalizeSnapshots([old])[0])).toHaveLength(1);
  });
});
