import React, { useMemo, useState } from 'react';
import { Crown, Minus, Plus, Shuffle, Skull, Swords, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  DIFFICULTIES, WORLD_TAGS, encounterXp, difficultyOf, searchMonsters, suggestEncounter, formatCr, getMonster, eliteVersion
} from '../../utils/bestiary';

const DIFFICULTY_COLORS = {
  trivial: 'text-stone-400', low: 'text-emerald-300', moderate: 'text-amber-300',
  high: 'text-orange-400', deadly: 'text-red-400', suicidal: 'text-red-500', none: 'text-stone-500'
};

/** Groups as the builder keeps them: the base creature and an elite flag. */
const toBaseGroups = groups => groups.map(g => ({ ...g, monster: getMonster(g.monster.id) || g.monster, elite: Boolean(g.elite) }));
const keyOf = g => `${g.monster.id}${g.elite ? ':elite' : ''}${g.name ? `:${g.name}` : ''}`;

/**
 * Prepare a fight (only in the combat simulator: in a campaign every fight
 * comes from the story, started by Duncan or the local engine): a suggested encounter for the hero's level and world, or
 * creatures picked by hand from the bestiary. With `allowElite` any
 * group can be made elite (more HP, +1 to hit, more XP). Calls onStart([{ monster, count, elite?, name?, trait? }])
 * with the elite stat blocks already applied.
 * `initialGroups`: start from these enemies (the simulator's "Cambiar y repetir").
 */
export default function EncounterBuilder({ character, world, onStart, onClose, initialGroups = null, startLabel = '¡A luchar!', note = null, allowElite = false }) {
  useEscapeKey(true, onClose);
  const level = character.level || 1;
  const tags = WORLD_TAGS[world?.id] || null;
  // Solo play: the budgets are per character of a party, so start with an easy fight
  const [difficulty, setDifficulty] = useState('low');
  const [groups, setGroups] = useState(() => (initialGroups?.length ? toBaseGroups(initialGroups) : suggestEncounter(level, { difficulty: 'low', tags })));
  const [query, setQuery] = useState('');
  const [onlyWorld, setOnlyWorld] = useState(Boolean(tags));

  const finalGroups = groups.map(g => (g.elite ? { ...g, monster: eliteVersion(g.monster) } : g));
  const xp = encounterXp(finalGroups);
  const rating = difficultyOf(level, xp);
  const results = useMemo(
    () => searchMonsters({ text: query, maxCr: Math.max(1, level + 4), tags: onlyWorld ? tags : null }).slice(0, 60),
    [query, level, onlyWorld, tags]
  );

  const suggest = id => {
    setDifficulty(id);
    setGroups(suggestEncounter(level, { difficulty: id, tags }));
  };

  // `key`: the group to change; a creature from the bestiary goes to its plain group
  const changeCount = (monster, delta, key = keyOf({ monster })) => {
    setGroups(current => {
      const existing = current.find(g => keyOf(g) === key);
      if (!existing) return delta > 0 ? [...current, { monster, count: 1 }] : current;
      const count = Math.min(10, existing.count + delta);
      return count <= 0 ? current.filter(g => g !== existing) : current.map(g => (g === existing ? { ...g, count } : g));
    });
  };

  const toggleElite = key => setGroups(current => current.map(g => (keyOf(g) === key ? { ...g, elite: !g.elite } : g)));

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
                {groups.map(group => {
                  const { monster, count, elite, name } = group;
                  const key = keyOf(group);
                  const shown = elite ? eliteVersion(monster) : monster;
                  return (
                  <li key={key} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[#1b1624] border border-stone-800">
                    <div className="min-w-0">
                      <p className="text-sm text-stone-100 truncate">{name ? `${name} (${monster.name})` : monster.name}{elite && <span className="ml-1.5 text-[10px] font-semibold text-amber-400">élite</span>}</p>
                      <p className="text-[10px] font-mono text-stone-500">
                        VD {formatCr(monster.cr)} · CA {shown.ac} · {shown.hp} PG · {monster.type} · {shown.xp} PX
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {allowElite && (
                      <button onClick={() => toggleElite(key)} aria-pressed={Boolean(elite)}
                        title="Élite: un jefe más duro (×1,5 PG y PX, +1 al ataque y a la CD)"
                        className={`h-7 px-2 rounded-lg border text-[10px] font-semibold flex items-center gap-1 ${elite ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-stone-900 border-stone-700 text-stone-400'}`}>
                        <Crown className="w-3 h-3" /> Élite
                      </button>
                      )}
                      <button onClick={() => changeCount(monster, -1, key)} className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 flex items-center justify-center" aria-label={`Quitar ${monster.name}`}>
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono text-stone-100">{count}</span>
                      <button onClick={() => changeCount(monster, 1, key)} className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 flex items-center justify-center" aria-label={`Añadir ${monster.name}`}>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                  );
                })}
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
            <Skull className="w-3.5 h-3.5" /> {note || 'Juegas solo: «Fácil» ya es un reto. Las criaturas pueden huir o rendirse.'}
          </p>
          <button
            onClick={() => onStart(finalGroups)}
            disabled={groups.length === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-cinzel font-bold flex items-center gap-2 bg-gradient-to-r from-red-700 to-red-600 hover:brightness-110 text-white disabled:opacity-40 shrink-0"
          >
            <Swords className="w-4 h-4" /> {startLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
