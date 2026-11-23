// The player's Gemini keys stored in this browser (no other dependencies, so
// the landing page and the online layer can read them cheaply).
import { requestGemini } from './geminiClient';

// Storage and Key Pooling helpers for BYOK (Bring Your Own Key) Multi-Player setup
export function getStoredGeminiKeys() {
  try {
    const raw = localStorage.getItem('tavern_gemini_keys');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map(item => (typeof item === 'string' ? { id: item, label: 'Clave', key: item } : item))
          .filter(item => item && item.key && item.key.trim().length > 10);
      }
    }
    const single = localStorage.getItem('tavern_gemini_key');
    if (single && single.trim().length > 10) {
      return [{ id: 'default', label: 'Mi Clave Principal', key: single.trim() }];
    }
  } catch (e) {
    console.error('Error al recuperar claves de Gemini:', e);
  }
  return [];
}

export function saveStoredGeminiKeys(keyList) {
  try {
    localStorage.setItem('tavern_gemini_keys', JSON.stringify(keyList));
    if (keyList.length > 0) {
      localStorage.setItem('tavern_gemini_key', keyList[0].key);
    } else {
      localStorage.removeItem('tavern_gemini_key');
    }
  } catch (e) {
    console.error('Error al guardar claves de Gemini:', e);
  }
}

// Live connection test against Google Gemini API
export async function testGeminiKey(key) {
  const result = await requestGemini(key.trim(), {
    prompt: 'Di en una sola frase breve y con acento de tabernero: "¡Por las barbas de mi abuelo, conexión verificada en la taberna!"'
  });
  if (result.ok) return { success: true, reply: result.text.trim() || '¡Conexión verificada con éxito!' };

  // An overloaded service says nothing about the key: don't reject a good key for that
  if (result.reason === 'overloaded' || result.reason === 'network') {
    return {
      success: false,
      error: 'Google Gemini está saturado o no responde en este momento. La clave puede ser correcta: espera un minuto y vuelve a intentarlo.'
    };
  }
  return { success: false, error: result.error };
}
