// Thin, resilient client for the Gemini API.
//
// Google retires Gemini models regularly (gemini-1.5-flash was shut down in
// September 2025), so we use the "-latest" aliases, which always point to the
// current models. The main Flash model is often overloaded on the free tier
// (HTTP 503), so requests fall back to Flash-Lite, which is faster and has its
// own quota.

export const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

const REQUEST_TIMEOUT_MS = 20000; // a single overloaded request can otherwise hang for minutes
const TOTAL_BUDGET_MS = 40000; // never keep the player waiting longer than this
const RETRY_DELAY_MS = 1200;
const TIMEOUT_MESSAGE = 'Tiempo de espera agotado';
const PREFER_FALLBACK_MS = 5 * 60 * 1000;

// When the main model is overloaded, start with the model that last worked for a while
let preferred = { model: null, until: 0 };

const endpoint = model => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

async function postOnce(model, key, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (error) {
    // Network failure or timeout
    return { status: 0, data: { error: { message: error?.name === 'AbortError' ? TIMEOUT_MESSAGE : error?.message } } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Why a request failed, so callers can decide what to do next:
 * - 'key': the API key is invalid or not allowed (try another key)
 * - 'quota': rate limit / daily quota reached for this key (try another key)
 * - 'bad-request': the request format was rejected (retry with a simpler format)
 * - 'overloaded': Google's side is saturated or down (other keys won't help)
 * - 'timeout': Gemini took too long to answer (it is up, but slow)
 * - 'network': no connection
 */
export function classifyGeminiError(status, message = '') {
  const text = String(message).toLowerCase();
  if (status === 401 || status === 403 || text.includes('api key')) return 'key';
  if (status === 429) return 'quota';
  if (status === 400) return 'bad-request';
  if (status === 0) return message === TIMEOUT_MESSAGE ? 'timeout' : 'network';
  return 'overloaded'; // 404 (model retired), 500, 503...
}

function modelOrder() {
  if (preferred.model && Date.now() < preferred.until && GEMINI_MODELS.includes(preferred.model)) {
    return [preferred.model, ...GEMINI_MODELS.filter(m => m !== preferred.model)];
  }
  return GEMINI_MODELS;
}

/**
 * Send a prompt to Gemini, trying the fallback model (and one retry) when a
 * model is overloaded, rate-limited or retired.
 *
 * @param {string} key  API key
 * @param {{prompt: string, generationConfig?: object}} request
 * @returns {Promise<{ok: true, text: string, model: string} | {ok: false, status: number, reason: string, error: string}>}
 */
export async function requestGemini(key, { prompt, generationConfig }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(generationConfig ? { generationConfig } : {})
  };
  const startedAt = Date.now();
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);
  let failure = { status: 0, reason: 'network', error: 'Sin respuesta' };

  for (let round = 0; round < 2; round++) {
    let sawTransient = false;

    for (const model of modelOrder()) {
      if (remaining() <= 1000) return { ok: false, ...failure };
      const { status, data } = await postOnce(model, key, body, Math.min(REQUEST_TIMEOUT_MS, remaining()));

      if (status === 200) {
        const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
        if (text.trim()) {
          preferred = model === GEMINI_MODELS[0]
            ? { model: null, until: 0 }
            : { model, until: Date.now() + PREFER_FALLBACK_MS };
          return { ok: true, text, model };
        }
        failure = { status, reason: 'overloaded', error: 'Respuesta vacía' };
        sawTransient = true;
        continue;
      }

      const error = data.error?.message || `Código HTTP ${status}`;
      const reason = classifyGeminiError(status, error);
      // How long Google asks to wait (RetryInfo, "21s"), for the per-minute limit
      const delay = (data.error?.details || []).find(d => typeof d?.retryDelay === 'string')?.retryDelay;
      const retryAfterMs = delay && /^\d+(\.\d+)?s$/.test(delay) ? Math.round(parseFloat(delay) * 1000) : 0;
      failure = { status, reason, error, ...(retryAfterMs ? { retryAfterMs } : {}) };
      // The key or the request itself is the problem: another model won't fix it
      if (reason === 'key' || reason === 'bad-request') return { ok: false, ...failure };
      if (reason === 'overloaded' || reason === 'network' || reason === 'timeout') sawTransient = true;
      // 'quota', 'overloaded', 'timeout' and 'network' fall through to the next model
    }

    // Every model failed. Retry once only if something looked temporary.
    if (!sawTransient || remaining() <= RETRY_DELAY_MS + 1000) break;
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
  }

  return { ok: false, ...failure };
}

/** For tests: forget which model worked last. */
export function resetGeminiClient() {
  preferred = { model: null, until: 0 };
}
