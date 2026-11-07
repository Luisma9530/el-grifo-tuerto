// Helpers to describe a saved campaign in the save-slot picker

/**
 * Splits "Pícaro (Nivel 3)" into { className: 'Pícaro', level: 3 }.
 * Falls back to an explicit character.level if present.
 */
export function parseClassAndLevel(character) {
  const raw = character?.class || '';
  const match = raw.match(/^(.*?)\s*\(\s*Nivel\s*(\d+)\s*\)\s*$/i);
  const className = (match ? match[1] : raw).trim() || 'Aventurero';
  const level = character?.level ?? (match ? Number(match[2]) : null);
  return { className, level };
}

export function getCurrentLocation(world) {
  const node = world?.mapNodes?.find(n => n.status === 'current');
  return node?.name || world?.initialLocation || 'Desconocida';
}

export function formatLastPlayed(iso, now = Date.now()) {
  if (!iso) return 'Fecha desconocida';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha desconocida';
  const diffMin = Math.round((now - date.getTime()) / 60000);
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `Hace ${diffD} día${diffD === 1 ? '' : 's'}`;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function stripMarkdown(text = '') {
  return text.replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();
}
