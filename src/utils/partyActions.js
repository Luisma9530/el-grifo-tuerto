// What happens to the whole party in play: rests, the end of a fight, quest
// rewards, experience from the story, Duncan's rescue. Pure functions on the
// party (see party.js), so the same steps can later be synchronised between
// players. Dice come from a `rollDie(sides)` callback.

import { longRest, shortRest, LONG_REST_COST } from './spellcasting';
import { restConditions, endCombatConditions, conditionName, applyConditionChanges, reduceExhaustion } from './conditions';
import { applyLimbChanges } from './equipment';
import { addItem, roundCoins, makeItem } from './items';
import { wakeAfterFight } from './encounter';
import { rescueKnockedOut, applySceneOutcome } from './sceneOutcome';
import { members, memberById, memberSheets, mergeHeroes, splitXp, updateMember, resolveTargets } from './party';

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

// ---------------------------------------------------------------------------
// The consequences of a scene told by Duncan (or the local engine)
// ---------------------------------------------------------------------------

/**
 * Damage, healing and gold of a scene. Damage and healing go to the members in
 * `damageTargets` / `healingTargets` (names, ids or "todos"; whoever acts when
 * missing), each the full amount; the gold changes the purse once. A member who
 * drops to 0 HP is patched up by Duncan (half their HP); his fee, half of the
 * purse, is paid once however many fell.
 * @returns {{ party, knockedOut: { id, name, hp }[], goldLost, hit: string[], healed: string[] }}
 */
export function applySceneEffects(party, actorId, { damage = 0, healing = 0, goldChange = 0, damageTargets = null, healingTargets = null } = {}) {
  const hurt = damage > 0 ? resolveTargets(party, damageTargets, actorId) : [];
  const cured = healing > 0 ? resolveTargets(party, healingTargets, actorId) : [];
  let gold = roundCoins(Math.max(0, (Number(party.gold) || 0) + (goldChange || 0)));
  const knockedOut = [];
  const next = {
    ...party,
    members: party.members.map(m => {
      const d = hurt.includes(m.id) ? damage : 0;
      const h = cured.includes(m.id) ? healing : 0;
      if (!d && !h) return m;
      const outcome = applySceneOutcome({ ...m, gold: 0 }, { damage: d, healing: h });
      if (outcome.knockedOut) knockedOut.push({ id: m.id, name: m.name, hp: outcome.hp });
      return { ...m, hp: outcome.hp };
    })
  };
  let goldLost = 0;
  if (knockedOut.length) {
    goldLost = Math.floor(gold / 2);
    gold = roundCoins(gold - goldLost);
  }
  const name = id => memberById(party, id)?.name;
  return { party: { ...next, gold }, knockedOut, goldLost, hit: hurt.map(name), healed: cured.map(name) };
}

/**
 * Conditions applied or removed by the story, each to its targets (whoever acts
 * when the change names nobody). Exhaustion 6: the member collapses and Duncan
 * picks them up (level 5 left, half HP at most); his fee, half of the purse, once.
 * @returns {{ party, applied: { name, change }[], collapsed: string[], goldLost }}
 */
export function applySceneConditions(party, actorId, changes = []) {
  let next = party;
  const applied = [];
  const collapsed = [];
  (changes || []).forEach(change => {
    resolveTargets(next, change.targets, actorId).forEach(id => {
      const member = memberById(next, id);
      const result = applyConditionChanges(member, [change]);
      if (!result.applied.length) return;
      let sheet = result.character;
      if (result.collapsed && !collapsed.includes(member.name)) {
        collapsed.push(member.name);
        sheet = { ...reduceExhaustion(sheet, 1).creature, hp: Math.min(sheet.hp, rescueKnockedOut(sheet).hp) };
      }
      next = { ...next, members: next.members.map(m => (m.id === id ? sheet : m)) };
      result.applied.forEach(c => applied.push({ name: member.name, change: c }));
    });
  });
  let goldLost = 0;
  if (collapsed.length) {
    goldLost = Math.floor((Number(next.gold) || 0) / 2);
    next = { ...next, gold: roundCoins(next.gold - goldLost) };
  }
  return { party: next, applied, collapsed, goldLost };
}

/**
 * Limbs lost, disabled or healed in the story, each change to its targets.
 * @returns {{ party, applied: { name, change }[] }}
 */
export function applySceneLimbs(party, actorId, changes = []) {
  let next = party;
  const applied = [];
  (changes || []).forEach(change => {
    resolveTargets(next, change.targets, actorId).forEach(id => {
      const member = memberById(next, id);
      const result = applyLimbChanges(member, [change]);
      if (!result.applied.length) return;
      next = updateMember(next, id, sheet => ({ ...result.character, gold: sheet.gold }));
      result.applied.forEach(c => applied.push({ name: member.name, change: c }));
    });
  });
  return { party: next, applied };
}
