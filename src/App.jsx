import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import LiveTavernDemo from './components/LiveTavernDemo';
import Features from './components/Features';
import WorldsShowcase from './components/WorldsShowcase';
import Faq from './components/Faq';
import Footer from './components/Footer';
import BackupReminder from './components/BackupReminder';
import DiceOverlay from './components/DiceOverlay';
import OpenedOnce from './components/OpenedOnce';
import LoadingScreen from './components/LoadingScreen';
import { onlineConfig } from './online/transport';
import { normalizeCode } from './online/room';
import { storedPlayerName, storePlayerName } from './online/playerName';
import { PRESET_WORLDS, PRESET_CHARACTERS } from './data/gameData';
import { getStoredGeminiKeys } from './utils/geminiKeys';
import { lazyWithPreload, whenIdle } from './utils/lazyWithPreload';
import {
  readSavedCampaigns,
  readSavedCampaign,
  getActiveCampaignId,
  setActiveCampaignId
} from './utils/campaignIndex';

// Everything below is loaded on demand, so the landing page opens fast (above
// all on a phone). The game screen is preloaded when the player is about to
// open it; each window is loaded the first time it is opened.
const GameScreen = lazyWithPreload(() => import('./components/GameScreen'));
const InviteModal = lazy(() => import('./components/InviteModal'));
const WorldForgeModal = lazy(() => import('./components/WorldForgeModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const GeminiConnectModal = lazy(() => import('./components/GeminiConnectModal'));
const CampaignsModal = lazy(() => import('./components/CampaignsModal'));
const WorldSavesModal = lazy(() => import('./components/WorldSavesModal'));
const JoinRoomModal = lazy(() => import('./components/online/JoinRoomModal'));
// Only needed when starting a new campaign: kept out of the initial bundle
const CharacterWizard = lazy(() => import('./components/wizard/CharacterWizard'));
const PartySetup = lazy(() => import('./components/wizard/PartySetup'));
// The combat simulator is loaded only when opened
const CombatSimulator = lazy(() => import('./components/simulator/CombatSimulator'));
// A player's table in someone else's online room
const GuestTable = lazyWithPreload(() => import('./components/online/GuestTable'));
// Starting a campaign needs the party and the saving rules (part of the game screen)
const loadCampaignTools = () => Promise.all([import('./utils/party'), import('./utils/campaignStorage'), import('./utils/origins')]);

// A shared link: ?sala=CODE opens the "join" window with the code filled in
const linkedRoom = () => {
  try {
    return normalizeCode(new URLSearchParams(window.location.search).get('sala'));
  } catch {
    return '';
  }
};

export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'app' | 'guest'
  const [activeWorld, setActiveWorld] = useState(PRESET_WORLDS[0]);
  const [activeCharacter, setActiveCharacter] = useState(PRESET_CHARACTERS[0]);
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());
  
  // Persistent Campaign State
  // Read raw here (see campaignIndex.js): the game screen brings it up to date
  const [activeCampaign, setActiveCampaign] = useState(() => readSavedCampaign(getActiveCampaignId()));
  const [campaignsCount, setCampaignsCount] = useState(() => readSavedCampaigns().length);

  // Modals state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isWorldForgeOpen, setIsWorldForgeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGeminiConnectOpen, setIsGeminiConnectOpen] = useState(false);
  const [isCampaignsOpen, setIsCampaignsOpen] = useState(false);
  const [worldSavesTarget, setWorldSavesTarget] = useState(null); // world whose save slots are shown
  // New campaign waiting for its party: { world, title, members, wizard } (the wizard is open while `wizard`)
  const [pendingCampaign, setPendingCampaign] = useState(null);
  // Combat simulator open: { snapshot?, campaignId? } (it never changes a campaign)
  const [simulator, setSimulator] = useState(null);
  // Online: the "join" window (with the code of a shared link) and the room joined as a player
  const onlineKind = onlineConfig().kind;
  const [joinCode, setJoinCode] = useState(() => linkedRoom());
  const [isJoinOpen, setIsJoinOpen] = useState(() => Boolean(linkedRoom()));
  const [guestRoom, setGuestRoom] = useState(null); // { code, name }

  const refreshCampaignsCount = () => {
    setCampaignsCount(readSavedCampaigns().length);
  };

  // Choosing a world opens its save slots instead of starting right away
  const handleSelectWorld = (world) => {
    setWorldSavesTarget(world);
  };

  // Every new campaign starts by creating its hero
  const handleStartNewInWorld = (world, title = '') => {
    setWorldSavesTarget(null);
    setIsCampaignsOpen(false);
    setPendingCampaign({ world, title, members: [], wizard: true });
  };

  const handleCreateCustomWorld = (customWorld) => {
    handleStartNewInWorld(customWorld);
  };

  // A hero made with the wizard joins the party being formed
  const handleHeroCreated = (character) => {
    setPendingCampaign(prev => ({ ...prev, members: [...prev.members, character], wizard: false }));
  };

  // The party is ready: the campaign starts
  const startingRef = useRef(false);
  // `start`: how the story starts (see PartySetup): together, or each one from their origin zone
  const handlePartyReady = async (list, start = {}) => {
    if (startingRef.current) return;
    startingRef.current = true;
    const { world, title } = pendingCampaign;
    let tools;
    try {
      tools = await loadCampaignTools();
    } catch {
      startingRef.current = false;
      window.alert('No se pudo cargar la partida. Comprueba la conexión e inténtalo de nuevo.');
      return;
    }
    startingRef.current = false;
    const [{ createParty }, { createNewCampaign }, { startFromOrigins, START_MODES }] = tools;
    const apart = start.mode === START_MODES.origins ? startFromOrigins(world, list, start.choices, start.zones) : null;
    const party = apart ? apart.party : createParty(list);
    const character = list[0];
    const names = list.map(m => m.name);
    const newCamp = createNewCampaign({
      world: apart ? apart.world : world,
      party,
      ...(apart ? { messages: apart.messages, suggestedActions: apart.suggestedActions } : {}),
      title: title.trim() || `${names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : character.name} — ${world.name}`
    });
    setPendingCampaign(null);
    if (!newCamp) {
      window.alert('No se pudo guardar la campaña: el almacenamiento del navegador está lleno. Exporta o borra partidas antiguas en el Grimorio.');
      return;
    }
    setActiveWorld(newCamp.world);
    setActiveCharacter(character);
    setActiveCampaign(newCamp);
    refreshCampaignsCount();
    setCurrentView('app');
  };

  const handleSelectCampaign = (campaign) => {
    setActiveCampaign(campaign);
    if (campaign.world) setActiveWorld(campaign.world);
    if (campaign.character) setActiveCharacter(campaign.character);
    refreshCampaignsCount();
    setCurrentView('app');
  };

  // "Play" resumes the last campaign; without one, the player picks a world first
  const handleStartGame = () => {
    const activeId = getActiveCampaignId();
    const camp = readSavedCampaign(activeId);
    if (camp) {
      handleSelectCampaign(camp);
      return;
    }
    setCurrentView('landing');
    setTimeout(() => document.getElementById('worlds')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleClearProgress = async () => {
    // "Reiniciar Progreso" resets the current chronicle: drop the active campaign
    // (other saved campaigns in the Grimorio are kept).
    // Gemini API keys are intentionally kept.
    const activeId = getActiveCampaignId() || activeCampaign?.id;
    if (activeId) {
      const { deleteCampaign } = await import('./utils/campaignStorage');
      deleteCampaign(activeId);
    }
    setActiveCampaignId(null);
    window.location.reload();
  };

  // The campaign «Jugar» resumes (read on each render of the landing page: it is cheap and always current)
  const resumable = currentView === 'landing' ? readSavedCampaign(getActiveCampaignId()) : null;
  const hasResumable = Boolean(resumable);

  // With a campaign to resume, «Jugar» opens the game screen almost surely:
  // download it while the player reads the landing page
  useEffect(() => {
    if (!hasResumable) return undefined;
    return whenIdle(() => GameScreen.preload());
  }, [hasResumable]);

  // Creating a party ends in the game screen: get it ready meanwhile
  const isCreatingParty = Boolean(pendingCampaign);
  useEffect(() => {
    if (!isCreatingParty) return undefined;
    return whenIdle(() => {
      GameScreen.preload();
      loadCampaignTools().catch(() => {});
    });
  }, [isCreatingParty]);

  // A shared room link opens the player's table next
  useEffect(() => {
    if (!isJoinOpen) return undefined;
    return whenIdle(() => GuestTable.preload());
  }, [isJoinOpen]);

  return (
    <div className="min-h-screen bg-[#0b090e] text-[#e8ded2] flex flex-col font-sans">
      
      {currentView === 'landing' ? (
        <>
          <Navbar
            setView={setCurrentView}
            onEnterTavern={handleStartGame}
            onOpenInvite={() => setIsInviteOpen(true)}
            onOpenWorldForge={() => setIsWorldForgeOpen(true)}
            onOpenGeminiConnect={() => setIsGeminiConnectOpen(true)}
            onOpenCampaigns={() => setIsCampaignsOpen(true)}
            onOpenSimulator={() => setSimulator({})}
            onOpenJoin={() => setIsJoinOpen(true)}
            campaignsCount={campaignsCount}
            keysCount={geminiKeys.length}
            canResume={Boolean(resumable)}
          />

          <main className="flex-1">
            <Hero
              onStartGame={handleStartGame}
              onScrollToWorlds={() => {
                const el = document.getElementById('worlds');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              resumeTitle={resumable?.title || null}
            />

            <LiveTavernDemo
              onEnterFullTavern={handleStartGame}
            />

            <Features />

            <WorldsShowcase
              onSelectWorld={handleSelectWorld}
              onOpenWorldForge={() => setIsWorldForgeOpen(true)}
            />

            <Faq />
          </main>

          <Footer onEnterTavern={handleStartGame} />

          {/* Only on the landing page, so it never interrupts a game */}
          <BackupReminder refreshKey={`${campaignsCount}-${currentView}`} />
        </>
      ) : currentView === 'guest' && guestRoom ? (
        <Suspense fallback={<LoadingScreen text="Entrando en la sala…" />}>
          <GuestTable
            code={guestRoom.code}
            name={guestRoom.name}
            kind={onlineKind}
            onLeave={() => {
              setGuestRoom(null);
              setCurrentView('landing');
            }}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <GameScreen
            activeCampaign={activeCampaign}
            activeWorld={activeWorld}
            activeCharacter={activeCharacter}
            onBackToLanding={() => {
              refreshCampaignsCount();
              setCurrentView('landing');
            }}
            onOpenInvite={() => setIsInviteOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenGeminiConnect={() => setIsGeminiConnectOpen(true)}
            onOpenCampaigns={() => setIsCampaignsOpen(true)}
            onOpenSimulator={options => setSimulator(options || {})}
          />
        </Suspense>
      )}

      {simulator && (
        <Suspense fallback={null}>
          <CombatSimulator
            initialSnapshot={simulator.snapshot || null}
            campaignId={simulator.campaignId || null}
            onClose={() => setSimulator(null)}
          />
        </Suspense>
      )}

      {/* 3D dice stage (above everything, only visible while rolling) */}
      <DiceOverlay />

      {/* Global Modals */}
      <OpenedOnce when={Boolean(worldSavesTarget)}>
        <WorldSavesModal
          isOpen={!!worldSavesTarget}
          world={worldSavesTarget}
          onClose={() => {
            setWorldSavesTarget(null);
            refreshCampaignsCount();
          }}
          onLoadCampaign={(campaign) => {
            setWorldSavesTarget(null);
            handleSelectCampaign(campaign);
          }}
          onCreateNew={() => handleStartNewInWorld(worldSavesTarget)}
        />
      </OpenedOnce>

      <OpenedOnce when={isCampaignsOpen}>
        <CampaignsModal
          isOpen={isCampaignsOpen}
          onClose={() => {
            setIsCampaignsOpen(false);
            refreshCampaignsCount();
          }}
          activeCampaignId={activeCampaign?.id}
          onSelectCampaign={handleSelectCampaign}
          onStartNewCampaign={handleStartNewInWorld}
        />
      </OpenedOnce>

      <OpenedOnce when={isInviteOpen}>
        <InviteModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          onOpenCampaigns={() => setIsCampaignsOpen(true)}
        />
      </OpenedOnce>

      <OpenedOnce when={isJoinOpen}>
        <JoinRoomModal
          key={joinCode}
          isOpen={isJoinOpen}
          kind={onlineKind}
          initialCode={joinCode}
          initialName={storedPlayerName()}
          onClose={() => {
            setIsJoinOpen(false);
            setJoinCode('');
          }}
          onJoin={({ code, name }) => {
            storePlayerName(name);
            setIsJoinOpen(false);
            setGuestRoom({ code, name });
            setCurrentView('guest');
          }}
        />
      </OpenedOnce>

      <OpenedOnce when={isWorldForgeOpen}>
        <WorldForgeModal
          isOpen={isWorldForgeOpen}
          onClose={() => setIsWorldForgeOpen(false)}
          onCreateWorld={handleCreateCustomWorld}
        />
      </OpenedOnce>

      {pendingCampaign && (
        <Suspense fallback={null}>
          {pendingCampaign.wizard ? (
            <CharacterWizard
              world={pendingCampaign.world}
              onComplete={handleHeroCreated}
              completeLabel={pendingCampaign.members.length ? 'Añadir al grupo' : 'Continuar'}
              onCancel={() => setPendingCampaign(prev => (prev.members.length ? { ...prev, wizard: false } : null))}
            />
          ) : (
            <PartySetup
              world={pendingCampaign.world}
              members={pendingCampaign.members}
              onAddWithWizard={() => setPendingCampaign(prev => ({ ...prev, wizard: true }))}
              onChange={members => setPendingCampaign(prev => ({ ...prev, members }))}
              onStart={handlePartyReady}
              onCancel={() => setPendingCampaign(null)}
            />
          )}
        </Suspense>
      )}

      <OpenedOnce when={isSettingsOpen}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onClearData={handleClearProgress}
          onOpenGeminiConnect={() => {
            setIsSettingsOpen(false);
            setIsGeminiConnectOpen(true);
          }}
          onOpenCampaigns={() => {
            setIsSettingsOpen(false);
            setIsCampaignsOpen(true);
          }}
        />
      </OpenedOnce>

      <OpenedOnce when={isGeminiConnectOpen}>
        <GeminiConnectModal
          isOpen={isGeminiConnectOpen}
          onClose={() => setIsGeminiConnectOpen(false)}
          onKeysUpdated={(keys) => setGeminiKeys(keys)}
        />
      </OpenedOnce>

    </div>
  );
}
