import React, { useState, useRef, useEffect } from 'react';
import RichText from '../RichText';
import { Send, Dice5, Sparkles, Sword, Eye, MessageCircle, Flame, ShieldAlert } from 'lucide-react';

export default function StoryStream({
  messages,
  isGenerating,
  suggestedActions = [],
  character,
  party = [character],
  onSelectMember = () => {},
  pendingRecruit = null,
  onAnswerRecruit = () => {},
  world,
  onSendAction,
  onOpenGeminiConnect,
  onQuickAttack,
  onQuickCheck,
  keysCount = 0
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    onSendAction(inputText.trim());
    setInputText('');
  };

  const handleChipClick = (action) => {
    if (isGenerating) return;
    onSendAction(action);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0b12] text-stone-200 overflow-hidden relative">
      
      {/* Top Bar for Mobile / Header */}
      <div className="px-3 sm:px-4 py-2.5 bg-[#14101c] border-b border-amber-950/50 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-cinzel font-bold text-amber-200">
            {world.name}
          </span>
          <span className="text-stone-400 hidden sm:inline">• {world.initialLocation}</span>
        </div>

        {/* AI Engine Status & Multi-player Pool Indicator */}
        <div className="flex items-center gap-2">
          {keysCount > 0 ? (
            <button
              onClick={onOpenGeminiConnect}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[11px] font-mono hover:bg-emerald-900/60 hover:border-emerald-500 transition-all shadow"
              title="Configurar claves de la party y ver cuota combinada"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold">Gemini Activo</span>
              <span className="text-[10px] bg-emerald-900/90 text-emerald-200 px-1.5 py-0.2 rounded-full border border-emerald-600/50">
                {keysCount} {keysCount === 1 ? 'clave' : 'claves en Party'}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenGeminiConnect}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-800/40 text-stone-300 text-[11px] font-mono hover:bg-amber-950/70 hover:border-amber-600 transition-all shadow group"
              title="Haz clic para conectar tu cuenta gratuita de Gemini"
            >
              <span className="text-amber-400">⚙️ Motor Local</span>
              <span className="text-amber-400 font-bold group-hover:underline flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Conectar IA Gratis</span>
              </span>
            </button>
          )}

          <div className="text-[11px] font-mono text-stone-400 hidden md:flex items-center gap-1.5 pl-2 border-l border-stone-800">
            <span>DM:</span>
            <span className="text-amber-400 font-bold">Maese Duncan</span>
          </div>
        </div>
      </div>

      {/* Main Narrative Feed */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 bg-[radial-gradient(ellipse_at_top,_#161220_0%,_#0b0a0e_100%)]">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 sm:gap-4 ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}
          >
            {/* Avatar for DM Duncan */}
            {(msg.sender === 'greg' || msg.sender === 'duncan') && (
              <div className="w-10 h-10 rounded-full bg-amber-950 border border-amber-500/60 flex items-center justify-center text-xl shrink-0 shadow-md">
                🧔‍♂️
              </div>
            )}

            {/* Message Body */}
            <div
              className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 shadow-lg ${
                msg.sender === 'player'
                  ? 'bg-amber-600 text-stone-950 font-medium rounded-tr-none'
                  : msg.sender === 'system'
                  ? 'bg-stone-900/90 border border-amber-900/50 text-stone-300 rounded-lg text-xs font-mono w-full'
                  : 'bg-[#181422] text-stone-200 border border-amber-900/30 rounded-tl-none font-serif text-sm sm:text-base leading-relaxed'
              }`}
            >
              {/* Header inside DM message */}
              {(msg.sender === 'greg' || msg.sender === 'duncan') && (
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-950/50 font-sans text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-cinzel font-bold text-amber-300">
                      Maese Duncan (Dungeon Master)
                    </span>
                    {msg.source === 'gemini' && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-700/60 text-emerald-300 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Gemini Live {msg.totalKeys > 1 ? `• Clave ${(msg.keyIndex ?? 0) + 1}/${msg.totalKeys}` : ''}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {msg.timestamp || 'Ahora'}
                  </span>
                </div>
              )}

              {msg.sender === 'player' && (
                <div className="flex items-center gap-1.5 pb-1 mb-1 border-b border-amber-700/50 text-xs font-cinzel font-bold">
                  <span>{msg.actor ? msg.avatar || '🛡️' : character.avatar || '🛡️'}</span>
                  <span>{msg.actor || character.name}</span>
                </div>
              )}

              {/* Why the AI did not answer this turn (local engine used instead) */}
              {msg.notice && (
                <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[11px] font-sans text-amber-300/90">
                  ⚠️ {msg.notice}
                </div>
              )}

              {/* Text content */}
              <div className="whitespace-pre-line">
                <RichText text={msg.text} />
              </div>

              {/* Experience gained in this scene */}
              {msg.xp > 0 && (
                <div className="mt-3 inline-flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-lg bg-sky-950/50 border border-sky-800/50 text-[11px] font-mono text-sky-300">
                  <Sparkles className="w-3 h-3" /> +{msg.xp} PX
                </div>
              )}

              {/* Status / Dice badges */}
              {msg.roll && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/40 text-xs font-mono">
                  <Dice5 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Resultado D{msg.roll.sides}: <strong>{msg.roll.total}</strong></span>
                  {msg.roll.isNat20 && <span className="text-emerald-400 font-bold">¡CRÍTICO!</span>}
                  {msg.roll.isNat1 && <span className="text-red-400 font-bold">¡PIFIA!</span>}
                </div>
              )}
            </div>

            {/* Avatar for Player */}
            {msg.sender === 'player' && (
              <div className="w-10 h-10 rounded-full bg-stone-850 border border-amber-500/50 flex items-center justify-center text-xl shrink-0 shadow-md">
                {msg.actor ? msg.avatar || '🛡️' : character.avatar || '🛡️'}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isGenerating && (
          <div className="flex items-center gap-3 pl-2 text-xs font-mono text-amber-400 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-amber-950/60 border border-amber-600/40 flex items-center justify-center text-sm">
              🧔‍♂️
            </div>
            <span>Maese Duncan está encendiendo su pipa y calculando el desenlace...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Action Chips */}
      {suggestedActions && suggestedActions.length > 0 && !isGenerating && (
        <div className="px-4 py-2.5 bg-[#14101c] border-t border-amber-950/60 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-mono text-stone-400 shrink-0">Opciones:</span>
          {suggestedActions.map((act, i) => (
            <button
              key={i}
              onClick={() => handleChipClick(act)}
              className="px-3 py-1.5 rounded-lg bg-[#1c1726] hover:bg-amber-600/20 border border-amber-900/40 hover:border-amber-500/60 text-stone-300 hover:text-amber-200 whitespace-nowrap transition-all shadow-sm active:scale-95"
            >
              {act}
            </button>
          ))}
        </div>
      )}

      {/* A companion offered to join through the story: the player decides */}
      {pendingRecruit && (
        <div className="px-4 py-3 bg-emerald-950/30 border-t border-emerald-900/60 flex flex-wrap items-center gap-3 text-xs" role="status">
          <span className="text-2xl">{pendingRecruit.character.avatar || '🧭'}</span>
          <div className="flex-1 min-w-[12rem]">
            <p className="text-emerald-100 font-semibold">
              {pendingRecruit.character.name} quiere unirse al grupo
            </p>
            <p className="text-stone-300">
              {pendingRecruit.character.race} · {pendingRecruit.character.className}, nivel {pendingRecruit.character.level} · {pendingRecruit.character.maxHp} PG · CA {pendingRecruit.character.ac}
              {pendingRecruit.reason ? ` — ${pendingRecruit.reason}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onAnswerRecruit(true)} disabled={isGenerating || party.length >= 4}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-stone-950 font-bold">
              Aceptar
            </button>
            <button type="button" onClick={() => onAnswerRecruit(false)} disabled={isGenerating}
              className="px-3 py-1.5 rounded-lg border border-stone-700 text-stone-300 hover:bg-stone-800 disabled:opacity-40">
              Rechazar
            </button>
          </div>
        </div>
      )}

      {/* Input Action Form */}
      <form onSubmit={handleSubmit} className="p-3 sm:p-4 bg-[#110e17] border-t border-amber-950/60">
        <div className="flex items-center gap-2">
          {party.length > 1 && (
            <label className="shrink-0 flex items-center gap-1 bg-[#1a1523] border border-amber-900/40 rounded-xl px-2 py-2.5 text-xs text-stone-200" title="Quién actúa: la acción, las tiradas y los atajos usan su ficha">
              <span aria-hidden="true">{character.avatar || '🛡️'}</span>
              <span className="sr-only">Quién actúa</span>
              <select
                value={character.id}
                disabled={isGenerating}
                onChange={e => onSelectMember(e.target.value)}
                className="bg-transparent focus:outline-none max-w-[7rem] sm:max-w-[10rem] truncate"
                aria-label="Personaje que actúa"
              >
                {party.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#1a1523]">{m.name}{m.hp <= 0 ? ' (inconsciente)' : ''}</option>
                ))}
              </select>
            </label>
          )}
          <input
            type="text"
            value={inputText}
            disabled={isGenerating}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={party.length > 1 ? `¿Qué hace ${character.name}?` : "¿Qué hace tu personaje? (Ej: 'Desenvaino y exijo ver al cabecilla', 'Me acerco sigiloso por la sombra')..."}
            className="flex-1 min-w-0 bg-[#1a1523] border border-amber-900/40 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-stone-100 placeholder-stone-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isGenerating}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 disabled:opacity-40 text-stone-950 font-cinzel font-bold text-sm shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Actuar</span>
          </button>
        </div>

        {/* Quick shortcut tags */}
        <div className="flex items-center gap-4 mt-2 px-1 text-[11px] text-stone-400">
          <button
            type="button"
            onClick={() => !isGenerating && onQuickAttack?.()}
            disabled={isGenerating}
            title="Ataca con tu primera arma equipada (lo resuelve el juego)"
            className="hover:text-amber-300 flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <Sword className="w-3 h-3 text-red-400" />
            <span>Atacar</span>
          </button>
          <button
            type="button"
            onClick={() => !isGenerating && onQuickCheck?.('perception')}
            disabled={isGenerating}
            title="Tirada de Percepción con tu ficha (lo resuelve el juego)"
            className="hover:text-amber-300 flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <Eye className="w-3 h-3 text-blue-400" />
            <span>Percepción</span>
          </button>
          <button
            type="button"
            onClick={() => !isGenerating && onQuickCheck?.('persuasion')}
            disabled={isGenerating}
            title="Tirada de Persuasión con tu ficha (lo resuelve el juego)"
            className="hover:text-amber-300 flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <MessageCircle className="w-3 h-3 text-purple-400" />
            <span>Persuadir</span>
          </button>
          <button
            type="button"
            onClick={() => handleChipClick('Pedirle a Maese Duncan una pinta de cerveza y escuchar los rumores')}
            className="hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <Flame className="w-3 h-3 text-amber-400" />
            <span>Ronda en la Barra</span>
          </button>
        </div>
      </form>

    </div>
  );
}
