import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Users, Settings, ArrowLeft, Dice5, Compass, User, Sparkles } from 'lucide-react';
import PartyPanel from './game/PartyPanel';
import StoryStream from './game/StoryStream';
import WorldMapPanel from './game/WorldMapPanel';
import DiceRollerTray from './game/DiceRollerTray';
import { PRESET_WORLDS, PRESET_CHARACTERS } from '../data/gameData';
import { generateDMResponse, rollCheckWithStat, getStoredGeminiKeys } from '../utils/gameEngine';
import { tavernAudio } from '../utils/audio';

export default function TavernApp({
  activeWorld = PRESET_WORLDS[0],
  activeCharacter = PRESET_CHARACTERS[0],
  onBackToLanding,
  onOpenInvite,
  onOpenCharacterCreator,
  onOpenWorldForge,
  onOpenSettings,
  onOpenGeminiConnect
}) {
  const [world, setWorld] = useState(activeWorld);
  const [character, setCharacter] = useState(activeCharacter);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [mobileTab, setMobileTab] = useState('story'); // 'story' | 'party' | 'map'
  const [isGenerating, setIsGenerating] = useState(false);
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());
  const [suggestedActions, setSuggestedActions] = useState([
    'Preguntar a Maese Duncan por el encapuchado del rincón',
    'Pedir una jarra de cerveza negra para entrar en calor',
    'Revisar tu equipo y afilar la daga',
    'Salir de la taberna hacia el embarcadero de niebla'
  ]);

  const [messages, setMessages] = useState(() => {
    return [
      {
        sender: 'duncan',
        text: world.initialStory,
        timestamp: 'Inicio de Campaña'
      }
    ];
  });

  // Keep character synced if prop changes
  useEffect(() => {
    if (activeCharacter) {
      setCharacter(activeCharacter);
    }
  }, [activeCharacter]);

  // Keep world synced if prop changes
  useEffect(() => {
    if (activeWorld) {
      setWorld(activeWorld);
      setMessages([
        {
          sender: 'duncan',
          text: activeWorld.initialStory,
          timestamp: 'Inicio de Campaña'
        }
      ]);
    }
  }, [activeWorld]);

  const toggleSound = () => {
    const newState = tavernAudio.toggleTavernAmbience();
    setIsAudioActive(newState);
  };

  // Main Action Dispatcher
  const handleSendAction = async (actionText) => {
    if (!actionText || isGenerating) return;

    // Add player's action to messages
    const newMsgList = [
      ...messages,
      {
        sender: 'player',
        text: actionText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    setMessages(newMsgList);
    setIsGenerating(true);

    try {
      const currentKeys = getStoredGeminiKeys();
      setGeminiKeys(currentKeys);

      const response = await generateDMResponse({
        playerAction: actionText,
        character,
        world,
        history: newMsgList,
        apiKeys: currentKeys
      });

      // Apply damage or gold consequences
      if (response.damageTaken > 0 || response.goldEarned > 0) {
        setCharacter(prev => ({
          ...prev,
          hp: Math.max(0, prev.hp - response.damageTaken),
          gold: prev.gold + response.goldEarned
        }));
      }

      setMessages(prev => [
        ...prev,
        {
          sender: 'duncan',
          text: response.text,
          source: response.source,
          keyIndex: response.keyIndex,
          totalKeys: response.totalKeys,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      if (response.suggestedActions) {
        setSuggestedActions(response.suggestedActions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // When rolling a stat check directly from character sheet
  const handleRollStatCheck = (statVal, statName) => {
    const check = rollCheckWithStat(statVal, statName);
    const textDesc = `Realizo una tirada de ${statName} [🎲 D20: ${check.rawRoll} (${check.modifier >= 0 ? `+${check.modifier}` : check.modifier}) = ${check.total} vs CD ${check.dc}].`;

    handleSendAction(textDesc);
  };

  // When ordering a drink from Duncan's tavern menu
  const handleOrderDrink = (drink) => {
    if (character.gold < drink.cost) return;

    setCharacter(prev => ({
      ...prev,
      gold: prev.gold - drink.cost,
      hp: Math.min(prev.maxHp, prev.hp + 4)
    }));

    handleSendAction(`Pido a Maese Duncan un/a "${drink.name}" (${drink.cost} po). ${drink.effect}`);
  };

  // When traveling to another node on the world map
  const handleTravelToNode = (node) => {
    setWorld(prev => ({
      ...prev,
      mapNodes: prev.mapNodes.map(n => ({
        ...n,
        status: n.id === node.id ? 'current' : n.status === 'current' ? 'discovered' : n.status
      }))
    }));

    handleSendAction(`El grupo decide abandonar la posición y viajar hacia: "${node.name}".`);
  };

  // When rolling from the floating tray
  const handleDiceRollToChat = (rollObj) => {
    setMessages(prev => [
      ...prev,
      {
        sender: 'system',
        text: `🎲 Tirada de dados: d${rollObj.sides} (${rollObj.raw}) ${rollObj.modifier >= 0 ? `+${rollObj.modifier}` : rollObj.modifier} = ${rollObj.total} ${rollObj.isNat20 ? '🔥 ¡ÉXITO CRÍTICO!' : rollObj.isNat1 ? '💀 ¡PIFIA!' : ''}`,
        roll: rollObj,
        timestamp: rollObj.timestamp
      }
    ]);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0b090e] overflow-hidden">
      
      {/* Top Application Bar */}
      <header className="h-14 bg-[#120f18] border-b border-amber-950/60 px-4 flex items-center justify-between shrink-0 z-30">
        
        {/* Left: Back & World Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Portal</span>
          </button>

          <div className="h-4 w-px bg-stone-800 hidden sm:block" />

          {/* World Selector Dropdown */}
          <select
            value={world.id}
            onChange={(e) => {
              const selected = PRESET_WORLDS.find(w => w.id === e.target.value);
              if (selected) {
                setWorld(selected);
                setMessages([{ sender: 'duncan', text: selected.initialStory, timestamp: 'Inicio de Campaña' }]);
              }
            }}
            className="bg-[#1a1523] border border-amber-900/40 text-amber-200 rounded-lg px-2.5 py-1 text-xs font-cinzel font-bold focus:outline-none"
          >
            {PRESET_WORLDS.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Center: Character Quick Switcher */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-[11px] font-mono text-stone-400">Héroe:</span>
          <select
            value={character.id}
            onChange={(e) => {
              const selectedChar = PRESET_CHARACTERS.find(c => c.id === e.target.value);
              if (selectedChar) setCharacter(selectedChar);
            }}
            className="bg-[#1a1523] border border-stone-800 text-stone-200 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none"
          >
            {PRESET_CHARACTERS.map(c => (
              <option key={c.id} value={c.id}>{c.avatar} {c.name} ({c.class})</option>
            ))}
          </select>
          <button
            onClick={onOpenCharacterCreator}
            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 ml-1"
          >
            + Crear
          </button>
        </div>

        {/* Right Utility Buttons */}
        <div className="flex items-center gap-2">
          {/* Gemini IA Connect / Party Key Pool Button */}
          <button
            onClick={onOpenGeminiConnect}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
              geminiKeys.length > 0
                ? 'bg-emerald-950/70 hover:bg-emerald-900/70 border-emerald-600/60 text-emerald-300'
                : 'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/40 text-amber-300'
            }`}
            title="Conectar o gestionar claves de Gemini de la Party"
          >
            <Sparkles className={`w-3.5 h-3.5 ${geminiKeys.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="hidden sm:inline">
              {geminiKeys.length > 0 ? `Gemini (${geminiKeys.length})` : 'Conectar IA Gratis'}
            </span>
          </button>

          {/* Audio toggle */}
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              isAudioActive
                ? 'bg-amber-600/20 border-amber-500/60 text-amber-300'
                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
            title="Activar o desactivar sonido ambiente de taberna"
          >
            {isAudioActive ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Invite friend button */}
          <button
            onClick={onOpenInvite}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-300 hover:text-amber-300 text-xs font-semibold transition-all"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invitar</span>
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            title="Ajustes de IA y Campaña"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </header>

      {/* Mobile Tab switcher (visible only on small screens) */}
      <div className="md:hidden flex border-b border-amber-950/60 bg-[#14101c] text-xs font-semibold">
        <button
          onClick={() => setMobileTab('story')}
          className={`flex-1 py-2 text-center border-b-2 ${
            mobileTab === 'story' ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-transparent text-stone-400'
          }`}
        >
          Crónica / DM
        </button>
        <button
          onClick={() => setMobileTab('party')}
          className={`flex-1 py-2 text-center border-b-2 ${
            mobileTab === 'party' ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-transparent text-stone-400'
          }`}
        >
          Ficha ({character.hp} HP)
        </button>
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-2 text-center border-b-2 ${
            mobileTab === 'map' ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-transparent text-stone-400'
          }`}
        >
          Mapa & Misiones
        </button>
      </div>

      {/* Main 3-Column Desktop Layout / Tabbed Mobile View */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Column: Party & Sheet (300px on desktop) */}
        <div className={`w-full md:w-80 lg:w-88 shrink-0 ${mobileTab === 'party' ? 'block' : 'hidden md:block'}`}>
          <PartyPanel
            character={character}
            onUpdateCharacter={setCharacter}
            onOrderDrink={handleOrderDrink}
            onOpenInvite={onOpenInvite}
            onOpenCharacterModal={onOpenCharacterCreator}
            onRollStatCheck={handleRollStatCheck}
          />
        </div>

        {/* Center Column: Story Stream (Flexible width) */}
        <div className={`flex-1 flex flex-col h-full overflow-hidden ${mobileTab === 'story' ? 'block' : 'hidden md:flex'}`}>
          <StoryStream
            messages={messages}
            isGenerating={isGenerating}
            suggestedActions={suggestedActions}
            character={character}
            world={world}
            onSendAction={handleSendAction}
            onOpenGeminiConnect={onOpenGeminiConnect}
            keysCount={geminiKeys.length}
          />
        </div>

        {/* Right Column: World Map & Factions (300px on desktop) */}
        <div className={`w-full md:w-80 lg:w-88 shrink-0 ${mobileTab === 'map' ? 'block' : 'hidden md:block'}`}>
          <WorldMapPanel
            world={world}
            onTravelToNode={handleTravelToNode}
          />
        </div>

      </div>

      {/* Floating 3D Dice Roller Tray */}
      <DiceRollerTray onSendRollToChat={handleDiceRollToChat} />

    </div>
  );
}
