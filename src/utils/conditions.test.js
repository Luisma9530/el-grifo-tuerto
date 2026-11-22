import { describe, it, expect } from 'vitest';
import {
  CONDITIONS, CONDITION_IDS, createCondition, addCondition, removeConditions, attackModifiers, saveModifiers,
  checkModifiers, rollD20, rollSave, d20Mode, tickDurations, exhaustionLevel, d20Penalty, speedWithConditions,
  speedZeroReason, hasCondition, isIncapacitated, restConditions, endCombatConditions, normalizeConditions,
  applyConditionChanges, conditionFact, conditionBadges, describeDuration, describeConditionsForPrompt,
  reduceExhaustion, EXHAUSTION_MAX, isImmune
} from './conditions';

const dice = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

/** A creature with these conditions (specs as in createCondition). */
const withConditions = (specs, base = {}, context = {}) => specs.reduce(
  (creature, spec) => addCondition(creature, createCondition(spec, { targetUid: 'player', ...context })).creature,
  { name: 'Prueba', stats: { fue: 10, des: 10 }, conditions: [], ...base }
);
const plain = () => withConditions([]);

describe('the conditions of the SRD 5.2.1', () => {
  it('lists the 14 conditions and Exhaustion, with Spanish names and effects', () => {
    expect(CONDITION_IDS).toEqual(expect.arrayContaining([
      'agarrado', 'apresado', 'asustado', 'aturdido', 'cegado', 'derribado', 'encantado', 'ensordecido',
      'envenenado', 'incapacitado', 'inconsciente', 'invisible', 'paralizado', 'petrificado', 'agotamiento'
    ]));
    expect(CONDITION_IDS).toHaveLength(15);
    CONDITION_IDS.forEach(id => {
      expect(CONDITIONS[id].name).toBeTruthy();
      expect(CONDITIONS[id].effect.length).toBeGreaterThan(20);
    });
  });

  it('paralyzed, stunned, petrified and unconscious imply incapacitated; unconscious also prone', () => {
    ['paralizado', 'aturdido', 'petrificado', 'inconsciente'].forEach(id => {
      expect(isIncapacitated(withConditions([{ id }]))).toBe(true);
    });
    expect(hasCondition(withConditions([{ id: 'inconsciente' }]), 'derribado')).toBe(true);
    expect(isIncapacitated(withConditions([{ id: 'envenenado' }]))).toBe(false);
  });

  it('a petrified creature is immune to poison', () => {
    expect(hasCondition(withConditions([{ id: 'envenenado' }, { id: 'petrificado' }]), 'envenenado')).toBe(false);
  });

  it('some kinds of creature are immune to some conditions', () => {
    const skeleton = { type: 'muerto viviente', conditions: [] };
    expect(isImmune(skeleton, 'envenenado')).toBe(true);
    const result = addCondition(skeleton, createCondition({ id: 'envenenado' }));
    expect(result.immune).toBe(true);
    expect(result.creature.conditions).toHaveLength(0);
    expect(isImmune({ type: 'constructo' }, 'paralizado')).toBe(true);
    expect(isImmune({ type: 'humanoide' }, 'paralizado')).toBe(false);
  });
});

