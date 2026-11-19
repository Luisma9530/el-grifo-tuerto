import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { narrateSpell, narrateRest } from './spellNarration';
import { generateDMResponse } from './gameEngine';
import { buildDMPrompt } from './dmPrompt';
import { getSpell } from './spellcasting';
import { tavernAudio } from './audio';

const character = {
  name: 'Elowen', race: 'Alto Elfo', class: 'Mago (Nivel 1)', hp: 8, maxHp: 8, ac: 11, gold: 13, proficiencyBonus: 2,
  stats: { fue: 8, des: 12, con: 14, int: 17, sab: 14, car: 10 },
  spellcasting: {
    slots: { max: 2, used: 1, recovery: 'long' },
    freeCastsUsed: [],
    known: [
      { id: 'fireBolt', source: 'Mago', ability: 'int', prepared: true, freeCast: false },
      { id: 'burningHands', source: 'Mago', ability: 'int', prepared: true, freeCast: false },
      { id: 'mageArmor', source: 'Mago', ability: 'int', prepared: false, freeCast: false }
    ]
  }
};
const world = { name: 'Oakhaven', genre: 'Fantasía', factions: [{ name: 'Guardia' }, { name: 'Círculo' }] };

const cast = (id, extra = {}) => ({
  spell: getSpell(id), modifier: 3, saveDC: 13, attackBonus: 5, usedSlot: false, usedFreeCast: false,
  attack: null, damage: null, heal: null, ...extra
});

describe('narrateSpell', () => {
  it('narrates a hit, a critical and a miss of a spell attack', () => {
    const damage = { dice: [7], sides: 10, bonus: 0, total: 7, type: 'fuego' };
    const hit = narrateSpell(cast('fireBolt', { attack: { raw: 12, total: 17, isNat20: false, isNat1: false }, damage }), { character, enemyRoll: 5 });
    expect(hit.text).toContain('(Impacta)');
    expect(hit.text).toContain('**7** de daño fuego');
    expect(hit.usedEnemyRoll).toBe(false);

    const crit = narrateSpell(cast('fireBolt', { attack: { raw: 20, total: 25, isNat20: true, isNat1: false }, damage }), { character, enemyRoll: 5 });
    expect(crit.text).toContain('¡CRÍTICO!');
    const miss = narrateSpell(cast('fireBolt', { attack: { raw: 3, total: 8, isNat20: false, isNat1: false }, damage }), { character, enemyRoll: 5 });
    expect(miss.text).toContain('(Falla)');
    expect(miss.text).not.toContain('de daño fuego');
  });

  it("uses the engine's die as the target's saving throw", () => {
    const damage = { dice: [4, 4, 4], sides: 6, bonus: 0, total: 12, type: 'fuego' };
    const failed = narrateSpell(cast('burningHands', { damage }), { character, enemyRoll: 6 });
    expect(failed.text).toContain('Salvación de Destreza del objetivo D20: **6** = 7 vs CD 13');
    expect(failed.text).toContain('(No resiste)');
    expect(failed.text).toContain('**12** de daño fuego');
    expect(failed.usedEnemyRoll).toBe(true);

    const saved = narrateSpell(cast('burningHands', { damage }), { character, enemyRoll: 15 });
    expect(saved.text).toContain('(Resiste)');
    expect(saved.text).toContain('**6** de daño fuego'); // half damage
    // A save without damage describes the effect instead
    expect(narrateSpell(cast('sleep'), { character, enemyRoll: 2 }).text).toContain('sueño mágico');
  });

  it('narrates sure hits, healing and utility spells without any roll', () => {
    const missile = narrateSpell(cast('magicMissile', { damage: { dice: [1, 2, 3], sides: 4, bonus: 3, total: 9, type: 'fuerza' } }), { character, enemyRoll: 1 });
    expect(missile.text).toContain('**9** de daño fuerza');
    const heal = narrateSpell(cast('cureWounds', { heal: { total: 10, applied: 6 } }), { character, enemyRoll: 1 });
    expect(heal.text).toContain('**6** puntos de golpe');
    const utility = narrateSpell(cast('mageHand'), { character, enemyRoll: 1 });
    expect(utility.text).toContain('mano espectral');
    [missile, heal, utility].forEach(r => {
      expect(r.text).not.toContain('🎲');
      expect(r.suggestedActions.length).toBeGreaterThan(2);
    });
  });

  it('narrates rests', () => {
    expect(narrateRest('long', character).text).toContain('amanecer');
    expect(narrateRest('short', character).text).toContain('chimenea');
  });
});

describe('local engine with spells and rests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(tavernAudio, 'playDiceRoll').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the die only when it was the target saving throw', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.26); // d20 = 6
    const save = await generateDMResponse({ playerAction: 'x', character, world, spellCast: cast('burningHands', { damage: { total: 12, type: 'fuego' } }) });
    expect(save.roll).toEqual({ sides: 20, value: 6 });

    const utility = await generateDMResponse({ playerAction: 'x', character, world, spellCast: cast('mageHand') });
    expect(utility.roll).toBeNull();

    const attackCast = cast('fireBolt', { attack: { raw: 15, total: 20, isNat20: false, isNat1: false }, damage: { total: 5, type: 'fuego' } });
    const playerRoll = { rawRoll: 15, modifier: 5, total: 20, dc: 12, success: true, isNat20: false, isNat1: false, statName: 'ataque de conjuro' };
    const attack = await generateDMResponse({ playerAction: 'x', character, world, spellCast: attackCast, playerRoll });
    expect(attack.roll).toBeNull(); // the player already saw their own roll
    expect(attack.text).toContain('(Impacta)');

    const rest = await generateDMResponse({ playerAction: 'Hago un descanso largo', character, world, rest: 'long' });
    expect(rest.roll).toBeNull();
    expect(rest.text).toContain('amanecer');
    expect(rest.damageTaken).toBe(0);
  });
});

describe('AI prompt with magic', () => {
  it('lists the spells the hero can cast and the slots left', () => {
    const prompt = buildDMPrompt({ playerAction: 'x', character, world, d20: 10 });
    expect(prompt).toContain('espacios de conjuro que le quedan (nivel 1: 1 de 2)');
    expect(prompt).toContain('Trucos: Descarga de Fuego.');
    expect(prompt).toContain('Conjuros: Manos Ardientes.');
    expect(prompt).not.toContain('Armadura de Mago'); // in the book, not prepared
  });

  it("turns the d20 into the target's saving throw for save spells", () => {
    const prompt = buildDMPrompt({ playerAction: 'x', character, world, d20: 14, spellCast: cast('burningHands') });
    expect(prompt).toContain('tirada de salvación de Destreza del OBJETIVO');
    expect(prompt).toContain('CD 13');
    expect(prompt).not.toContain('YA se ha lanzado para esta acción');
  });

  it('asks for no roll on utility spells and rests, and not to re-apply effects', () => {
    const utility = buildDMPrompt({ playerAction: 'x', character, world, d20: 14, spellCast: cast('mageHand') });
    expect(utility).toContain('no necesita ninguna tirada');
    const rest = buildDMPrompt({ playerAction: 'x', character, world, d20: 14, rest: 'long', effectsApplied: true });
    expect(rest).toContain('no necesita ninguna tirada');
    expect(rest).toContain('ya están aplicados en la ficha');
    expect(buildDMPrompt({ playerAction: 'x', character, world, d20: 14 })).not.toContain('ya están aplicados');
  });
});
