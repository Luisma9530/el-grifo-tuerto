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

describe('generateDMResponse (Gemini)', () => {
  const geminiReply = payload => ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
  });
  const payload = { narracion: 'Duncan ríe.', usaTirada: true, danio: 2, curacion: 0, oro: 5, opciones: ['Seguir'] };

  it('rolls the d20 itself, sends it to the model and reports it when used', async () => {
    forceD20(17);
    const fetchMock = vi.fn().mockResolvedValue(geminiReply(payload));
    vi.stubGlobal('fetch', fetchMock);

    const res = await generateDMResponse({ playerAction: 'Ataco', character, world, apiKeys: ['clave-de-prueba-123'] });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('gemini-flash-latest');
    expect(url).not.toContain('clave-de-prueba-123'); // key goes in a header, not the URL
    expect(options.headers['x-goog-api-key']).toBe('clave-de-prueba-123');
    const body = JSON.parse(options.body);
    expect(body.contents[0].parts[0].text).toContain('ha salido: 17');
    expect(body.generationConfig.responseMimeType).toBe('application/json');

    expect(res).toMatchObject({
      text: 'Duncan ríe.', source: 'gemini', damageTaken: 2, healing: 0, goldEarned: 5,
      roll: { sides: 20, value: 17 }, suggestedActions: ['Seguir']
    });
    vi.unstubAllGlobals();
  });

  it('does not show a die when the model ignored the roll or the player rolled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply({ ...payload, usaTirada: false })));
    const ignored = await generateDMResponse({ playerAction: 'Saludo', character, world, apiKeys: ['clave-de-prueba-123'] });
    expect(ignored.roll).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply(payload)));
    const playerRoll = { rawRoll: 9, modifier: 3, total: 12, dc: 12, success: true, statName: 'Destreza' };
    const checked = await generateDMResponse({ playerAction: 'x', character, world, apiKeys: ['clave-de-prueba-123'], playerRoll });
    expect(checked.roll).toBeNull();
    vi.unstubAllGlobals();
  });

  it('retries in plain-text mode if the structured request is rejected', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'Duncan gruñe.\nOPCIONES: Beber | Salir' }] } }] })
      });
    vi.stubGlobal('fetch', fetchMock);

    const res = await generateDMResponse({ playerAction: 'x', character, world, apiKeys: ['clave-de-prueba-123'] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).generationConfig).toBeUndefined();
    expect(res).toMatchObject({ text: 'Duncan gruñe.', source: 'gemini', suggestedActions: ['Beber', 'Salir'] });
    vi.unstubAllGlobals();
  });

  it('falls back to the procedural engine when every key fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));
    const res = await generateDMResponse({ playerAction: 'Saludo al tabernero', character, world, apiKeys: ['clave-de-prueba-123'] });
    expect(res.source).toBeUndefined();
    expect(res.text.length).toBeGreaterThan(20);
    vi.unstubAllGlobals();
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

describe('shops with the local engine', () => {
  it('opens the shop the action asks for, without moving gold', async () => {
    forceD20(10);
    const smith = await generateDMResponse({ playerAction: 'Quiero comprar una armadura en la herrería', character, world, allowShop: true, shopTypesHere: ['smith', 'general'] });
    expect(smith.shop).toBe('smith');
    expect(smith.goldEarned).toBe(0);
    const potion = await generateDMResponse({ playerAction: 'Voy al boticario a por pociones', character, world, allowShop: true });
    expect(potion.shop).toBe('alchemist');
    const plain = await generateDMResponse({ playerAction: 'Quiero comprar cosas', character, world, allowShop: true, shopTypesHere: ['general'] });
    expect(plain.shop).toBe('general');
  });

  it('does not open shops when they are not allowed or the hero is not trading', async () => {
    forceD20(10);
    expect((await generateDMResponse({ playerAction: 'Comprar una espada', character, world })).shop).toBeNull();
    expect((await generateDMResponse({ playerAction: 'Miro la armadura del guardia', character, world, allowShop: true })).shop).toBeNull();
  });

  it('after a fight the local engine tells the loot and adds no gold', async () => {
    forceD20(10);
    const reply = await generateDMResponse({
      playerAction: 'Narra el final del combate', character, world,
      combatResult: '⚔️ Kaelen gana el combate en 2 rondas.', loot: { coins: 7, items: [{ name: 'Daga' }] }
    });
    expect(reply.goldEarned).toBe(0);
    expect(reply.text).toContain('7 po y Daga');
  });
});

describe('shops with Gemini', () => {
  const reply = payload => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) });
  const base = { narracion: 'Entras en la forja de Brann.', usaTirada: false, danio: 0, curacion: 0, oro: -40, experiencia: 0, opciones: ['Mirar'] };

  it('a shop Duncan opens comes back validated and the narration moves no gold', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ ...base, tienda: { tipo: 'herrero' } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await generateDMResponse({ playerAction: 'Voy a la forja', character, world, apiKeys: ['clave-de-prueba-123'], allowShop: true });
    expect(res.shop).toBe('smith');
    expect(res.goldEarned).toBe(0);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.responseSchema.properties.tienda).toBeDefined();
  });

  it('ignores a shop when it was not allowed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ...base, tienda: { tipo: 'herrero' } })));
    const res = await generateDMResponse({ playerAction: 'Voy a la forja', character, world, apiKeys: ['clave-de-prueba-123'] });
    expect(res.shop).toBeNull();
    expect(res.goldEarned).toBe(-10); // clamped to the gold the hero has
  });
});

describe('generateDMResponse (quests)', () => {
  const questWorld = { ...world, mapNodes: [{ id: 'a', name: 'Taberna', status: 'current' }] };

  it('the local engine opens a quest when the scene asks for work', async () => {
    const res = await generateDMResponse({ playerAction: 'Miro el tablón de anuncios', character: { ...character, level: 1 }, world: questWorld, here: questWorld.mapNodes[0] });
    expect(res.questChanges).toHaveLength(1);
    expect(res.questChanges[0]).toMatchObject({ action: 'open', goal: { kind: 'hunt' } });
    expect(res.xpEarned).toBe(0);
  });

  it('passes the active quests to Gemini and returns its quest changes', async () => {
    const quests = [{ id: 'm1', title: 'Lobos', objective: 'Ahuyentarlos', status: 'active', notes: [], reward: { gold: 10, xp: 0 } }];
    const payload = {
      narracion: 'Los lobos huyen.', usaTirada: false, danio: 0, curacion: 0, oro: 0, experiencia: 0, opciones: ['Volver'],
      misiones: [{ accion: 'cumplir', id: 'm1', nota: 'Huyeron' }]
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const res = await generateDMResponse({ playerAction: 'Espanto a los lobos', character, world: questWorld, apiKeys: ['clave-de-prueba-123'], quests });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toContain('m1 = «Lobos»');
    expect(res.questChanges).toEqual([{ action: 'complete', id: 'm1', title: '', note: 'Huyeron', objective: '' }]);
    vi.unstubAllGlobals();
  });
});
