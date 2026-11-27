// What players send to the host (intents) and how the host checks them.
//
// Nothing that arrives from the network is trusted: `sanitizeIntent` keeps only
// the known fields with the right types and sizes, and `applyIntent` checks it
// against the room and the game (the player is in the room, controls that
// character, it is their turn in combat...) before anything changes. The game
// itself is then played by the host with the same pure functions as offline
// (party.js, partyActions.js, encounter.js), which check the rules again.

import { cleanDraft } from './newHero';
import { cleanSealed } from './keyLending';
import { MAX_PARTY } from '../utils/party';
import {
  isConnected, canControl, claimOf, claimCharacter, releaseCharacter, castVote, restartVotes,
  enqueueAction, cancelAction, addChat
} from './room';

export const MAX_ACTION_TEXT = 400;
export const MAX_CHAT_TEXT = 300;
export const MAX_ID = 80;
/** Largest signed body accepted from a player (characters, before parsing). */
export const MAX_INTENT_BYTES = 8000;

const ABILITIES = ['fue', 'des', 'con', 'int', 'sab', 'car'];
// 'travel': while the party is apart, a player moves their own group on the map
const ACT_KINDS = ['text', 'check', 'attack', 'spell', 'item', 'travel'];
const COMBAT_TYPES = ['attack', 'spell', 'equip', 'dodge', 'flee', 'escape', 'potion', 'endTurn'];

// eslint-disable-next-line no-control-regex -- control characters are what it removes
const str = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const id = value => (typeof value === 'string' && value.length <= MAX_ID && /^[\w:.-]+$/.test(value) ? value : null);
const optId = value => (value == null ? null : id(value));

/**
 * Keep only what an intent may carry. Unknown types or malformed fields → error.
 * @returns {{ ok: true, intent } | { ok: false, error }}
 */
