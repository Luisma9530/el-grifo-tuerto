// Simple quests of the local engine (no AI): when the scene asks for work (a
// notice board, a job, a reward), Duncan's local engine offers one from a few
// templates, and closes it when its goal is met:
//  - "caza": defeat (kill or make surrender) the creature, or the type of
//    creature, named when the quest is opened, chosen among the creatures the
//    hero can meet at their level in this world. The game closes it when a
//    won fight includes that target; any other victory does not count;
//  - "recado": take something to another place of the map and hand it over
//    there (closed when the hero, at that place, says they deliver it).
// Pure functions: they return quest changes for applyQuestChanges.

import { activeQuests } from './quests';
import { characterLevel } from './characterLevel';

/** The player asks for work. */
const ASKS_FOR_WORK = /tabl[oó]n|anuncio|encargo|misi[oó]n|trabajo|contrato|recompensa|faena/;
/** The player hands something over. */
const DELIVERS = /entreg|recado|paquete|carta|encargo|misi[oó]n/;

export const MAX_LOCAL_QUESTS = 2;

const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];

const HUNT_GIVERS = ['el alguacil del pueblo', 'un carretero desesperado', 'la guardia local'];

/** Creature types of the bestiary, in plural, for hunts of a whole type. */
export const TYPE_PLURALS = {
  bestia: 'bestias', humanoide: 'humanoides', 'muerto viviente': 'muertos vivientes', monstruosidad: 'monstruosidades',
  'feérico': 'feéricos', infernal: 'infernales', 'aberración': 'aberraciones', gigante: 'gigantes', 'dragón': 'dragones',
  elemental: 'elementales', constructo: 'constructos', cieno: 'cienos', planta: 'plantas', celestial: 'celestiales'
};

/**
 * The target of a new hunt among the creatures the game offers for the hero's
 * level and world (see encounterCandidates): one creature, or a whole type
 * when at least two creatures of that type are around. null without creatures.
 * @returns {{ by: 'creature', monsterId, name } | { by: 'type', type, name } | null}
 */
export function pickHuntTarget(bestiary, rng = Math.random) {
  const cap = bestiary?.budget?.moderate ?? Infinity;
  const creatures = (bestiary?.creatures || []).filter(c => c.xp > 0 && c.xp <= cap);
  if (!creatures.length) return null;
  const counts = creatures.reduce((acc, c) => ({ ...acc, [c.type]: (acc[c.type] || 0) + 1 }), {});
  const types = Object.keys(counts).filter(type => counts[type] >= 2 && TYPE_PLURALS[type]);
  if (types.length && rng() < 0.35) {
    const type = pick(types, rng);
    return { by: 'type', type, name: TYPE_PLURALS[type] };
  }
  const foe = pick(creatures, rng);
  return { by: 'creature', monsterId: foe.id, name: foe.name };
}

