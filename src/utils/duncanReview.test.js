// Fixes found playing with Gemini for real (see the review pull request).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanCheck, DM_RESPONSE_SCHEMA } from './dmPrompt';
import { generateDMResponse, outcomeChanges } from './gameEngine';

const hero = {
  name: 'Brunhilda', race: 'Enano', class: 'Clérigo', hp: 10, maxHp: 10, gold: 10, proficiencyBonus: 2,
  stats: { fue: 14, des: 8, con: 13, int: 11, sab: 16, car: 13 }
};
const world = { name: 'Oakhaven', genre: 'Fantasía', factions: [] };
const forceD20 = value => vi.spyOn(Math, 'random').mockReturnValue((value - 1) / 20 + 0.001);
const geminiReply = payload => vi.fn().mockResolvedValue({
  ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('conditions and limbs of a scene with a check', () => {
  const poison = { condicion: 'envenenado', accion: 'aplicar', duracion: 'descansoCorto' };
  // Seen with Gemini: the poison of a drink went to the top of the reply and was applied although the save succeeded
  const drink = {
    narracion: 'Te bebes el licor verde de un trago.', usaTirada: true, danio: 0, curacion: 0, oro: 0, experiencia: 0, opciones: ['x'],
    condiciones: [poison],
    prueba: { habilidad: 'Constitución', cd: 12, exito: { narracion: 'Aguantas el mareo.' }, fallo: { narracion: 'Caes redonda.', danio: 2 } }
  };

  it('each outcome of a check can carry its own conditions and limbs (schema)', () => {
    const outcome = DM_RESPONSE_SCHEMA.properties.prueba.properties.fallo.properties;
    expect(outcome.condiciones.items.properties.condicion.enum).toContain('envenenado');
    expect(outcome.extremidades.items.properties.extremidad.enum).toContain('brazoDerecho');
  });

  it('cleans the conditions and limbs of each outcome', () => {
    const check = cleanCheck({ habilidad: 'Constitución', cd: 12, exito: { narracion: 'a' }, fallo: { narracion: 'b', condiciones: [poison], extremidades: [{ extremidad: 'brazoDerecho', estado: 'inutilizada' }] } }, hero);
    expect(check.success.conditionChanges).toEqual([]);
    expect(check.failure.conditionChanges).toEqual([expect.objectContaining({ id: 'envenenado', action: 'add' })]);
    expect(check.failure.limbChanges).toEqual([{ limb: 'rightArm', status: 'disabled' }]);
  });

  it('a harm at the top of the reply is only the price of failing; a cure only the prize of succeeding', () => {
    const request = { success: { conditionChanges: [], limbChanges: [] }, failure: { conditionChanges: [], limbChanges: [] } };
    const top = {
      conditionChanges: [{ id: 'envenenado', action: 'add' }, { id: 'cegado', action: 'remove' }],
      limbChanges: [{ limb: 'leftLeg', status: 'disabled' }]
    };
    expect(outcomeChanges(request, true, top)).toEqual({ conditionChanges: [{ id: 'cegado', action: 'remove' }], limbChanges: [] });
    expect(outcomeChanges(request, false, top)).toEqual({ conditionChanges: [{ id: 'envenenado', action: 'add' }], limbChanges: [{ limb: 'leftLeg', status: 'disabled' }] });
  });

  it('when the outcomes name their own changes, those of the top are ignored', () => {
    const request = { success: { conditionChanges: [] }, failure: { conditionChanges: [{ id: 'asustado', action: 'add' }] } };
    expect(outcomeChanges(request, true, { conditionChanges: [{ id: 'envenenado', action: 'add' }] }).conditionChanges).toEqual([]);
    expect(outcomeChanges(request, false, { conditionChanges: [{ id: 'envenenado', action: 'add' }] }).conditionChanges).toEqual([{ id: 'asustado', action: 'add' }]);
  });

  it('Gemini: a poison she resists leaves no condition', async () => {
    forceD20(18);
    vi.stubGlobal('fetch', geminiReply(drink));
    const res = await generateDMResponse({ playerAction: 'Me bebo el licor', character: hero, world, apiKeys: ['clave-de-prueba-123'] });
    expect(res.check.success).toBe(true);
    expect(res.conditionChanges).toEqual([]);
  });

  it('Gemini: a poison she fails to resist is applied', async () => {
    forceD20(2);
    vi.stubGlobal('fetch', geminiReply(drink));
    const res = await generateDMResponse({ playerAction: 'Me bebo el licor', character: hero, world, apiKeys: ['clave-de-prueba-123'] });
    expect(res.check.success).toBe(false);
    expect(res.damageTaken).toBe(2);
    expect(res.conditionChanges).toEqual([expect.objectContaining({ id: 'envenenado', action: 'add' })]);
  });
});

describe('a lost fight, narrated by Duncan', () => {
  it('tells Duncan about the rescue the game applied and forbids inventing losses', async () => {
    const { buildDMPrompt } = await import('./dmPrompt');
    const prompt = buildDMPrompt({
      playerAction: 'Narra el final del combate', character: hero, world, history: [], d20: 5,
      combatResult: '💀 El grupo cae derrotado en combate. Abatidos: Guerrero Goblin 1. Rescate (ya aplicado): 💀 Cae todo el grupo. Maese Duncan los arrastra junto a la chimenea y los remienda: despiertan con la mitad de sus PG y 15 monedas de oro menos en la bolsa por los cuidados.'
    });
    expect(prompt).toContain('junto a la chimenea');
    expect(prompt).toContain('No digas que les roban equipo o dinero');
    expect(prompt).toContain('No hay botín');
    expect(prompt).not.toContain('descríbelo cuando registre a los caídos');
  });

  it('a won fight still describes the loot', async () => {
    const { buildDMPrompt } = await import('./dmPrompt');
    const prompt = buildDMPrompt({ playerAction: 'x', character: hero, world, history: [], d20: 5, combatResult: '⚔️ El grupo gana el combate en 4 rondas. Botín: 2 po 5 pp y Daga.' });
    expect(prompt).toContain('descríbelo cuando registre a los caídos');
    expect(prompt).not.toContain('Rescate');
  });
});

describe('a slow Gemini is not "no connection"', () => {
  it('classifies a timeout apart from a network failure', async () => {
    const { classifyGeminiError } = await import('./geminiClient');
    expect(classifyGeminiError(0, 'Tiempo de espera agotado')).toBe('timeout');
    expect(classifyGeminiError(0, 'Failed to fetch')).toBe('network');
  });

  it('tells the player that Gemini is slow, not that there is no connection', async () => {
    const { resetGeminiClient } = await import('./geminiClient');
    resetGeminiClient();
    vi.useFakeTimers();
    // Every request hangs until it is aborted
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })));
    const pending = generateDMResponse({ playerAction: 'Miro alrededor', character: hero, world, apiKeys: ['clave-de-prueba-123'] });
    await vi.runAllTimersAsync();
    const res = await pending;
    vi.useRealTimers();
    expect(res.source).not.toBe('gemini');
    expect(res.notice).toContain('tardando demasiado');
  });
});

