// Quest journal: quests opened, updated and closed by the story (Duncan or the
// local engine), never by the player, who can only abandon one. Pure functions.
//
// Rewards are fixed by the game when a quest is opened, inside caps for the
// hero's level, and paid by the game when it is completed: the AI never
// decides amounts when closing a quest, it only narrates them.
//
// Reward rules (see the pull request):
//  - Gold: Duncan proposes an amount when opening; the game caps it at
//    QUEST_GOLD_CAP(level): 50 po × level (levels 1-4), 150 po × level (5-10),
//    500 po × level (11-16) and 1.500 po × level (17-20).
//  - Item: an item of the SRD catalog (weapon, armor, potion, gear) whose
//    price fits the same cap; when gold plus item go over it, the gold is
//    lowered so the item fits. Unknown items, or items worth more than the
//    cap, are dropped.
//  - XP: Duncan only says whether the quest gives experience and how
//    important it is ("menor", "normal", "mayor"); the game gives 10 %, 20 %
//    or 35 % of the XP between the hero's level and the next one (at level 20,
//    of the gap between 19 and 20).
//  - Story only: no gold, no item, no XP.
//  - Failed or abandoned quests pay nothing.

import { XP_FOR_LEVEL, MAX_LEVEL } from '../data/progression';
import { catalogByKey, catalogEntry, makeItem, addItem, roundCoins, formatCoins } from './items';
import { addXp } from './leveling';

export const QUEST_STATUSES = {
  active: 'Activa',
  completed: 'Cumplida',
  failed: 'Fallada',
  abandoned: 'Abandonada'
};

/** Quest importance (Duncan's "importancia") -> share of the XP to the next level. */
export const QUEST_IMPORTANCE = {
  menor: { id: 'minor', name: 'Menor', xpShare: 0.1 },
  normal: { id: 'normal', name: 'Normal', xpShare: 0.2 },
  mayor: { id: 'major', name: 'Mayor', xpShare: 0.35 }
};
const IMPORTANCE_BY_ID = Object.fromEntries(Object.values(QUEST_IMPORTANCE).map(i => [i.id, i]));

/** Quest changes in Duncan's reply ("accion") -> internal actions. */
export const QUEST_REPLY_ACTIONS = { abrir: 'open', actualizar: 'update', cumplir: 'complete', fallar: 'fail' };

export const MAX_ACTIVE_QUESTS = 8;
export const MAX_QUESTS = 40;
export const MAX_QUEST_CHANGES = 3;
export const MAX_NOTES = 12;
const TEXT_MAX = { title: 70, giver: 60, place: 60, objective: 200, note: 200 };

const levelOf = level => Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(level) || 1)));

/** Most gold (and item value) a quest may promise to a hero of this level. */
export function questGoldCap(level) {
  const l = levelOf(level);
  if (l <= 4) return 50 * l;
  if (l <= 10) return 150 * l;
  if (l <= 16) return 500 * l;
  return 1500 * l;
}

/** XP a quest of this importance gives to a hero of this level. */
export function questXp(level, importance = 'normal') {
  const l = levelOf(level);
  const from = l >= MAX_LEVEL ? MAX_LEVEL - 1 : l;
  const gap = XP_FOR_LEVEL[from + 1] - XP_FOR_LEVEL[from];
  const share = (IMPORTANCE_BY_ID[importance] || IMPORTANCE_BY_ID.normal).xpShare;
  return Math.round((gap * share) / 5) * 5;
}

const cleanText = (value, max) => (typeof value === 'string'
  ? value.trim().replace(/\s+/g, ' ').slice(0, max)
  : '');

