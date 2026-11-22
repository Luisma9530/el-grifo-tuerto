// Basic safety for the online room.
//
// - The Gemini keys never leave this browser: every message goes through
//   `assertNoSecrets` before the transport sends it (the game state the host
//   shares never holds them anyway, see snapshot.js; this is the safety net).
// - Players sign what they send: each browser keeps an ECDSA key pair per room
//   and name. The host learns the public key when the player first enters and
//   checks every intent with it, so nobody else in the channel can act for that
//   player (the channel is open to whoever knows the room code). A counter that
//   only goes up stops replays.
// - A simple rate limit per player keeps a flood from reaching the game (and the
//   realtime service's message quota).

import { getStoredGeminiKeys } from '../utils/gameEngine';

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };

const subtle = () => globalThis.crypto?.subtle || null;

const toBase64 = buffer => {
  const bytes = new Uint8Array(buffer);
  let text = '';
  bytes.forEach(b => { text += String.fromCharCode(b); });
  return btoa(text);
};
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

/** A random id for a player ("p_" + 16 hex characters). */
export function randomId(prefix = 'p') {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** A new signing identity: { id, publicJwk, privateJwk } (plain data, can be stored). */
export async function createIdentity(prefix = 'p') {
  const pair = await subtle().generateKey(ALGO, true, ['sign', 'verify']);
  const [publicJwk, privateJwk] = await Promise.all([
    subtle().exportKey('jwk', pair.publicKey),
    subtle().exportKey('jwk', pair.privateKey)
  ]);
  return { id: randomId(prefix), publicJwk: publicOnly(publicJwk), privateJwk };
}

/** Only the fields of a public EC key (whatever else arrives is dropped). */
export function publicOnly(jwk) {
  if (!jwk || typeof jwk !== 'object' || jwk.kty !== 'EC' || jwk.crv !== 'P-256') return null;
  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string' || jwk.x.length > 64 || jwk.y.length > 64) return null;
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
}

export const sameKey = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y);

/** Sign a text with the private key of an identity → base64 signature. */
export async function signText(privateJwk, text) {
  const key = await subtle().importKey('jwk', privateJwk, ALGO, false, ['sign']);
  const sig = await subtle().sign(SIGN, key, new TextEncoder().encode(text));
  return toBase64(sig);
}

/** Check a signature made by `signText`. Never throws: anything odd is false. */
export async function verifyText(publicJwk, text, signature) {
  try {
    const jwk = publicOnly(publicJwk);
    if (!jwk || typeof text !== 'string' || typeof signature !== 'string') return false;
    const key = await subtle().importKey('jwk', jwk, ALGO, false, ['verify']);
    return await subtle().verify(SIGN, key, fromBase64(signature), new TextEncoder().encode(text));
  } catch {
    return false;
  }
}

/**
 * Does this text contain one of the Gemini keys stored in this browser?
 * (`keys` can be given for tests; by default the stored ones are read)
 */
export function containsSecret(text, keys = null) {
  const list = (keys || getStoredGeminiKeys().map(k => k.key)).filter(k => typeof k === 'string' && k.trim().length > 10);
  return list.some(k => text.includes(k.trim()));
}

/**
 * Serialise a message for the network, refusing it if it carries a Gemini key.
 * @returns {string} the JSON text
 * @throws when a key would leave the browser
 */
export function assertNoSecrets(message, keys = null) {
  const text = JSON.stringify(message);
  if (containsSecret(text, keys)) throw new Error('Bloqueado: el mensaje contenía una clave de Gemini.');
  return text;
}

/** At most `max` messages per player in any `windowMs` window. */
export function createRateLimiter({ max = 8, windowMs = 5000 } = {}) {
  const seen = new Map();
  return {
    allow(id, now = Date.now()) {
      const recent = (seen.get(id) || []).filter(t => now - t < windowMs);
      if (recent.length >= max) {
        seen.set(id, recent);
        return false;
      }
      recent.push(now);
      seen.set(id, recent);
      return true;
    },
    forget(id) { seen.delete(id); }
  };
}