describe('advantage and disadvantage on attack rolls', () => {
  it('blinded, poisoned, frightened, prone and restrained attackers have disadvantage', () => {
    ['cegado', 'envenenado', 'asustado', 'derribado', 'apresado'].forEach(id => {
      const mods = attackModifiers(withConditions([{ id }]), plain());
      expect(d20Mode(mods)).toBe('disadvantage');
    });
  });

  it('an invisible attacker has advantage, an invisible target gives disadvantage', () => {
    expect(d20Mode(attackModifiers(withConditions([{ id: 'invisible' }]), plain()))).toBe('advantage');
    expect(d20Mode(attackModifiers(plain(), withConditions([{ id: 'invisible' }])))).toBe('disadvantage');
  });

  it('attacks against blinded, paralyzed, stunned, unconscious, petrified or restrained creatures have advantage', () => {
    ['cegado', 'paralizado', 'aturdido', 'inconsciente', 'petrificado', 'apresado'].forEach(id => {
      expect(d20Mode(attackModifiers(plain(), withConditions([{ id }])))).toBe('advantage');
    });
  });

  it('a prone target: advantage in melee, disadvantage from a distance', () => {
    const prone = withConditions([{ id: 'derribado' }]);
    expect(d20Mode(attackModifiers(plain(), prone))).toBe('advantage');
    expect(d20Mode(attackModifiers(plain(), prone, { ranged: true }))).toBe('disadvantage');
  });

  it('a melee hit against a paralyzed or unconscious creature is a critical, a ranged one is not', () => {
    expect(attackModifiers(plain(), withConditions([{ id: 'paralizado' }])).autoCrit).toBe(true);
    expect(attackModifiers(plain(), withConditions([{ id: 'inconsciente' }])).autoCrit).toBe(true);
    expect(attackModifiers(plain(), withConditions([{ id: 'paralizado' }]), { ranged: true }).autoCrit).toBe(false);
    expect(attackModifiers(plain(), withConditions([{ id: 'aturdido' }])).autoCrit).toBe(false);
  });

  it('a grappled creature has disadvantage against anyone but its grappler', () => {
    const grappled = withConditions([{ id: 'agarrado', duration: { escape: 12 } }], {}, { sourceUid: 'bugbear-1' });
    expect(d20Mode(attackModifiers(grappled, plain(), { targetUid: 'bugbear-1' }))).toBe('normal');
    expect(d20Mode(attackModifiers(grappled, plain(), { targetUid: 'goblin-2' }))).toBe('disadvantage');
  });

  it('a charmed creature cannot attack its charmer', () => {
    const charmed = withConditions([{ id: 'encantado' }], {}, { sourceUid: 'player' });
    expect(attackModifiers(charmed, plain(), { targetUid: 'player' }).blocked).toBeTruthy();
    expect(attackModifiers(charmed, plain(), { targetUid: 'goblin-1' }).blocked).toBeNull();
  });

  it('advantage and disadvantage cancel out; the Dodge is lost when the target cannot move', () => {
    const mods = attackModifiers(withConditions([{ id: 'envenenado' }]), withConditions([{ id: 'cegado' }]));
    expect(d20Mode(mods)).toBe('normal');
    expect(attackModifiers(plain(), plain(), { dodging: true }).disadvantage).toContain('el objetivo esquiva');
    expect(attackModifiers(plain(), withConditions([{ id: 'apresado' }]), { dodging: true }).disadvantage).not.toContain('el objetivo esquiva');
  });

  it('rollD20 keeps the higher die with advantage and the lower with disadvantage', () => {
    expect(rollD20(dice(4, 17), { advantage: ['x'] })).toMatchObject({ raw: 17, rolls: [4, 17], mode: 'advantage' });
    expect(rollD20(dice(4, 17), { disadvantage: ['x'] })).toMatchObject({ raw: 4, mode: 'disadvantage' });
    expect(rollD20(dice(4, 17), {})).toMatchObject({ raw: 4, rolls: [4], mode: 'normal' });
  });
});

