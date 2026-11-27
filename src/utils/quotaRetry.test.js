import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateDMResponse } from './gameEngine';
import { resetGeminiClient } from './geminiClient';
import { sceneApiKeys, lentKeysByScene, fallbackKeys, askWithKeyFallback } from './sceneKeys';
import { tavernAudio } from './audio';

// Several scenes call Duncan at once: on Gemini's per-minute limit a scene waits
// and tries again, telling only its players

const character = { name: 'Ana', race: 'Humana', class: 'Guerrera', hp: 10, maxHp: 10, gold: 5, stats: {} };
const world = { name: 'Oakhaven', genre: 'Fantasía', factions: [{ name: 'Guardia' }, { name: 'Círculo' }] };
const ok = () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ narracion: 'Duncan asiente.', usaTirada: false, danio: 0, curacion: 0, oro: 0, opciones: ['Seguir'] }) }] } }] }) });
const quota = (delay = '12s') => ({ ok: false, status: 429, json: async () => ({ error: { message: 'Resource has been exhausted (e.g. check quota).', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: delay }] } }) });

beforeEach(() => {
  localStorage.clear();
  resetGeminiClient();
  vi.spyOn(tavernAudio, 'playDiceRoll').mockImplementation(() => {});
  vi.spyOn(tavernAudio, 'playTankardClink').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('límite por minuto de Gemini', () => {
  it('espera lo que pide Google, avisa a la escena y lo vuelve a intentar', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => (++calls <= 2 ? quota('12s') : ok())));
    const waits = [];
    const slept = [];
    const res = await generateDMResponse({
      playerAction: 'Miro', character, world, apiKeys: ['clave-de-prueba-123'],
      onQuotaWait: seconds => waits.push(seconds), quotaSleep: async ms => { slept.push(ms); }
    });
    expect(res.source).toBe('gemini');
    expect(res.text).toBe('Duncan asiente.');
    expect(waits).toEqual([12]);
    expect(slept).toEqual([12000]);
  });

  it('tras los reintentos, Duncan sigue con el motor local', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => quota('200s')));
    const waits = [];
    const res = await generateDMResponse({
      playerAction: 'Miro', character, world, apiKeys: ['clave-de-prueba-123'],
      onQuotaWait: seconds => waits.push(seconds), quotaSleep: async () => {}
    });
    expect(waits).toEqual([40, 40]); // como mucho 40 s cada vez, dos veces
    expect(res.source).not.toBe('gemini');
    expect(res.notice).toMatch(/límite/);
  });

  it('sin quien espere (la party junta), no se reintenta', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => quota());
    vi.stubGlobal('fetch', fetchMock);
    const before = fetchMock.mock.calls.length;
    await generateDMResponse({ playerAction: 'Miro', character, world, apiKeys: ['clave-de-prueba-123'] });
    const single = fetchMock.mock.calls.length - before;
    expect(single).toBeGreaterThan(0);
    expect(single).toBeLessThanOrEqual(4);
  });
});

describe('claves por escena (preparado)', () => {
  it('hoy cada escena usa las del anfitrión; con claves propias, las suyas', () => {
    const host = [{ key: 'h' }];
    expect(sceneApiKeys(host, { sceneId: 'g1' })).toBe(host);
    expect(sceneApiKeys(host, { sceneId: 'g1', keysByScene: { g1: [{ key: 'ana' }] } })).toEqual([{ key: 'ana' }]);
    expect(sceneApiKeys(host, { sceneId: null, keysByScene: { g1: [{ key: 'ana' }] } })).toBe(host);
  });
});

describe('reserva: las claves del anfitrión cuando falla la prestada de un grupo separado', () => {
  const ANA = 'AIzaFAKE-ana-0000000000000000000000';
  const HOST = 'AIzaFAKE-host-222222222222222222222';
  const host = [{ key: HOST }];
  const groups = [{ id: 'g1', memberIds: ['tobias'] }, { id: 'g2', memberIds: ['brena', 'ilsa'] }];
  const playerOf = cid => ({ brena: 'h', tobias: 'p_ana', ilsa: 'p_bea' }[cid]);
  const keyOf = call => call[1].headers['x-goog-api-key'];

  it('solo hay reserva si el anfitrión tiene claves que la escena no usa ya', () => {
    const byScene = lentKeysByScene({ groups, playerOf, lent: { p_ana: ANA, p_bea: 'AIzaFAKE-bea-1111111111111111111111' }, hostId: 'h', hostKeys: host });
    expect(fallbackKeys(byScene.g1, host)).toEqual(host);
    // El anfitrión juega en g2: sus claves ya están en el pool
    expect(fallbackKeys(byScene.g2, host)).toEqual([]);
    expect(fallbackKeys(byScene.g1, [])).toEqual([]);
  });

  it('la clave prestada agota su cuota: tras el reintento corto, Duncan sigue con la del anfitrión y avisa', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url, init) => (init.headers['x-goog-api-key'] === ANA ? quota('5s') : ok()));
    vi.stubGlobal('fetch', fetchMock);
    const waits = [];
    const told = [];
    const own = [{ key: ANA, playerId: 'p_ana' }];
    const res = await askWithKeyFallback(apiKeys => generateDMResponse({
      playerAction: 'Miro', character, world, apiKeys, onQuotaWait: s => waits.push(s), quotaSleep: async () => {}
    }), { keys: own, reserve: fallbackKeys(own, host), onFallback: () => told.push('reserva') });
    expect(res.source).toBe('gemini');
    expect(res.text).toBe('Duncan asiente.');
    expect(waits.length).toBeGreaterThan(0); // primero el reintento corto con la suya
    expect(told).toEqual(['reserva']);
    const used = fetchMock.mock.calls.map(keyOf);
    expect(used.indexOf(HOST)).toBeGreaterThan(used.lastIndexOf(ANA));
  });

  it('una clave prestada inválida también pasa a la reserva', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url, init) => (init.headers['x-goog-api-key'] === ANA
      ? { ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid.' } }) }
      : ok())));
    const told = [];
    const own = [{ key: ANA, playerId: 'p_ana' }];
    const res = await askWithKeyFallback(apiKeys => generateDMResponse({ playerAction: 'Miro', character, world, apiKeys }),
      { keys: own, reserve: host, onFallback: () => told.push(1) });
    expect(res.source).toBe('gemini');
    expect(told).toEqual([1]);
  });

  it('si la prestada funciona, ni reserva ni aviso; sin reserva, el motor local como hoy', async () => {
    const ask = vi.fn(async keys => (keys[0].key === ANA ? { source: 'gemini', text: 'ok' } : { source: 'local', notice: 'x' }));
    const told = [];
    expect((await askWithKeyFallback(ask, { keys: [{ key: ANA }], reserve: host, onFallback: () => told.push(1) })).text).toBe('ok');
    expect(ask).toHaveBeenCalledTimes(1);
    const failing = vi.fn(async () => ({ source: 'local', notice: 'sin cuota' }));
    expect((await askWithKeyFallback(failing, { keys: [{ key: ANA }], reserve: [], onFallback: () => told.push(1) })).notice).toBe('sin cuota');
    expect(failing).toHaveBeenCalledTimes(1);
    expect(told).toEqual([]);
    // La reserva también falla: se queda la primera respuesta (motor local con su aviso)
    const both = vi.fn(async keys => ({ source: 'local', notice: keys[0].key }));
    expect((await askWithKeyFallback(both, { keys: [{ key: ANA }], reserve: host })).notice).toBe(ANA);
    expect(both).toHaveBeenCalledTimes(2);
  });
});