const normalizeTitle = title => String(title || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * The catalog key of a promised item: a key ("potion:healing") or a name
 * ("Poción de curación", "Espada larga"). null if the catalog doesn't know it.
 */
export function resolveRewardItem(value) {
  const text = cleanText(value, 80);
  if (!text) return null;
  if (/^[a-z]+:[A-Za-z]+$/.test(text)) return catalogByKey(text) ? text : null;
  for (const type of ['consumable', 'weapon', 'armor', undefined]) {
    const entry = catalogEntry({ name: text, ...(type ? { type } : {}) });
    if (entry) return `${entry.kind}:${entry.id}`;
  }
  return null;
}

/**
 * The reward a quest really promises, validated against the caps for the
 * hero's level. `proposal`: { gold, item, xp: boolean, importance, storyOnly }.
 * @returns {{ gold: number, itemKey: string|null, itemName: string|null, xp: number, importance: string }}
 */
export function validateReward(proposal = {}, level = 1) {
  const importance = IMPORTANCE_BY_ID[proposal.importance] ? proposal.importance : 'normal';
  if (proposal.storyOnly) return { gold: 0, itemKey: null, itemName: null, xp: 0, importance };
  const cap = questGoldCap(level);
  let gold = Math.min(cap, Math.max(0, Math.round(Number(proposal.gold) || 0)));
  const key = proposal.itemKey || resolveRewardItem(proposal.item);
  const entry = key ? catalogByKey(key) : null;
  const item = entry && entry.price <= cap ? entry : null;
  if (item) gold = Math.max(0, Math.min(gold, Math.floor(cap - item.price)));
  return {
    gold,
    itemKey: item ? key : null,
    itemName: item ? item.name : null,
    xp: proposal.xp ? questXp(level, importance) : 0,
    importance
  };
}

/** "50 po, Poción de curación y 60 PX" (or "solo la historia"). */
export function describeReward(reward) {
  const parts = [
    ...(reward?.gold > 0 ? [formatCoins(reward.gold)] : []),
    ...(reward?.itemName ? [reward.itemName] : []),
    ...(reward?.xp > 0 ? [`${reward.xp} PX`] : [])
  ];
  if (!parts.length) return 'solo la historia';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`;
}

/**
 * Validate the quest changes of Duncan's reply ("misiones"). Shape only: ids
 * and rewards are checked against the journal by applyQuestChanges.
 * @returns {{ action, id?, title?, giver?, place?, objective?, note?, reward? }[]}
 */
export function cleanQuestChanges(list) {
  if (!Array.isArray(list)) return [];
  const changes = [];
  list.slice(0, MAX_QUEST_CHANGES * 2).forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const action = QUEST_REPLY_ACTIONS[String(entry.accion || '').trim().toLowerCase()];
    if (!action) return;
    const note = cleanText(entry.nota, TEXT_MAX.note);
    if (action === 'open') {
      const title = cleanText(entry.titulo, TEXT_MAX.title);
      const objective = cleanText(entry.objetivo, TEXT_MAX.objective);
      if (!title || !objective) return;
      const r = entry.recompensa && typeof entry.recompensa === 'object' ? entry.recompensa : {};
      const importance = QUEST_IMPORTANCE[String(r.importancia || '').trim().toLowerCase()]?.id || 'normal';
      changes.push({
        action,
        title,
        giver: cleanText(entry.quienEncarga, TEXT_MAX.giver),
        place: cleanText(entry.lugar, TEXT_MAX.place),
        objective,
        note,
        reward: {
          gold: Number(r.oro) || 0,
          item: cleanText(r.objeto, 80),
          xp: r.experiencia === true,
          importance,
          storyOnly: r.soloHistoria === true
        }
      });
      return;
    }
    const id = cleanText(entry.id, 20);
    const title = cleanText(entry.titulo, TEXT_MAX.title);
    if (!id && !title) return;
    const objective = action === 'update' ? cleanText(entry.objetivo, TEXT_MAX.objective) : '';
    if (action === 'update' && !note && !objective) return;
    changes.push({ action, id, title, note, objective });
  });
  return changes.slice(0, MAX_QUEST_CHANGES);
}

/** The quests of a save (older saves have none; invalid entries are dropped). */
export function normalizeQuests(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(q => q && typeof q === 'object' && typeof q.id === 'string' && typeof q.title === 'string')
    .map(q => ({
      ...q,
      status: QUEST_STATUSES[q.status] ? q.status : 'active',
      unseen: q.unseen === 'new' || q.unseen === 'updated' ? q.unseen : false,
      notes: Array.isArray(q.notes) ? q.notes.filter(n => n && typeof n.text === 'string') : [],
      reward: q.reward && typeof q.reward === 'object'
        ? { gold: Number(q.reward.gold) || 0, itemKey: q.reward.itemKey || null, itemName: q.reward.itemName || null, xp: Number(q.reward.xp) || 0, importance: q.reward.importance || 'normal' }
        : { gold: 0, itemKey: null, itemName: null, xp: 0, importance: 'normal' }
    }))
    .slice(-MAX_QUESTS);
}

export const activeQuests = quests => (quests || []).filter(q => q.status === 'active');
export const finishedQuests = quests => (quests || []).filter(q => q.status !== 'active');
export const unseenQuestCount = quests => (quests || []).filter(q => q.unseen).length;

function nextId(quests) {
  const max = quests.reduce((m, q) => Math.max(m, Number(String(q.id).replace(/^m/, '')) || 0), 0);
  return `m${max + 1}`;
}

/** The active quest a change refers to: by id, or else by exact title. */
function findActive(quests, change) {
  const byId = change.id && quests.find(q => q.id === change.id && q.status === 'active');
  if (byId) return byId;
  const title = normalizeTitle(change.title);
  return title ? quests.find(q => q.status === 'active' && normalizeTitle(q.title) === title) || null : null;
}

/** A fact for the campaign memory. */
export function questFact(quest, status = quest.status) {
  if (status === 'active') return `Misión aceptada: «${quest.title}»${quest.giver ? ` (encargo ${`de ${quest.giver}`.replace(/^de el /i, 'del ')})` : ''}`;
  if (status === 'completed') return `Misión cumplida: «${quest.title}»`;
  if (status === 'failed') return `Misión fallada: «${quest.title}»`;
  return `Misión abandonada: «${quest.title}»`;
}

/** Give the reward of a completed quest to the hero. */
export function payReward(character, reward) {
  let hero = character;
  const given = { gold: 0, itemName: null, xp: 0 };
  if (reward?.gold > 0) {
    hero = { ...hero, gold: roundCoins((Number(hero.gold) || 0) + reward.gold) };
    given.gold = reward.gold;
  }
  const item = reward?.itemKey ? makeItem(reward.itemKey) : null;
  if (item) {
    hero = { ...hero, inventory: addItem(hero.inventory, item) };
    given.itemName = item.name;
  }
  if (reward?.xp > 0) {
    hero = addXp(hero, reward.xp);
    given.xp = reward.xp;
  }
  return { character: hero, given };
}

/**
 * Apply the quest changes of a scene (validated with cleanQuestChanges, or
 * made by the local engine) to the journal, and pay the rewards of the
 * completed ones.
 * @param {object[]} quests      the journal
 * @param {object[]} changes     the changes
 * @param {object} ctx           { character, scene: number, place: string, date?: string }
 * @returns {{ quests, character, applied: { action, quest, given? }[], facts: string[] }}
 */
export function applyQuestChanges(quests, changes, { character, scene = 0, place = '', date = new Date().toISOString() } = {}) {
  let list = normalizeQuests(quests);
  let hero = character;
  const applied = [];
  const facts = [];
  const stamp = { scene, date };

  (changes || []).forEach(change => {
    if (change.action === 'open') {
      if (activeQuests(list).length >= MAX_ACTIVE_QUESTS) return;
      if (findActive(list, { title: change.title })) return; // already in the journal
      const quest = {
        id: nextId(list),
        title: change.title,
        giver: change.giver || '',
        place: change.place || place || '',
        objective: change.objective,
        reward: validateReward(change.reward, hero?.level),
        status: 'active',
        started: stamp,
        closed: null,
        notes: change.note ? [{ text: change.note, ...stamp }] : [],
        ...(change.goal ? { goal: change.goal } : {}),
        unseen: 'new'
      };
      list = [...list, quest].slice(-MAX_QUESTS);
      applied.push({ action: 'open', quest });
      facts.push(questFact(quest, 'active'));
      return;
    }

    const quest = findActive(list, change);
    if (!quest) return; // unknown id or already closed: ignored
    // "new" until the player opens it; "updated" after a change
    let next = { ...quest, unseen: quest.unseen === 'new' ? 'new' : 'updated' };
    if (change.note) next.notes = [...quest.notes, { text: change.note, ...stamp }].slice(-MAX_NOTES);

    if (change.action === 'update') {
      if (change.objective) next.objective = change.objective;
      if (!change.note && !change.objective) return;
      list = list.map(q => (q === quest ? next : q));
      applied.push({ action: 'update', quest: next });
      return;
    }

    next = { ...next, status: change.action === 'complete' ? 'completed' : 'failed', closed: stamp };
    let given = null;
    if (next.status === 'completed') {
      ({ character: hero, given } = payReward(hero, quest.reward));
    }
    list = list.map(q => (q === quest ? next : q));
    applied.push({ action: change.action, quest: next, given });
    facts.push(questFact(next));
  });

  return { quests: list, character: hero, applied, facts };
}

/** The player gives up a quest: no reward, it goes to the finished ones. */
export function abandonQuest(quests, id, { scene = 0, date = new Date().toISOString() } = {}) {
  const quest = (quests || []).find(q => q.id === id && q.status === 'active');
  if (!quest) return { quests, quest: null };
  const next = { ...quest, status: 'abandoned', closed: { scene, date }, unseen: false };
  return { quests: quests.map(q => (q === quest ? next : q)), quest: next };
}

/** The player has looked at the journal: no more "new" marks. */
export const markQuestsSeen = quests => (quests.some(q => q.unseen) ? quests.map(q => (q.unseen ? { ...q, unseen: false } : q)) : quests);

/** System message for a quest change shown in the story. */
export function describeQuestChange({ action, quest, given }) {
  if (action === 'open') return `📜 Nueva misión: «${quest.title}». ${quest.objective} Recompensa prometida: ${describeReward(quest.reward)}.`;
  if (action === 'update') {
    const note = quest.notes.at(-1)?.text;
    return `📜 Misión actualizada: «${quest.title}».${note ? ` ${note}` : ''}`;
  }
  if (action === 'complete') {
    const paid = describeReward({ gold: given?.gold, itemName: given?.itemName, xp: given?.xp });
    return `🏆 Misión cumplida: «${quest.title}». ${paid === 'solo la historia' ? 'No había más recompensa que la historia.' : `Recibes ${paid}.`}`;
  }
  return `✖ Misión fallada: «${quest.title}».`;
}

/** Short list of the active quests for Duncan's prompt (empty string when none). */
export function describeQuestsForPrompt(quests) {
  return activeQuests(quests)
    .map(q => `${q.id} = «${q.title}»${q.giver ? ` (de ${q.giver})` : ''}: ${q.objective} [recompensa: ${describeReward(q.reward)}]`)
    .join('; ');
}
