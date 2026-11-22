// Local engine (no AI): when the party looks for companions, someone offers to
// join. The game asks the player and builds the sheet (see recruit.js).

import { CLASSES, SPECIES } from '../data/srd';
import { randomName } from './characterBuilder';
import { MAX_PARTY } from './party';

/** Words that mean the party is looking for someone to join them. */
const LOOKING = /(reclut|mercenari|contratar a (alguien|un|una)|compañer[oa]s? de (viaje|armas|aventura)|nuevo compañero|nueva compañera|unirse al grupo|que se una|que nos acompañe|busc\w* (compañer|aliad|alguien que nos acompañe|un guía|una guía))/;
export const looksForCompanions = actionLower => LOOKING.test(actionLower || '');

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

const REASONS = [
  'Necesita salir de la ciudad antes de que lleguen sus acreedores',
  'Busca a quien mató a su hermano y cree que el camino del grupo la llevará hasta él',
  'Lleva semanas sin trabajo y dice que pelea mejor de lo que bebe',
  'Debe un favor a Duncan y él le ha pedido que os eche una mano',
  'Quiere ver mundo, y sabe que solo no llegará muy lejos'
];

/**
 * @returns {{ text, suggestedActions, recruit: { name, classId, speciesId, reason } } | null}
 */
export function localRecruitScene(actionLower, { character, partyNames = [], partySize = 1, rng = Math.random }) {
  if (!looksForCompanions(actionLower) || partySize >= MAX_PARTY) return null;
  const cls = pick(CLASSES, rng);
  const species = pick(SPECIES, rng);
  let name = randomName(species.id, rng);
  for (let i = 0; i < 5 && partyNames.includes(name); i++) name = randomName(species.id, rng);
  if (partyNames.includes(name)) return null;
  const reason = pick(REASONS, rng);
  const who = character?.name || 'Aventurero';
  const text = `Duncan señala con la barbilla una mesa del fondo.

—*¿Buscas compañía, ${who}? Esa de ahí lleva toda la noche escuchándote.* ${name}, ${species.name.toLowerCase()} y ${cls.name.toLowerCase()} de oficio, se acerca con la jarra en la mano. ${reason}.

—*Si me queréis, voy con vosotros* —dice—. *Si no, me vuelvo a mi rincón y aquí no ha pasado nada.*`;
  return {
    text,
    suggestedActions: ['Preguntar a Duncan qué sabe de esa persona', 'Pedir otra ronda para cerrar el trato', 'Hablar de la siguiente misión'],
    recruit: { name, classId: cls.id, speciesId: species.id, reason }
  };
}
