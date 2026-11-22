import { describe, it, expect } from 'vitest';
import { createEncounter, runEnemyTurns, playerAction, isPlayerTurn, escapeBonus } from './encounter';
import { attackOptions } from './combat';
import { buildCharacter, emptyDraft, sanitizeDraft } from './characterBuilder';
import { getMonster, MONSTERS } from './bestiary';
import { createCondition, addCondition, hasCondition, exhaustionLevel, CONDITIONS } from './conditions';
import { castSpell, longRest } from './spellcasting';
import { healingDice } from './items';
import { MONSTER_CONDITIONS } from '../data/monsterConditions';
import { SPELL_CONDITIONS } from '../data/spellConditions';
import { SPELLS } from '../data/spells';

/** Dice that return the given values in order, then repeat the last one. */
const dice = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

const noPotions = hero => ({ ...hero, inventory: (hero.inventory || []).filter(i => !healingDice(i)) });

const fighter = () => noPotions(buildCharacter(sanitizeDraft({
  ...emptyDraft(), classId: 'fighter', backgroundId: 'soldier', speciesId: 'orc',
  baseScores: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['acrobatics', 'survival'], name: 'Brega', languages: ['Enano', 'Élfico']
})));

/** A wizard who knows these spells, with plenty of slots. */
const caster = (spellIds) => {
  const base = noPotions(buildCharacter(sanitizeDraft({
    ...emptyDraft(), classId: 'wizard', backgroundId: 'sage', speciesId: 'human', extraFeatId: 'alert',
    baseScores: { fue: 8, des: 12, con: 13, int: 15, sab: 14, car: 10 },
    bonus: { mode: 'twoOne', plus2: 'int', plus1: 'con' }, speciesSkills: ['perception'], classSkills: ['investigation', 'medicine'],
    spells: {
      class: { cantrips: ['fireBolt', 'mageHand', 'light'], spells: ['magicMissile', 'shield', 'sleep', 'burningHands', 'mageArmor', 'grease'], prepared: ['magicMissile', 'sleep', 'burningHands', 'shield'] },
      magicInitiateWizard: { cantrips: ['rayOfFrost', 'minorIllusion'], spells: ['featherFall'] }
    },
    name: 'Elowen', languages: ['Enano', 'Dracónico']
  })));
  return {
    ...base,
    spellcasting: {
      ...base.spellcasting,
      known: [...base.spellcasting.known, ...spellIds.map(id => ({ id, ability: 'int', prepared: true }))],
      slots: { recovery: 'long', levels: { 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 }, 3: { max: 3, used: 0 }, 4: { max: 3, used: 0 }, 5: { max: 2, used: 0 } } }
    }
  };
};

const withCondition = (creature, spec, context = {}) => addCondition(creature, createCondition(spec, { targetUid: 'player', ...context })).creature;
const texts = enc => enc.log.map(l => l.text).join('\n');

describe('monster conditions data', () => {
  it('every entry points to a real monster action and a real condition', () => {
    Object.entries(MONSTER_CONDITIONS).forEach(([monsterId, actions]) => {
      const monster = MONSTERS.find(m => m.id === monsterId);
      expect(monster, monsterId).toBeTruthy();
      Object.entries(actions).forEach(([actionId, effect]) => {
        const action = monster.actions.find(a => a.id === actionId);
        expect(action, `${monsterId}.${actionId}`).toBeTruthy();
        if (effect.onHit) expect(['melee', 'ranged']).toContain(action.kind);
        if (effect.onFail) expect(action.kind).toBe('save');
        [...(effect.onHit || []), ...(effect.onFail || [])].forEach(spec => expect(CONDITIONS[spec.id]).toBeTruthy());
      });
    });
  });

  it('every spell entry points to a real spell of the right kind', () => {
    Object.entries(SPELL_CONDITIONS).forEach(([id, effect]) => {
      const spell = SPELLS.find(s => s.id === id);
      expect(spell, id).toBeTruthy();
      if (effect.onFail) expect(spell.kind).toBe('save');
      if (effect.onHit) expect(spell.kind).toBe('attack');
      [...(effect.onFail || []), ...(effect.onHit || []), ...(effect.self || [])].forEach(spec => expect(CONDITIONS[spec.id]).toBeTruthy());
    });
  });
});

