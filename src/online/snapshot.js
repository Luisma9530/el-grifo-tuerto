// What the host shares with the other players: the game as they need to see it,
// split in sections so only what changed is sent (the realtime service counts
// messages and limits their size).
//
// Only the fields listed here are sent: the Gemini keys are not part of the game
// state and never get in (security.js checks it again before sending).

export const MAX_CHRONICLE = 50;
export const MAX_COMBAT_LOG = 50;
export const MAX_EVENTS = 30;
const MAX_TEXT = 4000;

const trimText = text => (typeof text === 'string' && text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text);

/** A chronicle message as the others see it (no AI bookkeeping). */
const publicMessage = m => ({
  sender: m.sender,
  text: trimText(m.text),
  actor: m.actor,
  avatar: m.avatar,
  by: m.by,
  timestamp: m.timestamp,
  xp: m.xp,
  source: m.source,
  notice: m.notice,
  // While the party is apart: the scene (group) the message belongs to
  ...(m.groupId ? { groupId: m.groupId } : {})
});

/**
 * The chronicle sent to the players: the last MAX_CHRONICLE messages of each
 * chronicle (the common one and each scene of a party apart), in order. Each
 * player's table shows only the chronicles they may read (see splitParty.js).
 */
export function chronicleForPlayers(messages = []) {
  const counts = new Map();
  const keep = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && keep.length < MAX_CHRONICLE * 2; i--) {
    const key = messages[i]?.groupId || '';
    const n = counts.get(key) || 0;
    if (n >= MAX_CHRONICLE) continue;
    // (the realtime service limits the size of each message: never more text than before)
    chars += Math.min(MAX_TEXT, String(messages[i]?.text || '').length);
    if (chars > MAX_CHRONICLE * MAX_TEXT) break;
    counts.set(key, n + 1);
    keep.push(messages[i]);
  }
  return keep.reverse();
}

/** The room as the players see it (it holds nothing secret, see room.js). */
export const publicRoom = room => ({
  code: room.code,
  hostId: room.hostId,
  players: room.players,
  claims: room.claims,
  voted: room.voted,
  votes: room.votes,
  ties: room.ties,
  queue: room.queue.map(q => ({ id: q.id, playerId: q.playerId, characterId: q.characterId, kind: q.kind, label: q.label })),
  chat: room.chat,
  shareScenes: Boolean(room.shareScenes)
});

/**
 * Every section of the shared state.
 * @param game the host's state: { title, world, party, messages, suggestedActions, encounter,
 *   quests, events, summary, isGenerating, combatBusy, pendingRecruit, room, aiActive }
 */
export function buildSections(game) {
  const encounter = game.encounter
    ? { ...game.encounter, log: (game.encounter.log || []).slice(-MAX_COMBAT_LOG) }
    : null;
  return {
    meta: {
      title: game.title || '',
      isGenerating: Boolean(game.isGenerating),
      combatBusy: Boolean(game.combatBusy),
      suggestedActions: Array.isArray(game.suggestedActions) ? game.suggestedActions.slice(0, 6) : [],
      pendingRecruit: game.pendingRecruit ? { character: pickRecruit(game.pendingRecruit.character), reason: game.pendingRecruit.reason || '' } : null,
      aiActive: Boolean(game.aiActive)
    },
    party: game.party || null,
    world: game.world || null,
    encounter,
    journal: {
      quests: game.quests || [],
      events: (game.events || []).slice(-MAX_EVENTS),
      summary: game.summary || ''
    },
    chronicle: chronicleForPlayers(game.messages || []).map(publicMessage),
    room: game.room ? publicRoom(game.room) : null
  };
}

const pickRecruit = c => (c ? { name: c.name, avatar: c.avatar, race: c.race, className: c.className, level: c.level, maxHp: c.maxHp, ac: c.ac } : null);

/**
 * Which sections changed since the last time they were sent.
 * @param sent { [section]: json } what was sent last (updated in place)
 * @returns {object|null} the sections to send, or null when nothing changed
 */
export function changedSections(sections, sent) {
  const out = {};
  let any = false;
  Object.entries(sections).forEach(([key, value]) => {
    const json = JSON.stringify(value);
    if (sent[key] === json) return;
    sent[key] = json;
    out[key] = value;
    any = true;
  });
  return any ? out : null;
}
