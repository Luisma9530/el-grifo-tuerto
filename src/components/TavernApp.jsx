import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Volume2, VolumeX, Users, Settings, ArrowLeft, Download, AlertTriangle, FlaskConical, RotateCcw, BookOpen, Wifi, MoreHorizontal, ScrollText, Shield, Map as MapIcon, Swords } from 'lucide-react';
import MenuButton from './MenuButton';
import PartyPanel from './game/PartyPanel';
import StoryStream from './game/StoryStream';
import WorldMapPanel from './game/WorldMapPanel';
import { MobileTabBar, SideColumn } from './game/GameLayout';
import { PRESET_WORLDS, PRESET_CHARACTERS } from '../data/gameData';
import { generateDMResponse, rollCheck, rollDie, getStoredGeminiKeys, getModifierNumber } from '../utils/gameEngine';
import { castSpell, describeCast } from '../utils/spellcasting';
import {
  saveCampaign,
  createNewCampaign,
  getCampaignById,
  getActiveCampaignId,
  exportCampaignAsJson,
  getLastSaveError,
  isQuotaError,
  migrateCampaign
} from '../utils/campaignStorage';
import { tavernAudio } from '../utils/audio';
import { animateRoll, is3DDiceEnabled } from '../dice3d/controller';
import {
  createEncounter, runEnemyTurns, playerAction, describeEncounterResult, injuriesIn, currentHeroUid, addOpening, openingPending, describeSurprise
} from '../utils/encounter';
import { normalizeEquipment, limbFact } from '../utils/equipment';
import {
  checkModifiers, describeConditionChange, conditionFact, isIncapacitated, activeIds, conditionName, describeConditionsForPrompt
} from '../utils/conditions';
import { keyMoments, narrateMoment, MAX_MOMENTS, openingLine } from '../utils/combatNarration';
import { detectOpeningStrike, openingReady } from '../utils/surprise';
import { makeSnapshot, addSnapshot, setSnapshotResult, normalizeSnapshots } from '../utils/combatSnapshots';
import { canLevelUp, describeLevelUp, levelUpPlan } from '../utils/leveling';
import {
  historyForPrompt, needsSummary, coverageAfterSummary, addEvent, eventsForPrompt
} from '../utils/campaignMemory';
import { resolveAttack, describeAttack } from '../utils/combat';
import { skillModifier, getSkill } from '../utils/characterBuilder';
import {
  openShop, shopKey, currentNode, isAtTavern, shopsAt, buyItem, sellItem, describeTrade, describeShopsForPrompt, normalizeShops, SHOP_TYPES
} from '../utils/shops';
import { drinkPotion, healingDice } from '../utils/items';
import { generateLoot, describeLoot } from '../utils/loot';
import {
  normalizeQuests, applyQuestChanges, abandonQuest, describeQuestChange, questFact, unseenQuestCount
} from '../utils/quests';
import { huntChangesAfterVictory, withHuntTargets } from '../utils/localQuests';
import {
  createParty, activeSheet, memberSheet, memberSheets, updateMember, setActiveMember, mergeHeroes,
  addMember, removeMember, transferItem, describeCompanions, findMemberByName, partyLevel, MAX_PARTY, members as membersOf
} from '../utils/party';
import {
  restParty, finishFight, storyXp, payPartyReward, longRestCost, applySceneEffects, applySceneConditions, applySceneLimbs
} from '../utils/partyActions';
import { makeRecruitOffer, departingMember } from '../utils/recruit';
import { LOCAL_CONTROLLER } from '../utils/party';
import { onlineConfig, roomLink } from '../online/transport';
import { useHostRoom, wasOnline, storedPlayerName, storePlayerName } from '../online/useOnlineRoom';
import { buildSections } from '../online/snapshot';
import {
  ownerOf, controllerOf, canControl, playerName, claimCharacter, releaseCharacter, breakTie, closeVote, removePlayer, dequeueAction, enqueueAction
} from '../online/room';
import { stillValid } from '../online/protocol';
import { applyOwnChange } from '../online/ownChanges';
import { buildPlayerHero } from '../online/newHero';
import { sheetIntents, labelFor, ABILITY_NAMES } from '../online/actions';
import { CombatView, LevelUpModal, ShopModal, HostRoomDrawer, preloadGameParts } from './game/lazyParts';
import OpenedOnce from './OpenedOnce';
import { whenIdle } from '../utils/lazyWithPreload';
import OnlineToast from './online/OnlineToast';

// The bestiary (and its builder) is only needed when a fight is being prepared
// The bestiary is big: loaded the first time Duncan may start a fight
const loadBestiary = () => {
  // A fight may start: the combat view will be needed right after
  CombatView.preload();
  return import('../utils/bestiary');
};

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const levelReadyLine = name => `✨ ¡${name} tiene experiencia suficiente para subir de nivel! Selecciónalo y pulsa «Subir de nivel» en su ficha.`;

