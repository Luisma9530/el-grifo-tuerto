// Prompt and reply handling for the AI Dungeon Master (Gemini).
// Pure functions: no network, no storage.

import { SKILLS, ABILITIES } from '../data/srd';
import { spellRows, slotTable } from './spellcasting';
import { cleanSummary } from './campaignMemory';
import { describeEquipmentForPrompt, LIMB_IDS } from './equipment';
import { formatCoins } from './items';
import { SHOP_REPLY_IDS } from './shops';
import { STORY_CONDITION_IDS, EXHAUSTION_MAX, describeConditionsForPrompt } from './conditions';
import { characterLevel } from './characterLevel';
import { QUEST_REPLY_ACTIONS, QUEST_IMPORTANCE, cleanQuestChanges, questGoldCap } from './quests';
import { cleanRecruitOffer, cleanDeparture, RECRUIT_CLASS_NAMES } from './recruit';
import { MAX_PARTY } from './party';

/** Limb ids and states in the reply (Spanish, as the model writes them) -> sheet values. */
export const LIMB_REPLY_IDS = { brazoDerecho: 'rightArm', brazoIzquierdo: 'leftArm', piernaDerecha: 'rightLeg', piernaIzquierda: 'leftLeg' };
export const LIMB_REPLY_STATUSES = { sana: 'ok', inutilizada: 'disabled', perdida: 'lost' };
const MAX_LIMB_CHANGES = LIMB_IDS.length;