describe('monsters apply conditions', () => {
  it('a ghoul claws to paralyze (Con DC 10); the hero loses a turn, then it wears off', () => {
    const hero = fighter();
    // ghoul 20, hero 1
    const enc = createEncounter([{ monster: getMonster('ghoul') }], hero, dice(20, 1));
    // claw 15 hits, damage 3, Con save 2+4 = 6 fails; next round the claw misses (1)
    const { encounter, character } = runEnemyTurns(enc, hero, dice(15, 3, 2, 1));
    const log = texts(encounter);
    expect(log).toContain('ataca con garra');
    expect(log).toContain('queda paralizado');
    expect(log).toContain('pierde su turno');
    expect(log).toContain('ya no está paralizado');
    expect(isPlayerTurn(encounter)).toBe(true);
    expect(encounter.round).toBe(2);
    expect(hasCondition(character, 'paralizado')).toBe(false);
  });

  it('a successful Constitution save avoids the paralysis', () => {
    const hero = fighter();
    const enc = createEncounter([{ monster: getMonster('ghoul') }], hero, dice(20, 1));
    const { encounter, character } = runEnemyTurns(enc, hero, dice(15, 3, 15));
    expect(texts(encounter)).toContain('evita quedar paralizado');
    expect(hasCondition(character, 'paralizado')).toBe(false);
  });

  it('bites against a paralyzed hero have advantage and are automatic criticals', () => {
    const hero = withCondition(fighter(), { id: 'paralizado', duration: 'permanent' });
    const enc = createEncounter([{ monster: getMonster('ghoul') }], hero, dice(20, 1));
    // advantage: 3 and 12 -> 12 + 4 = 16 hits; the claw is not used (already paralyzed)
    const { encounter } = runEnemyTurns(enc, hero, dice(3, 12, 1));
    const log = texts(encounter);
    expect(log).toContain('mordisco');
    expect(log).toContain('con ventaja: objetivo paralizado');
    expect(log).toContain('¡crítico automático!');
    expect(log).not.toContain('garra');
  });

  it('a wolf bite knocks the hero prone; enemies get advantage in melee and the hero stands up on their turn', () => {
    const hero = fighter();
    const enc = createEncounter([{ monster: getMonster('wolf'), count: 2 }], hero, dice(20, 19, 1));
    // wolf 1 hits (15) for 3 -> prone; wolf 2 attacks with advantage (4, 15)
    const { encounter, character } = runEnemyTurns(enc, hero, dice(15, 3, 4, 15, 3));
    const log = texts(encounter);
    expect(log).toContain('queda derribado');
    expect(log).toMatch(/Lobo 2 ataca con mordisco: \[4, 15\].*con ventaja: objetivo derribado/);
    expect(log).toContain('se levanta del suelo');
    expect(hasCondition(character, 'derribado')).toBe(false);
  });

  it('a giant spider\'s web restrains the hero, who cannot flee but can break free', () => {
    const hero = fighter();
    const enc = createEncounter([{ monster: getMonster('giantSpider') }], hero, dice(20, 1));
    // Dex save 3 + 2 = 5 vs DC 13: restrained
    const start = runEnemyTurns(enc, hero, dice(3));
    expect(hasCondition(start.character, 'apresado')).toBe(true);
    expect(isPlayerTurn(start.encounter)).toBe(true);
    const flee = playerAction(start.encounter, start.character, { type: 'flee' }, dice(20));
    expect(flee.ok).toBe(false);
    expect(flee.error).toContain('velocidad 0');
    // Athletics (soldier): 10 + 5 = 15 vs 13
    expect(escapeBonus(start.character).name).toBe('Atletismo');
    const free = playerAction(start.encounter, start.character, { type: 'escape' }, dice(10, 1));
    expect(free.ok).toBe(true);
    expect(texts(free.encounter)).toContain('¡se suelta!');
    expect(hasCondition(free.character, 'apresado')).toBe(false);
  });

  it('a grapple ends when the grappler falls', () => {
    const hero = withCondition(fighter(), { id: 'agarrado', duration: { escape: 12 } }, { sourceUid: 'bugbearWarrior-1' });
    const enc = createEncounter([{ monster: getMonster('bugbearWarrior') }, { monster: getMonster('goblinMinion') }], hero, dice(1, 1, 20));
    const weak = { ...enc, enemies: enc.enemies.map(e => (e.uid === 'bugbearWarrior-1' ? { ...e, hp: 1 } : e)) };
    const optionId = attackOptions(hero).find(o => o.weapon?.kind === 'melee').id;
    // Attack the bugbear: 15 + 5 hits, it drops
    const res = playerAction(weak, hero, { type: 'attack', optionId, targetUid: 'bugbearWarrior-1' }, dice(15, 3, 1));
    expect(texts(res.encounter)).toContain('ya no está agarrado');
    expect(hasCondition(res.character, 'agarrado')).toBe(false);
  });
});

