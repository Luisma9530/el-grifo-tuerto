// Core RPG & Story Game Engine for El Grifo Tuerto
import { tavernAudio } from './audio';
import { buildDMPrompt, parseDMReply, dmResponseSchema } from './dmPrompt';
import { requestGemini } from './geminiClient';
import { narrateSpell, narrateRest, narrateAttack } from './spellNarration';
import { narrateCombatEnd, startLocalFight, isAggressive, shopForAction, narrateShopOpening } from './combatNarration';
import { describeQuestsForPrompt } from './quests';
import { localQuestScene, bestiaryForHunts } from './localQuests';
import { localRecruitScene } from './localRecruit';
import { rollDie } from './dice';
import { getStoredGeminiKeys } from './geminiKeys';
import { readCombatStart, localSurprise, localAmbush, isWildExploration } from './surprise';
import { localHook, hookParagraph, narrateMeeting } from './origins';
import { planLocalCheck, resolveCheck, resolveOpponent, findCheck } from './checks';
import { narrateLocalCheck, narrateDuncanCheck } from './checkNarration';

// Dice, modifiers and the stored Gemini keys live in their own small modules
// (re-exported here so every existing import keeps working)
export { getModifier, getModifierNumber, rollDie, rollCheck, rollCheckWithStat } from './dice';
export { getStoredGeminiKeys, saveStoredGeminiKeys, testGeminiKey } from './geminiKeys';

// Ask Gemini for Duncan's reply. Requests structured JSON (narration + damage, gold,
// whether the d20 was used); if the model rejects that request format, retries
// once with the plain-text format.
// Returns { ok: true, text } or { ok: false, status, reason }.
async function askGemini(key, context) {
  const structured = await requestGemini(key, {
    prompt: buildDMPrompt({ ...context, structured: true }),
    generationConfig: { responseMimeType: 'application/json', responseSchema: dmResponseSchema(context.requestSummary, Boolean(context.bestiary), Boolean(context.allowShop), { allowRecruit: Boolean(context.allowRecruit), allowDeparture: Boolean(context.allowDeparture), allowMeetingHook: Boolean(context.meetingPlace) }) }
  });
  if (structured.ok || structured.reason !== 'bad-request') return structured;

  return requestGemini(key, { prompt: buildDMPrompt({ ...context, structured: false }) });
}

// Experience the local engine awards for a scene: risky actions resolved with a die
// give more when they go well; talking, buying and resting give little or nothing.
function localXp({ text, rest, spellXp, isCrit, isCritFail, isHighRoll }) {
  if (rest) return 0;
  if (spellXp != null) return spellXp;
  if (!text.includes('🎲')) return 5;
  if (isCrit) return 75;
  if (isCritFail) return 10;
  return isHighRoll ? 40 : 15;
}

const AI_FAILURE_NOTICES = {
  overloaded: 'Gemini está saturado ahora mismo: Duncan improvisa con el motor local en este turno.',
  network: 'No hay conexión con Gemini: Duncan improvisa con el motor local en este turno.',
  quota: 'Has alcanzado el límite gratuito de Gemini: Duncan sigue con el motor local hasta que se renueve.',
  key: 'Tu clave de Gemini no es válida o ha sido revocada: revísala en "Conectar IA". Duncan usa el motor local.',
  'bad-request': 'Gemini rechazó la petición: Duncan improvisa con el motor local en este turno.'
};

/** Remove "[🎲 ...]" roll tags (and the space before them) from a narration. */
export const stripRollTags = text => text.replace(/\s*\[🎲[^\]]*\]/gu, '').replace(/ {2,}/g, ' ').trim();

// Module-level rotation pointer for Round-Robin multi-player token pool
let currentKeyRotationIndex = 0;

