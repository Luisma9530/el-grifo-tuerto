import React, { useState } from 'react';
import { BedDouble, Flame, Sparkles } from 'lucide-react';
import { spellRows, slotTable, slotRecovery, spellSummary, LONG_REST_COST } from '../../utils/spellcasting';
import { formatModifier } from '../../utils/characterBuilder';
import RestButtons from './RestButtons';

function SpellList({ title, rows, onCast, busy }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-2">{title}</span>
      <div className="space-y-2">
        {rows.map(spell => (
          <div
            key={spell.id}
            className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 ${
              spell.blocked ? 'bg-[#141019] border-stone-800/60 opacity-60' : 'bg-[#171320] border-stone-800'
            }`}
          >
            <div className="min-w-0">
              <h5 className="font-cinzel text-xs font-bold text-amber-200">
                {spell.name}
                {spell.freeAvailable && (
                  <span className="ml-1.5 text-[9px] font-mono font-normal px-1 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-300" title="Puedes lanzarlo una vez por descanso largo sin gastar espacio">
                    {spell.entry.sourceKey === 'arcanum' ? 'ARCANO' : '1 GRATIS'}
                  </span>
                )}
              </h5>
              <p className="text-[10px] font-mono text-stone-500">
                {spellSummary(spell)}
                {spell.kind === 'attack' && ` · ataque ${formatModifier(spell.attackBonus)}`}
                {spell.kind === 'save' && ` · CD ${spell.saveDC}`}
              </p>
              <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">{spell.desc}</p>
              {spell.blocked && <p className="text-[10px] text-amber-400/80 mt-1">{spell.blocked}</p>}
            </div>
            <button
              onClick={() => onCast(spell.id)}
              disabled={busy || Boolean(spell.blocked)}
              className="px-2.5 py-1 rounded bg-purple-700 hover:bg-purple-600 disabled:bg-stone-800 disabled:text-stone-500 text-white text-xs font-bold shrink-0 transition-colors shadow-sm"
            >
              Lanzar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Spells tab of the character sheet: slots, target, cantrips and prepared spells. */
export default function SpellsTab({ character, onCastSpell, onRest, busy, partyNames = [], restCost, partySize = 1 }) {
  const [target, setTarget] = useState('');
  const rows = spellRows(character);
  const slots = slotTable(character.spellcasting);
  const recovery = slotRecovery(character.spellcasting);
  const cast = spellId => onCastSpell(spellId, target);
  const levels = [...new Set(rows.filter(s => s.level > 0).map(s => s.level))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {slots.length > 0 && (
        <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-900/40">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase text-stone-400 tracking-wider">Espacios de conjuro</span>
            <span className="text-[11px] text-stone-400">Se recuperan con un descanso {recovery === 'short' ? 'corto' : 'largo'}</span>
          </div>
          <div className="space-y-1.5">
            {slots.map(row => (
              <div key={row.level} className="flex items-center justify-between gap-3">
                <span className="text-xs text-stone-300">Nivel {row.level}</span>
                <div className="flex items-center gap-1" role="img" aria-label={`Nivel ${row.level}: ${row.left} de ${row.max} espacios disponibles`}>
                  {Array.from({ length: row.max }, (_, i) => (
                    <Sparkles key={i} className={`w-4 h-4 ${i < row.left ? 'text-purple-300 fill-purple-400/40' : 'text-stone-700'}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {slots.length > 1 && (
            <p className="text-[10px] text-stone-500 mt-2">
              Un conjuro usa el espacio libre más bajo de su nivel o superior; con uno superior tira un dado más de daño o curación.
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="spell-target" className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-1.5">
          Objetivo (opcional):
        </label>
        <input
          id="spell-target"
          type="text"
          value={target}
          maxLength={60}
          onChange={e => setTarget(e.target.value)}
          placeholder="el encapuchado, la puerta, mí mismo…"
          className="w-full bg-[#1a1523] border border-stone-800 focus:border-purple-500 rounded-lg px-3 py-1.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-none"
        />
        {partyNames.length > 1 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
            <span className="text-stone-500">Curar a un compañero:</span>
            {partyNames.filter(n => n !== character.name).map(name => (
              <button key={name} type="button" onClick={() => setTarget(name)}
                className={`px-1.5 py-0.5 rounded border ${target === name ? 'border-purple-400 text-purple-200' : 'border-stone-700 text-stone-400 hover:text-stone-200'}`}>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <SpellList title="Trucos (a voluntad):" rows={rows.filter(s => s.level === 0)} onCast={cast} busy={busy} />
      {levels.map(level => (
        <SpellList key={level} title={`Conjuros de nivel ${level}:`} rows={rows.filter(s => s.level === level)} onCast={cast} busy={busy} />
      ))}

      <RestButtons character={character} onRest={onRest} busy={busy} cost={restCost} partySize={partySize} />
    </div>
  );
}
