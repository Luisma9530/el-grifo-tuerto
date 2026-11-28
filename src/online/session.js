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
//
// A player may lend their Gemini key to the host (intent 'lend'): it travels
// encrypted for the host alone and the host keeps it only in memory (see
// keyLending.js). The state carries a `lending` section with the host's public
// key and who has lent one, never the keys.

import { joinPlayer, setPresence, roomToSave, playerName } from './room';
import { sanitizeIntent, applyIntent, MAX_INTENT_BYTES } from './protocol';
import { publicOnly, sameKey, verifyText, signText, createRateLimiter, randomId } from './security';
import { changedSections, publicRoom } from './snapshot';
import { createLendingOffer, verifyLendingOffer, sealKey, openSealedKey, createKeyVault, isPlausibleGeminiKey, keyPrint, MAX_LENT_PER_PLAYER } from './keyLending';
import { rememberSecret, forgetSecret } from './security';

export const STATE_THROTTLE_MS = 300;
export const HELLO_RETRY_MS = 2000;

/**
 * The host's end. It owns the room, checks what arrives and shares the state.
 * @param transport see transport.js
 * @param room the room (room.js); identities: { [playerId]: { key, seq } } kept from earlier sessions
 * @param getGame () => game context for applyIntent (see protocol.js)
 * @param onCombat (characterId, action, playerId) => void: a combat action to play now
 * @param onDirect (direct, playerId) => void: equipment or level up of the player's own character
 * @param onChange (room, identities) => void: the room changed (to render and save it)
 * @param signer { publicJwk, privateJwk } the host's signing key (to offer key lending; without it, no lending)
 * @param onLending (lenderIds, counts) => void: who has lent keys (and how many each) changed
 */
export function createHostSession({
  transport, room: initialRoom, identities: savedIdentities = {}, getGame, onCombat = () => {}, onDirect = () => {}, onChange = () => {},
  signer = null, onLending = () => {},
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
  // Lent keys: only here, in memory (see keyLending.js)
  const vault = createKeyVault();
  let lendingOffer = null; // { privateKey, offer } once made
  // (who lent and the name of each slot: never the keys)
  const lendingSection = () => (lendingOffer ? { ...lendingOffer.offer, lenders: vault.lenders(), slots: vault.slots() } : null);
  const lendingChanged = () => {
    onLending(vault.lenders(), Object.fromEntries(Object.entries(vault.slots()).map(([id, list]) => [id, list.length])));
    schedule();
  };
  // A player gone from the room (left, removed, disconnected) takes their keys with them
  const dropAbsentLenders = () => {
    const stay = Object.keys(room.players).filter(id => room.players[id]?.connected);
    if (vault.keepOnly(stay)) lendingChanged();
  };

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
    const changed = changedSections({ ...latest, room: publicRoom(room), lending: lendingSection() }, sent);
    if (changed) send({ t: 'state', s: changed });
  };
  const schedule = () => {
    if (!timer && !closed) timer = setTimeout(flush, throttleMs);
  };
  const sendFull = () => {
    if (!latest) return;
    const all = { ...latest, room: publicRoom(room), lending: lendingSection() };
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
    if (clean.intent.type === 'lend') return handleLend(msg.id, clean.intent.sealed, clean.intent.slot);
    if (clean.intent.type === 'unlend') {
      if (vault.drop(msg.id, clean.intent.slot)) lendingChanged();
      return;
    }
    apply(msg.id, clean.intent);
  };

  // A Gemini key lent by a player: opened here and kept only in memory
  const handleLend = async (playerId, sealed, slot) => {
    if (playerId === room.hostId || !room.players[playerId]?.connected) return;
    if (!lendingOffer) return notice(playerId, 'El anfitrión aún no puede recibir claves: inténtalo en unos segundos.');
    const key = await openSealedKey(lendingOffer.privateKey, sealed, { code: room.code, playerId });
    if (closed) return;
    if (!key) return notice(playerId, 'La clave no llegó bien o no parece una clave de Gemini.');
    if (!room.players[playerId]?.connected) return;
    const put = vault.put(playerId, slot, key);
    if (put === 'added') lendingChanged();
    else if (put === 'full') notice(playerId, `Ya has prestado ${MAX_LENT_PER_PLAYER} claves: retira una para prestar otra.`);
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
    if (res.direct) onDirect(res.direct, playerId);
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
    dropAbsentLenders();
    schedule();
  });

  if (signer) {
    createLendingOffer(signer).then(made => {
      if (closed) return;
      lendingOffer = made;
      schedule();
    }).catch(err => console.error(err));
  }

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
        dropAbsentLenders();
        schedule();
      }
      return room;
    },
    /** The keys lent by the players now in the room: { [playerId]: key } (memory only). */
    lentKeys: () => vault.all(),
    /** Who has lent a key (ids). */
    get lenders() { return vault.lenders(); },
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
      vault.clear();
      lendingOffer = null;
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
 * @param code the room code (lent keys are bound to it)
 * @param hostPrint fingerprint of the host's signing key from the link (`&h=`), if any
 * @param onChange (state) => void with
 *   { status: 'joining' | 'joined' | 'rejected', error, hostId, hostOnline, view, notices,
 *     lending: { ready, lent, sending } }   ready: the host can receive a key; lent: the host holds mine
 */
