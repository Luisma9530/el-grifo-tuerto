import React, { useMemo, useState } from 'react';
import { Minus, Plus, Shuffle, Skull, Swords, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  DIFFICULTIES, WORLD_TAGS, encounterXp, difficultyOf, searchMonsters, suggestEncounter, formatCr
} from '../../utils/bestiary';

const DIFFICULTY_COLORS = {
  trivial: 'text-stone-400', low: 'text-emerald-300', moderate: 'text-amber-300',
  high: 'text-orange-400', deadly: 'text-red-400', suicidal: 'text-red-500', none: 'text-stone-500'
};

/**
 * Prepare a fight: a suggested encounter for the hero's level and world, or
 * creatures picked by hand from the bestiary. Calls onStart([{ monster, count }]).
 */
export default function EncounterBuilder({ character, world, onStart, onClose }) {
  useEscapeKey(true, onClose);
  const level = character.level || 1;
  const tags = WORLD_TAGS[world?.id] || null;
  // Solo play: the budgets are per character of a party, so start with an easy fight
  const [difficulty, setDifficulty] = useState('low');
  const [groups, setGroups] = useState(() => suggestEncounter(level, { difficulty: 'low', tags }));
  const [query, setQuery] = useState('');
  const [onlyWorld, setOnlyWorld] = useState(Boolean(tags));

  const xp = encounterXp(groups);
  const rating = difficultyOf(level, xp);
  const results = useMemo(
    () => searchMonsters({ text: query, maxCr: Math.max(1, level + 4), tags: onlyWorld ? tags : null }).slice(0, 60),
    [query, level, onlyWorld, tags]
  );

  const suggest = id => {
    setDifficulty(id);
    setGroups(suggestEncounter(level, { difficulty: id, tags }));
  };

  const changeCount = (monster, delta) => {
    setGroups(current => {
      const existing = current.find(g => g.monster.id === monster.id);
      if (!existing) return delta > 0 ? [...current, { monster, count: 1 }] : current;
      const count = Math.min(10, existing.count + delta);
      return count <= 0 ? current.filter(g => g.monster.id !== monster.id) : current.map(g => (g.monster.id === monster.id ? { ...g, count } : g));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#131018] border-2 border-red-900/60 shadow-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="encounter-title"
      >
        <header className="p-5 border-b border-red-950/60 flex items-start justify-between gap-3 bg-gradient-to-r from-red-950/40 to-transparent">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-red-300/80">Preparar combate · nivel {level}</p>
            <h2 id="encounter-title" className="font-cinzel text-xl font-bold text-stone-100">¿A quién te enfrentas?</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Suggested encounter */}
          <section className="rounded-xl bg-[#16121d] border border-red-900/30 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mr-1">Encuentro sugerido:</span>
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  onClick={() => suggest(d.id)}
                  aria-pressed={difficulty === d.id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    difficulty === d.id ? 'bg-red-500/20 border-red-400 text-red-100' : 'bg-[#1b1624] border-stone-700 text-stone-300 hover:border-red-600/60'
                  }`}
                >
                  {d.name}
                </button>
              ))}
              <button onClick={() => suggest(difficulty)} className="px-3 py-1.5 rounded-lg text-xs border bg-[#1b1624] border-stone-700 text-stone-300 hover:border-red-600/60 flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5" /> Otro
              </button>
            </div>

            {groups.length === 0 ? (
              <p className="text-xs text-stone-500">Ningún enemigo todavía. Pide una sugerencia o añade criaturas abajo.</p>
            ) : (
              <ul className="space-y-1.5">
                {groups.map(({ monster, count }) => (
                  <li key={monster.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[#1b1624] border border-stone-800">
                    <div className="min-w-0">
                      <p className="text-sm text-stone-100 truncate">{monster.name}</p>
                      <p className="text-[10px] font-mono text-stone-500">
                        VD {formatCr(monster.cr)} · CA {monster.ac} · {monster.hp} PG · {monster.type} · {monster.xp} PX
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => changeCount(monster, -1)} className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 flex items-center justify-center" aria-label={`Quitar ${monster.name}`}>
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono text-stone-100">{count}</span>
                      <button onClick={() => changeCount(monster, 1)} className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 flex items-center justify-center" aria-label={`Añadir ${monster.name}`}>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-stone-400">
              Dificultad: <span className={`font-bold ${DIFFICULTY_COLORS[rating.id]}`}>{rating.name}</span> · {xp} PX en juego
            </p>
          </section>

          {/* Bestiary */}
          <section>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar en el bestiario (goblin, no muerto…)"
                aria-label="Buscar criaturas"
                className="flex-1 min-w-[200px] bg-[#1a1523] border border-stone-700 focus:border-red-500/60 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none"
              />
              {tags && (
                <label className="flex items-center gap-1.5 text-xs text-stone-400 cursor-pointer">
                  <input type="checkbox" checked={onlyWorld} onChange={e => setOnlyWorld(e.target.checked)} className="accent-red-500" />
                  Solo criaturas de este mundo
                </label>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {results.map(monster => (
                <button
                  key={monster.id}
                  onClick={() => changeCount(monster, 1)}
                  className="text-left p-2 rounded-lg bg-[#16121d] border border-stone-800 hover:border-red-700/60 flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-stone-200 truncate">{monster.name}</span>
                    <span className="block text-[10px] font-mono text-stone-500">VD {formatCr(monster.cr)} · {monster.type}</span>
                  </span>
                  <Plus className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                </button>
              ))}
            </div>
            {results.length === 0 && <p className="text-xs text-stone-500">No hay criaturas con ese nombre.</p>}
          </section>
        </div>

        <footer className="p-4 border-t border-red-950/60 flex items-center justify-between gap-3">
          <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
            <Skull className="w-3.5 h-3.5" /> Juegas solo: «Fácil» ya es un reto. Las criaturas pueden huir o rendirse.
          </p>
          <button
            onClick={() => onStart(groups)}
            disabled={groups.length === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-cinzel font-bold flex items-center gap-2 bg-gradient-to-r from-red-700 to-red-600 hover:brightness-110 text-white disabled:opacity-40 shrink-0"
          >
            <Swords className="w-4 h-4" /> ¡A luchar!
          </button>
        </footer>
      </div>
    </div>
  );
}
