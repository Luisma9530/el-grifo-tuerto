import { describe, it, expect } from 'vitest';
import { restParty, finishFight, storyXp, payPartyReward, longRestCost } from './partyActions';
import { createParty } from './party';
import { quickHero } from './simulator';
import { createCondition, hasCondition } from './conditions';
import { LONG_REST_COST } from './spellcasting';

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const hero = (classId, name) => ({ ...quickHero({ classId, level: 2, rng: seeded(classId.length) }), name });
const twoHeroes = (gold = 100) => createParty([hero('fighter', 'Brega'), hero('wizard', 'Tomás')], { gold });
const ids = party => party.members.map(m => m.id);

describe('resting as a party', () => {
  it('a long rest pays a room for each member and heals everybody', () => {
    let party = twoHeroes(30);
    party = { ...party, members: party.members.map(m => ({ ...m, hp: 1 })) };
    const res = restParty(party, 'long', () => 1);
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(LONG_REST_COST * 2);
    expect(longRestCost(party)).toBe(LONG_REST_COST * 2);
    expect(res.party.gold).toBe(30 - LONG_REST_COST * 2);
    expect(res.party.members.every(m => m.hp === m.maxHp)).toBe(true);
    expect(res.report.map(r => r.name)).toEqual(['Brega', 'Tomás']);
  });

  it('without enough gold for every room nobody rests', () => {
    const res = restParty(twoHeroes(LONG_REST_COST), 'long', () => 1);
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('2 habitaciones') });
  });

  it('a short rest lets each hurt member spend a hit die', () => {
    let party = twoHeroes();
    party = { ...party, members: party.members.map(m => ({ ...m, hp: 1 })) };
    const res = restParty(party, 'short', () => 4);
    expect(res.party.members.every(m => m.hp > 1)).toBe(true);
    expect(res.party.gold).toBe(100);
  });
});

describe('the end of a fight for the party', () => {
  const down = m => ({ ...m, hp: 0, conditions: [createCondition({ id: 'inconsciente', duration: { type: 'down' } }, { targetUid: m.id })] });

  it('victory: XP shared among who fought (unconscious included), coins to the purse, items to one backpack, the fallen get up', () => {
    let party = createParty([hero('fighter', 'Brega'), hero('wizard', 'Tomás'), hero('rogue', 'Lía')], { gold: 10 });
    const [a, b] = ids(party);
    party = { ...party, members: party.members.map(m => (m.id === b ? down(m) : m)) };
    const xpBefore = party.members.map(m => m.xp);
    const encounter = { status: 'victory', xp: 101, heroIds: [a, b], enemies: [] };
    const loot = { coins: 5.5, items: [{ id: 'loot1', name: 'Daga', type: 'weapon' }] };
    const res = finishFight(party, encounter, { loot, receiverId: a });
    expect(res.share).toBe(50);
    expect(res.party.members.map((m, i) => m.xp - xpBefore[i])).toEqual([50, 50, 0]);
    expect(res.party.gold).toBe(15.5);
    expect(res.party.members[0].inventory.some(i => i.id === 'loot1')).toBe(true);
    const tomas = res.party.members[1];
    expect(tomas.hp).toBe(1);
    expect(hasCondition(tomas, 'inconsciente')).toBe(false);
    expect(res.fallen).toEqual(['Tomás']);
  });

  it('combat-only conditions end for everyone', () => {
    let party = twoHeroes();
    party = { ...party, members: party.members.map(m => ({ ...m, conditions: [createCondition({ id: 'agarrado', duration: { escape: 12 } }, { sourceUid: 'orc-1' })] })) };
    const res = finishFight(party, { status: 'fled', xp: 0, heroIds: ids(party), enemies: [] });
    expect(res.party.members.every(m => !hasCondition(m, 'agarrado'))).toBe(true);
    expect(res.ended.map(e => e.name)).toEqual(['Brega', 'Tomás']);
  });

  it('defeat: Duncan picks everyone up at half HP and keeps half of the purse', () => {
    let party = twoHeroes(40);
    party = { ...party, members: party.members.map(down) };
    const res = finishFight(party, { status: 'defeat', xp: 0, heroIds: ids(party), enemies: [] });
    expect(res.rescue).toEqual({ goldLost: 20 });
    expect(res.party.gold).toBe(20);
    expect(res.party.members.every(m => m.hp === Math.ceil(m.maxHp / 2) && !hasCondition(m, 'inconsciente'))).toBe(true);
  });
});

describe('story experience and quest rewards', () => {
  it('scene XP: every member gets the amount Duncan gave', () => {
    const party = twoHeroes();
    const res = storyXp(party, 40);
    expect(res.party.members.map((m, i) => m.xp - party.members[i].xp)).toEqual([40, 40]);
  });

  it('a quest reward: gold to the purse, the item to who acted, XP to everyone', () => {
    const party = twoHeroes(0);
    const [, b] = ids(party);
    const res = payPartyReward(party, { gold: 25, itemKey: 'potion:healing', xp: 30 }, b);
    expect(res.party.gold).toBe(25);
    expect(res.party.members[1].inventory.some(i => i.potionId === 'healing')).toBe(true);
    expect(res.party.members[0].inventory.some(i => i.potionId === 'healing')).toBe(false);
    expect(res.party.members.map((m, i) => m.xp - party.members[i].xp)).toEqual([30, 30]);
  });
});
