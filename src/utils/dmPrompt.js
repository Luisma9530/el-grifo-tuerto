// Prompt and reply handling for the AI Dungeon Master (Gemini).
// Pure functions: no network, no storage.

import { SKILLS, ABILITIES } from '../data/srd';
import { spellRows, slotTable } from './spellcasting';
import { cleanSummary } from './campaignMemory';

// The caller already trims the chronicle to the messages not covered by the
// campaign summary (see campaignMemory.js); these are just safety limits.
const HISTORY_MESSAGES = 14;
const HISTORY_CHARS_PER_MESSAGE = 500;

const DEFAULT_ACTIONS = [
  'Inspeccionar los alrededores',
  'Hablar con Duncan sobre el asunto',
  'Preparar un arma',
  'Buscar una salida oculta'
];

/** JSON schema the model must answer with (Gemini `responseSchema` format). */
export const DM_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    narracion: { type: 'STRING', description: 'La respuesta de Maese Duncan, de 1 a 3 párrafos breves.' },
    usaTirada: { type: 'BOOLEAN', description: 'true si el resultado dependió de la tirada de d20 proporcionada.' },
    danio: { type: 'INTEGER', description: 'Puntos de golpe que pierde el personaje (0 si ninguno).' },
    curacion: { type: 'INTEGER', description: 'Puntos de golpe que recupera el personaje (0 si ninguno).' },
    oro: { type: 'INTEGER', description: 'Monedas de oro ganadas (positivo) o gastadas/perdidas (negativo).' },
    experiencia: { type: 'INTEGER', description: 'Puntos de experiencia ganados por superar un reto (0 si ninguno).' },
    opciones: { type: 'ARRAY', items: { type: 'STRING' }, description: '3 o 4 sugerencias breves de acción.' }
  },
  required: ['narracion', 'usaTirada', 'danio', 'curacion', 'oro', 'experiencia', 'opciones']
};

/** Response schema; with `requestSummary` it also asks for the updated campaign summary. */
export function dmResponseSchema(requestSummary = false) {
  if (!requestSummary) return DM_RESPONSE_SCHEMA;
  return {
    ...DM_RESPONSE_SCHEMA,
    properties: {
      ...DM_RESPONSE_SCHEMA.properties,
      resumen: { type: 'STRING', description: 'Resumen actualizado de toda la campaña, máximo 800 caracteres.' }
    },
    required: [...DM_RESPONSE_SCHEMA.required, 'resumen']
  };
}

