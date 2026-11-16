// Prompt and reply handling for the AI Dungeon Master (Gemini).
// Pure functions: no network, no storage.

import { SKILLS } from '../data/srd';

const HISTORY_MESSAGES = 12;
const HISTORY_CHARS_PER_MESSAGE = 700;

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
    narracion: { type: 'STRING', description: 'La respuesta de Maese Duncan, de 2 a 4 párrafos.' },
    usaTirada: { type: 'BOOLEAN', description: 'true si el resultado dependió de la tirada de d20 proporcionada.' },
    danio: { type: 'INTEGER', description: 'Puntos de golpe que pierde el personaje (0 si ninguno).' },
    curacion: { type: 'INTEGER', description: 'Puntos de golpe que recupera el personaje (0 si ninguno).' },
    oro: { type: 'INTEGER', description: 'Monedas de oro ganadas (positivo) o gastadas/perdidas (negativo).' },
    opciones: { type: 'ARRAY', items: { type: 'STRING' }, description: '3 o 4 sugerencias breves de acción.' }
  },
  required: ['narracion', 'usaTirada', 'danio', 'curacion', 'oro', 'opciones']
};

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
 */
export function buildDMPrompt({ playerAction, character, world, history, d20, playerRoll = null, structured = true }) {
  const name = character.name || 'Aventurero';
  const location = world.mapNodes?.find(n => n.status === 'current')?.name || world.initialLocation;
  const inventory = (character.inventory || []).map(i => i.name).filter(Boolean).join(', ');

  const diceRules = playerRoll
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
- "opciones": 3 o 4 sugerencias breves de lo que puede hacer ahora.
Lo que cuentes en la narración debe coincidir con "danio", "curacion" y "oro".`
    : `Al final de tu respuesta, en una línea separada que empiece con "OPCIONES:", proporciona 3 o 4 sugerencias breves de acción separadas por una pleca "|". Por ejemplo: OPCIONES: Sacar el arma | Negociar con el tabernero | Escabullirse por la puerta trasera.
Mantén la respuesta en español, entre 2 y 4 párrafos inmersivos.`;

  return `Eres "Maese Duncan", el veterano, tosco, ingenioso y carismático tabernero tuerto y Dungeon Master de la taberna "El Grifo Tuerto".
Estás dirigiendo una partida de rol estilo D&D 5e en el mundo: "${world.name}" (${world.genre || 'fantasía'}).${location ? `\nUbicación actual: ${location}.` : ''}

Personaje del jugador: ${name}, ${character.race || ''} ${character.class || ''}.
- Puntos de golpe: ${character.hp}/${character.maxHp}. Armadura (CA): ${character.ac ?? '?'}. Oro: ${character.gold} monedas.
- Atributos: ${describeStats(character.stats)}.${inventory ? `\n- Inventario: ${inventory}.` : ''}${describeBuild(character)}

Crónica previa de la historia (mantén la coherencia con estos eventos):
"""
${formatHistory(history, name) || 'Inicio de la aventura en la taberna.'}
"""

El jugador acaba de realizar la siguiente acción:
"${playerAction}"

Dados:
${diceRules}

Instrucciones:
1. Responde con tu inconfundible voz de Maese Duncan (humor negro, sabiduría de taberna, descripciones vívidas y consecuencias palpables).
2. Respeta los hechos previos, la ficha y la historia del personaje (su clase, especie, trasfondo y rasgos deben notarse en la narración): no puede gastar oro que no tiene, y con pocos puntos de golpe el peligro es real.
3. Si sufre daño, se cura, gana o gasta oro, indícalo de forma dramática pero breve.
4. Concluye planteando un dilema inmediato o preguntando qué hará ahora.

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
        usedRoll: data.usaTirada === true
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
    // Plain text can't tell us reliably; look for the dice marker the prompt asks for
    usedRoll: text.includes('🎲')
  };
}
