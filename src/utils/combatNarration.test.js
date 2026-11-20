import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./geminiClient', () => ({ requestGemini: vi.fn() }));

import { requestGemini } from './geminiClient';
import {
  isAggressive, startLocalFight, narrateCombatEnd, keyMoments, buildMomentPrompt, narrateMoment, MAX_MOMENTS
} from './combatNarration';
import { encounterCandidates, resolveCombatRequest, eliteVersion, getMonster, MAX_CANDIDATES, MAX_PER_GROUP, XP_BUDGET } from './bestiary';
import { buildDMPrompt, parseDMReply, dmResponseSchema } from './dmPrompt';
import { createEncounter } from './encounter';
import { stripRollTags } from './gameEngine';

const character = { name: 'Kaelen', level: 3, hp: 20, maxHp: 28, ac: 15, gold: 10, stats: { fue: 10, des: 16, con: 12, int: 10, sab: 12, car: 10 } };
const world = { name: 'Oakhaven', genre: 'Fantasía', initialLocation: 'Taberna', mapNodes: [] };
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

describe('creatures offered to the Dungeon Master', () => {
  it('is a short list that fits the level and the world', () => {
    const { creatures, budget } = encounterCandidates(3, { tags: ['bosque', 'ruinas'] });
    expect(creatures.length).toBeGreaterThan(3);
    expect(creatures.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    expect(budget).toEqual({ low: XP_BUDGET[3][0], moderate: XP_BUDGET[3][1], high: XP_BUDGET[3][2] });
    creatures.forEach(c => {
      expect(getMonster(c.id)).toBeTruthy();
      expect(c.xp).toBeLessThanOrEqual(budget.high);
    });
  });
});

describe('fights requested by the Dungeon Master', () => {
  const someId = () => encounterCandidates(3).creatures[0].id;

  it('drops unknown creatures and clamps the counts', () => {
    const id = someId();
    const groups = resolveCombatRequest({ enemigos: [{ id: 'dragon-inventado', cantidad: 1 }, { id, cantidad: 40 }] }, 20);
    expect(groups).toHaveLength(1);
    expect(groups[0].monster.id).toBe(id);
    expect(groups[0].count).toBeLessThanOrEqual(MAX_PER_GROUP);
    expect(resolveCombatRequest(null, 3)).toEqual([]);
    expect(resolveCombatRequest({ enemigos: [{ id: 'nada' }] }, 3)).toEqual([]);
  });

  it('keeps a named individual alone, with its trait, and can make it elite', () => {
    const id = someId();
    const [group] = resolveCombatRequest({ enemigos: [{ id, cantidad: 5, nombre: '  Grisk   el Tuerto ', rasgo: 'Lleva un parche de oro', elite: true }] }, 10);
    expect(group.count).toBe(1);
    expect(group.name).toBe('Grisk el Tuerto');
    expect(group.trait).toBe('Lleva un parche de oro');
    expect(group.elite).toBe(true);
    expect(group.monster.hp).toBe(Math.round(getMonster(id).hp * 1.5));

    const encounter = createEncounter([group], character, () => 10);
    expect(encounter.enemies[0]).toMatchObject({ name: 'Grisk el Tuerto', baseName: getMonster(id).name, elite: true, trait: 'Lleva un parche de oro' });
  });

  it('trims a fight far too hard for a solo hero', () => {
    const strong = [...encounterCandidates(1).creatures].sort((a, b) => b.xp - a.xp)[0];
    const groups = resolveCombatRequest({ enemigos: [{ id: strong.id, cantidad: 6 }] }, 1);
    const xp = groups.reduce((n, g) => n + g.monster.xp * g.count, 0);
    expect(groups[0].count).toBeGreaterThanOrEqual(1);
    expect(xp <= XP_BUDGET[1][2] * 1.5 || groups[0].count === 1).toBe(true);
  });

  it('elite versions hit harder', () => {
    const base = getMonster(someId());
    const elite = eliteVersion(base);
    expect(elite.xp).toBe(Math.round(base.xp * 1.5));
    base.actions.forEach((a, i) => {
      if (a.kind === 'save') expect(elite.actions[i].dc).toBe(a.dc + 1);
      else expect(elite.actions[i].bonus).toBe(a.bonus + 1);
    });
  });
});

describe('prompt and reply', () => {
  const bestiary = encounterCandidates(3);

  it('offers the creatures only when a fight may start', () => {
    const prompt = buildDMPrompt({ playerAction: 'Desenvaino', character, world, d20: 10, structured: true, bestiary });
    expect(prompt).toContain('"combate"');
    expect(prompt).toContain(bestiary.creatures[0].id);
    expect(buildDMPrompt({ playerAction: 'Hola', character, world, d20: 10, structured: true })).not.toContain('"combate"');
    expect(dmResponseSchema(false, true).properties.combate).toBeTruthy();
    expect(dmResponseSchema(false, false).properties.combate).toBeUndefined();
    expect(dmResponseSchema(true, true).required).toContain('resumen');
  });

  it('asks only for the outcome after a fight', () => {
    const prompt = buildDMPrompt({ playerAction: 'x', character, world, d20: 10, structured: true, combatResult: '⚔️ Kaelen gana el combate.' });
    expect(prompt).toContain('Kaelen gana el combate');
    expect(prompt).toContain('"experiencia": 0');
  });

  it('reads the fight from the reply', () => {
    const base = { narracion: 'Salen de las sombras.', usaTirada: false, danio: 0, curacion: 0, oro: 0, opciones: [] };
    const combate = { enemigos: [{ id: 'goblinWarrior', cantidad: 2 }] };
    expect(parseDMReply(JSON.stringify({ ...base, combate }), character).combat).toEqual(combate);
    expect(parseDMReply(JSON.stringify({ ...base, combate: { enemigos: [] } }), character).combat).toBeNull();
    expect(parseDMReply(JSON.stringify(base), character).combat).toBeNull();
  });
});

describe('roll tags', () => {
  it('are removed when a fight starts', () => {
    expect(stripRollTags('Avanzas [🎲 Destreza D20: 12 + 2 = 14 vs CD 12]. Un jabalí sale.')).toBe('Avanzas. Un jabalí sale.');
    expect(stripRollTags('Sin tiradas.')).toBe('Sin tiradas.');
  });
});

describe('local engine', () => {
  it('recognises actions that start a fight', () => {
    expect(isAggressive('ataco al bandido')).toBe(true);
    expect(isAggressive('desenvaino la espada y cargo')).toBe(true);
    expect(isAggressive('pido una cerveza')).toBe(false);
  });

  it('starts an easy fight with listed creatures', () => {
    const bestiary = encounterCandidates(2);
    const { text, combat } = startLocalFight(bestiary, { character, rng: seq([0.3]) });
    expect(text).toContain('Kaelen');
    const [entry] = combat.enemigos;
    expect(bestiary.creatures.map(c => c.id)).toContain(entry.id);
    expect(resolveCombatRequest(combat, 2).length).toBe(1);
  });

  it('closes a fight with loot only on victory', () => {
    expect(narrateCombatEnd('⚔️ Kaelen gana el combate en 2 rondas.', { character, rng: () => 0.5 }).goldEarned).toBeGreaterThan(0);
    expect(narrateCombatEnd('💀 Kaelen cae derrotado en combate.', { character }).goldEarned).toBe(0);
    expect(narrateCombatEnd('🏃 Kaelen huye del combate.', { character }).goldEarned).toBe(0);
  });
});

describe('key moments', () => {
  it('only a fallen leader or broken morale count', () => {
    const moments = keyMoments([
      { kind: 'hit', text: 'golpe' },
      { kind: 'down', text: 'El goblin cae.', leader: false },
      { kind: 'down', text: 'El jefe cae.', leader: true },
      { kind: 'morale', text: 'aguanta' },
      { kind: 'morale', text: 'se rinde', outcome: 'surrendered' },
      { kind: 'morale', text: 'huye', outcome: 'fled' }
    ]);
    expect(moments.map(m => m.kind)).toEqual(['leader', 'surrender', 'flee']);
    expect(MAX_MOMENTS).toBe(2);
  });

  const encounter = { enemies: [{ name: 'Grisk', trait: 'tuerto', status: 'surrendered' }, { name: 'Goblin 2', status: 'active' }] };
  const context = { moments: [{ kind: 'surrender', text: 'Grisk se rinde.' }], encounter, character, world };

  it('sends a short prompt with the facts only', () => {
    const prompt = buildMomentPrompt(context);
    expect(prompt).toContain('Grisk se rinde.');
    expect(prompt).toContain('Grisk (tuerto)');
    expect(prompt).toContain('Siguen en pie: Goblin 2');
    expect(prompt.length).toBeLessThan(800);
  });

  beforeEach(() => requestGemini.mockReset());

  it('returns the narration, or nothing when the AI fails', async () => {
    requestGemini.mockResolvedValueOnce({ ok: true, text: JSON.stringify({ narracion: '  Grisk tira el hacha.  ' }) });
    expect(await narrateMoment('key', context)).toBe('Grisk tira el hacha.');
    requestGemini.mockResolvedValueOnce({ ok: false, reason: 'overloaded' });
    expect(await narrateMoment('key', context)).toBeNull();
    requestGemini.mockRejectedValueOnce(new Error('red'));
    expect(await narrateMoment('key', context)).toBeNull();
    expect(await narrateMoment(null, context)).toBeNull();
  });
});