export function sanitizeIntent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Mensaje no válido.' };
  const bad = { ok: false, error: 'Mensaje no válido.' };
  const characterId = id(raw.characterId);
  switch (raw.type) {
    case 'claim':
    case 'release':
      return characterId ? { ok: true, intent: { type: raw.type, characterId } } : bad;
    case 'vote': {
      const candidateId = id(raw.candidateId);
      return characterId && candidateId ? { ok: true, intent: { type: 'vote', characterId, candidateId } } : bad;
    }
    case 'revote':
      return { ok: true, intent: { type: 'revote' } };
    case 'chat': {
      const text = str(raw.text, MAX_CHAT_TEXT);
      return text ? { ok: true, intent: { type: 'chat', text } } : { ok: false, error: 'El mensaje está vacío.' };
    }
    case 'cancel': {
      const queueId = id(raw.queueId);
      return queueId ? { ok: true, intent: { type: 'cancel', queueId } } : bad;
    }
    case 'act': {
      if (!characterId || !ACT_KINDS.includes(raw.kind)) return bad;
      const p = raw.payload && typeof raw.payload === 'object' ? raw.payload : {};
      let payload;
      if (raw.kind === 'text') {
        const text = str(p.text, MAX_ACTION_TEXT);
        if (!text) return { ok: false, error: 'Escribe qué hace tu personaje.' };
        payload = { text };
      } else if (raw.kind === 'check') {
        const skillId = optId(p.skillId);
        const ability = ABILITIES.includes(p.ability) ? p.ability : null;
        if (!skillId && !ability) return bad;
        payload = { skillId, ability };
      } else if (raw.kind === 'attack') {
        const optionId = id(p.optionId);
        if (!optionId) return bad;
        const ac = Math.round(Number(p.targetAC));
        payload = { optionId, target: str(p.target, 60), targetAC: Number.isFinite(ac) ? Math.min(30, Math.max(1, ac)) : null, raging: p.raging === true };
      } else if (raw.kind === 'spell') {
        const spellId = id(p.spellId);
        if (!spellId) return bad;
        payload = { spellId, target: str(p.target, 60) };
      } else if (raw.kind === 'travel') {
        const nodeId = id(p.nodeId);
        if (!nodeId) return bad;
        payload = { nodeId };
      } else {
        const itemId = id(p.itemId);
        if (!itemId) return bad;
        payload = { itemId };
      }
      return { ok: true, intent: { type: 'act', characterId, kind: raw.kind, payload } };
    }
    case 'equip': {
      // The hero's own equipment outside combat: what is in each hand and the armor worn
      const hands = raw.hands && typeof raw.hands === 'object' ? raw.hands : {};
      if (!characterId || (hands.main != null && !id(hands.main)) || (hands.off != null && !id(hands.off)) || (raw.armorId != null && !id(raw.armorId))) return bad;
      return { ok: true, intent: { type: 'equip', characterId, hands: { main: hands.main ?? null, off: hands.off ?? null }, armorId: raw.armorId ?? null } };
    }
    case 'create': {
      // A new character for this player: the wizard's choices (the host builds the sheet)
      // (and, in a campaign that started apart, the zone where they start)
      const draft = cleanDraft(raw.draft);
      if (raw.zoneId != null && !id(raw.zoneId)) return bad;
      return draft ? { ok: true, intent: { type: 'create', draft, zoneId: raw.zoneId ?? null } } : { ok: false, error: 'La ficha que llegó no es válida.' };
    }
    case 'lend': {
      // A Gemini key lent to the host, encrypted for the host alone (keyLending.js):
      // the session opens it, it never reaches the room or the game
      const sealed = cleanSealed(raw.sealed);
      return sealed ? { ok: true, intent: { type: 'lend', sealed } } : bad;
    }
    case 'unlend':
      return { ok: true, intent: { type: 'unlend' } };
    case 'finish':
      // A finished fight of the player's group (a party apart): the host closes it
      return characterId ? { ok: true, intent: { type: 'finish', characterId } } : bad;
    case 'levelUp': {
      const choices = sanitizeLevelUpChoices(raw.choices);
      return characterId && choices ? { ok: true, intent: { type: 'levelUp', characterId, choices } } : bad;
    }
    case 'combat': {
      const a = raw.action && typeof raw.action === 'object' ? raw.action : null;
      if (!characterId || !a || !COMBAT_TYPES.includes(a.type)) return bad;
      const action = { type: a.type };
      if (a.optionId != null) { if (!id(a.optionId)) return bad; action.optionId = a.optionId; }
      if (a.targetUid != null) { if (!id(a.targetUid)) return bad; action.targetUid = a.targetUid; }
      if (a.spellId != null) { if (!id(a.spellId)) return bad; action.spellId = a.spellId; }
      if (a.itemId != null) { if (!id(a.itemId)) return bad; action.itemId = a.itemId; }
      if (a.raging === true) action.raging = true;
      if (a.type === 'equip') {
        const hands = a.hands && typeof a.hands === 'object' ? a.hands : {};
        if ((hands.main != null && !id(hands.main)) || (hands.off != null && !id(hands.off))) return bad;
        action.hands = { main: hands.main ?? null, off: hands.off ?? null };
      }
      return { ok: true, intent: { type: 'combat', characterId, action } };
    }
    default:
      return bad;
  }
}

const idList = (value, max = 40) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max || !value.every(v => id(v))) return null;
  return [...value];
};

/**
 * The choices of a level up (see leveling.js emptyLevelUpChoices), only with their
 * known fields. The hit die is never taken from the player: with `roll` the host
 * rolls it. Whether the choices are legal is checked by applyLevelUp on the host.
 */
export function sanitizeLevelUpChoices(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const hp = raw.hp?.method === 'roll' ? 'roll' : raw.hp?.method === 'average' ? 'average' : null;
  const mode = raw.asi?.mode === 'split' ? 'split' : raw.asi?.mode === 'two' ? 'two' : null;
  const abilities = Array.isArray(raw.asi?.abilities) && raw.asi.abilities.length <= 2 && raw.asi.abilities.every(a => ABILITIES.includes(a)) ? [...raw.asi.abilities] : null;
  const spells = raw.spells && typeof raw.spells === 'object' ? raw.spells : {};
  const cantrips = idList(spells.cantrips);
  const learned = idList(spells.spells);
  const prepared = idList(spells.prepared, 80);
  const arcanum = spells.arcanum == null ? null : id(spells.arcanum);
  const boonId = raw.boon?.id == null ? null : id(raw.boon.id);
  const boonAbility = raw.boon?.ability == null ? null : ABILITIES.includes(raw.boon.ability) ? raw.boon.ability : undefined;
  if (!hp || !mode || !abilities || !cantrips || !learned || !prepared || (spells.arcanum != null && !arcanum)
    || (raw.boon?.id != null && !boonId) || boonAbility === undefined) return null;
  return {
    hp: { method: hp, roll: null },
    asi: { mode, abilities },
    spells: { cantrips, spells: learned, prepared, arcanum },
    boon: { id: boonId, ability: boonAbility }
  };
}

