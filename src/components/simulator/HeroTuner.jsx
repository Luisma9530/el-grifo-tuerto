import React, { useState } from 'react';
import { Heart, FlaskConical, Wand2, Sparkles, Plus, TrendingUp } from 'lucide-react';
import EquipmentPanel from '../game/EquipmentPanel';
import ConditionBadges from '../game/ConditionBadges';
import { WEAPONS } from '../../data/weapons';
import { ARMORS } from '../../data/armor';
import { POTIONS } from '../../data/gear';
import { slotTable, getSpell } from '../../utils/spellcasting';
import { hasCondition, exhaustionLevel } from '../../utils/conditions';
import {
  setHp, potionCount, setPotions, addCatalogItem, setSlotsUsed, setPrepared, START_CONDITIONS, setStartCondition
} from '../../utils/simulator';

const box = 'rounded-xl bg-[#16121d] border border-stone-800 p-3';
const label = 'text-[11px] font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5 mb-2';
const numberInput = 'w-16 bg-[#1a1523] border border-stone-700 rounded-lg px-2 py-1 text-sm text-stone-100 font-mono focus:outline-none focus:border-sky-500/60';

/**
 * Adjust a copy of the hero before a practice fight: level, HP, hands and armor,
 * potions, spell slots, prepared spells and starting conditions.
 * onChange(hero) gets the new copy; onLevel(level) asks the parent to rebuild or level up.
 * `minLevel`: copies of saved heroes can only go up (a lower level would need the hero's history).
 */