describe('saving throws and ability checks', () => {
  it('paralyzed, stunned, petrified and unconscious creatures fail Strength and Dexterity saves', () => {
    const paralyzed = withConditions([{ id: 'paralizado' }]);
    expect(saveModifiers(paralyzed, 'des').autoFail).toBe('paralizado');
    expect(saveModifiers(paralyzed, 'fue').autoFail).toBe('paralizado');
    expect(saveModifiers(paralyzed, 'sab').autoFail).toBeNull();
    const save = rollSave(paralyzed, 'des', 10, 5, dice(20));
    expect(save.success).toBe(false);
    expect(save.text).toContain('falla automáticamente');
  });

  it('a restrained creature has disadvantage on Dexterity saves', () => {
    expect(saveModifiers(withConditions([{ id: 'apresado' }]), 'des').disadvantage).toContain('apresado');
    expect(saveModifiers(withConditions([{ id: 'apresado' }]), 'con').disadvantage).toHaveLength(0);
  });

  it('poisoned and frightened creatures have disadvantage on ability checks', () => {
    expect(checkModifiers(withConditions([{ id: 'envenenado' }]), { ability: 'sab' }).disadvantage).toContain('envenenado');
    expect(checkModifiers(withConditions([{ id: 'asustado' }]), { ability: 'fue' }).disadvantage).toContain('asustado');
  });

  it('checks also include the armor without training (PR #3)', () => {
    const hero = {
      classId: 'wizard', stats: { fue: 8 }, wornArmor: 'a1', conditions: [],
      inventory: [{ id: 'a1', name: 'Cota de malla', type: 'armor' }]
    };
    expect(checkModifiers(hero, { ability: 'des' }).disadvantage.join()).toContain('sin competencia');
    expect(saveModifiers(hero, 'fue').disadvantage.join()).toContain('sin competencia');
  });

  it('invisible creatures have advantage on initiative, incapacitated ones disadvantage', () => {
    expect(checkModifiers(withConditions([{ id: 'invisible' }]), { ability: 'des', initiative: true }).advantage).toContain('invisible');
    expect(checkModifiers(withConditions([{ id: 'aturdido' }]), { ability: 'des', initiative: true }).disadvantage).toContain('incapacitado');
  });
});

describe('Exhaustion (2024 rules)', () => {
  it('each level takes 2 from every d20 test and 1,5 m from the speed', () => {
    const tired = withConditions([{ id: 'agotamiento', level: 3 }]);
    expect(exhaustionLevel(tired)).toBe(3);
    expect(d20Penalty(tired)).toBe(6);
    expect(attackModifiers(tired, plain()).penalty).toBe(6);
    expect(saveModifiers(tired, 'con').penalty).toBe(6);
    expect(checkModifiers(tired, {}).penalty).toBe(6);
    expect(speedWithConditions(tired, 9)).toBe(4.5);
    expect(rollSave(tired, 'con', 2, 10, dice(12)).total).toBe(8);
  });

  it('levels add up to 6 and a long rest removes one', () => {
    let hero = withConditions([{ id: 'agotamiento', level: 2 }, { id: 'agotamiento', level: 5 }]);
    expect(exhaustionLevel(hero)).toBe(EXHAUSTION_MAX);
    expect(hero.conditions).toHaveLength(1);
    hero = restConditions(hero, 'long').creature;
    expect(exhaustionLevel(hero)).toBe(5);
    expect(exhaustionLevel(restConditions(hero, 'short').creature)).toBe(5);
    expect(reduceExhaustion(withConditions([{ id: 'agotamiento' }]), 1).creature.conditions).toHaveLength(0);
  });
});

describe('speed 0', () => {
  it('grappled, restrained, paralyzed, petrified and unconscious creatures cannot move', () => {
    ['agarrado', 'apresado', 'paralizado', 'petrificado', 'inconsciente'].forEach(id => {
      expect(speedZeroReason(withConditions([{ id }]))).toBeTruthy();
      expect(speedWithConditions(withConditions([{ id }]), 9)).toBe(0);
    });
    expect(speedZeroReason(withConditions([{ id: 'envenenado' }]))).toBeNull();
  });
});

