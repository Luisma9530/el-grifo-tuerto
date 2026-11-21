// What the hero's spells do with conditions in a fight, and the spells that cure them.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.
//
// Every spell has a single target here (the enemy chosen in the fight), also the
// area ones (Sleep, Fear, Hypnotic Pattern...): the game has no map.
//
//   onFail   conditions the target gets when it fails the spell's saving throw
//            ({ save: true } as duration = it repeats the save at the end of each of its
//            turns against the caster's DC; 'endOfSourceNextTurn' = the end of the hero's next turn)
//   onHit    conditions of a spell attack that hits
//   self     conditions the hero gets when casting it
//   types    creature types it can affect (Hold Person: humanoids)
//   immuneTypes  creature types that succeed automatically
//   saveAdvantage  the target saves with advantage (Charm Person when fighting the hero)
//   cures    conditions it removes from the hero ({ ids, count, exhaustion })
// Concentration comes from the spell itself (spells.js): if the hero loses it, the
// conditions end. Durations of 1 minute are 10 turns (maxRounds).

const MINUTE = 10;
const repeatSave = { save: true, maxRounds: MINUTE };

export const SPELL_CONDITIONS = {
  holdPerson: { types: ['humanoide'], onFail: [{ id: 'paralizado', duration: repeatSave }] },
  holdMonster: { onFail: [{ id: 'paralizado', duration: repeatSave }] },
  // Incapacitated until the end of its next turn, then a second save or Unconscious (ends with damage)
  sleep: {
    immuneTypes: ['muerto viviente', 'constructo', 'elemental', 'cieno'],
    onFail: [{
      id: 'incapacitado', duration: 'endOfTargetNextTurn',
      thenSave: { apply: [{ id: 'inconsciente', duration: { rounds: MINUTE }, endsOnDamage: true }, { id: 'derribado' }] }
    }]
  },
  // Frightened: drops its weapons and spends its turns running away, repeating the save
  fear: { onFail: [{ id: 'asustado', duration: repeatSave, flees: true }] },
  hideousLaughter: { onFail: [{ id: 'incapacitado', duration: repeatSave, saveOnDamage: 'advantage' }, { id: 'derribado' }] },
  // "¡Al suelo!": falls prone and loses its next turn
  command: { onFail: [{ id: 'derribado' }, { id: 'incapacitado', duration: 'endOfTargetNextTurn' }] },
  charmPerson: { types: ['humanoide'], saveAdvantage: true, onFail: [{ id: 'encantado', duration: 'permanent', endsOnDamage: true }] },
  charmMonster: { saveAdvantage: true, onFail: [{ id: 'encantado', duration: 'permanent', endsOnDamage: true }] },
  colorSpray: { onFail: [{ id: 'cegado', duration: 'endOfSourceNextTurn' }] },
  blindnessDeafness: { onFail: [{ id: 'cegado', duration: repeatSave }] },
  entangle: { onFail: [{ id: 'apresado', duration: { escape: 'dc' } }] },
  web: { onFail: [{ id: 'apresado', duration: { escape: 'dc' } }] },
  blackTentacles: { onFail: [{ id: 'apresado', duration: { escape: 'dc' } }] },
  grease: { onFail: [{ id: 'derribado' }] },
  sleetStorm: { onFail: [{ id: 'derribado' }] },
  hypnoticPattern: {
    onFail: [{ id: 'encantado', duration: 'permanent', endsOnDamage: true, group: 'hypnoticPattern' }, { id: 'incapacitado', duration: 'linked', group: 'hypnoticPattern' }]
  },
  suggestion: { onFail: [{ id: 'encantado', duration: 'permanent', endsOnDamage: true }] },
  dominateBeast: { types: ['bestia'], onFail: [{ id: 'encantado', duration: 'permanent', saveOnDamage: true }] },
  dominatePerson: { types: ['humanoide'], onFail: [{ id: 'encantado', duration: 'permanent', saveOnDamage: true }] },
  dominateMonster: { onFail: [{ id: 'encantado', duration: 'permanent', saveOnDamage: true }] },
  // Eyebite, "Asleep": Unconscious until it takes damage
  eyebite: { onFail: [{ id: 'inconsciente', duration: 'permanent', endsOnDamage: true }, { id: 'derribado' }] },
  // Restrained; three failed saves turn it to stone
  fleshToStone: { onFail: [{ id: 'apresado', duration: { save: true, worsen: { after: 3, to: 'petrificado' } } }] },
  irresistibleDance: { onFail: [{ id: 'incapacitado', duration: repeatSave }] },
  rayOfSickness: { onHit: [{ id: 'envenenado', duration: 'endOfSourceNextTurn' }] },
  invisibility: { self: [{ id: 'invisible', duration: 'permanent', endsOnAttack: true }] },
  greaterInvisibility: { self: [{ id: 'invisible', duration: 'permanent' }] },

  lesserRestoration: { cures: { ids: ['paralizado', 'envenenado', 'cegado', 'ensordecido'], count: 1 } },
  greaterRestoration: { cures: { ids: ['petrificado', 'encantado'], count: 1, exhaustion: 1 } },
  heal: { cures: { ids: ['cegado', 'ensordecido', 'envenenado'] } },
  powerWordHeal: { cures: { ids: ['encantado', 'asustado', 'paralizado', 'envenenado', 'aturdido', 'derribado'] } }
};

export const spellConditions = id => SPELL_CONDITIONS[id] || null;

/** Melee spell attacks (touch): a hit on a paralyzed or unconscious creature is a critical. */
export const TOUCH_SPELLS = ['shockingGrasp', 'vampiricTouch', 'inflictWounds', 'chillTouch'];
