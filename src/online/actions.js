// The actions a player can send from the sheet, the same for the host and the
// guests: built here as intents (protocol.js), described for the queue, and
// played by the host with its usual handlers.

import { getSkill } from '../utils/characterBuilder';
import { getSpell } from '../utils/spellcasting';

export const ABILITY_NAMES = { fue: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma' };

/** Intents for the sheet's buttons (characterId: who acts). */
export const sheetIntents = characterId => ({
  text: text => ({ type: 'act', characterId, kind: 'text', payload: { text } }),
  check: ({ ability = null, skillId = null }) => ({ type: 'act', characterId, kind: 'check', payload: { skillId: skillId || null, ability: skillId ? null : ability } }),
  attack: ({ optionId, target = '', targetAC = null, raging = false }) => ({ type: 'act', characterId, kind: 'attack', payload: { optionId, target, targetAC, raging } }),
  spell: (spellId, target = '') => ({ type: 'act', characterId, kind: 'spell', payload: { spellId, target } }),
  item: item => ({ type: 'act', characterId, kind: 'item', payload: { itemId: item.id } })
});

/** The name for the queue of a check, a spell or an item ("Percepción", "Proyectil mágico"...). */
export function labelFor(kind, payload, sheet) {
  if (kind === 'check') return payload.skillId ? getSkill(payload.skillId)?.name || '' : ABILITY_NAMES[payload.ability] || '';
  if (kind === 'spell') return getSpell(payload.spellId)?.name || '';
  if (kind === 'item') return (sheet?.inventory || []).find(i => i.id === payload.itemId)?.name || '';
  return '';
}