/** Condition changes in the reply: "aplicar" / "quitar", and how long they last. */
export const CONDITION_REPLY_ACTIONS = { aplicar: 'add', quitar: 'remove' };
export const CONDITION_REPLY_DURATIONS = { descansoCorto: { rest: 'short' }, descansoLargo: { rest: 'long' }, permanente: 'permanent' };
const MAX_CONDITION_CHANGES = 4;
/** Who a scene effect hits in a party: names (or ids) of members, or "todos". */
export const ALL_TARGETS = 'todos';
const MAX_TARGETS = 4;
const TARGET_MAX = 40;
const TARGETS_SCHEMA = description => ({ type: 'ARRAY', nullable: true, items: { type: 'STRING' }, description });
const CONDITION_CAUSE_MAX = 60;

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
    afectadosDanio: TARGETS_SCHEMA('Solo con grupo: quiénes pierden "danio" (nombres o "todos"). Vacío = quien actúa.'),
    afectadosCuracion: TARGETS_SCHEMA('Solo con grupo: quiénes recuperan "curacion" (nombres o "todos"). Vacío = quien actúa.'),
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
          estado: { type: 'STRING', enum: Object.keys(LIMB_REPLY_STATUSES) },
          afectados: TARGETS_SCHEMA('Solo con grupo: a quién (nombres o "todos"). Vacío = quien actúa.')
        },
        required: ['extremidad', 'estado']
      }
    },
    condiciones: {
      type: 'ARRAY',
      nullable: true,
      description: 'Solo si la historia aplica o quita una condición al personaje (veneno, agotamiento, ceguera, un sanador...). Casi siempre vacío.',
      items: {
        type: 'OBJECT',
        properties: {
          condicion: { type: 'STRING', enum: STORY_CONDITION_IDS },
          accion: { type: 'STRING', enum: Object.keys(CONDITION_REPLY_ACTIONS) },
          duracion: { type: 'STRING', enum: Object.keys(CONDITION_REPLY_DURATIONS), nullable: true },
          niveles: { type: 'INTEGER', nullable: true, description: 'Solo para agotamiento: niveles que se ganan o se quitan (1 a 6).' },
          causa: { type: 'STRING', nullable: true, description: 'Causa breve: "veneno de la ciénaga".' },
          afectados: TARGETS_SCHEMA('Solo con grupo: a quién (nombres o "todos"). Vacío = quien actúa.')
        },
        required: ['condicion', 'accion']
      }
    },
    misiones: {
      type: 'ARRAY',
      nullable: true,
      description: 'Solo si en esta escena alguien encarga una misión al héroe, avanza una misión activa o se cumple o fracasa. Casi siempre vacío.',
      items: {
        type: 'OBJECT',
        properties: {
          accion: { type: 'STRING', enum: Object.keys(QUEST_REPLY_ACTIONS) },
          id: { type: 'STRING', nullable: true, description: 'Id de una misión activa (m1, m2...); no para "abrir".' },
          titulo: { type: 'STRING', nullable: true, description: 'Título breve de la misión (para "abrir").' },
          quienEncarga: { type: 'STRING', nullable: true },
          lugar: { type: 'STRING', nullable: true },
          objetivo: { type: 'STRING', nullable: true, description: 'Qué hay que hacer, en una frase.' },
          nota: { type: 'STRING', nullable: true, description: 'Nota breve de progreso.' },
          recompensa: {
            type: 'OBJECT',
            nullable: true,
            description: 'Solo para "abrir": lo que se promete. El juego la ajusta a sus topes y la paga al cumplirse.',
            properties: {
              oro: { type: 'INTEGER', nullable: true },
              objeto: { type: 'STRING', nullable: true, description: 'Un objeto corriente: "Poción de curación", "Espada larga", "Cota de malla"...' },
              experiencia: { type: 'BOOLEAN', nullable: true },
              importancia: { type: 'STRING', enum: Object.keys(QUEST_IMPORTANCE), nullable: true },
              soloHistoria: { type: 'BOOLEAN', nullable: true }
            }
          }
        },
        required: ['accion']
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

const RECRUIT_SCHEMA = {
  type: 'OBJECT',
  nullable: true,
  description: 'Solo si en esta escena un personaje no jugador se ofrece de verdad a unirse al grupo. Casi siempre omitido.',
  properties: {
    nombre: { type: 'STRING' },
    clase: { type: 'STRING', enum: RECRUIT_CLASS_NAMES },
    especie: { type: 'STRING', nullable: true },
    motivo: { type: 'STRING', nullable: true, description: 'Por qué quiere acompañarlos, en una frase.' }
  },
  required: ['nombre', 'clase']
};

const DEPARTURE_SCHEMA = {
  type: 'OBJECT',
  nullable: true,
  description: 'Solo si la historia hace que un miembro del grupo lo abandone (no el que actúa salvo que él lo decida). Casi siempre omitido.',
  properties: {
    nombre: { type: 'STRING' },
    motivo: { type: 'STRING', nullable: true }
  },
  required: ['nombre']
};

const SHOP_SCHEMA = {
  type: 'OBJECT',
  nullable: true,
  description: 'Solo si el héroe entra en una tienda o trata con un mercader para comprar o vender: el juego abre la tienda con sus precios.',
  properties: {
    tipo: { type: 'STRING', enum: Object.keys(SHOP_REPLY_IDS), description: 'herrero: armas y armaduras; alquimista: pociones; general: equipo de aventurero.' }
  },
  required: ['tipo']
};

/**
 * Response schema; with `requestSummary` it also asks for the updated campaign
 * summary, with `allowCombat` it accepts an optional fight to start, with
 * `allowShop` an optional shop to open.
 */
export function dmResponseSchema(requestSummary = false, allowCombat = false, allowShop = false, { allowRecruit = false, allowDeparture = false } = {}) {
  if (!requestSummary && !allowCombat && !allowShop && !allowRecruit && !allowDeparture) return DM_RESPONSE_SCHEMA;
  const properties = { ...DM_RESPONSE_SCHEMA.properties };
  const required = [...DM_RESPONSE_SCHEMA.required];
  if (requestSummary) {
    properties.resumen = { type: 'STRING', description: 'Resumen actualizado de toda la campaña, máximo 800 caracteres.' };
    required.push('resumen');
  }
  if (allowCombat) properties.combate = COMBAT_SCHEMA;
  if (allowShop) properties.tienda = SHOP_SCHEMA;
  if (allowRecruit) properties.reclutar = RECRUIT_SCHEMA;
  if (allowDeparture) properties.abandona = DEPARTURE_SCHEMA;
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
      const who = m.sender === 'player' ? (m.actor || characterName) : m.sender === 'system' ? 'Sistema (dados)' : 'Maese Duncan (DM)';
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
 * @param {string} [params.combatResult] summary of a fight the game just finished (and its loot): narrate its outcome
 * @param {boolean} [params.allowShop]   the model may open a shop with "tienda"
 * @param {string} [params.shopsHere]    the shops at the hero's location (see describeShopsForPrompt)
 * @param {string} [params.quests]       the active quests (see describeQuestsForPrompt)
 * @param {string} [params.companions]   the other members of the party, in short (see describeCompanions)
 * @param {number} [params.partySize]    how many members the party has (1 to 4)
 * @param {boolean} [params.allowRecruit]   the model may offer a companion with "reclutar"
 * @param {boolean} [params.allowDeparture] the model may make a member leave with "abandona"
 */
export function buildDMPrompt({
  playerAction, character, world, history, d20, playerRoll = null, structured = true,
  spellCast = null, rest = null, effectsApplied = false, weaponAttack = null,
  summary = '', events = [], requestSummary = false, bestiary = null, combatResult = null,
  allowShop = false, shopsHere = '', quests = '', companions = '', partySize = 1,
  allowRecruit = false, allowDeparture = false
}) {
  const name = character.name || 'Aventurero';
  const group = partySize > 1;
  const conditions = describeConditionsForPrompt(character);
  const location = world.mapNodes?.find(n => n.status === 'current')?.name || world.initialLocation;
  const inventory = (character.inventory || []).map(i => i.name).filter(Boolean).join(', ');

  const enemySave = spellCast && !spellCast.attack && spellCast.spell.kind === 'save';
  const noRoll = Boolean(rest) || (spellCast && !spellCast.attack && !enemySave);
  const attackDone = Boolean(weaponAttack);
  const saveAbility = enemySave ? ABILITIES.find(a => a.id === spellCast.spell.save)?.name : '';

  const diceRules = combatResult
    ? `El combate ya ha terminado y lo ha resuelto el juego con sus propias tiradas. Resultado: ${combatResult}
Narra el desenlace (cómo queda el lugar, qué hacen los que se rindieron o huyeron) sin cambiar nada de lo ocurrido ni tirar dados. El botín del resultado lo ha calculado el juego y ya está en la mochila: descríbelo cuando registre a los caídos, sin añadir otros objetos ni monedas. "usaTirada": false, "danio": 0, "curacion": 0, "oro": 0 y "experiencia": 0 (ya está aplicado todo).`
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
- "extremidades": casi siempre una lista vacía. Solo si la historia lo hace inevitable (una trampa que le aplasta el brazo, una maldición, una amputación, un sanador o un milagro que lo cura), indica el cambio: [{"extremidad": "brazoDerecho" | "brazoIzquierdo" | "piernaDerecha" | "piernaIzquierda", "estado": "inutilizada" | "perdida" | "sana"}]. Debe ser excepcional y coincidir con la narración; el juego aplicará el efecto (lo que llevase en esa mano cae a la mochila).
- "condiciones": casi siempre una lista vacía. Solo si la historia aplica o quita una condición a ${name} (un veneno, una maldición, días sin dormir o una marcha forzada, una explosión que lo deja sordo, un sanador o un antídoto que lo cura): [{"condicion": ${STORY_CONDITION_IDS.map(id => `"${id}"`).join(' | ')}, "accion": "aplicar" | "quitar", "duracion": "descansoCorto" | "descansoLargo" | "permanente", "niveles": 1 (solo para agotamiento), "causa": "texto breve"}]. Por defecto duran hasta un descanso largo; el agotamiento se acumula por niveles (máximo ${EXHAUSTION_MAX}, y cada descanso largo quita uno). El juego aplica los efectos a las tiradas; tú no los resuelvas. En los combates el juego gestiona las condiciones por su cuenta.${requestSummary ? `
- "resumen": reescribe el resumen de la campaña juntando el resumen anterior y la crónica reciente (máximo 800 caracteres, frases cortas): hechos clave, personajes no jugadores y su relación con ${name}, misiones abiertas, pistas, deudas y objetos importantes. Es tu memoria para el resto de la partida.` : ''}
${bestiary ? `
- "combate": SOLO si en esta escena empieza una pelea (alguien ataca al héroe, o el héroe ataca a alguien). En ese caso NO resuelvas la pelea: narra solo cómo aparecen los enemigos (sin golpes, aciertos, daño ni tiradas), pon "usaTirada": false y "danio": 0, y devuelve los enemigos; el juego llevará el combate con sus propias tiradas. Usa únicamente estas criaturas: ${describeBestiary(bestiary)}. Para ${group ? `el grupo de ${partySize}` : `${name} solo`}, un combate normal suma unos ${bestiary.budget.moderate} PX (fácil ${bestiary.budget.low}, duro ${bestiary.budget.high}). Puedes dar a un único enemigo un "nombre" propio y un "rasgo" breve, y marcarlo "elite" si es un jefe. Si no empieza ninguna pelea, omite "combate".` : ''}${allowShop ? `
- "tienda": SOLO si ${name} entra en una tienda, va al mercado o habla con un mercader para comprar o vender: {"tipo": "herrero" (armas y armaduras) | "alquimista" (pociones) | "general" (equipo de aventurero)}. El juego abrirá la tienda con sus propios precios y su género: tú no cobras ni pagas nada ("oro": 0), no inventas precios ni das objetos; narra solo la llegada y al tendero. ${shopsHere || 'Aquí no hay tiendas fijas: sería un buhonero o un puesto improvisado.'} Si el jugador intenta comprar o vender equipo, usa "tienda" en vez de "oro". Si no, omite "tienda".` : ''}
${allowRecruit ? `
- "reclutar": SOLO si en esta escena un personaje no jugador se ofrece de verdad a unirse al grupo (lo contratan, le salvan la vida, comparte su causa...): {"nombre", "clase": ${RECRUIT_CLASS_NAMES.map(c => `"${c}"`).join(' | ')}, "especie", "motivo"}. No lo sumes tú: el juego pregunta al jugador si acepta y crea su ficha con las reglas. El grupo tiene ${partySize} de ${MAX_PARTY} miembros. Raro: no más de uno cada muchas escenas. Si no, omite "reclutar".` : ''}${allowDeparture ? `
- "abandona": SOLO si la historia hace que un compañero deje el grupo (traición, una deuda, una despedida, lo raptan): {"nombre": uno de los compañeros, "motivo"}. Muy raro; nunca por capricho. Si no, omite "abandona".` : ''}

- "misiones": casi siempre una lista vacía. Las misiones solo nacen y terminan en la historia, nunca porque el jugador lo pida fuera de ella.
  · "abrir": cuando alguien encarga de verdad un trabajo a ${name} y lo acepta (un PNJ, un tablón de anuncios, un contrato): {"accion": "abrir", "titulo", "quienEncarga", "lugar", "objetivo", "recompensa": {"oro", "objeto", "experiencia": true, "importancia": "menor" | "normal" | "mayor"}} o {"soloHistoria": true} si no hay pago. Para el nivel ${characterLevel(character)} el oro más el valor del objeto no pasa de ${formatCoins(questGoldCap(characterLevel(character)))}; el juego ajusta lo que se pase y calcula la experiencia por la importancia. Promete en la narración lo mismo que pongas aquí.
  · "actualizar": {"accion": "actualizar", "id", "nota"} cuando hay un avance o una pista, o con "objetivo" si el encargo cambia.
  · "cumplir" / "fallar": {"accion": "cumplir" | "fallar", "id", "nota"} cuando la historia la resuelve. Al cumplirla el juego entrega la recompensa prometida: narra que la recibe, pero no la sumes a "oro" ni a "experiencia".
  ${quests ? `Misiones activas (usa SOLO estos ids, no inventes otros): ${quests}.` : 'Ahora no hay misiones activas: no uses "actualizar", "cumplir" ni "fallar".'}
Lo que cuentes en la narración debe coincidir con "danio", "curacion" y "oro".`
    : `Al final de tu respuesta, en una línea separada que empiece con "OPCIONES:", proporciona 3 o 4 sugerencias breves de acción separadas por una pleca "|". Por ejemplo: OPCIONES: Sacar el arma | Negociar con el tabernero | Escabullirse por la puerta trasera.
Mantén la respuesta en español, entre 1 y 3 párrafos breves.`;

  return `Eres "Maese Duncan", el veterano, tosco, ingenioso y carismático tabernero tuerto y Dungeon Master de la taberna "El Grifo Tuerto".
Estás dirigiendo una partida de rol estilo D&D 5e en el mundo: "${world.name}" (${world.genre || 'fantasía'}).${location ? `\nUbicación actual: ${location}.` : ''}

${group ? `El jugador controla a un grupo de ${partySize} personajes. Actúa ahora: ${name}. Sus compañeros: ${companions}.
Narra para todo el grupo, pero esta acción la hace ${name}. Por defecto "danio", "curacion", "condiciones" y "extremidades" se aplican solo a ${name}; si la escena alcanza a otros (una trampa, una explosión, un derrumbe, un veneno en la comida, una bendición para todos), di a quién con "afectadosDanio" y "afectadosCuracion" (y "afectados" dentro de cada cambio de "condiciones" o "extremidades"): una lista de nombres del grupo o ["todos"]. Cada afectado recibe la cantidad completa de "danio" o "curacion". El oro es común del grupo.

` : ''}Personaje${group ? ' que actúa' : ' del jugador'}: ${name}, ${character.race || ''} ${character.class || ''}.
- Puntos de golpe: ${character.hp}/${character.maxHp}. Armadura (CA): ${character.ac ?? '?'}. Dinero${group ? ' del grupo' : ''}: ${formatCoins(character.gold)} (po = oro, pp = plata, pc = cobre).
- Atributos: ${describeStats(character.stats)}.${inventory ? `\n- Inventario: ${inventory}.` : ''}
- ${describeEquipmentForPrompt(character)}${conditions ? `\n- Condiciones: ${conditions}. El juego ya aplica sus efectos a las tiradas; tenlas en cuenta al narrar.` : ''}${describeBuild(character)}

${summary ? `Resumen de la campaña hasta ahora:
"""
${summary}
"""

` : ''}${events.length ? `Hechos registrados por el juego: ${events.join(' · ')}.

` : ''}${quests && !structured ? `Misiones activas de ${name}: ${quests}.

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

/**
 * Validate who a scene effect hits: up to four short names or ids, or "todos".
 * Null when the reply names nobody (the effect goes to whoever acts). The names
 * are matched against the party by the game (see resolveTargets in party.js).
 * @returns {string[] | null}
 */
export function cleanTargets(list) {
  const raw = Array.isArray(list) ? list : typeof list === 'string' ? [list] : [];
  const names = [...new Set(raw
    .filter(t => typeof t === 'string')
    .map(t => t.trim().replace(/\s+/g, ' ').slice(0, TARGET_MAX))
    .filter(Boolean))];
  if (!names.length) return null;
  if (names.some(n => n.toLowerCase() === ALL_TARGETS)) return [ALL_TARGETS];
  return names.slice(0, MAX_TARGETS);
}
const targetsKey = targets => (targets ? targets.map(t => t.toLowerCase()).sort().join('|') : '');

function toInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

/**
 * Validate the limb changes of a reply: known limbs and states only, one change
 * per limb and set of targets (the last one wins).
 * @returns {{limb, status, targets?}[]}  targets: who it hits (see cleanTargets); none = whoever acts
 */
export function cleanLimbChanges(list) {
  if (!Array.isArray(list)) return [];
  const byLimb = new Map();
  list.slice(0, MAX_LIMB_CHANGES * 2).forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const limb = LIMB_REPLY_IDS[String(entry.extremidad || '').trim()];
    const status = LIMB_REPLY_STATUSES[String(entry.estado || '').trim().toLowerCase()];
    const targets = cleanTargets(entry.afectados);
    if (limb && status) byLimb.set(`${limb}#${targetsKey(targets)}`, { limb, status, ...(targets ? { targets } : {}) });
  });
  return [...byLimb.values()];
}

/**
 * Validate the condition changes of a reply: known conditions Duncan may use
 * (see STORY_CONDITION_IDS), "aplicar" / "quitar", a known duration (default
 * until a long rest), Exhaustion levels 1-6 and a short cause. One change per
 * condition and set of targets (the last one wins), at most MAX_CONDITION_CHANGES.
 * @returns {{ id, action: 'add' | 'remove', duration, level, cause, targets? }[]}
 *   targets: who it hits (see cleanTargets); none = whoever acts
 */
export function cleanConditionChanges(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  list.slice(0, MAX_CONDITION_CHANGES * 2).forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const id = String(entry.condicion || '').trim().toLowerCase();
    const action = CONDITION_REPLY_ACTIONS[String(entry.accion || '').trim().toLowerCase()];
    if (!STORY_CONDITION_IDS.includes(id) || !action) return;
    const duration = CONDITION_REPLY_DURATIONS[String(entry.duracion || '').trim()] || { rest: 'long' };
    const levels = Math.round(Number(entry.niveles));
    const level = id === 'agotamiento' ? Math.min(EXHAUSTION_MAX, Math.max(1, Number.isFinite(levels) ? levels : 1)) : null;
    const cause = typeof entry.causa === 'string' ? entry.causa.trim().replace(/\s+/g, ' ').slice(0, CONDITION_CAUSE_MAX) : '';
    const targets = cleanTargets(entry.afectados);
    const key = `${id}#${targetsKey(targets)}`;
    byId.delete(key);
    byId.set(key, { id, action, duration, level, cause, ...(targets ? { targets } : {}) });
  });
  return [...byId.values()].slice(-MAX_CONDITION_CHANGES);
}

