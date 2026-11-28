// Lending a Gemini key to the host for the session.
//
// A player with a Gemini key of their own may lend it to the host, so Duncan has
// more quota (see sceneKeys.js for which scene uses which key). The channel of a
// room is a broadcast that everyone with the code hears, so the key never goes in
// clear: it is encrypted for the host alone.
//
//  - The host makes an ECDH key pair when the room opens (only in memory, the
//    private half can't even be exported) and shares the public half in the
//    `lending` section of the state, signed with its own signing key (kept with
//    the room, see useOnlineRoom.js). A player trusts the first signing key seen
//    (or the one in the link, `&h=`), so nobody else in the channel can pass for
//    the host and receive the key.
//  - The player encrypts the key with an ephemeral ECDH pair + AES-GCM, bound to
//    the room and to the player (so nobody can resend it as their own), and sends
//    it in a signed intent like any other.
//  - The host keeps the keys only in memory (a Map in the session: never in the
//    room, the campaign or localStorage) and drops them when the player leaves the
//    room, withdraws it, is removed or the room closes. While a key is held, the
//    transport refuses any message that contains it (security.js rememberSecret).

import { publicOnly, signText, verifyText, rememberSecret, forgetSecret } from './security';

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const AES = { name: 'AES-GCM', length: 256 };
const subtle = () => globalThis.crypto?.subtle || null;

const toBase64 = buffer => {
  const bytes = new Uint8Array(buffer);
  let text = '';
  bytes.forEach(b => { text += String.fromCharCode(b); });
  return btoa(text);
};
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Largest encrypted key accepted (base64 characters). */
export const MAX_SEALED_CT = 200;

/** A Gemini API key looks like this: the classic ones are 39 characters ("AIza…"); the
 * newer ones are longer and carry a dot ("AQ.…"). */
export const isPlausibleGeminiKey = text => typeof text === 'string' && /^[A-Za-z0-9_.-]{30,100}$/.test(text.trim());

const purpose = (code, playerId) => new TextEncoder().encode(`grifo-tuerto:prestamo:${code}:${playerId}`);
const keyText = jwk => JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });

/** Short fingerprint of a public signing key (for the link: `&h=`). */
export async function keyPrint(jwk) {
  const key = publicOnly(jwk);
  if (!key) return '';
  const hash = await subtle().digest('SHA-256', new TextEncoder().encode(`${key.x}.${key.y}`));
  return toBase64(hash).replace(/\+/g, '-').replace(/\//g, '_').slice(0, 16);
}

/**
 * The host's half: an ECDH pair (private half not extractable) and the public
 * half signed with the host's signing key.
 * @param signer { publicJwk, privateJwk } (security.js createIdentity)
 * @returns {Promise<{ privateKey: CryptoKey, offer: { hostKey, signKey, sig } }>}
 */
export async function createLendingOffer(signer) {
  const pair = await subtle().generateKey(ECDH, false, ['deriveKey']);
  const hostKey = publicOnly(await subtle().exportKey('jwk', pair.publicKey));
  const sig = await signText(signer.privateJwk, keyText(hostKey));
  return { privateKey: pair.privateKey, offer: { hostKey, signKey: publicOnly(signer.publicJwk), sig } };
}

/**
 * A player checks the host's offer: signed by the expected signing key.
 * @param pinned the signing key trusted so far (null: the first one seen)
 * @param print  the fingerprint from the link, if any
 * @returns {Promise<{ hostKey, signKey } | null>}
 */
export async function verifyLendingOffer(offer, { pinned = null, print = '' } = {}) {
  const hostKey = publicOnly(offer?.hostKey);
  const signKey = publicOnly(offer?.signKey);
  if (!hostKey || !signKey || typeof offer.sig !== 'string') return null;
  if (pinned && (pinned.x !== signKey.x || pinned.y !== signKey.y)) return null;
  if (!pinned && print && (await keyPrint(signKey)) !== print) return null;
  if (!(await verifyText(signKey, keyText(hostKey), offer.sig))) return null;
  return { hostKey, signKey };
}

/**
 * Encrypt a Gemini key for the host alone.
 * @returns {Promise<{ epk, iv, ct }>} (no trace of the key in clear)
 */
export async function sealKey(hostKey, geminiKey, { code, playerId }) {
  const pub = await subtle().importKey('jwk', publicOnly(hostKey), ECDH, false, []);
  const eph = await subtle().generateKey(ECDH, true, ['deriveKey']);
  const aes = await subtle().deriveKey({ name: 'ECDH', public: pub }, eph.privateKey, AES, false, ['encrypt']);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: purpose(code, playerId) }, aes, new TextEncoder().encode(geminiKey.trim()));
  return { epk: publicOnly(await subtle().exportKey('jwk', eph.publicKey)), iv: toBase64(iv), ct: toBase64(ct) };
}

