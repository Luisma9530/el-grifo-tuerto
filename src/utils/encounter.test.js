import { describe, it, expect } from 'vitest';
import {
  createEncounter, runEnemyTurns, playerAction, isPlayerTurn, activeEnemies, enemySaveBonus, playerSaveBonus,
  describeEncounterResult, MORALE_DC
} from './encounter';
import { buildCharacter, emptyDraft, sanitizeDraft } from './characterBuilder';
import { attackOptions } from './combat';

/** Dice that return the given values in order, then repeat the last one. */
const dice = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

const goblin = {
  id: 'goblin', name: 'Goblin', type: 'humanoide', cr: 0.25, xp: 50, ac: 13, hp: 7, initiative: 2,
  stats: { fue: 8, des: 14, con: 10, int: 10, sab: 8, car: 8 },
  actions: [{ id: 'scimitar', name: 'Cimitarra', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'cortante' }]
};
const wolf = {
  id: 'wolf', name: 'Lobo', type: 'bestia', cr: 0.25, xp: 50, ac: 12, hp: 11, initiative: 2,
  stats: { fue: 12, des: 15, con: 12, int: 3, sab: 12, car: 6 },
  actions: [{ id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'perforante' }]
};
const zombie = {
  id: 'zombie', name: 'Zombi', type: 'muerto viviente', cr: 0.25, xp: 50, ac: 8, hp: 15, initiative: -2, fearless: true,
  stats: { fue: 13, des: 6, con: 16, int: 3, sab: 6, car: 5 }, saves: { sab: 0 },
  actions: [{ id: 'slam', name: 'Golpe', kind: 'melee', bonus: 3, damage: '1d6+1', type: 'contundente' }]
};
const drake = {
  id: 'drake', name: 'Dragoncillo', type: 'dragón', cr: 2, xp: 450, ac: 14, hp: 30, initiative: 1,
  stats: { fue: 14, des: 12, con: 14, int: 6, sab: 10, car: 8 },
  actions: [
    { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 4, damage: '1d8+2', type: 'perforante' },
    { id: 'breath', name: 'Aliento de Fuego', kind: 'save', save: 'des', dc: 12, damage: '4d6', type: 'fuego', half: true, recharge: [5, 6] }
  ],
  multiattack: ['bite', 'bite']
};

const fighter = () => buildCharacter(sanitizeDraft({
  ...emptyDraft(), classId: 'fighter', backgroundId: 'soldier', speciesId: 'orc',
  baseScores: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['acrobatics', 'survival'], name: 'Brega', languages: ['Enano', 'Élfico']
}));

describe('setting up an encounter', () => {
  it('creates numbered enemies and rolls initiative', () => {
    const hero = fighter();
    // goblin 1: 10+2, goblin 2: 5+2, player: 15+2
    const enc = createEncounter([{ monster: goblin, count: 2 }], hero, dice(10, 5, 15));
    expect(enc.enemies.map(e => e.name)).toEqual(['Goblin 1', 'Goblin 2']);
    expect(enc.enemies.map(e => e.uid)).toEqual(['goblin-1', 'goblin-2']);
    expect(enc.order.map(o => o.kind === 'player' ? 'player' : o.uid)).toEqual(['player', 'goblin-1', 'goblin-2']);
    expect(isPlayerTurn(enc)).toBe(true);
    expect(enc.log[0].text).toContain('Comienza el combate');
  });

  it('enemies that win initiative act first', () => {
    const hero = fighter();
    const enc = createEncounter([{ monster: goblin }], hero, dice(18, 2));
    expect(isPlayerTurn(enc)).toBe(false);
    const { encounter, character } = runEnemyTurns(enc, hero, dice(15, 4)); // hit for 4+2
    expect(isPlayerTurn(encounter)).toBe(true);
    expect(character.hp).toBe(hero.hp - 6);
    expect(encounter.log.at(-1)).toMatchObject({ kind: 'enemyHit', playerDamage: 6 });
  });

  it('computes saving throws', () => {
    expect(enemySaveBonus(zombie, 'sab')).toBe(0); // listed save
    expect(enemySaveBonus(wolf, 'des')).toBe(2); // from Dexterity 15
    const hero = fighter();
    expect(playerSaveBonus(hero, 'fue')).toBe(5); // Str 17 +3, proficient +2
    expect(playerSaveBonus(hero, 'des')).toBe(2);
  });
});

