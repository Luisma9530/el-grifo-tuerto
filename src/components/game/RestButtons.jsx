import React from 'react';
import { BedDouble, Flame } from 'lucide-react';
import { slotTable, slotRecovery, hasHitDie, hitDiceLeft, LONG_REST_COST } from '../../utils/spellcasting';

/** Short and long rest buttons (shown in the spells tab and at the tavern bar). */
export default function RestButtons({ character, onRest, busy, cost = LONG_REST_COST, partySize = 1 }) {
  const pactMagic = slotRecovery(character.spellcasting) === 'short';
  const shortRestHelps = (hasHitDie(character) && character.hp < character.maxHp)
    || (pactMagic && slotTable(character.spellcasting).some(row => row.used > 0));
  const canAffordRoom = character.gold >= cost;
  const group = partySize > 1;

  return (
    <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-800">
      <span className="text-[10px] font-mono uppercase text-stone-400 tracking-wider block mb-2">{group ? `Descansar (todo el grupo, ${partySize}):` : 'Descansar:'}</span>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onRest('short')}
          disabled={busy}
          title={shortRestHelps
            ? `Una hora de respiro: gastas un dado de golpe (te quedan ${hitDiceLeft(character)}) para curarte` + (pactMagic ? ' y recuperas tu magia de pacto' : '')
            : 'Una hora de respiro (ahora mismo no recuperarías nada)'}
          className="px-2.5 py-2 rounded-lg bg-[#1c1726] hover:bg-amber-950/40 border border-stone-700 hover:border-amber-600/50 disabled:opacity-40 text-xs text-stone-200 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" /> Descanso corto
        </button>
        <button
          onClick={() => onRest('long')}
          disabled={busy || !canAffordRoom}
          title={canAffordRoom
            ? (group ? `Una noche en la posada, una habitación por cabeza (${LONG_REST_COST} po cada una): todos recuperan PG y conjuros` : 'Una noche en la posada: recuperas todos tus puntos de golpe y conjuros')
            : `Necesitáis ${cost} po para ${group ? 'las habitaciones' : 'la habitación'}`}
          className="px-2.5 py-2 rounded-lg bg-[#1c1726] hover:bg-amber-950/40 border border-stone-700 hover:border-amber-600/50 disabled:opacity-40 text-xs text-stone-200 flex items-center justify-center gap-1.5 transition-colors"
        >
          <BedDouble className="w-3.5 h-3.5 text-amber-400" /> Descanso largo
          <span className="font-mono text-amber-300">{cost} po</span>
        </button>
      </div>
    </div>
  );
}
