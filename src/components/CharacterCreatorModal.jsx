import React, { useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { X, Dice5, Shield, Sparkles, User, RefreshCw } from 'lucide-react';
import { getModifier, rollDie } from '../utils/gameEngine';

export default function CharacterCreatorModal({ isOpen, onClose, onSaveCharacter }) {
  useEscapeKey(isOpen, onClose);
  const [name, setName] = useState('');
  const [race, setRace] = useState('Humano');
  const [characterClass, setCharacterClass] = useState('Guerrero');
  const [avatar, setAvatar] = useState('🛡️');
  const [backstory, setBackstory] = useState('');
  const [stats, setStats] = useState({
    fue: 15,
    des: 14,
    con: 13,
    int: 10,
    sab: 12,
    car: 8
  });

  if (!isOpen) return null;

  const avatarOptions = ['🛡️', '🧝‍♂️', '👹', '🧙‍♀️', '🗡️', '🧙‍♂️', '🧝‍♀️', '🐉', '🏹', '🐺'];

  const rollRandomStats = () => {
    // 4d6 drop lowest for classic D&D feel
    const rollStat = () => {
      const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)];
      rolls.sort((a, b) => a - b);
      return rolls[1] + rolls[2] + rolls[3];
    };

    setStats({
      fue: rollStat(),
      des: rollStat(),
      con: rollStat(),
      int: rollStat(),
      sab: rollStat(),
      car: rollStat()
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Calculate base HP based on class and Constitution
    const conMod = Math.floor((stats.con - 10) / 2);
    let baseHp = 10;
    let baseAc = 12;

    if (characterClass === 'Bárbaro') baseHp = 14;
    else if (characterClass === 'Paladín' || characterClass === 'Guerrero') baseHp = 12;
    else if (characterClass === 'Pícaro' || characterClass === 'Clérigo' || characterClass === 'Bardo') baseHp = 10;
    else if (characterClass === 'Mago') baseHp = 8;

    const totalHp = Math.max(6, (baseHp + conMod) * 2);

    const newChar = {
      id: `custom-char-${Date.now()}`,
      name: name.trim(),
      race,
      class: `${characterClass} (Nivel 2)`,
      hp: totalHp,
      maxHp: totalHp,
      ac: baseAc + Math.floor((stats.des - 10) / 2),
      gold: 35,
      avatar,
      stats,
      inventory: [
        { id: 'arma1', name: `Arma de ${characterClass}`, type: 'weapon', bonus: '+4 al ataque' },
        { id: 'pocion', name: 'Poción de Curación Menor', type: 'consumable', effect: 'Restaura 2d4+2 HP', uses: 2 },
        { id: 'raciones', name: 'Bolsa de Provisiones de Viaje', type: 'food', desc: 'Raciones para 5 días' }
      ],
      backstory: backstory.trim() || `Un intrépido ${race.toLowerCase()} que llegó a la taberna en busca de fortuna y aventuras.`
    };

    onSaveCharacter(newChar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl bg-[#141019] border-2 border-amber-600/50 p-6 sm:p-7 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-850 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-600/20 border border-amber-500/50 flex items-center justify-center text-2xl">
            🧙‍♂️
          </div>
          <div>
            <h3 className="font-cinzel text-xl font-bold text-stone-100">
              Crear Nuevo Aventurero
            </h3>
            <p className="text-xs text-amber-400 font-mono">
              FICHA DE PERSONAJE PERSONALIZADA D&D 5E
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Name & Avatar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="sm:col-span-2">
              <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1">
                Nombre de tu Héroe:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Gareth Sombraluna, Thorin..."
                className="w-full bg-[#1b1623] border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-stone-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1">
                Avatar / Icono:
              </label>
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {avatarOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAvatar(opt)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                      avatar === opt 
                        ? 'bg-amber-600 border border-amber-400 scale-110 shadow' 
                        : 'bg-stone-900 border border-stone-800 hover:border-stone-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Race & Class */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1">
                Raza:
              </label>
              <select
                value={race}
                onChange={(e) => setRace(e.target.value)}
                className="w-full bg-[#1b1623] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm text-stone-200 focus:outline-none"
              >
                <option value="Humano">Humano (+Versatilidad)</option>
                <option value="Elfo Silvano">Elfo Silvano (+Destreza, Visión Oscura)</option>
                <option value="Enano de las Colinas">Enano (+Constitución, Resistencia)</option>
                <option value="Semi-Orco">Semi-Orco (+Fuerza bruta, Furia)</option>
                <option value="Tiefling">Tiefling (+Carisma, Fuego infernal)</option>
                <option value="Mediano">Mediano (+Suerte, Sigilo)</option>
                <option value="Dracónido">Dracónido (+Fuerza, Aliento elemental)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1">
                Clase:
              </label>
              <select
                value={characterClass}
                onChange={(e) => setCharacterClass(e.target.value)}
                className="w-full bg-[#1b1623] border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm text-stone-200 focus:outline-none"
              >
                <option value="Guerrero">Guerrero (Maestro de armas y armadura)</option>
                <option value="Pícaro">Pícaro (Ataques furtivos y ganzúas)</option>
                <option value="Mago">Mago (Conjuros arcanos demoledores)</option>
                <option value="Bárbaro">Bárbaro (Furia indestructible)</option>
                <option value="Paladín">Paladín (Castigo divino y sanación)</option>
                <option value="Clérigo">Clérigo (Milagros y bendiciones)</option>
                <option value="Bardo">Bardo (Inspiración y labia en la taberna)</option>
              </select>
            </div>
          </div>

          {/* Attributes Grid (STR, DEX, CON, INT, WIS, CHA) */}
          <div className="p-4 rounded-xl bg-stone-900/80 border border-amber-950/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase text-amber-300 font-bold tracking-wider">
                Atributos Principales (D&D 5e):
              </span>
              <button
                type="button"
                onClick={rollRandomStats}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tirar Dados (4d6)</span>
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {[
                { key: 'fue', label: 'FUE', desc: 'Fuerza' },
                { key: 'des', label: 'DES', desc: 'Destreza' },
                { key: 'con', label: 'CON', desc: 'Constitución' },
                { key: 'int', label: 'INT', desc: 'Inteligencia' },
                { key: 'sab', label: 'SAB', desc: 'Sabiduría' },
                { key: 'car', label: 'CAR', desc: 'Carisma' }
              ].map(({ key, label }) => (
                <div key={key} className="p-2 rounded-lg bg-[#181320] border border-stone-800">
                  <div className="text-[10px] text-stone-400 font-mono">{label}</div>
                  <input
                    type="number"
                    min="6"
                    max="20"
                    value={stats[key]}
                    onChange={(e) => setStats({ ...stats, [key]: parseInt(e.target.value) || 10 })}
                    className="w-full text-center bg-transparent font-cinzel font-bold text-base text-stone-100 focus:outline-none"
                  />
                  <div className="text-[11px] font-mono text-amber-400 font-bold">
                    {getModifier(stats[key])}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Backstory */}
          <div>
            <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1">
              Historia o Motivación:
            </label>
            <textarea
              rows={2}
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder="¿Por qué entras a la taberna? ¿Buscas una reliquia familiar, pagar una deuda de juego o huir de la ley?..."
              className="w-full bg-[#1b1623] border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-stone-200 focus:outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:brightness-110 text-stone-950 font-cinzel font-bold text-sm shadow-xl shadow-amber-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Crear Aventurero y Ocupar Asiento en la Barra</span>
          </button>

        </form>

      </div>
    </div>
  );
}
