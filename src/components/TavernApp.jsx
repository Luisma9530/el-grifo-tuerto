import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Volume2, VolumeX, Users, Settings, ArrowLeft, Download, AlertTriangle, FlaskConical, RotateCcw, BookOpen, Wifi, MoreHorizontal, ScrollText, Shield, Map as MapIcon, Swords } from 'lucide-react';
import MenuButton from './MenuButton';
import PartyPanel from './game/PartyPanel';
import StoryStream from './game/StoryStream';
import WorldMapPanel from './game/WorldMapPanel';
import { MobileTabBar, SideColumn } from './game/GameLayout';
import { PRESET_WORLDS, PRESET_CHARACTERS } from '../data/gameData';
import { generateDMResponse, rollDie, getStoredGeminiKeys, getModifierNumber } from '../utils/gameEngine';
import { castSpell, describeCast } from '../utils/spellcasting';
import { opponentFromText, targetAC, rollTargetSave } from '../utils/checks';
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
import { drinkPotion, healingDice, formatCoins } from '../utils/items';
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
import {
  isSplit, groupOf, groupById, groupsOf, sceneIdOf, chronicleKey, chronicleKeyOf, scopeParty, unscopeParty, inScope, sceneWorld, withCurrentNode,
  sceneMessages, tagNewMessages, moveGroup, meetingNames, setHook, setSuggestions, countSceneTurn, laneQueue, joinNames, groupNames,
  readablePrologues, visibleScenes, placeNewMember, isOriginsCampaign
} from '../utils/splitParty';
import { sceneNoteFor, hookLabel, zonesFor, suggestZone, zoneIntro } from '../utils/origins';
import { sceneApiKeys, lentKeysByScene, sharedLentKeys, fallbackKeys, askWithKeyFallback } from '../utils/sceneKeys';
import { LOCAL_CONTROLLER } from '../utils/party';
import { onlineConfig, roomLink } from '../online/transport';
import { useHostRoom, wasOnline, storedPlayerName, storePlayerName } from '../online/useOnlineRoom';
import { buildSections } from '../online/snapshot';
import {
  ownerOf, controllerOf, canControl, playerName, claimCharacter, releaseCharacter, breakTie, closeVote, removePlayer, dequeueAction, enqueueAction, setShareScenes
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

// Creatures of the bestiary for checks and spells against one of them (no fight on the way)
const loadCreatures = () => import('../utils/bestiary');

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

  // The world as saved; `world` (below) is the world as the scene of whoever acts sees it
  const [worldState, setWorld] = useState(() => storedCampaign()?.world || activeWorld);

  // The party (see party.js): older campaigns become a party of one. The ref
  // holds the latest party for handlers that wait on Duncan or on the dice.
  const [party, setPartyState] = useState(() => {
    const camp = storedCampaign();
    return (camp && migrateCampaign(camp).party) || createParty([activeCharacter]);
  });
  const partyRef = useRef(party);
  const setParty = next => {
    const before = partyRef.current;
    const value = typeof next === 'function' ? next(before) : next;
    partyRef.current = value;
    setPartyState(value);
    // The last ones apart got together (or the others left): the party is where that group was,
    // and a fight of that group (if any) is now the party's
    if (isSplit(before) && !isSplit(value)) {
      const last = groupOf(before, value.members[0]?.id);
      if (last?.nodeId) setWorld(w => withCurrentNode(w, last.nodeId));
      const fight = last ? encountersRef.current[last.id] : null;
      if (fight) {
        setEncounterIn(last.id, null);
        setEncounterIn('', fight);
      }
    }
  };
  // The party may be apart (see splitParty.js): each group plays its own scene. The
  // scene of whoever acts decides what is seen and touched: the members who are
  // there, their purse, their place on the map and their chronicle.
  const sceneParty = (id = partyRef.current.activeId) => scopeParty(partyRef.current, id);
  const setSceneParty = (id, next) => setParty(p => unscopeParty(p, id, next));
  // Change one member (functions get the latest sheet, with their scene's purse as `gold`)
  const updateMemberState = (id, update) => setParty(p => inScope(p, id, s => updateMember(s, id, update)));
  const scene = scopeParty(party);
  const sceneId = sceneIdOf(party);
  const world = sceneWorld(worldState, party);
  // The member who acts outside combat
  const character = activeSheet(scene);
  const setCharacter = update => updateMemberState(character.id, update);

  // The ambience can also be switched in Ajustes: read it from the player, this only re-renders
  const [, setAudioTick] = useState(0);
  const isAudioActive = Boolean(tavernAudio.isAmbiencePlaying);
  const [mobileTab, setMobileTab] = useState('story'); // 'story' | 'party' | 'map'
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());

  // Lanes. While the party is apart, each group is a "system" of its own running in
  // parallel: its call to Duncan, its dice, its fight, its queue online. A lane is a
  // group's id, or '' for the party together. Within a lane, one thing at a time.
  //   { [lane]: { generating, rolling, combat } }  (combat: a fight's dice are rolling)
  const [lanes, setLanes] = useState({});
  const lanesRef = useRef({});
  const laneOf = (memberId = partyRef.current.activeId) => sceneIdOf(partyRef.current, memberId) || '';
  const laneFlag = (lane, flag) => Boolean(lanesRef.current[lane]?.[flag]);
  const setLaneFlag = (lane, flag, on) => {
    const next = { ...lanesRef.current, [lane]: { ...lanesRef.current[lane], [flag]: on } };
    lanesRef.current = next;
    setLanes(next);
  };

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

  const [messages, setMessagesState] = useState(() => {
    const camp = storedCampaign();
    if (camp?.messages?.length > 0) return camp.messages;
    return [{ sender: 'duncan', text: activeWorld.initialStory, timestamp: 'Inicio de Campaña' }];
  });
  // While the party is apart, every new message belongs to a scene (its group's
  // chronicle). Handlers of a lane write in theirs (`setMessagesIn`, `sayTo`); the
  // plain ones write in the scene of whoever acts on this screen.
  const setMessagesIn = (key, next) => setMessagesState(prev => tagNewMessages(prev, typeof next === 'function' ? next(prev) : next, key));
  const setMessages = next => setMessagesIn(chronicleKeyOf(partyRef.current), next);
  // The online room open now (for handlers that run after a reply)
  const roomRef = useRef(null);
  // The Gemini keys lent by the players of the online room (memory only, see online/keyLending.js)
  const lentKeysRef = useRef(() => ({}));
  // A line for a given scene (the one the spotlight passes to, for example)
  const pushSceneMessage = (key, text) => setMessagesState(prev => [...prev, { sender: 'system', text, timestamp: now(), ...(key ? { groupId: key } : {}) }]);
  // A line in the chronicle of a member's scene
  const sayTo = memberId => text => pushSceneMessage(chronicleKeyOf(partyRef.current, memberId), text);

  const [summary, setSummary] = useState(() => storedCampaign()?.summary || '');
  const [summaryCoverage, setSummaryCoverage] = useState(() => storedCampaign()?.summaryCoverage || 0);
  const [events, setEvents] = useState(() => storedCampaign()?.events || []);
  const recordEvent = text => setEvents(prev => addEvent(prev, text));

  // Fights in progress, one per lane (the party's is saved as `encounter`, those of the
  // groups apart as `encounters`). The ref holds the latest for handlers that wait on dice.
  const encountersFrom = camp => {
    const out = { ...(camp?.encounters || {}) };
    if (camp?.encounter) out[''] = camp.encounter;
    return out;
  };
  const [encounters, setEncountersState] = useState(() => {
    const camp = storedCampaign();
    return camp ? encountersFrom(migrateCampaign(camp)) : {};
  });
  const encountersRef = useRef(encounters);
  const encounterOf = lane => encountersRef.current[lane] || null;
  const setEncounterIn = (lane, update) => {
    const prev = encountersRef.current;
    const value = typeof update === 'function' ? update(prev[lane] || null) : update;
    const next = { ...prev };
    if (value) next[lane] = value;
    else delete next[lane];
    encountersRef.current = next;
    setEncountersState(next);
  };
  // The lane of a fight (of the scene of those who fight)
  const laneOfFight = fight => laneOf((fight?.heroIds || []).find(id => membersOf(partyRef.current).some(m => m.id === id)));
  // How each recent fight started (the last MAX_SNAPSHOTS), to replay it in the simulator
  const [combatSnapshots, setCombatSnapshots] = useState(() => normalizeSnapshots(storedCampaign()?.combatSnapshots));

  // Shops visited (their stock is kept) and the one open now; saved with the campaign
  const [shops, setShops] = useState(() => normalizeShops(storedCampaign()?.shops));
  const [activeShopKey, setActiveShopKey] = useState(null);

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
  // Online: the player whose queued action is being played in each lane (shown in the chronicle)
  const authorsRef = useRef({});
  // What this screen shows: the lane of whoever acts here
  const viewLane = sceneIdOf(party) || '';
  const encounter = encounters[viewLane] || null;
  const isGenerating = Boolean(lanes[viewLane]?.generating);
  const combatBusy = Boolean(lanes[viewLane]?.combat);
  // Dice on the table: the 3D dice are shown for the lane on screen, the others roll unseen
  const diceFor = lane => roll => (lane === (sceneIdOf(partyRef.current) || '') ? animateRoll(roll) : Promise.resolve());
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
      const newCamp = createNewCampaign({ world: worldState, party, title: campaignTitle });
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
      setMessagesState(camp.messages || []);
      setSummary(camp.summary || '');
      setSummaryCoverage(camp.summaryCoverage || 0);
      setEvents(camp.events || []);
      encountersRef.current = encountersFrom(camp);
      setEncountersState(encountersRef.current);
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
    // Only when another campaign is loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      world: worldState,
      party,
      messages,
      suggestedActions,
      summary,
      summaryCoverage,
      events,
      encounter: encounters[''] || null,
      encounters: Object.fromEntries(Object.entries(encounters).filter(([lane]) => lane)),
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
  }, [messages, party, worldState, campaignTitle, currentCampaignId, suggestedActions, summary, summaryCoverage, events, encounters, shops, combatSnapshots, quests, pendingRecruit, lastAmbush]);

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
  // `meeting`: { joined, place } groups that were apart just met here (Duncan narrates the meeting)
  const handleSendAction = async (actionText, {
    playerRoll = null, sheet = character, spellCast = null, rest = null, effectsApplied = false,
    weaponAttack = null, combatResult = null, loot = null, meeting = null, checkIntent = null
  } = {}) => {
    const actorId = sheet.id;
    // Each lane narrates one action at a time; other groups' lanes go on in parallel
    const lane = laneOf(actorId);
    if (!actionText || laneFlag(lane, 'generating')) return;
    // Only the members of the actor's scene take part (all of them when the party is together)
    const partyFull = partyRef.current;
    const partyNow = scopeParty(partyFull, actorId);
    const size = membersOf(partyNow).length;
    const group = groupOf(partyFull, actorId);
    // The chronicle this scene writes in (null: the common one)
    const ownChronicle = chronicleKey(group);
    // The world from this scene's place (it may have just travelled)
    const world = sceneWorld(worldState, partyFull, actorId);
    // This scene's lines and its fight (another scene may be on screen meanwhile)
    const pushSystemMessage = text => pushSceneMessage(ownChronicle, text);
    const setMessages = next => setMessagesIn(ownChronicle, next);
    const encounter = encounterOf(lane);

    // Add the action to messages, with who did it (not for the narration after a fight)
    const playerMessage = {
      sender: 'player', actor: sheet.name, avatar: sheet.avatar, text: actionText, timestamp: now(),
      ...(authorsRef.current[lane] ? { by: authorsRef.current[lane] } : {}), ...(ownChronicle ? { groupId: ownChronicle } : {})
    };
    const newMsgList = combatResult ? messages : [...messages, playerMessage];
    // (lines just added with functional updates, like the fight's or a rest's, are kept)
    if (!combatResult) setMessages(prev => [...prev, playerMessage]);
    setLaneFlag(lane, 'generating', true);

    try {
      const currentKeys = getStoredGeminiKeys();
      setGeminiKeys(currentKeys);
      // Online, the keys the players lent: their group's scene uses them while apart;
      // together, they join the host's in one pool (see sceneKeys.js)
      const onlineRoom = roomRef.current;
      const lent = onlineRoom ? lentKeysRef.current() : {};
      const duncanKeys = sceneApiKeys(currentKeys, {
        sceneId: group?.id || null,
        keysByScene: onlineRoom && group ? lentKeysByScene({
          groups: groupsOf(partyFull), playerOf: cid => controllerOf(onlineRoom, cid), lent, hostId: onlineRoom.hostId, hostKeys: currentKeys
        }) : null,
        sharedKeys: onlineRoom && !group ? sharedLentKeys(lent) : null
      });
      // A group apart playing with its players' lent keys: if those fail, the host's keep it going
      const reserveKeys = onlineRoom && group && duncanKeys !== currentKeys ? fallbackKeys(duncanKeys, currentKeys) : [];
      const lentHere = duncanKeys.filter(k => k.playerId);
      const lenderNames = joinNames([...new Set(lentHere.map(k => k.playerId))].map(id => playerName(onlineRoom, id)));

      // A plain action outside combat may start a fight: Duncan gets a short list of creatures
      const mayStartFight = !encounter && !combatResult && !playerRoll && !spellCast && !rest && !weaponAttack && !meeting && !checkIntent;
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
      // this same call every few turns (only when the AI is connected). While the
      // party is apart, Duncan sees only this scene's chronicle and the summary waits
      // until they are together (it would mix the scenes).
      const apart = isSplit(partyFull);
      const requestSummary = !apart && duncanKeys.length > 0 && needsSummary(newMsgList, summaryCoverage);
      const history = apart
        ? historyForPrompt(sceneMessages(newMsgList, ownChronicle), 0)
        : historyForPrompt(newMsgList, summaryCoverage).filter(m => !m.groupId);
      // A group apart that still has no reason to go to the meeting point: Duncan may give one
      // (the local engine does from this group's second scene on, if he didn't)
      const meetingNode = apart ? worldState.mapNodes?.find(n => n.id === partyFull.split.meetingNodeId) : null;
      const askHook = group && !group.hook && meetingNode && group.nodeId !== meetingNode.id && !combatResult && !meeting
        ? { place: meetingNode.name, names: groupNames(partyFull, group), force: (group.turns || 0) >= 1 }
        : null;
      // A check against a creature of the bestiary uses its sheet (loaded once, no fight)
      const creatures = bestiaryModule || (!combatResult ? await loadCreatures().catch(() => null) : null);
      const response = await askWithKeyFallback(apiKeys => generateDMResponse({
        checkIntent,
        getMonster: creatures?.getMonster || null,
        // What the player is trying when the check comes from the sheet
        contextText: history.slice(-3).map(m => String(m.text || '')).join(' ').slice(-600),
        playerAction: actionText,
        character: sheet,
        world,
        history,
        sceneNote: apart || meeting ? sceneNoteFor(partyFull, actorId, worldState, { meeting }) : '',
        meetingHook: askHook,
        meeting,
        apiKeys,
        // Several scenes call at once: on the per-minute limit this one waits and tells its players
        onQuotaWait: apart ? seconds => pushSystemMessage(`⏳ Gemini ha llegado a su límite de peticiones por minuto: Duncan lo intenta de nuevo en ${seconds} s (las demás escenas siguen).`) : null,
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
        allowRecruit: mayStartFight && membersOf(partyFull).length < MAX_PARTY && !pendingRecruit,
        allowDeparture: !combatResult && !encounter && size > 1,
        lastWasAmbush: lastAmbush
      }), {
        keys: duncanKeys,
        reserve: reserveKeys,
        onFallback: () => pushSystemMessage(`🔑 ${lentHere.length > 1 ? 'Las claves' : 'La clave'} de ${lenderNames || 'tu grupo'} no ${lentHere.length > 1 ? 'responden' : 'responde'} ahora (sin cuota o con un error): Duncan sigue con las del anfitrión.`)
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
      // (a check shows its DC or who resists: «Engaño 14 contra Perspicacia del erudito 17»)
      if (response.roll) {
        const isEnemySave = spellCast?.spell.kind === 'save';
        const label = response.check ? `${sheet.name} · ${response.check.label}` : isEnemySave ? 'Salvación del objetivo' : 'Tirada de acción';
        await animateRoll({ ...response.roll, label });
      }

      // Apply the consequences of the scene: to the member who acted, or to the members
      // Duncan names (a trap, an explosion...); the gold is the party's (see partyActions.js).
      // When the game already applied this action's healing and gold, the narrator can only add damage
      const damage = response.damageTaken || 0;
      const healing = effectsApplied ? 0 : response.healing || 0;
      const goldChange = effectsApplied ? 0 : response.goldEarned || 0;
      const scene = applySceneEffects(sceneParty(actorId), actorId, {
        damage, healing, goldChange, damageTargets: response.damageTargets, healingTargets: response.healingTargets
      });
      if (damage || healing || goldChange) setSceneParty(actorId, scene.party);
      const groupHit = scene.hit.length > 1 || (scene.hit[0] && scene.hit[0] !== sheet.name);
      const groupHealed = scene.healed.length > 1 || (scene.healed[0] && scene.healed[0] !== sheet.name);

      // Limbs lost, disabled or healed in the story (validated by parseDMReply)
      const limbs = fightGroups.length ? { applied: [] } : applySceneLimbs(sceneParty(actorId), actorId, response.limbChanges || []);
      if (limbs.applied.length) {
        setSceneParty(actorId, limbs.party);
        limbs.applied.forEach(({ name, change }) => recordEvent(limbFact(name, change)));
      }

      // Conditions applied or removed by the story (validated by parseDMReply)
      const conditionResult = fightGroups.length ? { applied: [], collapsed: [] } : applySceneConditions(sceneParty(actorId), actorId, response.conditionChanges || []);
      if (conditionResult.applied.length) {
        setSceneParty(actorId, conditionResult.party);
        conditionResult.applied.forEach(({ name, change }) => {
          const fact = conditionFact(name, change);
          if (fact) recordEvent(fact);
        });
      }

      // Experience from the story goes to every member; quest rewards to the party
      const ready = new Set();
      if (response.xpEarned > 0 || questsPaid.length) {
        let next = sceneParty(actorId);
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
        setSceneParty(actorId, next);
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
      if (conditionResult.goldLost > 0) pushSystemMessage(`🪙 Los cuidados de Duncan cuestan ${formatCoins(conditionResult.goldLost)} de la bolsa.`);

      ready.forEach(name => pushSystemMessage(levelReadyLine(name)));

      // Dropping to 0 HP: Duncan patches the hero up... at a price (paid once from the purse)
      scene.knockedOut.forEach(k => {
        recordEvent(`${k.name} cayó inconsciente y Duncan lo curó`);
        pushSystemMessage(`💀 ${k.name} cae inconsciente. Maese Duncan se encarga de remendarle junto a la chimenea: despierta con ${k.hp} PG.`);
      });
      if (scene.goldLost > 0) pushSystemMessage(`🪙 Los cuidados de Duncan cuestan ${formatCoins(scene.goldLost)} de la bolsa.`);

      // A companion offers to join: the game builds the sheet, the player decides
      if (response.recruit && !fightGroups.length) {
        const offer = makeRecruitOffer(response.recruit, sceneParty(actorId), { scene: newMsgList.length + 1 });
        if (offer) {
          // (who met them: the companion joins that member's group)
          setPendingRecruit({ ...offer, withId: actorId });
          pushSystemMessage(`🤝 ${offer.character.name} (${offer.character.race} · ${offer.character.className}, nivel ${offer.character.level}) quiere unirse al grupo. Decide si lo aceptas bajo la crónica.`);
        }
      }
      // A member leaves the party through the story
      const leaving = response.departure ? departingMember(sceneParty(actorId), response.departure) : null;
      if (leaving) {
        const res = removeMember(partyRef.current, leaving.id);
        if (res.ok) {
          setParty(res.party);
          recordEvent(`${leaving.name} deja el grupo${response.departure.reason ? ` (${response.departure.reason})` : ''}`);
          pushSystemMessage(`🚪 ${leaving.name} deja el grupo${response.departure.reason ? `: ${response.departure.reason}` : ''}. Se lleva su equipo.`);
        }
      }

      if (response.exploration) setLastAmbush(response.exploration.ambushed);
      // Each scene keeps its own suggestions while the party is apart
      const sceneNow = sceneIdOf(partyRef.current, actorId);
      if (response.suggestedActions) {
        if (sceneNow) setParty(p => setSuggestions(p, sceneNow, response.suggestedActions));
        else setSuggestedActions(response.suggestedActions);
      }

      // The reason this group goes to the meeting point (Duncan's or the local engine's)
      if (response.meetingHook && sceneNow && !groupById(partyRef.current, sceneNow)?.hook) {
        const hookGroup = groupById(partyRef.current, sceneNow);
        const place = worldState.mapNodes?.find(n => n.id === partyRef.current.split.meetingNodeId);
        setParty(p => setHook(p, sceneNow, response.meetingHook));
        // The meeting point can be reached from now on
        if (place?.status === 'locked') setWorld(w => ({ ...w, mapNodes: w.mapNodes.map(n => (n.id === place.id ? { ...n, status: 'discovered' } : n)) }));
        recordEvent(`${groupNames(partyRef.current, hookGroup)}: ${hookLabel(response.meetingHook.kind).toLowerCase()} que lleva a ${place?.name || 'la taberna'}`);
        pushSystemMessage(`🧭 ${hookLabel(response.meetingHook.kind)}: ${response.meetingHook.text} Rumbo: ${place?.name || 'la taberna'} (viaja desde el mapa cuando quieras).`);
      }

      if (fightGroups.length) startEncounter(fightGroups, { byDuncan: true, start: response.combat, actionText, actorId });
      else if (response.shop && SHOP_TYPES[response.shop]) {
        // The shop window opens on this screen only for the scene on it
        if (lane === laneOf()) handleOpenShop(response.shop, { byDuncan: true });
        else pushSystemMessage(`🛒 Aquí hay ${SHOP_TYPES[response.shop].name.toLowerCase()}: las compras las hace el anfitrión desde esta escena.`);
      }
      else if (sceneNow && !combatResult) passSpotlight(sceneNow);
    } catch (err) {
      console.error(err);
    } finally {
      setLaneFlag(lane, 'generating', false);
    }
  };

  // Turns between scenes (see splitParty.js): after SCENE_TURNS narrated actions the
  // spotlight passes to the next group. Alone, the game switches to it; online, the
  // queue alternates between the groups by itself.
  const passSpotlight = key => {
    const res = countSceneTurn(partyRef.current, key);
    setParty(res.party);
    if (!res.pass || roomRef.current) return;
    const place = worldState.mapNodes?.find(n => n.id === res.pass.nodeId)?.name || 'otro lugar';
    pushSceneMessage(chronicleKey(groupById(partyRef.current, key)), `🎬 La historia deja esta escena por un momento: mientras tanto, en ${place}… (vuelve cuando quieras eligiendo a uno de aquí).`);
    pushSceneMessage(chronicleKey(res.pass), `🎬 Mientras tanto, en ${place}: le toca a ${groupNames(res.party, res.pass)}.`);
    setActiveShopKey(null);
    setParty(p => setActiveMember(p, res.pass.memberIds[0]));
  };

  // ---------------------------------------------------------------- companions
  const handleAnswerRecruit = accept => {
    const offer = pendingRecruit;
    if (!offer) return;
    setPendingRecruit(null);
    // The companion joins the group of whoever met them, wherever it is
    const withId = membersOf(partyRef.current).some(m => m.id === offer.withId) ? offer.withId : partyRef.current.activeId;
    const pushSystemMessage = sayTo(withId);
    {
      if (!accept) {
        recordEvent(`El grupo rechaza la compañía de ${offer.character.name}`);
        pushSystemMessage(`🙅 ${offer.character.name} no se une al grupo.`);
        return;
      }
      const res = addMember(sceneParty(withId), offer.character);
      if (!res.ok) {
        pushSystemMessage(`🤝 ${res.error}`);
        return;
      }
      setSceneParty(withId, res.party);
      recordEvent(`${res.member.name} (${res.member.className}) se une al grupo`);
      pushSystemMessage(`🤝 ${res.member.name} se une al grupo: ${res.member.race} · ${res.member.className} de nivel ${res.member.level}, con su equipo inicial. Selecciónalo en la ficha para verlo o hacerlo actuar.`);
    }
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
    // Only between members who are in the same place
    if (sceneIdOf(partyRef.current, fromId) !== sceneIdOf(partyRef.current, toId)) return 'Está lejos: solo puedes pasar objetos a quien está contigo.';
    const res = transferItem(sceneParty(fromId), fromId, toId, itemId);
    if (!res.ok) return res.error;
    setSceneParty(fromId, res.party);
    const from = memberSheet(partyRef.current, fromId);
    const to = memberSheet(partyRef.current, toId);
    pushSystemMessage(`🎒 ${from.name} pasa ${res.item.name} a ${to.name}.`);
    return null;
  };

  // Choosing someone of another scene switches to that scene. Alone, not while Duncan
  // narrates or in a fight (one scene at a time, the focus passes); online the scenes
  // run in parallel, so the host may look at any of theirs.
  const handleSelectMember = id => {
    const p = partyRef.current;
    if (sceneIdOf(p, id) !== sceneIdOf(p)) {
      if (!roomRef.current && (isGenerating || encounter)) return;
      setActiveShopKey(null);
    }
    setParty(prev => setActiveMember(prev, id));
  };

  // ---------------------------------------------------------------- combat encounters
  const combatDie = sides => rollDie(sides, { silent: true });

  // `start`: how the fight starts (see readCombatStart in surprise.js): `surprise` (who is
  // caught off guard) and `heroAttacks` (the action of `actorId` was an attack: the opening strike)
  const startEncounter = (groups, { byDuncan = false, start = null, actionText = '', actorId = null } = {}) => {
    // Only those who are there fight (the whole party when it is together): the fight is
    // of their lane, with its own initiative, view and resolution
    const who0 = actorId || partyRef.current.activeId;
    const lane = laneOf(who0);
    const onScreen = lane === laneOf();
    const pushSystemMessage = sayTo(who0);
    const setEncounter = update => setEncounterIn(lane, update);
    const world = sceneWorld(worldState, partyRef.current, who0);
    const heroes = memberSheets(sceneParty(who0));
    const surprise = start?.surprise || null;
    // How the fight starts (the whole party), kept so it can be fought again in the simulator
    const snapshot = makeSnapshot({ party: heroes, groups, world, place: currentNode(world)?.name || '', byDuncan, surprise: surprise?.side || null });
    // `returnTo`: who was acting before the fight (the acting member follows the turns meanwhile)
    let next = { ...createEncounter(groups, heroes, combatDie, { surprise }), byDuncan, narrated: 0, snapshotId: snapshot.id, returnTo: who0 };
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
    if (onScreen) setActiveShopKey(null);
    setEncounter(next);
    setParty(p => {
      const merged = mergeHeroes(p, after.heroes);
      const turn = currentHeroUid(next);
      return turn && followsTurns() ? setActiveMember(merged, turn) : merged;
    });
    if (onScreen) setMobileTab('story');
    // Everything about the opening strike is clear: the game rolls it now
    if (openingPending(next) && openingReady(next.opening)) playCombatAction(next, next.opening.suggest);
  };

  // The opening strike was just played: the chronicle and the campaign memory say
  // what happened, and Duncan narrates it from the result (never his own numbers)
  const afterOpening = (before, after, heroes) => {
    if (!openingPending(before) || openingPending(after)) return after;
    const lane = laneOfFight(after);
    const pushSystemMessage = sayTo(heroes[0]?.id);
    const setEncounter = update => setEncounterIn(lane, update);
    const world = sceneWorld(worldState, partyRef.current, heroes[0]?.id);
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
    const lane = laneOfFight(after);
    const setEncounter = update => setEncounterIn(lane, update);
    const world = sceneWorld(worldState, partyRef.current, hero?.id);
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

  // Alone (or together), the acting member follows the turns of the fight; online with
  // the party apart, each fight runs on its own and the host keeps their own character
  const followsTurns = () => !roomRef.current || !isSplit(partyRef.current);

  // Play an action on this encounter (the one in state, or one just started)
  const playCombatAction = async (encounter, action) => {
    const lane = laneOfFight(encounter);
    if (laneFlag(lane, 'combat')) return;
    const setEncounter = update => setEncounterIn(lane, update);
    const animateRoll = diceFor(lane);
    const heroes = memberSheets(sceneParty(encounter.heroIds?.[0]));
    const result = playerAction(encounter, heroes, action, combatDie);
    if (!result.ok) {
      setEncounter(prev => ({ ...prev, log: [...prev.log, { round: prev.round, kind: 'info', text: `⚠️ ${result.error}` }] }));
      return;
    }
    recordInjuries(result.encounter.log.slice(encounter.log.length));
    if (result.encounter.status !== 'active' && encounter.snapshotId) {
      setCombatSnapshots(prev => setSnapshotResult(prev, encounter.snapshotId, result.encounter));
    }
    setLaneFlag(lane, 'combat', true);
    try {
      for (const roll of result.animations) {
        await animateRoll(roll);
      }
    } finally {
      setEncounter(narrateKeyMoments(encounter, afterOpening(encounter, result.encounter, result.heroes), result.character));
      setParty(p => {
        const merged = mergeHeroes(p, result.heroes);
        const turn = currentHeroUid(result.encounter);
        return turn && followsTurns() ? setActiveMember(merged, turn) : merged;
      });
      setLaneFlag(lane, 'combat', false);
    }
  };

  // Close a finished fight: chronicle line, shared XP, loot, recorded facts, rescue if everyone fell
  // (`fight`: the one on screen, or that of another lane, closed by its players online)
  const handleFinishEncounter = (fight = encounter) => {
    const encounter = fight;
    if (!encounter || encounter.status === 'active') return;
    const lane = laneOfFight(encounter);
    if (laneFlag(lane, 'generating')) return;
    const pushSystemMessage = sayTo(encounter.heroIds?.[0]);
    const world = sceneWorld(worldState, partyRef.current, encounter.heroIds?.[0]);
    const loot = generateLoot(encounter);
    const won = encounter.status === 'victory';
    // The fight was of one scene: its purse, its members
    const fighterId = (encounter.heroIds || []).find(id => membersOf(partyRef.current).some(m => m.id === id)) || partyRef.current.activeId;
    const fightParty = sceneParty(fighterId);
    const heroes = memberSheets(fightParty).filter(h => (encounter.heroIds || []).includes(h.id));
    const group = heroes.length > 1;
    const receiver = activeSheet(fightParty);
    const line = `${describeEncounterResult(encounter, heroes.length ? heroes : [character])}${won ? ` Botín: ${describeLoot(loot)}${loot.items.length ? ` (los objetos, en la mochila de ${receiver.name}; las monedas, a la bolsa común)` : ''}.` : ''}`;
    pushSystemMessage(line);
    const defeated = encounter.enemies.filter(e => e.status !== 'active').map(e => e.name);
    if (won) recordEvent(`${group ? 'El grupo vence' : 'Vence'} en combate a ${defeated.slice(0, 3).join(', ')}${defeated.length > 3 ? '…' : ''}`);
    if (encounter.status === 'fled') recordEvent(`${group ? 'El grupo huye' : 'Huye'} de un combate`);

    const result = finishFight(fightParty, encounter, { loot: won ? loot : null, receiverId: receiver.id });
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
    let rescueLine = '';
    if (result.rescue) {
      const who = group ? 'todo el grupo' : heroes[0]?.name || character.name;
      recordEvent(`${group ? 'El grupo cayó' : `${heroes[0]?.name || character.name} cayó`} en combate y Duncan ${group ? 'los' : 'lo'} curó`);
      rescueLine = `💀 Cae ${who}. Maese Duncan ${group ? 'los arrastra' : 'lo arrastra'} junto a la chimenea y ${group ? 'los remienda' : 'lo remienda'}: ${group ? 'despiertan' : 'despierta'} con la mitad de sus PG${result.rescue.goldLost > 0 ? ` y ${formatCoins(result.rescue.goldLost)} menos en la bolsa por los cuidados` : ''}.`;
      pushSystemMessage(rescueLine);
    }
    // The acting member followed the turns of the fight: back to whoever was acting before it
    if (followsTurns() && encounter.returnTo && membersOf(next).some(m => m.id === encounter.returnTo)) next = setActiveMember(next, encounter.returnTo);
    setSceneParty(fighterId, next);
    setEncounterIn(lane, null);
    // Duncan narrates the outcome (and any loot, or the rescue) from the result the game computed
    handleSendAction('Narra el final del combate', { sheet: activeSheet(next), combatResult: `${line}${questLine}${rescueLine ? ` Rescate (ya aplicado): ${rescueLine}` : ''}`, loot: won ? loot : null });
  };

  // Paralyzed, stunned, petrified...: no attacks or spells outside a fight either
  const blockedByConditions = (character, pushSystemMessage) => {
    if (!isIncapacitated(character)) return false;
    const why = ['petrificado', 'paralizado', 'aturdido', 'incapacitado'].find(id => activeIds(character).has(id));
    pushSystemMessage(`⛔ ${character.name} está ${conditionName(why || 'incapacitado').toLowerCase()} y no puede actuar.`);
    return true;
  };

  // The pieces a sheet action needs for the member who acts (`actorId`, from this screen
  // or from the online queue): their sheet with their scene's purse, their lane, their
  // scene's chronicle and dice. Several lanes may roll at once.
  const actorTools = actorId => {
    const lane = laneOf(actorId);
    return {
      lane,
      character: memberSheet(sceneParty(actorId), actorId),
      setCharacter: update => updateMemberState(actorId, update),
      pushSystemMessage: sayTo(actorId),
      animateRoll: diceFor(lane),
      busy: () => laneFlag(lane, 'generating') || laneFlag(lane, 'rolling') || Boolean(encounterOf(lane))
    };
  };

  // Weapon attack resolved by the game: Duncan only narrates the result
  const handleAttack = async ({ optionId, target = '', targetAC, raging = false }, actorId = character.id) => {
    const { lane, character, pushSystemMessage, animateRoll, busy } = actorTools(actorId);
    if (!character || busy()) return;
    if (blockedByConditions(character, pushSystemMessage)) return;
    const result = resolveAttack(character, optionId, sides => rollDie(sides, { silent: true }), { targetAC, raging });
    if (!result.ok) {
      pushSystemMessage(`⚔️ ${result.error}`);
      return;
    }

    setLaneFlag(lane, 'rolling', true);
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

      if (lane === laneOf()) setMobileTab('story');
      setLaneFlag(lane, 'rolling', false);
      handleSendAction(describeAttack(attack, target), { sheet: character, weaponAttack: attack });
    } finally {
      setLaneFlag(lane, 'rolling', false);
    }
  };

  // The 🎲 button next to «Actuar»: a skill check with the acting member's sheet
  const handleQuickCheck = (skillId) => {
    const skill = getSkill(skillId);
    if (skill) handleRollCheck({ label: skill.name, modifier: skillModifier(character, skillId), ability: skill.ability, skillId });
  };

  // When rolling an ability or skill check from the character sheet: the DC (or who
  // resists) depends on the situation, so Duncan (or the local table) sets it and the
  // game rolls it with this sheet before the narration (see checks.js)
  // `ability` / `skillId`: the armor may give Disadvantage (no training, or Stealth in heavy armor)
  const handleRollCheck = async ({ label, ability = null, skillId = null }, actorId = character.id) => {
    const { character, busy } = actorTools(actorId);
    if (!character || busy()) return;
    // Armor without training, poisoned, frightened, exhausted... (applied when it is rolled)
    const mods = checkModifiers(character, { ability, skillId });
    const both = mods.advantage.length > 0 && mods.disadvantage.length > 0;
    const disadvantage = !both && mods.disadvantage.length ? mods.disadvantage.join(', ') : null;
    const advantage = !both && mods.advantage.length ? mods.advantage.join(', ') : null;
    const tired = mods.penalty ? ` (agotamiento: −${mods.penalty})` : '';
    const textDesc = `Intento una prueba de ${label}${disadvantage ? ` con desventaja (${disadvantage})` : advantage ? ` con ventaja (${advantage})` : ''}${tired}.`;
    handleSendAction(textDesc, { sheet: character, checkIntent: { skillId, ability, label } });
  };

  // Casting a spell from the sheet: roll its dice, spend the slot and tell the Dungeon Master.
  // A healing spell whose target is a member of the party heals that member.
  const handleCastSpell = async (spellId, target = '', actorId = character.id) => {
    const { lane, character, setCharacter, pushSystemMessage, animateRoll, busy } = actorTools(actorId);
    if (!character || busy()) return;
    if (blockedByConditions(character, pushSystemMessage)) return;

    const result = castSpell(character, spellId, sides => rollDie(sides, { silent: true }));
    if (!result.ok) {
      pushSystemMessage(`✨ ${result.error}`);
      return;
    }

    setLaneFlag(lane, 'rolling', true);
    try {
      const { cast } = result;
      const { spell } = cast;
      // Who it is cast on: a creature of the bestiary or an NPC profile ("el guardia")
      // gives its Armor Class and saving throws; unknown targets use AC 12 and +1
      const needsTarget = cast.attack || spell.kind === 'save';
      const creatures = needsTarget && target.trim() ? await loadCreatures().catch(() => null) : null;
      const opponent = needsTarget ? opponentFromText(target, creatures?.MONSTERS || []) : null;
      const SPELL_ATTACK_DC = targetAC(opponent);
      const acLabel = opponent ? `CA ${SPELL_ATTACK_DC} ${opponent.of}` : `CA ${SPELL_ATTACK_DC}`;
      const toDice = roll => roll.dice.map(value => ({ sides: roll.sides, value }));

      let playerRoll = null;
      if (cast.attack) {
        const { raw, total, isNat20, isNat1 } = cast.attack;
        const success = isNat20 || (!isNat1 && total >= SPELL_ATTACK_DC);
        await animateRoll({
          sides: 20, value: raw, modifier: cast.attackBonus, dc: SPELL_ATTACK_DC, success,
          against: acLabel, label: `${spell.name} · ataque`
        });
        playerRoll = {
          rawRoll: raw, modifier: cast.attackBonus, total, dc: SPELL_ATTACK_DC, success, isNat20, isNat1,
          against: acLabel, statName: `ataque de conjuro (${spell.name})`
        };
        if (success && cast.damage?.dice.length) {
          await animateRoll({ dice: toDice(cast.damage), modifier: cast.damage.bonus, label: `${spell.name} · daño` });
        }
      } else if (cast.damage?.dice.length) {
        await animateRoll({ dice: toDice(cast.damage), modifier: cast.damage.bonus, label: `${spell.name} · daño` });
      } else if (cast.heal?.dice.length) {
        await animateRoll({ dice: toDice(cast.heal), modifier: cast.heal.bonus, label: `${spell.name} · curación` });
      }

      const ally = cast.heal ? findMemberByName(sceneParty(character.id), target) : null;
      let sheet = result.character;
      let castForDuncan = cast;
      // A saving throw: the caster's DC (8 + proficiency + spellcasting ability), the target rolls with its own
      if (spell.kind === 'save' && !cast.attack) {
        const targetSave = rollTargetSave({ opponent, ability: spell.save, dc: cast.saveDC, rollDie: sides => rollDie(sides, { silent: true }) });
        await animateRoll({
          sides: 20, value: targetSave.raw, modifier: targetSave.bonus, success: targetSave.success,
          dc: cast.saveDC, label: `${spell.name} · salvación ${targetSave.of}`
        });
        castForDuncan = { ...cast, targetSave };
      }
      if (ally && ally.id !== character.id) {
        // The caster keeps their own HP; the ally gets the healing
        sheet = { ...result.character, hp: character.hp };
        const healed = Math.min(ally.maxHp, ally.hp + cast.heal.total) - ally.hp;
        setParty(p => inScope(p, character.id, s => updateMember(updateMember(s, character.id, sheet), ally.id, a => ({ ...a, hp: Math.min(a.maxHp, a.hp + cast.heal.total) }))));
        castForDuncan = { ...cast, heal: { ...cast.heal, applied: healed } };
        pushSystemMessage(`✨ ${character.name} cura a ${ally.name}: recupera ${healed} PG.`);
      } else {
        setCharacter(sheet);
      }
      if (cast.cured?.length) pushSystemMessage(`✨ ${character.name} se libra de: ${cast.cured.join(', ')}.`);
      if (lane === laneOf()) setMobileTab('story');
      setLaneFlag(lane, 'rolling', false);
      handleSendAction(describeCast(castForDuncan, { target, dc: SPELL_ATTACK_DC, against: acLabel }), {
        sheet,
        playerRoll,
        spellCast: castForDuncan,
        effectsApplied: Boolean(cast.heal)
      });
    } finally {
      setLaneFlag(lane, 'rolling', false);
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
    if (isGenerating || laneFlag(viewLane, 'rolling')) return;
    // Only those who are here rest (their scene's purse pays the rooms)
    const result = restParty(sceneParty(), kind, sides => rollDie(sides, { silent: true }));
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
    setSceneParty(partyRef.current.activeId, result.party);
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
  const handleUseItem = async (item, actorId = character.id) => {
    const { lane, character, setCharacter, pushSystemMessage, animateRoll, busy } = actorTools(actorId);
    if (!character || busy()) return;
    if (healingDice(item)) {
      const result = drinkPotion(character, item.id, sides => rollDie(sides, { silent: true }));
      if (!result.ok) { pushSystemMessage(`🧪 ${result.error}`); return; }
      setLaneFlag(lane, 'rolling', true);
      try {
        await animateRoll({ dice: result.roll.dice.map(value => ({ sides: result.roll.sides, value })), modifier: result.roll.bonus, label: `${item.name} · curación` });
      } finally {
        setLaneFlag(lane, 'rolling', false);
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
    pushSystemMessage(`🏳 ${membersOf(scene).length > 1 ? 'El grupo abandona' : `${character.name} abandona`} la misión «${quest.title}».`);
  };

  const handleQuestSeen = id => {
    const list = questsRef.current;
    if (!list.some(q => q.id === id && q.unseen)) return;
    setQuests(list.map(q => (q.id === id ? { ...q, unseen: false } : q)));
  };

  // When traveling to another node on the world map
  const handleTravelToNode = (node, actorId = partyRef.current.activeId) => {
    // Apart: only this scene's group travels; arriving where another group is, they meet
    const p = partyRef.current;
    if (isSplit(p)) {
      const lane = laneOf(actorId);
      if (laneFlag(lane, 'generating') || laneFlag(lane, 'rolling') || encounterOf(lane)) return;
      const moving = groupOf(p, actorId);
      if (!moving || moving.nodeId === node.id) return;
      const pushSystemMessage = sayTo(actorId);
      // A fight going on there: they meet once it is over
      const busyThere = groupsOf(p).find(g => g.id !== moving.id && g.nodeId === node.id && (encounterOf(g.id) || laneFlag(g.id, 'generating')));
      if (busyThere) {
        pushSystemMessage(`🗺️ En ${node.name} ${encounterOf(busyThere.id) ? 'hay un combate en marcha' : 'está pasando algo ahora mismo'}: espera un momento antes de llegar.`);
        return;
      }
      const names = groupNames(p, moving);
      const many = moving.memberIds.length > 1;
      const placeOf = id => worldState.mapNodes?.find(n => n.id === id)?.name || '';
      const res = moveGroup(p, moving.id, node.id, { placeOf });
      setActiveShopKey(null);
      setParty(res.party);
      if (res.ended) setWorld(w => withCurrentNode(w, node.id));
      recordEvent(`${names} ${many ? 'viajan' : 'viaja'} a ${node.name}`);
      const sheet = activeSheet(scopeParty(res.party, moving.memberIds[0]));
      if (!res.met) {
        return handleSendAction(`${many ? `${names} deciden` : `${names} decide`} abandonar la posición y viajar hacia: "${node.name}".`, { sheet });
      }
      const who = meetingNames(res.met.joined.map(j => j.names));
      recordEvent(`En ${node.name} se cruzan los caminos de ${who}: forman un grupo`);
      pushSystemMessage(`🤝 ¡Encuentro en ${node.name}! Se cruzan los caminos de ${who}.${res.ended ? ' A partir de ahora jugáis juntos: una sola crónica, una sola bolsa. Los prólogos de cada uno quedan en el historial.' : ' Siguen siendo un grupo aparte de los que aún no han llegado.'}`);
      return handleSendAction(`${names} ${many ? 'llegan' : 'llega'} a "${node.name}" y ${many ? 'se encuentran' : 'se encuentra'} con ${joinNames(res.met.joined.filter(j => j.id !== moving.id).map(j => j.names))}.`, {
        sheet, meeting: { joined: res.met.joined, place: node.name }
      });
    }
    setWorld(prev => ({
      ...prev,
      mapNodes: prev.mapNodes.map(n => ({
        ...n,
        status: n.id === node.id ? 'current' : n.status === 'current' ? 'discovered' : n.status
      }))
    }));

    recordEvent(`Viaja a ${node.name}`);
    return handleSendAction(`El grupo decide abandonar la posición y viajar hacia: "${node.name}".`);
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
  // Those in the scene being played (all of them when the party is together); in a fight, those who fight
  const sceneHeroes = memberSheets(encounter?.heroIds?.length ? scopeParty(party, encounter.heroIds[0]) : scene);
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
  roomRef.current = room;
  lentKeysRef.current = online.lentKeys;
  const lentTotal = Object.values(online.lentCounts || {}).reduce((a, b) => a + b, 0);
  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [onlineNotice, setOnlineNotice] = useState(null);
  const [chatSeen, setChatSeen] = useState(0);
  const turnUid = inCombat ? currentHeroUid(encounter) : null;
  const heroIds = heroes.map(h => h.id);

  // Each character's lane: its fight, whose turn it is there, its dice (see protocol.js)
  const laneState = characterId => {
    const l = sceneIdOf(party, characterId) || '';
    const fight = encounters[l] || null;
    const active = Boolean(fight && fight.status === 'active');
    return { inCombat: active, turnCharacterId: active ? currentHeroUid(fight) : null, combatBusy: Boolean(lanes[l]?.combat), finished: Boolean(fight && !active) };
  };
  gameRef.current = {
    characterIds: heroIds,
    names: Object.fromEntries(heroes.map(h => [h.id, h.name])),
    // (the party's fight; with the party apart, each character's in `sceneOf`)
    inCombat: Boolean(encounters['']?.status === 'active'),
    turnCharacterId: encounters['']?.status === 'active' ? currentHeroUid(encounters['']) : null,
    combatBusy: Boolean(lanes['']?.combat),
    sceneOf: laneState,
    // Apart, each player moves their own group on the map (together, the host decides the travels)
    apart: isSplit(party),
    nodeIds: (worldState.mapNodes || []).filter(n => n.status !== 'locked').map(n => n.id),
    labelFor: (kind, payload, characterId) => (kind === 'travel'
      ? worldState.mapNodes?.find(n => n.id === payload.nodeId)?.name || ''
      : labelFor(kind, payload, heroes.find(h => h.id === characterId)))
  };
  // A combat action from a player whose turn it is in their lane's fight (already checked by the room)
  combatIntentRef.current = (characterId, action) => {
    const fight = encounterOf(laneOf(characterId));
    if (fight && fight.status === 'active' && currentHeroUid(fight) === characterId) playCombatAction(fight, action);
  };

  // A player changes the equipment of their own character, or levels it up (already
  // checked by the room: they control it and there is no fight); the rules decide the rest
  directIntentRef.current = (direct, playerId) => {
    if (direct.kind === 'create') {
      addPlayerHero(direct.draft, playerId, direct.zoneId);
      return;
    }
    // A finished fight of their group, closed by one of its players
    if (direct.kind === 'finish') {
      const fight = encounterOf(laneOf(direct.characterId));
      if (fight && fight.status !== 'active') handleFinishEncounter(fight);
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
  // In a campaign that started apart, the new hero starts in their origin zone (`zoneId`,
  // or the one that fits them): alone there, they play their own prologue.
  const addPlayerHero = (draft, playerId, zoneId = null) => {
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
    const hero = res.member;
    let nextParty = res.party;
    if (isOriginsCampaign(nextParty)) {
      const zones = zonesFor(worldState).filter(z => worldState.mapNodes?.some(n => n.id === z.id));
      const zone = zones.find(z => z.id === zoneId) || suggestZone(built.character, zones);
      const together = !isSplit(nextParty) ? currentNode(worldState)?.id : null;
      nextParty = placeNewMember(nextParty, hero.id, zone?.id, { hereNodeId: together, meetingNodeId: together });
    } else if (isSplit(nextParty)) {
      nextParty = placeNewMember(nextParty, hero.id, groupOf(nextParty, nextParty.activeId)?.nodeId);
    }
    setParty(nextParty);
    const who = playerName(room, playerId);
    const ids = membersOf(nextParty).map(m => m.id);
    const own = groupOf(nextParty, hero.id);
    const alone = Boolean(own && own.memberIds.length === 1);
    recordEvent(`${hero.name} (${hero.race} · ${hero.className}) ${alone ? 'empieza su historia' : 'se une al grupo'}; lo juega ${who}`);
    pushSystemMessage(`🧭 ${hero.name} (${hero.race} · ${hero.className} de nivel ${hero.level}) ${alone ? 'entra en la historia' : 'se une al grupo'}: lo juega ${who}.${built.rolled ? ` Sus características se tiraron en la mesa del anfitrión (4d6): ${built.rolled.join(', ')}.` : ''}`);
    if (alone) {
      // Their own scene, in their zone: Duncan opens it; they will meet the others later
      const zone = zonesFor(worldState).find(z => z.id === own.nodeId) || { name: worldState.mapNodes?.find(n => n.id === own.nodeId)?.name || 'El camino' };
      pushSceneMessage(own.id, `🧭 ${hero.name} empieza lejos del resto.`);
      setMessagesState(prev => [...prev, { sender: 'duncan', text: zoneIntro(zone, [hero], worldState), timestamp: now(), groupId: own.id }]);
      setParty(p => setSuggestions(p, own.id, zone.suggestions || []));
      online.update(r => {
        const claimed = claimCharacter(r, playerId, hero.id, ids);
        return claimed.ok ? claimed.room : r;
      });
      return;
    }
    const place = (own ? worldState.mapNodes?.find(n => n.id === own.nodeId) : currentNode(worldState))?.name;
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
      title: campaignTitle, world: worldState, party, messages, suggestedActions, encounter: encounters[''] || null,
      encounters: Object.fromEntries(Object.entries(encounters).filter(([l]) => l)),
      lanes, isGenerating: Boolean(lanes['']?.generating), combatBusy: Boolean(lanes['']?.combat),
      pendingRecruit, aiActive: geminiKeys.length > 0 || online.lenders.length > 0
    }));
    // `online.publish` is stable; the room itself is added by the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIsOpen, campaignTitle, worldState, party, messages, suggestedActions, encounters, quests, events, summary, lanes, pendingRecruit, geminiKeys.length, online.lenders.length]);

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

  // Play a queued action with the usual handlers, for the character who acts (in their lane)
  const runQueued = ({ kind, payload, characterId }) => {
    const sheet = memberSheet(sceneParty(characterId), characterId);
    const say = sayTo(characterId);
    if (kind === 'text') return handleSendAction(payload.text, { sheet });
    if (kind === 'check') {
      if (payload.skillId) {
        const skill = getSkill(payload.skillId);
        return skill ? handleRollCheck({ label: skill.name, modifier: skillModifier(sheet, skill.id), ability: skill.ability, skillId: skill.id }, characterId) : null;
      }
      return handleRollCheck({ label: ABILITY_NAMES[payload.ability], modifier: getModifierNumber(sheet.stats?.[payload.ability] ?? 10), ability: payload.ability }, characterId);
    }
    if (kind === 'attack') return handleAttack({ optionId: payload.optionId, target: payload.target, targetAC: payload.targetAC || undefined, raging: payload.raging }, characterId);
    if (kind === 'travel') {
      const node = worldState.mapNodes?.find(n => n.id === payload.nodeId && n.status !== 'locked');
      return node ? handleTravelToNode(node, characterId) : say('🗺️ Ese lugar ya no está en el mapa.');
    }
    if (kind === 'spell') return handleCastSpell(payload.spellId, payload.target, characterId);
    const item = (sheet.inventory || []).find(i => i.id === payload.itemId);
    if (!item) return say(`🎒 ${sheet.name} ya no tiene ese objeto.`);
    return handleUseItem(item, characterId);
  };

  // The member the host chose on screen: a fight's turns may select whoever acts, and
  // once the table is quiet the host gets their own character back
  const hostPickRef = useRef(null);
  const chooseMember = id => {
    hostPickRef.current = id;
    handleSelectMember(id);
  };
  const queueEmpty = !room || room.queue.length === 0;
  useEffect(() => {
    const back = hostPickRef.current || heroes.find(h => room && canControl(room, room.hostId, h.id))?.id;
    if (!room || !queueEmpty || isGenerating || encounter || !back || party.activeId === back) return;
    if (!membersOf(party).some(m => m.id === back) || canControl(room, room.hostId, party.activeId)) return;
    if (canControl(room, room.hostId, back)) setParty(p => setActiveMember(p, back));
    // Only when the table goes quiet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueEmpty, isGenerating, encounter, party.activeId]);

  // The queue, one per lane (see laneQueue in splitParty.js): in each group one action at a
  // time, when its Duncan is free and it is not fighting; the groups apart run in parallel
  // (the host calls Duncan for several scenes at once). Together, a single lane as always.
  const runningRef = useRef(new Set()); // lanes playing a queued action now
  const startedRef = useRef(new Set()); // queued actions already taken (the room updates later)
  const [queueTick, setQueueTick] = useState(0);
  const queueKey = room ? room.queue.map(q => q.id).join('|') : '';
  useEffect(() => {
    if (!room) return;
    const busyLane = l => runningRef.current.has(l) || laneFlag(l, 'generating') || laneFlag(l, 'rolling') || laneFlag(l, 'combat') || Boolean(encounterOf(l));
    laneQueue(room.queue.filter(q => !startedRef.current.has(q.id)), partyRef.current, busyLane).forEach(item => {
      startedRef.current.add(item.id);
      online.update(r => dequeueAction(r, item.id));
      const check = stillValid(room, gameRef.current, item);
      if (!check.ok) {
        tell(item.playerId, `Se descarta «${item.label}»: ${check.error}.`);
        return;
      }
      const lane = laneOf(item.characterId);
      runningRef.current.add(lane);
      authorsRef.current[lane] = playerName(room, item.playerId);
      Promise.resolve()
        .then(() => runQueued(item))
        .catch(err => console.error(err))
        .finally(() => {
          delete authorsRef.current[lane];
          runningRef.current.delete(lane);
          setQueueTick(t => t + 1);
        });
    });
    // The handlers read the latest state from this render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey, roomIsOpen, lanes, encounters, queueTick, party]);

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
    combat: action => submit({ type: 'combat', characterId: turnUid, action }),
    // Apart, travelling is a scene action too: it waits its turn in the queue
    travel: node => (isSplit(party) ? submit(mine.travel(node)) : handleTravelToNode(node))
  } : {
    travel: handleTravelToNode,
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
      : isGenerating ? 'Duncan está respondiendo: lo que escribas esperará en la cola de la sala.' : null;
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
    },
    setShareScenes: on => online.update(r => setShareScenes(r, on))
  } : null;
  const unreadChat = room ? Math.max(0, room.chat.length - chatSeen) : 0;

  // ---------------------------------------------------------------- scenes (a party apart)
  // Alone, the player follows every scene (they play everyone); online, only the scenes
  // and prologues of the characters this screen plays, unless the host lets everyone
  // read the others' scenes. Together, there is a single chronicle (the common one).
  const apart = isSplit(party);
  const viewerIds = room && !room.shareScenes ? (hostActors || []).map(h => h.id) : null;
  const scenes = visibleScenes(party, worldState, viewerIds);
  const shownScene = !apart ? null : scenes.some(s => s.id === sceneId) ? sceneId : scenes[0]?.id || sceneId;
  const chronicle = sceneMessages(messages, chronicleKey(groupById(party, shownScene)));
  const prologues = readablePrologues(party, viewerIds).map(p => ({ id: p.id, label: `Prólogo de ${p.names}${p.place ? ` (${p.place})` : ''}`, messages: sceneMessages(messages, p.id) }));
  const sceneSuggestions = sceneId ? groupById(party, sceneId)?.suggestions || [] : suggestedActions;
  const placeOfMember = id => worldState.mapNodes?.find(n => n.id === groupOf(party, id)?.nodeId)?.name || '';
  const chooseScene = id => {
    const g = groupById(party, id);
    const who = g?.memberIds.find(m => !viewerIds || viewerIds.includes(m));
    if (who) chooseMember(who);
  };
  const elsewhere = apart
    ? heroes.filter(h => !sceneHeroes.some(s => s.id === h.id) && (!viewerIds || viewerIds.includes(h.id))).map(h => ({ ...h, place: placeOfMember(h.id) }))
    : [];
  const memberPlaces = apart ? Object.fromEntries(heroes.map(h => [h.id, placeOfMember(h.id)])) : null;
  const mapMarkers = scenes.map(s => ({ nodeId: s.nodeId, label: s.names, current: s.id === sceneId }));
  const meetingNodeId = apart && groupById(party, sceneId)?.hook ? party.split.meetingNodeId : null;
  const sceneTabs = apart && scenes.length > 1 ? scenes.map(s => ({ id: s.id, label: s.names, place: s.place, active: s.id === shownScene, spotlight: s.spotlight })) : [];
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
            party={sceneHeroes}
            elsewhere={elsewhere}
            purse={scene.gold}
            onSelectMember={chooseMember}
            onDismissMember={handleDismissMember}
            onTransferItem={handleTransferItem}
            longRestCost={longRestCost(scene)}
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
                heroes={sceneHeroes}
                onAction={act.combat}
                onFinish={() => handleFinishEncounter()}
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
              messages={chronicle}
              isGenerating={isGenerating}
              suggestedActions={sceneSuggestions}
              character={character}
              party={heroes}
              onSelectMember={chooseMember}
              scenes={sceneTabs}
              onSelectScene={chooseScene}
              prologues={prologues}
              memberPlaces={memberPlaces}
              pendingRecruit={pendingRecruit}
              onAnswerRecruit={handleAnswerRecruit}
              world={world}
              onSendAction={act.send}
              onOpenGeminiConnect={onOpenGeminiConnect}
              keysCount={geminiKeys.length + lentTotal}
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
            onTravelToNode={act.travel}
            markers={apart ? mapMarkers : []}
            meetingNodeId={meetingNodeId}
            travelLocked={apart && (isGenerating || Boolean(encounter)) ? 'Espera a que Duncan termine para viajar.' : null}
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
          link={room ? roomLink(room.code, onlineKind, undefined, online.print) : ''}
          keys={room ? {
            lenders: online.lenders,
            counts: online.lentCounts,
            hostKeysCount: geminiKeys.length,
            // While the party is apart: which keys each group's scene uses (see sceneKeys.js)
            scenes: isSplit(party) ? groupsOf(party).map(g => {
              const own = lentKeysByScene({
                groups: [g], playerOf: cid => controllerOf(room, cid), lent: Object.fromEntries(online.lenders.map(id => [id, `${id}`])), hostId: room.hostId
              })[g.id] || [];
              return { id: g.id, label: groupNames(party, g), lenderIds: own.map(k => k.playerId), withHost: own.length > 0 && g.memberIds.some(cid => controllerOf(room, cid) === room.hostId) && geminiKeys.length > 0 };
            }) : null
          } : null}
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
          { id: 'party', label: sceneHeroes.length > 1 ? `Grupo (${sceneHeroes.length})` : `Ficha · ${character.hp} PG`, icon: Shield },
          { id: 'map', label: 'Mapa', icon: MapIcon, badge: unseenQuestCount(quests) }
        ]}
      />


    </div>
  );
}
