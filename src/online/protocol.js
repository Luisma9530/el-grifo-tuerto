// What players send to the host (intents) and how the host checks them.
//
// Nothing that arrives from the network is trusted: `sanitizeIntent` keeps only
// the known fields with the right types and sizes, and `applyIntent` checks it
// against the room and the game (the player is in the room, controls that
// character, it is their turn in combat...) before anything changes. The game
// itself is then played by the host with the same pure functions as offline
// (party.js, partyActions.js, encounter.js), which check the rules again.

import {
  isConnected, canControl, claimCharacter, releaseCharacter, castVote, restartVotes,
  enqueueAction, cancelAction, addChat
} from './room';

export const MAX_ACTION_TEXT = 400;
export const MAX_CHAT_TEXT = 300;
export const MAX_ID = 80;
/** Largest signed body accepted from a player (characters, before parsing). */
export const MAX_INTENT_BYTES = 4000;

const ABILITIES = ['fue', 'des', 'con', 'int', 'sab', 'car'];
const ACT_KINDS = ['text', 'check', 'attack', 'spell', 'item'];
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
      } else {
        const itemId = id(p.itemId);
        if (!itemId) return bad;
        payload = { itemId };
      }
      return { ok: true, intent: { type: 'act', characterId, kind: raw.kind, payload } };
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

/** A short line for the queue: "Brena: «Abro la puerta»", "Brena: tirada de Percepción"... */
export function describeQueued(name, kind, payload, extra = {}) {
  if (kind === 'text') return `${name}: «${payload.text.length > 70 ? `${payload.text.slice(0, 70)}…` : payload.text}»`;
  if (kind === 'check') return `${name}: tirada de ${extra.label || payload.skillId || payload.ability}`;
  if (kind === 'attack') return `${name}: ataque${payload.target ? ` a ${payload.target}` : ''}`;
  if (kind === 'spell') return `${name}: conjuro${extra.label ? ` ${extra.label}` : ''}${payload.target ? ` sobre ${payload.target}` : ''}`;
  return `${name}: usa ${extra.label || 'un objeto'}`;
}

/**
 * Check an intent from `playerId` and apply it.
 * @param game { characterIds, names: {id: name}, inCombat, turnCharacterId, combatBusy, labelFor?(kind, payload, characterId) }
 * @returns {{ ok: true, room, combat?: { characterId, action }, queued?: item }
 *         | { ok: false, error }}
 *   combat: a combat action the host must play now (it is that player's turn).
 */
export function applyIntent(room, game, playerId, intent) {
  if (!room?.players?.[playerId]) return { ok: false, error: 'Primero tienes que entrar en la sala.' };
  if (!isConnected(room, playerId)) return { ok: false, error: 'No estás conectado a la sala.' };
  const { characterIds = [], names = {} } = game;
  const known = cid => characterIds.includes(cid);
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
      if (game.inCombat) return { ok: false, error: 'En combate se juega por turnos: espera al turno de tu personaje.' };
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
    case 'combat': {
      if (!game.inCombat) return { ok: false, error: 'No hay ningún combate en marcha.' };
      if (!known(intent.characterId)) return { ok: false, error: 'Ese personaje no está en el grupo.' };
      if (game.turnCharacterId !== intent.characterId) {
        return { ok: false, error: game.turnCharacterId ? `Ahora es el turno de ${nameOf(game.turnCharacterId)}.` : 'Ahora actúan los enemigos.' };
      }
      if (!canControl(room, playerId, intent.characterId)) return { ok: false, error: `No controlas a ${nameOf(intent.characterId)}.` };
      if (game.combatBusy) return { ok: false, error: 'Espera a que terminen de rodar los dados.' };
      return { ok: true, room, combat: { characterId: intent.characterId, action: intent.action } };
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