describe('quests in the prompt', () => {
  it('asks to open the quest in the same reply when the hero accepts a job, and to close it only when it is done', async () => {
    const { buildDMPrompt } = await import('./dmPrompt');
    const prompt = buildDMPrompt({ playerAction: 'Trato hecho', character: hero, world, history: [], d20: 5 });
    expect(prompt).toContain('acepta un encargo (aunque la paga sea un objeto, un favor o nada), ábrelo en ESTA respuesta');
    expect(prompt).toContain('"cumplir" solo si en tu narración el objetivo de esa misión queda hecho de verdad');
  });
});

describe('the species of a companion', () => {
  it('is one of the species of the game in the schema', async () => {
    const { dmResponseSchema } = await import('./dmPrompt');
    const schema = dmResponseSchema(false, false, false, { allowRecruit: true });
    expect(schema.properties.reclutar.properties.especie.enum).toEqual(expect.arrayContaining(['Elfo', 'Enano', 'Humano']));
  });

  it('a "semielfa" is an elf, not a random species', async () => {
    const { speciesIdFrom } = await import('./recruit');
    expect(speciesIdFrom('Semielfa')).toBe(speciesIdFrom('Elfo'));
    expect(speciesIdFrom('semiorco')).toBe(speciesIdFrom('Orco'));
    expect(speciesIdFrom('Semidiós')).toBeNull();
  });
});