/** The enemy counts for the hunt: the same creature, or the same type. */
export const isHuntTarget = (target, enemy) => Boolean(target && enemy) && (target.by === 'type'
  ? enemy.type === target.type
  : enemy.monsterId === target.monsterId);

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
export function localQuestScene(actionLower, { quests = [], world, character, here = null, bestiary = null, rng = Math.random }) {
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

  const level = characterLevel(character);
  const others = (world?.mapNodes || []).filter(n => n.status !== 'locked' && n.id !== here?.id);
  const hasHunt = local.some(q => q.goal.kind === 'hunt');
  const errandTarget = others.length ? pick(others, rng) : null;
  const huntTarget = hasHunt ? null : pickHuntTarget(bestiary, rng);
  const makeErrand = errandTarget && (!huntTarget || rng() < 0.5);
  const place = here?.name || world?.initialLocation || '';

  if (makeErrand) {
    // Not the same errand twice at once
    const taken = new Set(local.map(q => q.title));
    const free = ERRANDS.filter(e => !taken.has(e.title));
    const t = pick(free.length ? free : ERRANDS, rng);
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

  if (!huntTarget) {
    return {
      text: `Maese Duncan se encoge de hombros mientras seca una jarra.

—*Hoy no hay nada en el tablón que merezca tu tiempo, ${name}. Vuelve más tarde, o busca trabajo en otra parte.*`,
      suggestedActions: ['Preguntar por rumores', 'Pedir una jarra', 'Salir a explorar', 'Revisar el equipo'],
      questChanges: []
    };
  }

  const giver = pick(HUNT_GIVERS, rng);
  const gold = promisedGold(level, rng, 12);
  const byType = huntTarget.by === 'type';
  const title = byType ? `Plaga de ${huntTarget.name}` : `Se busca: ${huntTarget.name}`;
  const objective = byType
    ? `Vencer (matar o hacer rendirse) a criaturas de tipo ${huntTarget.type}: la plaga de ${huntTarget.name} que acosa a los viajeros de los alrededores.`
    : `Vencer (matar o hacer rendirse) a la criatura que ataca a los viajeros de los alrededores: ${huntTarget.name}.`;
  return {
    text: `Maese Duncan arranca un pliego clavado junto a la chimenea y lo deja frente a ti, todavía con el clavo puesto.

—*Lo ha dejado ${giver}. Pagan a quien acabe con ${byType ? `la plaga de ${huntTarget.name} que ronda por los caminos` : `la criatura que ronda por los caminos: **${huntTarget.name}**`}. Ofrecen ${gold} monedas, y por lo que cuentan se las han ganado ya varios muertos.*

Doblas el pliego y lo guardas: el trabajo es tuyo.`,
    suggestedActions: ['Preguntar dónde se le vio por última vez', 'Salir a buscarlo', 'Prepararse antes de partir', 'Preguntar quién más lo ha intentado'],
    questChanges: [{
      action: 'open',
      title,
      giver,
      place,
      objective,
      reward: { gold, xp: true, importance: 'normal' },
      goal: { kind: 'hunt', target: huntTarget }
    }]
  };
}

/**
 * A fight was won: the hunts whose target was defeated (killed or made to
 * surrender; the ones that fled don't count) are done. Hunts without a target
 * are never closed by a fight.
 */
export function huntChangesAfterVictory(quests, encounter) {
  if (!encounter || encounter.status !== 'victory') return [];
  const defeated = (encounter.enemies || []).filter(e => e.status === 'dead' || e.status === 'surrendered');
  return activeQuests(quests)
    .filter(q => q.goal?.kind === 'hunt' && defeated.some(e => isHuntTarget(q.goal.target, e)))
    .map(q => ({ action: 'complete', id: q.id, note: `Objetivo vencido en combate: ${q.goal.target.name}.` }));
}

/**
 * The creatures offered for a fight change from scene to scene: the target of
 * an active hunt (one creature) is always added to them, so Duncan and the
 * local engine can meet it. `getMonster(id)`: the bestiary lookup.
 */
export function withHuntTargets(bestiary, quests, getMonster) {
  if (!bestiary || typeof getMonster !== 'function') return bestiary;
  const ids = activeQuests(quests)
    .filter(q => q.goal?.kind === 'hunt' && q.goal.target?.by === 'creature')
    .map(q => q.goal.target.monsterId)
    .filter(id => !bestiary.creatures.some(c => c.id === id));
  const extra = [...new Set(ids)].map(getMonster).filter(Boolean)
    .map(m => ({ id: m.id, name: m.name, cr: m.cr, xp: m.xp, type: m.type }));
  return extra.length ? { ...bestiary, creatures: [...bestiary.creatures, ...extra] } : bestiary;
}

/**
 * The bestiary for a fight the local engine starts: while a hunt is active and
 * its target is among the creatures, the fight is with it most of the time
 * (60 %), so the quest can be done without the AI.
 */
export function bestiaryForHunts(bestiary, quests, rng = Math.random) {
  if (!bestiary) return bestiary;
  const targets = activeQuests(quests).filter(q => q.goal?.kind === 'hunt' && q.goal.target).map(q => q.goal.target);
  const matching = bestiary.creatures.filter(c => targets.some(t => isHuntTarget(t, { monsterId: c.id, type: c.type })));
  return matching.length && rng() < 0.6 ? { ...bestiary, creatures: matching } : bestiary;
}
