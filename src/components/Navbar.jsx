import React, { useState } from 'react';
import { Volume2, VolumeX, Users, Dice5, Sparkles, BookOpen, FlaskConical, Wifi, Menu } from 'lucide-react';
import { tavernAudio } from '../utils/audio';
import MenuButton from './MenuButton';

/**
 * Top bar of the landing page: only what a player needs at a glance
 * (their campaigns, joining a friend's room and playing); the rest lives in «Más».
 */
export default function Navbar({
  setView,
  onOpenInvite,
  onOpenJoin = null,
  onEnterTavern,
  onOpenWorldForge,
  onOpenGeminiConnect,
  onOpenCampaigns,
  onOpenSimulator,
  campaignsCount = 0,
  keysCount = 0,
  canResume = false
}) {
  // The ambience can also be switched in Ajustes: read it from the player, this only re-renders
  const [, setAudioTick] = useState(0);
  const isAudioActive = Boolean(tavernAudio.isAmbiencePlaying);

  const toggleSound = () => {
    tavernAudio.toggleTavernAmbience();
    setAudioTick(t => t + 1);
  };

  const countBadge = campaignsCount > 0 && (
    <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
      {campaignsCount}
    </span>
  );

  const menuItems = [
    // On a phone the bar only fits «Jugar» and the menu: these two move inside
    { label: `Mis campañas${campaignsCount > 0 ? ` (${campaignsCount})` : ''}`, icon: <BookOpen className="w-4 h-4 text-amber-400" />, onClick: onOpenCampaigns, className: 'sm:hidden' },
    { label: 'Unirse a una sala', icon: <Wifi className="w-4 h-4 text-sky-300" />, onClick: onOpenJoin, hidden: !onOpenJoin, className: 'sm:hidden' },
    { label: 'Forja de mundos', icon: <Sparkles className="w-4 h-4 text-amber-400" />, onClick: onOpenWorldForge, hint: 'Crea tu propio mundo' },
    { label: 'Simulador de combates', icon: <FlaskConical className="w-4 h-4 text-sky-400" />, onClick: onOpenSimulator, hint: 'Prueba combates sin tocar tus campañas' },
    { label: 'Compartir El Grifo', icon: <Users className="w-4 h-4 text-amber-500" />, onClick: onOpenInvite },
    'divider',
    {
      label: keysCount > 0 ? `IA: Gemini (${keysCount} ${keysCount === 1 ? 'clave' : 'claves'})` : 'IA: conectar Gemini gratis',
      hint: keysCount > 0 ? 'Gestionar las claves' : 'Ahora narra el motor local',
      icon: <Sparkles className={`w-4 h-4 ${keysCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`} />,
      onClick: onOpenGeminiConnect
    },
    {
      label: isAudioActive ? 'Silenciar el ambiente de taberna' : 'Audio de taberna',
      icon: isAudioActive ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-stone-400" />,
      onClick: toggleSound
    }
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0e0c12]/90 border-b border-amber-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">

        {/* Brand / Logo: goes back to the top of the page */}
        <button
          type="button"
          onClick={() => { setView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-2.5 min-w-0 group"
          aria-label="El Grifo Tuerto: ir al inicio"
        >
          <span className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-amber-600 via-amber-800 to-stone-900 p-0.5 shadow-lg shadow-amber-900/30">
            <span className="w-full h-full bg-[#141118] rounded-[7px] flex items-center justify-center text-xl">🦅</span>
          </span>
          <span className="font-cinzel font-bold text-base sm:text-lg text-amber-100 tracking-wider whitespace-nowrap group-hover:text-amber-400 transition-colors">
            El Grifo<span className="hidden min-[420px]:inline"> Tuerto</span>
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenCampaigns}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-900/90 border border-amber-900/40 hover:border-amber-600/60 text-stone-200 text-xs font-semibold transition-all"
            title="Abrir el Grimorio de campañas guardadas"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Mis campañas</span>
            {countBadge}
          </button>

          {onOpenJoin && (
            <button
              onClick={onOpenJoin}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-950/70 border border-sky-800/60 text-sky-200 text-xs font-semibold hover:border-sky-500 transition-all"
              title="Entrar en la partida online de un amigo con su código"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Unirse a una sala</span>
            </button>
          )}

          {/* Without a Gemini key, the free AI is offered here too */}
          {keysCount === 0 && (
            <button
              onClick={onOpenGeminiConnect}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold bg-amber-950/50 border-amber-800/60 text-amber-300 hover:bg-amber-900/50 transition-all"
              title="Conectar tu cuenta gratuita de Gemini para que Duncan narre con IA"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Conectar IA gratis</span>
            </button>
          )}

          <MenuButton
            title="Más opciones"
            icon={<Menu className="w-4 h-4" />}
            label={<span className="hidden sm:inline">Más</span>}
            items={menuItems}
            buttonClassName="flex items-center gap-1.5 p-2 sm:px-3 rounded-lg bg-stone-900/90 border border-stone-700/80 text-stone-200 text-xs font-semibold hover:border-amber-600/60 transition-all"
          />

          <button
            onClick={onEnterTavern}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 font-bold text-sm shadow-lg shadow-amber-600/30 hover:brightness-110 active:scale-95 transition-all whitespace-nowrap"
          >
            <Dice5 className="w-4 h-4" />
            <span className="sm:hidden">Jugar</span>
            <span className="hidden sm:inline">{canResume ? 'Continuar partida' : 'Jugar'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
