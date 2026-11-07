import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Users, Settings, ArrowLeft, Dice5, Compass, User, Sparkles, BookOpen, Download, Check, AlertTriangle } from 'lucide-react';
import PartyPanel from './game/PartyPanel';
import StoryStream from './game/StoryStream';
import WorldMapPanel from './game/WorldMapPanel';
import DiceRollerTray from './game/DiceRollerTray';
import { PRESET_WORLDS, PRESET_CHARACTERS } from '../data/gameData';
import { generateDMResponse, rollCheckWithStat, getStoredGeminiKeys } from '../utils/gameEngine';
import { 
  saveCampaign, 
  createNewCampaign, 
  getCampaignById, 
  getActiveCampaignId, 
  exportCampaignAsJson,
  getLastSaveError,
  isQuotaError
} from '../utils/campaignStorage';
import { tavernAudio } from '../utils/audio';

export default function TavernApp({
  activeCampaign = null,
  activeWorld = PRESET_WORLDS[0],
  activeCharacter = PRESET_CHARACTERS[0],
  onBackToLanding,
  onOpenInvite,
  onOpenCharacterCreator,
  onOpenSettings,
  onOpenGeminiConnect,
  onOpenCampaigns
}) {
  // Campaign ID & metadata
  const [currentCampaignId, setCurrentCampaignId] = useState(() => {
    if (activeCampaign?.id) return activeCampaign.id;
    const storedId = getActiveCampaignId();
    if (storedId && getCampaignById(storedId)) return storedId;
    return null;
  });

  const [campaignTitle, setCampaignTitle] = useState(() => {
    if (activeCampaign?.title) return activeCampaign.title;
    if (currentCampaignId) {
      const camp = getCampaignById(currentCampaignId);
      if (camp) return camp.title;
    }
    return `${activeCharacter?.name || 'Héroe'} en ${activeWorld?.name || 'la Taberna'}`;
  });

  const [world, setWorld] = useState(() => {
    if (activeCampaign?.world) return activeCampaign.world;
    if (currentCampaignId) {
      const camp = getCampaignById(currentCampaignId);
      if (camp?.world) return camp.world;
    }
    return activeWorld;
  });

  const [character, setCharacter] = useState(() => {
    if (activeCampaign?.character) return activeCampaign.character;
    if (currentCampaignId) {
      const camp = getCampaignById(currentCampaignId);
      if (camp?.character) return camp.character;
    }
    return activeCharacter;
  });

  const [isAudioActive, setIsAudioActive] = useState(false);
  const [mobileTab, setMobileTab] = useState('story'); // 'story' | 'party' | 'map'
  const [isGenerating, setIsGenerating] = useState(false);
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());

  const [suggestedActions, setSuggestedActions] = useState(() => {
    if (activeCampaign?.suggestedActions?.length > 0) return activeCampaign.suggestedActions;
    if (currentCampaignId) {
      const camp = getCampaignById(currentCampaignId);
      if (camp?.suggestedActions?.length > 0) return camp.suggestedActions;
    }
    return [
      'Preguntar a Maese Duncan por el encapuchado del rincón',
      'Pedir una jarra de cerveza negra para entrar en calor',
      'Revisar tu equipo y afilar la daga',
      'Salir de la taberna hacia el embarcadero de niebla'
    ];
  });

  const [messages, setMessages] = useState(() => {
    if (activeCampaign?.messages?.length > 0) return activeCampaign.messages;
    if (currentCampaignId) {
      const camp = getCampaignById(currentCampaignId);
      if (camp?.messages?.length > 0) return camp.messages;
    }
    return [
      {
        sender: 'duncan',
        text: activeWorld.initialStory,
        timestamp: 'Inicio de Campaña'
      }
    ];
  });

  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'error' | 'quota'

  // Guards against double-creation under React.StrictMode (effects run twice in dev)
  const campaignInitRef = useRef(false);
  // Skip prop-sync effects on first mount so a stored campaign isn't overwritten by default props
  // (compare with the previous prop value; a "first run" flag breaks under StrictMode's double effects)
  const prevActiveCharacterRef = useRef(activeCharacter);
  const prevActiveWorldRef = useRef(activeWorld);

  // Ensure campaign is initialized and stored
  useEffect(() => {
    if (campaignInitRef.current) return;
    campaignInitRef.current = true;
    if (!currentCampaignId) {
      const newCamp = createNewCampaign({
        world,
        character,
        title: campaignTitle
      });
      if (newCamp) {
        setCurrentCampaignId(newCamp.id);
      }
    }
    // Run once on mount only: creates the campaign from the initial state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When activeCampaign prop changes from modal
  useEffect(() => {
    if (activeCampaign) {
      setCurrentCampaignId(activeCampaign.id);
      setCampaignTitle(activeCampaign.title);
      setWorld(activeCampaign.world);
      setCharacter(activeCampaign.character);
      setMessages(activeCampaign.messages || []);
      if (activeCampaign.suggestedActions?.length > 0) {
        setSuggestedActions(activeCampaign.suggestedActions);
      }
    }
  }, [activeCampaign]);

  // Keep character synced if activeCharacter prop changes (e.g. Character Creator),
  // also inside an active campaign: the new hero replaces the campaign's character.
  useEffect(() => {
    if (prevActiveCharacterRef.current === activeCharacter) return;
    prevActiveCharacterRef.current = activeCharacter;
    if (activeCharacter) {
      setCharacter(activeCharacter);
    }
  }, [activeCharacter]);

  // Keep world synced if activeWorld prop changes from modal
  useEffect(() => {
    if (prevActiveWorldRef.current === activeWorld) return;
    prevActiveWorldRef.current = activeWorld;
    if (activeWorld && !activeCampaign) {
      setWorld(activeWorld);
    }
    // Only react to activeWorld prop changes; activeCampaign is read as a guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorld]);

  // Auto-save campaign changes to localStorage
  useEffect(() => {
    if (!currentCampaignId) return;
    const saved = saveCampaign({
      id: currentCampaignId,
      title: campaignTitle,
      world,
      character,
      messages,
      suggestedActions
    });
    if (saved) {
      setSaveStatus('saved');
    } else {
      setSaveStatus(isQuotaError(getLastSaveError()) ? 'quota' : 'error');
    }
  }, [messages, character, world, campaignTitle, currentCampaignId, suggestedActions]);

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
        
        {/* Left: Back & Campaign Grimorio Switcher */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Portal</span>
          </button>

          <div className="h-4 w-px bg-stone-800 hidden sm:block" />

          {/* Grimorio Button */}
          <button
            onClick={onOpenCampaigns}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1a1523] hover:bg-stone-800 border border-amber-900/50 text-amber-200 hover:text-amber-300 text-xs font-cinzel font-bold transition-all shadow-sm"
            title="Abrir Grimorio de Campañas guardadas"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Grimorio:</span>
            <span className="truncate max-w-[120px] sm:max-w-[170px]">{campaignTitle}</span>
          </button>

          {/* Auto-save status badge */}
          {saveStatus === 'saved' ? (
            <div 
              className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-emerald-400/90 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40"
              title="Tu progreso se guarda automáticamente en el almacenamiento local de tu navegador"
            >
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Guardado</span>
            </div>
          ) : (
            <button
              onClick={() => exportCampaignAsJson(currentCampaignId)}
              className="flex items-center gap-1 text-[11px] font-mono text-red-300 bg-red-950/50 px-2 py-0.5 rounded border border-red-800/60 animate-pulse"
              title={saveStatus === 'quota'
                ? 'El almacenamiento del navegador está lleno: el progreso NO se está guardando. Exporta la campaña y borra partidas antiguas en el Grimorio.'
                : 'No se pudo guardar el progreso en el navegador. Exporta la campaña para no perderla.'}
            >
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>{saveStatus === 'quota' ? 'Almacenamiento lleno' : 'Error al guardar'}</span>
            </button>
          )}
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
          {/* Quick Export Active Campaign Button */}
          <button
            onClick={() => exportCampaignAsJson(currentCampaignId)}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-emerald-400 transition-colors"
            title="Exportar esta campaña actual como archivo .json"
          >
            <Download className="w-4 h-4" />
          </button>

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
