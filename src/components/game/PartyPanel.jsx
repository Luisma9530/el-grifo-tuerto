import React, { useState } from 'react';
import { Heart, Shield, Coins, Users, Backpack, Coffee, Plus, Sparkles } from 'lucide-react';
import { getModifier, rollCheckWithStat } from '../../utils/gameEngine';
import { TAVERN_MENU } from '../../data/gameData';
import { tavernAudio } from '../../utils/audio';

export default function PartyPanel({
  character,
  onUpdateCharacter,
  onOrderDrink,
  onOpenInvite,
  onOpenCharacterModal,
  onRollStatCheck
}) {
  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet' | 'inventory' | 'menu'
  const hpPercent = Math.max(0, Math.min(100, Math.round((character.hp / character.maxHp) * 100)));

  const handleUseItem = (item) => {
    if (item.type === 'consumable' && item.uses > 0) {
      tavernAudio.playTankardClink();
      // Heal 6 hp on average
      const healAmt = 6;
      const newHp = Math.min(character.maxHp, character.hp + healAmt);
      onUpdateCharacter({
        ...character,
        hp: newHp,
        inventory: character.inventory.map(inv => 
          inv.id === item.id ? { ...inv, uses: inv.uses - 1 } : inv
        ).filter(inv => inv.uses === undefined || inv.uses > 0)
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#120f18] border-r border-amber-950/60 overflow-hidden text-stone-200">
      
      {/* Character Profile Header */}
      <div className="p-4 bg-gradient-to-b from-[#1c1626] to-[#120f18] border-b border-amber-950/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div 
              onClick={onOpenCharacterModal}
              title="Cambiar o personalizar personaje"
              className="w-13 h-13 rounded-xl bg-amber-950/80 border-2 border-amber-500/50 flex items-center justify-center text-3xl shadow-inner cursor-pointer hover:border-amber-400 hover:scale-105 transition-all"
            >
              {character.avatar || '🛡️'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel font-bold text-stone-100 text-base leading-tight">
                  {character.name}
                </h3>
              </div>
              <p className="text-xs text-amber-400 font-medium">
                {character.race} • {character.class}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCharacterModal}
            className="p-1.5 rounded-lg bg-stone-850 hover:bg-stone-800 text-stone-400 hover:text-amber-300 border border-stone-700 text-xs transition-colors"
            title="Editar ficha"
          >
            Ficha
          </button>
        </div>

        {/* Vital stats bars: HP, AC, Gold */}
        <div className="mt-4 space-y-2">
          {/* Health Bar */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="flex items-center gap-1 text-red-400 font-semibold">
                <Heart className="w-3.5 h-3.5 fill-red-500/40" />
                <span>Puntos de Golpe (HP)</span>
              </span>
              <span className="font-bold text-stone-200">
                {character.hp} / {character.maxHp}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-stone-900 overflow-hidden border border-stone-800">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  hpPercent > 50 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                  hpPercent > 20 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                  'bg-gradient-to-r from-red-600 to-red-500 animate-pulse'
                }`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* AC and Gold pill row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-[#181320] border border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>Armadura</span>
              </div>
              <span className="font-cinzel font-bold text-stone-100 text-sm">
                CA {character.ac}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-[#181320] border border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Oro</span>
              </div>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {character.gold} po
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-amber-950/60 text-xs font-medium bg-[#16121e]">
        <button
          onClick={() => setActiveTab('sheet')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'sheet'
              ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-semibold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <span>Atributos</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-semibold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Backpack className="w-3.5 h-3.5" />
          <span>Mochila ({character.inventory?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'menu'
              ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-semibold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>Barra Taberna</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        
        {/* STATS SHEET TAB */}
        {activeTab === 'sheet' && (
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-2">
                Tiradas de Habilidad (Haz clic para tirar):
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'fue', name: 'Fuerza', stat: character.stats.fue },
                  { key: 'des', name: 'Destreza', stat: character.stats.des },
                  { key: 'con', name: 'Constitución', stat: character.stats.con },
                  { key: 'int', name: 'Inteligencia', stat: character.stats.int },
                  { key: 'sab', name: 'Sabiduría', stat: character.stats.sab },
                  { key: 'car', name: 'Carisma', stat: character.stats.car }
                ].map(({ key, name, stat }) => (
                  <button
                    key={key}
                    onClick={() => onRollStatCheck(stat, name)}
                    className="p-2.5 rounded-xl bg-[#17131f] hover:bg-amber-950/40 border border-stone-800 hover:border-amber-600/50 flex items-center justify-between text-left transition-all group"
                  >
                    <div>
                      <span className="text-xs text-stone-300 font-medium group-hover:text-amber-300">
                        {name}
                      </span>
                      <div className="text-[10px] text-stone-400 font-mono">
                        Puntuación: {stat}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-amber-400 font-mono font-bold text-xs group-hover:border-amber-500">
                      {getModifier(stat)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Backstory snippet */}
            <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-800">
              <span className="text-[10px] font-mono uppercase text-stone-400 tracking-wider block mb-1">
                Biografía del Héroe:
              </span>
              <p className="text-xs text-stone-300 italic font-serif leading-relaxed">
                "{character.backstory}"
              </p>
            </div>

            {/* Party Members in Tavern */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-mono text-stone-400 uppercase tracking-wider">
                  Mesa de Aventureros:
                </span>
                <button
                  onClick={onOpenInvite}
                  className="text-amber-400 hover:text-amber-300 text-[11px] font-bold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Invitar Amigo</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-600/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span>👑</span>
                    <span className="font-semibold text-stone-200">{character.name} (Tú)</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">EN MESA</span>
                </div>

                <div 
                  onClick={onOpenInvite}
                  className="p-2 rounded-lg bg-stone-900/50 border border-dashed border-stone-800 hover:border-amber-600/40 flex items-center justify-between text-xs text-stone-400 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-stone-400" />
                    <span>+ Invitar amigo a la campaña (Gratis)</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono">5 HUECOS</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="space-y-2.5">
            <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block">
              Equipo & Objetos en Mochila:
            </span>

            {character.inventory?.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#171320] border border-stone-800 flex items-start justify-between gap-2"
              >
                <div>
                  <h5 className="font-cinzel text-xs font-bold text-amber-200">
                    {item.name}
                  </h5>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {item.bonus || item.effect || item.desc}
                  </p>
                  {item.uses !== undefined && (
                    <span className="inline-block mt-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-900">
                      Usos restantes: {item.uses}
                    </span>
                  )}
                </div>

                {item.type === 'consumable' && (
                  <button
                    onClick={() => handleUseItem(item)}
                    className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold shrink-0 transition-colors shadow-sm"
                  >
                    Usar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAVERN BAR / MENU TAB */}
        {activeTab === 'menu' && (
          <div className="space-y-2.5">
            <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block">
              Bebidas & Viandas de Maese Duncan:
            </span>

            {TAVERN_MENU.map((drink) => (
              <div
                key={drink.id}
                className="p-3 rounded-xl bg-[#171320] border border-amber-950/50 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{drink.icon}</span>
                  <div>
                    <h5 className="font-cinzel text-xs font-bold text-stone-200">
                      {drink.name}
                    </h5>
                    <p className="text-[10px] text-stone-400 leading-tight">
                      {drink.effect}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onOrderDrink(drink)}
                  disabled={character.gold < drink.cost}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 text-xs font-bold shrink-0 transition-all font-mono"
                >
                  {drink.cost} po
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