function modifier(score) {
  const mod = Math.floor(((Number(score) || 10) - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

const STAT_NAMES = { fue: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma' };

function describeStats(stats) {
  if (!stats) return 'desconocidos';
  return Object.entries(STAT_NAMES)
    .filter(([key]) => stats[key] != null)
    .map(([key, name]) => `${name} ${stats[key]} (${modifier(stats[key])})`)
    .join(', ');
}

/** Extra sheet lines for heroes made with the creation wizard (older saves have none of this). */
function describeBuild(character) {
  const lines = [];
  const origin = [
    character.xp != null && `Experiencia: ${character.xp} PX`,
    character.subclass && `Subclase: ${character.subclass}`,
    character.background && `Trasfondo: ${character.background}`,
    character.alignment && `Alineamiento: ${character.alignment}`
  ].filter(Boolean).join('. ');
  if (origin) lines.push(`- ${origin}.`);

  const skills = (character.skills || [])
    .map(id => SKILLS.find(s => s.id === id)?.name)
    .filter(Boolean);
  if (skills.length > 0) {
    lines.push(`- Competente (suma +${character.proficiencyBonus || 2} en esas tiradas) en: ${skills.join(', ')}.`);
  }

  const traits = [...(character.classFeatures || []), ...(character.feats || []), ...(character.traits || [])];
  if (traits.length > 0) lines.push(`- Rasgos y dotes: ${traits.join(', ')}.`);
  if (character.backstory) lines.push(`- Historia: ${String(character.backstory).slice(0, 500)}`);

  const spells = spellRows(character).filter(row => !row.blocked || row.blocked === 'Sin espacios de conjuro');
  if (spells.length > 0) {
    const cantrips = spells.filter(s => s.level === 0).map(s => s.name);
    const prepared = spells.filter(s => s.level > 0).map(s => s.name);
    const slots = slotTable(character.spellcasting);
    const slotText = slots.map(row => `nivel ${row.level}: ${row.left} de ${row.max}`).join(', ');
    lines.push(`- Magia: ${slots.length ? `espacios de conjuro que le quedan (${slotText}). ` : ''}${
      cantrips.length ? `Trucos: ${cantrips.join(', ')}. ` : ''}${prepared.length ? `Conjuros: ${prepared.join(', ')}.` : ''}`.trim());
  }

  return lines.length > 0 ? `\n${lines.join('\n')}` : '';
}

function formatHistory(history, characterName) {
  return (history || [])
    .slice(-HISTORY_MESSAGES)
    .map(m => {
      const who = m.sender === 'player' ? characterName : m.sender === 'system' ? 'Sistema (dados)' : 'Maese Duncan (DM)';
      const text = String(m.text || '');
      return `${who}: ${text.length > HISTORY_CHARS_PER_MESSAGE ? `${text.slice(0, HISTORY_CHARS_PER_MESSAGE)}…` : text}`;
    })
    .join('\n\n');
}

/**
 * Build the prompt for one player action.
 * @param {object} params
 * @param {number} params.d20            die already rolled by the game (1-20)
 * @param {object} [params.playerRoll]   ability check rolled by the player, if any
 * @param {boolean} [params.structured]  ask for JSON (true) or the legacy "OPCIONES:" text format
 * @param {object} [params.spellCast]    spell the player just cast (see castSpell), if any
 * @param {string} [params.rest]         'long' | 'short' when the action is a rest
 * @param {boolean} [params.effectsApplied]  the game already changed HP / gold for this action
 * @param {object} [params.weaponAttack]  weapon attack already resolved by the game (see combat.js)
 * @param {string} [params.summary]       campaign summary written in earlier turns
 * @param {string[]} [params.events]      facts recorded by the game (travel, level ups...)
 * @param {boolean} [params.requestSummary]  ask the model to rewrite the summary in this reply
 */
export function buildDMPrompt({
  playerAction, character, world, history, d20, playerRoll = null, structured = true,
  spellCast = null, rest = null, effectsApplied = false, weaponAttack = null,
  summary = '', events = [], requestSummary = false
}) {
  const name = character.name || 'Aventurero';
  const location = world.mapNodes?.find(n => n.status === 'current')?.name || world.initialLocation;
  const inventory = (character.inventory || []).map(i => i.name).filter(Boolean).join(', ');

  const enemySave = spellCast && !spellCast.attack && spellCast.spell.kind === 'save';
  const noRoll = Boolean(rest) || (spellCast && !spellCast.attack && !enemySave);
  const attackDone = Boolean(weaponAttack);
  const saveAbility = enemySave ? ABILITIES.find(a => a.id === spellCast.spell.save)?.name : '';

  const diceRules = attackDone
    ? 'El juego YA ha resuelto este ataque con sus propias tiradas, que aparecen en la acción del jugador: narra exactamente esos impactos, fallos y el daño que sufre el enemigo, sin cambiar ningún número ni tirar dados ("usaTirada": false). Tú solo decides cómo reacciona el enemigo: si está muy herido, si huye o se rinde, o si contraataca (en ese caso pon en "danio" lo que pierde el personaje).'
    : noRoll
    ? 'Esta acción no necesita ninguna tirada: no menciones dados y marca "usaTirada" como false.'
    : enemySave
    ? `El jugador ha lanzado un conjuro que obliga a su objetivo a hacer una tirada de salvación. El d20 ya lanzado (${d20}) es la tirada de salvación de ${saveAbility} del OBJETIVO: súmale un modificador razonable para esa criatura (entre -1 y +4) y compárala con la CD ${spellCast.saveDC}. Si la iguala o supera, resiste el conjuro (o recibe la mitad del daño si el conjuro lo indica); si no, sufre el efecto completo. Menciónala así: [🎲 Salvación de ${saveAbility} del objetivo D20: ${d20} + mod = total vs CD ${spellCast.saveDC}] y marca "usaTirada" como true. No hagas ninguna otra tirada.`
    : playerRoll
    ? `El jugador ya ha hecho una tirada de ${playerRoll.statName || 'habilidad'}: d20 = ${playerRoll.rawRoll}, total ${playerRoll.total} contra CD ${playerRoll.dc} → ${
        playerRoll.isNat20 ? 'ÉXITO CRÍTICO' : playerRoll.isNat1 ? 'PIFIA' : playerRoll.success ? 'ÉXITO' : 'FALLO'
      }. Narra exactamente ese resultado; no hagas ni menciones ninguna otra tirada.`
    : `El dado de 20 caras YA se ha lanzado para esta acción y ha salido: ${d20}${d20 === 20 ? ' (crítico natural)' : d20 === 1 ? ' (pifia natural)' : ''}.
- Si la acción tiene riesgo o un resultado incierto (combate, sigilo, persuadir, trepar, magia...), DEBES resolverla con ESE número: súmale el modificador del atributo adecuado (más su bonificador de competencia si usa una habilidad en la que es competente) y compáralo con una Clase de Dificultad razonable (8 fácil, 12 normal, 16 difícil). Un 20 natural siempre es un éxito espectacular y un 1 natural siempre un desastre. Menciona la tirada en la narración así: [🎲 Atributo D20: ${d20} + mod = total vs CD X].
- Si la acción no necesita tirada (conversar, pedir una bebida, mirar algo evidente), ignora el dado y no lo menciones.
- Nunca inventes una tirada distinta ni tires más dados.`;

  const format = structured
    ? `Responde SOLO con un objeto JSON con estos campos:
- "narracion": tu respuesta como Maese Duncan (2 a 4 párrafos, en español, puedes usar **negrita** y *cursiva*).
- "usaTirada": true si resolviste la acción con la tirada de d20 indicada; false si la ignoraste.
- "danio": puntos de golpe que pierde ${name} por lo ocurrido (entero, 0 si nada).
- "curacion": puntos de golpe que recupera (entero, 0 si nada).
- "oro": monedas de oro que gana (positivo) o que gasta o pierde (negativo); 0 si nada.
- "experiencia": puntos de experiencia por superar un reto en esta escena: 0 si no superó nada (charlar, comprar, descansar, fallar sin aprender nada), 10-30 por un reto menor, 40-80 por vencer un combate o descubrir algo importante, 100-200 solo por un logro excepcional.
- "opciones": 3 o 4 sugerencias breves de lo que puede hacer ahora.${requestSummary ? `
- "resumen": reescribe el resumen de la campaña juntando el resumen anterior y la crónica reciente (máximo 800 caracteres, frases cortas): hechos clave, personajes no jugadores y su relación con ${name}, misiones abiertas, pistas, deudas y objetos importantes. Es tu memoria para el resto de la partida.` : ''}
Lo que cuentes en la narración debe coincidir con "danio", "curacion" y "oro".`
    : `Al final de tu respuesta, en una línea separada que empiece con "OPCIONES:", proporciona 3 o 4 sugerencias breves de acción separadas por una pleca "|". Por ejemplo: OPCIONES: Sacar el arma | Negociar con el tabernero | Escabullirse por la puerta trasera.
Mantén la respuesta en español, entre 1 y 3 párrafos breves.`;

  return `Eres "Maese Duncan", el veterano, tosco, ingenioso y carismático tabernero tuerto y Dungeon Master de la taberna "El Grifo Tuerto".
Estás dirigiendo una partida de rol estilo D&D 5e en el mundo: "${world.name}" (${world.genre || 'fantasía'}).${location ? `\nUbicación actual: ${location}.` : ''}

Personaje del jugador: ${name}, ${character.race || ''} ${character.class || ''}.
- Puntos de golpe: ${character.hp}/${character.maxHp}. Armadura (CA): ${character.ac ?? '?'}. Oro: ${character.gold} monedas.
- Atributos: ${describeStats(character.stats)}.${inventory ? `\n- Inventario: ${inventory}.` : ''}${describeBuild(character)}

${summary ? `Resumen de la campaña hasta ahora:
"""
${summary}
"""

` : ''}${events.length ? `Hechos registrados por el juego: ${events.join(' · ')}.

` : ''}Crónica reciente (mantén la coherencia con estos eventos):
"""
${formatHistory(history, name) || 'Inicio de la aventura en la taberna.'}
"""

El jugador acaba de realizar la siguiente acción:
"${playerAction}"

Dados:
${diceRules}

Instrucciones:
1. Responde con tu inconfundible voz de Maese Duncan (humor negro, sabiduría de taberna, descripciones vívidas y consecuencias palpables), en 1 a 3 párrafos breves.
2. Respeta los hechos previos, la ficha y la historia del personaje (su clase, especie, trasfondo y rasgos deben notarse en la narración): no puede gastar oro que no tiene, y con pocos puntos de golpe el peligro es real.
3. Si sufre daño, se cura, gana o gasta oro, indícalo de forma dramática pero breve.
4. Concluye planteando un dilema inmediato o preguntando qué hará ahora.${effectsApplied ? '\n5. Los cambios de puntos de golpe, oro y espacios de conjuro de ESTA acción ya están aplicados en la ficha: devuelve "danio" 0, "curacion" 0 y "oro" 0, salvo que ocurra algo más aparte de lo que el jugador describe.' : ''}

${format}`;
}

function toInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

function cleanActions(list) {
  const actions = (Array.isArray(list) ? list : [])
    .filter(a => typeof a === 'string')
    .map(a => a.trim())
    .filter(Boolean)
    .slice(0, 4);
  return actions.length > 0 ? actions : DEFAULT_ACTIONS;
}

/**
 * Turn the model's raw reply into a game result. Accepts the JSON format and
 * falls back to the legacy plain-text format ("... OPCIONES: a | b | c").
 * Numbers are clamped so a confused model can't wreck the character sheet.
 * Returns null if there is no usable narration.
 */
export function parseDMReply(raw, character = {}) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const maxHp = Number(character.maxHp) || 100;
  const gold = Math.max(0, Number(character.gold) || 0);

  const jsonText = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (jsonText.startsWith('{')) {
    try {
      const data = JSON.parse(jsonText);
      const text = typeof data.narracion === 'string' ? data.narracion.trim() : '';
      if (!text) return null; // valid JSON without narration: never show raw JSON to the player
      return {
        text,
        suggestedActions: cleanActions(data.opciones),
        damageTaken: toInt(data.danio, 0, maxHp),
        healing: toInt(data.curacion, 0, maxHp),
        goldEarned: toInt(data.oro, -gold, 500),
        xpEarned: toInt(data.experiencia, 0, 300),
        usedRoll: data.usaTirada === true,
        summary: cleanSummary(data.resumen)
      };
    } catch {
      // Not valid JSON: treat it as plain text below
    }
  }

  let text = raw.trim();
  let options = [];
  if (text.includes('OPCIONES:')) {
    const parts = text.split('OPCIONES:');
    text = parts[0].trim();
    options = parts[1].split('|');
  }
  if (!text) return null;
  return {
    text,
    suggestedActions: cleanActions(options),
    damageTaken: 0,
    healing: 0,
    goldEarned: 0,
    xpEarned: 0,
    summary: null,
    // Plain text can't tell us reliably; look for the dice marker the prompt asks for
    usedRoll: text.includes('🎲')
  };
}