/** A short line for the queue: "Brena: «Abro la puerta»", "Brena: tirada de Percepción"... */
export function describeQueued(name, kind, payload, extra = {}) {
  if (kind === 'text') return `${name}: «${payload.text.length > 70 ? `${payload.text.slice(0, 70)}…` : payload.text}»`;
  if (kind === 'check') return `${name}: tirada de ${extra.label || payload.skillId || payload.ability}`;
  if (kind === 'attack') return `${name}: ataque${payload.target ? ` a ${payload.target}` : ''}`;
  if (kind === 'spell') return `${name}: conjuro${extra.label ? ` ${extra.label}` : ''}${payload.target ? ` sobre ${payload.target}` : ''}`;
  if (kind === 'travel') return `${name}: viaja a ${extra.label || 'otro lugar'}`;
  return `${name}: usa ${extra.label || 'un objeto'}`;
}

/**
 * Check an intent from `playerId` and apply it.
 * @param game { characterIds, names: {id: name}, inCombat, turnCharacterId, combatBusy, labelFor?(kind, payload, characterId),
 *   sceneOf?(characterId) }  sceneOf: with the party apart each group has its own fight
 *   ({ inCombat, turnCharacterId, combatBusy, finished }); without it, the party's (the fields above)
 * @returns {{ ok: true, room, combat?: { characterId, action }, queued?: item }
 *         | { ok: false, error }}
 *   (also `direct`, see below)
 *   combat: a combat action the host must play now (it is that player's turn).
 *   direct: { kind: 'equip' | 'levelUp', characterId, ... } or { kind: 'create', draft } a change to the player's own
 *   character the host applies now (and checks against the rules: equipment.js, leveling.js).
 */
