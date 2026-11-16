import React, { useState } from 'react';
import { Dice5, Sparkles, Skull, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { rollDie } from '../../utils/gameEngine';
import { animateRoll } from '../../dice3d/controller';

export default function DiceRollerTray({ onSendRollToChat }) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);
  const [modifier, setModifier] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [, setHistory] = useState([]);

  const diceTypes = [
    { sides: 4, label: 'd4', shape: '▲' },
    { sides: 6, label: 'd6', shape: '■' },
    { sides: 8, label: 'd8', shape: '◆' },
    { sides: 10, label: 'd10', shape: '⬟' },
    { sides: 12, label: 'd12', shape: '⬢' },
    { sides: 20, label: 'd20', shape: '⬡' },
    { sides: 100, label: 'd100', shape: '%' }
  ];

  const handleRoll = async (sides) => {
    if (isRolling) return;
    setIsRolling(true);
    const raw = rollDie(sides, { silent: true });

    // 3D dice (or a short pause with sound if they are unavailable / turned off)
    await animateRoll({ sides, value: raw, modifier });

    setIsRolling(false);
    const total = raw + modifier;
    const isNat20 = sides === 20 && raw === 20;
    const isNat1 = sides === 20 && raw === 1;

    const rollObj = {
      sides,
      raw,
      modifier,
      total,
      isNat20,
      isNat1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setLastRoll(rollObj);
    setHistory(prev => [rollObj, ...prev.slice(0, 5)]);

    if (onSendRollToChat) {
      onSendRollToChat(rollObj);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      
      {/* Expanded Dice Tray Box */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 rounded-2xl bg-[#16121e] border-2 border-amber-600/50 p-4 shadow-2xl shadow-black/80 backdrop-blur-md animate-in slide-in-from-bottom-5">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-amber-950/60">
            <div className="flex items-center gap-2">
              <Dice5 className="w-4 h-4 text-amber-400" />
              <h4 className="font-cinzel text-sm font-bold text-stone-100">
                Bandeja de Dados de Maese Duncan
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-stone-400">Mod:</span>
              <select
                value={modifier}
                onChange={(e) => setModifier(parseInt(e.target.value))}
                className="bg-[#1f182b] border border-stone-700 text-amber-300 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none"
              >
                <option value={-2}>-2</option>
                <option value={-1}>-1</option>
                <option value={0}>+0</option>
                <option value={1}>+1</option>
                <option value={2}>+2</option>
                <option value={3}>+3</option>
                <option value={4}>+4</option>
                <option value={5}>+5</option>
              </select>
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
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      Tirada registrada en la crónica
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-400 italic text-center w-full">
                Haz clic en cualquier dado poliédrico para rodarlo...
              </div>
            )}
          </div>

          {/* Polyhedral Dice Buttons */}
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {diceTypes.map((die) => (
              <button
                key={die.sides}
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
      )}

      {/* Floating Toggle Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-stone-950 font-cinzel font-bold text-xs shadow-xl shadow-amber-600/40 flex items-center gap-2 transition-all active:scale-95 ml-auto border border-amber-300/40"
      >
        <Dice5 className="w-4 h-4 animate-spin-slow" />
        <span>Tirador de Dados</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

    </div>
  );
}
