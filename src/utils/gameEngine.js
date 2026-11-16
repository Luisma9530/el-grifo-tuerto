// Core RPG & Story Game Engine for El Grifo Tuerto
import { tavernAudio } from './audio';
import { buildDMPrompt, parseDMReply, DM_RESPONSE_SCHEMA } from './dmPrompt';

// Helper to calculate D&D stat modifier from score (e.g. 16 -> +3, 10 -> 0, 8 -> -1)
export function getModifier(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function getModifierNumber(score) {
  return Math.floor((score - 10) / 2);
}

// Roll any polyhedral die (d4, d6, d8, d10, d12, d20, d100)
// Pass { silent: true } when the roll will be shown with animateRoll(), which
// plays its own sounds in sync with the 3D dice.
export function rollDie(sides = 20, { silent = false } = {}) {
  const val = Math.floor(Math.random() * sides) + 1;
  if (!silent) tavernAudio.playDiceRoll();
  return val;
}

// Roll a full D&D check with a character stat modifier
export function rollCheckWithStat(statValue, statName = 'Tirada', dc = 12, { silent = false } = {}) {
  const rawRoll = rollDie(20, { silent });
  const mod = getModifierNumber(statValue);
  const total = rawRoll + mod;

  const isNat20 = rawRoll === 20;
  const isNat1 = rawRoll === 1;
  const success = isNat20 ? true : isNat1 ? false : total >= dc;

  if (!silent) {
    if (isNat20) {
      tavernAudio.playCritSuccess();
    } else if (isNat1) {
      tavernAudio.playCritFail();
    }
  }

  return {
    rawRoll,
    modifier: mod,
    total,
    dc,
    statName,
    success,
    isNat20,
    isNat1
  };
}

// Storage and Key Pooling helpers for BYOK (Bring Your Own Key) Multi-Player setup
export function getStoredGeminiKeys() {
  try {
    const raw = localStorage.getItem('tavern_gemini_keys');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map(item => (typeof item === 'string' ? { id: item, label: 'Clave', key: item } : item))
          .filter(item => item && item.key && item.key.trim().length > 10);
      }
    }
    const single = localStorage.getItem('tavern_gemini_key');
    if (single && single.trim().length > 10) {
      return [{ id: 'default', label: 'Mi Clave Principal', key: single.trim() }];
    }
  } catch (e) {
    console.error('Error al recuperar claves de Gemini:', e);
  }
  return [];
}

export function saveStoredGeminiKeys(keyList) {
  try {
    localStorage.setItem('tavern_gemini_keys', JSON.stringify(keyList));
    if (keyList.length > 0) {
      localStorage.setItem('tavern_gemini_key', keyList[0].key);
    } else {
      localStorage.removeItem('tavern_gemini_key');
    }
  } catch (e) {
    console.error('Error al guardar claves de Gemini:', e);
  }
}

// Google retires Gemini models regularly (gemini-1.5-flash was shut down in
// September 2025). The "-latest" alias always points to the current Flash model,
// so the game keeps working without code changes.
export const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Live connection test against Google Gemini API
export async function testGeminiKey(key) {
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.trim() },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Di en una sola frase breve y con acento de tabernero: "¡Por las barbas de mi abuelo, conexión verificada en la taberna!"' }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || `Código HTTP ${response.status}`;
      return { success: false, error: msg };
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '¡Conexión verificada con éxito!';
    return { success: true, reply };
  } catch (err) {
    return { success: false, error: err.message || 'Error de red al conectar con Google' };
  }
}

async function postGemini(key, prompt, generationConfig) {
  return fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(generationConfig ? { generationConfig } : {})
    })
  });
}

// Ask Gemini for Duncan's reply. Requests structured JSON (narration + damage, gold,
// whether the d20 was used); if the model rejects that request format (HTTP 400),
// retries once with the plain-text format.
// Returns { ok: true, text } or { ok: false, status }.
async function askGemini(key, context) {
  let response = await postGemini(key, buildDMPrompt({ ...context, structured: true }), {
    responseMimeType: 'application/json',
    responseSchema: DM_RESPONSE_SCHEMA
  });

  if (response.status === 400) {
    response = await postGemini(key, buildDMPrompt({ ...context, structured: false }), null);
  }
  if (!response.ok) return { ok: false, status: response.status };

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  return { ok: true, text };
}

