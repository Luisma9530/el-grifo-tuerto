import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rollDie, rollCheckWithStat, generateDMResponse, getModifierNumber } from './gameEngine';
import { tavernAudio } from './audio';

const character = { name: 'Kaelen', race: 'Elfo', class: 'Pícaro (Nivel 3)', hp: 20, maxHp: 28, gold: 10 };
const world = { name: 'Oakhaven', genre: 'Fantasía', factions: [{ name: 'Guardia' }, { name: 'Círculo' }] };

/** Make Math.random produce the given d20 result. */
const forceD20 = value => vi.spyOn(Math, 'random').mockReturnValue((value - 1) / 20 + 0.001);

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(tavernAudio, 'playDiceRoll').mockImplementation(() => {});
  vi.spyOn(tavernAudio, 'playCritSuccess').mockImplementation(() => {});
  vi.spyOn(tavernAudio, 'playCritFail').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('rollDie', () => {
  it('stays within range and plays the dice sound by default', () => {
    for (let i = 0; i < 200; i++) {
      const value = rollDie(20);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(20);
    }
    expect(tavernAudio.playDiceRoll).toHaveBeenCalled();
  });

  it('is silent when the roll will be animated', () => {
    rollDie(6, { silent: true });
    expect(tavernAudio.playDiceRoll).not.toHaveBeenCalled();
  });
});

describe('rollCheckWithStat', () => {
  it('adds the ability modifier and compares with the DC', () => {
    forceD20(9);
    const check = rollCheckWithStat(17, 'Destreza', 12, { silent: true });
    expect(check).toMatchObject({ rawRoll: 9, modifier: getModifierNumber(17), total: 12, dc: 12, success: true, statName: 'Destreza' });
  });

  it('a natural 20 always succeeds and a natural 1 always fails', () => {
    forceD20(20);
    expect(rollCheckWithStat(3, 'Fuerza', 30, { silent: true })).toMatchObject({ isNat20: true, success: true });
    forceD20(1);
    expect(rollCheckWithStat(30, 'Fuerza', 2, { silent: true })).toMatchObject({ isNat1: true, success: false });
  });

  it('only plays critical sounds when not silent', () => {
    forceD20(20);
    rollCheckWithStat(10, 'Fuerza', 12, { silent: true });
    expect(tavernAudio.playCritSuccess).not.toHaveBeenCalled();
    rollCheckWithStat(10, 'Fuerza', 12);
    expect(tavernAudio.playCritSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('generateDMResponse (procedural engine, no API keys)', () => {
  it('reports the roll Duncan made when the narration mentions it', async () => {
    forceD20(15);
    const res = await generateDMResponse({ playerAction: 'Voy a atacar al encapuchado', character, world });
    expect(res.roll).toEqual({ sides: 20, value: 15 });
    expect(res.text).toContain('15');
    expect(tavernAudio.playDiceRoll).not.toHaveBeenCalled(); // the dice animation owns the sound
  });

  it('does not report a roll when the narration does not use it', async () => {
    forceD20(15);
    const res = await generateDMResponse({ playerAction: 'Saludo al tabernero', character, world });
    expect(res.roll).toBeNull();
    expect(res.suggestedActions.length).toBeGreaterThan(0);
  });

  it("uses the player's own check instead of rolling again", async () => {
    const random = vi.spyOn(Math, 'random');
    const playerRoll = { rawRoll: 4, modifier: 3, total: 7, dc: 12, success: false, isNat20: false, isNat1: false, statName: 'Destreza' };
    const res = await generateDMResponse({ playerAction: 'Realizo una tirada de Destreza', character, world, playerRoll });
    expect(random).not.toHaveBeenCalled();
    expect(res.roll).toBeNull(); // already shown to the player
    expect(res.text).toContain('Destreza');
    expect(res.text).toContain('(Fallo)');
    expect(res.text).toContain('**4**');
  });

  it('narrates success, critical and fumble for player checks', async () => {
    const base = { modifier: 0, dc: 12, statName: 'Fuerza', isNat20: false, isNat1: false };
    const ok = await generateDMResponse({ playerAction: 'x', character, world, playerRoll: { ...base, rawRoll: 14, total: 14, success: true } });
    expect(ok.text).toContain('(Éxito)');
    expect(ok.damageTaken).toBe(0);

    const crit = await generateDMResponse({ playerAction: 'x', character, world, playerRoll: { ...base, rawRoll: 20, total: 20, success: true, isNat20: true } });
    expect(crit.text).toContain('¡CRÍTICO!');
    expect(crit.goldEarned).toBeGreaterThan(0);

    const fumble = await generateDMResponse({ playerAction: 'x', character, world, playerRoll: { ...base, rawRoll: 1, total: 1, success: false, isNat1: true } });
    expect(fumble.text).toContain('¡PIFIA!');
    expect(fumble.damageTaken).toBeGreaterThan(0);
  });
});
