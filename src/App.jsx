import React, { useState, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import LiveTavernDemo from './components/LiveTavernDemo';
import Features from './components/Features';
import WorldsShowcase from './components/WorldsShowcase';
import Faq from './components/Faq';
import Footer from './components/Footer';
import TavernApp from './components/TavernApp';
import InviteModal from './components/InviteModal';
import WorldForgeModal from './components/WorldForgeModal';
import SettingsModal from './components/SettingsModal';
import GeminiConnectModal from './components/GeminiConnectModal';
import CampaignsModal from './components/CampaignsModal';
import WorldSavesModal from './components/WorldSavesModal';
import BackupReminder from './components/BackupReminder';
import DiceOverlay from './components/DiceOverlay';
import { PRESET_WORLDS, PRESET_CHARACTERS } from './data/gameData';
import { getStoredGeminiKeys } from './utils/gameEngine';
import { 
  getAllCampaigns, 
  getActiveCampaignId, 
  getCampaignById, 
  createNewCampaign,
  deleteCampaign,
  setActiveCampaignId
} from './utils/campaignStorage';

// Only needed when starting a new campaign: kept out of the initial bundle
const CharacterWizard = lazy(() => import('./components/wizard/CharacterWizard'));

export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'app'
  const [activeWorld, setActiveWorld] = useState(PRESET_WORLDS[0]);
  const [activeCharacter, setActiveCharacter] = useState(PRESET_CHARACTERS[0]);
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());
  
  // Persistent Campaign State
  const [activeCampaign, setActiveCampaign] = useState(() => {
    const activeId = getActiveCampaignId();
    return activeId ? getCampaignById(activeId) : null;
  });
  const [campaignsCount, setCampaignsCount] = useState(() => getAllCampaigns().length);

  // Modals state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isWorldForgeOpen, setIsWorldForgeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGeminiConnectOpen, setIsGeminiConnectOpen] = useState(false);
  const [isCampaignsOpen, setIsCampaignsOpen] = useState(false);
  const [worldSavesTarget, setWorldSavesTarget] = useState(null); // world whose save slots are shown
  // New campaign waiting for its hero: { world, title } while the character wizard is open
  const [pendingCampaign, setPendingCampaign] = useState(null);

  const refreshCampaignsCount = () => {
    setCampaignsCount(getAllCampaigns().length);
  };

  // Choosing a world opens its save slots instead of starting right away
  const handleSelectWorld = (world) => {
    setWorldSavesTarget(world);
  };

  // Every new campaign starts by creating its hero
  const handleStartNewInWorld = (world, title = '') => {
    setWorldSavesTarget(null);
    setIsCampaignsOpen(false);
    setPendingCampaign({ world, title });
  };

  const handleCreateCustomWorld = (customWorld) => {
    handleStartNewInWorld(customWorld);
  };

  const handleHeroCreated = (character) => {
    const { world, title } = pendingCampaign;
    const newCamp = createNewCampaign({
      world,
      character,
      title: title.trim() || `${character.name} — ${world.name}`
    });
    setPendingCampaign(null);
    if (!newCamp) {
      window.alert('No se pudo guardar la campaña: el almacenamiento del navegador está lleno. Exporta o borra partidas antiguas en el Grimorio.');
      return;
    }
    setActiveWorld(world);
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
    const camp = activeId ? getCampaignById(activeId) : null;
    if (camp) {
      handleSelectCampaign(camp);
      return;
    }
    setCurrentView('landing');
    setTimeout(() => document.getElementById('worlds')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleClearProgress = () => {
    // "Reiniciar Progreso" resets the current chronicle: drop the active campaign
    // (other saved campaigns in the Grimorio are kept).
    // Gemini API keys are intentionally kept.
    const activeId = getActiveCampaignId() || activeCampaign?.id;
    if (activeId) deleteCampaign(activeId);
    setActiveCampaignId(null);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0b090e] text-[#e8ded2] flex flex-col font-sans">
      
      {currentView === 'landing' ? (
        <>
          <Navbar
            currentView={currentView}
            setView={setCurrentView}
            onEnterTavern={handleStartGame}
            onOpenInvite={() => setIsInviteOpen(true)}
            onOpenWorldForge={() => setIsWorldForgeOpen(true)}
            onOpenGeminiConnect={() => setIsGeminiConnectOpen(true)}
            onOpenCampaigns={() => setIsCampaignsOpen(true)}
            campaignsCount={campaignsCount}
            keysCount={geminiKeys.length}
          />

          <main className="flex-1">
            <Hero
              onStartGame={handleStartGame}
              onScrollToWorlds={() => {
                const el = document.getElementById('worlds');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenCampaigns={() => setIsCampaignsOpen(true)}
              campaignsCount={campaignsCount}
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

          <Footer
            onEnterTavern={handleStartGame}
            onOpenInvite={() => setIsInviteOpen(true)}
          />

          {/* Only on the landing page, so it never interrupts a game */}
          <BackupReminder refreshKey={`${campaignsCount}-${currentView}`} />
        </>
      ) : (
        <TavernApp
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
        />
      )}

      {/* 3D dice stage (above everything, only visible while rolling) */}
      <DiceOverlay />

      {/* Global Modals */}
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

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onOpenCampaigns={() => setIsCampaignsOpen(true)}
      />

      <WorldForgeModal
        isOpen={isWorldForgeOpen}
        onClose={() => setIsWorldForgeOpen(false)}
        onCreateWorld={handleCreateCustomWorld}
      />

      {pendingCampaign && (
        <Suspense fallback={null}>
          <CharacterWizard
            world={pendingCampaign.world}
            onComplete={handleHeroCreated}
            onCancel={() => setPendingCampaign(null)}
          />
        </Suspense>
      )}

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

      <GeminiConnectModal
        isOpen={isGeminiConnectOpen}
        onClose={() => setIsGeminiConnectOpen(false)}
        onKeysUpdated={(keys) => setGeminiKeys(keys)}
      />

    </div>
  );
}
