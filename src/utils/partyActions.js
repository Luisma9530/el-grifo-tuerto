// What happens to the whole party in play: rests, the end of a fight, quest
// rewards, experience from the story, Duncan's rescue. Pure functions on the
// party (see party.js), so the same steps can later be synchronised between
// players. Dice come from a `rollDie(sides)` callback.

import { longRest, shortRest, LONG_REST_COST } from './spellcasting';
import { restConditions, endCombatConditions, conditionName } from './conditions';
import { addItem, roundCoins, makeItem } from './items';
import { wakeAfterFight } from './encounter';
import { rescueKnockedOut } from './sceneOutcome';
import { members, memberById, memberSheets, mergeHeroes, splitXp, updateMember } from './party';

export { LONG_REST_COST };

/** A room for each member: the price of a long rest for the party. */
export const longRestCost = party => LONG_REST_COST * Math.max(1, members(party).length);

/**
 * Everybody rests. Long: a room each (paid from the purse), all HP, hit dice and
 * magic back. Short: each member spends a hit die if hurt.
 * @returns {{ ok: false, error } | { ok: true, party, report: { name, healed, die, hitDie, slotsRecovered, ended: string[], exhaustion }[], cost }}
 */
export function restParty(party, kind, rollDie) {
  const cost = kind === 'long' ? longRestCost(party) : 0;
  if (cost > (Number(party.gold) || 0)) {
    return { ok: false, error: `Necesitáis ${cost} monedas de oro para ${members(party).length > 1 ? `${members(party).length} habitaciones` : 'una habitación'}.` };
  }
  const report = [];
  let next = party;
  members(party).forEach(member => {
    const { removed, exhaustion } = restConditions(member, kind);
    const ended = [...new Set(removed.map(c => conditionName(c.id).toLowerCase()))];
    if (kind === 'long') {
      next = updateMember(next, member.id, sheet => ({ ...longRest(sheet), gold: sheet.gold }));
      report.push({ name: member.name, healed: member.maxHp - member.hp, die: null, ended, exhaustion, removed });
    } else {
      const rest = shortRest(member, rollDie);
      next = updateMember(next, member.id, sheet => ({ ...rest.character, gold: sheet.gold }));
      report.push({ name: member.name, healed: rest.healed, die: rest.die, hitDie: member.hitDie, slotsRecovered: rest.slotsRecovered, ended, exhaustion, removed });
    }
  });
  return { ok: true, party: { ...next, gold: roundCoins(next.gold - cost) }, report, cost };
}

/**
 * Close a finished fight for the party.
 * - Effects that lasted turns or depended on the enemies end, for everyone.
 * - Victory or flight: unconscious members get up with 1 HP.
 * - Victory: the coins go to the purse, the items to `receiverId`'s backpack.
 * - The XP of the fight is shared between the heroes who were in it
 *   (`encounter.heroIds`), unconscious ones included.
 * - Defeat: Duncan picks everyone up (half HP) and keeps half of the purse.
 * @returns {{ party, ended: { name, conditions: string[] }[], fallen: string[], share, ready: string[], rescue: { goldLost } | null }}
 */
export function finishFight(party, encounter, { loot = null, receiverId = null } = {}) {
  const won = encounter.status === 'victory';
  const fallen = members(party).filter(m => (Number(m.hp) || 0) <= 0 && (encounter.heroIds || []).includes(m.id)).map(m => m.name);
  const ended = [];
  let heroes = memberSheets(party).map(sheet => {
    const { creature, removed } = endCombatConditions(sheet);
    const names = [...new Set(removed.map(c => conditionName(c.id).toLowerCase()))].filter(n => n !== 'inconsciente');
    if (names.length) ended.push({ name: sheet.name, conditions: names });
    return creature;
  });
  if (encounter.status !== 'defeat') heroes = wakeAfterFight(heroes);
  let next = mergeHeroes(party, heroes);

  if (won && loot) {
    const target = memberById(next, receiverId) ? receiverId : members(next)[0].id;
    next = { ...next, gold: roundCoins((Number(next.gold) || 0) + (loot.coins || 0)) };
    next = updateMember(next, target, sheet => ({ ...sheet, inventory: (loot.items || []).reduce((list, item) => addItem(list, item), sheet.inventory || []) }));
  }

  const participants = (encounter.heroIds || members(next).map(m => m.id)).filter(id => memberById(next, id));
  const { party: withXp, share, ready } = splitXp(next, encounter.xp || 0, participants);
  next = withXp;

  let rescue = null;
  if (encounter.status === 'defeat') {
    const fee = rescueKnockedOut({ maxHp: 1, gold: next.gold });
    next = {
      ...next,
      gold: fee.gold,
      members: next.members.map(m => {
        const healed = { ...m, hp: rescueKnockedOut(m).hp };
        return endCombatConditions(healed).creature;
      })
    };
    rescue = { goldLost: fee.goldLost };
  }
  return { party: next, ended, fallen, share, ready, rescue };
}

/**
 * Experience from the story (a scene or a quest): Duncan sets it per character,
 * so every member gets that amount (the party isn't slower than a lone hero).
 * @returns {{ party, ready: string[] }}
 */
export function storyXp(party, amount) {
  const xp = Math.max(0, Math.round(Number(amount) || 0));
  if (!xp) return { party, ready: [] };
  const { party: next, ready } = splitXp(party, xp * members(party).length);
  return { party: next, ready };
}

/**
 * Pay a completed quest's reward to the party: gold to the purse, the item to
 * `receiverId` (who acted), the XP to everyone (see storyXp).
 * @returns {{ party, ready: string[] }}
 */
export function payPartyReward(party, reward, receiverId) {
  let next = party;
  if (reward?.gold > 0) next = { ...next, gold: roundCoins((Number(next.gold) || 0) + reward.gold) };
  const item = reward?.itemKey ? makeItem(reward.itemKey) : null;
  const target = memberById(next, receiverId) ? receiverId : members(next)[0]?.id;
  if (item && target) next = updateMember(next, target, sheet => ({ ...sheet, inventory: addItem(sheet.inventory, item) }));
  return storyXp(next, reward?.xp || 0);
}
