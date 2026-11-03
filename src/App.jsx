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
import { PRESET_WORLDS, PRESET_CHARACTERS } from './data/gameData';
import { getStoredGeminiKeys } from './utils/gameEngine';

export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'app'
  const [activeWorld, setActiveWorld] = useState(PRESET_WORLDS[0]);
  const [activeCharacter, setActiveCharacter] = useState(PRESET_CHARACTERS[0]);
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());
  
  // Modals state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isWorldForgeOpen, setIsWorldForgeOpen] = useState(false);
  const [isCharacterCreatorOpen, setIsCharacterCreatorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGeminiConnectOpen, setIsGeminiConnectOpen] = useState(false);

  const handleSelectWorld = (world) => {
    setActiveWorld(world);
    setCurrentView('app');
  };

  const handleCreateCustomWorld = (customWorld) => {
    setActiveWorld(customWorld);
    setCurrentView('app');
  };

  const handleClearProgress = () => {
    localStorage.removeItem('tavern_gemini_key');
    localStorage.removeItem('tavern_gemini_keys');
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
            keysCount={geminiKeys.length}
          />

          <main className="flex-1">
            <Hero
              onStartGame={() => setCurrentView('app')}
              onScrollToWorlds={() => {
                const el = document.getElementById('worlds');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            />

            <LiveTavernDemo
              onEnterFullTavern={() => setCurrentView('app')}
            />

            <Features />

            <WorldsShowcase
              onSelectWorld={handleSelectWorld}
              onOpenWorldForge={() => setIsWorldForgeOpen(true)}
            />

            <Testimonials />
          </main>

          <Footer
            onEnterTavern={() => setCurrentView('app')}
            onOpenInvite={() => setIsInviteOpen(true)}
          />
        </>
      ) : (
        <TavernApp
          activeWorld={activeWorld}
          activeCharacter={activeCharacter}
          onBackToLanding={() => setCurrentView('landing')}
          onOpenInvite={() => setIsInviteOpen(true)}
          onOpenCharacterCreator={() => setIsCharacterCreatorOpen(true)}
          onOpenWorldForge={() => setIsWorldForgeOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenGeminiConnect={() => setIsGeminiConnectOpen(true)}
        />
      )}

      {/* Global Modals */}
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
      />

      <GeminiConnectModal
        isOpen={isGeminiConnectOpen}
        onClose={() => setIsGeminiConnectOpen(false)}
        onKeysUpdated={(keys) => setGeminiKeys(keys)}
      />

    </div>
  );
}
