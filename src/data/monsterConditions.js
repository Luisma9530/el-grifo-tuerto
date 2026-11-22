// Conditions that monsters apply with their attacks and abilities.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.
//
// The stat blocks in monsters.js only carry damage; the traits are one-line
// summaries without numbers, so the conditions can't be parsed from them
// reliably. They are listed here by hand from the SRD stat blocks, keyed by
// monster id and action id, and merged into the actions when a fight starts.
//
//   onHit:  conditions an attack applies when it hits (`save`: the target may
//           resist with that saving throw)
//   onFail: conditions a saving-throw action applies when the target fails
//   immuneOnSave: a creature that succeeds is immune to it for the rest of the fight
//   prefer: the creature uses this action instead of its usual attacks while the
//           hero doesn't have the condition yet (the ghoul claws to paralyze, then bites)
// Durations: see createCondition in utils/conditions.js.
// "If the target is Medium or smaller" is always true for the hero (Small or Medium).

const prone = { id: 'derribado' };
const grappled = (dc, group) => ({ id: 'agarrado', duration: { escape: dc }, group });
const restrainedWhileGrappled = group => ({ id: 'apresado', duration: 'linked', group });

export const MONSTER_CONDITIONS = {
  wolf: { bite: { onHit: [prone] } },
  direWolf: { bite: { onHit: [prone] } },
  ghoul: {
    claw: { prefer: true, onHit: [{ id: 'paralizado', save: { ability: 'con', dc: 10 }, duration: 'endOfTargetNextTurn' }] }
  },
  ghast: {
    claw: { prefer: true, onHit: [{ id: 'paralizado', save: { ability: 'con', dc: 10 }, duration: 'endOfTargetNextTurn' }] }
  },
  bugbearWarrior: { grab: { prefer: true, onHit: [grappled(12)] } },
  mimic: { pseudopod: { prefer: true, onHit: [grappled(13)] } },
  chuul: { pincer: { onHit: [grappled(14)] } },
  tyrannosaurusRex: { bite: { onHit: [grappled(17, 'trexBite'), restrainedWhileGrappled('trexBite')] } },
  beardedDevil: { beard: { onHit: [{ id: 'envenenado', duration: 'startOfSourceNextTurn' }] } },
  wyvern: { sting: { onHit: [{ id: 'envenenado', duration: 'endOfSourceNextTurn' }] } },
  assassin: { shortsword: { onHit: [{ id: 'envenenado', duration: 'startOfSourceNextTurn' }] } },
  giantSpider: { web: { onFail: [{ id: 'apresado', duration: { escape: 13 }, keepsWithoutSource: true }] } },
  airElemental: { whirlwind: { onFail: [prone] } },
  waterElemental: { whelm: { onFail: [grappled(14, 'whelm'), restrainedWhileGrappled('whelm')] } },
  gladiator: { shieldBash: { onFail: [prone] } },
  behir: { constrict: { onFail: [grappled(16, 'constrict'), restrainedWhileGrappled('constrict')] } },
  ghost: { horrificVisage: { immuneOnSave: true, onFail: [{ id: 'asustado', duration: 'startOfSourceNextTurn' }] } },
  mummy: { dreadfulGlare: { immuneOnSave: true, onFail: [{ id: 'asustado', duration: 'endOfSourceNextTurn' }] } },
  mummyLord: { dreadfulGlare: { immuneOnSave: true, onFail: [{ id: 'asustado', duration: 'endOfSourceNextTurn' }] } }
};

/** The actions of a creature with the conditions they apply. */
export function actionsWithConditions(monsterId, actions = []) {
  const table = MONSTER_CONDITIONS[monsterId];
  if (!table) return actions;
  return actions.map(action => (table[action.id] ? { ...action, ...table[action.id] } : action));
}