describe('the hero\'s control spells', () => {
  const bandit = () => getMonster('bandit');

  it('Hold Person paralyzes a humanoid, who repeats the save at the end of its turns', () => {
    const hero = caster(['holdPerson']);
    const enc = createEncounter([{ monster: bandit() }], hero, dice(1, 20));
    // Wis save 5 vs 13: paralyzed; bandit's turn: lost; end-of-turn save 15: free
    const res = playerAction(enc, hero, { type: 'spell', spellId: 'holdPerson', targetUid: 'bandit-1' }, dice(5, 15));
    const log = texts(res.encounter);
    expect(log).toContain('queda paralizado');
    expect(log).toContain('Bandido está paralizado y no puede actuar');
    expect(log).toContain('repite la salvación de Sabiduría');
    expect(log).toContain('ya no está paralizado');
    expect(isPlayerTurn(res.encounter)).toBe(true);
  });

  it('Hold Person only affects humanoids', () => {
    const hero = caster(['holdPerson']);
    const enc = createEncounter([{ monster: getMonster('wolf') }], hero, dice(1, 20));
    const res = playerAction(enc, hero, { type: 'spell', spellId: 'holdPerson', targetUid: 'wolf-1' }, dice(5));
    expect(res.ok).toBe(false);
    expect(res.error).toContain('humanoide');
  });

  it('a melee hit against a paralyzed enemy is a critical', () => {
    const hero = fighter();
    const enc = createEncounter([{ monster: bandit() }], hero, dice(1, 20));
    const held = { ...enc, enemies: enc.enemies.map(e => withCondition(e, { id: 'paralizado', duration: 'permanent' }, { targetUid: e.uid })) };
    const option = attackOptions(hero).find(o => o.weapon?.kind === 'melee').id;
    const res = playerAction(held, hero, { type: 'attack', optionId: option, targetUid: 'bandit-1' }, dice(3, 10, 1));
    expect(texts(res.encounter)).toContain('[3, 10]');
    expect(texts(res.encounter)).toContain('¡crítico automático!');
  });

  it('taking damage can break the hero\'s concentration and free the target', () => {
    const hero = caster(['holdPerson']);
    const enc = createEncounter([{ monster: bandit(), count: 2 }], hero, dice(2, 1, 20));
    // Hold bandit 1 (save 5 fails); bandit 1 lost turn, save 2 fails; bandit 2 shoots 18 for 4+1;
    // Con save 3 + 1 = 4 vs DC 10 fails: concentration lost, bandit 1 is free
    const res = playerAction(enc, hero, { type: 'spell', spellId: 'holdPerson', targetUid: 'bandit-1' }, dice(5, 2, 18, 4, 3));
    const log = texts(res.encounter);
    expect(log).toContain('pierde la concentración en Inmovilizar Persona');
    expect(res.encounter.concentrations).toEqual({});
    expect(res.encounter.enemies[0].conditions).toHaveLength(0);
  });

  it('Sleep: incapacitated, then a second failed save means unconscious, and damage wakes it', () => {
    const hero = caster([]);
    const enc = createEncounter([{ monster: bandit() }], hero, dice(1, 20));
    // save 5 fails; at the end of the bandit's turn it saves again: 4 fails -> unconscious
    const slept = playerAction(enc, hero, { type: 'spell', spellId: 'sleep', targetUid: 'bandit-1' }, dice(5, 4));
    expect(texts(slept.encounter)).toContain('queda inconsciente');
    expect(hasCondition(slept.encounter.enemies[0], 'inconsciente')).toBe(true);
    // Fire Bolt: unconscious (advantage) but also prone at range (disadvantage) cancel out; 15 + 5 hits for 3
    const hit = playerAction(slept.encounter, slept.character, { type: 'spell', spellId: 'fireBolt', targetUid: 'bandit-1' }, dice(15, 3, 20));
    expect(hit.ok).toBe(true);
    expect(texts(hit.encounter)).toContain('el daño rompe el efecto');
    expect(hasCondition(hit.encounter.enemies[0], 'inconsciente')).toBe(false);
  });

  it('Sleep does not work on undead', () => {
    const hero = caster([]);
    const enc = createEncounter([{ monster: getMonster('zombie') }], hero, dice(1, 20));
    const res = playerAction(enc, hero, { type: 'spell', spellId: 'sleep', targetUid: 'zombie-1' }, dice(1, 1));
    expect(texts(res.encounter)).toContain('es inmune');
    expect(res.encounter.enemies[0].conditions).toHaveLength(0);
  });

  it('Fear: the frightened enemy runs instead of attacking', () => {
    const hero = caster(['fear']);
    const enc = createEncounter([{ monster: bandit() }], hero, dice(1, 20));
    const res = playerAction(enc, hero, { type: 'spell', spellId: 'fear', targetUid: 'bandit-1' }, dice(5, 5));
    const log = texts(res.encounter);
    expect(log).toContain('queda asustado');
    expect(log).toContain('huye aterrorizado y no ataca');
    expect(res.character.hp).toBe(hero.hp);
  });

  it('a charmed enemy does not attack the hero, and damage breaks the charm', () => {
    const hero = caster(['charmPerson']);
    const enc = createEncounter([{ monster: bandit() }], hero, dice(1, 20));
    // Charm Person: the bandit saves with advantage (2, 3)
    const res = playerAction(enc, hero, { type: 'spell', spellId: 'charmPerson', targetUid: 'bandit-1' }, dice(2, 3, 5));
    expect(texts(res.encounter)).toContain('con ventaja: está luchando contra ti');
    expect(texts(res.encounter)).toContain('está encantado y no quiere hacerte daño');
  });

  it('other control spells without their own condition still make the target lose a turn', () => {
    const hero = caster(['slow']);
    const enc = createEncounter([{ monster: bandit() }], hero, dice(1, 20));
    const res = playerAction(enc, hero, { type: 'spell', spellId: 'slow', targetUid: 'bandit-1' }, dice(2, 5));
    expect(texts(res.encounter)).toContain('queda incapacitado');
    expect(texts(res.encounter)).toContain('no puede actuar');
  });
});

