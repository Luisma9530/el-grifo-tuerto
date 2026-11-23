// Narration around fights resolved by the game: how the local engine starts a
// fight and closes it, and the few key moments of a fight that Duncan (the AI)
// narrates in a couple of lines. Everything here works from results the game
// already computed: the AI never decides what happens in combat.

import { requestGemini } from './geminiClient';
import { describeLoot } from './loot';
import { SHOP_TYPES } from './shops';

/** Words that mean the hero starts (or provokes) a fight. */
const AGGRESSIVE = /\b(atac|golpe|pele|lucha|mata|asesin|desenvain|carg|embist|apuñal|dispar|emboscad|combat|enfrent|acuchill|degoll|degüell|ensart|estoc|puñetazo|patada|hiero a|tajo)/;
/** Striking someone with a weapon or a spell: "le clavo la daga", "le lanzo un rayo de escarcha". */
const STRIKE = /\b(le|les)\s+(clav|hund|raj|lanz|arroj)\w*\s+(la|el|un|una|mi|mis|los|las)\s+(daga|espada|hacha|lanza|cuchill|puñal|flecha|virote|saeta|rayo|descarga|proyectil|bola|llama|estoque|maza|martillo|jabalina|cimitarra|navaja|garrote|conjuro|hechizo)/;
export const isAggressive = actionLower => AGGRESSIVE.test(actionLower || '') || STRIKE.test(actionLower || '');

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

/**
 * Local engine: start a fight with creatures of the candidate list, sized to an
 * easy encounter for the hero or the party (its budget is per character, added up).
 * @returns {{ text, suggestedActions, combat: { enemigos } }}
 */
export function startLocalFight(bestiary, { character, rng = Math.random, surprise = null, ambush = false }) {
  const budget = bestiary.budget.low;
  const usable = bestiary.creatures.filter(c => c.xp <= budget);
  const pool = usable.length ? usable : [...bestiary.creatures].sort((a, b) => a.xp - b.xp).slice(0, 1);
  const fitting = pool.filter(c => c.xp >= budget / 4);
  const foe = pick(fitting.length ? fitting : pool, rng);
  const group = (bestiary.partySize || 1) > 1;
  const count = Math.max(1, Math.min(group ? 6 : 4, Math.floor(budget / Math.max(1, foe.xp))));
  const many = count > 1;
  const name = character.name || 'Aventurero';
  const foes = many ? `**${count} × ${foe.name}**` : `**${foe.name}**`;
  const text = ambush
    ? `Duncan baja la voz, como si contara una vieja historia de miedo.

—*Ni lo oíste venir, ${name}.* De entre la maleza y las sombras ${many ? 'saltan' : 'salta'} ${foes} sobre ${group ? 'el grupo' : 'ti'}: llevaban rato esperando. Las armas, fuera, ¡ya!`
    : surprise
      ? `Duncan deja la jarra en el mostrador con un golpe seco.

—*Eso no se lo esperaba nadie, ${name}.* ${foes} ${many ? 'tardan' : 'tarda'} un instante de más en reaccionar mientras te lanzas al ataque. Ahora veremos qué sale de ese primer golpe.`
      : `Duncan deja la jarra en el mostrador con un golpe seco.

—*Pues ya está, ${name}: has encontrado pelea.* ${foes} ${many ? 'salen' : 'sale'} ${group ? 'al encuentro del grupo' : 'a tu encuentro'} y no hay tiempo para palabras. Las armas, fuera.`;
  return {
    text,
    suggestedActions: [],
    combat: { enemigos: [{ id: foe.id, cantidad: count }] }
  };
}

/**
 * Local engine: close a fight the game already resolved. XP and loot were
 * applied by the game (see loot.js): this only tells what was found.
 * @param {string} result  describeEncounterResult(...) text
 * @param {{ loot?: { coins, items } }} options  the loot the game gave
 */
export function narrateCombatEnd(result, { character, loot = null }) {
  const name = character.name || 'Aventurero';
  const won = /gana el combate/.test(result);
  const fled = /huye del combate/.test(result);
  const goldEarned = 0;
  let text;
  if (won) {
    const found = describeLoot(loot);
    text = `Se hace el silencio. ${name} recupera el aliento entre los restos de la pelea.

—*Bien hecho. Registra a los caídos antes de que llegue alguien más.* ${found === 'nada de valor'
    ? 'Entre sus cosas no hay nada que valga la pena.'
    : `Entre sus cosas encuentras **${found}**, que guardas en la mochila.`}`;
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
// Shops (local engine)
// ---------------------------------------------------------------------------

/** Words that mean the hero wants to trade. */
const TRADE = /\b(tienda|mercader|comerciante|compr|vend|tendero|bazar|mercado|herrer|armer|boticari|alquimist|herbolari)/;
const SMITH = /\b(herrer|armer|forja|armas?\b|armadura|escudo|espada|hacha|arco)/;
const ALCHEMIST = /\b(boticari|alquimist|herbolari|poci[oó]n|pociones|ant[ií]doto|antitoxina)/;

/**
 * Local engine: the shop an action asks for ('smith' | 'alchemist' | 'general'),
 * or null when the hero is not trying to trade. Without a clue of what to buy,
 * the general store (or the first shop of the place).
 */
export function shopForAction(actionLower, shopsHere = []) {
  const text = actionLower || '';
  if (!TRADE.test(text)) return null;
  if (ALCHEMIST.test(text)) return 'alchemist';
  if (SMITH.test(text)) return 'smith';
  return shopsHere.length && !shopsHere.includes('general') ? shopsHere[0] : 'general';
}

/** Local engine: Duncan points the hero to the shop (the game opens it). */
export function narrateShopOpening(type, { character }) {
  const shop = SHOP_TYPES[type];
  return {
    text: `Duncan señala con el trapo hacia la puerta de ${shop.name.toLowerCase()}.

—*Ahí tienes lo que buscas, ${character.name || 'forastero'}. Paga lo que valga y no regatees demasiado, que el tendero tiene malas pulgas.*`,
    suggestedActions: ['Volver a la taberna', 'Preguntar por rumores al tendero', 'Seguir mi camino']
  };
}

// ---------------------------------------------------------------------------
// Key moments narrated by the AI during a fight (phase 3)
// ---------------------------------------------------------------------------

/**
 * Local engine (and fallback): Duncan's line about the opening strike, from the
 * result the game computed (see openingAction in encounter.js).
 * @param {{ target, with, damage, hp, maxHp, status, surprised }} result
 */
export function openingLine(result, hero) {
  const name = hero?.name || 'Aventurero';
  const how = result.surprised ? 'Ni lo vio venir' : 'Lo vio venir, pero tarde';
  if (result.status === 'dead') return `—*${how}.* ${result.target} se desploma antes de que nadie pueda reaccionar: el primer golpe de ${name} ha bastado.`;
  if (result.status === 'fled') return `—*${how}.* ${result.target} da media vuelta y sale corriendo antes de que empiece la pelea.`;
  if (result.status === 'surrendered') return `—*${how}.* ${result.target} suelta las armas a la primera: no quiere más.`;
  if (result.damage > 0) {
    const share = result.maxHp ? result.hp / result.maxHp : 1;
    return `—*${how}.* El golpe de ${name} entra y ${result.target} retrocede ${share <= 0.5 ? 'malherido, sangrando' : 'con un gruñido de dolor'}. Ahora, a por el resto.`;
  }
  return `—*Mala suerte.* ${result.target} se aparta en el último instante y el primer golpe de ${name} se pierde en el aire.`;
}

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
