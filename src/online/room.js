// The online room (phase 1 of multiplayer): who is at the table, who plays which
// character, the votes for the characters left over, the queue of actions waiting
// for Duncan and the players' chat.
//
// The room is plain data owned by the host's browser (the host is authoritative):
// every change goes through these pure functions and the result is broadcast to
// the other players. Nothing secret lives here (keys and signatures are kept by the
// host apart, see useHostRoom.js), so the whole room can be sent as it is.
//
//   {
//     code, hostId,
//     players: { [id]: { id, name, isHost, connected } },
//     claims:  { [characterId]: playerId }   // the character a player chose (one each)
//     voted:   { [characterId]: playerId }   // leftover characters given by a vote
//     votes:   { [characterId]: { [voterId]: candidateId } }
//     ties:    { [characterId]: [playerId, ...] }   // a tied vote: the host decides
//     queue:   [{ id, playerId, characterId, kind, payload, label }]
//     chat:    [{ id, playerId, name, text, at }]
//     shareScenes: false   // while the party is apart, players may read the others' scenes (host's choice)
//   }
//
// Who controls a character: whoever claimed it, else whoever won its vote, else the
// host. When that player is disconnected the host plays it for the time being; it
// goes back to them when they reconnect (their claim is kept).

export const MAX_PLAYERS = 4;
export const MAX_QUEUE = 8;
export const MAX_QUEUE_PER_PLAYER = 2;
export const MAX_CHAT = 80;
export const MAX_NAME = 20;

const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

/** A short code that is easy to read aloud: 6 characters without look-alikes. */
export function newRoomCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < 6; i++) code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)];
  return code;
}

/** "ab-c d3" → "ABCD3" (codes are typed by hand) */
export const normalizeCode = text => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

