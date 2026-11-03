import React from 'react';
import { Dice5, Users, Sparkles, Shield, ArrowRight, Flame } from 'lucide-react';
import { TAVERN_STATS } from '../data/gameData';

export default function Hero({ onStartGame, onScrollToWorlds }) {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-16 lg:pb-28">
      {/* Background radial ambient lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-amber-600/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute top-1/3 left-10 w-[350px] h-[350px] bg-red-950/20 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 right-10 w-[400px] h-[400px] bg-amber-800/15 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        
        {/* Top Announcement Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-6 shadow-sm hover:border-emerald-500/50 transition-colors">
          <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>¡100% Gratuito y Libre: Campañas con IA sin límites ni suscripciones!</span>
          <span className="text-emerald-400">→</span>
        </div>

        {/* Main Headline */}
        <h1 className="font-cinzel text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-stone-100 max-w-5xl mx-auto leading-[1.15]">
          Rol de mesa cuando quieras.{' '}
          <span className="block mt-2 bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-500 bg-clip-text text-transparent filter drop-shadow">
            Sin DM. Sin esperas. Cero tonterías.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-stone-300 max-w-3xl mx-auto leading-relaxed">
          Un Dungeon Master impulsado por IA con <span className="text-amber-300 font-medium">dientes de verdad</span> y memoria persistente. 
          Juega campañas en solitario a las 11 de la noche o pasa <span className="text-amber-300 font-medium">un único enlace para que hasta 5 amigos jueguen 100% gratis</span>.
        </p>

        {/* Call to Actions */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStartGame}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 font-cinzel font-bold text-lg shadow-xl shadow-amber-600/30 hover:shadow-amber-500/50 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 border border-amber-400/50"
          >
            <Dice5 className="w-6 h-6 animate-spin-slow" />
            <span>Pasa a la Taberna — Jugar Gratis</span>
          </button>

          <button
            onClick={onScrollToWorlds}
            className="w-full sm:w-auto px-7 py-4 rounded-xl bg-stone-900/90 border border-stone-700/80 hover:border-amber-500/60 text-stone-200 font-semibold text-base hover:text-amber-300 hover:bg-stone-850 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>Explorar los Mundos</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Free friends notice */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs sm:text-sm text-stone-400 font-medium">
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Tus amigos no necesitan suscripción ni cuenta para unirse a tu mesa.</span>
        </div>

        {/* Live Adventurers Activity Ticker */}
        <div className="mt-12 max-w-4xl mx-auto rounded-xl bg-gradient-to-r from-stone-900/70 via-stone-900/90 to-stone-900/70 border border-amber-900/30 p-3 shadow-inner">
          <div className="flex items-center justify-between text-xs font-mono text-stone-400 overflow-x-auto gap-6 px-2">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-stone-300 font-semibold">EN VIVO EN LA TABERNA:</span>
            </div>
            <div className="flex items-center gap-8 whitespace-nowrap text-stone-400">
              <span>⚔️ <strong className="text-amber-300">Brog</strong> destrozó la puerta del calabozo en Oakhaven</span>
              <span>🍺 <strong className="text-amber-300">Lyra</strong> invitó a una ronda a Maese Duncan (+2 Carisma)</span>
              <span>🎲 <strong className="text-amber-300">Kaelen</strong> sacó un <span className="text-emerald-400 font-bold">¡Nat 20!</span> forzando la caja fuerte</span>
              <span>🐉 <strong className="text-amber-300">Valeria</strong> intimidó a la patrulla en la Ciudadela</span>
            </div>
          </div>
        </div>

        {/* Key Stats Counter Grid */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {TAVERN_STATS.map((stat, idx) => (
            <div 
              key={idx}
              className="p-5 rounded-xl bg-stone-900/60 border border-amber-950/40 backdrop-blur-sm hover:border-amber-700/40 transition-colors"
            >
              <div className="font-cinzel text-2xl sm:text-3xl font-extrabold text-amber-400">
                {stat.value}
              </div>
              <div className="mt-1 text-xs sm:text-sm text-stone-400 font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
