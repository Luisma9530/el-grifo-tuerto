// The two ends of an online room, without React (the hooks in useOnlineRoom.js
// wrap them), so whole games between tabs can be tested.
//
// Messages on the channel:
//   player → host  { t: 'hello', id, name, key }          enter (key: public signing key)
//                  { t: 'intent', id, b, s }               b: JSON text { seq, type, ... }, s: signature of b
//                  { t: 'sync', id }                       send me everything again
//   host → all     { t: 'welcome', to, ok, error?, hostId }
//                  { t: 'state', full?, s: { section: value } }   only the sections that changed
//                  { t: 'notice', to, text }               an intent was refused (only for that player)

import { joinPlayer, setPresence, roomToSave, playerName } from './room';
import { sanitizeIntent, applyIntent, MAX_INTENT_BYTES } from './protocol';
import { publicOnly, sameKey, verifyText, signText, createRateLimiter } from './security';
import { changedSections, publicRoom } from './snapshot';

export const STATE_THROTTLE_MS = 300;
export const HELLO_RETRY_MS = 2000;

/**
 * The host's end. It owns the room, checks what arrives and shares the state.
 * @param transport see transport.js
 * @param room the room (room.js); identities: { [playerId]: { key, seq } } kept from earlier sessions
 * @param getGame () => game context for applyIntent (see protocol.js)
 * @param onCombat (characterId, action) => void: a combat action to play now
 * @param onChange (room, identities) => void: the room changed (to render and save it)
 */