describe('durations', () => {
  it('"until the end of its next turn" skips the turn in progress', () => {
    // Applied in the ghoul's turn to the hero: the hero's next turn
    const fromGhoul = createCondition({ id: 'paralizado', duration: 'endOfTargetNextTurn' }, { sourceUid: 'ghoul-1', targetUid: 'player', actorUid: 'ghoul-1' });
    expect(fromGhoul.duration).toMatchObject({ type: 'turns', at: 'end', of: 'player', remaining: 1 });
    // Applied by the hero in their own turn, "until the end of your next turn": two turn ends
    const colorSpray = createCondition({ id: 'cegado', duration: 'endOfSourceNextTurn' }, { sourceUid: 'player', targetUid: 'goblin-1', actorUid: 'player' });
    expect(colorSpray.duration.remaining).toBe(2);
  });

  it('turn durations count down and expire', () => {
    let goblin = addCondition({ name: 'Goblin', conditions: [] }, createCondition({ id: 'cegado', duration: 'endOfSourceNextTurn' }, { sourceUid: 'player', targetUid: 'goblin-1', actorUid: 'player' })).creature;
    let tick = tickDurations(goblin, 'end', 'player');
    expect(tick.expired).toHaveLength(0);
    goblin = tickDurations(tick.creature, 'start', 'player').creature;
    tick = tickDurations(goblin, 'end', 'player');
    expect(tick.expired.map(c => c.id)).toEqual(['cegado']);
    expect(tick.creature.conditions).toHaveLength(0);
  });

  it('linked conditions end with the one they depend on', () => {
    const hero = withConditions([
      { id: 'agarrado', duration: { escape: 16 }, group: 'g1' },
      { id: 'apresado', duration: 'linked', group: 'g1' }
    ], {}, { sourceUid: 'behir-1' });
    const { creature, removed } = removeConditions(hero, c => c.id === 'agarrado');
    expect(removed.map(c => c.id).sort()).toEqual(['agarrado', 'apresado']);
    expect(creature.conditions).toHaveLength(0);
  });

  it('prone does not stack', () => {
    expect(withConditions([{ id: 'derribado' }, { id: 'derribado' }]).conditions).toHaveLength(1);
  });

  it('describes every kind of duration in Spanish', () => {
    const nameOf = uid => (uid === 'ghoul-1' ? 'Necrófago' : uid);
    expect(describeDuration(createCondition({ id: 'paralizado', duration: 'endOfTargetNextTurn' }, { targetUid: 'player' }), nameOf)).toBe('hasta el final de tu próximo turno');
    expect(describeDuration(createCondition({ id: 'asustado', duration: 'startOfSourceNextTurn' }, { sourceUid: 'ghoul-1' }), nameOf)).toBe('hasta el inicio del próximo turno de Necrófago');
    expect(describeDuration(createCondition({ id: 'paralizado', duration: { save: { ability: 'sab', dc: 13 } } }))).toContain('salvación de Sabiduría CD 13');
    expect(describeDuration(createCondition({ id: 'agarrado', duration: { escape: 12 } }))).toContain('CD 12');
    expect(describeDuration(createCondition({ id: 'envenenado', duration: { rest: 'long' } }))).toBe('hasta un descanso largo');
    expect(describeDuration(createCondition({ id: 'derribado' }))).toContain('se levante');
  });
});

describe('rests and the end of a fight', () => {
  it('a short rest ends short-rest conditions; a long rest ends long-rest ones too', () => {
    const hero = withConditions([{ id: 'envenenado', duration: { rest: 'short' } }, { id: 'cegado', duration: { rest: 'long' } }, { id: 'ensordecido', duration: 'permanent' }]);
    expect(restConditions(hero, 'short').creature.conditions.map(c => c.id)).toEqual(['cegado', 'ensordecido']);
    expect(restConditions(hero, 'long').creature.conditions.map(c => c.id)).toEqual(['ensordecido']);
  });

  it('effects of a fight end with it; story conditions stay', () => {
    const hero = withConditions([{ id: 'envenenado', duration: { rest: 'long' } }]);
    const hurt = addCondition(hero, createCondition({ id: 'agarrado', duration: { escape: 12 } }, { sourceUid: 'bugbear-1' })).creature;
    const after = endCombatConditions(hurt);
    expect(after.creature.conditions.map(c => c.id)).toEqual(['envenenado']);
    expect(after.removed.map(c => c.id)).toEqual(['agarrado']);
  });
});

