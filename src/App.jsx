import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import LiveTavernDemo from './components/LiveTavernDemo';
import Features from './components/Features';
import WorldsShowcase from './components/WorldsShowcase';
import Testimonials from './components/Testimonials';
import Footer from './components/Footer';
import TavernApp from './components/TavernApp';
import InviteModal from './components/InviteModal';
import WorldForgeModal from './components/WorldForgeModal';
import CharacterCreatorModal from './components/CharacterCreatorModal';
import SettingsModal from './components/SettingsModal';
import GeminiConnectModal from './components/GeminiConnectModal';
import CampaignsModal from './components/CampaignsModal';
import WorldSavesModal from './components/WorldSavesModal';
import BackupReminder from './components/BackupReminder';
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
  const [isCharacterCreatorOpen, setIsCharacterCreatorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGeminiConnectOpen, setIsGeminiConnectOpen] = useState(false);
  const [isCampaignsOpen, setIsCampaignsOpen] = useState(false);
  const [worldSavesTarget, setWorldSavesTarget] = useState(null); // world whose save slots are shown

  const refreshCampaignsCount = () => {
    setCampaignsCount(getAllCampaigns().length);
  };

  // Choosing a world opens its save slots instead of starting right away
  const handleSelectWorld = (world) => {
    setWorldSavesTarget(world);
  };

  const handleStartNewInWorld = (world) => {
    setWorldSavesTarget(null);
    setActiveWorld(world);
    const newCamp = createNewCampaign({
      world,
      character: activeCharacter,
      title: `${activeCharacter.name} — ${world.name}`
    });
    setActiveCampaign(newCamp);
    refreshCampaignsCount();
    setCurrentView('app');
  };

  const handleCreateCustomWorld = (customWorld) => {
    setActiveWorld(customWorld);
    const newCamp = createNewCampaign({
      world: customWorld,
      character: activeCharacter,
      title: `${activeCharacter.name} — ${customWorld.name}`
    });
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

  const handleStartGame = () => {
    // If we have an active campaign, resume it; otherwise use activeWorld & activeCharacter
    const activeId = getActiveCampaignId();
    if (activeId) {
      const camp = getCampaignById(activeId);
      if (camp) {
        setActiveCampaign(camp);
        if (camp.world) setActiveWorld(camp.world);
        if (camp.character) setActiveCharacter(camp.character);
      }
    }
    setCurrentView('app');
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

            <Testimonials />
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
          onOpenCharacterCreator={() => setIsCharacterCreatorOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenGeminiConnect={() => setIsGeminiConnectOpen(true)}
          onOpenCampaigns={() => setIsCampaignsOpen(true)}
        />
      )}

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
      />

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      <WorldForgeModal
        isOpen={isWorldForgeOpen}
        onClose={() => setIsWorldForgeOpen(false)}
        onCreateWorld={handleCreateCustomWorld}
      />

      <CharacterCreatorModal
        isOpen={isCharacterCreatorOpen}
        onClose={() => setIsCharacterCreatorOpen(false)}
        onSaveCharacter={(char) => {
          setActiveCharacter(char);
          setCurrentView('app');
        }}
      />

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
