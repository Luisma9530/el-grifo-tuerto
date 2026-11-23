// Surprise attacks end to end: the local engine and Duncan start the fight,
// the party and an online guest play the opening strike, the simulator, the
// saved snapshot and the narration.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateDMResponse } from './gameEngine';
import { buildDMPrompt, dmResponseSchema } from './dmPrompt';
import { tavernAudio } from './audio';
import { createEncounter, addOpening, playerAction, currentHeroUid, openingPending } from './encounter';
import { detectOpeningStrike, openingReady } from './surprise';
import { openingLine } from './combatNarration';
import { quickHero, startSimulation, autoFight, autoAction, simulateMany, dieFrom, SIM_SURPRISE } from './simulator';
import { makeSnapshot, normalizeSnapshots } from './combatSnapshots';
import { getMonster } from './bestiary';
import { attackOptions } from './combat';
import { sanitizeIntent, applyIntent } from '../online/protocol';
import { createRoom, joinPlayer, claimCharacter } from '../online/room';

const character = { id: 'pc_a', name: 'Kaelen', race: 'Elfo', class: 'Pícaro', hp: 20, maxHp: 28, gold: 10, level: 1 };
const world = { name: 'Oakhaven', genre: 'Fantasía', factions: [{ name: 'Guardia' }, { name: 'Círculo' }] };
const bestiary = { creatures: [{ id: 'bandit', name: 'Bandido', cr: 0.125, xp: 25, type: 'humanoide' }], budget: { low: 50, moderate: 75, high: 100 } };
const quiet = [{ sender: 'duncan', text: 'Duncan te sirve otra jarra y te cuenta chismes del molino.' }];

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dice = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(tavernAudio, 'playDiceRoll').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the local engine starts the fight', () => {
  it('an attack in a quiet scene: the enemies are surprised and the attack is the opening strike', async () => {
    const res = await generateDMResponse({ playerAction: 'Le clavo la daga al tabernero', character, world, bestiary, history: quiet });
    expect(res.combat.enemigos[0].id).toBe('bandit');
    expect(res.combat).toMatchObject({ heroAttacks: true, surprise: { side: 'enemies', who: 'all' } });
    expect(res.text).toContain('Eso no se lo esperaba nadie');
  });

  it('an attack when the weapons are already out: no surprise, still an opening strike', async () => {
    const tense = [{ sender: 'duncan', text: 'El bandido desenvaina y te amenaza.' }];
    const res = await generateDMResponse({ playerAction: 'Ataco al bandido', character, world, bestiary, history: tense });
    expect(res.combat).toMatchObject({ heroAttacks: true, surprise: null });
  });

  it('sneaking up: the game will roll Stealth for whoever acts', async () => {
    const tense = [{ sender: 'duncan', text: 'Los bandidos montan guardia, hostiles.' }];
    const res = await generateDMResponse({ playerAction: 'Me acerco por la espalda y le apuñalo', character, world, bestiary, history: tense });
    expect(res.combat.surprise).toMatchObject({ side: 'enemies', check: { skill: 'stealth', heroUid: 'pc_a' } });
  });

  it('exploring the wild: an ambush on the party (no opening strike)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const res = await generateDMResponse({ playerAction: 'Me adentro en el bosque', character, world, bestiary, here: { name: 'Bosque', settlement: null } });
    expect(res.combat).toMatchObject({ heroAttacks: false, surprise: { side: 'heroes', check: { skill: 'stealth' } } });
    expect(res.text).toContain('Ni lo oíste venir');
  });

  it('never two ambushes in a row: the engine reports each exploration so the campaign remembers', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const wild = { name: 'Bosque', settlement: null };
    const first = await generateDMResponse({ playerAction: 'Me adentro en el bosque', character, world, bestiary, here: wild });
    expect(first.exploration).toEqual({ ambushed: true });
    // Right after an ambush: a quiet exploration, even with the lowest roll
    const second = await generateDMResponse({ playerAction: 'Sigo el sendero del bosque', character, world, bestiary, here: wild, lastWasAmbush: true });
    expect(second.combat).toBeNull();
    expect(second.exploration).toEqual({ ambushed: false });
    // ...and then ambushes are possible again
    const third = await generateDMResponse({ playerAction: 'Avanzo entre los árboles', character, world, bestiary, here: wild, lastWasAmbush: false });
    expect(third.exploration).toEqual({ ambushed: true });
    // Other actions leave the memory alone
    expect((await generateDMResponse({ playerAction: 'Pido una cerveza', character, world, bestiary, here: wild })).exploration).toBeNull();
  });

  it('exploring in a town is safe', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const res = await generateDMResponse({ playerAction: 'Me adentro en el mercado', character, world, bestiary, here: { name: 'Villa', settlement: 'town' } });
    expect(res.combat).toBeNull();
  });
});