export default function TavernApp({
  activeCampaign = null,
  activeWorld = PRESET_WORLDS[0],
  activeCharacter = PRESET_CHARACTERS[0],
  onBackToLanding,
  onOpenInvite,
  onOpenSettings,
  onOpenGeminiConnect,
  onOpenCampaigns,
  onOpenSimulator = () => {}
}) {
  // Campaign ID & metadata
  const [currentCampaignId, setCurrentCampaignId] = useState(() => {
    if (activeCampaign?.id) return activeCampaign.id;
    const storedId = getActiveCampaignId();
    if (storedId && getCampaignById(storedId)) return storedId;
    return null;
  });

  // Campaign memory for the AI Dungeon Master (see campaignMemory.js)
  const storedCampaign = () => activeCampaign || (currentCampaignId ? getCampaignById(currentCampaignId) : null);

  const [campaignTitle, setCampaignTitle] = useState(() => {
    const camp = storedCampaign();
    if (camp?.title) return camp.title;
    return `${activeCharacter?.name || 'Héroe'} en ${activeWorld?.name || 'la Taberna'}`;
  });

  const [world, setWorld] = useState(() => storedCampaign()?.world || activeWorld);

  // The party (see party.js): older campaigns become a party of one. The ref
  // holds the latest party for handlers that wait on Duncan or on the dice.
  const [party, setPartyState] = useState(() => {
    const camp = storedCampaign();
    return (camp && migrateCampaign(camp).party) || createParty([activeCharacter]);
  });
  const partyRef = useRef(party);
  const setParty = next => {
    const value = typeof next === 'function' ? next(partyRef.current) : next;
    partyRef.current = value;
    setPartyState(value);
  };
  // Change one member (functions get the latest sheet, with the purse as `gold`)
  const updateMemberState = (id, update) => setParty(p => updateMember(p, id, update));
  // The member who acts outside combat
  const character = activeSheet(party);
  const setCharacter = update => updateMemberState(character.id, update);

  // The ambience can also be switched in Ajustes: read it from the player, this only re-renders
  const [, setAudioTick] = useState(0);
  const isAudioActive = Boolean(tavernAudio.isAmbiencePlaying);
  const [mobileTab, setMobileTab] = useState('story'); // 'story' | 'party' | 'map'
  const [isGenerating, setIsGenerating] = useState(false);
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());

  const [suggestedActions, setSuggestedActions] = useState(() => {
    const camp = storedCampaign();
    if (camp?.suggestedActions?.length > 0) return camp.suggestedActions;
    return [
      'Preguntar a Maese Duncan por el encapuchado del rincón',
      'Pedir una jarra de cerveza negra para entrar en calor',
      'Revisar tu equipo y afilar la daga',
      'Salir de la taberna hacia el embarcadero de niebla'
    ];
  });

  const [messages, setMessages] = useState(() => {
    const camp = storedCampaign();
    if (camp?.messages?.length > 0) return camp.messages;
    return [{ sender: 'duncan', text: activeWorld.initialStory, timestamp: 'Inicio de Campaña' }];
  });

  const [summary, setSummary] = useState(() => storedCampaign()?.summary || '');
  const [summaryCoverage, setSummaryCoverage] = useState(() => storedCampaign()?.summaryCoverage || 0);
  const [events, setEvents] = useState(() => storedCampaign()?.events || []);
  const recordEvent = text => setEvents(prev => addEvent(prev, text));

  // Combat encounter in progress (null outside combat); saved with the campaign
  const [encounter, setEncounter] = useState(() => {
    const camp = storedCampaign();
    return camp ? migrateCampaign(camp).encounter || null : null;
  });
  // How each recent fight started (the last MAX_SNAPSHOTS), to replay it in the simulator
  const [combatSnapshots, setCombatSnapshots] = useState(() => normalizeSnapshots(storedCampaign()?.combatSnapshots));

  // Shops visited (their stock is kept) and the one open now; saved with the campaign
  const [shops, setShops] = useState(() => normalizeShops(storedCampaign()?.shops));
  const [activeShopKey, setActiveShopKey] = useState(null);
  const [combatBusy, setCombatBusy] = useState(false);

  // A companion who offered to join (by the story), waiting for the player's answer
  const [pendingRecruit, setPendingRecruit] = useState(() => storedCampaign()?.pendingRecruit || null);
  // The last exploration of the wild by the local engine ended in an ambush: the next one is quiet
  const [lastAmbush, setLastAmbush] = useState(() => Boolean(storedCampaign()?.lastAmbush));

  // Quest journal (see quests.js): opened and closed by the story, saved with the campaign.
  // The ref holds the latest list for handlers that wait on Duncan.
  const [quests, setQuestsState] = useState(() => normalizeQuests(storedCampaign()?.quests));
  const questsRef = useRef(quests);
  const setQuests = next => {
    questsRef.current = next;
    setQuestsState(next);
  };

  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'error' | 'quota'
  const isRollingCheckRef = useRef(false); // a stat check die is on the table
  // Online: the player whose queued action is being played (shown in the chronicle)
  const authorRef = useRef(null);
  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);

  // Guards against double-creation under React.StrictMode (effects run twice in dev)
  const campaignInitRef = useRef(false);
  // Skip prop-sync effects on first mount so a stored campaign isn't overwritten by default props
  const prevActiveWorldRef = useRef(activeWorld);

  // Warm up the 3D dice engine in the background so the first roll starts instantly
  useEffect(() => {
    if (!is3DDiceEnabled()) return undefined;
    const timer = setTimeout(() => {
      import('../dice3d/engine').catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // The combat view, the shop, leveling up, the sheet's tabs...: loaded apart
  // from the game screen so it opens sooner, then fetched while nothing happens
  useEffect(() => whenIdle(preloadGameParts), []);

  // Ensure campaign is initialized and stored
  useEffect(() => {
    if (campaignInitRef.current) return;
    campaignInitRef.current = true;
    if (!currentCampaignId) {
      const newCamp = createNewCampaign({ world, party, title: campaignTitle });
      if (newCamp) setCurrentCampaignId(newCamp.id);
    }
    // Run once on mount only: creates the campaign from the initial state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When activeCampaign prop changes from modal
  useEffect(() => {
    if (activeCampaign) {
      const camp = migrateCampaign(activeCampaign);
      setCurrentCampaignId(camp.id);
      setCampaignTitle(camp.title);
      setWorld(camp.world);
      setParty(camp.party);
      setMessages(camp.messages || []);
      setSummary(camp.summary || '');
      setSummaryCoverage(camp.summaryCoverage || 0);
      setEvents(camp.events || []);
      setEncounter(camp.encounter || null);
      setCombatSnapshots(normalizeSnapshots(camp.combatSnapshots));
      setShops(normalizeShops(camp.shops));
      setQuests(normalizeQuests(camp.quests));
      setPendingRecruit(camp.pendingRecruit || null);
      setLastAmbush(Boolean(camp.lastAmbush));
      setActiveShopKey(null);
      if (camp.suggestedActions?.length > 0) {
        setSuggestedActions(camp.suggestedActions);
      }
    }
  }, [activeCampaign]);

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
      party,
      messages,
      suggestedActions,
      summary,
      summaryCoverage,
      events,
      encounter,
      shops,
      combatSnapshots,
      quests,
      pendingRecruit,
      lastAmbush
    });
    if (saved) {
      setSaveStatus('saved');
    } else {
      setSaveStatus(isQuotaError(getLastSaveError()) ? 'quota' : 'error');
    }
  }, [messages, party, world, campaignTitle, currentCampaignId, suggestedActions, summary, summaryCoverage, events, encounter, shops, combatSnapshots, quests, pendingRecruit, lastAmbush]);

  const toggleSound = () => {
    tavernAudio.toggleTavernAmbience();
    setAudioTick(t => t + 1);
  };

  const pushSystemMessage = (text) => {
    setMessages(prev => [...prev, { sender: 'system', text, timestamp: now() }]);
  };

  // Main Action Dispatcher
  // `sheet`: the member who acts, as it is now (pass the just-updated sheet when the
  // caller changed it in this same tick: state updates are not visible here until the next render)
  // `spellCast` / `rest`: what the action was, so the Dungeon Master narrates it properly
  // `effectsApplied`: HP / gold for this action were already changed here (drinks, rests, healing)
  const handleSendAction = async (actionText, {
    playerRoll = null, sheet = character, spellCast = null, rest = null, effectsApplied = false,
    weaponAttack = null, combatResult = null, loot = null
  } = {}) => {
    if (!actionText || isGenerating) return;
    const actorId = sheet.id;
    const partyNow = partyRef.current;
    const size = membersOf(partyNow).length;

    // Add the action to messages, with who did it (not for the narration after a fight)
    const newMsgList = combatResult ? messages : [
      ...messages,
      { sender: 'player', actor: sheet.name, avatar: sheet.avatar, text: actionText, timestamp: now(), ...(authorRef.current ? { by: authorRef.current } : {}) }
    ];
    // (the fight's own system lines were just added with functional updates: keep them)
    if (!combatResult) setMessages(newMsgList);
    setIsGenerating(true);

    try {
      const currentKeys = getStoredGeminiKeys();
      setGeminiKeys(currentKeys);

      // A plain action outside combat may start a fight: Duncan gets a short list of creatures
      const mayStartFight = !encounter && !combatResult && !playerRoll && !spellCast && !rest && !weaponAttack;
      // ...or open a shop (the game sets the prices), or bring in a companion
      const here = currentNode(world);
      const levels = membersOf(partyNow).map(m => m.level || 1);
      const bestiaryModule = mayStartFight ? await loadBestiary().catch(() => null) : null;
      // (the target of an active hunt is always among them)
      const bestiary = bestiaryModule
        ? withHuntTargets(
          bestiaryModule.encounterCandidates(levels, { tags: bestiaryModule.WORLD_TAGS[world?.id] || null }),
          questsRef.current, bestiaryModule.getMonster
        )
        : null;

      // Small requests: summary + uncovered messages; the summary is refreshed in
      // this same call every few turns (only when the AI is connected)
      const requestSummary = currentKeys.length > 0 && needsSummary(newMsgList, summaryCoverage);
      const response = await generateDMResponse({
        playerAction: actionText,
        character: sheet,
        world,
        history: historyForPrompt(newMsgList, summaryCoverage),
        apiKeys: currentKeys,
        playerRoll,
        spellCast,
        rest,
        effectsApplied,
        weaponAttack,
        summary,
        events: eventsForPrompt(events),
        requestSummary,
        bestiary,
        combatResult,
        allowShop: mayStartFight,
        shopsHere: describeShopsForPrompt(here, world),
        shopTypesHere: shopsAt(here, world),
        loot,
        quests: questsRef.current,
        here,
        companions: describeCompanions(partyNow, actorId, describeConditionsForPrompt),
        partySize: size,
        partyNames: membersOf(partyNow).map(m => m.name),
        allowRecruit: mayStartFight && size < MAX_PARTY && !pendingRecruit,
        allowDeparture: !combatResult && !encounter && size > 1,
        lastWasAmbush: lastAmbush
      });
      // A fight starts: the game resolves it, so nothing from this reply touches the sheet
      const fightGroups = response.combat && bestiaryModule
        ? bestiaryModule.resolveCombatRequest(response.combat, levels)
        : [];
      if (fightGroups.length) {
        response.damageTaken = 0;
        response.healing = 0;
        response.goldEarned = 0;
        response.xpEarned = 0;
      }
      // Quests opened, updated or closed by the story; the game pays the rewards it fixed
      // (rewards sized to the party's level; gold to the purse, the item to who acted, XP to everyone)
      const questResult = applyQuestChanges(questsRef.current, response.questChanges || [], {
        character: { ...sheet, level: partyLevel(partyNow) }, scene: newMsgList.length + 1, place: here?.name || ''
      });
      const questsPaid = questResult.applied.filter(a => a.action === 'complete');
      if (questResult.applied.length) {
        setQuests(questResult.quests);
        questResult.facts.forEach(recordEvent);
      }
      if (questsPaid.length) {
        // The reward is the one promised: nothing extra from the narration of this scene
        response.goldEarned = Math.min(0, response.goldEarned || 0);
        response.xpEarned = 0;
      }
      if (response.summary) {
        setSummary(response.summary);
        // The reply is about to be added: the summary covers all but the last few messages
        setSummaryCoverage(coverageAfterSummary(newMsgList.length + 1));
      }

      // Duncan rolled behind the screen: show the die before his narration
      if (response.roll) {
        const isEnemySave = spellCast?.spell.kind === 'save';
        await animateRoll({ ...response.roll, label: isEnemySave ? 'Salvación del objetivo' : 'Tirada de acción' });
      }

      // Apply the consequences of the scene: to the member who acted, or to the members
      // Duncan names (a trap, an explosion...); the gold is the party's (see partyActions.js).
      // When the game already applied this action's healing and gold, the narrator can only add damage
      const damage = response.damageTaken || 0;
      const healing = effectsApplied ? 0 : response.healing || 0;
      const goldChange = effectsApplied ? 0 : response.goldEarned || 0;
      const scene = applySceneEffects(partyRef.current, actorId, {
        damage, healing, goldChange, damageTargets: response.damageTargets, healingTargets: response.healingTargets
      });
      if (damage || healing || goldChange) setParty(scene.party);
      const groupHit = scene.hit.length > 1 || (scene.hit[0] && scene.hit[0] !== sheet.name);
      const groupHealed = scene.healed.length > 1 || (scene.healed[0] && scene.healed[0] !== sheet.name);

      // Limbs lost, disabled or healed in the story (validated by parseDMReply)
      const limbs = fightGroups.length ? { applied: [] } : applySceneLimbs(partyRef.current, actorId, response.limbChanges || []);
      if (limbs.applied.length) {
        setParty(limbs.party);
        limbs.applied.forEach(({ name, change }) => recordEvent(limbFact(name, change)));
      }

      // Conditions applied or removed by the story (validated by parseDMReply)
      const conditionResult = fightGroups.length ? { applied: [], collapsed: [] } : applySceneConditions(partyRef.current, actorId, response.conditionChanges || []);
      if (conditionResult.applied.length) {
        setParty(conditionResult.party);
        conditionResult.applied.forEach(({ name, change }) => {
          const fact = conditionFact(name, change);
          if (fact) recordEvent(fact);
        });
      }

      // Experience from the story goes to every member; quest rewards to the party
      const ready = new Set();
      if (response.xpEarned > 0 || questsPaid.length) {
        let next = partyRef.current;
        if (response.xpEarned > 0) {
          const res = storyXp(next, response.xpEarned);
          next = res.party;
          res.ready.forEach(n => ready.add(n));
        }
        questsPaid.forEach(a => {
          const res = payPartyReward(next, a.quest.reward, actorId);
          next = res.party;
          res.ready.forEach(n => ready.add(n));
        });
        setParty(next);
      }

      setMessages(prev => [
        ...prev,
        {
          sender: 'duncan',
          text: response.text,
          source: response.source,
          notice: response.notice || undefined,
          xp: response.xpEarned || undefined,
          keyIndex: response.keyIndex,
          totalKeys: response.totalKeys,
          timestamp: now()
        }
      ]);

      if (groupHit) pushSystemMessage(`🩸 ${scene.hit.join(', ')} ${scene.hit.length > 1 ? 'pierden' : 'pierde'} ${damage} PG${scene.hit.length > 1 ? ' cada uno' : ''}.`);
      if (groupHealed) pushSystemMessage(`💚 ${scene.healed.join(', ')} ${scene.healed.length > 1 ? 'recuperan' : 'recupera'} ${healing} PG${scene.healed.length > 1 ? ' cada uno' : ''}.`);

      limbs.applied.forEach(({ name, change }) => {
        const icon = change.status === 'ok' ? '🩹' : '🦴';
        const dropped = change.dropped.length ? ` ${change.dropped.join(' y ')} va${change.dropped.length > 1 ? 'n' : ''} a la mochila.` : '';
        const effect = change.status === 'ok' ? ''
          : /Arm$/.test(change.limb) ? ' Esa mano ya no puede sostener nada.' : ' Huir de un combate será más difícil.';
        pushSystemMessage(`${icon} ${limbFact(name, change)}.${effect}${dropped}`);
      });

      conditionResult.applied.forEach(({ name, change }) => pushSystemMessage(describeConditionChange(name, change)));
      questResult.applied.forEach(change => pushSystemMessage(describeQuestChange(change)));
      conditionResult.collapsed.forEach(name => {
        recordEvent(`${name} se desplomó de agotamiento y Duncan lo recogió`);
        pushSystemMessage(`💀 ${name} llega al sexto nivel de agotamiento y se desploma. Maese Duncan lo recoge y lo mete en un catre: sigue con agotamiento de nivel 5.`);
      });
      if (conditionResult.goldLost > 0) pushSystemMessage(`🪙 Los cuidados de Duncan cuestan ${conditionResult.goldLost} monedas de oro de la bolsa.`);

      ready.forEach(name => pushSystemMessage(levelReadyLine(name)));

      // Dropping to 0 HP: Duncan patches the hero up... at a price (paid once from the purse)
      scene.knockedOut.forEach(k => {
        recordEvent(`${k.name} cayó inconsciente y Duncan lo curó`);
        pushSystemMessage(`💀 ${k.name} cae inconsciente. Maese Duncan lo arrastra junto a la chimenea y lo remienda: despierta con ${k.hp} HP.`);
      });
      if (scene.goldLost > 0) pushSystemMessage(`🪙 Los cuidados de Duncan cuestan ${scene.goldLost} monedas de oro de la bolsa.`);

      // A companion offers to join: the game builds the sheet, the player decides
      if (response.recruit && !fightGroups.length) {
        const offer = makeRecruitOffer(response.recruit, partyRef.current, { scene: newMsgList.length + 1 });
        if (offer) {
          setPendingRecruit(offer);
          pushSystemMessage(`🤝 ${offer.character.name} (${offer.character.race} · ${offer.character.className}, nivel ${offer.character.level}) quiere unirse al grupo. Decide si lo aceptas bajo la crónica.`);
        }
      }
      // A member leaves the party through the story
      const leaving = response.departure ? departingMember(partyRef.current, response.departure) : null;
      if (leaving) {
        const res = removeMember(partyRef.current, leaving.id);
        if (res.ok) {
          setParty(res.party);
          recordEvent(`${leaving.name} deja el grupo${response.departure.reason ? ` (${response.departure.reason})` : ''}`);
          pushSystemMessage(`🚪 ${leaving.name} deja el grupo${response.departure.reason ? `: ${response.departure.reason}` : ''}. Se lleva su equipo.`);
        }
      }

      if (response.exploration) setLastAmbush(response.exploration.ambushed);
      if (response.suggestedActions) {
        setSuggestedActions(response.suggestedActions);
      }

      if (fightGroups.length) startEncounter(fightGroups, { byDuncan: true, start: response.combat, actionText, actorId });
      else if (response.shop && SHOP_TYPES[response.shop]) handleOpenShop(response.shop, { byDuncan: true });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ---------------------------------------------------------------- companions
  const handleAnswerRecruit = accept => {
    const offer = pendingRecruit;
    if (!offer) return;
    setPendingRecruit(null);
    if (!accept) {
      recordEvent(`El grupo rechaza la compañía de ${offer.character.name}`);
      pushSystemMessage(`🙅 ${offer.character.name} no se une al grupo.`);
      return;
    }
    const res = addMember(partyRef.current, offer.character);
    if (!res.ok) {
      pushSystemMessage(`🤝 ${res.error}`);
      return;
    }
    setParty(res.party);
    recordEvent(`${res.member.name} (${res.member.className}) se une al grupo`);
    pushSystemMessage(`🤝 ${res.member.name} se une al grupo: ${res.member.race} · ${res.member.className} de nivel ${res.member.level}, con su equipo inicial. Selecciónalo en la ficha para verlo o hacerlo actuar.`);
  };

  // The player dismisses a member (outside combat). They take their own equipment.
  const handleDismissMember = id => {
    if (encounter) return;
    const res = removeMember(partyRef.current, id);
    if (!res.ok) {
      pushSystemMessage(`🚪 ${res.error}`);
      return;
    }
    setParty(res.party);
    recordEvent(`${res.member.name} deja el grupo (despedido)`);
    pushSystemMessage(`🚪 ${res.member.name} se despide del grupo y se marcha con su equipo.`);
  };

  const handleTransferItem = (fromId, toId, itemId) => {
    if (encounter) return 'En mitad de un combate no hay tiempo para repartir el equipo.';
    const res = transferItem(partyRef.current, fromId, toId, itemId);
    if (!res.ok) return res.error;
    setParty(res.party);
    const from = memberSheet(partyRef.current, fromId);
    const to = memberSheet(partyRef.current, toId);
    pushSystemMessage(`🎒 ${from.name} pasa ${res.item.name} a ${to.name}.`);
    return null;
  };

  const handleSelectMember = id => setParty(p => setActiveMember(p, id));

  // ---------------------------------------------------------------- combat encounters
  const combatDie = sides => rollDie(sides, { silent: true });

  // `start`: how the fight starts (see readCombatStart in surprise.js): `surprise` (who is
  // caught off guard) and `heroAttacks` (the action of `actorId` was an attack: the opening strike)
  const startEncounter = (groups, { byDuncan = false, start = null, actionText = '', actorId = null } = {}) => {
    const heroes = memberSheets(partyRef.current);
    const surprise = start?.surprise || null;
    // How the fight starts (the whole party), kept so it can be fought again in the simulator
    const snapshot = makeSnapshot({ party: heroes, groups, world, place: currentNode(world)?.name || '', byDuncan, surprise: surprise?.side || null });
    let next = { ...createEncounter(groups, heroes, combatDie, { surprise }), byDuncan, narrated: 0, snapshotId: snapshot.id };
    // The attack the player wrote is played before the initiative (asked in the combat view when unclear)
    const attacker = start?.heroAttacks ? heroes.find(h => h.id === actorId) : null;
    const opening = attacker ? detectOpeningStrike(actionText, attacker, next.enemies, { targetId: start.targetId }) : null;
    if (opening) next = addOpening(next, heroes, opening);
    const logStart = next.log.length;
    let after = { encounter: next, heroes };
    // Enemies that won initiative act before the heroes (after the opening strike, if there is one)
    if (!openingPending(next)) after = runEnemyTurns(next, heroes, combatDie);
    next = after.encounter;
    recordInjuries(next.log.slice(logStart));
    const finished = next;
    setCombatSnapshots(prev => {
      const list = addSnapshot(prev, snapshot);
      return finished.status === 'active' ? list : setSnapshotResult(list, snapshot.id, finished);
    });
    next.log.filter(e => e.kind === 'surprise').forEach(e => pushSystemMessage(e.text));
    // Who surprised whom is a fact of the campaign (with the opening strike, once it is played)
    if (!openingPending(next)) {
      const fact = describeSurprise(next, heroes);
      if (fact) recordEvent(fact.replace(/\.$/, ''));
    }
    const names = groups.map(g => {
      const label = g.name ? `${g.name} (${g.monster.name}${g.elite ? ', élite' : ''})` : g.monster.name;
      return g.count > 1 ? `${g.count} × ${label}` : label;
    }).join(', ');
    const who = heroes.length > 1 ? 'El grupo' : heroes[0].name;
    pushSystemMessage(`⚔️ ¡Combate! ${who} se enfrenta a: ${names}.`);
    setActiveShopKey(null);
    setEncounter(next);
    setParty(p => {
      const merged = mergeHeroes(p, after.heroes);
      const turn = currentHeroUid(next);
      return turn ? setActiveMember(merged, turn) : merged;
    });
    setMobileTab('story');
    // Everything about the opening strike is clear: the game rolls it now
    if (openingPending(next) && openingReady(next.opening)) playCombatAction(next, next.opening.suggest);
  };

  // The opening strike was just played: the chronicle and the campaign memory say
  // what happened, and Duncan narrates it from the result (never his own numbers)
  const afterOpening = (before, after, heroes) => {
    if (!openingPending(before) || openingPending(after)) return after;
    const fact = describeSurprise(after, heroes);
    if (fact) recordEvent(fact.replace(/\.$/, ''));
    const result = after.opening?.result;
    const line = after.log.slice(before.log.length).filter(e => e.kind === 'opening').map(e => e.text).pop();
    if (line && !result?.skipped) pushSystemMessage(line);
    if (!result || result.skipped) return after;
    const hero = heroes.find(h => h.id === after.opening.heroUid) || heroes[0];
    const key = getStoredGeminiKeys()[0]?.key;
    const local = { round: after.round, kind: 'duncan', text: `🗣️ ${openingLine(result, hero)}` };
    if (!key) return { ...after, log: [...after.log, local] };
    narrateMoment(key, { moments: [{ kind: 'opening', text: line }], encounter: after, character: hero, world }).then(text => {
      setEncounter(prev => (prev ? { ...prev, log: [...prev.log, text ? { round: prev.round, kind: 'duncan', text: `🗣️ ${text}` } : local] } : prev));
    });
    return after;
  };

  // Key moments (a leader falls, an enemy surrenders or flees): Duncan adds a line,
  // at most MAX_MOMENTS times per fight. The fight never waits for it.
  const narrateKeyMoments = (before, after, hero) => {
    if (after.status !== 'active' || (after.narrated || 0) >= MAX_MOMENTS) return after;
    const moments = keyMoments(after.log.slice(before.log.length));
    const key = getStoredGeminiKeys()[0]?.key;
    if (!moments.length || !key) return after;
    narrateMoment(key, { moments, encounter: after, character: hero, world }).then(text => {
      if (!text) return;
      setEncounter(prev => (prev ? { ...prev, log: [...prev.log, { round: prev.round, kind: 'duncan', text: `🗣️ ${text}` }] } : prev));
    });
    return { ...after, narrated: (after.narrated || 0) + 1 };
  };

  // Grave wounds suffered in a fight are facts of the campaign
  const recordInjuries = (entries) => {
    injuriesIn(entries).forEach(injury => recordEvent(limbFact(injury.heroName || character.name, injury, injury.by ? `en combate contra ${injury.by}` : 'en combate')));
  };

  // The action of the hero whose turn it is
  const handleCombatAction = async (action) => {
    if (!encounter || combatBusy) return;
    await playCombatAction(encounter, action);
  };

  // Play an action on this encounter (the one in state, or one just started)
  const playCombatAction = async (encounter, action) => {
    const heroes = memberSheets(partyRef.current);
    const result = playerAction(encounter, heroes, action, combatDie);
    if (!result.ok) {
      setEncounter(prev => ({ ...prev, log: [...prev.log, { round: prev.round, kind: 'info', text: `⚠️ ${result.error}` }] }));
      return;
    }
    recordInjuries(result.encounter.log.slice(encounter.log.length));
    if (result.encounter.status !== 'active' && encounter.snapshotId) {
      setCombatSnapshots(prev => setSnapshotResult(prev, encounter.snapshotId, result.encounter));
    }
    setCombatBusy(true);
    try {
      for (const roll of result.animations) {
        await animateRoll(roll);
      }
    } finally {
      setEncounter(narrateKeyMoments(encounter, afterOpening(encounter, result.encounter, result.heroes), result.character));
      setParty(p => {
        const merged = mergeHeroes(p, result.heroes);
        const turn = currentHeroUid(result.encounter);
        return turn ? setActiveMember(merged, turn) : merged;
      });
      setCombatBusy(false);
    }
  };

  // Close a finished fight: chronicle line, shared XP, loot, recorded facts, rescue if everyone fell
  const handleFinishEncounter = () => {
    if (!encounter || encounter.status === 'active') return;
    const loot = generateLoot(encounter);
    const won = encounter.status === 'victory';
    const heroes = memberSheets(partyRef.current).filter(h => (encounter.heroIds || []).includes(h.id));
    const group = heroes.length > 1;
    const receiver = activeSheet(partyRef.current);
    const line = `${describeEncounterResult(encounter, heroes.length ? heroes : [character])}${won ? ` Botín: ${describeLoot(loot)}${loot.items.length ? ` (los objetos, en la mochila de ${receiver.name}; las monedas, a la bolsa común)` : ''}.` : ''}`;
    pushSystemMessage(line);
    const defeated = encounter.enemies.filter(e => e.status !== 'active').map(e => e.name);
    if (won) recordEvent(`${group ? 'El grupo vence' : 'Vence'} en combate a ${defeated.slice(0, 3).join(', ')}${defeated.length > 3 ? '…' : ''}`);
    if (encounter.status === 'fled') recordEvent(`${group ? 'El grupo huye' : 'Huye'} de un combate`);

    const result = finishFight(partyRef.current, encounter, { loot: won ? loot : null, receiverId: receiver.id });
    let next = result.party;
    result.ended.forEach(e => pushSystemMessage(`🩹 Al acabar el combate, ${e.name} deja de estar ${e.conditions.join(', ')}.`));
    if (group && result.fallen.length && encounter.status !== 'defeat') {
      recordEvent(`${result.fallen.join(' y ')} ${result.fallen.length > 1 ? 'cayeron' : 'cayó'} inconsciente${result.fallen.length > 1 ? 's' : ''} en combate`);
      pushSystemMessage(`🩹 ${result.fallen.join(' y ')} ${result.fallen.length > 1 ? 'vuelven' : 'vuelve'} en sí con 1 PG.`);
    }
    if (group && result.share > 0) pushSystemMessage(`✨ ${encounter.xp} PX repartidos: +${result.share} PX para cada uno de los ${(encounter.heroIds || []).length} que lucharon.`);
    if (won && loot.items.length) recordEvent(`Botín: ${loot.items.map(i => i.name).join(', ')}`);
    const ready = new Set(result.ready);

    // Hunting quests of the local engine are done with a victory
    let questLine = '';
    if (won) {
      const quest = applyQuestChanges(questsRef.current, huntChangesAfterVictory(questsRef.current, encounter), {
        character: { ...receiver, level: partyLevel(next) }, scene: messages.length + 1, place: currentNode(world)?.name || ''
      });
      if (quest.applied.length) {
        setQuests(quest.quests);
        quest.facts.forEach(recordEvent);
        quest.applied.forEach(change => pushSystemMessage(describeQuestChange(change)));
        quest.applied.filter(a => a.action === 'complete').forEach(a => {
          const paid = payPartyReward(next, a.quest.reward, receiver.id);
          next = paid.party;
          paid.ready.forEach(n => ready.add(n));
        });
        questLine = ` ${quest.applied.map(a => `Misión cumplida: «${a.quest.title}» (la recompensa ya está entregada).`).join(' ')}`;
      }
    }
    ready.forEach(name => pushSystemMessage(levelReadyLine(name)));
    if (result.rescue) {
      const who = group ? 'todo el grupo' : heroes[0]?.name || character.name;
      recordEvent(`${group ? 'El grupo cayó' : `${heroes[0]?.name || character.name} cayó`} en combate y Duncan ${group ? 'los' : 'lo'} curó`);
      pushSystemMessage(`💀 Cae ${who}. Maese Duncan ${group ? 'los arrastra' : 'lo arrastra'} junto a la chimenea y ${group ? 'los remienda' : 'lo remienda'}: ${group ? 'despiertan' : 'despierta'} con la mitad de sus PG${result.rescue.goldLost > 0 ? ` y ${result.rescue.goldLost} monedas de oro menos en la bolsa por los cuidados` : ''}.`);
    }
    setParty(next);
    setEncounter(null);
    // Duncan narrates the outcome (and any loot) from the result the game computed
    handleSendAction('Narra el final del combate', { sheet: activeSheet(next), combatResult: `${line}${questLine}`, loot: won ? loot : null });
  };

  // Paralyzed, stunned, petrified...: no attacks or spells outside a fight either
  const blockedByConditions = () => {
    if (!isIncapacitated(character)) return false;
    const why = ['petrificado', 'paralizado', 'aturdido', 'incapacitado'].find(id => activeIds(character).has(id));
    pushSystemMessage(`⛔ ${character.name} está ${conditionName(why || 'incapacitado').toLowerCase()} y no puede actuar.`);
    return true;
  };

  // Weapon attack resolved by the game: Duncan only narrates the result
  const handleAttack = async ({ optionId, target = '', targetAC, raging = false }) => {
    if (isGenerating || isRollingCheckRef.current) return;
    if (blockedByConditions()) return;
    const result = resolveAttack(character, optionId, sides => rollDie(sides, { silent: true }), { targetAC, raging });
    if (!result.ok) {
      pushSystemMessage(`⚔️ ${result.error}`);
      return;
    }

    isRollingCheckRef.current = true;
    try {
      const { attack } = result;
      const label = attack.option.name;
      for (const [index, roll] of attack.rolls.entries()) {
        await animateRoll({
          sides: 20,
          value: roll.raw,
          modifier: roll.total - roll.raw,
          dc: attack.targetAC,
          success: roll.hit,
          label: attack.rolls.length > 1 ? `${label} · ataque ${index + 1}` : `${label} · ataque`
        });
      }
      // All the damage dice of the hits (and Sneak Attack) in a single throw
      const damageDice = [
        ...attack.rolls.flatMap(r => r.damage?.dice.map(value => ({ sides: r.damage.sides, value })) || []),
        ...(attack.sneak?.dice.map(value => ({ sides: 6, value })) || [])
      ];
      if (damageDice.length > 0) {
        const diceTotal = damageDice.reduce((sum, d) => sum + d.value, 0);
        await animateRoll({ dice: damageDice, modifier: attack.totalDamage - diceTotal, label: `${label} · daño` });
      }

      setMobileTab('story');
      handleSendAction(describeAttack(attack, target), { weaponAttack: attack });
    } finally {
      isRollingCheckRef.current = false;
    }
  };

  // The 🎲 button next to «Actuar»: a skill check with the acting member's sheet
  const handleQuickCheck = (skillId) => {
    const skill = getSkill(skillId);
    if (skill) handleRollCheck({ label: skill.name, modifier: skillModifier(character, skillId), ability: skill.ability, skillId });
  };

  // When rolling an ability or skill check from the character sheet
  // `ability` / `skillId`: the armor may give Disadvantage (no training, or Stealth in heavy armor)
  const handleRollCheck = async ({ label, modifier, ability = null, skillId = null }) => {
    if (isGenerating || isRollingCheckRef.current) return;
    isRollingCheckRef.current = true;

    try {
      // Armor without training, poisoned, frightened, exhausted... (see checkModifiers)
      const mods = checkModifiers(character, { ability, skillId });
      const both = mods.advantage.length > 0 && mods.disadvantage.length > 0;
      const disadvantage = !both && mods.disadvantage.length ? mods.disadvantage.join(', ') : null;
      const advantage = !both && mods.advantage.length ? mods.advantage.join(', ') : null;
      const check = rollCheck({
        modifier: modifier - mods.penalty,
        statName: disadvantage ? `${label} con desventaja` : advantage ? `${label} con ventaja` : label,
        silent: true,
        disadvantage: Boolean(disadvantage),
        advantage: Boolean(advantage)
      });
      await animateRoll({
        sides: 20,
        value: check.rawRoll,
        modifier: check.modifier,
        dc: check.dc,
        success: check.success,
        label: `${character.name} · ${label}`
      });

      const tired = mods.penalty ? ` (agotamiento: −${mods.penalty})` : '';
      const textDesc = `Realizo una tirada de ${label}${disadvantage ? ` con desventaja (${disadvantage})` : advantage ? ` con ventaja (${advantage})` : ''}${tired} [🎲 D20: ${check.rawRoll} (${check.modifier >= 0 ? `+${check.modifier}` : check.modifier}) = ${check.total} vs CD ${check.dc}].`;
      handleSendAction(textDesc, { playerRoll: check });
    } finally {
      isRollingCheckRef.current = false;
    }
  };

  // Casting a spell from the sheet: roll its dice, spend the slot and tell the Dungeon Master.
  // A healing spell whose target is a member of the party heals that member.
  const handleCastSpell = async (spellId, target = '') => {
    if (isGenerating || isRollingCheckRef.current) return;
    if (blockedByConditions()) return;

    const result = castSpell(character, spellId, sides => rollDie(sides, { silent: true }));
    if (!result.ok) {
      pushSystemMessage(`✨ ${result.error}`);
      return;
    }

    isRollingCheckRef.current = true;
    try {
      const { cast } = result;
      const { spell } = cast;
      const SPELL_ATTACK_DC = 12;
      const toDice = roll => roll.dice.map(value => ({ sides: roll.sides, value }));

      let playerRoll = null;
      if (cast.attack) {
        const { raw, total, isNat20, isNat1 } = cast.attack;
        const success = isNat20 || (!isNat1 && total >= SPELL_ATTACK_DC);
        await animateRoll({
          sides: 20, value: raw, modifier: cast.attackBonus, dc: SPELL_ATTACK_DC, success,
          label: `${spell.name} · ataque`
        });
        playerRoll = {
          rawRoll: raw, modifier: cast.attackBonus, total, dc: SPELL_ATTACK_DC, success, isNat20, isNat1,
          statName: `ataque de conjuro (${spell.name})`
        };
        if (success && cast.damage?.dice.length) {
          await animateRoll({ dice: toDice(cast.damage), modifier: cast.damage.bonus, label: `${spell.name} · daño` });
        }
      } else if (cast.damage?.dice.length) {
        await animateRoll({ dice: toDice(cast.damage), modifier: cast.damage.bonus, label: `${spell.name} · daño` });
      } else if (cast.heal?.dice.length) {
        await animateRoll({ dice: toDice(cast.heal), modifier: cast.heal.bonus, label: `${spell.name} · curación` });
      }

      const ally = cast.heal ? findMemberByName(partyRef.current, target) : null;
      let sheet = result.character;
      let castForDuncan = cast;
      if (ally && ally.id !== character.id) {
        // The caster keeps their own HP; the ally gets the healing
        sheet = { ...result.character, hp: character.hp };
        const healed = Math.min(ally.maxHp, ally.hp + cast.heal.total) - ally.hp;
        setParty(p => updateMember(updateMember(p, character.id, sheet), ally.id, a => ({ ...a, hp: Math.min(a.maxHp, a.hp + cast.heal.total) })));
        castForDuncan = { ...cast, heal: { ...cast.heal, applied: healed } };
        pushSystemMessage(`✨ ${character.name} cura a ${ally.name}: recupera ${healed} PG.`);
      } else {
        setCharacter(sheet);
      }
      if (cast.cured?.length) pushSystemMessage(`✨ ${character.name} se libra de: ${cast.cured.join(', ')}.`);
      setMobileTab('story');
      handleSendAction(describeCast(castForDuncan, { target, dc: SPELL_ATTACK_DC }), {
        sheet,
        playerRoll,
        spellCast: castForDuncan,
        effectsApplied: Boolean(cast.heal)
      });
    } finally {
      isRollingCheckRef.current = false;
    }
  };

  const handleLevelUpConfirmed = (next, levelSummary) => {
    updateMemberState(next.id, sheet => ({ ...next, gold: sheet.gold }));
    setIsLevelUpOpen(false);
    tavernAudio.playCritSuccess();
    pushSystemMessage(describeLevelUp(next, levelSummary));
    recordEvent(`${next.name} sube a nivel ${next.level}${levelSummary.features.length ? ` (${levelSummary.features.slice(0, 2).join(', ')})` : ''}`);
  };

  // Short rest (an hour by the fire) or long rest (a night, a room each): the whole party rests
  const handleRest = (kind) => {
    if (isGenerating || isRollingCheckRef.current) return;
    const result = restParty(partyRef.current, kind, sides => rollDie(sides, { silent: true }));
    if (!result.ok) {
      pushSystemMessage(`🛏️ ${result.error}`);
      return;
    }
    const group = result.report.length > 1;
    const extras = [];
    result.report.forEach(r => {
      const parts = [];
      if (r.ended.length) parts.push(`deja de estar ${r.ended.join(', ')}`);
      if (r.exhaustion.before > r.exhaustion.after) {
        parts.push(r.exhaustion.after ? `su agotamiento baja a nivel ${r.exhaustion.after}` : 'ya no sufre agotamiento');
        recordEvent(r.exhaustion.after ? `El agotamiento de ${r.name} baja a nivel ${r.exhaustion.after}` : `${r.name} se recupera del agotamiento`);
      }
      r.removed.forEach(c => {
        const fact = conditionFact(r.name, { id: c.id, action: 'remove', level: null, condition: c });
        if (fact && c.id !== 'agotamiento') recordEvent(fact);
      });
      if (parts.length) {
        pushSystemMessage(`🛏️ Tras el descanso, ${r.name} ${parts.join(' y ')}.`);
        extras.push(`${r.name} ${parts.join(' y ')}`);
      }
    });
    const extra = extras.length ? ` Además, ${extras.join('; ')}.` : '';
    setParty(result.party);
    setMobileTab('story');
    const sheet = activeSheet(result.party);
    if (kind === 'long') {
      handleSendAction(
        `${group ? `Pagamos ${result.cost} monedas de oro por ${result.report.length} habitaciones y el grupo hace` : `Pago ${result.cost} monedas de oro por una habitación y hago`} un descanso largo hasta el amanecer. ${group ? 'Todos recuperamos' : 'Recupero'} los puntos de golpe y la magia.${extra}`,
        { sheet, rest: 'long', effectsApplied: true }
      );
      return;
    }
    const gains = result.report.map(r => [
      r.healed > 0 && `${group ? `${r.name} gasta` : 'gasto'} su dado de golpe (d${r.hitDie}: ${r.die}) y recupera ${r.healed} PG`,
      r.slotsRecovered && `${group ? `${r.name} recupera` : 'recupero'} su magia de pacto`
    ].filter(Boolean).join(' y ')).filter(Boolean);
    handleSendAction(
      `${group ? 'El grupo hace' : 'Hago'} un descanso corto de una hora junto al fuego${gains.length ? `: ${gains.join('; ')}` : ''}.${extra}`,
      { sheet, rest: 'short', effectsApplied: true }
    );
  };

  // When ordering a drink from Duncan's tavern menu (the acting member drinks, the purse pays)
  const handleOrderDrink = (drink) => {
    if (character.gold < drink.cost) return;
    const updated = {
      ...character,
      gold: character.gold - drink.cost,
      hp: Math.min(character.maxHp, character.hp + 4)
    };
    setCharacter(updated);
    handleSendAction(`Pido a Maese Duncan un/a "${drink.name}" (${drink.cost} po). ${drink.effect}`, { sheet: updated, effectsApplied: true });
  };

  // ---------------------------------------------------------------- shops
  // Open a shop of the current location (from the map, or because Duncan took the party there).
  // The stock is generated the first time and kept in the campaign.
  const handleOpenShop = (type, { byDuncan = false } = {}) => {
    if (encounter && encounter.status === 'active') return;
    const node = currentNode(world);
    setShops(prev => openShop(prev, { node, world, type }).shops);
    setActiveShopKey(shopKey(node?.id, type));
    if (byDuncan) pushSystemMessage(`🛒 Se abre ${SHOP_TYPES[type].name.toLowerCase()}: los precios los pone el juego (los del SRD; vendes a la mitad).`);
  };

  const activeShop = activeShopKey ? shops[activeShopKey] : null;

  // Buy / sell at the open shop with the selected member (the purse pays): returns an error for the shop window, or null
  const trade = (result, kind) => {
    if (!result.ok) return result.error;
    setCharacter(normalizeEquipment(result.character));
    setShops(prev => ({ ...prev, [result.shop.key]: result.shop }));
    pushSystemMessage(`${character.name}: ${describeTrade(kind, result.item, result.price, result.shop)}`);
    if (result.price >= 100) recordEvent(`${character.name} ${kind === 'buy' ? 'compra' : 'vende'} ${result.item.name}`);
    tavernAudio.playTankardClink();
    return null;
  };
  const handleBuy = key => (activeShop ? trade(buyItem(character, activeShop, key), 'buy') : 'La tienda está cerrada.');
  const handleSell = itemId => (activeShop ? trade(sellItem(character, activeShop, itemId), 'sell') : 'La tienda está cerrada.');

  // Using a consumable from the sheet (outside combat): potions roll their healing,
  // anything else is told to Duncan
  const handleUseItem = async (item) => {
    if (isGenerating || isRollingCheckRef.current) return;
    if (healingDice(item)) {
      const result = drinkPotion(character, item.id, sides => rollDie(sides, { silent: true }));
      if (!result.ok) { pushSystemMessage(`🧪 ${result.error}`); return; }
      isRollingCheckRef.current = true;
      try {
        await animateRoll({ dice: result.roll.dice.map(value => ({ sides: result.roll.sides, value })), modifier: result.roll.bonus, label: `${item.name} · curación` });
      } finally {
        isRollingCheckRef.current = false;
      }
      setCharacter(result.character);
      pushSystemMessage(`🧪 ${character.name} bebe ${item.name} y recupera ${result.healed} puntos de golpe (${result.character.hp}/${result.character.maxHp}).`);
      return;
    }
    const updated = {
      ...character,
      inventory: character.inventory
        .map(i => (i.id === item.id && i.uses !== undefined ? { ...i, uses: i.uses - 1 } : i))
        .filter(i => i.id !== item.id || (i.uses !== undefined && i.uses > 0))
    };
    setCharacter(updated);
    handleSendAction(`Uso ${item.name}.${item.effect ? ` ${item.effect}.` : ''}`, { sheet: updated, effectsApplied: true });
  };

  // The player gives up a quest: their decision, no reward
  const handleAbandonQuest = id => {
    const { quests: next, quest } = abandonQuest(questsRef.current, id, { scene: messages.length });
    if (!quest) return;
    setQuests(next);
    recordEvent(questFact(quest));
    pushSystemMessage(`🏳 ${membersOf(party).length > 1 ? 'El grupo abandona' : `${character.name} abandona`} la misión «${quest.title}».`);
  };

  const handleQuestSeen = id => {
    const list = questsRef.current;
    if (!list.some(q => q.id === id && q.unseen)) return;
    setQuests(list.map(q => (q.id === id ? { ...q, unseen: false } : q)));
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

    recordEvent(`Viaja a ${node.name}`);
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

  const heroes = memberSheets(party);
  const inCombat = Boolean(encounter && encounter.status === 'active');

  // ---------------------------------------------------------------- online room
  // The host's browser runs the game (and Duncan, with its own Gemini key) and shares
  // it; the other players send intents that are checked before anything happens
  // (see src/online). Without a room open, nothing here changes how the game plays.
  const onlineKind = onlineConfig().kind;
  const gameRef = useRef(null);
  const combatIntentRef = useRef(() => {});
  const directIntentRef = useRef(() => {});
  const online = useHostRoom({
    campaignId: currentCampaignId,
    kind: onlineKind,
    getGame: () => gameRef.current,
    onCombat: (characterId, action) => combatIntentRef.current(characterId, action),
    onDirect: (direct, playerId) => directIntentRef.current(direct, playerId)
  });
  const room = online.status === 'open' ? online.room : null;
  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [onlineNotice, setOnlineNotice] = useState(null);
  const [queueRunning, setQueueRunning] = useState(false);
  const [chatSeen, setChatSeen] = useState(0);
  const turnUid = inCombat ? currentHeroUid(encounter) : null;
  const heroIds = heroes.map(h => h.id);

  gameRef.current = {
    characterIds: heroIds,
    names: Object.fromEntries(heroes.map(h => [h.id, h.name])),
    inCombat,
    turnCharacterId: turnUid,
    combatBusy,
    labelFor: (kind, payload, characterId) => labelFor(kind, payload, heroes.find(h => h.id === characterId))
  };
  // A combat action from a player whose turn it is (already checked by the room)
  combatIntentRef.current = (characterId, action) => {
    if (encounter && currentHeroUid(encounter) === characterId) handleCombatAction(action);
  };

  // A player changes the equipment of their own character, or levels it up (already
  // checked by the room: they control it and there is no fight); the rules decide the rest
  directIntentRef.current = (direct, playerId) => {
    if (direct.kind === 'create') {
      addPlayerHero(direct.draft, playerId);
      return;
    }
    const sheet = memberSheet(partyRef.current, direct.characterId);
    const res = applyOwnChange(sheet, direct, sides => rollDie(sides, { silent: true }));
    if (!res.ok) {
      tell(playerId, res.error);
      return;
    }
    if (direct.kind === 'equip') {
      if (res.changed) updateMemberState(sheet.id, current => ({ ...res.character, gold: current.gold }));
      return;
    }
    if (res.roll) pushSystemMessage(`🎲 ${sheet.name} tira su dado de golpe para subir de nivel: d${levelUpPlan(sheet).hitDie} = ${res.roll}.`);
    handleLevelUpConfirmed(res.character, res.summary);
  };

  // A player without a character creates one (the room checked: room in the party, no fight,
  // no character of their own). The host builds the sheet with the rules, at the party's
  // level and without gold for the purse (see newHero.js); Duncan narrates the arrival.
  const addPlayerHero = (draft, playerId) => {
    const built = buildPlayerHero(draft, { level: partyLevel(partyRef.current), rollD6: () => rollDie(6, { silent: true }) });
    if (!built.ok) {
      tell(playerId, built.error);
      return;
    }
    const res = addMember(partyRef.current, built.character);
    if (!res.ok) {
      tell(playerId, res.error);
      return;
    }
    setParty(res.party);
    const hero = res.member;
    const who = playerName(room, playerId);
    const ids = membersOf(res.party).map(m => m.id);
    recordEvent(`${hero.name} (${hero.race} · ${hero.className}) se une al grupo; lo juega ${who}`);
    pushSystemMessage(`🧭 ${hero.name} (${hero.race} · ${hero.className} de nivel ${hero.level}) se une al grupo: lo juega ${who}.${built.rolled ? ` Sus características se tiraron en la mesa del anfitrión (4d6): ${built.rolled.join(', ')}.` : ''}`);
    const place = currentNode(world)?.name;
    online.update(r => {
      const claimed = claimCharacter(r, playerId, hero.id, ids);
      const next = claimed.ok ? claimed.room : r;
      const arrival = enqueueAction(next, {
        playerId,
        characterId: hero.id,
        kind: 'text',
        payload: { text: `Llego${place ? ` a ${place}` : ''} y me presento ante el grupo: soy ${hero.name}, ${hero.race.toLowerCase()} ${hero.className.toLowerCase()}, y me uno a vosotros.` },
        label: `${hero.name}: llega y se une al grupo`
      });
      return arrival.ok ? arrival.room : next;
    });
  };

  const tell = (playerId, text) => {
    if (!room || playerId === room.hostId) setOnlineNotice(text);
    else online.notice(playerId, text);
  };

  const openRoom = name => {
    storePlayerName(name);
    online.open(name);
  };

  // The room was open when the page was left (a reload): open it again, same code
  useEffect(() => {
    if (onlineKind && wasOnline(currentCampaignId)) online.open(null);
    // Only when the campaign changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCampaignId]);

  // Share the game with the players (the session sends only what changed, a few times a second at most)
  const roomIsOpen = Boolean(room);
  useEffect(() => {
    if (!roomIsOpen) return;
    online.publish(buildSections({
      title: campaignTitle, world, party, messages, suggestedActions, encounter, quests, events, summary,
      isGenerating: isGenerating || queueRunning, combatBusy, pendingRecruit, aiActive: geminiKeys.length > 0
    }));
    // `online.publish` is stable; the room itself is added by the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIsOpen, campaignTitle, world, party, messages, suggestedActions, encounter, quests, events, summary, isGenerating, queueRunning, combatBusy, pendingRecruit, geminiKeys.length]);

  // Each member records who plays it (`controlledBy`): a player id, or the local one for the host
  const ownersKey = room ? heroIds.map(id => `${id}:${ownerOf(room, id)}`).join('|') : `off:${heroIds.join('|')}`;
  useEffect(() => {
    const want = id => {
      if (!room) return LOCAL_CONTROLLER;
      const owner = ownerOf(room, id);
      return owner === room.hostId ? LOCAL_CONTROLLER : owner;
    };
    if (membersOf(partyRef.current).every(m => m.controlledBy === want(m.id))) return;
    setParty(p => ({ ...p, members: p.members.map(m => ({ ...m, controlledBy: want(m.id) })) }));
    // Only when the owners change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownersKey]);

  // Someone comes or goes: the host is told (their character is played here meanwhile)
  const presenceKey = room ? Object.values(room.players).map(p => `${p.id}:${p.connected}`).join('|') : '';
  const presenceRef = useRef('');
  useEffect(() => {
    const before = presenceRef.current;
    presenceRef.current = presenceKey;
    if (!room || !before) return;
    const was = Object.fromEntries(before.split('|').map(x => x.split(':')));
    Object.values(room.players).forEach(p => {
      if (p.isHost || was[p.id] === String(p.connected)) return;
      if (was[p.id] === undefined && !p.connected) return;
      const theirs = heroes.filter(h => ownerOf(room, h.id) === p.id).map(h => h.name);
      setOnlineNotice(p.connected
        ? `🟢 ${p.name} ha entrado en la sala.${theirs.length ? ` Vuelve a jugar con ${theirs.join(' y ')}.` : ' Puede elegir un personaje libre.'}`
        : `⚪ ${p.name} se ha desconectado.${theirs.length ? ` Juegas con ${theirs.join(' y ')} hasta que vuelva.` : ''}`);
    });
    // Only when someone's connection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceKey]);

  // Play a queued action with the usual handlers (the acting member was selected first)
  const runQueued = ({ kind, payload, characterId }) => {
    const sheet = memberSheet(partyRef.current, characterId);
    if (kind === 'text') return handleSendAction(payload.text);
    if (kind === 'check') {
      if (payload.skillId) {
        const skill = getSkill(payload.skillId);
        return skill ? handleRollCheck({ label: skill.name, modifier: skillModifier(sheet, skill.id), ability: skill.ability, skillId: skill.id }) : null;
      }
      return handleRollCheck({ label: ABILITY_NAMES[payload.ability], modifier: getModifierNumber(sheet.stats?.[payload.ability] ?? 10), ability: payload.ability });
    }
    if (kind === 'attack') return handleAttack({ optionId: payload.optionId, target: payload.target, targetAC: payload.targetAC || undefined, raging: payload.raging });
    if (kind === 'spell') return handleCastSpell(payload.spellId, payload.target);
    const item = (sheet.inventory || []).find(i => i.id === payload.itemId);
    if (!item) return pushSystemMessage(`🎒 ${sheet.name} ya no tiene ese objeto.`);
    return handleUseItem(item);
  };

  // The queue: one action at a time, when Duncan is free (paused during a fight)
  const queueHead = room?.queue[0] || null;
  useEffect(() => {
    if (!room || !queueHead || queueRunning || isGenerating || combatBusy || encounter || isRollingCheckRef.current) return;
    const check = stillValid(room, gameRef.current, queueHead);
    if (!check.ok) {
      online.update(r => dequeueAction(r, queueHead.id));
      tell(queueHead.playerId, `Se descarta «${queueHead.label}»: ${check.error}.`);
      return;
    }
    if (partyRef.current.activeId !== queueHead.characterId) {
      handleSelectMember(queueHead.characterId);
      return;
    }
    online.update(r => dequeueAction(r, queueHead.id));
    setQueueRunning(true);
    authorRef.current = playerName(room, queueHead.playerId);
    Promise.resolve()
      .then(() => runQueued(queueHead))
      .catch(err => console.error(err))
      .finally(() => {
        authorRef.current = null;
        setQueueRunning(false);
      });
    // The handlers read the latest state from this render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueHead?.id, roomIsOpen, queueRunning, isGenerating, combatBusy, encounter, party.activeId]);

  // In a room, the host's own actions also go through the room (checks and queue)
  const submit = intent => {
    const res = online.submit(intent);
    if (!res.ok) setOnlineNotice(res.error);
  };
  const mine = sheetIntents(character.id);
  const act = room ? {
    send: text => submit(mine.text(text)),
    check: args => submit(mine.check(args)),
    quickCheck: skillId => submit(mine.check({ skillId })),
    spell: (spellId, target) => submit(mine.spell(spellId, target)),
    item: item => submit(mine.item(item)),
    combat: action => submit({ type: 'combat', characterId: turnUid, action })
  } : {
    send: handleSendAction,
    check: handleRollCheck,
    quickCheck: handleQuickCheck,
    spell: handleCastSpell,
    item: handleUseItem,
    combat: handleCombatAction
  };
  const hostActors = room ? heroes.filter(h => canControl(room, room.hostId, h.id)) : null;
  // In a room, the equipment and level of a player's character are theirs to change
  const notMine = () => {
    if (!room || canControl(room, room.hostId, character.id)) return false;
    setOnlineNotice(`${character.name} lo juega ${playerName(room, controllerOf(room, character.id))}: su equipo y su subida de nivel los decide su jugador.`);
    return true;
  };
  const turnPlayer = room && turnUid && controllerOf(room, turnUid) !== room.hostId ? playerName(room, controllerOf(room, turnUid)) : null;
  const storyNotice = !room ? null
    : !canControl(room, room.hostId, character.id) ? `${character.name} lo juega ${playerName(room, controllerOf(room, character.id))}: elige a uno de los tuyos para actuar.`
      : isGenerating || queueRunning ? 'Duncan está respondiendo: lo que escribas esperará en la cola de la sala.' : null;
  const hostOps = room ? {
    assign: (characterId, playerId) => online.update(r => (playerId
      ? claimCharacter(r, playerId, characterId, heroIds, { byHost: true })
      : releaseCharacter(r, r.claims[characterId], characterId, heroIds, { byHost: true })).room || r),
    breakTie: (characterId, playerId) => online.update(r => breakTie(r, characterId, playerId).room || r),
    closeVote: characterId => online.update(r => closeVote(r, characterId)),
    remove: playerId => {
      const theirs = heroes.filter(h => ownerOf(room, h.id) === playerId).map(h => h.name);
      online.update(r => removePlayer(r, playerId));
      if (theirs.length) setOnlineNotice(`${theirs.join(' y ')} ${theirs.length > 1 ? 'se quedan' : 'se queda'} en el grupo y ahora ${theirs.length > 1 ? 'los juegas' : 'lo juegas'} tú. Si quieres que se despida, hazlo desde su ficha («Despedir») o deja que lo cuente la historia.`);
    },
    closeRoom: () => {
      online.close();
      setIsRoomOpen(false);
    }
  } : null;
  const unreadChat = room ? Math.max(0, room.chat.length - chatSeen) : 0;
  const chatLength = room?.chat.length || 0;
  useEffect(() => {
    if (isRoomOpen) setChatSeen(chatLength);
  }, [isRoomOpen, chatLength]);

  return (
    <div className="h-screen flex flex-col bg-[#0b090e] overflow-hidden">
      
      {/* Top Application Bar: where you are and the online room; the rest lives in the «⋯» menu */}
      <header className="h-14 bg-[#120f18] border-b border-amber-950/60 px-2 sm:px-4 flex items-center gap-2 shrink-0 z-30">
        <button
          onClick={onBackToLanding}
          className="shrink-0 flex items-center gap-1 p-1.5 text-xs text-stone-400 hover:text-amber-300 transition-colors"
          title="Volver a la portada"
          aria-label="Volver a la portada"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden md:inline">Portal</span>
        </button>

        {/* The campaign's title opens the Grimorio */}
        <button
          onClick={onOpenCampaigns}
          className="min-w-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1a1523] hover:bg-stone-800 border border-amber-900/50 text-amber-200 hover:text-amber-300 text-xs font-cinzel font-bold transition-all shadow-sm"
          title="Abrir el Grimorio de campañas guardadas"
        >
          <BookOpen className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span className="truncate max-w-[40vw] sm:max-w-[260px]">{campaignTitle}</span>
        </button>

        {/* Saving only shows up when it fails: then it is the way out (export) */}
        {saveStatus !== 'saved' && (
          <button
            onClick={() => exportCampaignAsJson(currentCampaignId)}
            className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-red-300 bg-red-950/50 px-2 py-1 rounded border border-red-800/60 animate-pulse"
            title={saveStatus === 'quota'
              ? 'El almacenamiento del navegador está lleno: el progreso NO se está guardando. Exporta la campaña y borra partidas antiguas en el Grimorio.'
              : 'No se pudo guardar el progreso en el navegador. Exporta la campaña para no perderla.'}
          >
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="hidden sm:inline">{saveStatus === 'quota' ? 'Almacenamiento lleno' : 'Error al guardar'}</span>
          </button>
        )}

        <div className="flex-1" />

        {/* Online room */}
        <button
          onClick={() => setIsRoomOpen(true)}
          className={`shrink-0 relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            room ? 'bg-sky-950/70 border-sky-600/60 text-sky-200' : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-sky-300'
          }`}
          title={room ? `Sala online ${room.code}` : 'Jugar online con tus amigos'}
        >
          <Wifi className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{room ? `Sala ${room.code}` : 'Online'}</span>
          {unreadChat > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-stone-950 text-[9px] font-bold flex items-center justify-center">{unreadChat}</span>}
        </button>

        <MenuButton
          className="shrink-0"
          title="Más opciones"
          icon={<MoreHorizontal className="w-4 h-4" />}
          buttonClassName="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-stone-100 transition-colors"
          items={[
            { label: 'Simulador de combates', icon: <FlaskConical className="w-4 h-4 text-sky-300" />, hint: 'Prueba o revive combates sin tocar la campaña', onClick: () => onOpenSimulator({ campaignId: currentCampaignId }) },
            { label: 'Exportar esta campaña (.json)', icon: <Download className="w-4 h-4 text-emerald-400" />, onClick: () => exportCampaignAsJson(currentCampaignId) },
            { label: 'Compartir El Grifo', icon: <Users className="w-4 h-4 text-amber-500" />, onClick: onOpenInvite },
            {
              label: isAudioActive ? 'Silenciar el ambiente de taberna' : 'Audio de taberna',
              icon: isAudioActive ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-stone-400" />,
              onClick: toggleSound
            },
            'divider',
            { label: 'Ajustes', hint: 'IA, dados 3D, sonido y partida', icon: <Settings className="w-4 h-4 text-stone-300" />, onClick: onOpenSettings }
          ]}
        />
      </header>

      {/* Main 3-Column Desktop Layout / Tabbed Mobile View */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Column: Party & Sheet (300px on desktop) */}
        <div className={`w-full ${encounter ? 'lg:w-60 xl:w-64' : 'lg:w-72 xl:w-80 2xl:w-88'} shrink-0 ${mobileTab === 'party' ? 'block' : 'hidden lg:block'}`}>
          <PartyPanel
            character={character}
            party={heroes}
            purse={party.gold}
            onSelectMember={handleSelectMember}
            onDismissMember={handleDismissMember}
            onTransferItem={handleTransferItem}
            longRestCost={longRestCost(party)}
            onUpdateCharacter={next => (notMine() ? null : setCharacter(normalizeEquipment(next)))}
            onOrderDrink={handleOrderDrink}
            onRollCheck={act.check}
            onCastSpell={act.spell}
            onRest={handleRest}
            onLevelUp={() => (notMine() ? null : setIsLevelUpOpen(true))}
            onUseItem={act.item}
            busy={isGenerating}
            inCombat={inCombat}
            atTavern={isAtTavern(world)}
          />
        </div>

        {/* Center Column: Story Stream (Flexible width) */}
        <div className={`flex-1 min-w-0 flex-col h-full overflow-hidden ${mobileTab === 'story' ? 'flex' : 'hidden lg:flex'}`}>
          {encounter ? (
            <Suspense fallback={null}>
              <CombatView
                encounter={encounter}
                heroes={heroes}
                onAction={act.combat}
                onFinish={handleFinishEncounter}
                busy={combatBusy}
                waitingFor={turnPlayer}
                endActions={encounter.snapshotId && combatSnapshots.some(s => s.id === encounter.snapshotId) ? (
                  <button
                    onClick={() => onOpenSimulator({ snapshot: combatSnapshots.find(s => s.id === encounter.snapshotId), campaignId: currentCampaignId })}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${encounter.status === 'defeat' ? 'bg-sky-700 hover:bg-sky-600 border-sky-500 text-white' : 'border-sky-800 text-sky-200 hover:bg-sky-950/50'}`}
                    title="Repite este combate desde el principio en el simulador: no afecta a tu campaña"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Revivir en el simulador
                  </button>
                ) : null}
              />
            </Suspense>
          ) : (
            <StoryStream
              messages={messages}
              isGenerating={isGenerating}
              suggestedActions={suggestedActions}
              character={character}
              party={heroes}
              onSelectMember={handleSelectMember}
              pendingRecruit={pendingRecruit}
              onAnswerRecruit={handleAnswerRecruit}
              world={world}
              onSendAction={act.send}
              onOpenGeminiConnect={onOpenGeminiConnect}
              keysCount={geminiKeys.length}
              onDiceRoll={handleDiceRollToChat}
              onQuickCheck={act.quickCheck}
              actors={hostActors}
              inputLocked={room ? hostActors.length === 0 : null}
              inputNotice={storyNotice}
            />
          )}
        </div>

        {/* Right Column: World Map & Factions (300px on desktop) */}
        <SideColumn
          collapsed={Boolean(encounter)}
          mobileVisible={mobileTab === 'map'}
          railIcons={[MapIcon, ScrollText]}
          badge={unseenQuestCount(quests)}
        >
          <WorldMapPanel
            world={world}
            onTravelToNode={handleTravelToNode}
            summary={summary}
            events={events}
            quests={quests}
            onAbandonQuest={handleAbandonQuest}
            onQuestSeen={handleQuestSeen}
            onOpenShop={encounter ? null : handleOpenShop}
          />
        </SideColumn>

      </div>


      {activeShop && !encounter && (
        <Suspense fallback={null}>
          <ShopModal
            shop={activeShop}
            character={character}
            onBuy={handleBuy}
            onSell={handleSell}
            onClose={() => setActiveShopKey(null)}
          />
        </Suspense>
      )}

      {isLevelUpOpen && canLevelUp(character) && (
        <Suspense fallback={null}>
          <LevelUpModal
            character={character}
            onConfirm={handleLevelUpConfirmed}
            onClose={() => setIsLevelUpOpen(false)}
          />
        </Suspense>
      )}

      <OpenedOnce when={isRoomOpen}>
        <HostRoomDrawer
          isOpen={isRoomOpen}
          onClose={() => setIsRoomOpen(false)}
          kind={onlineKind}
          online={online}
          defaultName={storedPlayerName()}
          onOpenRoom={openRoom}
          me={room?.hostId}
          characters={heroes}
          link={room ? roomLink(room.code, onlineKind) : ''}
          onIntent={submit}
          hostOps={hostOps}
        />
      </OpenedOnce>
      <OnlineToast text={onlineNotice} onClose={() => setOnlineNotice(null)} />

      {/* Phone: the sections in a bar at the bottom */}
      <MobileTabBar
        active={mobileTab}
        onChange={setMobileTab}
        tabs={[
          { id: 'story', label: encounter ? 'Combate' : 'Crónica', icon: encounter ? Swords : ScrollText },
          { id: 'party', label: heroes.length > 1 ? `Grupo (${heroes.length})` : `Ficha · ${character.hp} PG`, icon: Shield },
          { id: 'map', label: 'Mapa', icon: MapIcon, badge: unseenQuestCount(quests) }
        ]}
      />


    </div>
  );
}