export function createHostSession({
  transport, room: initialRoom, identities: savedIdentities = {}, getGame, onCombat = () => {}, onChange = () => {},
  throttleMs = STATE_THROTTLE_MS, rateLimit = createRateLimiter({ max: 8, windowMs: 5000 }),
  helloGraceMs = 6000, now = () => Date.now()
}) {
  let room = initialRoom;
  const identities = { ...savedIdentities };
  let latest = null; // last sections given by the game
  const sent = {};
  let timer = null;
  let closed = false;
  const chains = new Map(); // one intent at a time per player, in order

  const setRoom = next => {
    if (next === room) return;
    room = next;
    onChange(room, identities);
  };
  const send = message => {
    if (closed) return;
    try { transport.send(message); } catch (err) { console.error(err); }
  };
  const notice = (to, text) => send({ t: 'notice', to, text: String(text).slice(0, 300) });
  const characterIds = () => getGame().characterIds || [];

  const flush = () => {
    timer = null;
    if (!latest || closed) return;
    const changed = changedSections({ ...latest, room: publicRoom(room) }, sent);
    if (changed) send({ t: 'state', s: changed });
  };
  const schedule = () => {
    if (!timer && !closed) timer = setTimeout(flush, throttleMs);
  };
  const sendFull = () => {
    if (!latest) return;
    const all = { ...latest, room: publicRoom(room) };
    Object.entries(all).forEach(([k, v]) => { sent[k] = JSON.stringify(v); });
    send({ t: 'state', full: true, s: all });
  };

  const handleHello = msg => {
    const key = publicOnly(msg.key);
    if (typeof msg.id !== 'string' || msg.id.length > 40 || !key) return;
    const known = identities[msg.id];
    if (known && !sameKey(known.key, key)) {
      send({ t: 'welcome', to: msg.id, ok: false, error: 'Ese jugador ya entró desde otro navegador.' });
      return;
    }
    const res = joinPlayer(room, { id: msg.id, name: msg.name });
    if (!res.ok) {
      send({ t: 'welcome', to: msg.id, ok: false, error: res.error });
      return;
    }
    if (!known) identities[msg.id] = { key, seq: 0 };
    // Presence decides who is connected; a hello counts for a few seconds until it arrives
    recentHello.set(msg.id, now());
    setRoom(setPresence(res.room, presentIds(), characterIds()));
    send({ t: 'welcome', to: msg.id, ok: true, hostId: room.hostId });
    sendFull();
  };

  const handleIntent = async msg => {
    const identity = identities[msg.id];
    if (!identity || !room.players[msg.id]) return;
    if (typeof msg.b !== 'string' || msg.b.length > MAX_INTENT_BYTES) return notice(msg.id, 'Mensaje demasiado largo.');
    if (!rateLimit.allow(msg.id)) return notice(msg.id, 'Vas muy rápido: espera unos segundos.');
    if (!(await verifyText(identity.key, msg.b, msg.s))) return;
    let body;
    try { body = JSON.parse(msg.b); } catch { return; }
    const seq = Number(body?.seq);
    if (!Number.isFinite(seq) || seq <= identity.seq) return; // a replay
    identity.seq = seq;
    const clean = sanitizeIntent(body);
    if (!clean.ok) return notice(msg.id, clean.error);
    apply(msg.id, clean.intent);
  };

  const apply = (playerId, intent) => {
    const res = applyIntent(room, getGame(), playerId, intent);
    if (!res.ok) {
      if (playerId === room.hostId) return res;
      notice(playerId, res.error);
      return res;
    }
    setRoom(res.room);
    schedule();
    if (res.combat) onCombat(res.combat.characterId, res.combat.action, playerId);
    return res;
  };

  let connectedIdsFromPresence = [];
  const recentHello = new Map();
  const presentIds = () => {
    const t = now();
    const fresh = [...recentHello].filter(([, at]) => t - at < helloGraceMs).map(([id]) => id);
    return [...new Set([...connectedIdsFromPresence, ...fresh])];
  };
  const offMessage = transport.onMessage(msg => {
    if (closed || !msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') handleHello(msg);
    else if (msg.t === 'sync' && room.players[msg.id]) sendFull();
    else if (msg.t === 'intent' && typeof msg.id === 'string') {
      const prev = chains.get(msg.id) || Promise.resolve();
      const next = prev.then(() => handleIntent(msg)).catch(err => console.error(err));
      chains.set(msg.id, next);
    }
  });
  const offPresence = transport.onPresence(ids => {
    connectedIdsFromPresence = ids;
    // Gone from the presence: no grace any more
    [...recentHello.keys()].forEach(id => { if (ids.includes(id)) recentHello.delete(id); });
    setRoom(setPresence(room, presentIds(), characterIds()));
    schedule();
  });

  return {
    get room() { return room; },
    get identities() { return identities; },
    /** The game changed: share it (at most every throttleMs, only what changed). */
    publish(sections) {
      latest = sections;
      schedule();
    },
    /** The host's own intents go through the same checks as everyone else's. */
    submit(intent) {
      const clean = sanitizeIntent(intent);
      if (!clean.ok) return clean;
      return apply(room.hostId, clean.intent);
    },
    /** A change to the room made by the host (assign, break a tie, remove a player...). */
    update(fn) {
      const next = fn(room);
      if (next && next !== room) {
        setRoom(next);
        schedule();
      }
      return room;
    },
    notice,
    /** Wait until the intents received so far are handled (tests). */
    async settle() {
      await Promise.all([...chains.values()]);
    },
    flushNow: flush,
    close() {
      if (closed) return;
      flush();
      closed = true;
      clearTimeout(timer);
      offMessage();
      offPresence();
      transport.close();
    }
  };
}

/**
 * A player's end. It enters the room, keeps the state the host shares and sends
 * signed intents.
 * @param identity { id, publicJwk, privateJwk } (security.js createIdentity)
 * @param onChange (state) => void with
 *   { status: 'joining' | 'joined' | 'rejected', error, hostId, hostOnline, view, notices }
 */
export function createGuestSession({ transport, identity, name, onChange = () => {}, helloRetryMs = HELLO_RETRY_MS }) {
  let state = { status: 'joining', error: null, hostId: null, hostOnline: false, view: {}, notices: [] };
  let lastSeq = 0;
  let closed = false;
  let gotFull = false;
  let present = [];

  const set = patch => {
    state = { ...state, ...patch };
    onChange(state);
  };
  const send = message => {
    if (!closed) {
      try { transport.send(message); } catch (err) { console.error(err); }
    }
  };
  const hello = () => send({ t: 'hello', id: identity.id, name, key: identity.publicJwk });
  const retry = setInterval(() => {
    if (state.status === 'joining') hello();
  }, helloRetryMs);
  const offStatus = transport.onStatus(status => {
    if (status === 'connected') hello();
    if (status === 'error' && state.status === 'joining') set({ error: 'No se pudo conectar con el servidor de salas. Reintentando…' });
  });

  const offMessage = transport.onMessage(msg => {
    if (closed || !msg || typeof msg !== 'object') return;
    // Only the host speaks to the players (a hostId learnt from the welcome)
    if (msg.t === 'welcome' && msg.to === identity.id) {
      if (msg.ok) set({ status: 'joined', error: null, hostId: msg.hostId, hostOnline: true });
      else if (state.status !== 'joined') set({ status: 'rejected', error: msg.error || 'No se pudo entrar en la sala.' });
    } else if (msg.t === 'state' && msg.s && typeof msg.s === 'object') {
      if (state.status !== 'joined') return;
      if (msg.full) gotFull = true;
      const view = { ...state.view, ...msg.s };
      set({ view });
      if (!gotFull) send({ t: 'sync', id: identity.id });
    } else if (msg.t === 'notice' && msg.to === identity.id && typeof msg.text === 'string') {
      set({ notices: [...state.notices, { text: msg.text.slice(0, 300), at: Date.now() }].slice(-5) });
    }
  });
  const offPresence = transport.onPresence(ids => {
    present = ids;
    const hostId = state.hostId || state.view.room?.hostId;
    if (!hostId) return;
    const online = ids.includes(hostId);
    if (online && !state.hostOnline && state.status === 'joined') {
      // The host is back (maybe it reloaded): say hello again and ask for everything
      gotFull = false;
      hello();
    }
    if (online !== state.hostOnline) set({ hostOnline: online });
  });

  return {
    get state() { return state; },
    get present() { return present; },
    /** Send an intent to the host, signed. */
    async send(intent) {
      if (closed || state.status !== 'joined') return false;
      lastSeq = Math.max(Date.now(), lastSeq + 1);
      const b = JSON.stringify({ ...intent, seq: lastSeq });
      const s = await signText(identity.privateJwk, b);
      send({ t: 'intent', id: identity.id, b, s });
      return true;
    },
    dismissNotice() { set({ notices: state.notices.slice(1) }); },
    close() {
      if (closed) return;
      closed = true;
      clearInterval(retry);
      offMessage();
      offPresence();
      offStatus();
      transport.close();
    }
  };
}

/** For the host's screen: "Ana se ha conectado" etc. (unused players keep their name) */
export const presenceLine = (room, id, connected) => `${connected ? '🟢' : '⚪'} ${playerName(room, id)} ${connected ? 'se ha conectado' : 'se ha desconectado'}.`;

export { roomToSave };
