// React hooks for the online room: the host's end (in TavernApp) and a player's
// end (GuestTable). The logic lives in session.js; these keep it in React state
// and in localStorage (so a reload, or coming back later, keeps the same room,
// the same seats and the same signing keys).

import { useEffect, useRef, useState, useCallback } from 'react';
import { connectTransport } from './transport';
import { createHostSession, createGuestSession } from './session';
import { createRoom, restoreRoom, roomToSave, newRoomCode, normalizeCode, cleanName } from './room';
import { createIdentity, randomId } from './security';
import { storedPlayerName } from './playerName';

const HOST_KEY = campaignId => `grifo_online_host:${campaignId}`;
const IDENTITY_KEY = (code, name) => `grifo_online_identity:${normalizeCode(code)}:${cleanName(name).toLocaleLowerCase('es')}`;

const read = key => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full: the room still works, it just won't be remembered */ }
};

// The name last used to play online (its own small module, re-exported here)
export { storedPlayerName, storePlayerName } from './playerName';

/** Whether this campaign was being played online when the page was left (to reopen it). */
export const wasOnline = campaignId => Boolean(campaignId && read(HOST_KEY(campaignId))?.active);

/**
 * The host's end of a room for one campaign.
 * @param getGame () => context for checking intents (see protocol.js applyIntent)
 * @param onCombat (characterId, action, playerId) => void
 * @param onDirect (direct, playerId) => void (see protocol.js applyIntent)
 */
export function useHostRoom({ campaignId, kind, getGame, onCombat, onDirect = () => {} }) {
  const [state, setState] = useState({ status: 'off', room: null, error: null });
  const sessionRef = useRef(null);
  const callbacks = useRef({ getGame, onCombat, onDirect });
  callbacks.current = { getGame, onCombat, onDirect };

  const save = useCallback((room, identities, active = true) => {
    if (!campaignId) return;
    write(HOST_KEY(campaignId), { room: roomToSave(room), identities, active });
  }, [campaignId]);

  // hostName: the name typed when opening it (null when it reopens by itself: the saved one is kept)
  const open = useCallback(async hostName => {
    if (!kind || !campaignId || sessionRef.current) return;
    setState(s => ({ ...s, status: 'opening', error: null }));
    const saved = read(HOST_KEY(campaignId));
    const restored = saved?.room ? restoreRoom(saved.room, { hostName }) : null;
    const room = restored || createRoom({ code: newRoomCode(), hostId: randomId('h'), hostName: hostName || storedPlayerName() || 'Anfitrión' });
    try {
      const transport = await connectTransport({ kind, code: room.code, selfId: room.hostId, meta: { role: 'host' } });
      const session = createHostSession({
        transport,
        room,
        identities: saved?.identities || {},
        getGame: () => callbacks.current.getGame(),
        onCombat: (...args) => callbacks.current.onCombat(...args),
        onDirect: (...args) => callbacks.current.onDirect(...args),
        onChange: (next, identities) => {
          setState(s => ({ ...s, room: next }));
          save(next, identities);
        }
      });
      sessionRef.current = session;
      save(room, session.identities);
      setState({ status: 'open', room: session.room, error: null });
    } catch (err) {
      console.error(err);
      setState({ status: 'error', room: null, error: err?.message || 'No se pudo abrir la sala.' });
    }
  }, [kind, campaignId, save]);

  const close = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    save(session.room, session.identities, false);
    sessionRef.current = null;
    session.close();
    setState({ status: 'off', room: null, error: null });
  }, [save]);

  // Leaving the campaign closes the room (it can be reopened with the same code)
  useEffect(() => () => {
    const session = sessionRef.current;
    if (session) {
      sessionRef.current = null;
      session.close();
    }
  }, [campaignId]);

  return {
    ...state,
    open,
    close,
    publish: useCallback(sections => sessionRef.current?.publish(sections), []),
    submit: useCallback(intent => sessionRef.current?.submit(intent) || { ok: false, error: 'La sala está cerrada.' }, []),
    update: useCallback(fn => sessionRef.current?.update(fn), []),
    notice: useCallback((to, text) => sessionRef.current?.notice(to, text), [])
  };
}

/** The identity of this browser for a room and a name (made the first time). */
async function identityFor(code, name) {
  const saved = read(IDENTITY_KEY(code, name));
  if (saved?.id && saved.publicJwk && saved.privateJwk) return saved;
  const identity = await createIdentity();
  write(IDENTITY_KEY(code, name), identity);
  return identity;
}

/** A player's end: enter the room `code` as `name`. */
export function useGuestRoom({ code, name, kind }) {
  const [state, setState] = useState({ status: 'connecting', error: null, hostId: null, hostOnline: false, view: {}, notices: [] });
  const [playerId, setPlayerId] = useState(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let session = null;
    (async () => {
      try {
        const identity = await identityFor(code, name);
        if (cancelled) return;
        setPlayerId(identity.id);
        const transport = await connectTransport({ kind, code: normalizeCode(code), selfId: identity.id, meta: { role: 'player', name } });
        if (cancelled) {
          transport.close();
          return;
        }
        session = createGuestSession({ transport, identity, name, onChange: next => setState(next) });
        sessionRef.current = session;
        setState(session.state);
      } catch (err) {
        console.error(err);
        if (!cancelled) setState(s => ({ ...s, status: 'rejected', error: err?.message || 'No se pudo conectar con la sala.' }));
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current = null;
      session?.close();
    };
  }, [code, name, kind]);

  return {
    ...state,
    playerId,
    send: useCallback(intent => sessionRef.current?.send(intent), []),
    dismissNotice: useCallback(() => sessionRef.current?.dismissNotice(), [])
  };
}