describe('a broken JSON reply', () => {
  it('never shows raw JSON to the player: keeps a whole narration, without effects', async () => {
    const { parseDMReply } = await import('./dmPrompt');
    const res = parseDMReply('{"narracion": "Duncan se ríe \\"a gusto\\".", "usaTirada": false, "danio": 7, "opciones": ["a", "b"', hero);
    expect(res.text).toBe('Duncan se ríe "a gusto".');
    expect(res.damageTaken).toBe(0);
    expect(res.usedRoll).toBe(false);
    expect(res.text).not.toContain('{');
  });

  it('a narration cut short is not usable (the local engine takes the turn)', async () => {
    const { parseDMReply } = await import('./dmPrompt');
    expect(parseDMReply('{"narracion": "Duncan se rí', hero)).toBeNull();
    expect(parseDMReply('```json\n{"danio": 3,', hero)).toBeNull();
  });

  it('Gemini: a broken reply falls back to the local engine with a notice, not raw JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"narracion": "Entr' }] } }] }) }));
    const res = await generateDMResponse({ playerAction: 'Miro alrededor', character: hero, world, apiKeys: ['clave-de-prueba-123'] });
    expect(res.source).not.toBe('gemini');
    expect(res.text).not.toContain('"narracion"');
    expect(res.notice).toContain('respuesta rota');
  });
});

describe('a companion offer that depends on a check', () => {
  const offer = {
    narracion: 'Le invitas a una cerveza y le cuentas tu plan.', usaTirada: true, danio: 0, curacion: 0, oro: 0, experiencia: 0, opciones: ['x'],
    reclutar: { nombre: 'Gareth', clase: 'Guerrero', especie: 'Humano' },
    prueba: { habilidad: 'Persuasión', contra: { perfil: 'soldado' }, exito: { narracion: 'Acepta.' }, fallo: { narracion: 'Se niega y se va.' } }
  };

  it('Gemini: no offer to join when the persuasion fails', async () => {
    forceD20(1);
    vi.stubGlobal('fetch', geminiReply(offer));
    const res = await generateDMResponse({ playerAction: 'Le pido que se una', character: hero, world, apiKeys: ['clave-de-prueba-123'], allowRecruit: true });
    expect(res.check.success).toBe(false);
    expect(res.recruit).toBeNull();
  });

  it('Gemini: the offer stands when the persuasion works', async () => {
    forceD20(20);
    vi.stubGlobal('fetch', geminiReply(offer));
    const res = await generateDMResponse({ playerAction: 'Le pido que se una', character: hero, world, apiKeys: ['clave-de-prueba-123'], allowRecruit: true });
    expect(res.check.success).toBe(true);
    expect(res.recruit).toMatchObject({ name: 'Gareth' });
  });
});

describe('the key moments of a fight', () => {
  it('asks not to repeat numbers the fight log already shows', async () => {
    const { buildMomentPrompt } = await import('./combatNarration');
    const prompt = buildMomentPrompt({ moments: [{ text: 'Brunhilda lanza Llama Sagrada: 7 de daño.' }], encounter: { enemies: [{ name: 'Bandido', status: 'active' }] }, character: hero, world });
    expect(prompt).toContain('sin repetir cifras de daño ni de puntos de golpe');
  });

  it('a broken JSON moment is dropped, never shown raw', async () => {
    const { narrateMoment } = await import('./combatNarration');
    const { resetGeminiClient } = await import('./geminiClient');
    resetGeminiClient();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"narracion": "Convocas la ll' }] } }] }) }));
    const text = await narrateMoment('clave-de-prueba-123', { moments: [{ text: 'x' }], encounter: { enemies: [] }, character: hero, world });
    expect(text).toBeNull();
  });
});

describe('shops in the prompt', () => {
  it('a merchant who offers a job is not a shop', async () => {
    const { buildDMPrompt } = await import('./dmPrompt');
    const prompt = buildDMPrompt({ playerAction: 'Escucho al mercader', character: hero, world, history: [], d20: 5, allowShop: true });
    expect(prompt).toContain('No la abras solo porque salga un mercader o un tendero');
  });
});

describe('lending a key of the newer format', () => {
  it('accepts the newer Google keys ("AQ." and a dot, longer than 39) and still rejects junk', async () => {
    const { isPlausibleGeminiKey } = await import('../online/keyLending');
    // Made up, same shape as the newer keys
    expect(isPlausibleGeminiKey(`AQ.${'Ab3_-x'.repeat(8)}z`)).toBe(true);
    expect(isPlausibleGeminiKey(`AIza${'B'.repeat(35)}`)).toBe(true);
    expect(isPlausibleGeminiKey('hola <script>')).toBe(false);
    expect(isPlausibleGeminiKey('corta')).toBe(false);
  });
});
