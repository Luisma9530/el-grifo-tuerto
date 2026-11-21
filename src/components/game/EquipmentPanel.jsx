import React, { useState } from 'react';
import { Hand, Ban, Shield, Footprints } from 'lucide-react';
import {
  handSlots, itemsForHand, equipItem, unequipHand, setTwoHandedGrip, gripOf, isHandUsable, holdsShield,
  normalizeEquipment, LIMBS, limbStatusLabel, fleeDC, speedInMetres, SHIELD_BONUS, injuredLegs
} from '../../utils/equipment';

const LIMB_STYLES = {
  ok: 'border-emerald-900/60 text-emerald-300 bg-emerald-950/30',
  disabled: 'border-amber-800/60 text-amber-300 bg-amber-950/30',
  lost: 'border-red-900/60 text-red-300 bg-red-950/30'
};

const formatMetres = m => `${String(m).replace('.', ',')} m`;

/**
 * What the hero holds in each hand and the state of their limbs.
 * onChange(nextCharacter) receives the sheet with the new hands.
 * `locked`: a message shown instead of the controls (e.g. during a fight).
 */
export default function EquipmentPanel({ character, onChange, locked = null, showLimbs = true }) {
  const [error, setError] = useState('');
  const sheet = normalizeEquipment(character);
  const slots = handSlots(sheet);
  const bothArms = isHandUsable(sheet, 'main') && isHandUsable(sheet, 'off');

  const apply = result => {
    if (!result.ok) { setError(result.error); return; }
    setError('');
    onChange(result.character);
  };

  const choose = (hand, itemId) => {
    if (!itemId) { setError(''); onChange(unequipHand(sheet, hand)); return; }
    const item = sheet.inventory.find(i => i.id === itemId);
    apply(equipItem(sheet, itemId, hand, { twoHands: gripOf(item) === 'two' }));
  };

  const legs = injuredLegs(sheet);
  const flee = fleeDC(sheet);

  return (
    <div className="space-y-3">
      <div>
        <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider flex items-center gap-1.5 mb-2">
          <Hand className="w-3.5 h-3.5" /> En las manos
        </span>
        <div className="space-y-1.5">
          {slots.map(slot => {
            const options = itemsForHand(sheet, slot.hand);
            const versatile = slot.item && gripOf(slot.item) === 'versatile';
            return (
              <div key={slot.hand} className={`p-2.5 rounded-xl border ${slot.blocked ? 'bg-stone-950/60 border-stone-900' : 'bg-[#17131f] border-stone-800'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] text-stone-400">{slot.label}</span>
                  {slot.twoHands && <span className="text-[10px] font-mono text-amber-300">a dos manos</span>}
                </div>
                {slot.blocked ? (
                  <p className="text-xs text-red-300 flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5" /> Bloqueada: {LIMBS.find(l => l.id === slot.limb).name.toLowerCase()} {limbStatusLabel(slot.limb, slot.limbStatus).toLowerCase()}
                  </p>
                ) : locked ? (
                  <p className="text-xs text-stone-100">{slot.item?.name || <span className="text-stone-500">Vacía</span>}</p>
                ) : (
                  <>
                    <select
                      value={slot.item?.id || ''}
                      onChange={e => choose(slot.hand, e.target.value)}
                      aria-label={slot.label}
                      className="w-full bg-[#120f18] border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500/60"
                    >
                      <option value="">— Vacía —</option>
                      {options.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name}{gripOf(item) === 'two' ? ' (a dos manos)' : gripOf(item) === 'versatile' ? ' (versátil)' : ''}
                        </option>
                      ))}
                    </select>
                    {versatile && slot.hand === 'main' && (
                      <label className={`mt-1.5 flex items-center gap-2 text-[11px] ${bothArms ? 'text-stone-300' : 'text-stone-600'}`}>
                        <input
                          type="checkbox"
                          checked={slot.twoHands}
                          disabled={!bothArms}
                          onChange={e => apply(setTwoHandedGrip(sheet, slot.item.id, e.target.checked))}
                          className="accent-amber-500"
                        />
                        Empuñar a dos manos (dado mayor)
                      </label>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {locked && <p className="mt-1.5 text-[10px] text-amber-300/80">{locked}</p>}
        {error && <p role="alert" className="mt-1.5 text-[11px] text-red-300">{error}</p>}
        <p className="mt-1.5 text-[10px] text-stone-500 flex items-center gap-1">
          <Shield className="w-3 h-3" /> CA {sheet.ac} = {sheet.acBase} de armadura{holdsShield(sheet) ? ` + ${SHIELD_BONUS} del escudo` : ''}. El escudo solo protege si está en una mano.
        </p>
      </div>

      {showLimbs && (
        <div>
          <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-2">Extremidades</span>
          <div className="grid grid-cols-2 gap-1.5">
            {LIMBS.map(limb => (
              <div key={limb.id} className={`px-2 py-1.5 rounded-lg border text-[11px] flex items-center justify-between ${LIMB_STYLES[sheet.limbs[limb.id]]}`}>
                <span>{limb.name}</span>
                <span className="font-semibold">{limbStatusLabel(limb.id, sheet.limbs[limb.id])}</span>
              </div>
            ))}
          </div>
          {legs > 0 && (
            <p className="mt-1.5 text-[10px] text-amber-300/90 flex items-center gap-1">
              <Footprints className="w-3 h-3" /> Velocidad {formatMetres(speedInMetres(sheet))}. {flee == null ? 'No puedes huir de un combate.' : `Huir de un combate: CD ${flee}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
