// Prompt and reply handling for the AI Dungeon Master (Gemini).
// Pure functions: no network, no storage.

import { SKILLS, ABILITIES } from '../data/srd';
import { spellRows, slotTable } from './spellcasting';
import { cleanSummary } from './campaignMemory';
import { describeEquipmentForPrompt, LIMB_IDS } from './equipment';

/** Limb ids and states in the reply (Spanish, as the model writes them) -> sheet values. */
export const LIMB_REPLY_IDS = { brazoDerecho: 'rightArm', brazoIzquierdo: 'leftArm', piernaDerecha: 'rightLeg', piernaIzquierda: 'leftLeg' };
export const LIMB_REPLY_STATUSES = { sana: 'ok', inutilizada: 'disabled', perdida: 'lost' };
const MAX_LIMB_CHANGES = LIMB_IDS.length;

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
    opciones: { type: 'ARRAY', items: { type: 'STRING' }, description: '3 o 4 sugerencias breves de acción.' },
    extremidades: {
      type: 'ARRAY',
      nullable: true,
      description: 'Solo si en esta escena el personaje pierde, queda sin poder usar o recupera un brazo o una pierna. Casi siempre vacío.',
      items: {
        type: 'OBJECT',
        properties: {
          extremidad: { type: 'STRING', enum: Object.keys(LIMB_REPLY_IDS) },
          estado: { type: 'STRING', enum: Object.keys(LIMB_REPLY_STATUSES) }
        },
        required: ['extremidad', 'estado']
      }
    }
  },
  required: ['narracion', 'usaTirada', 'danio', 'curacion', 'oro', 'experiencia', 'opciones']
};

const COMBAT_SCHEMA = {
  type: 'OBJECT',
  nullable: true,
  description: 'Solo si empieza una pelea en esta escena: los enemigos (de la lista de criaturas).',
  properties: {
    enemigos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          cantidad: { type: 'INTEGER' },
          nombre: { type: 'STRING', description: 'Nombre propio, solo para un individuo único.' },
          rasgo: { type: 'STRING', description: 'Rasgo breve que lo distingue.' },
          elite: { type: 'BOOLEAN', description: 'true si es un jefe más duro de lo normal.' }
        },
        required: ['id', 'cantidad']
      }
    }
  },
  required: ['enemigos']
};

/**
 * Response schema; with `requestSummary` it also asks for the updated campaign
 * summary, with `allowCombat` it accepts an optional fight to start.
 */
export function dmResponseSchema(requestSummary = false, allowCombat = false) {
  if (!requestSummary && !allowCombat) return DM_RESPONSE_SCHEMA;
  const properties = { ...DM_RESPONSE_SCHEMA.properties };
  const required = [...DM_RESPONSE_SCHEMA.required];
  if (requestSummary) {
    properties.resumen = { type: 'STRING', description: 'Resumen actualizado de toda la campaña, máximo 800 caracteres.' };
    required.push('resumen');
  }
  if (allowCombat) properties.combate = COMBAT_SCHEMA;
  return { ...DM_RESPONSE_SCHEMA, properties, required };
}

const formatCr = cr => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr));

