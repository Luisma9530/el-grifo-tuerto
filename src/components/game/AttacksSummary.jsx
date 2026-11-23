import React from 'react';
import { attackOptions, attacksPerAction, sneakAttackDice, rageBonus, damageLabel } from '../../utils/combat';
import { damageSpells, spellSummary } from '../../utils/spellcasting';
import { formatModifier } from '../../utils/characterBuilder';

const ABILITY_SHORT = { fue: 'FUE', des: 'DES' };

/**
 * What the hero can attack with, for reference only: there are no buttons here.
 * In a fight the attacks are made in the combat view; outside it the player writes
 * what they do («ataco al guardia con la daga») and the story decides.
 */
export default function AttacksSummary({ character }) {
  const options = attackOptions(character);
  const perAction = attacksPerAction(character);
  const sneak = sneakAttackDice(character);
  const rage = rageBonus(character);
  const spells = damageSpells(character);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-stone-500 leading-snug">
        Solo para consultar: en combate se ataca desde la vista de combate; fuera de él, escribe lo que haces (p. ej. «ataco al guardia con la daga»).
      </p>

      {options.length === 0 && (
        <p className="text-[11px] text-stone-500">No llevas armas en las manos ni tienes una mano libre. Cámbialo en la pestaña «Equipo».</p>
      )}
      {options.map(option => (
        <div key={option.id} className="p-2 rounded-lg bg-[#17131f] border border-stone-800" data-testid="attack-row">
          <p className="text-xs font-semibold text-stone-100 truncate">
            {option.itemName}
            {option.weapon && option.itemName.toLowerCase() !== option.name.toLowerCase() && (
              <span className="text-stone-500 font-normal"> · {option.name.toLowerCase()}</span>
            )}
          </p>
          <p className="text-[10px] font-mono text-stone-400">
            <span className="text-amber-300">{formatModifier(option.attackBonus)}</span> al ataque · {damageLabel(option)} {option.type} · {ABILITY_SHORT[option.ability]}
          </p>
          {option.notes.length > 0 && <p className="text-[10px] text-stone-500">{option.notes.join(' · ')}</p>}
        </div>
      ))}

      {(perAction > 1 || sneak > 0 || rage > 0) && (
        <ul className="text-[10px] text-stone-500 space-y-0.5">
          {perAction > 1 && <li>Ataque Adicional: {perAction} ataques por acción.</li>}
          {sneak > 0 && <li>Ataque Furtivo: +{sneak}d6 una vez por turno con armas sutiles o a distancia.</li>}
          {rage > 0 && <li>En furia: +{rage} al daño con Fuerza.</li>}
        </ul>
      )}

      {spells.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] font-mono uppercase text-stone-500 tracking-wider mb-1">Conjuros de daño preparados</p>
          {spells.map(spell => (
            <div key={spell.id} className="px-2 py-1.5 rounded-lg bg-[#17131f] border border-purple-900/40 mb-1" data-testid="spell-row">
              <p className="text-xs font-semibold text-purple-200 truncate">
                {spell.name} <span className="text-stone-500 font-normal">· {spell.level === 0 ? 'truco' : `nivel ${spell.level}`}</span>
              </p>
              <p className="text-[10px] font-mono text-stone-400">
                {spell.kind === 'attack' && <span className="text-amber-300">{formatModifier(spell.attackBonus)} al ataque · </span>}
                {spell.kind === 'save' && <span className="text-amber-300">CD {spell.saveDC} · </span>}
                {spellSummary(spell)}
                {spell.blocked && <span className="text-stone-500"> · {spell.blocked.toLowerCase()}</span>}
              </p>
            </div>
          ))}
          <p className="text-[10px] text-stone-500">Se lanzan desde la pestaña «Conjuros».</p>
        </div>
      )}
    </div>
  );
}