describe('Duncan starts the fight', () => {
  const reply = payload => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) });
  const base = { narracion: 'El bandido se gira, demasiado tarde.', usaTirada: false, danio: 0, curacion: 0, oro: 0, opciones: ['Luchar'] };

  it('the prompt and the schema ask for the surprise and the hero attack', () => {
    const prompt = buildDMPrompt({ playerAction: 'Ataco al bandido', character, world, history: [], d20: 5, bestiary });
    expect(prompt).toContain('"ataqueDelHeroe": true');
    expect(prompt).toContain('NO digas si acierta');
    expect(prompt).toContain('"sorpresa"');
    const schema = dmResponseSchema(false, true);
    expect(schema.properties.combate.properties.sorpresa.properties.quien.enum).toEqual(['enemigos', 'grupo', 'nadie']);
    expect(schema.properties.combate.properties.ataqueDelHeroe.type).toBe('BOOLEAN');
  });

  it("his field is validated: who is surprised, the check, the hero's attack and its target", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({
      ...base,
      combate: { enemigos: [{ id: 'bandit', cantidad: 2 }], sorpresa: { quien: 'enemigos', tirada: 'engano', motivo: 'en mitad del brindis' }, ataqueDelHeroe: true, objetivo: 'bandit' }
    })));
    const res = await generateDMResponse({ playerAction: 'Mientras brindamos, le clavo la daga', character, world, bestiary, apiKeys: ['clave-de-prueba-123'], partyNames: ['Kaelen'] });
    expect(res.combat).toMatchObject({
      heroAttacks: true, targetId: 'bandit',
      surprise: { side: 'enemies', who: 'all', reason: 'en mitad del brindis', check: { skill: 'deception', heroUid: 'pc_a' } }
    });
  });

  it('an ambush on the party', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({
      ...base, combate: { enemigos: [{ id: 'bandit', cantidad: 2 }], sorpresa: { quien: 'grupo', afectados: ['Kaelen'] }, ataqueDelHeroe: false }
    })));
    const res = await generateDMResponse({ playerAction: 'Sigo el sendero', character, world, bestiary, apiKeys: ['clave-de-prueba-123'], partyNames: ['Kaelen', 'Tora'] });
    expect(res.combat).toMatchObject({ heroAttacks: false, surprise: { side: 'heroes', who: ['Kaelen'] } });
  });

  it('he cannot ambush the hero who attacks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({
      ...base, combate: { enemigos: [{ id: 'bandit', cantidad: 1 }], sorpresa: { quien: 'grupo' } }
    })));
    const res = await generateDMResponse({ playerAction: 'Ataco al bandido', character, world, bestiary, apiKeys: ['clave-de-prueba-123'] });
    expect(res.combat).toMatchObject({ heroAttacks: true, surprise: null });
  });
});

describe('the opening strike in a party and online', () => {
  const fighter = (id, seed) => ({ ...quickHero({ classId: 'fighter', level: 2, rng: seeded(seed) }), id });

  it('the member who wrote the attack plays it; an unclear target waits for that member', () => {
    const party = [fighter('brena', 1), fighter('tobias', 2)];
    let enc = createEncounter([{ monster: getMonster('bandit') }, { monster: getMonster('cultist') }], party, dice(10));
    const opening = detectOpeningStrike('¡A por ellos!', party[1], enc.enemies);
    expect(opening.needs.target).toBe(true);
    enc = addOpening(enc, party, opening);
    expect(openingReady(enc.opening)).toBe(false);
    expect(currentHeroUid(enc)).toBe('tobias');

    // Online: Tobías is played by a guest; the host accepts his combat intent (it is "his turn")
    let room = createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' });
    room = joinPlayer(room, { id: 'g', name: 'Ana' }).room;
    room = claimCharacter(room, 'g', 'tobias', ['brena', 'tobias']).room;
    const game = { characterIds: ['brena', 'tobias'], names: { brena: 'Brena', tobias: 'Tobías' }, inCombat: true, turnCharacterId: currentHeroUid(enc), combatBusy: false };
    const weapon = attackOptions(party[1]).find(o => o.weapon);
    const intent = sanitizeIntent({ type: 'combat', characterId: 'tobias', action: { type: 'attack', optionId: weapon.id, targetUid: enc.enemies[1].uid } }).intent;
    const accepted = applyIntent(room, game, 'g', intent);
    expect(accepted.ok).toBe(true);
    // ...but not for Brena, whose turn it is not
    expect(applyIntent(room, game, 'g', { ...intent, characterId: 'brena' }).ok).toBe(false);

    const res = playerAction(enc, party, accepted.combat.action, dice(15, 5, 5, 5, 5));
    expect(res.ok).toBe(true);
    expect(openingPending(res.encounter)).toBe(false);
    expect(res.encounter.opening.result.target).toBe(enc.enemies[1].name);
    // Giving it up is a combat intent too
    expect(sanitizeIntent({ type: 'combat', characterId: 'tobias', action: { type: 'endTurn' } }).ok).toBe(true);
  });
});