/** Lines describing the creatures the Dungeon Master may use to start a fight. */
function describeBestiary(bestiary) {
  return bestiary.creatures.map(c => `${c.id} = ${c.name} (VD ${formatCr(c.cr)}, ${c.xp} PX)`).join('; ');
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
 * @param {object} [params.bestiary]     { creatures, budget } the model may start a fight with (see encounterCandidates)
 * @param {string} [params.combatResult] summary of a fight the game just finished: narrate its outcome
 */
export function buildDMPrompt({
  playerAction, character, world, history, d20, playerRoll = null, structured = true,
  spellCast = null, rest = null, effectsApplied = false, weaponAttack = null,
  summary = '', events = [], requestSummary = false, bestiary = null, combatResult = null
}) {
  const name = character.name || 'Aventurero';
  const location = world.mapNodes?.find(n => n.status === 'current')?.name || world.initialLocation;
  const inventory = (character.inventory || []).map(i => i.name).filter(Boolean).join(', ');

  const enemySave = spellCast && !spellCast.attack && spellCast.spell.kind === 'save';
  const noRoll = Boolean(rest) || (spellCast && !spellCast.attack && !enemySave);
  const attackDone = Boolean(weaponAttack);
  const saveAbility = enemySave ? ABILITIES.find(a => a.id === spellCast.spell.save)?.name : '';

  const diceRules = combatResult
    ? `El combate ya ha terminado y lo ha resuelto el juego con sus propias tiradas. Resultado: ${combatResult}
Narra el desenlace (cómo queda el lugar, qué hacen los que se rindieron o huyeron) sin cambiar nada de lo ocurrido ni tirar dados. "usaTirada": false, "danio": 0, "curacion": 0 y "experiencia": 0 (ya está aplicada). En "oro" pon el botín que encuentra si registra a los caídos (razonable para esas criaturas, o 0).`
    : attackDone
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
- "opciones": 3 o 4 sugerencias breves de lo que puede hacer ahora.
- "extremidades": casi siempre una lista vacía. Solo si la historia lo hace inevitable (una trampa que le aplasta el brazo, una maldición, una amputación, un sanador o un milagro que lo cura), indica el cambio: [{"extremidad": "brazoDerecho" | "brazoIzquierdo" | "piernaDerecha" | "piernaIzquierda", "estado": "inutilizada" | "perdida" | "sana"}]. Debe ser excepcional y coincidir con la narración; el juego aplicará el efecto (lo que llevase en esa mano cae a la mochila).${requestSummary ? `
- "resumen": reescribe el resumen de la campaña juntando el resumen anterior y la crónica reciente (máximo 800 caracteres, frases cortas): hechos clave, personajes no jugadores y su relación con ${name}, misiones abiertas, pistas, deudas y objetos importantes. Es tu memoria para el resto de la partida.` : ''}
${bestiary ? `
- "combate": SOLO si en esta escena empieza una pelea (alguien ataca al héroe, o el héroe ataca a alguien). En ese caso NO resuelvas la pelea: narra solo cómo aparecen los enemigos (sin golpes, aciertos, daño ni tiradas), pon "usaTirada": false y "danio": 0, y devuelve los enemigos; el juego llevará el combate con sus propias tiradas. Usa únicamente estas criaturas: ${describeBestiary(bestiary)}. Para ${name} solo, un combate normal suma unos ${bestiary.budget.moderate} PX (fácil ${bestiary.budget.low}, duro ${bestiary.budget.high}). Puedes dar a un único enemigo un "nombre" propio y un "rasgo" breve, y marcarlo "elite" si es un jefe. Si no empieza ninguna pelea, omite "combate".` : ''}
Lo que cuentes en la narración debe coincidir con "danio", "curacion" y "oro".`
    : `Al final de tu respuesta, en una línea separada que empiece con "OPCIONES:", proporciona 3 o 4 sugerencias breves de acción separadas por una pleca "|". Por ejemplo: OPCIONES: Sacar el arma | Negociar con el tabernero | Escabullirse por la puerta trasera.
Mantén la respuesta en español, entre 1 y 3 párrafos breves.`;

  return `Eres "Maese Duncan", el veterano, tosco, ingenioso y carismático tabernero tuerto y Dungeon Master de la taberna "El Grifo Tuerto".
Estás dirigiendo una partida de rol estilo D&D 5e en el mundo: "${world.name}" (${world.genre || 'fantasía'}).${location ? `\nUbicación actual: ${location}.` : ''}

Personaje del jugador: ${name}, ${character.race || ''} ${character.class || ''}.
- Puntos de golpe: ${character.hp}/${character.maxHp}. Armadura (CA): ${character.ac ?? '?'}. Oro: ${character.gold} monedas.
- Atributos: ${describeStats(character.stats)}.${inventory ? `\n- Inventario: ${inventory}.` : ''}
- ${describeEquipmentForPrompt(character)}${describeBuild(character)}

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

/**
 * Validate the limb changes of a reply: known limbs and states only, one change
 * per limb (the last one wins), at most one per limb.
 * @returns {{limb, status}[]}
 */
export function cleanLimbChanges(list) {
  if (!Array.isArray(list)) return [];
  const byLimb = new Map();
  list.slice(0, MAX_LIMB_CHANGES * 2).forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const limb = LIMB_REPLY_IDS[String(entry.extremidad || '').trim()];
    const status = LIMB_REPLY_STATUSES[String(entry.estado || '').trim().toLowerCase()];
    if (limb && status) byLimb.set(limb, status);
  });
  return [...byLimb].map(([limb, status]) => ({ limb, status }));
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
        summary: cleanSummary(data.resumen),
        combat: data.combate && Array.isArray(data.combate.enemigos) && data.combate.enemigos.length ? data.combate : null,
        limbChanges: cleanLimbChanges(data.extremidades)
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
    combat: null,
    limbChanges: [],
    // Plain text can't tell us reliably; look for the dice marker the prompt asks for
    usedRoll: text.includes('🎲')
  };
}
