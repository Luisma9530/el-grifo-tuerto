import React from 'react';
import { Compass, Sparkles, Skull, Shield, Users, ArrowRight } from 'lucide-react';
import { PRESET_WORLDS } from '../data/gameData';

export default function WorldsShowcase({ onSelectWorld, onOpenWorldForge }) {
  return (
    <section id="worlds" className="py-20 bg-[#0a090d] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
              <Compass className="w-3.5 h-3.5" />
              <span>Reinos Persistentes</span>
            </div>
            <h2 className="font-cinzel text-3xl sm:text-5xl font-extrabold text-stone-100">
              Explora Mundos Infinitos
            </h2>
            <p className="mt-3 text-stone-300 text-base max-w-2xl">
              Desde tabernas medievales asediadas por la niebla hasta callejones ciberpunk empapados de lluvia ácida. Elige un mundo o crea el tuyo desde cero.
            </p>
          </div>

          <button
            onClick={onOpenWorldForge}
            className="mt-6 md:mt-0 self-start md:self-auto px-5 py-3 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-purple-900/30 flex items-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4 animate-spin-slow" />
            <span>+ Forjar Mundo Personalizado</span>
          </button>
        </div>

        {/* Worlds Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PRESET_WORLDS.map((world) => (
            <div
              key={world.id}
              className="group rounded-2xl bg-[#120f17] border border-amber-900/30 overflow-hidden hover:border-amber-500/60 transition-all duration-300 flex flex-col justify-between shadow-xl hover:shadow-2xl hover:shadow-amber-900/10"
            >
              <div className={`p-6 sm:p-7 bg-gradient-to-br ${world.coverGradient} border-b border-stone-800/80`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-stone-900/80 text-amber-300 border border-amber-500/30 font-mono">
                    {world.genre}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-md bg-stone-900/60 text-stone-300 font-medium">
                    Dificultad: <strong className="text-amber-400">{world.difficulty}</strong>
                  </span>
                </div>

                <h3 className="font-cinzel text-2xl font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                  {world.name}
                </h3>
                <p className="mt-2 text-stone-300 text-sm italic font-serif">
                  "{world.tagline}"
                </p>
              </div>

              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-stone-300 text-sm leading-relaxed mb-5">
                    {world.description}
                  </p>

                  {/* Factions */}
                  <div className="mb-6">
                    <span className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-2">
                      Facciones en Conflicto:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {world.factions.map((fac, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-xs font-medium text-stone-300 flex items-center gap-1.5"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${fac.status === 'Hostil' ? 'bg-red-500' : fac.status === 'Amistoso' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span>{fac.name}</span>
                          <span className="text-[10px] text-stone-400">({fac.status})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSelectWorld(world)}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600 border border-amber-500/40 hover:border-amber-400 text-amber-200 hover:text-stone-950 font-cinzel font-bold text-sm transition-all flex items-center justify-center gap-2 group-hover:bg-amber-600 group-hover:text-stone-950 shadow-md"
                >
                  <span>Entrar en {world.name.split(' ')[0]}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