// Gemini's per-minute limit: how many times a scene waits and tries again, and how long
const QUOTA_RETRIES = 2;
const QUOTA_WAIT_DEFAULT_MS = 20_000;
const QUOTA_WAIT_MIN_MS = 5_000;
const QUOTA_WAIT_MAX_MS = 40_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Procedural AI Story Master (Maese Duncan's brain)
// Analyzes player natural language input, character, world and produces vivid narrative responses
// `playerRoll` (optional): a check the player already rolled, { rawRoll, total, success, isNat20, isNat1 }.
// The procedural engine then uses it instead of rolling behind the screen.
// The response may include `roll: { sides, value }` when Duncan rolled a die whose
// result is mentioned in the text, so the UI can show it before the narration.
// `spellCast` (optional): a spell just cast by the player (see castSpell in spellcasting.js).
// `rest` (optional): 'long' | 'short' when the action is a rest.
// `effectsApplied`: the caller already changed HP / gold for this action (drinks, rests, healing).
export async function generateDMResponse({
  playerAction, character, world, history = [], apiKey = null, apiKeys = [], playerRoll = null,
  spellCast = null, rest = null, effectsApplied = false, weaponAttack = null,
  summary = '', events = [], requestSummary = false, bestiary = null, combatResult = null,
  allowShop = false, shopsHere = '', shopTypesHere = [], loot = null, quests = [], here = null,
  companions = '', partySize = 1, partyNames = [], allowRecruit = false, allowDeparture = false,
  lastWasAmbush = false,
  // The party is apart (see splitParty.js): `sceneNote` tells Duncan who is in this scene;
  // `meetingHook` { place, names, force }: this group still has no reason to go to the
  // meeting point (Duncan may give one; with `force`, the local engine gives it if he didn't);
  // `meeting` { joined, place }: groups that just met here (the meeting is narrated)
  sceneNote = '', meetingHook = null, meeting = null,
  // A party apart calls Duncan from several scenes at once: on Gemini's per-minute
  // limit this scene waits and retries, and `onQuotaWait(seconds)` tells it
  onQuotaWait = null, quotaSleep = undefined,
  // A check the player asked for from the sheet ({ skillId, ability, label }): the DC (or
  // who resists) comes from Duncan or the local table, and the game rolls it here.
  // `getMonster(id)`: the bestiary, for checks against a creature of it.
  // `contextText`: the last lines of the chronicle (what the player is trying)
  checkIntent = null, getMonster = null, contextText = ''
}) {
  const reply = await dmResponse({
    playerAction, character, world, history, apiKey, apiKeys, playerRoll, spellCast, rest, effectsApplied, weaponAttack,
    summary, events, requestSummary, bestiary, combatResult, allowShop, shopsHere, shopTypesHere, loot, quests, here,
    companions, partySize, partyNames, allowRecruit, allowDeparture, lastWasAmbush, sceneNote, meetingHook, meeting,
    onQuotaWait, ...(quotaSleep ? { quotaSleep } : {}), checkIntent, getMonster, contextText
  });
  // A reason to go to the meeting point: Duncan's, or the local engine's when it is due
  // (never in the reply that starts a fight or closes one)
  if (!meetingHook || reply.combat || combatResult) return { ...reply, meetingHook: null };
  if (reply.meetingHook) return { ...reply, meetingHook: { ...reply.meetingHook, source: 'duncan' } };
  if (!meetingHook.force) return { ...reply, meetingHook: null };
  const hook = { ...localHook(meetingHook.names, meetingHook.place, Math.random), source: 'local' };
  return { ...reply, text: `${reply.text}\n\n${hookParagraph(hook, meetingHook.place)}`, meetingHook: hook };
}

async function dmResponse({
  playerAction, character, world, history = [], apiKey = null, apiKeys = [], playerRoll = null,
  spellCast = null, rest = null, effectsApplied = false, weaponAttack = null,
  summary = '', events = [], requestSummary = false, bestiary = null, combatResult = null,
  allowShop = false, shopsHere = '', shopTypesHere = [], loot = null, quests = [], here = null,
  companions = '', partySize = 1, partyNames = [], allowRecruit = false, allowDeparture = false,
  lastWasAmbush = false, sceneNote = '', meetingHook = null, meeting = null,
  onQuotaWait = null, quotaSleep = sleep, checkIntent = null, getMonster = null, contextText = ''
}) {
  // Rests, finished fights and spells without an attack or a saving throw involve no d20 at all
  const needsNoRoll = Boolean(rest) || Boolean(weaponAttack) || Boolean(combatResult)
    || (spellCast && !spellCast.attack && (spellCast.spell.kind !== 'save' || Boolean(spellCast.targetSave)));
  // Every check of this scene is rolled the same way (with the acting member's sheet)
  const die = sides => rollDie(sides, { silent: true });
  const asked = checkIntent ? findCheck(checkIntent.skillId) || findCheck(checkIntent.ability) : null;
  const intent = asked ? { ...asked, label: checkIntent.label || asked.label } : null;
  const sceneText = [here?.name, here?.desc].filter(Boolean).join('. ');

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

  // Why the AI could not answer (null if it was not tried): shown to the player
  let aiFailure = null;

  // If we have one or more Gemini keys in the pool, attempt generation with Round-Robin & Fallback
  if (pool.length > 0) {
    const startIndex = currentKeyRotationIndex % pool.length;

    // The die is rolled here, not by the AI: Duncan must use this number when the
    // action needs a roll, and the UI shows the 3D die if he did.
    const d20 = playerRoll ? playerRoll.rawRoll : rollDie(20, { silent: true });

    // Per-minute limit (several scenes calling at once): wait as long as Google asks
    // (within limits) and try again, telling only this scene (`onQuotaWait`)
    let retryAfterMs = 0;
    for (let round = 0; round <= (onQuotaWait ? QUOTA_RETRIES : 0); round++) {
    if (round > 0) {
      if (aiFailure !== 'quota') break;
      const waitMs = Math.min(QUOTA_WAIT_MAX_MS, Math.max(QUOTA_WAIT_MIN_MS, retryAfterMs || QUOTA_WAIT_DEFAULT_MS));
      onQuotaWait(Math.round(waitMs / 1000), round);
      await quotaSleep(waitMs);
    }
    for (let attempt = 0; attempt < pool.length; attempt++) {
      const activeIdx = (startIndex + attempt) % pool.length;
      const keyToUse = pool[activeIdx];

      try {
        const reply = await askGemini(keyToUse, {
          playerAction, character, world, history, d20, playerRoll, spellCast, rest, effectsApplied,
          weaponAttack, summary, events, requestSummary, bestiary, combatResult, allowShop, shopsHere,
          quests: describeQuestsForPrompt(quests), companions, partySize, allowRecruit, allowDeparture,
          sceneNote, meetingPlace: meetingHook?.place || '', checkIntent: intent
        });

        if (reply.ok) {
          const parsed = parseDMReply(reply.text, character);
          if (parsed) {
            // Advance rotation index for the next player action
            currentKeyRotationIndex = (activeIdx + 1) % pool.length;
            // A fight starts: the game rolls it, so no dice tag in the narration
            const startsFight = Boolean(bestiary && parsed.combat);
            // A shop opens: the game sets prices and gold, so the narration moves no money
            const shop = allowShop && !startsFight ? parsed.shop : null;
            // A check: Duncan set the DC (or who resists), the game rolls it and keeps his outcome
            const rolled = !needsNoRoll && !playerRoll && !startsFight && !combatResult
              ? rollSceneCheck(parsed.check, { character, intent, getMonster, playerAction, contextText, sceneText, die })
              : null;
            if (rolled) Object.assign(parsed, rolled.effects);
            return {
              text: startsFight ? stripRollTags(parsed.text) : rolled ? narrateDuncanCheck(stripRollTags(parsed.text), rolled.check, rolled.outcome) : parsed.text,
              suggestedActions: parsed.suggestedActions,
              // After a finished fight: no damage, healing or XP from the narration (already resolved)
              damageTaken: combatResult ? 0 : parsed.damageTaken,
              // In a party: who the damage and healing hit (whoever acts when missing)
              damageTargets: combatResult ? null : parsed.damageTargets,
              healingTargets: combatResult ? null : parsed.healingTargets,
              healing: combatResult ? 0 : parsed.healing,
              // After a fight the loot was given by the game; in a shop the game handles the gold
              goldEarned: combatResult || shop ? 0 : parsed.goldEarned,
              xpEarned: rest || combatResult ? 0 : parsed.xpEarned,
              summary: parsed.summary,
              // Surprise and the hero's opening attack, validated (see surprise.js)
              combat: bestiary && parsed.combat
                ? readCombatStart(parsed.combat, { aggressive: isAggressive(playerAction.toLowerCase()), partyNames, actorId: character.id || null })
                : null,
              shop,
              // A finished fight is narrated as it happened: no new wounds from the narration
              limbChanges: combatResult ? [] : parsed.limbChanges || [],
              // Same for conditions; a fight that starts handles its own
              conditionChanges: combatResult || startsFight ? [] : parsed.conditionChanges || [],
              // Quests opened, updated or closed by the story (the game pays the rewards)
              questChanges: parsed.questChanges || [],
              // A companion offers to join, or a member leaves (the game validates and asks the player)
              recruit: allowRecruit && !startsFight && !combatResult ? parsed.recruit : null,
              departure: allowDeparture && !combatResult ? parsed.departure : null,
              meetingHook: parsed.meetingHook || null,
              // The check the game rolled for Duncan (none when a fight starts: the game rolls it)
              // (plain-text replies, and old saves of a spell, still use the d20 sent in the prompt)
              roll: rolled ? checkRoll(rolled.check)
                : parsed.usedRoll && !playerRoll && !needsNoRoll && !startsFight && (parsed.plain || spellCast?.spell.kind === 'save') ? { sides: 20, value: d20 } : null,
              check: rolled ? rolled.check : null,
              source: 'gemini',
              keyIndex: activeIdx,
              totalKeys: pool.length
            };
          }
          aiFailure = 'overloaded'; // answered, but with nothing usable
        } else {
          aiFailure = reply.reason;
          if (reply.retryAfterMs) retryAfterMs = reply.retryAfterMs;
          console.warn(`[Duncan Engine] Clave ${activeIdx + 1}/${pool.length} falló (${reply.reason}, HTTP ${reply.status}).`);
          // Google's side is saturated or unreachable: the other keys won't fare better
          if (reply.reason === 'overloaded' || reply.reason === 'network') break;
        }
      } catch (e) {
        aiFailure = 'network';
        console.warn(`[Duncan Engine] Error de conexión con clave ${activeIdx + 1}:`, e);
      }
    }
    }

    console.warn('[Duncan Engine] Gemini no está disponible ahora. Activando motor procedural de respaldo.');
  }

  // Built-in intelligent procedural Maese Duncan engine
  // Simulates dice roll behind the screen and produces richly tailored contextual outputs
  const actionLower = playerAction.toLowerCase();
  // Sounds for this roll are played by the dice animation (see `roll` in the result)
  const rollResult = playerRoll ? playerRoll.rawRoll : rollDie(20, { silent: true });
  // Brawls outside the fight system (no bestiary): the attack against an average guard
  const isHighRoll = playerRoll ? playerRoll.success : rollResult >= BRAWL_AC;
  const isCrit = rollResult === 20;
  const isCritFail = rollResult === 1;

  let text = '';
  let suggestedActions = [];
  let damageTaken = 0;
  let goldEarned = 0;

  // Rests and spells have their own narration
  let spellXp = null;
  let combat = null;
  let shop = null;
  let questChanges = [];
  let questScene = null;
  let recruit = null;
  let recruitScene = null;
  let ambush = null;
  // A check of the local table (see checks.js): its DC, who resists and the roll
  let localPlan = null;
  let localCheck = null;
  if (combatResult) {
    ({ text, suggestedActions, goldEarned } = narrateCombatEnd(combatResult, { character, rng: Math.random, loot }));
    spellXp = 0;
  } else if (meeting) {
    ({ text, suggestedActions } = narrateMeeting({ ...meeting, world }));
    spellXp = 0;
  } else if (bestiary && !playerRoll && isAggressive(actionLower)) {
    // A fight starts: the game resolves it with creatures of the bestiary. The
    // hero's attack is the opening strike; in a quiet scene nobody expected it
    const surprise = localSurprise({ actionText: playerAction, history, aggressive: true, actorId: character.id || null });
    ({ text, suggestedActions, combat } = startLocalFight(bestiaryForHunts(bestiary, quests), { character, world, rng: Math.random, surprise }));
    combat = { ...combat, surprise, heroAttacks: true, targetId: null };
    spellXp = 0;
  } else if (bestiary && !playerRoll && !rest && !spellCast && !weaponAttack && (ambush = localAmbush({ actionText: playerAction, here, rng: Math.random, lastWasAmbush }))) {
    // Exploring the wild: an ambush (the ambushers' Stealth against each hero's passive Perception)
    ({ text, suggestedActions, combat } = startLocalFight(bestiaryForHunts(bestiary, quests), { character, world, rng: Math.random, ambush: true }));
    combat = { ...combat, surprise: ambush, heroAttacks: false, targetId: null };
    spellXp = 0;
  } else if (rest) {
    ({ text, suggestedActions } = narrateRest(rest, character));
  } else if (weaponAttack) {
    let narration;
    ({ text, suggestedActions, ...narration } = narrateAttack(weaponAttack, { character }));
    spellXp = narration.xp;
  } else if (spellCast) {
    let narration;
    ({ text, suggestedActions, ...narration } = narrateSpell(spellCast, { character, enemyRoll: rollResult }));
    spellXp = narration.xp;
  }

  // The player rolled an ability check from the character sheet: narrate its outcome
  else if (playerRoll) {
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

  // A check the player asked for from the sheet: the local table sets its DC
  else if (intent) {
    localPlan = planLocalCheck(playerAction, { sceneText, intent, contextText });
    localCheck = rollPlannedCheck(localPlan, character, die);
    ({ text, suggestedActions, damageTaken, goldEarned } = narrateLocalCheck(localPlan, localCheck, { character, rng: Math.random }));
  }

  // Shops: the game opens the counter with its own prices
  else if (allowShop && (shop = shopForAction(actionLower, shopTypesHere))) {
    ({ text, suggestedActions } = narrateShopOpening(shop, { character, world }));
    spellXp = 0;
  }

  // Looking for companions: someone offers to join the party
  else if (allowRecruit && (recruitScene = localRecruitScene(actionLower, { character, partyNames, partySize, rng: Math.random }))) {
    ({ text, suggestedActions, recruit } = recruitScene);
    spellXp = 0;
  }

  // Work offered or handed over: a simple quest of the local engine
  else if ((questScene = localQuestScene(actionLower, { quests, world, character, here, bestiary, rng: Math.random }))) {
    ({ text, suggestedActions, questChanges } = questScene);
    spellXp = 0;
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

  // Climbing, sneaking, lying, picking a lock, remembering lore...: a check of the
  // local table, with a DC by kind of action and context (see LOCAL_DC_TABLE)
  else if ((localPlan = planLocalCheck(playerAction, { sceneText }))) {
    localCheck = rollPlannedCheck(localPlan, character, die);
    ({ text, suggestedActions, damageTaken, goldEarned } = narrateLocalCheck(localPlan, localCheck, { character, rng: Math.random }));
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
    xpEarned: localXp(localCheck
      ? { text, rest, spellXp, isCrit: localCheck.isNat20, isCritFail: localCheck.isNat1, isHighRoll: localCheck.success }
      : { text, rest, spellXp, isCrit, isCritFail, isHighRoll }),
    combat,
    shop,
    limbChanges: [],
    conditionChanges: [],
    questChanges,
    recruit,
    departure: null,
    // An exploration of the wild by the local engine: whether it met an ambush (the campaign
    // keeps it so two ambushes never come in a row); null for any other action
    exploration: bestiary && !playerRoll && !combatResult && !isAggressive(actionLower) && isWildExploration(playerAction, here)
      ? { ambushed: Boolean(ambush) }
      : null,
    // Set when Gemini keys exist but the AI could not answer this turn
    notice: aiFailure ? AI_FAILURE_NOTICES[aiFailure] || AI_FAILURE_NOTICES.overloaded : null,
    // Only when Duncan's own roll is mentioned in the narration (a check: with its DC or rival)
    roll: localCheck ? checkRoll(localCheck) : !playerRoll && !spellCast?.targetSave && text.includes('🎲') ? { sides: 20, value: rollResult } : null,
    check: localCheck
  };
}

/** Armor Class of a brawl the local engine narrates without the fight system. */
const BRAWL_AC = 12;

/** Roll a check the local engine planned (see planLocalCheck). */
function rollPlannedCheck(plan, character, die) {
  return resolveCheck({
    character, skillId: plan.skillId, ability: plan.ability, label: plan.checkLabel || '',
    dc: plan.dc, opponent: plan.opponent, rollDie: die
  });
}

/** The die the UI shows before the narration of a check (with its DC or who resists). */
export function checkRoll(check) {
  return {
    sides: 20, value: check.rawRoll, modifier: check.modifier, success: check.success,
    ...(check.dc != null ? { dc: check.dc } : {}), against: check.against, label: check.label
  };
}

/**
 * The check of a reply by Duncan (or the one the player asked for, if he set none):
 * rolled with the sheet of whoever acts against his DC or the one who resists.
 * Returns null when the scene has no check; else { check, outcome, effects }, with
 * `effects` the numbers of the outcome that replace those of the reply.
 */
function rollSceneCheck(request, { character, intent, getMonster, playerAction, contextText, sceneText, die }) {
  if (!request && !intent) return null;
  if (!request) {
    // He set no DC for the check the player asked for: the local table does
    const plan = planLocalCheck(playerAction, { sceneText, intent, contextText });
    return { check: rollPlannedCheck(plan, character, die), outcome: null, effects: {} };
  }
  const opponent = resolveOpponent(request.against, { getMonster });
  const check = resolveCheck({
    character, skillId: request.skillId, ability: request.ability, dc: request.dc,
    opponent, opposedSkill: request.against?.skillId || null, rollDie: die
  });
  const outcome = check.success ? request.success : request.failure;
  return {
    check,
    outcome,
    effects: {
      damageTaken: outcome.damageTaken, healing: outcome.healing, goldEarned: outcome.goldEarned, xpEarned: outcome.xpEarned,
      ...(outcome.suggestedActions ? { suggestedActions: outcome.suggestedActions } : {})
    }
  };
}