describe('the player turn', () => {
  it('a weapon attack damages the target and the enemies answer', () => {
    const hero = fighter();
    const sword = attackOptions(hero).find(o => o.weapon?.id === 'greatsword');
    let enc = createEncounter([{ monster: goblin, count: 2 }], hero, dice(10, 5, 15));
    // attack 12+5 = 17 hits, damage 2+3 (+3 Str) = 8 -> goblin 1 dies; goblin 2 attacks: 3+4 = 7 misses
    const res = playerAction(enc, hero, { type: 'attack', optionId: sword.id, targetUid: 'goblin-1' }, dice(12, 2, 3, 3));
    expect(res.ok).toBe(true);
    enc = res.encounter;
    expect(enc.enemies[0]).toMatchObject({ hp: 0, status: 'dead' });
    expect(res.animations[0]).toMatchObject({ sides: 20, value: 12, dc: 13, success: true });
    expect(res.animations[1].dice).toEqual([{ sides: 6, value: 2 }, { sides: 6, value: 3 }]);
    expect(enc.log.some(l => l.kind === 'enemyMiss')).toBe(true);
    expect(isPlayerTurn(enc)).toBe(true);
    expect(enc.round).toBe(2);
  });

  it('needs a living target and the player turn', () => {
    const hero = fighter();
    const enc = createEncounter([{ monster: goblin }], hero, dice(5, 15));
    const sword = attackOptions(hero)[0];
    expect(playerAction(enc, hero, { type: 'attack', optionId: sword.id, targetUid: 'nobody' }, dice(10)).ok).toBe(false);
    const enemyTurn = { ...enc, turn: enc.order.findIndex(o => o.kind === 'enemy') };
    expect(playerAction(enemyTurn, hero, { type: 'dodge' }, dice(10)).error).toBe('No es tu turno.');
  });

  it('killing the last enemy wins the fight and gives XP', () => {
    const hero = fighter();
    const sword = attackOptions(hero).find(o => o.weapon?.id === 'greatsword');
    const enc = createEncounter([{ monster: goblin }], hero, dice(5, 15));
    const res = playerAction(enc, hero, { type: 'attack', optionId: sword.id, targetUid: 'goblin-1' }, dice(15, 6, 6));
    expect(res.encounter).toMatchObject({ status: 'victory', xp: 50 });
    expect(describeEncounterResult(res.encounter, hero)).toContain('Abatidos: Goblin');
  });

  it('dodging gives enemies disadvantage', () => {
    const hero = fighter();
    const enc = createEncounter([{ monster: goblin }], hero, dice(5, 15));
    // goblin rolls 18 and 2 -> keeps 2: miss
    const res = playerAction(enc, hero, { type: 'dodge' }, dice(18, 2));
    expect(res.character.hp).toBe(hero.hp);
    expect(res.encounter.log.at(-1).kind).toBe('enemyMiss');
  });

  it('fleeing ends the combat on a good roll', () => {
    const hero = fighter();
    const enc = createEncounter([{ monster: goblin }], hero, dice(5, 15));
    const ok = playerAction(enc, hero, { type: 'flee' }, dice(15));
    expect(ok.encounter.status).toBe('fled');
    const bad = playerAction(enc, hero, { type: 'flee' }, dice(2, 3));
    expect(bad.encounter.status).toBe('active');
  });

  it('a potion heals and is used up', () => {
    const hero = { ...fighter(), hp: 3, maxHp: 20, inventory: [{ id: 'p', name: 'Poción de curación', type: 'consumable', uses: 1 }] };
    const enc = createEncounter([{ monster: goblin }], hero, dice(5, 15));
    const res = playerAction(enc, hero, { type: 'potion', itemId: 'p' }, dice(4, 4, 1));
    expect(res.character.hp).toBe(3 + 10);
    expect(res.character.inventory).toEqual([]);
  });
});

