// Which Gemini keys Duncan uses for each scene.
//
// Online, players may lend their key to the host (see online/keyLending.js):
//  - The party together: the keys lent by the players present join the host's in
//    one pool, rotated by quota as usual (geminiClient / gameEngine).
//  - The party apart (splitParty.js), each group a "system" of its own: a group's
//    scene uses the keys lent by its players (and the host's, if the host plays in
//    that group); a group whose players lent none uses the host's.
//    If a group's lent keys fail (quota spent, a bad key) after the short retry,
//    the host's keys take over so the player is never left waiting.
//  - Without lent keys, everything uses the host's, as always.
// More keys only add quota if they belong to different Google accounts.

const keyText = k => (typeof k === 'string' ? k : k?.key || '');

/** Keys without repeats or blanks, as [{ key }]. */
export function uniqueKeys(list) {
  const seen = new Set();
  const out = [];
  (list || []).forEach(k => {
    const key = keyText(k).trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(typeof k === 'string' ? { key } : k);
    }
  });
  return out;
}

/**
 * @param hostKeys    the host's stored keys ([{ key }] or strings)
 * @param sceneId     the group whose scene calls Duncan (null: the party together)
 * @param keysByScene keys of the players of each group apart ({ [groupId]: [{ key }] })
 * @param sharedKeys  keys lent by the players present, for the party together
 */
export function sceneApiKeys(hostKeys, { sceneId = null, keysByScene = null, sharedKeys = null } = {}) {
  if (!sceneId) return sharedKeys?.length ? uniqueKeys([...(hostKeys || []), ...sharedKeys]) : hostKeys;
  const own = keysByScene?.[sceneId];
  return Array.isArray(own) && own.length ? own : hostKeys;
}

/** A player's lent keys as [{ key, playerId }]. */
const keysOfPlayer = (lent, playerId) => [].concat(lent?.[playerId] || []).filter(Boolean).map(key => ({ key, playerId }));

/**
 * The lent keys of each group apart, from who plays its characters.
 * @param groups   [{ id, memberIds }] (splitParty.js groupsOf)
 * @param playerOf (characterId) => playerId who plays it (room.js controllerOf)
 * @param lent     { [playerId]: [key, ...] } the keys the host holds (several per player; a single key is fine too)
 * @param hostId   the host's player id (its own keys join a group it plays in)
 * @param hostKeys the host's keys
 * @returns { [groupId]: [{ key, playerId }] } (groups without lent keys left out)
 */
export function lentKeysByScene({ groups = [], playerOf = () => null, lent = {}, hostId = null, hostKeys = [] }) {
  const out = {};
  groups.forEach(group => {
    const players = [...new Set((group.memberIds || []).map(playerOf).filter(Boolean))];
    // Each player's keys, all of them: the scene rotates through them by quota
    const theirs = players.filter(p => p !== hostId).flatMap(p => keysOfPlayer(lent, p));
    if (!theirs.length) return;
    out[group.id] = uniqueKeys([...(players.includes(hostId) ? hostKeys : []), ...theirs]);
  });
  return out;
}

/** The keys lent by these players (for the party together, all of them), as [{ key, playerId }]. */
export const sharedLentKeys = (lent = {}, playerIds = Object.keys(lent)) => uniqueKeys(playerIds.flatMap(p => keysOfPlayer(lent, p)));

/**
 * The host's keys a scene may fall back on: the ones not in its pool already
 * (a group apart that only has its players' lent keys). Empty when nothing to add.
 */
export function fallbackKeys(pool, hostKeys) {
  const inPool = new Set((pool || []).map(k => keyText(k).trim()));
  return uniqueKeys(hostKeys).filter(k => !inPool.has(keyText(k).trim()));
}

/**
 * Ask Duncan with the scene's keys; if they could not answer (quota spent, a bad
 * key... after the short retry), ask again with the host's keys so the player is
 * never left waiting, and tell the scene (`onFallback`).
 * @param ask (keys) => Promise<response> (generateDMResponse with those keys)
 * @returns the reply with the host's keys when it worked, else the first one
 */
export async function askWithKeyFallback(ask, { keys, reserve = [], onFallback = () => {} }) {
  const first = await ask(keys);
  if (first?.source === 'gemini' || !first?.notice || !reserve.length) return first;
  onFallback(first);
  const second = await ask(reserve);
  return second?.source === 'gemini' ? second : first;
}
