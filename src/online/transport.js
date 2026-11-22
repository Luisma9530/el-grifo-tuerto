// The network layer of the online room, interchangeable:
//  - 'supabase': Supabase Realtime (Broadcast for messages, Presence for who is
//    connected). Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. No tables.
//  - 'local': BroadcastChannel between tabs of the same browser, with a small
//    heartbeat for presence. For testing without Supabase (add ?transporte=local
//    to the address).
//
// Both give the same object:
//   { send(message), onMessage(cb), onPresence(cb), onStatus(cb), close() }
// onPresence gets the ids connected now (this one included); onStatus gets
// 'connecting' | 'connected' | 'error' | 'closed'. Every message is checked by
// assertNoSecrets before it leaves (no Gemini key can be sent).

import { assertNoSecrets } from './security';

/** Largest message accepted from the network (characters). */
export const MAX_MESSAGE_CHARS = 250_000;
const CHANNEL_PREFIX = 'grifo-tuerto';

/**
 * Which transport this page can use.
 * @returns {{ kind: 'supabase' | 'local' | null }}
 */
export function onlineConfig(env = import.meta.env, search = typeof window !== 'undefined' ? window.location.search : '') {
  const params = new URLSearchParams(search || '');
  if (params.get('transporte') === 'local') return { kind: 'local' };
  if (env?.VITE_SUPABASE_URL && env?.VITE_SUPABASE_ANON_KEY) return { kind: 'supabase' };
  return { kind: null };
}

/** The link to share: this page with the room code (and the local transport if it is the one in use). */
export function roomLink(code, kind, origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '') {
  return `${origin}?sala=${encodeURIComponent(code)}${kind === 'local' ? '&transporte=local' : ''}`;
}

/** Shared listeners and the safety checks of both transports. */
function makeHub() {
  const listeners = { message: new Set(), presence: new Set(), status: new Set() };
  const on = kind => cb => {
    listeners[kind].add(cb);
    return () => listeners[kind].delete(cb);
  };
  return {
    onMessage: on('message'),
    onPresence: on('presence'),
    onStatus: on('status'),
    emit(kind, value) {
      listeners[kind].forEach(cb => {
        try { cb(value); } catch (err) { console.error(err); }
      });
    },
    // Parse a message from the network: too big or not JSON → ignored
    receive(text) {
      if (typeof text !== 'string' || text.length > MAX_MESSAGE_CHARS) return;
      let message;
      try { message = JSON.parse(text); } catch { return; }
      if (message && typeof message === 'object') this.emit('message', message);
    }
  };
}

/**
 * Tabs of the same browser. `makeChannel` and the timers can be given for tests.
 */
export function createLocalTransport({
  code, selfId, meta = {},
  makeChannel = name => new BroadcastChannel(name),
  heartbeatMs = 1500, expireMs = 5000,
  now = () => Date.now()
}) {
  const hub = makeHub();
  const channel = makeChannel(`${CHANNEL_PREFIX}:${code}`);
  const seen = new Map(); // id -> last heartbeat
  let last = '';
  let closed = false;

  const emitPresence = () => {
    const ids = [selfId, ...[...seen.keys()].filter(id => id !== selfId)].sort();
    const key = ids.join(',');
    if (key === last) return;
    last = key;
    hub.emit('presence', ids);
  };
  const post = data => {
    if (!closed) channel.postMessage(data);
  };
  const beat = () => post({ k: 'here', id: selfId, meta });

  channel.onmessage = event => {
    const data = event?.data;
    if (!data || typeof data !== 'object') return;
    if (data.k === 'msg') hub.receive(data.d);
    else if (data.k === 'here' && typeof data.id === 'string') {
      const isNew = !seen.has(data.id);
      seen.set(data.id, now());
      if (isNew) emitPresence();
    } else if (data.k === 'who') beat();
    else if (data.k === 'bye' && typeof data.id === 'string') {
      seen.delete(data.id);
      emitPresence();
    }
  };

  const sweep = () => {
    const t = now();
    let changed = false;
    seen.forEach((at, id) => {
      if (t - at > expireMs) {
        seen.delete(id);
        changed = true;
      }
    });
    if (changed) emitPresence();
    beat();
  };
  const timer = setInterval(sweep, heartbeatMs);
  const onLeave = () => post({ k: 'bye', id: selfId });
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onLeave);

  // Say hello and ask who is there
  queueMicrotask(() => {
    hub.emit('status', 'connected');
    emitPresence();
    beat();
    post({ k: 'who' });
  });

  return {
    kind: 'local',
    onMessage: hub.onMessage,
    onPresence: hub.onPresence,
    onStatus: hub.onStatus,
    send(message) {
      post({ k: 'msg', d: assertNoSecrets(message) });
    },
    // Tests: forget the others' heartbeats as if time went by
    sweep,
    close() {
      if (closed) return;
      onLeave();
      closed = true;
      clearInterval(timer);
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onLeave);
      channel.close?.();
      hub.emit('status', 'closed');
    }
  };
}

/**
 * Supabase Realtime: one channel per room, Broadcast + Presence, no database.
 * The library is loaded only when a room is opened.
 */
export async function createSupabaseTransport({ code, selfId, meta = {}, url, anonKey }) {
  const hub = makeHub();
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Client-side cap, well under the free plan's limits
    realtime: { params: { eventsPerSecond: 8 } }
  });
  const channel = client.channel(`${CHANNEL_PREFIX}:${code}`, {
    config: { broadcast: { self: false, ack: false }, presence: { key: selfId } }
  });
  channel.on('broadcast', { event: 'msg' }, ({ payload }) => hub.receive(payload?.d));
  channel.on('presence', { event: 'sync' }, () => {
    const ids = Object.keys(channel.presenceState() || {});
    hub.emit('presence', ids.includes(selfId) ? ids : [selfId, ...ids]);
  });
  hub.emit('status', 'connecting');
  channel.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      await channel.track(meta);
      hub.emit('status', 'connected');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      hub.emit('status', 'error');
    } else if (status === 'CLOSED') {
      hub.emit('status', 'closed');
    }
  });
  let closed = false;
  return {
    kind: 'supabase',
    onMessage: hub.onMessage,
    onPresence: hub.onPresence,
    onStatus: hub.onStatus,
    send(message) {
      if (closed) return;
      const d = assertNoSecrets(message);
      channel.send({ type: 'broadcast', event: 'msg', payload: { d } }).catch?.(err => console.error(err));
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        await channel.untrack();
      } catch { /* already gone */ }
      await client.removeChannel(channel);
      hub.emit('status', 'closed');
    }
  };
}

/** Open the transport of the given kind for a room. */
export async function connectTransport({ kind, code, selfId, meta }) {
  if (kind === 'local') return createLocalTransport({ code, selfId, meta });
  if (kind === 'supabase') {
    return createSupabaseTransport({
      code, selfId, meta,
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
    });
  }
  throw new Error('El juego online no está configurado en este sitio.');
}
