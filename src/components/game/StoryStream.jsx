import React, { useState, useRef, useEffect, Suspense } from 'react';
import RichText from '../RichText';
import { Send, Dice5, Sparkles, ShieldAlert, Eye, MessageCircle, Search, Footprints, Brain, Clapperboard, ScrollText } from 'lucide-react';
import MenuButton from '../MenuButton';
import { DiceRollerTray } from './lazyParts';
import { currentNode } from '../../utils/shops';

/** Checks offered by the 🎲 button next to «Actuar» (rolled with the acting member's sheet). */
const QUICK_CHECKS = [
  { id: 'perception', label: 'Percepción', icon: Eye, tone: 'text-blue-400' },
  { id: 'insight', label: 'Perspicacia', icon: Brain, tone: 'text-sky-300' },
  { id: 'investigation', label: 'Investigación', icon: Search, tone: 'text-amber-300' },
  { id: 'persuasion', label: 'Persuasión', icon: MessageCircle, tone: 'text-purple-400' },
  { id: 'stealth', label: 'Sigilo', icon: Footprints, tone: 'text-stone-300' }
];

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
  onQuickCheck,
  // Free dice rolls (the tray opens from the 🎲 button); without it the tray is not offered
  onDiceRoll = null,
  keysCount = 0,
  // Online: who this screen may act with (default: everyone), whether the box is
  // locked (default: while Duncan writes) and a line above it (whose turn, etc.)
  actors = null,
  inputLocked = null,
  inputNotice = null,
  // A party apart (see splitParty.js): the scenes this screen follows ({ id, label, place,
  // active, spotlight }), the prologues it may read ({ id, label, messages }) and where
  // each member is ({ [id]: place }, for the selector)
  scenes = [],
  onSelectScene = () => {},
  prologues = [],
  memberPlaces = null
}) {
  const canPick = actors || party;
  // A prologue being read (history of a scene that already joined another one)
  const [readingId, setReadingId] = useState(null);
  const reading = prologues.find(p => p.id === readingId) || null;
  const shown = reading ? reading.messages : messages;
  const locked = Boolean(reading) || (inputLocked ?? isGenerating);
  const [inputText, setInputText] = useState('');
  const [trayOpen, setTrayOpen] = useState(false);
  const place = currentNode(world)?.name || world.initialLocation;
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [shown, isGenerating]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || locked) return;
    onSendAction(inputText.trim());
    setInputText('');
  };

  const handleChipClick = (action) => {
    if (locked) return;
    onSendAction(action);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0b12] text-stone-200 overflow-hidden relative">
      
      {/* Where the party is, and the AI that narrates (the only place it shows during the game, with Ajustes) */}
      <div className="px-3 sm:px-4 py-2 bg-[#14101c] border-b border-amber-950/50 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-cinzel font-bold text-amber-200 truncate min-w-[5rem]">{world.name}</span>
          {place && <span className="text-stone-400 truncate min-w-0 shrink-[3]">· {place}</span>}
        </div>

        <button
          onClick={onOpenGeminiConnect}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono transition-all ${
            keysCount > 0
              ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300 hover:border-emerald-500'
              : 'bg-amber-950/40 border-amber-800/40 text-amber-300 hover:border-amber-600'
          }`}
          title={keysCount > 0 ? 'Gestionar las claves de Gemini de la party' : 'Conectar tu cuenta gratuita de Gemini'}
        >
          <span className={`w-2 h-2 rounded-full ${keysCount > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {keysCount > 0 ? (
            <span className="font-bold">Gemini<span className="hidden sm:inline"> activo</span></span>
          ) : (
            <>
              <span className="hidden sm:inline">Motor local ·</span>
              <span className="font-bold flex items-center gap-1"><Sparkles className="w-3 h-3" />Conectar IA</span>
            </>
          )}
        </button>
      </div>

      {/* A party apart: its scenes and the prologues kept as history */}
      {(scenes.length > 0 || prologues.length > 0) && (
        <div className="px-2 sm:px-3 py-1.5 bg-[#110e17] border-b border-amber-950/50 flex items-center gap-1.5 overflow-x-auto text-[11px]" role="tablist" aria-label="Escenas y prólogos">
          {scenes.map(s => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={!reading && s.active}
              disabled={!s.active && isGenerating}
              onClick={() => {
                setReadingId(null);
                if (!s.active) onSelectScene(s.id);
              }}
              title={`${s.label}${s.place ? ` · ${s.place}` : ''}${s.spotlight ? ' (le toca ahora)' : ''}`}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full border transition-colors disabled:opacity-40 ${
                !reading && s.active ? 'bg-amber-500/15 border-amber-500 text-amber-200' : 'bg-[#17131f] border-stone-800 text-stone-300 hover:border-amber-700'
              }`}
            >
              <Clapperboard className="w-3 h-3" />
              <span className="max-w-[9rem] truncate">{s.label}</span>
              {s.place && <span className="text-stone-500 max-w-[7rem] truncate">· {s.place}</span>}
              {s.spotlight && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-label="le toca ahora" />}
            </button>
          ))}
          {prologues.map(p => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={readingId === p.id}
              onClick={() => setReadingId(readingId === p.id ? null : p.id)}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full border transition-colors ${
                readingId === p.id ? 'bg-sky-500/15 border-sky-500 text-sky-200' : 'bg-[#17131f] border-stone-800 text-stone-400 hover:border-sky-700'
              }`}
            >
              <ScrollText className="w-3 h-3" />
              <span className="max-w-[12rem] truncate">{p.label}</span>
            </button>
          ))}
        </div>
      )}
      {reading && (
        <div className="px-3 py-1.5 bg-sky-950/40 border-b border-sky-900/50 flex items-center justify-between gap-2 text-[11px] text-sky-100" role="status">
          <span className="truncate">Estás leyendo el {reading.label.toLowerCase()}: es historia ya pasada.</span>
          <button type="button" onClick={() => setReadingId(null)} className="shrink-0 px-2 py-0.5 rounded border border-sky-700 hover:bg-sky-900/50">Volver a la escena</button>
        </div>
      )}

      {/* Main Narrative Feed */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 bg-[radial-gradient(ellipse_at_top,_#161220_0%,_#0b0a0e_100%)]">
        {shown.map((msg, idx) => (
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
                  {msg.by && <span className="ml-auto font-sans font-normal text-[10px] text-amber-200/70">({msg.by})</span>}
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
      {!reading && suggestedActions && suggestedActions.length > 0 && !isGenerating && (
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
      <form onSubmit={handleSubmit} className="relative p-3 sm:p-4 bg-[#110e17] border-t border-amber-950/60">
        {trayOpen && onDiceRoll && (
          <div className="absolute bottom-full right-3 mb-2 z-40">
            <Suspense fallback={null}>
              <DiceRollerTray onSendRollToChat={onDiceRoll} onClose={() => setTrayOpen(false)} />
            </Suspense>
          </div>
        )}
        {inputNotice && (
          <p className="mb-2 text-[11px] text-sky-200 bg-sky-950/30 border border-sky-900/50 rounded-lg px-2.5 py-1.5" role="status">{inputNotice}</p>
        )}
        <div className="flex items-center gap-2">
          {party.length > 1 && canPick.length > 0 && (
            <label className="shrink-0 flex items-center gap-1 bg-[#1a1523] border border-amber-900/40 rounded-xl px-2 py-2.5 text-xs text-stone-200" title="Quién actúa: la acción, las tiradas y los atajos usan su ficha">
              <span aria-hidden="true">{character.avatar || '🛡️'}</span>
              <span className="sr-only">Quién actúa</span>
              <select
                value={character.id}
                disabled={locked}
                onChange={e => onSelectMember(e.target.value)}
                className="bg-transparent focus:outline-none max-w-[5.5rem] sm:max-w-[10rem] truncate"
                aria-label="Personaje que actúa"
              >
                {canPick.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#1a1523]">{m.name}{memberPlaces?.[m.id] ? ` · ${memberPlaces[m.id]}` : ''}{m.hp <= 0 ? ' (inconsciente)' : ''}</option>
                ))}
              </select>
            </label>
          )}
          <input
            type="text"
            value={inputText}
            disabled={locked}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={party.length > 1 ? `¿Qué hace ${character.name}?` : "¿Qué hace tu personaje? (Ej: 'Desenvaino y exijo ver al cabecilla', 'Me acerco sigiloso por la sombra')..."}
            className="flex-1 min-w-0 bg-[#1a1523] border border-amber-900/40 focus:border-amber-500 rounded-xl px-3 sm:px-4 py-3 text-sm text-stone-100 placeholder-stone-500 focus:outline-none transition-colors"
          />
          <MenuButton
            className="shrink-0"
            placement="up"
            disabled={locked && !onDiceRoll}
            title="Tiradas: habilidades con la ficha y bandeja de dados"
            icon={<Dice5 className="w-4 h-4" />}
            buttonClassName="px-3 py-3 rounded-xl bg-[#1a1523] border border-amber-900/40 hover:border-amber-500 text-amber-300 disabled:opacity-40 transition-colors"
            items={[
              ...QUICK_CHECKS.map(({ id, label, icon, tone }) => ({
                label: `Tirada de ${label}`,
                icon: React.createElement(icon, { className: `w-4 h-4 ${tone}` }),
                hidden: locked || !onQuickCheck,
                onClick: () => onQuickCheck(id)
              })),
              ...(onDiceRoll ? ['divider', {
                label: trayOpen ? 'Cerrar la bandeja de dados' : 'Bandeja de dados',
                hint: 'Tiradas libres (d4 a d100) a la crónica',
                icon: <Dice5 className="w-4 h-4 text-amber-400" />,
                onClick: () => setTrayOpen(o => !o)
              }] : [])
            ]}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || locked}
            className="px-4 sm:px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 disabled:opacity-40 text-stone-950 font-cinzel font-bold text-sm shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Actuar</span>
          </button>
        </div>

      </form>

    </div>
  );
}
