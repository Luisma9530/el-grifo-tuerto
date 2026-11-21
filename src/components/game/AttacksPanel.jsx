import React, { useState } from 'react';
import { Flame, Swords } from 'lucide-react';
import { attackOptions, attacksPerAction, sneakAttackDice, rageBonus, damageLabel, DEFAULT_TARGET_AC } from '../../utils/combat';
import { formatModifier } from '../../utils/characterBuilder';

const ABILITY_SHORT = { fue: 'FUE', des: 'DES' };

/**
 * Weapon attacks resolved by the game: pick an equipped weapon, the game rolls
 * the attack and damage with the 3D dice and Duncan only narrates the result.
 */
export default function AttacksPanel({ character, onAttack, busy }) {
  const [target, setTarget] = useState('');
  const [targetAC, setTargetAC] = useState('');
  const [raging, setRaging] = useState(false);
  const options = attackOptions(character);
  const perAction = attacksPerAction(character);
  const sneak = sneakAttackDice(character);
  const rage = rageBonus(character);

  const attack = optionId => onAttack({
    optionId,
    target,
    targetAC: Number(targetAC) || DEFAULT_TARGET_AC,
    raging
  });

  return (
    <div>
      <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-2">
        Ataques{perAction > 1 ? ` (${perAction} por acción)` : ''}:
      </span>

      <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
        <input
          type="text"
          value={target}
          maxLength={60}
          onChange={e => setTarget(e.target.value)}
          placeholder="Objetivo (opcional)"
          aria-label="Objetivo del ataque"
          className="min-w-0 bg-[#1a1523] border border-stone-800 focus:border-red-500/60 rounded-lg px-2.5 py-1.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-none"
        />
        <input
          type="number"
          min={1}
          max={30}
          value={targetAC}
          onChange={e => setTargetAC(e.target.value)}
          placeholder={`CA ${DEFAULT_TARGET_AC}`}
          aria-label="Clase de armadura del objetivo"
          title="Clase de armadura del objetivo, si la conoces. Si no, se usa 12."
          className="w-20 bg-[#1a1523] border border-stone-800 focus:border-red-500/60 rounded-lg px-2 py-1.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-none"
        />
      </div>

      {rage > 0 && (
        <label className="flex items-center gap-2 mb-2 text-xs text-stone-300 cursor-pointer">
          <input type="checkbox" checked={raging} onChange={e => setRaging(e.target.checked)} className="accent-red-500" />
          <Flame className="w-3.5 h-3.5 text-red-400" />
          En furia (+{rage} al daño con Fuerza)
        </label>
      )}

      <div className="space-y-1.5">
        {options.map(option => (
          <div key={option.id} className="p-2.5 rounded-xl bg-[#17131f] border border-stone-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-stone-100 truncate">
                {option.itemName}
                {option.weapon && option.itemName.toLowerCase() !== option.name.toLowerCase() && (
                  <span className="text-stone-500 font-normal"> · {option.name.toLowerCase()}</span>
                )}
              </p>
              <p className="text-[10px] font-mono text-stone-400">
                <span className="text-amber-300">{formatModifier(option.attackBonus)}</span> al ataque · {damageLabel(option)} {option.type} · {ABILITY_SHORT[option.ability]}
              </p>
              {option.notes.length > 0 && <p className="text-[10px] text-stone-500 truncate">{option.notes.join(' · ')}</p>}
            </div>
            <button
              onClick={() => attack(option.id)}
              disabled={busy}
              className="px-2.5 py-1 rounded bg-red-700 hover:bg-red-600 disabled:bg-stone-800 disabled:text-stone-500 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors"
            >
              <Swords className="w-3 h-3" /> Atacar
            </button>
          </div>
        ))}
      </div>
      {sneak > 0 && (
        <p className="text-[10px] text-stone-500 mt-1.5">
          Ataque Furtivo: +{sneak}d6 una vez por turno con armas sutiles o a distancia.
        </p>
      )}
    </div>
  );
}
