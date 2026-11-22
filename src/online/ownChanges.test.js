import { describe, it, expect } from 'vitest';
import { applyOwnChange } from './ownChanges';
import { sanitizeIntent, applyIntent, sanitizeLevelUpChoices } from './protocol';
import { createRoom, joinPlayer, claimCharacter } from './room';
import { buildCharacter, emptyDraft, sanitizeDraft } from '../utils/characterBuilder';
import { emptyLevelUpChoices, levelUpPlan, levelHeroTo } from '../utils/leveling';
import { XP_FOR_LEVEL } from '../data/progression';

const fighter = () => buildCharacter(sanitizeDraft({
  ...emptyDraft(),
  classId: 'fighter', backgroundId: 'soldier', speciesId: 'dwarf',
  baseScores: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['acrobatics', 'survival'],
  name: 'Durgan', languages: ['Enano', 'Élfico']
}));
const ready = () => ({ ...fighter(), xp: XP_FOR_LEVEL[2] });

describe('equipment of your own character', () => {
  it('applies a legal change of hands and armor', () => {
    const hero = fighter();
    const res = applyOwnChange(hero, { kind: 'equip', hands: { main: null, off: null }, armorId: null }, () => 1);
    expect(res.ok).toBe(true);
    expect(res.changed).toBe(true);
    expect(res.character.hands).toEqual({ main: null, off: null });
    expect(res.character.wornArmor).toBeNull();
    // ...and back
    const back = applyOwnChange(res.character, { kind: 'equip', hands: hero.hands, armorId: hero.wornArmor }, () => 1);
    expect(back.ok).toBe(true);
    expect(back.character.ac).toBe(hero.ac);
  });
  it('refuses items the hero does not have, or that cannot go where asked', () => {
    const hero = fighter();
    expect(applyOwnChange(hero, { kind: 'equip', hands: { main: 'espada_de_otro', off: null }, armorId: null }, () => 1).ok).toBe(false);
    const potion = hero.inventory.find(i => i.type !== 'weapon' && i.type !== 'armor');
    expect(applyOwnChange(hero, { kind: 'equip', hands: hero.hands, armorId: potion?.id || 'nada' }, () => 1).ok).toBe(false);
  });
});

describe('level up of your own character', () => {
  const choicesFor = hero => {
    const choices = emptyLevelUpChoices(hero);
    return sanitizeLevelUpChoices(JSON.parse(JSON.stringify(choices)));
  };
  it('applies legal choices with the rules of leveling.js', () => {
    const hero = ready();
    const res = applyOwnChange(hero, { kind: 'levelUp', choices: choicesFor(hero) }, () => 1);
    expect(res.ok).toBe(true);
    expect(res.character.level).toBe(2);
    expect(res.character.maxHp).toBeGreaterThan(hero.maxHp);
  });
  it('the host rolls the hit die (the player cannot send a roll)', () => {
    const hero = ready();
    const sent = { ...emptyLevelUpChoices(hero), hp: { method: 'roll', roll: 10 } };
    const choices = sanitizeLevelUpChoices(sent);
    expect(choices.hp).toEqual({ method: 'roll', roll: null });
    const res = applyOwnChange(hero, { kind: 'levelUp', choices }, sides => (sides === levelUpPlan(hero).hitDie ? 1 : 99));
    expect(res.ok).toBe(true);
    expect(res.roll).toBe(1);
    expect(res.summary.hpGain).toBe(Math.max(1, 1 + levelUpPlan(hero).conMod + levelUpPlan(hero).extraHpPerLevel));
  });
  it('refuses it without enough experience or with illegal choices', () => {
    expect(applyOwnChange(fighter(), { kind: 'levelUp', choices: choicesFor(fighter()) }, () => 1).error).toMatch(/aún no tiene experiencia/);
    const hero = { ...levelHeroTo(fighter(), 3), xp: XP_FOR_LEVEL[4] };
    // Level 4 brings an ability score improvement that must be chosen
    const res = applyOwnChange(hero, { kind: 'levelUp', choices: choicesFor(hero) }, () => 1);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/característica/);
  });
  it('cleans the choices: unknown abilities or odd shapes are refused', () => {
    const base = emptyLevelUpChoices(fighter());
    expect(sanitizeLevelUpChoices({ ...base, asi: { mode: 'two', abilities: ['poder'] } })).toBeNull();
    expect(sanitizeLevelUpChoices({ ...base, hp: { method: 'max' } })).toBeNull();
    expect(sanitizeLevelUpChoices({ ...base, spells: { ...base.spells, cantrips: 'fireball' } })).toBeNull();
    expect(sanitizeLevelUpChoices({ ...base, extra: { hp: 999 } })).toEqual(sanitizeLevelUpChoices(base));
  });
});

describe('the host checks who sends them', () => {
  const CHARS = ['durgan', 'lia'];
  const room = () => {
    let r = createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' });
    r = joinPlayer(r, { id: 'a', name: 'Ana' }).room;
    return claimCharacter(r, 'a', 'durgan', CHARS).room;
  };
  const game = (inCombat = false) => ({ characterIds: CHARS, names: { durgan: 'Durgan', lia: 'Lía' }, inCombat, turnCharacterId: inCombat ? 'durgan' : null, combatBusy: false });
  const equip = characterId => sanitizeIntent({ type: 'equip', characterId, hands: { main: 'x1', off: null }, armorId: null }).intent;
  const level = characterId => sanitizeIntent({ type: 'levelUp', characterId, choices: emptyLevelUpChoices(fighter()) }).intent;

  it('only for a character the player controls', () => {
    expect(applyIntent(room(), game(), 'a', equip('durgan')).direct).toEqual({ kind: 'equip', characterId: 'durgan', hands: { main: 'x1', off: null }, armorId: null });
    expect(applyIntent(room(), game(), 'a', equip('lia')).error).toMatch(/No controlas a Lía/);
    expect(applyIntent(room(), game(), 'a', level('lia')).ok).toBe(false);
    expect(applyIntent(room(), game(), 'a', level('durgan')).direct.kind).toBe('levelUp');
  });
  it('not during a fight (the weapon change there is the combat action)', () => {
    expect(applyIntent(room(), game(true), 'a', equip('durgan')).error).toMatch(/vista de combate/);
    expect(applyIntent(room(), game(true), 'a', level('durgan')).error).toMatch(/acabe el combate/);
    const swap = sanitizeIntent({ type: 'combat', characterId: 'durgan', action: { type: 'equip', hands: { main: 'x1', off: null } } }).intent;
    expect(applyIntent(room(), game(true), 'a', swap).combat.action).toEqual({ type: 'equip', hands: { main: 'x1', off: null } });
  });
});