/** Only the fields of a sealed key, with the right sizes (null otherwise). */
export function cleanSealed(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const epk = publicOnly(raw.epk);
  const { iv, ct } = raw;
  if (!epk || typeof iv !== 'string' || typeof ct !== 'string' || iv.length > 24 || ct.length > MAX_SEALED_CT || !B64.test(iv) || !B64.test(ct)) return null;
  return { epk, iv, ct };
}

/** The host opens a sealed key. Never throws: anything odd (or not a Gemini key) is null. */
export async function openSealedKey(privateKey, sealed, { code, playerId }) {
  try {
    const clean = cleanSealed(sealed);
    if (!clean) return null;
    const epk = await subtle().importKey('jwk', clean.epk, ECDH, false, []);
    const aes = await subtle().deriveKey({ name: 'ECDH', public: epk }, privateKey, AES, false, ['decrypt']);
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(clean.iv), additionalData: purpose(code, playerId) }, aes, fromBase64(clean.ct));
    const key = new TextDecoder().decode(plain).trim();
    return isPlausibleGeminiKey(key) ? key : null;
  } catch {
    return null;
  }
}

/** Most keys one player may lend (one per Google account is what adds quota). */
export const MAX_LENT_PER_PLAYER = 5;

/** A slot: the name a player gives to each key they lend (random, says nothing of the key). */
export const isSlotId = value => typeof value === 'string' && /^[\w-]{4,24}$/.test(value);

/**
 * Where the host keeps the lent keys: memory only, several per player, each in a
 * slot named by the player (so they can take back one without the key travelling).
 * Each key held is also a secret the transport refuses to send.
 */
export function createKeyVault({ maxPerPlayer = MAX_LENT_PER_PLAYER } = {}) {
  const keys = new Map(); // playerId -> Map(slot -> key)
  const held = () => [...keys.values()].flatMap(m => [...m.values()]);
  const release = key => {
    if (!held().includes(key)) forgetSecret(key);
  };
  const dropSlot = (id, slot) => {
    const mine = keys.get(id);
    const key = mine?.get(slot);
    if (key === undefined) return false;
    mine.delete(slot);
    if (!mine.size) keys.delete(id);
    release(key);
    return true;
  };
  const drop = id => {
    const mine = keys.get(id);
    if (!mine) return false;
    keys.delete(id);
    [...mine.values()].forEach(release);
    return true;
  };
  return {
    /**
     * Keep a key in a player's slot.
     * @returns 'added' | 'same' (already there) | 'full' (too many keys)
     */
    put(id, slot, key) {
      const mine = keys.get(id) || new Map();
      if (mine.get(slot) === key) return 'same';
      // The same key in another slot of this player: one is enough
      if ([...mine.entries()].some(([s, k]) => s !== slot && k === key)) return 'same';
      if (!mine.has(slot) && mine.size >= maxPerPlayer) return 'full';
      if (mine.has(slot)) dropSlot(id, slot);
      const fresh = keys.get(id) || mine;
      fresh.set(slot, key);
      keys.set(id, fresh);
      rememberSecret(key);
      return 'added';
    },
    /** Take back one slot, or all of the player's keys without a slot. @returns whether any went */
    drop: (id, slot = null) => (slot ? dropSlot(id, slot) : drop(id)),
    /** Keep only the keys of these players (the ones still in the room). @returns whether any went */
    keepOnly(ids) {
      const keep = new Set(ids);
      return [...keys.keys()].filter(id => !keep.has(id)).map(drop).some(Boolean);
    },
    clear() { [...keys.keys()].forEach(drop); },
    has: id => keys.has(id),
    lenders: () => [...keys.keys()].sort(),
    /** { [playerId]: [slot, ...] } who lent what (no keys: it can be shared) */
    slots: () => Object.fromEntries([...keys.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, m]) => [id, [...m.keys()]])),
    /** { [playerId]: [key, ...] } (a copy) */
    all: () => Object.fromEntries([...keys.entries()].map(([id, m]) => [id, [...m.values()]]))
  };
}
