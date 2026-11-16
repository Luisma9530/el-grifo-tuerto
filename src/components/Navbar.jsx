import React, { useState } from 'react';
import { Volume2, VolumeX, Users, Flame, Dice5, Sparkles, Compass, BookOpen } from 'lucide-react';
import { tavernAudio } from '../utils/audio';

export default function Navbar({ 
  currentView, 
  setView, 
  onOpenInvite, 
  onOpenWorldForge, 
  onOpenGeminiConnect, 
  onOpenCampaigns,
  campaignsCount = 0,
  keysCount = 0 
}) {
  const [isAudioActive, setIsAudioActive] = useState(false);

  const toggleSound = () => {
    const newState = tavernAudio.toggleTavernAmbience();
    setIsAudioActive(newState);
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0e0c12]/90 border-b border-amber-900/30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div 
          onClick={() => setView('landing')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-600 via-amber-800 to-stone-900 p-0.5 shadow-lg shadow-amber-900/30 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#141118] rounded-[7px] flex items-center justify-center relative overflow-hidden">
              <span className="text-2xl filter drop-shadow">🦅</span>
              <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-cinzel font-bold text-lg sm:text-xl text-amber-100 tracking-wider group-hover:text-amber-400 transition-colors">
                EL GRIFO
              </span>
              <span className="font-cinzel text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                TUERTO
              </span>
            </div>
            <p className="text-[10px] text-stone-400 tracking-widest font-mono uppercase">
              AI Tabletop RPG & Persistent Worlds
            </p>
          </div>
        </div>

        {/* Navigation items for desktop */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-300">
          <button 
            onClick={() => setView('landing')}
            className={`transition-colors hover:text-amber-400 ${currentView === 'landing' ? 'text-amber-400 font-semibold' : ''}`}
          >
            Inicio
          </button>
          <a 
            href="#features" 
            onClick={(e) => { if (currentView !== 'landing') { e.preventDefault(); setView('landing'); setTimeout(() => { window.location.hash = '#features'; }, 100); } }}
            className="hover:text-amber-400 transition-colors"
          >
            Características
          </a>
          <a 
            href="#worlds" 
            onClick={(e) => { if (currentView !== 'landing') { e.preventDefault(); setView('landing'); setTimeout(() => { window.location.hash = '#worlds'; }, 100); } }}
            className="hover:text-amber-400 transition-colors flex items-center gap-1"
          >
            <Compass className="w-4 h-4 text-amber-500" />
            Mundos
          </a>
          <button 
            onClick={onOpenWorldForge}
            className="hover:text-amber-400 transition-colors text-stone-300 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            Forja de Mundos
          </button>
          <button 
            onClick={onOpenCampaigns}
            className="hover:text-amber-400 transition-colors text-stone-300 flex items-center gap-1.5"
          >
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span>Mis Campañas</span>
            {campaignsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {campaignsCount}
              </span>
            )}
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Quick Campaigns button for mobile & desktop */}
          <button
            onClick={onOpenCampaigns}
            className="p-2 sm:px-3 sm:py-2 rounded-lg bg-stone-900/90 border border-amber-900/40 hover:border-amber-600/60 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Abrir Grimorio de Campañas guardadas"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Campañas</span>
            {campaignsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
                {campaignsCount}
              </span>
            )}
          </button>
          {/* Audio Ambience Toggle */}
          <button
            onClick={toggleSound}
            title={isAudioActive ? 'Silenciar ambiente de taberna' : 'Activar fuego y ambiente de taberna'}
            className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              isAudioActive 
                ? 'bg-amber-600/20 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/30' 
                : 'bg-stone-900/80 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
            }`}
          >
            {isAudioActive ? (
              <>
                <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="hidden sm:inline">Hoguera Encendida</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" />
                <span className="hidden sm:inline">Audio Taberna</span>
              </>
            )}
          </button>

          {/* Gemini IA Connect Button */}
          <button
            onClick={onOpenGeminiConnect}
            className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
              keysCount > 0
                ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-amber-950/50 border-amber-800/60 text-amber-300 hover:bg-amber-900/50'
            }`}
            title="Conectar cuenta gratuita de Gemini o gestionar pool de la party"
          >
            <Sparkles className={`w-3.5 h-3.5 ${keysCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>{keysCount > 0 ? `Gemini (${keysCount})` : 'Conectar IA Gratis'}</span>
          </button>

          {/* Share button */}
          <button
            onClick={onOpenInvite}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-900/90 border border-amber-900/40 text-stone-200 text-xs font-semibold hover:border-amber-600/60 hover:text-amber-300 transition-all"
          >
            <Users className="w-3.5 h-3.5 text-amber-500" />
            <span>Compartir</span>
          </button>

          {/* Play / Enter Tavern Button */}
          {currentView === 'landing' ? (
            <button
              onClick={() => setView('app')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 font-bold text-sm shadow-lg shadow-amber-600/30 hover:shadow-amber-500/50 hover:brightness-110 active:scale-95 transition-all"
            >
              <Dice5 className="w-4 h-4 animate-bounce" />
              <span>Entrar a la Taberna</span>
            </button>
          ) : (
            <button
              onClick={() => setView('landing')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-stone-800/90 border border-stone-700 text-stone-200 font-medium text-xs hover:bg-stone-700 transition-all"
            >
              <span>← Salir a la Puerta</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