export default function HeroTuner({ hero, onChange, onLevel, minLevel = 1, levelLocked = null }) {
  const [catalogKey, setCatalogKey] = useState('');
  const [levelDraft, setLevelDraft] = useState(hero.level || 1);
  const slots = slotTable(hero.spellcasting);
  const preparable = (hero.spellcasting?.known || [])
    .filter(k => getSpell(k.id)?.level > 0 && !k.freeCast)
    .map(k => ({ ...k, spell: getSpell(k.id) }))
    .sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name, 'es'));
  const exhaustion = exhaustionLevel(hero);
  const level = hero.level || 1;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={box}>
          <span className={label}><TrendingUp className="w-3.5 h-3.5" /> Nivel</span>
          {levelLocked ? (
            <p className="text-xs text-stone-400">Nivel {level}. {levelLocked}</p>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" min={minLevel} max={20} value={levelDraft} aria-label="Nivel del héroe"
                onChange={e => setLevelDraft(Math.max(minLevel, Math.min(20, Number(e.target.value) || minLevel)))} className={numberInput} />
              <button disabled={Number(levelDraft) === level} onClick={() => onLevel(Number(levelDraft))}
                className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:bg-stone-800 disabled:text-stone-500 text-xs font-bold text-white">
                Aplicar
              </button>
              {minLevel > 1 && <span className="text-[10px] text-stone-500">desde {minLevel}</span>}
            </div>
          )}
        </div>

        <div className={box}>
          <span className={label}><Heart className="w-3.5 h-3.5 text-red-400" /> Puntos de golpe</span>
          <div className="flex items-center gap-2">
            <input type="range" min={1} max={hero.maxHp} value={hero.hp} aria-label="Puntos de golpe al empezar"
              onChange={e => onChange(setHp(hero, e.target.value))} className="flex-1 accent-red-500" />
            <span className="font-mono text-xs text-stone-200 w-16 text-right">{hero.hp}/{hero.maxHp}</span>
            <button onClick={() => onChange(setHp(hero, hero.maxHp))} className="text-[10px] text-sky-300 hover:underline">Llenar</button>
          </div>
        </div>
      </div>

      <div className={box}>
        <EquipmentPanel character={hero} onChange={onChange} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={catalogKey} onChange={e => setCatalogKey(e.target.value)} aria-label="Añadir arma o armadura"
            className="flex-1 min-w-[180px] bg-[#1a1523] border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-stone-200">
            <option value="">Añadir otra arma o armadura a la mochila…</option>
            <optgroup label="Armas">
              {WEAPONS.map(w => <option key={w.id} value={`weapon:${w.id}`}>{w.name} · {w.damage} {w.type}</option>)}
            </optgroup>
            <optgroup label="Armaduras y escudos">
              {ARMORS.map(a => <option key={a.id} value={`armor:${a.id}`}>{a.name}</option>)}
            </optgroup>
          </select>
          <button disabled={!catalogKey} onClick={() => { onChange(addCatalogItem(hero, catalogKey)); setCatalogKey(''); }}
            className="px-3 py-1.5 rounded-lg border border-stone-700 text-xs text-stone-200 hover:border-sky-500/60 disabled:opacity-40 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Añadir
          </button>
        </div>
        <p className="mt-1 text-[10px] text-stone-500">Después elígela arriba, en las manos o como armadura.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={box}>
          <span className={label}><FlaskConical className="w-3.5 h-3.5 text-sky-300" /> Pociones</span>
          <div className="space-y-1.5">
            {POTIONS.map(p => (
              <label key={p.id} className="flex items-center justify-between gap-2 text-xs text-stone-300">
                <span>{p.name} <span className="text-stone-500">({p.heal})</span></span>
                <input type="number" min={0} max={20} value={potionCount(hero, p.id)}
                  onChange={e => onChange(setPotions(hero, p.id, e.target.value))} className={numberInput} />
              </label>
            ))}
          </div>
        </div>

        <div className={box}>
          <span className={label}><Sparkles className="w-3.5 h-3.5 text-fuchsia-300" /> Condiciones al empezar</span>
          <div className="grid grid-cols-2 gap-1">
            {START_CONDITIONS.map(c => (
              <label key={c.id} className="flex items-center gap-1.5 text-xs text-stone-300">
                <input type="checkbox" className="accent-fuchsia-500" checked={hasCondition(hero, c.id)}
                  onChange={e => onChange(setStartCondition(hero, c.id, e.target.checked, exhaustion || 1))} />
                {c.name}
              </label>
            ))}
          </div>
          {exhaustion > 0 && (
            <label className="mt-2 flex items-center gap-2 text-xs text-stone-300">
              Nivel de agotamiento
              <select value={exhaustion} onChange={e => onChange(setStartCondition(hero, 'agotamiento', true, Number(e.target.value)))}
                className="bg-[#1a1523] border border-stone-700 rounded px-1.5 py-0.5 text-xs">
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <ConditionBadges creature={hero} className="mt-2" />
        </div>
      </div>

      {(slots.length > 0 || preparable.length > 0) && (
        <div className={box}>
          <span className={label}><Wand2 className="w-3.5 h-3.5 text-purple-300" /> Magia</span>
          {slots.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {slots.map(row => (
                <label key={row.level} className="text-xs text-stone-300 flex items-center gap-1.5">
                  Nivel {row.level}: libres
                  <input type="number" min={0} max={row.max} value={row.left} aria-label={`Espacios libres de nivel ${row.level}`}
                    onChange={e => onChange(setSlotsUsed(hero, row.level, row.max - (Number(e.target.value) || 0)))} className={numberInput} />
                  <span className="text-stone-500">/ {row.max}</span>
                </label>
              ))}
            </div>
          )}
          {preparable.length > 0 && (
            <>
              <p className="text-[10px] text-stone-500 mb-1">Conjuros preparados (en el simulador puedes preparar los que quieras):</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {preparable.map(k => (
                  <label key={k.id} className="flex items-center gap-1.5 text-xs text-stone-300">
                    <input type="checkbox" className="accent-purple-500" checked={Boolean(k.prepared)}
                      onChange={e => onChange(setPrepared(hero, k.id, e.target.checked))} />
                    {k.spell.name} <span className="text-stone-500">· nivel {k.spell.level}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