describe('spells that cure conditions', () => {
  it('Lesser Restoration ends one condition: poisoned', () => {
    const hero = withCondition(caster(['lesserRestoration']), { id: 'envenenado', duration: { rest: 'long' } });
    const result = castSpell(hero, 'lesserRestoration', dice(1));
    expect(result.ok).toBe(true);
    expect(result.cast.cured).toEqual(['Envenenado']);
    expect(hasCondition(result.character, 'envenenado')).toBe(false);
  });

  it('Greater Restoration lowers Exhaustion', () => {
    const hero = withCondition(caster(['greaterRestoration']), { id: 'agotamiento', level: 3 });
    const result = castSpell(hero, 'greaterRestoration', dice(1));
    expect(exhaustionLevel(result.character)).toBe(2);
  });
});

describe('the hero\'s own conditions in a fight', () => {
  it('a poisoned hero attacks with disadvantage', () => {
    const hero = withCondition(fighter(), { id: 'envenenado', duration: { rest: 'long' } });
    const enc = createEncounter([{ monster: getMonster('bandit') }], hero, dice(1, 20));
    const res = playerAction(enc, hero, { type: 'attack', optionId: attackOptions(hero).find(o => o.weapon?.kind === 'melee').id, targetUid: 'bandit-1' }, dice(18, 2, 1));
    expect(texts(res.encounter)).toContain('con desventaja: envenenado');
    expect(texts(res.encounter)).toMatch(/\[18, 2\].* falla/);
  });

  it('an exhausted hero subtracts 2 per level from attacks', () => {
    const hero = withCondition(fighter(), { id: 'agotamiento', level: 2 });
    const enc = createEncounter([{ monster: getMonster('bandit') }], hero, dice(1, 20));
    const plainHero = { ...fighter(), id: hero.id };
    const a = playerAction(enc, plainHero, { type: 'attack', optionId: attackOptions(hero).find(o => o.weapon?.kind === 'melee').id, targetUid: 'bandit-1' }, dice(10, 1));
    const b = playerAction(enc, hero, { type: 'attack', optionId: attackOptions(hero).find(o => o.weapon?.kind === 'melee').id, targetUid: 'bandit-1' }, dice(10, 1));
    const total = res => Number(/= (\d+) vs CA/.exec(res.encounter.log.find(l => l.text.includes('ataca a')).text)[1]);
    expect(total(a) - total(b)).toBe(4);
  });

  it('a long rest after the fight lowers Exhaustion and ends poison until rest', () => {
    let hero = withCondition(fighter(), { id: 'agotamiento', level: 2 });
    hero = withCondition(hero, { id: 'envenenado', duration: { rest: 'long' } });
    const rested = longRest(hero);
    expect(exhaustionLevel(rested)).toBe(1);
    expect(hasCondition(rested, 'envenenado')).toBe(false);
  });
});
