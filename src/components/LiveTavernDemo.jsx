import React, { useState } from 'react';
import { Send, Dice5, Sparkles, RefreshCw, Volume2, ShieldAlert } from 'lucide-react';
import { rollDie } from '../utils/gameEngine';
import { animateRoll } from '../dice3d/controller';
import RichText from './RichText';
import { tavernAudio } from '../utils/audio';

export default function LiveTavernDemo({ onEnterFullTavern }) {
  const [inputAction, setInputAction] = useState('');
  const [lastRoll, setLastRoll] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [storyFeed, setStoryFeed] = useState([
    {
      sender: 'duncan',
      text: '—*Vaya, vaya... otra alma errante que cruza la puerta buscando gloria o una jarra barata.* (Maese Duncan se ajusta el parche de cuero, frota su barba canosa y te clava una mirada astuta). *En El Grifo Tuerto no cobramos por respirar, pero si vas a ocupar una banqueta, al menos demuestra de qué madera estás hecho. ¿Qué pides, viajero?*'
    }
  ]);

  const handleQuickAction = (actionText) => {
    executeAction(actionText);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!inputAction.trim()) return;
    executeAction(inputAction);
    setInputAction('');
  };

  const executeAction = async (action) => {
    if (isRolling) return;
    setIsRolling(true);
    const dieResult = rollDie(20, { silent: true });

    // 3D die (plays its own sounds, including critical / fumble stingers)
    await animateRoll({ sides: 20, value: dieResult });

    setLastRoll(dieResult);
    setIsRolling(false);
    let duncanReaction = '';

    if (action.includes('cerveza') || action.includes('fuerte')) {
      tavernAudio.playTankardClink();
      duncanReaction = `—*¡Esa es la actitud!* (Duncan desliza un tarro de bronce con líquido borboteante que quema la vista). *Esto lo destilaron en las minas enanas de Karak. Si sobrevives al primer trago, tu tirada D20 fue un ${dieResult}. Tienes agallas, forastero.*`;
    } else if (action.includes('daga') || action.includes('amenazar')) {
      if (dieResult >= 12) {
        duncanReaction = `[🎲 D20: **${dieResult}** - Intimidación pasable] 
Duncan ni parpadea, pero dos guardaespaldas en la esquina tocan las empuñaduras de sus garrotes.
—*Tranquilo con ese hierro, filo-fácil. El último que amenazó esta barra acabó sirviendo de abono para las calabazas del huerto. Guarda eso o llama a tus amigos.*`;
      } else {
        tavernAudio.playCritFail();
        duncanReaction = `[🎲 D20: **${dieResult}** - Pifia social] 
Duncan agarra una jarra de peltre vacía y la estampa contra la madera con un sonido que hace callar a la taberna entera.
—*¿Amenazarme a MÍ con ese tenedor de mantequilla? Muchacho, te hace falta más nivel y menos orgullo. Te perdono la vida solo porque pagas la próxima ronda.*`;
      }
    } else if (action.includes('encapuchado') || action.includes('fondo')) {
      duncanReaction = `[🎲 D20: **${dieResult}** - Percepción]
Duncan se inclina sobre la barra y murmura entre dientes:
—*No mires directamente, idiota. Lleva el blasón del Círculo de la Niebla. Dicen que ofrece 50 monedas de oro por llevar un paquete sellado al viejo molino... aunque nadie que haya aceptado el trabajo ha vuelto a por el desayuno.*`;
    } else {
      // Generic action
      if (dieResult === 20) {
        duncanReaction = `[🎲 D20: **20 ¡ÉXITO CRÍTICO!** 🔥]
—*¡Diablos benditos!* (La pipa de Duncan casi se le cae de la boca mientras todos en la taberna contienen el aliento). *No veía a nadie ejecutar eso con tanta maestría desde los tiempos de la Gran Cruzada. Tienes mi respeto, chaval.*`;
      } else if (dieResult === 1) {
        duncanReaction = `[🎲 D20: **1 ¡PIFIA TOTAL!** 💀]
Un resbalón épico contra el suelo encerado con grasa animal. Duncan se limpia una lágrima de la risa.
—*¡Por favor, que alguien le dé a este aventurero un casco antes de que se abra la cabeza con su propia sombra!*`;
      } else if (dieResult >= 10) {
        duncanReaction = `[🎲 D20: **${dieResult}** - Éxito estándar]
—*Aceptable. Se nota que no es tu primer día fuera de la muralla de la ciudad.* (Duncan asiente aprobando tu acción y vuelve a llenar su pipa con tabaco aromatizado). *En la aventura completa podrás usar tus propios hechizos y dados.*`;
      } else {
        duncanReaction = `[🎲 D20: **${dieResult}** - Fallo menor]
—*Casi, pero te faltó decisión. En el mundo real allá afuera, una tirada como esa te habría costado un escudo o un par de muelas.*`;
      }
    }

    setStoryFeed(prev => [
      ...prev,
      { sender: 'player', text: action },
      { sender: 'duncan', text: duncanReaction }
    ]);
  };

  return (
    <section className="py-16 bg-[#0c0a0f] border-y border-amber-950/50 relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pruébalo en Vivo Aquí Mismo</span>
          </div>
          <h2 className="font-cinzel text-3xl sm:text-4xl font-bold text-stone-100">
            Haz Tu Primera Jugada en la Barra
          </h2>
          <p className="mt-2 text-stone-400 text-sm sm:text-base max-w-xl mx-auto">
            Interactúa con Maese Duncan en tiempo real. Escribe lo que quieras o prueba los botones rápidos:
          </p>
        </div>

        {/* Tavern interactive console */}
        <div className="rounded-2xl bg-[#131018] border-2 border-amber-900/40 shadow-2xl overflow-hidden flex flex-col">
          
          {/* Header Bar */}
          <div className="px-5 py-3.5 bg-[#1a1522] border-b border-amber-900/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-950 border border-amber-600/50 flex items-center justify-center text-xl shadow-inner">
                🧔‍♂️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-cinzel font-bold text-amber-200 text-sm">Maese Duncan</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-mono">
                    ONLINE (DM)
                  </span>
                </div>
                <p className="text-[11px] text-stone-400">Veterano del Grifo Tuerto & Dungeon Master</p>
              </div>
            </div>

            {/* Quick Die Display */}
            <div className="flex items-center gap-2">
              {lastRoll && (
                <div className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs flex items-center gap-1.5 ${
                  lastRoll === 20 ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' :
                  lastRoll === 1 ? 'bg-red-950/80 border-red-500 text-red-300' :
                  'bg-stone-850 border-amber-600/40 text-amber-300'
                }`}>
                  <Dice5 className={`w-3.5 h-3.5 ${isRolling ? 'animate-spin' : ''}`} />
                  <span>D20: {lastRoll}</span>
                </div>
              )}
            </div>
          </div>

          {/* Conversation stream */}
          <div className="p-5 space-y-4 max-h-[360px] overflow-y-auto bg-[radial-gradient(circle_at_top,_#181320_0%,_#100d14_100%)]">
            {storyFeed.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}
              >
                {(msg.sender === 'duncan' || msg.sender === 'greg') && (
                  <div className="w-8 h-8 rounded-full bg-amber-900/60 border border-amber-600/30 flex items-center justify-center text-sm shrink-0">
                    🧔‍♂️
                  </div>
                )}
                
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.sender === 'player'
                      ? 'bg-amber-600 text-stone-950 font-medium ml-auto rounded-tr-none shadow-md shadow-amber-600/20'
                      : 'bg-[#1b1723] text-stone-200 border border-amber-900/30 rounded-tl-none font-serif shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-line"><RichText text={msg.text} /></p>
                </div>
              </div>
            ))}

            {isRolling && (
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400 animate-pulse pl-11">
                <Dice5 className="w-4 h-4 animate-spin" />
                <span>Maese Duncan está rodando los dados tras la barra...</span>
              </div>
            )}
          </div>

          {/* Quick Action Chips */}
          <div className="px-5 py-3 bg-[#15111c] border-t border-amber-950/50 flex flex-wrap gap-2 text-xs">
            <span className="text-stone-400 font-mono text-[11px] self-center mr-1">Prueba rápida:</span>
            <button
              onClick={() => handleQuickAction('🍺 Pedirle a Duncan la cerveza más fuerte')}
              className="px-3 py-1.5 rounded-lg bg-stone-850 hover:bg-stone-800 border border-stone-700/60 hover:border-amber-500/50 text-stone-300 hover:text-amber-300 transition-all"
            >
              🍺 Cerveza fuerte
            </button>
            <button
              onClick={() => handleQuickAction('🔍 Mirar discretamente al encapuchado del fondo')}
              className="px-3 py-1.5 rounded-lg bg-stone-850 hover:bg-stone-800 border border-stone-700/60 hover:border-amber-500/50 text-stone-300 hover:text-amber-300 transition-all"
            >
              🔍 Vigilar al encapuchado
            </button>
            <button
              onClick={() => handleQuickAction('🗡️ Desenfundar la daga y amenazar a la taberna')}
              className="px-3 py-1.5 rounded-lg bg-stone-850 hover:bg-stone-800 border border-stone-700/60 hover:border-red-500/50 text-stone-300 hover:text-red-300 transition-all"
            >
              🗡️ Armar bronca
            </button>
          </div>

          {/* Input prompt */}
          <form onSubmit={handleCustomSubmit} className="p-4 bg-[#120f18] border-t border-amber-900/30 flex gap-2">
            <input
              type="text"
              value={inputAction}
              onChange={(e) => setInputAction(e.target.value)}
              placeholder="Escribe cualquier acción (ej: 'Salto sobre la mesa y pido un barril de hidromiel')..."
              className="flex-1 bg-[#1a1622] border border-amber-900/40 rounded-xl px-4 py-2.5 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isRolling || !inputAction.trim()}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-bold text-sm shadow-md transition-all flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>

          {/* Direct jump to full campaign */}
          <div className="px-5 py-3 bg-[#0f0c14] border-t border-amber-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-stone-400">
              ¿Listo para crear tu ficha con raza, clase, mapa interactivo y dados 3D?
            </span>
            <button
              onClick={onEnterFullTavern}
              className="font-bold text-amber-400 hover:text-amber-300 underline underline-offset-4 flex items-center gap-1"
            >
              <span>Abrir la Consola de Campaña Completa</span>
              <span>→</span>
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}