/**
 * Validate the shop Duncan opens: "herrero" | "alquimista" | "general" (or an
 * object with that "tipo") -> 'smith' | 'alchemist' | 'general'; null otherwise.
 */
export function cleanShopRequest(value) {
  const raw = value && typeof value === 'object' ? value.tipo : value;
  if (typeof raw !== 'string') return null;
  return SHOP_REPLY_IDS[raw.trim().toLowerCase()] || null;
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
        damageTargets: cleanTargets(data.afectadosDanio),
        healingTargets: cleanTargets(data.afectadosCuracion),
        goldEarned: toInt(data.oro, -gold, 500),
        xpEarned: toInt(data.experiencia, 0, 300),
        usedRoll: data.usaTirada === true,
        summary: cleanSummary(data.resumen),
        combat: data.combate && Array.isArray(data.combate.enemigos) && data.combate.enemigos.length ? data.combate : null,
        shop: cleanShopRequest(data.tienda),
        limbChanges: cleanLimbChanges(data.extremidades),
        conditionChanges: cleanConditionChanges(data.condiciones),
        questChanges: cleanQuestChanges(data.misiones),
        recruit: cleanRecruitOffer(data.reclutar),
        departure: cleanDeparture(data.abandona)
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
    damageTargets: null,
    healingTargets: null,
    goldEarned: 0,
    xpEarned: 0,
    summary: null,
    combat: null,
    shop: null,
    limbChanges: [],
    conditionChanges: [],
    questChanges: [],
    recruit: null,
    departure: null,
    // Plain text can't tell us reliably; look for the dice marker the prompt asks for
    usedRoll: text.includes('🎲')
  };
}