describe('morale', () => {
  it('a badly hurt humanoid may surrender, a beast flees, the undead never', () => {
    const hero = fighter();
    const sword = attackOptions(hero).find(o => o.weapon?.id === 'greatsword');
    // Goblin with more HP so it survives a hit at half health
    const tough = { ...goblin, hp: 14 };
    let enc = createEncounter([{ monster: tough }], hero, dice(5, 15));
    // hit 15, damage 2+2+3 = 7 (half), morale roll 2 -1 = 1 < 10 -> surrenders
    let res = playerAction(enc, hero, { type: 'attack', optionId: sword.id, targetUid: 'goblin-1' }, dice(15, 2, 2, 2));
    expect(res.encounter.enemies[0].status).toBe('surrendered');
    expect(res.encounter.status).toBe('victory');
    expect(res.encounter.log.some(l => l.kind === 'morale' && l.text.includes('se rinde'))).toBe(true);

    enc = createEncounter([{ monster: { ...wolf, hp: 14 } }], hero, dice(5, 15));
    res = playerAction(enc, hero, { type: 'attack', optionId: sword.id, targetUid: 'wolf-1' }, dice(15, 2, 2, 2));
    expect(res.encounter.enemies[0].status).toBe('fled');

    enc = createEncounter([{ monster: zombie }], hero, dice(5, 15));
    res = playerAction(enc, hero, { type: 'attack', optionId: sword.id, targetUid: 'zombie-1' }, dice(15, 3, 3, 1, 1));
    expect(res.encounter.enemies[0].status).toBe('active');
  });

  it('a creature that passes its morale check keeps fighting', () => {
    const hero = fighter();
    const sword = attackOptions(hero).find(o => o.weapon?.id === 'greatsword');
    const enc = createEncounter([{ monster: { ...goblin, hp: 14 } }], hero, dice(5, 15));
    const res = playerAction(enc, hero, { type: 'attack', optionId: sword.id, targetUid: 'goblin-1' }, dice(15, 2, 2, 19, 1));
    expect(res.encounter.enemies[0].status).toBe('active');
    expect(res.encounter.log.find(l => l.kind === 'morale').text).toContain(`CD ${MORALE_DC}`);
  });

  it('the fall of the leader shakes the others', () => {
    const hero = fighter();
    const sword = attackOptions(hero).find(o => o.weapon?.id === 'greatsword');
    const boss = { ...goblin, id: 'boss', name: 'Jefe Goblin', cr: 1, xp: 200, hp: 5 };
    const enc = createEncounter([{ monster: boss }, { monster: goblin }], hero, dice(5, 5, 15));
    // kill the boss (hit 15, 6+6+3), goblin morale roll 1 -1 -> surrenders
    const res = playerAction(enc, hero, { type: 'attack', optionId: sword.id, targetUid: 'boss-1' }, dice(15, 6, 6, 1));
    expect(res.encounter.enemies.map(e => e.status)).toEqual(['dead', 'surrendered']);
    expect(res.encounter).toMatchObject({ status: 'victory', xp: 250 });
  });
});

describe('enemy abilities', () => {
  it('uses Multiattack and recharge breath weapons', () => {
    const hero = { ...fighter(), hp: 40, maxHp: 40 };
    let enc = createEncounter([{ monster: drake }], hero, dice(20, 1));
    // breath is ready: hero Dex save 2+2 = 4 < 12 -> 4d6 = 12
    let res = runEnemyTurns(enc, hero, dice(2, 3, 3, 3, 3));
    expect(res.character.hp).toBe(hero.hp - 12);
    expect(res.encounter.enemies[0].recharge.breath).toBe(false);
    // next turn: recharge roll 1 (fails) -> two bites
    enc = { ...res.encounter, turn: res.encounter.order.findIndex(o => o.kind === 'enemy') };
    res = runEnemyTurns(enc, res.character, dice(1, 15, 4, 15, 4));
    expect(res.encounter.log.filter(l => l.text.includes('mordisco'))).toHaveLength(2);
  });

  it('the hero dropping to 0 HP is a defeat', () => {
    const hero = { ...fighter(), hp: 2 };
    const enc = createEncounter([{ monster: goblin }], hero, dice(18, 2));
    const res = runEnemyTurns(enc, hero, dice(15, 6));
    expect(res.character.hp).toBe(0);
    expect(res.encounter).toMatchObject({ status: 'defeat', xp: 0 });
    expect(describeEncounterResult(res.encounter, res.character)).toContain('cae derrotado');
  });
});