// Module-level rotation pointer for Round-Robin multi-player token pool
let currentKeyRotationIndex = 0;

// Procedural AI Story Master (Maese Duncan's brain)
// Analyzes player natural language input, character, world and produces vivid narrative responses
// `playerRoll` (optional): a check the player already rolled, { rawRoll, total, success, isNat20, isNat1 }.
// The procedural engine then uses it instead of rolling behind the screen.
// The response may include `roll: { sides, value }` when Duncan rolled a die whose
// result is mentioned in the text, so the UI can show it before the narration.
export async function generateDMResponse({ playerAction, character, world, history = [], apiKey = null, apiKeys = [], playerRoll = null }) {
  // Build active keys pool (from params or persistent storage)
  let pool = [];
  if (Array.isArray(apiKeys) && apiKeys.length > 0) {
    pool = apiKeys.map(k => (typeof k === 'string' ? k : k.key));
  } else if (apiKey && apiKey.trim().length > 10) {
    pool = [apiKey.trim()];
  } else {
    const stored = getStoredGeminiKeys();
    pool = stored.map(k => k.key);
  }

  // Deduplicate and filter valid keys
  pool = [...new Set(pool.filter(k => k && k.trim().length > 10))];

  // If we have one or more Gemini keys in the pool, attempt generation with Round-Robin & Fallback
  if (pool.length > 0) {
    const startIndex = currentKeyRotationIndex % pool.length;

    // The die is rolled here, not by the AI: Duncan must use this number when the
    // action needs a roll, and the UI shows the 3D die if he did.
    const d20 = playerRoll ? playerRoll.rawRoll : rollDie(20, { silent: true });

    for (let attempt = 0; attempt < pool.length; attempt++) {
      const activeIdx = (startIndex + attempt) % pool.length;
      const keyToUse = pool[activeIdx];

      try {
        const reply = await askGemini(keyToUse, { playerAction, character, world, history, d20, playerRoll });

        if (reply.ok) {
          const parsed = parseDMReply(reply.text, character);
          if (parsed) {
            // Advance rotation index for the next player action
            currentKeyRotationIndex = (activeIdx + 1) % pool.length;
            return {
              text: parsed.text,
              suggestedActions: parsed.suggestedActions,
              damageTaken: parsed.damageTaken,
              healing: parsed.healing,
              goldEarned: parsed.goldEarned,
              roll: parsed.usedRoll && !playerRoll ? { sides: 20, value: d20 } : null,
              source: 'gemini',
              keyIndex: activeIdx,
              totalKeys: pool.length
            };
          }
        } else {
          console.warn(`[Duncan Engine] Clave ${activeIdx + 1}/${pool.length} devolvió HTTP ${reply.status}. Rotando a la siguiente clave del grupo...`);
        }
      } catch (e) {
        console.warn(`[Duncan Engine] Error de conexión con clave ${activeIdx + 1}:`, e);
      }
    }

    console.warn('[Duncan Engine] Todas las claves de Gemini en el pool alcanzaron límite o fallaron. Activando motor procedural de respaldo.');
  }

  // Built-in intelligent procedural Maese Duncan engine
  // Simulates dice roll behind the screen and produces richly tailored contextual outputs
  const actionLower = playerAction.toLowerCase();
  // Sounds for this roll are played by the dice animation (see `roll` in the result)
  const rollResult = playerRoll ? playerRoll.rawRoll : rollDie(20, { silent: true });
  const isHighRoll = playerRoll ? playerRoll.success : rollResult >= 12;
  const isCrit = rollResult === 20;
  const isCritFail = rollResult === 1;

  let text = '';
  let suggestedActions = [];
  let damageTaken = 0;
  let goldEarned = 0;

  // The player rolled an ability check from the character sheet: narrate its outcome
  if (playerRoll) {
    const stat = playerRoll.statName || 'habilidad';
    const rollTag = `[🎲 ${stat} D20: **${playerRoll.rawRoll}** = ${playerRoll.total} vs CD ${playerRoll.dc}]`;
    if (isCrit) {
      goldEarned = 5;
      text = `*(Maese Duncan deja de fregar la jarra y silba entre dientes)* ${rollTag} **¡CRÍTICO!**

${character.name} lo borda: la prueba de ${stat} sale con tanta limpieza que hasta el gato de la taberna levanta la cabeza. Un parroquiano impresionado te desliza **5 monedas de oro** por el espectáculo.

—*Así se hace, demonios. Con esa mano, lo que te propongas esta noche está a tu alcance. ¿Y bien, qué vas a hacer con tanta suerte?*`;
    } else if (isCritFail) {
      damageTaken = 2;
      text = `*(Duncan se tapa el ojo bueno con la mano)* ${rollTag} **¡PIFIA!**

La prueba de ${stat} se tuerce de la peor manera posible: tropiezas, tiras una bandeja y acabas en el suelo entre risotadas *(pierdes 2 HP y bastante dignidad)*.

—*He visto borrachos caer con más elegancia. Levanta, sacúdete el serrín y dime qué plan tienes ahora, porque ese no ha colado.*`;
    } else if (isHighRoll) {
      text = `Maese Duncan asiente despacio, sin dejar de secar el mostrador ${rollTag} **(Éxito)**.

Tu prueba de ${stat} sale como esperabas: superas el obstáculo y ganas algo de ventaja. Un par de cabezas se giran con un respeto recién estrenado.

—*No está mal, ${character.name}. Has abierto camino; ahora aprovéchalo antes de que alguien se lo piense dos veces.*`;
    } else {
      text = `Duncan chasquea la lengua y niega con la cabeza ${rollTag} **(Fallo)**.

La prueba de ${stat} no sale: te quedas corto por poco y la ocasión se te escapa entre los dedos. Nadie ha salido herido, pero ahora te vigilan más de cerca.

—*Hoy no era tu día para eso, chaval. Prueba otra cosa... o invita a una ronda y aquí no ha pasado nada.*`;
    }
    suggestedActions = isHighRoll || isCrit
      ? [
          'Aprovechar la ventaja y seguir adelante',
          'Preguntar a Duncan qué sabe del asunto',
          'Examinar con calma lo que has descubierto',
          'Brindar por la hazaña en la barra'
        ]
      : [
          'Intentarlo de otra manera',
          'Pedir ayuda a los parroquianos',
          'Disimular y pedir una jarra',
          'Preguntar a Duncan por otra opción'
        ];
  }

  // Combat / Attack actions
  else if (actionLower.includes('atacar') || actionLower.includes('golpe') || actionLower.includes('espada') || actionLower.includes('disparar') || actionLower.includes('pelear') || actionLower.includes('puñetazo') || actionLower.includes('matar')) {
    if (isCrit) {
      text = `¡POR LAS BARBAS DE MI ABUELO! *(Maese Duncan salta tras la barra con una sonrisa torcida)*. 
${character.name} se mueve con una precisión escalofriante [🎲 Tirada D20: **20 ¡CRÍTICO!**]. 

Tu golpe conecta de lleno en el punto exacto: el enemigo retrocede tambaleándose, derribando dos taburetes y esparciendo fragmentos de madera y un tintineo metálico por el suelo. 

—*¡Eso es lo que yo llamo resolver una disputa con estilo!* —brama Duncan mientras recoge un par de monedas del suelo y te las lanza con un guiño—. *Aunque me debes diez cobres por la banqueta astillada, chaval.*`;
      goldEarned = 15;
      suggestedActions = [
        'Rematar al rival o exigir que hable',
        'Registrar los bolsillos del caído',
        'Pedir una ronda triunfal en la barra',
        'Interrogar a los testigos aterrorizados'
      ];
    } else if (isCritFail) {
      damageTaken = 4;
      text = `*Ouch.* Las botas se te resbalan en un charco de cerveza añeja y manteca derramada [🎲 Tirada D20: **1 ¡PIFIA!**]. 

Tu acometida falla miserablemente, tu arma golpea una viga de hierro con un estruendo que te entumece la muñeca, y el contraataque te sacude la mandíbula *(Pierdes 4 HP)*.

Maese Duncan se tapa la cara con una mano mugrienta y suspira entre risitas secas:
—*Si querías darle un cabezazo al pilar de carga, podías haberme avisado. Anda, levanta el trasero antes de que te pisoteen como a una cucaracha.*`;
      suggestedActions = [
        'Beber una poción de curación rápido',
        'Retroceder a la defensiva y cubrirte',
        'Lanzarle una jarra a la cara para ganar tiempo',
        'Pedir ayuda a los parroquianos'
      ];
    } else if (isHighRoll) {
      text = `Te lanzas al combate con agilidad [🎲 Tirada D20: **${rollResult} (Éxito)**]. 

Tu acometida surte efecto: consigues esquivar el primer zarpazo y le asestas un impacto contundente que lo deja jadeando contra una de las mesas de roble. La taberna enmudece por un instante antes de que comiencen los silbidos y vítores de los borrachos.

Maese Duncan se apoya tranquilamente con un trapo en la mano:
—*No está mal para alguien que aún no se ha terminado la primera pinta. El tipo está herido y su compañero parece dudar si intervenir.*`;
      suggestedActions = [
        'Exigirle que suelte las armas de inmediato',
        'Desarmarlo con un barrido de pierna',
        'Mirar fijamente a su compañero para intimidarlo',
        'Empujarlo fuera de la taberna a la lluvia'
      ];
    } else {
      damageTaken = 3;
      text = `Intentas golpear con rapidez, pero la penumbra y el espacio reducido te juegan una mala pasada [🎲 Tirada D20: **${rollResult} (Fallo)**]. 

El adversario bloquea tu trayectoria y responde con un codazo seco en las costillas que te deja sin aire *(Recibes 3 puntos de daño)*.

—*¡Cuidado con la cristalería!* —te grita Duncan desde la barra señalándote con su pipa—. *La cerveza es sagrada en este establecimiento, ¡partíos la cara si queréis pero no derraméis el barril de roble!*`;
      suggestedActions = [
        'Adoptar postura defensiva',
        'Usar el entorno: voltear una mesa para cubrirte',
        'Desenvainar un arma secundaria',
        'Lanzar un hechizo o truco rápido'
      ];
    }
  }

  // Drinking / Tavern interactions
  else if (actionLower.includes('beber') || actionLower.includes('cerveza') || actionLower.includes('hidromiel') || actionLower.includes('trago') || actionLower.includes('jarra') || actionLower.includes('comer') || actionLower.includes('guiso')) {
    tavernAudio.playTankardClink();
    text = `Maese Duncan suelta una carcajada gutural y desliza una jarra de peltre desportillada por el mostrador, deteniéndose justo frente a ti sin derramar ni una sola gota de espuma dorada.

—*Sabia elección, viajero. Quien no bebe en mi casa, o es un espía de la corona o le falta un hervor.*

El brebaje entra ardiendo como fuego líquido. Sientes un calor reconfortante extendiéndose por el pecho que apacigua el frío de los caminos.

—*Esa tanda la destiló un primo lejano en las colinas. Dicen que cura el reuma y despierta a los muertos... aunque lo segundo solo pasó dos veces.* —Duncan se inclina hacia ti bajando la voz—. *Ahora que tienes la garganta húmeda, cuéntame: ¿qué asuntos te traen de verdad a ${world.name}?*`;
    suggestedActions = [
      'Preguntar por los rumores del monstruo / forajidos',
      'Pagar una ronda para ganarte la simpatía de la sala',
      'Preguntar qué sabe sobre el mapa o artefacto',
      'Examinar discretamente a los demás clientes'
    ];
  }

  // Stealth / Theft / Sneaking actions
  else if (actionLower.includes('sigilo') || actionLower.includes('esconder') || actionLower.includes('robar') || actionLower.includes('sombras') || actionLower.includes('abrir') || actionLower.includes('ganzua') || actionLower.includes('bolsillo')) {
    if (isHighRoll) {
      goldEarned = 12;
      text = `Te deslizas entre las sombras con la suavidad del humo de tabaco [🎲 Sigilo D20: **${rollResult} (Éxito)**].

Nadie en la sala nota cómo tus dedos rozan el objetivo. Logras deslizar una bolsa de cuero abultada con **12 monedas de oro** sin que la víctima sospeche lo más mínimo. 

Al volver a tu sitio, notas que Maese Duncan te está mirando con una ceja levantada y una sonrisa socarrona mientras limpia una copa.
—*Buena mano, sombra. Pero como toques mi caja fuerte, te juro que la próxima jarra la serviré con arsénico.*`;
      suggestedActions = [
        'Examinar el contenido misterioso de la bolsa',
        'Guardar silencio y disimular bebiendo tranquilamente',
        'Buscar una ventana o salida secundaria',
        'Ofrecerle a Duncan una moneda por su complicidad'
      ];
    } else {
      text = `Un tablón chirría bajo tu peso con un sonido que parece un graznido de cuervo [🎲 Sigilo D20: **${rollResult} (Fallo)**]. 

Varias miradas se clavan inmediatamente en ti. El sujeto al que intentabas vigilar se incorpora bruscamente, palpándose la faja con el ceño fruncido.

Duncan tose ruidosamente fingiendo limpiar el mostrador para amortiguar el revuelo:
—*¡Vaya, parece que el suelo tiene carcoma! Forastero, si buscas el retrete está al fondo a la derecha, no hace falta que vayas dando saltitos como una ardilla asustada.*`;
      suggestedActions = [
        'Fingir embriaguez para desviar sospechas',
        'Afrontar la situación con una disculpa diplomática',
        'Desenvainar el arma por si las cosas se tuercen',
        'Preguntar la hora con descaro'
      ];
    }
  }

  // Magic / Spells
  else if (actionLower.includes('magia') || actionLower.includes('hechizo') || actionLower.includes('conjuro') || actionLower.includes('fuego') || actionLower.includes('arcano') || actionLower.includes('ilusion') || actionLower.includes('curar')) {
    text = `Comienzas a entonar palabras en una lengua olvidada mientras runas titilantes de color amatista y oro giran alrededor de tus dedos [🎲 Concentración D20: **${rollResult}**].

El aire se carga de electricidad estática. Las llamas de las velas de la taberna se inclinan al unísono hacia tu mano. Un murmullo de respeto y temor recorre a los presentes.

Maese Duncan no se inmuta lo más mínimo; de hecho, utiliza una chispa residual de tu magia para encender la cazoleta de su pipa:
—*Materia prima de primera calidad. Pero ojo con chamuscarme las cortinas, aprendiz. El último mago que invocó un elemental de agua aquí dentro me dejó la bodega inundada de ranas cantarinas durante una semana.*

El efecto del conjuro se manifiesta plenamente ante tus ojos, revelando pistas ocultas en la habitación.`;
    suggestedActions = [
      'Canalizar la magia para buscar presencias ocultas',
      'Lanzar un pulso de detección sobre el encapuchado',
      'Desvanecer el fulgor y disimular el poder',
      'Usar el hechizo para convencer al tabernero'
    ];
  }

  // Conversation / Inquiring / Perception
  else {
    text = `Maese Duncan suelta una bocanada de humo azulado que forma la silueta de un grifo alado antes de dispersarse en el techo de vigas ennegrecidas.

—*Bien dicho, muchacho. Pocos entran aquí escuchando en vez de ladrando.* —Duncan se asoma a la barra y baja la voz—. *El asunto en ${world.name} está que arde. La facción de los ${world.factions[1]?.name || 'herejes'} ha estado reuniéndose en el muelle abandonado. Y la Guardia... bueno, la Guardia cobra su sueldo tanto de día como de noche, si entiendes lo que quiero decir.*

Fuera, un trueno lejano retumba haciendo vibrar las botellas en la estantería. Desde el piso de arriba, unos pasos pesados cruzan el pasillo de madera.

—*La noche es joven y el mundo es peligroso. Tú decides cuál es tu siguiente paso: el oro, la gloria o una tumba sin nombre.*`;
    suggestedActions = [
      'Investigar los ruidos del piso de arriba',
      'Preguntar por una recompensa o misión abierta',
      'Dirigirte a la salida hacia el muelle de la niebla',
      'Retar a alguien en la taberna a una partida de dados'
    ];
  }

  return {
    text,
    suggestedActions,
    damageTaken,
    healing: 0,
    goldEarned,
    // Only when Duncan's own roll is mentioned in the narration
    roll: !playerRoll && text.includes('🎲') ? { sides: 20, value: rollResult } : null
  };
}