export function createGuestSession({ transport, identity, name, code = '', hostPrint = '', onChange = () => {}, helloRetryMs = HELLO_RETRY_MS }) {
  let state = { status: 'joining', error: null, hostId: null, hostOnline: false, view: {}, notices: [], lending: { ready: false, lent: 0, sending: false, mine: [] } };
  let lastSeq = 0;
  let closed = false;
  let gotFull = false;
  let present = [];
  // Lending (keyLending.js): the host's signing key trusted, its verified ECDH key,
  // and the keys this player chose to lend, each in a slot (only in memory, to lend
  // them again if the host reloads)
  let pinned = null;
  let hostKey = null;
  let lent = []; // [{ slot, label, key }]
  let slotCount = 0;
  // What the screen may show: the slots and their labels, never the keys
  const mineFrom = confirmed => lent.map(({ slot, label }) => ({ slot, label, confirmed: confirmed.includes(slot) }));
  const confirmedSlots = view => (hostKey ? view?.lending?.slots?.[identity.id] || [] : []);
  const lendingState = (patch = {}, view = state.view) => {
    const confirmed = confirmedSlots(view);
    return { ...state.lending, mine: mineFrom(confirmed), lent: confirmed.length, ...patch };
  };
  let checking = Promise.resolve();

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
      set({ view, lending: lendingState({}, view) });
      if (!gotFull) send({ t: 'sync', id: identity.id });
      if ('lending' in msg.s) checking = checking.then(() => checkOffer(msg.s.lending)).catch(err => console.error(err));
    } else if (msg.t === 'notice' && msg.to === identity.id && typeof msg.text === 'string') {
      set({ notices: [...state.notices, { text: msg.text.slice(0, 300), at: Date.now() }].slice(-5) });
    }
  });
  // The host's offer to receive keys: only from the host's signing key
  const checkOffer = async offer => {
    if (closed) return;
    if (!offer) {
      hostKey = null;
      set({ lending: lendingState({ ready: false }) });
      return;
    }
    const ok = await verifyLendingOffer(offer, { pinned, print: hostPrint });
    if (closed) return;
    // Not signed by the host we trust: ignored (nothing is ever lent to it)
    if (!ok) return;
    if (!pinned) set({ lending: { ...state.lending, print: await keyPrint(ok.signKey) } });
    pinned = ok.signKey;
    const renewed = !hostKey || hostKey.x !== ok.hostKey.x || hostKey.y !== ok.hostKey.y;
    hostKey = ok.hostKey;
    set({ lending: lendingState({ ready: true }) });
    // The host came back with a new room session: lend them again (the player had chosen to)
    const held = offer.slots?.[identity.id] || [];
    if (renewed) {
      for (const item of lent.filter(l => !held.includes(l.slot))) await sendKey(item);
    }
  };
  const sendKey = async ({ slot, key }) => {
    set({ lending: { ...state.lending, sending: true } });
    try {
      const sealed = await sealKey(hostKey, key, { code, playerId: identity.id });
      return await signedSend({ type: 'lend', sealed, slot });
    } finally {
      set({ lending: { ...state.lending, sending: false } });
    }
  };
  const newSlot = () => `k${++slotCount}-${randomId('s').slice(2, 10)}`;
  const signedSend = async intent => {
    if (closed || state.status !== 'joined') return false;
    lastSeq = Math.max(Date.now(), lastSeq + 1);
    const b = JSON.stringify({ ...intent, seq: lastSeq });
    const s = await signText(identity.privateJwk, b);
    send({ t: 'intent', id: identity.id, b, s });
    return true;
  };

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
    send: intent => signedSend(intent),
    /**
     * Lend one more Gemini key to the host for this session (encrypted for the host alone).
     * @param label how this player calls it on their screen (never sent)
     * @returns {Promise<{ ok: boolean, error?: string, slot?: string }>}
     */
    async lendKey(key, label = '') {
      if (!isPlausibleGeminiKey(key)) return { ok: false, error: 'Eso no parece una clave de Gemini.' };
      await checking;
      if (!hostKey) return { ok: false, error: 'El anfitrión aún no puede recibir claves.' };
      const clean = key.trim();
      if (lent.some(l => l.key === clean)) return { ok: false, error: 'Esa clave ya la has prestado.' };
      if (lent.length >= MAX_LENT_PER_PLAYER) return { ok: false, error: `Como mucho ${MAX_LENT_PER_PLAYER} claves por jugador.` };
      const item = { slot: newSlot(), label: String(label || `Clave ${lent.length + 1}`).slice(0, 40), key: clean };
      rememberSecret(clean);
      lent = [...lent, item];
      set({ lending: lendingState() });
      const sent = await sendKey(item);
      return sent ? { ok: true, slot: item.slot } : { ok: false, error: 'No estás en la sala.' };
    },
    /** Take back one key (its slot), or all of them without a slot: the host forgets them. */
    async withdrawKey(slot = null) {
      const going = slot ? lent.filter(l => l.slot === slot) : lent;
      going.forEach(l => forgetSecret(l.key));
      lent = lent.filter(l => !going.includes(l));
      set({ lending: lendingState() });
      return signedSend(slot ? { type: 'unlend', slot } : { type: 'unlend' });
    },
    dismissNotice() { set({ notices: state.notices.slice(1) }); },
    close() {
      if (closed) return;
      closed = true;
      lent.forEach(l => forgetSecret(l.key));
      lent = [];
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
