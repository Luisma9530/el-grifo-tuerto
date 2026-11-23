import React from 'react';
import { Dice5, Sparkles, Shield, ArrowDown, Flame } from 'lucide-react';

/** `resumeTitle`: the active campaign's title, when there is one to continue */
export default function Hero({ onStartGame, onScrollToWorlds, resumeTitle = null }) {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-16 lg:pb-28">
      {/* Background radial ambient lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-amber-600/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute top-1/3 left-10 w-[350px] h-[350px] bg-red-950/20 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 right-10 w-[400px] h-[400px] bg-amber-800/15 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        
        {/* Top Announcement Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-6 shadow-sm ">
          <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>100% gratuito: sin registro, sin suscripciones y con tus partidas guardadas</span>
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
          Un Dungeon Master con <span className="text-amber-300 font-medium">dientes de verdad</span> que siempre está tras la barra.
          Juega campañas en solitario a las 11 de la noche, <span className="text-amber-300 font-medium">con dados 3D, ficha de personaje y partidas que se guardan solas</span>.
        </p>

        {/* Call to Actions: one main button (continue or play) and a way to start another adventure */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStartGame}
            className="w-full sm:w-auto max-w-full px-8 py-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 font-cinzel font-bold text-lg shadow-xl shadow-amber-600/30 hover:shadow-amber-500/50 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 border border-amber-400/50"
          >
            <Dice5 className="w-6 h-6 shrink-0 animate-spin-slow" />
            <span className="truncate">{resumeTitle ? `Continuar: «${resumeTitle}»` : 'Pasa a la Taberna — Jugar Gratis'}</span>
          </button>

          <button
            onClick={onScrollToWorlds}
            className="w-full sm:w-auto px-7 py-4 rounded-xl bg-stone-900/90 border border-stone-700/80 hover:border-amber-500/60 text-stone-200 font-semibold text-base hover:text-amber-300 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>{resumeTitle ? 'Empezar otra aventura' : 'Elegir un mundo'}</span>
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* No-account notice */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs sm:text-sm text-stone-400 font-medium">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Sin cuenta ni instalación: todo se queda en tu navegador.</span>
        </div>

      </div>
    </section>
  );
}
