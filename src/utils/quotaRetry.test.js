import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateDMResponse } from './gameEngine';
import { resetGeminiClient } from './geminiClient';
import { sceneApiKeys } from './sceneKeys';
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
