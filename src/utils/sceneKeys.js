// Which Gemini keys Duncan uses for each scene.
//
// Today every scene uses the host's keys. Prepared for the next step: while the
// party is apart, each group (a "system" of its own, see splitParty.js) may call
// Duncan with the key of one of its players. The caller passes those keys in
// `keysByScene` ({ [groupId]: [{ key }, ...] }); a scene without keys of its own,
// or the party together, falls back to the host's.

/**
 * @param hostKeys    the host's stored keys ([{ key }] or strings)
 * @param sceneId     the group whose scene calls Duncan (null: the party together)
 * @param keysByScene keys of the players of each group (not used yet by the game)
 */
export function sceneApiKeys(hostKeys, { sceneId = null, keysByScene = null } = {}) {
  const own = sceneId ? keysByScene?.[sceneId] : null;
  return Array.isArray(own) && own.length ? own : hostKeys;
}
