import React, { useState } from 'react';
import { Dice5, Sparkles, Skull, X } from 'lucide-react';
import { rollDie } from '../../utils/gameEngine';
import { animateRoll } from '../../dice3d/controller';

const DICE_TYPES = [
  { sides: 4, label: 'd4', shape: '▲' },
  { sides: 6, label: 'd6', shape: '■' },
  { sides: 8, label: 'd8', shape: '◆' },
  { sides: 10, label: 'd10', shape: '⬟' },
  { sides: 12, label: 'd12', shape: '⬢' },
  { sides: 20, label: 'd20', shape: '⬡' },
  { sides: 100, label: 'd100', shape: '%' }
];

/**
 * Free dice rolls that go to the chronicle. It opens over the text box
 * (from its 🎲 button), so it never covers the map or the «Actuar» button.
 */
export default function DiceRollerTray({ onSendRollToChat, onClose }) {
  const [lastRoll, setLastRoll] = useState(null);
  const [modifier, setModifier] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  const handleRoll = async (sides) => {
    if (isRolling) return;
    setIsRolling(true);
    const raw = rollDie(sides, { silent: true });

    // 3D dice (or a short pause with sound if they are unavailable / turned off)
    await animateRoll({ sides, value: raw, modifier });

    setIsRolling(false);
    const total = raw + modifier;
    const rollObj = {
      sides,
      raw,
      modifier,
      total,
      isNat20: sides === 20 && raw === 20,
      isNat1: sides === 20 && raw === 1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setLastRoll(rollObj);
    onSendRollToChat?.(rollObj);
  };

  return (
    <div
      role="dialog"
      aria-label="Bandeja de dados"
      className="w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl bg-[#16121e] border-2 border-amber-600/50 p-4 shadow-2xl shadow-black/80"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-amber-950/60">
        <div className="flex items-center gap-2 min-w-0">
          <Dice5 className="w-4 h-4 shrink-0 text-amber-400" />
          <h4 className="font-cinzel text-sm font-bold text-stone-100 truncate">Bandeja de dados</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-stone-400">Mod:</span>
          <select
            value={modifier}
            onChange={(e) => setModifier(parseInt(e.target.value))}
            aria-label="Modificador de la tirada"
            className="bg-[#1f182b] border border-stone-700 text-amber-300 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none"
          >
            {[-2, -1, 0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n >= 0 ? `+${n}` : n}</option>)}
          </select>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 rounded text-stone-400 hover:text-stone-100" aria-label="Cerrar la bandeja de dados">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Result Display Area */}
      <div className="my-3 p-3 rounded-xl bg-[#0f0c14] border border-amber-900/30 flex items-center justify-between min-h-[70px]">
        {lastRoll ? (
          <div className="flex items-center gap-3 w-full">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-cinzel text-xl font-extrabold shadow-inner ${
              lastRoll.isNat20 ? 'bg-gradient-to-br from-emerald-600 to-emerald-400 text-stone-950 ring-2 ring-emerald-300' :
              lastRoll.isNat1 ? 'bg-gradient-to-br from-red-600 to-red-900 text-white ring-2 ring-red-400' :
              'bg-gradient-to-br from-amber-600 to-amber-700 text-stone-950'
            } ${isRolling ? 'animate-dice-roll' : ''}`}>
              {lastRoll.total}
            </div>

            <div className="flex-1">
              <div className="text-xs font-mono text-stone-300">
                d{lastRoll.sides}: <strong>{lastRoll.raw}</strong> {lastRoll.modifier >= 0 ? `+ ${lastRoll.modifier}` : `- ${Math.abs(lastRoll.modifier)}`} = <span className="text-amber-400 font-bold">{lastRoll.total}</span>
              </div>

              {lastRoll.isNat20 && (
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 mt-0.5 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>¡NAT 20 CRÍTICO! Éxito monumental</span>
                </div>
              )}

              {lastRoll.isNat1 && (
                <div className="text-xs font-bold text-red-400 flex items-center gap-1 mt-0.5">
                  <Skull className="w-3.5 h-3.5" />
                  <span>¡PIFIA NATURAL 1! Algo sale muy mal</span>
                </div>
              )}

              {!lastRoll.isNat20 && !lastRoll.isNat1 && (
                <div className="text-[11px] text-stone-400 mt-0.5">Tirada registrada en la crónica</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-stone-400 italic text-center w-full">
            Haz clic en cualquier dado para tirarlo...
          </div>
        )}
      </div>

      {/* Polyhedral Dice Buttons */}
      <div className="grid grid-cols-7 gap-1.5">
        {DICE_TYPES.map((die) => (
          <button
            key={die.sides}
            type="button"
            onClick={() => handleRoll(die.sides)}
            disabled={isRolling}
            className="py-2 rounded-lg bg-[#1e172a] hover:bg-amber-600/30 hover:border-amber-400/60 border border-stone-800 text-stone-200 hover:text-amber-300 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90"
          >
            <span className="text-xs opacity-75">{die.shape}</span>
            <span className="text-[11px] font-mono font-bold">{die.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
