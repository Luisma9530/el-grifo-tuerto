import { describe, it, expect } from 'vitest';
import { cleanDraft, buildPlayerHero, rerollScores } from './newHero';
import { sanitizeIntent, applyIntent, MAX_INTENT_BYTES } from './protocol';
import { createRoom, joinPlayer, claimCharacter } from './room';
import { randomDraft, emptyDraft, sanitizeDraft } from '../utils/characterBuilder';

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const viaNetwork = draft => JSON.parse(JSON.stringify(draft));
const fighterDraft = () => sanitizeDraft({
  ...emptyDraft(),
  classId: 'fighter', backgroundId: 'soldier', speciesId: 'dwarf',
  baseScores: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['acrobatics', 'survival'],
  name: 'Durgan', languages: ['Enano', 'Élfico']
});

describe('a new player character built by the host', () => {
  it('builds any legal draft from the wizard (random heroes too)', () => {
    const rng = seeded(7);
    for (let i = 0; i < 25; i++) {
      const draft = randomDraft(rng);
      const res = buildPlayerHero(viaNetwork(draft), { level: 1, rollD6: () => 3 });
      expect(res.ok, res.error).toBe(true);
      expect(res.character.name).toBe(draft.name.trim());
    }
  });

  it('joins at the party level, with full hit points and no gold for the purse', () => {
    const res = buildPlayerHero(viaNetwork(fighterDraft()), { level: 3, rollD6: () => 3 });
    expect(res.ok).toBe(true);
    expect(res.character.level).toBe(3);
    expect(res.character.hp).toBe(res.character.maxHp);
    expect(res.character.gold).toBe(0);
    expect(res.character.joinedBy).toBe('player');
  });

  it('the starting equipment is the one of the rules: a sent inventory or gold is ignored', () => {
    const legal = buildPlayerHero(viaNetwork(fighterDraft()), { level: 1, rollD6: () => 3 }).character;
    const sneaky = { ...viaNetwork(fighterDraft()), inventory: [{ id: 'x', name: 'Espada vorpalina', type: 'weapon' }], gold: 9999, stats: { fue: 30 } };
    const res = buildPlayerHero(sneaky, { level: 1, rollD6: () => 3 });
    expect(res.ok).toBe(true);
    expect(res.character.inventory.map(i => i.name)).toEqual(legal.inventory.map(i => i.name));
    expect(res.character.stats).toEqual(legal.stats);
  });

  it('refuses ability scores outside the rules', () => {
    const standard18 = { ...viaNetwork(fighterDraft()), baseScores: { fue: 18, des: 18, con: 18, int: 18, sab: 18, car: 18 } };
    expect(buildPlayerHero(standard18, { rollD6: () => 3 }).error).toMatch(/puntuación exactamente una vez/);
    const overspent = { ...viaNetwork(fighterDraft()), method: 'pointbuy', baseScores: { fue: 15, des: 15, con: 15, int: 15, sab: 15, car: 15 } };
    expect(buildPlayerHero(overspent, { rollD6: () => 3 }).error).toMatch(/puntos/);
    expect(buildPlayerHero({ ...viaNetwork(fighterDraft()), baseScores: { ...fighterDraft().baseScores, fue: 99 } }, { rollD6: () => 3 }).ok).toBe(false);
  });

  it('with rolled scores the host rolls them, keeping the order the player chose', () => {
    const sent = { ...viaNetwork(fighterDraft()), method: 'roll', rolledPool: [18, 18, 18, 18, 18, 18], baseScores: { fue: 18, des: 17, con: 16, int: 3, sab: 4, car: 5 } };
    let n = 0;
    const dice = [6, 6, 6, 1, 5, 5, 5, 1, 4, 4, 4, 1, 3, 3, 3, 1, 2, 2, 2, 1, 1, 1, 1, 1];
    const res = buildPlayerHero(sent, { level: 1, rollD6: () => dice[n++] });
    expect(res.ok, res.error).toBe(true);
    expect(res.rolled).toEqual([18, 15, 12, 9, 6, 3]);
    // fue got the highest roll, then des, con, car, sab, int
    const base = rerollScores({ ...sent, baseScores: sent.baseScores }, (() => { let i = 0; return () => dice[i++]; })()).baseScores;
    expect(base).toEqual({ fue: 18, des: 15, con: 12, car: 9, sab: 6, int: 3 });
  });

  it('cleans odd shapes from the network', () => {
    expect(cleanDraft(null)).toBeNull();
    expect(cleanDraft({ ...viaNetwork(fighterDraft()), method: 'trampa' })).toBeNull();
    expect(cleanDraft({ ...viaNetwork(fighterDraft()), classSkills: 'todas' })).toBeNull();
    expect(cleanDraft({ ...viaNetwork(fighterDraft()), languages: ['Klingon', 'Élfico'] })).toBeNull();
    expect(cleanDraft({ ...viaNetwork(fighterDraft()), avatar: '<img onerror>' }).avatar).not.toMatch(/img/);
    expect(cleanDraft({ ...viaNetwork(fighterDraft()), backstory: 'x'.repeat(5000) }).backstory).toHaveLength(1200);
  });

  it('a full draft fits in one intent', () => {
    const rng = seeded(3);
    const biggest = Array.from({ length: 40 }, () => randomDraft(rng))
      .map(d => JSON.stringify({ type: 'create', draft: { ...d, backstory: 'x'.repeat(1200) }, seq: Date.now() }).length)
      .reduce((a, b) => Math.max(a, b), 0);
    expect(biggest).toBeLessThan(MAX_INTENT_BYTES);
  });
});

describe('the host checks who may create a character', () => {
  const room = (ids = ['durgan']) => {
    let r = createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' });
    r = joinPlayer(r, { id: 'a', name: 'Ana' }).room;
    return claimCharacter(r, 'h', ids[0], ids).room;
  };
  const game = (ids = ['durgan'], inCombat = false) => ({ characterIds: ids, names: { durgan: 'Durgan', b: 'B', c: 'C', d: 'D' }, inCombat, turnCharacterId: null, combatBusy: false });
  const create = sanitizeIntent({ type: 'create', draft: viaNetwork(fighterDraft()) }).intent;

  it('a player without a character, while the party has room', () => {
    const res = applyIntent(room(), game(), 'a', create);
    expect(res.ok).toBe(true);
    expect(res.direct.kind).toBe('create');
  });
  it('not when the party is full: choose a free one or wait for the vote', () => {
    const ids = ['durgan', 'b', 'c', 'd'];
    expect(applyIntent(room(ids), game(ids), 'a', create).error).toMatch(/elige uno libre o espera a la votación/);
  });
  it('not during a fight, nor with a character already, nor for the host', () => {
    expect(applyIntent(room(), game(['durgan'], true), 'a', create).error).toMatch(/combate/);
    const ids = ['durgan', 'b'];
    const taken = claimCharacter(room(ids), 'a', 'b', ids).room;
    expect(applyIntent(taken, game(ids), 'a', create).error).toMatch(/Ya juegas con B/);
    expect(applyIntent(room(), game(), 'h', create).ok).toBe(false);
  });
  it('a malformed draft is refused before reaching the room', () => {
    expect(sanitizeIntent({ type: 'create', draft: { method: 'roll' } }).ok).toBe(false);
  });
});