describe('saved games', () => {
  it('older saves have no conditions; invalid entries are dropped', () => {
    expect(normalizeConditions(undefined)).toEqual([]);
    const list = normalizeConditions([{ id: 'envenenado', duration: { type: 'rest', rest: 'long' } }, { id: 'volando', duration: { type: 'permanent' } }, null, { id: 'cegado' }]);
    expect(list.map(c => c.id)).toEqual(['envenenado']);
    expect(list[0].key).toBeTruthy();
  });
});

describe('conditions from the story', () => {
  it('applies and removes conditions, Exhaustion by levels', () => {
    let { character, applied } = applyConditionChanges(plain(), [
      { id: 'envenenado', action: 'add', duration: { rest: 'long' }, cause: 'veneno de la ciénaga' },
      { id: 'agotamiento', action: 'add', level: 2 }
    ]);
    expect(applied.map(a => a.id)).toEqual(['envenenado', 'agotamiento']);
    expect(exhaustionLevel(character)).toBe(2);
    expect(character.conditions[0].cause).toBe('veneno de la ciénaga');
    ({ character, applied } = applyConditionChanges(character, [{ id: 'agotamiento', action: 'remove', level: 1 }, { id: 'envenenado', action: 'remove' }]));
    expect(exhaustionLevel(character)).toBe(1);
    expect(hasCondition(character, 'envenenado')).toBe(false);
    expect(applied).toHaveLength(2);
  });

  it('only accepts conditions that make sense outside a fight', () => {
    expect(applyConditionChanges(plain(), [{ id: 'derribado', action: 'add' }]).applied).toHaveLength(0);
  });

  it('reaching Exhaustion 6 makes the hero collapse', () => {
    expect(applyConditionChanges(plain(), [{ id: 'agotamiento', action: 'add', level: 6 }]).collapsed).toBe(true);
  });
});

describe('campaign memory', () => {
  it('records Exhaustion and lasting conditions, not the effects of a fight', () => {
    const poisoned = createCondition({ id: 'envenenado', duration: { rest: 'long' }, cause: 'picadura' });
    expect(conditionFact('Brega', { id: 'envenenado', action: 'add', condition: poisoned })).toBe('Brega queda envenenado (picadura), hasta un descanso largo');
    expect(conditionFact('Brega', { id: 'agotamiento', action: 'add', level: 2 })).toBe('Brega sufre agotamiento de nivel 2');
    expect(conditionFact('Brega', { id: 'agotamiento', action: 'remove', level: 0 })).toBe('Brega se recupera del agotamiento');
    const fight = createCondition({ id: 'paralizado', duration: 'endOfTargetNextTurn' }, { sourceUid: 'ghoul-1' });
    expect(conditionFact('Brega', { id: 'paralizado', action: 'add', condition: fight })).toBeNull();
  });
});

describe('texts for the interface and for Duncan', () => {
  it('badges explain the effect and the duration', () => {
    const hero = withConditions([{ id: 'agotamiento', level: 2 }, { id: 'envenenado', duration: { rest: 'long' } }]);
    const badges = conditionBadges(hero);
    expect(badges.map(b => b.label)).toEqual(['Agotamiento 2', 'Envenenado']);
    expect(badges[0].tooltip).toContain('−4');
    expect(badges[1].tooltip).toContain('Desventaja en las tiradas de ataque');
    expect(badges[1].tooltip).toContain('hasta un descanso largo');
  });

  it('lists the hero\'s conditions for the prompt', () => {
    expect(describeConditionsForPrompt(plain())).toBe('');
    expect(describeConditionsForPrompt(withConditions([{ id: 'agotamiento', level: 1 }]))).toContain('Agotamiento nivel 1');
  });
});
