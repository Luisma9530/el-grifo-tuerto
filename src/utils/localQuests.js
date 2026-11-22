// Simple quests of the local engine (no AI): when the scene asks for work (a
// notice board, a job, a reward), Duncan's local engine offers one from a few
// templates, and closes it when its goal is met:
//  - "caza": win the next fight (closed by the game when a fight is won);
//  - "recado": take something to another place of the map and hand it over
//    there (closed when the hero, at that place, says they deliver it).
// Pure functions: they return quest changes for applyQuestChanges.

import { activeQuests } from './quests';

/** The player asks for work. */
const ASKS_FOR_WORK = /tabl[oó]n|anuncio|encargo|misi[oó]n|trabajo|contrato|recompensa|faena/;
/** The player hands something over. */
const DELIVERS = /entreg|recado|paquete|carta|encargo|misi[oó]n/;

export const MAX_LOCAL_QUESTS = 2;

const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];

const HUNTS = [
  { title: 'Alimañas en el camino', objective: 'Acabar con lo que está atacando a los viajeros de los alrededores.', giver: 'el alguacil del pueblo' },
  { title: 'Bandidos en el cruce', objective: 'Dar una lección a la banda que asalta las carretas del cruce.', giver: 'un carretero desesperado' },
  { title: 'Algo ronda de noche', objective: 'Encontrar y vencer a la criatura que merodea cuando cae el sol.', giver: 'la guardia local' }
];

const ERRANDS = [
  { title: 'Una carta lacrada', item: 'una carta lacrada', giver: 'un escribano nervioso' },
  { title: 'Un paquete sin preguntas', item: 'un paquete atado con cordel', giver: 'una mercader de mirada esquiva' },
  { title: 'Medicinas urgentes', item: 'un saquito de hierbas medicinales', giver: 'la curandera del lugar' }
];

/** Gold the local engine promises for a quest (the game caps it anyway). */
const promisedGold = (level, rng, base) => Math.round((base + rng() * base) * Math.max(1, Number(level) || 1));

/**
 * The quest scene of the local engine for this action, or null when the
 * action has nothing to do with quests.
 * @returns {{ text, suggestedActions, questChanges } | null}
 */
export function localQuestScene(actionLower, { quests = [], world, character, here = null, rng = Math.random }) {
  const name = character?.name || 'Aventurero';
  const local = activeQuests(quests).filter(q => q.goal);

  // An errand for this place: hand it over
  const errand = here && local.find(q => q.goal.kind === 'errand' && q.goal.nodeId === here.id);
  if (errand && DELIVERS.test(actionLower)) {
    return {
      text: `Preguntas por el destinatario y no tardas en dar con él en ${here.name}. Le entregas ${errand.goal.item}; lo sopesa, rompe el cordel con los dientes y asiente despacio.

—*Llega a tiempo, y entero. Dile a quien te envía que la deuda está saldada.*

Cuando vuelves a mirar, ${name} tiene la paga en la mano y un encargo menos en la cabeza.`,
      suggestedActions: ['Preguntar qué había dentro', 'Buscar una posada para descansar', 'Volver a la taberna', 'Preguntar si hay más trabajo'],
      questChanges: [{ action: 'complete', id: errand.id, note: `Entregado en ${here.name}.` }]
    };
  }

  if (!ASKS_FOR_WORK.test(actionLower)) return null;

  if (local.length >= MAX_LOCAL_QUESTS) {
    const titles = local.map(q => `«${q.title}»`).join(' y ');
    return {
      text: `Maese Duncan te mira por encima de la jarra que está secando.

—*¿Más trabajo? Todavía tienes pendiente ${titles}. Termina lo que empezaste, ${name}, que aquí la gente tiene memoria y poca paciencia.*`,
      suggestedActions: ['Repasar el diario de misiones', 'Ponerte en camino', 'Pedir una jarra antes de salir', 'Preguntar por rumores'],
      questChanges: []
    };
  }

  const level = character?.level || 1;
  const others = (world?.mapNodes || []).filter(n => n.status !== 'locked' && n.id !== here?.id);
  const hasHunt = local.some(q => q.goal.kind === 'hunt');
  const errandTarget = others.length ? pick(others, rng) : null;
  const makeErrand = errandTarget && (hasHunt || rng() < 0.5);
  const place = here?.name || world?.initialLocation || '';

  if (makeErrand) {
    const t = pick(ERRANDS, rng);
    const gold = promisedGold(level, rng, 8);
    return {
      text: `Duncan se inclina sobre la barra y señala con la barbilla a ${t.giver}, que aguarda junto a la puerta sin quitarse la capa.

—*Busca a alguien de fiar para llevar ${t.item} hasta ${errandTarget.name}. Paga ${gold} monedas al entregarlo. Yo no haría preguntas.*

Aceptas el encargo y te guardas ${t.item} bajo la ropa.`,
      suggestedActions: [`Viajar hacia ${errandTarget.name}`, 'Preguntar quién es el destinatario', 'Pedir algo de comer antes de salir', 'Examinar el encargo'],
      questChanges: [{
        action: 'open',
        title: t.title,
        giver: t.giver,
        place,
        objective: `Llevar ${t.item} hasta ${errandTarget.name} y hacer la entrega allí.`,
        reward: { gold, xp: true, importance: 'menor' },
        goal: { kind: 'errand', nodeId: errandTarget.id, item: t.item }
      }]
    };
  }

  const t = pick(HUNTS, rng);
  const gold = promisedGold(level, rng, 12);
  return {
    text: `Maese Duncan arranca un pliego clavado junto a la chimenea y lo deja frente a ti, todavía con el clavo puesto.

—*Lo ha dejado ${t.giver}. ${t.objective} Ofrecen ${gold} monedas, y por lo que cuentan se las han ganado ya varios muertos.*

Doblas el pliego y lo guardas: el trabajo es tuyo.`,
    suggestedActions: ['Preguntar dónde se le vio por última vez', 'Salir a buscarlo', 'Prepararse antes de partir', 'Preguntar quién más lo ha intentado'],
    questChanges: [{
      action: 'open',
      title: t.title,
      giver: t.giver,
      place,
      objective: t.objective,
      reward: { gold, xp: true, importance: 'normal' },
      goal: { kind: 'hunt' }
    }]
  };
}

/** A fight was won: the hunting quests of the local engine are done. */
export function huntChangesAfterVictory(quests) {
  return activeQuests(quests)
    .filter(q => q.goal?.kind === 'hunt')
    .map(q => ({ action: 'complete', id: q.id, note: 'La amenaza ha caído en combate.' }));
}
