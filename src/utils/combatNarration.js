// Narration around fights resolved by the game: how the local engine starts a
// fight and closes it, and the few key moments of a fight that Duncan (the AI)
// narrates in a couple of lines. Everything here works from results the game
// already computed: the AI never decides what happens in combat.

import { requestGemini } from './geminiClient';

/** Words that mean the hero starts (or provokes) a fight. */
const AGGRESSIVE = /\b(atac|golpe|pele|lucha|mata|asesin|desenvain|carg|embist|apuñal|dispar|emboscad|combat|enfrent)/;
export const isAggressive = actionLower => AGGRESSIVE.test(actionLower || '');

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

/**
 * Local engine: start a fight with creatures of the candidate list, sized to an
 * easy encounter (the hero plays alone).
 * @returns {{ text, suggestedActions, combat: { enemigos } }}
 */
export function startLocalFight(bestiary, { character, rng = Math.random }) {
  const budget = bestiary.budget.low;
  const usable = bestiary.creatures.filter(c => c.xp <= budget);
  const pool = usable.length ? usable : [...bestiary.creatures].sort((a, b) => a.xp - b.xp).slice(0, 1);
  const fitting = pool.filter(c => c.xp >= budget / 4);
  const foe = pick(fitting.length ? fitting : pool, rng);
  const count = Math.max(1, Math.min(4, Math.floor(budget / Math.max(1, foe.xp))));
  const many = count > 1;
  const name = character.name || 'Aventurero';
  const text = `Duncan deja la jarra en el mostrador con un golpe seco.

—*Pues ya está, ${name}: has encontrado pelea.* ${many ? `**${count} × ${foe.name}**` : `**${foe.name}**`} ${many ? 'salen' : 'sale'} a tu encuentro y no hay tiempo para palabras. Las armas, fuera.`;
  return {
    text,
    suggestedActions: [],
    combat: { enemigos: [{ id: foe.id, cantidad: count }] }
  };
}

/**
 * Local engine: close a fight the game already resolved. Some loot if the hero
 * won; XP was applied by the encounter itself.
 * @param {string} result  describeEncounterResult(...) text
 */
export function narrateCombatEnd(result, { character, rng = Math.random }) {
  const name = character.name || 'Aventurero';
  const won = /gana el combate/.test(result);
  const fled = /huye del combate/.test(result);
  const goldEarned = won ? 1 + Math.floor(rng() * (4 + 2 * (character.level || 1))) : 0;
  let text;
  if (won) {
    text = `Se hace el silencio. ${name} recupera el aliento entre los restos de la pelea.

—*Bien hecho. Registra a los caídos antes de que llegue alguien más.* Entre sus cosas encuentras **${goldEarned} monedas de oro**.`;
  } else if (fled) {
    text = `${name} corre hasta que los gritos quedan atrás y por fin puede apoyarse contra una pared.

—*Retirarse a tiempo también es de sabios. Ahora, ¿qué vas a hacer?*`;
  } else {
    text = `Todo se vuelve negro. Cuando ${name} abre los ojos, la pelea ha terminado hace rato.

—*Sigues vivo, que no es poco. Levanta despacio.*`;
  }
  return {
    text,
    goldEarned,
    suggestedActions: won
      ? ['Registrar el lugar con calma', 'Curar mis heridas', 'Seguir adelante']
      : ['Buscar un lugar seguro para descansar', 'Pensar en lo ocurrido', 'Seguir adelante']
  };
}

// ---------------------------------------------------------------------------
// Key moments narrated by the AI during a fight (phase 3)
// ---------------------------------------------------------------------------

/** At most this many AI narrations during one fight (the outcome is narrated apart). */
export const MAX_MOMENTS = 2;

/**
 * Key moments in the log entries added by the last action: a leader that falls,
 * or an enemy whose morale breaks (it surrenders or flees). Ignores the rest.
 * @returns {{ kind: 'leader' | 'surrender' | 'flee', text: string }[]}
 */
export function keyMoments(newEntries) {
  const moments = [];
  newEntries.forEach(entry => {
    if (entry.kind === 'down' && entry.leader) moments.push({ kind: 'leader', text: entry.text });
    if (entry.kind === 'morale' && entry.outcome) {
      moments.push({ kind: entry.outcome === 'fled' ? 'flee' : 'surrender', text: entry.text });
    }
  });
  return moments;
}

const MOMENT_SCHEMA = {
  type: 'OBJECT',
  properties: { narracion: { type: 'STRING' } },
  required: ['narracion']
};

/** Short prompt for a key moment: only the facts, a couple of sentences back. */
export function buildMomentPrompt({ moments, encounter, character, world }) {
  const standing = encounter.enemies.filter(e => e.status === 'active').map(e => e.name);
  const enemies = encounter.enemies.map(e => `${e.name}${e.trait ? ` (${e.trait})` : ''}`).join(', ');
  return `Eres Maese Duncan, el DM de una partida de rol en ${world?.name || 'un mundo de fantasía'}. Hay un combate en curso que resuelve el juego con sus propias tiradas: tú solo pones color.
Héroe: ${character.name} (${character.hp}/${character.maxHp} PG). Enemigos: ${enemies}.
Acaba de pasar: ${moments.map(m => m.text).join(' ')}
${standing.length ? `Siguen en pie: ${standing.join(', ')}.` : 'No queda nadie en pie.'}
Narra ese momento en 1 o 2 frases, en español y en segunda persona, sin inventar daños, muertes ni tiradas nuevas, y sin preguntar al jugador. Devuelve JSON con "narracion".`;
}

/**
 * Ask the AI to narrate a key moment. Returns the narration or null (no key,
 * failure, empty reply): the fight goes on without it either way.
 */
export async function narrateMoment(key, context) {
  if (!key) return null;
  try {
    const reply = await requestGemini(key, {
      prompt: buildMomentPrompt(context),
      generationConfig: { responseMimeType: 'application/json', responseSchema: MOMENT_SCHEMA }
    });
    if (!reply.ok) return null;
    let text = reply.text;
    try { text = JSON.parse(reply.text).narracion; } catch { /* plain text answer */ }
    text = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ').slice(0, 400) : '';
    return text || null;
  } catch {
    return null;
  }
}