describe('the simulator', () => {
  const hero = () => quickHero({ classId: 'fighter', level: 3, rng: seeded(7) });
  const bandits = n => [{ monster: getMonster('bandit'), count: n }];

  it('offers surprise in favour or against', () => {
    expect(SIM_SURPRISE.map(o => o.id)).toEqual(['none', 'enemies', 'heroes']);
  });

  it('in favour: the enemies are surprised and the first hero strikes first', () => {
    const { encounter } = startSimulation([hero()], bandits(2), dieFrom(seeded(3)), { surprise: 'enemies' });
    expect(encounter.enemies.every(e => e.surprised)).toBe(true);
    expect(openingPending(encounter)).toBe(true);
    expect(currentHeroUid(encounter)).toBe(encounter.heroIds[0]);
    // The simple AI opens against a surprised enemy
    const action = autoAction(encounter, encounter && hero(), {});
    expect(['attack', 'spell']).toContain(action.type);
  });

  it('against: the party is ambushed', () => {
    const { encounter } = startSimulation([hero(), hero()], bandits(2), dieFrom(seeded(3)), { surprise: 'heroes' });
    expect(encounter.surprise.side).toBe('heroes');
    expect(encounter.surprise.uids).toHaveLength(2);
    expect(openingPending(encounter)).toBe(false);
  });

  it('the simple AI plays whole fights with surprise, and surprise helps', () => {
    const fight = autoFight([hero()], bandits(2), dieFrom(seeded(9)), { surprise: 'enemies' });
    expect(fight.encounter.opening.done).toBe(true);
    expect(['victory', 'defeat', 'fled', 'timeout']).toContain(fight.encounter.status);
    const favour = simulateMany([hero()], bandits(4), 150, { rng: seeded(11), surprise: 'enemies' });
    const against = simulateMany([hero()], bandits(4), 150, { rng: seeded(11), surprise: 'heroes' });
    expect(favour.winRate).toBeGreaterThan(against.winRate);
  });

  it('a campaign fight keeps who was surprised, to replay it', () => {
    const snap = makeSnapshot({ party: [hero()], groups: bandits(1), surprise: 'heroes' });
    expect(snap.surprise).toBe('heroes');
    expect(normalizeSnapshots([snap])[0].surprise).toBe('heroes');
    expect(normalizeSnapshots([{ ...snap, surprise: 'raro' }])[0].surprise).toBeNull();
    expect(makeSnapshot({ party: [hero()], groups: bandits(1) }).surprise).toBeNull();
  });
});

describe("Duncan's line about the opening strike (local engine)", () => {
  const hero = { name: 'Kaelen' };
  it('tells what the game computed, without numbers of its own', () => {
    expect(openingLine({ target: 'Bandido', status: 'dead', damage: 9, surprised: true }, hero)).toContain('Bandido se desploma');
    expect(openingLine({ target: 'Bandido', status: 'active', damage: 3, hp: 8, maxHp: 11, surprised: false }, hero)).toContain('retrocede con un gruñido');
    expect(openingLine({ target: 'Bandido', status: 'active', damage: 8, hp: 3, maxHp: 11, surprised: true }, hero)).toContain('malherido');
    expect(openingLine({ target: 'Bandido', status: 'active', damage: 0, hp: 11, maxHp: 11 }, hero)).toContain('se pierde en el aire');
    expect(openingLine({ target: 'Bandido', status: 'active', damage: 3, hp: 8, maxHp: 11 }, hero)).not.toMatch(/\d/);
  });
});