describe('spells in combat', () => {
  const wizard = () => buildCharacter(sanitizeDraft({
    ...emptyDraft(), classId: 'wizard', backgroundId: 'sage', speciesId: 'human', extraFeatId: 'alert',
    baseScores: { fue: 8, des: 12, con: 13, int: 15, sab: 14, car: 10 },
    bonus: { mode: 'twoOne', plus2: 'int', plus1: 'con' }, speciesSkills: ['perception'], classSkills: ['investigation', 'medicine'],
    spells: {
      class: { cantrips: ['fireBolt', 'mageHand', 'light'], spells: ['magicMissile', 'shield', 'sleep', 'burningHands', 'mageArmor', 'grease'], prepared: ['magicMissile', 'sleep', 'burningHands', 'shield'] },
      magicInitiateWizard: { cantrips: ['rayOfFrost', 'minorIllusion'], spells: ['featherFall'] }
    },
    name: 'Elowen', languages: ['Enano', 'Dracónico']
  }));

  it('attack, save and sure-hit spells damage the target', () => {
    const hero = wizard();
    const enc = createEncounter([{ monster: { ...goblin, hp: 30 } }], hero, dice(5, 15));
    let res = playerAction(enc, hero, { type: 'spell', spellId: 'fireBolt', targetUid: 'goblin-1' }, dice(15, 7, 3, 3));
    expect(res.encounter.enemies[0].hp).toBe(23);
    res = playerAction(enc, hero, { type: 'spell', spellId: 'magicMissile', targetUid: 'goblin-1' }, dice(1, 1, 1, 15, 3));
    expect(res.encounter.enemies[0].hp).toBe(24); // 1+1+1+3
    expect(res.character.spellcasting.slots.levels[1].used).toBe(1);
    // Burning Hands: 3d6 = 9, goblin Dex save 18+2 = 20 >= 13 -> half (4)
    res = playerAction(enc, hero, { type: 'spell', spellId: 'burningHands', targetUid: 'goblin-1' }, dice(3, 3, 3, 18, 3));
    expect(res.encounter.enemies[0].hp).toBe(26);
  });

  it('a control spell makes the target lose its turn', () => {
    const hero = wizard();
    const enc = createEncounter([{ monster: goblin }], hero, dice(5, 15));
    const res = playerAction(enc, hero, { type: 'spell', spellId: 'sleep', targetUid: 'goblin-1' }, dice(2));
    expect(res.encounter.log.some(l => l.text.includes('fuera de combate'))).toBe(true);
    expect(res.encounter.log.some(l => l.text.includes('no puede actuar'))).toBe(true);
    expect(res.character.hp).toBe(hero.hp);
  });

  it('a spell without slots is refused', () => {
    const hero = wizard();
    const spent = { ...hero, spellcasting: { ...hero.spellcasting, slots: { recovery: 'long', levels: { 1: { max: 2, used: 2 } } } } };
    const enc = createEncounter([{ monster: goblin }], spent, dice(5, 15));
    expect(playerAction(enc, spent, { type: 'spell', spellId: 'magicMissile', targetUid: 'goblin-1' }, dice(1)).ok).toBe(false);
  });
});

describe('active enemies', () => {
  it('lists only creatures still fighting', () => {
    const enc = createEncounter([{ monster: goblin, count: 3 }], fighter(), dice(5, 5, 5, 15));
    enc.enemies[0].status = 'dead';
    enc.enemies[1].status = 'fled';
    expect(activeEnemies(enc).map(e => e.uid)).toEqual(['goblin-3']);
  });
});
