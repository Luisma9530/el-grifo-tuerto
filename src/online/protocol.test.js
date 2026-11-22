import { describe, it, expect } from 'vitest';
import { sanitizeIntent, applyIntent, stillValid, MAX_ACTION_TEXT } from './protocol';
import { createRoom, joinPlayer, claimCharacter, setPresence } from './room';

const CHARS = ['brena', 'tobias'];
const names = { brena: 'Brena', tobias: 'Tobías' };
const room0 = () => {
  let room = createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' });
  room = joinPlayer(room, { id: 'a', name: 'Ana' }).room;
  return claimCharacter(room, 'a', 'brena', CHARS).room;
};
const outside = { characterIds: CHARS, names, inCombat: false, turnCharacterId: null, combatBusy: false };
const fight = (turn, extra = {}) => ({ ...outside, inCombat: true, turnCharacterId: turn, ...extra });
const act = (characterId, text = 'Abro la puerta') => sanitizeIntent({ type: 'act', characterId, kind: 'text', payload: { text } }).intent;

describe('sanitizeIntent', () => {
  it('refuses unknown types and odd shapes', () => {
    expect(sanitizeIntent(null).ok).toBe(false);
    expect(sanitizeIntent({ type: 'hackear' }).ok).toBe(false);
    expect(sanitizeIntent({ type: 'act', characterId: 'brena', kind: 'texto' }).ok).toBe(false);
    expect(sanitizeIntent({ type: 'claim', characterId: { $gt: '' } }).ok).toBe(false);
    expect(sanitizeIntent({ type: 'claim', characterId: 'a b' }).ok).toBe(false);
  });
  it('keeps only the known fields and cuts long texts', () => {
    const res = sanitizeIntent({ type: 'act', characterId: 'brena', kind: 'text', payload: { text: 'x'.repeat(1000), hp: 999 }, evil: true });
    expect(res.ok).toBe(true);
    expect(res.intent).toEqual({ type: 'act', characterId: 'brena', kind: 'text', payload: { text: 'x'.repeat(MAX_ACTION_TEXT) } });
  });
  it('the host recomputes the checks: only the skill or ability travels, not the modifier', () => {
    const res = sanitizeIntent({ type: 'act', characterId: 'brena', kind: 'check', payload: { skillId: 'perception', modifier: 50 } });
    expect(res.intent.payload).toEqual({ skillId: 'perception', ability: null });
    expect(sanitizeIntent({ type: 'act', characterId: 'brena', kind: 'check', payload: { ability: 'poder' } }).ok).toBe(false);
  });
  it('clamps the target AC of an attack outside combat', () => {
    const res = sanitizeIntent({ type: 'act', characterId: 'brena', kind: 'attack', payload: { optionId: 'w1', targetAC: 99 } });
    expect(res.intent.payload.targetAC).toBe(30);
  });
  it('combat actions keep only the fields of playerAction', () => {
    const res = sanitizeIntent({ type: 'combat', characterId: 'brena', action: { type: 'attack', optionId: 'w1', targetUid: 'e1', damage: 500 } });
    expect(res.intent.action).toEqual({ type: 'attack', optionId: 'w1', targetUid: 'e1' });
    expect(sanitizeIntent({ type: 'combat', characterId: 'brena', action: { type: 'win' } }).ok).toBe(false);
  });
  it('empty chat is refused', () => {
    expect(sanitizeIntent({ type: 'chat', text: '   ' }).ok).toBe(false);
  });
});

describe('applyIntent on the host', () => {
  it('queues an action of a character the player controls', () => {
    const res = applyIntent(room0(), outside, 'a', act('brena'));
    expect(res.ok).toBe(true);
    expect(res.room.queue[0]).toMatchObject({ playerId: 'a', characterId: 'brena', label: 'Brena: «Abro la puerta»' });
  });
  it('refuses actions for a character somebody else plays', () => {
    const res = applyIntent(room0(), outside, 'a', act('tobias'));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/No controlas a Tobías/);
  });
  it('refuses players who are not in the room or not connected', () => {
    expect(applyIntent(room0(), outside, 'x', act('brena')).ok).toBe(false);
    const away = setPresence(room0(), ['h'], CHARS);
    expect(applyIntent(away, outside, 'a', act('brena')).ok).toBe(false);
  });
  it('the host can act for the character of an absent player', () => {
    const away = setPresence(room0(), ['h'], CHARS);
    expect(applyIntent(away, outside, 'h', act('brena')).ok).toBe(true);
    expect(applyIntent(room0(), outside, 'h', act('brena')).ok).toBe(false);
  });
  it('free actions are not allowed during a fight', () => {
    const res = applyIntent(room0(), fight('brena'), 'a', act('brena'));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/por turnos/);
  });

  describe('combat turns', () => {
    const attack = characterId => sanitizeIntent({ type: 'combat', characterId, action: { type: 'attack', optionId: 'w1', targetUid: 'e1' } }).intent;
    it('only the player of the hero whose turn it is acts', () => {
      const ok = applyIntent(room0(), fight('brena'), 'a', attack('brena'));
      expect(ok.ok).toBe(true);
      expect(ok.combat).toEqual({ characterId: 'brena', action: { type: 'attack', optionId: 'w1', targetUid: 'e1' } });
      const notTurn = applyIntent(room0(), fight('tobias'), 'a', attack('brena'));
      expect(notTurn.ok).toBe(false);
      expect(notTurn.error).toMatch(/turno de Tobías/);
      const notMine = applyIntent(room0(), fight('tobias'), 'a', attack('tobias'));
      expect(notMine.ok).toBe(false);
    });
    it('the host plays the turn of a hero nobody else plays', () => {
      expect(applyIntent(room0(), fight('tobias'), 'h', attack('tobias')).ok).toBe(true);
      expect(applyIntent(room0(), fight('brena'), 'h', attack('brena')).ok).toBe(false);
    });
    it('waits while the dice roll, and refuses when enemies act or there is no fight', () => {
      expect(applyIntent(room0(), fight('brena', { combatBusy: true }), 'a', attack('brena')).ok).toBe(false);
      expect(applyIntent(room0(), fight(null), 'a', attack('brena')).error).toMatch(/enemigos/);
      expect(applyIntent(room0(), outside, 'a', attack('brena')).ok).toBe(false);
    });
  });

  it('votes and claims go through the room rules', () => {
    const claim = applyIntent(room0(), outside, 'a', { type: 'claim', characterId: 'tobias' });
    expect(claim.ok).toBe(true);
    expect(claim.room.claims).toEqual({ tobias: 'a' });
    const steal = applyIntent(claim.room, outside, 'h', { type: 'claim', characterId: 'tobias' });
    expect(steal.ok).toBe(false);
  });
});

describe('stillValid (before playing a queued action)', () => {
  it('drops actions whose player no longer controls the character', () => {
    let room = applyIntent(room0(), outside, 'a', act('brena')).room;
    const item = room.queue[0];
    expect(stillValid(room, outside, item).ok).toBe(true);
    room = setPresence(room, ['h'], CHARS);
    expect(stillValid(room, outside, item).ok).toBe(false);
    expect(stillValid(room0(), { ...outside, characterIds: ['tobias'] }, item).ok).toBe(false);
  });
});