/** A clean player name: trimmed, single spaces, no control characters, at most MAX_NAME. */
export function cleanName(text) {
  return String(text || '')
    // eslint-disable-next-line no-control-regex -- control characters are what it removes
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

export const sameName = (a, b) => cleanName(a).toLocaleLowerCase('es') === cleanName(b).toLocaleLowerCase('es');

export function createRoom({ code, hostId, hostName }) {
  return {
    code,
    hostId,
    players: { [hostId]: { id: hostId, name: cleanName(hostName) || 'Anfitrión', isHost: true, connected: true } },
    claims: {},
    voted: {},
    votes: {},
    ties: {},
    queue: [],
    chat: [],
    shareScenes: false
  };
}

/** The host lets the players read the scenes of the others (or not) while the party is apart. */
export const setShareScenes = (room, on) => ({ ...room, shareScenes: Boolean(on) });

/** A room saved by an earlier session of the host: everyone else starts disconnected. */
export function restoreRoom(saved, { hostId, hostName } = {}) {
  if (!saved || typeof saved !== 'object' || !saved.code || !saved.hostId) return null;
  const room = { ...createRoom({ code: saved.code, hostId: saved.hostId, hostName }), ...saved };
  const players = {};
  Object.values(saved.players || {}).forEach(p => {
    if (!p?.id) return;
    players[p.id] = { id: p.id, name: cleanName(p.name), isHost: p.id === room.hostId, connected: p.id === room.hostId };
  });
  if (hostId && hostId !== room.hostId) return null;
  if (hostName) players[room.hostId] = { ...players[room.hostId], name: cleanName(hostName) };
  return { ...room, players, queue: [], ties: saved.ties || {}, chat: Array.isArray(saved.chat) ? saved.chat.slice(-MAX_CHAT) : [], shareScenes: saved.shareScenes === true };
}

export const playerList = room => Object.values(room?.players || {});
export const connectedPlayers = room => playerList(room).filter(p => p.connected);
export const isConnected = (room, id) => Boolean(room?.players?.[id]?.connected);
export const playerName = (room, id) => room?.players?.[id]?.name || 'alguien';

/**
 * A player knocks at the door (`hello`). The same id comes back (a reconnection);
 * a new one needs a free seat and a name nobody else uses.
 * @returns {{ ok: true, room, rejoined: boolean } | { ok: false, error }}
 */
export function joinPlayer(room, { id, name }) {
  const clean = cleanName(name);
  if (!id || typeof id !== 'string') return { ok: false, error: 'Falta el identificador del jugador.' };
  if (!clean) return { ok: false, error: 'Escribe un nombre para entrar.' };
  const existing = room.players[id];
  if (existing) {
    if (existing.isHost) return { ok: false, error: 'Ese identificador es el del anfitrión.' };
    if (!sameName(existing.name, clean)) return { ok: false, error: 'Ese jugador entró con otro nombre.' };
    if (!existing.connected && connectedPlayers(room).length >= MAX_PLAYERS) return { ok: false, error: `La sala está llena (máximo ${MAX_PLAYERS} jugadores).` };
    return { ok: true, room: { ...room, players: { ...room.players, [id]: { ...existing, connected: true } } }, rejoined: true };
  }
  if (playerList(room).some(p => sameName(p.name, clean))) {
    return { ok: false, error: `Ya hay alguien llamado «${clean}» en la sala. Elige otro nombre (o, si eras tú, entra desde el mismo navegador).` };
  }
  if (connectedPlayers(room).length >= MAX_PLAYERS) return { ok: false, error: `La sala está llena (máximo ${MAX_PLAYERS} jugadores).` };
  if (playerList(room).length >= MAX_PLAYERS * 2) return { ok: false, error: 'Hay demasiados jugadores apuntados: el anfitrión puede quitar a los que ya no están.' };
  return {
    ok: true,
    rejoined: false,
    room: { ...room, players: { ...room.players, [id]: { id, name: clean, isHost: false, connected: true } } }
  };
}

/**
 * Who is connected right now (from the transport's presence). The host is always
 * connected in its own room. Votes are tallied again: someone came or went.
 */
export function setPresence(room, presentIds, characterIds = null) {
  const present = new Set(presentIds || []);
  const players = {};
  playerList(room).forEach(p => {
    players[p.id] = { ...p, connected: p.isHost || present.has(p.id) };
  });
  const next = { ...room, players };
  return characterIds ? tallyAll(next, characterIds) : next;
}

/** The host removes a player who is gone: their characters go back to the host. */
export function removePlayer(room, id) {
  const player = room.players[id];
  if (!player || player.isHost) return room;
  const players = { ...room.players };
  delete players[id];
  const drop = map => Object.fromEntries(Object.entries(map).filter(([, pid]) => pid !== id));
  const votes = Object.fromEntries(Object.entries(room.votes).map(([cid, v]) => [cid, Object.fromEntries(Object.entries(v).filter(([voter, cand]) => voter !== id && cand !== id))]));
  return {
    ...room,
    players,
    claims: drop(room.claims),
    voted: drop(room.voted),
    votes,
    queue: room.queue.filter(q => q.playerId !== id)
  };
}

// ---------------------------------------------------------------- control

/** Who plays a character when everyone is connected (its owner). */
export const ownerOf = (room, characterId) => room?.claims?.[characterId] || room?.voted?.[characterId] || room?.hostId || null;

/** Who plays it now: the owner, or the host while the owner is away. */
export function controllerOf(room, characterId) {
  const owner = ownerOf(room, characterId);
  return owner && isConnected(room, owner) ? owner : room?.hostId || null;
}

export const canControl = (room, playerId, characterId) => Boolean(playerId) && controllerOf(room, characterId) === playerId;

/** The characters a player plays now (theirs, and those of absent players for the host). */
export const controlledBy = (room, playerId, characterIds) => characterIds.filter(cid => canControl(room, playerId, cid));

/** The character a player chose, if any. */
export const claimOf = (room, playerId) => Object.keys(room.claims).find(cid => room.claims[cid] === playerId) || null;

/**
 * A player takes a free character (one each: taking another lets the first one go).
 * The host may also give one to a player (`byHost`), even one somebody else had.
 */
export function claimCharacter(room, playerId, characterId, characterIds, { byHost = false } = {}) {
  if (!room.players[playerId]) return { ok: false, error: 'Ese jugador no está en la sala.' };
  if (!characterIds.includes(characterId)) return { ok: false, error: 'Ese personaje no está en el grupo.' };
  const holder = room.claims[characterId];
  if (holder && holder !== playerId && !byHost) return { ok: false, error: `Ese personaje ya lo juega ${playerName(room, holder)}.` };
  const claims = Object.fromEntries(Object.entries(room.claims).filter(([cid, pid]) => pid !== playerId && cid !== characterId));
  claims[characterId] = playerId;
  const voted = { ...room.voted };
  delete voted[characterId];
  const votes = { ...room.votes };
  delete votes[characterId];
  const ties = { ...room.ties };
  delete ties[characterId];
  return { ok: true, room: tallyAll({ ...room, claims, voted, votes, ties }, characterIds) };
}

/** A player lets their character go: it becomes a leftover one (to be voted). */
export function releaseCharacter(room, playerId, characterId, characterIds, { byHost = false } = {}) {
  const holder = room.claims[characterId];
  if (!holder) return { ok: false, error: 'Nadie ha elegido ese personaje.' };
  if (holder !== playerId && !byHost) return { ok: false, error: 'Solo quien lo eligió puede soltarlo.' };
  const claims = { ...room.claims };
  delete claims[characterId];
  return { ok: true, room: tallyAll({ ...room, claims }, characterIds) };
}

/** Characters nobody chose: they are given to a player by a vote (the host plays them meanwhile). */
export const leftoverCharacters = (room, characterIds) => characterIds.filter(cid => !room.claims[cid]);

// ---------------------------------------------------------------- votes

/**
 * One connected player votes who should play a leftover character (any connected
 * player, themselves included). The vote is tallied again right away.
 */
export function castVote(room, voterId, characterId, candidateId, characterIds) {
  if (!isConnected(room, voterId)) return { ok: false, error: 'Solo votan los jugadores conectados.' };
  if (!leftoverCharacters(room, characterIds).includes(characterId)) return { ok: false, error: 'Ese personaje ya tiene jugador: no se vota.' };
  if (!isConnected(room, candidateId)) return { ok: false, error: 'Solo se puede votar a un jugador conectado.' };
  const votes = { ...room.votes, [characterId]: { ...(room.votes[characterId] || {}), [voterId]: candidateId } };
  return { ok: true, room: tallyVote({ ...room, votes }, characterId) };
}

/**
 * The count of a vote, only with the players connected now.
 * complete: every connected player voted; leaders: the most voted (more than one = a tie).
 */
export function voteTally(room, characterId) {
  const voters = connectedPlayers(room).map(p => p.id);
  const ballots = room.votes[characterId] || {};
  const counts = {};
  voters.forEach(v => {
    const cand = ballots[v];
    if (cand && isConnected(room, cand)) counts[cand] = (counts[cand] || 0) + 1;
  });
  const top = Math.max(0, ...Object.values(counts));
  const leaders = top > 0 ? Object.keys(counts).filter(id => counts[id] === top) : [];
  const cast = voters.filter(v => ballots[v] && isConnected(room, ballots[v])).length;
  return { counts, leaders, complete: voters.length > 0 && cast === voters.length, cast, voters: voters.length };
}

/** Resolve a vote once everyone connected has voted: a winner gets the character, a tie goes to the host. */
export function tallyVote(room, characterId) {
  const tally = voteTally(room, characterId);
  const ties = { ...room.ties };
  delete ties[characterId];
  if (!tally.complete) return { ...room, ties };
  if (tally.leaders.length === 1) return { ...room, ties, voted: { ...room.voted, [characterId]: tally.leaders[0] } };
  return { ...room, ties: { ...ties, [characterId]: tally.leaders } };
}

/** Tally every leftover character (after someone joins, leaves or changes their character). */
export function tallyAll(room, characterIds) {
  let next = room;
  // A claimed character is no longer voted; a character that left the party is forgotten
  const keep = new Set(leftoverCharacters(room, characterIds));
  const only = map => Object.fromEntries(Object.entries(map).filter(([cid]) => keep.has(cid)));
  next = { ...next, voted: only(next.voted), votes: only(next.votes), ties: only(next.ties), claims: Object.fromEntries(Object.entries(next.claims).filter(([cid]) => characterIds.includes(cid))) };
  keep.forEach(cid => { next = tallyVote(next, cid); });
  return next;
}

/** In a tie the host picks one of the tied players. */
export function breakTie(room, characterId, playerId) {
  const tied = room.ties[characterId];
  if (!tied?.length) return { ok: false, error: 'Esa votación no está empatada.' };
  if (!tied.includes(playerId)) return { ok: false, error: 'Elige a uno de los empatados.' };
  const ties = { ...room.ties };
  delete ties[characterId];
  return { ok: true, room: { ...room, ties, voted: { ...room.voted, [characterId]: playerId } } };
}

/**
 * The host closes a vote without waiting for everyone: the most voted wins; with no
 * votes or a tie the host decides among the tied (or among everyone connected).
 */
export function closeVote(room, characterId) {
  const tally = voteTally(room, characterId);
  if (tally.leaders.length === 1) return breakTie({ ...room, ties: { ...room.ties, [characterId]: tally.leaders } }, characterId, tally.leaders[0]).room;
  const tied = tally.leaders.length ? tally.leaders : connectedPlayers(room).map(p => p.id);
  return { ...room, ties: { ...room.ties, [characterId]: tied } };
}

/** Anyone may ask for a new vote (someone came in or left): the ballots are cleared, the current result stays until the new one is decided. */
export function restartVotes(room, characterIds) {
  const leftovers = leftoverCharacters(room, characterIds);
  const votes = { ...room.votes };
  const ties = { ...room.ties };
  leftovers.forEach(cid => { delete votes[cid]; delete ties[cid]; });
  return { ...room, votes, ties };
}

// ---------------------------------------------------------------- queue & chat

let seq = 0;
const nextId = prefix => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

/** An action waits for its turn with Duncan (outside combat, in arrival order). */
export function enqueueAction(room, { playerId, characterId, kind, payload, label }) {
  if (room.queue.length >= MAX_QUEUE) return { ok: false, error: 'Hay demasiadas acciones esperando a Duncan: espera un poco.' };
  if (room.queue.filter(q => q.playerId === playerId).length >= MAX_QUEUE_PER_PLAYER) {
    return { ok: false, error: `Ya tienes ${MAX_QUEUE_PER_PLAYER} acciones en cola: espera a que Duncan las resuelva.` };
  }
  const item = { id: nextId('q'), playerId, characterId, kind, payload, label: String(label || '').slice(0, 120) };
  return { ok: true, room: { ...room, queue: [...room.queue, item] }, item };
}

export const dequeueAction = (room, id) => ({ ...room, queue: room.queue.filter(q => q.id !== id) });

/** A player takes back an action that is still waiting (the host can take back any). */
export function cancelAction(room, playerId, id) {
  const item = room.queue.find(q => q.id === id);
  if (!item) return { ok: false, error: 'Esa acción ya no está en la cola.' };
  if (item.playerId !== playerId && playerId !== room.hostId) return { ok: false, error: 'Solo puedes retirar tus propias acciones.' };
  return { ok: true, room: dequeueAction(room, id) };
}

/** A line in the players' chat (Duncan never reads it). */
export function addChat(room, playerId, text, at = Date.now()) {
  const line = { id: nextId('c'), playerId, name: playerName(room, playerId), text, at };
  return { ...room, chat: [...room.chat, line].slice(-MAX_CHAT) };
}

/**
 * Chat lines from the others that arrived after `seenAt` (the time of the last line this
 * player saw). By time, not by count: the chat only keeps its last lines.
 */
export const unreadChatCount = (chat, playerId, seenAt = 0) =>
  (chat || []).filter(line => line.playerId !== playerId && (line.at || 0) > seenAt).length;

/** Time of the newest line in the chat (0 when empty). */
export const lastChatAt = chat => (chat || []).reduce((max, line) => Math.max(max, line.at || 0), 0);

/** What a saved room keeps between sessions of the host (no queue: it was for that session). */
export const roomToSave = room => ({
  code: room.code, hostId: room.hostId, players: room.players, claims: room.claims, voted: room.voted, votes: room.votes, ties: room.ties, chat: room.chat.slice(-30),
  shareScenes: Boolean(room.shareScenes)
});