export function applyIntent(room, game, playerId, intent) {
  if (!room?.players?.[playerId]) return { ok: false, error: 'Primero tienes que entrar en la sala.' };
  if (!isConnected(room, playerId)) return { ok: false, error: 'No estás conectado a la sala.' };
  const { characterIds = [], names = {} } = game;
  const known = cid => characterIds.includes(cid);
  // The fight that matters for a character: their group's (party apart) or the party's
  const sceneOf = cid => (game.sceneOf ? game.sceneOf(cid) : game);
  const nameOf = cid => names[cid] || 'ese personaje';
  const wrap = res => (res.ok ? { ok: true, room: res.room } : res);

  switch (intent.type) {
    case 'claim':
      return wrap(claimCharacter(room, playerId, intent.characterId, characterIds));
    case 'release':
      return wrap(releaseCharacter(room, playerId, intent.characterId, characterIds));
    case 'vote':
      return wrap(castVote(room, playerId, intent.characterId, intent.candidateId, characterIds));
    case 'revote':
      return { ok: true, room: restartVotes(room, characterIds) };
    case 'chat':
      return { ok: true, room: addChat(room, playerId, intent.text) };
    case 'cancel':
      return wrap(cancelAction(room, playerId, intent.queueId));
    case 'act': {
      if (!known(intent.characterId)) return { ok: false, error: 'Ese personaje no está en el grupo.' };
      if (!canControl(room, playerId, intent.characterId)) return { ok: false, error: `No controlas a ${nameOf(intent.characterId)}.` };
      if (sceneOf(intent.characterId).inCombat) return { ok: false, error: 'En combate se juega por turnos: espera al turno de tu personaje.' };
      if (intent.kind === 'travel') {
        if (!game.apart && playerId !== room.hostId) return { ok: false, error: 'Los viajes del grupo los decide el anfitrión.' };
        if (!(game.nodeIds || []).includes(intent.payload.nodeId)) return { ok: false, error: 'Ese lugar no está en el mapa.' };
      }
      const extra = { label: game.labelFor?.(intent.kind, intent.payload, intent.characterId) || '' };
      const res = enqueueAction(room, {
        playerId,
        characterId: intent.characterId,
        kind: intent.kind,
        payload: intent.payload,
        label: describeQueued(nameOf(intent.characterId), intent.kind, intent.payload, extra)
      });
      return res.ok ? { ok: true, room: res.room, queued: res.item } : res;
    }
    case 'create': {
      if (playerId === room.hostId) return { ok: false, error: 'El anfitrión suma compañeros por la historia.' };
      if (characterIds.length >= MAX_PARTY) return { ok: false, error: `El grupo ya tiene ${MAX_PARTY} personajes: elige uno libre o espera a la votación.` };
      if (game.inCombat) return { ok: false, error: 'Espera a que acabe el combate para unirte al grupo.' };
      const own = claimOf(room, playerId);
      if (own) return { ok: false, error: `Ya juegas con ${nameOf(own)}: suéltalo antes de crear otro personaje.` };
      return { ok: true, room, direct: { kind: 'create', draft: intent.draft, zoneId: intent.zoneId || null } };
    }
    case 'equip':
    case 'levelUp': {
      // The player's own character, applied by the host right away (no Duncan involved)
      if (!known(intent.characterId)) return { ok: false, error: 'Ese personaje no está en el grupo.' };
      if (!canControl(room, playerId, intent.characterId)) return { ok: false, error: `No controlas a ${nameOf(intent.characterId)}.` };
      if (sceneOf(intent.characterId).inCombat) {
        return { ok: false, error: intent.type === 'equip'
          ? 'En combate, cambia de arma desde la vista de combate en tu turno: gasta tu acción.'
          : 'Sube de nivel cuando acabe el combate.' };
      }
      const { type, ...rest } = intent;
      return { ok: true, room, direct: { kind: type, ...rest } };
    }
    case 'combat': {
      if (!known(intent.characterId)) return { ok: false, error: 'Ese personaje no está en el grupo.' };
      const fight = sceneOf(intent.characterId);
      if (!fight.inCombat) return { ok: false, error: 'No hay ningún combate en marcha.' };
      if (fight.turnCharacterId !== intent.characterId) {
        return { ok: false, error: fight.turnCharacterId ? `Ahora es el turno de ${nameOf(fight.turnCharacterId)}.` : 'Ahora actúan los enemigos.' };
      }
      if (!canControl(room, playerId, intent.characterId)) return { ok: false, error: `No controlas a ${nameOf(intent.characterId)}.` };
      if (fight.combatBusy) return { ok: false, error: 'Espera a que terminen de rodar los dados.' };
      return { ok: true, room, combat: { characterId: intent.characterId, action: intent.action } };
    }
    case 'finish': {
      // Close the finished fight of the player's group (a party apart: the host may not be watching it)
      if (!known(intent.characterId)) return { ok: false, error: 'Ese personaje no está en el grupo.' };
      if (!canControl(room, playerId, intent.characterId)) return { ok: false, error: `No controlas a ${nameOf(intent.characterId)}.` };
      if (!sceneOf(intent.characterId).finished) return { ok: false, error: 'Ese combate aún no ha terminado.' };
      return { ok: true, room, direct: { kind: 'finish', characterId: intent.characterId } };
    }
    default:
      return { ok: false, error: 'Mensaje no válido.' };
  }
}

/**
 * Before the host plays a queued action: is it still valid? (the player may have
 * gone, the character may have changed hands or left the party, a fight may have started)
 */
export function stillValid(room, game, item) {
  if (!game.characterIds.includes(item.characterId)) return { ok: false, error: 'ese personaje ya no está en el grupo' };
  if (!canControl(room, item.playerId, item.characterId)) return { ok: false, error: 'ese jugador ya no controla al personaje' };
  return { ok: true };
}
