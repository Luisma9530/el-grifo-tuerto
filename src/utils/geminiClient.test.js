import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestGemini, classifyGeminiError, resetGeminiClient, GEMINI_MODELS } from './geminiClient';

const ok = text => ({ status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const fail = (status, message = 'boom') => ({ status, json: async () => ({ error: { message } }) });
const modelOf = call => call[0].match(/models\/([^:]+):/)[1];

let fetchMock;
beforeEach(() => {
  resetGeminiClient();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('classifyGeminiError', () => {
  it('tells apart key, quota, format, overload and network problems', () => {
    expect(classifyGeminiError(400, 'API key not valid. Please pass a valid API key.')).toBe('key');
    expect(classifyGeminiError(403, 'forbidden')).toBe('key');
    expect(classifyGeminiError(429, 'quota')).toBe('quota');
    expect(classifyGeminiError(400, 'Invalid JSON payload')).toBe('bad-request');
    expect(classifyGeminiError(503, 'high demand')).toBe('overloaded');
    expect(classifyGeminiError(404, 'model not found')).toBe('overloaded');
    expect(classifyGeminiError(0, 'Failed to fetch')).toBe('network');
  });
});

describe('requestGemini', () => {
  it('uses the main model and sends the key in a header', async () => {
    fetchMock.mockResolvedValueOnce(ok('hola'));
    const res = await requestGemini('mi-clave', { prompt: 'p', generationConfig: { responseMimeType: 'application/json' } });
    expect(res).toEqual({ ok: true, text: 'hola', model: GEMINI_MODELS[0] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).not.toContain('mi-clave');
    expect(options.headers['x-goog-api-key']).toBe('mi-clave');
    expect(JSON.parse(options.body).generationConfig.responseMimeType).toBe('application/json');
  });

  it('falls back to the lite model when the main one is overloaded, and remembers it', async () => {
    fetchMock.mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok('desde lite')).mockResolvedValueOnce(ok('otra'));
    const res = await requestGemini('k', { prompt: 'p' });
    expect(res).toMatchObject({ ok: true, text: 'desde lite', model: GEMINI_MODELS[1] });
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([GEMINI_MODELS[0], GEMINI_MODELS[1]]);

    // Next request goes straight to the model that worked
    await requestGemini('k', { prompt: 'p' });
    expect(modelOf(fetchMock.mock.calls[2])).toBe(GEMINI_MODELS[1]);
  });

  it('also falls back when the main model hits its quota or was retired', async () => {
    fetchMock.mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(ok('a'));
    expect((await requestGemini('k', { prompt: 'p' })).ok).toBe(true);
    resetGeminiClient();
    fetchMock.mockResolvedValueOnce(fail(404)).mockResolvedValueOnce(ok('b'));
    expect((await requestGemini('k', { prompt: 'p' })).ok).toBe(true);
  });

  it('does not try other models for an invalid key or a rejected request', async () => {
    fetchMock.mockResolvedValueOnce(fail(400, 'API key not valid'));
    expect(await requestGemini('k', { prompt: 'p' })).toMatchObject({ ok: false, reason: 'key' });
    fetchMock.mockResolvedValueOnce(fail(400, 'Unknown field'));
    expect(await requestGemini('k', { prompt: 'p' })).toMatchObject({ ok: false, reason: 'bad-request' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once when every model is overloaded, then gives up', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(fail(503, 'high demand'));
    const pending = requestGemini('k', { prompt: 'p' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toMatchObject({ ok: false, reason: 'overloaded', status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(GEMINI_MODELS.length * 2);
  });

  it('does not retry when every model is out of quota', async () => {
    fetchMock.mockResolvedValue(fail(429));
    expect(await requestGemini('k', { prompt: 'p' })).toMatchObject({ ok: false, reason: 'quota' });
    expect(fetchMock).toHaveBeenCalledTimes(GEMINI_MODELS.length);
  });

  it('gives up on a request that never answers', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const pending = requestGemini('k', { prompt: 'p' });
    await vi.advanceTimersByTimeAsync(60000);
    const res = await pending;
    expect(res).toMatchObject({ ok: false, reason: 'timeout' });
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(GEMINI_MODELS.length * 2);
  });
});
