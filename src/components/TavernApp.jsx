import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Users, Settings, ArrowLeft, Dice5, Compass, User, Sparkles, BookOpen, Download, Check, AlertTriangle, FlaskConical, RotateCcw } from 'lucide-react';
import PartyPanel from './game/PartyPanel';
import StoryStream from './game/StoryStream';
import WorldMapPanel from './game/WorldMapPanel';
import DiceRollerTray from './game/DiceRollerTray';
import { PRESET_WORLDS, PRESET_CHARACTERS } from '../data/gameData';
import { generateDMResponse, rollCheck, rollDie, getStoredGeminiKeys } from '../utils/gameEngine';
import { castSpell, describeCast, longRest, shortRest, LONG_REST_COST } from '../utils/spellcasting';
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
import { animateRoll, is3DDiceEnabled } from '../dice3d/controller';
import { applySceneOutcome, rescueKnockedOut } from '../utils/sceneOutcome';
import { createEncounter, runEnemyTurns, playerAction, describeEncounterResult, injuriesIn } from '../utils/encounter';
import { normalizeEquipment, applyLimbChanges, limbFact } from '../utils/equipment';
import {
  checkModifiers, applyConditionChanges, describeConditionChange, conditionFact, endCombatConditions,
  restConditions, reduceExhaustion, isIncapacitated, activeIds, conditionName
} from '../utils/conditions';
import { keyMoments, narrateMoment, MAX_MOMENTS } from '../utils/combatNarration';
import CombatView from './game/CombatView';
import { makeSnapshot, addSnapshot, setSnapshotResult, normalizeSnapshots } from '../utils/combatSnapshots';
import { addXp, canLevelUp, describeLevelUp } from '../utils/leveling';
import LevelUpModal from './game/LevelUpModal';
import {
  historyForPrompt, needsSummary, coverageAfterSummary, addEvent, eventsForPrompt
} from '../utils/campaignMemory';
import { resolveAttack, describeAttack, attackOptions } from '../utils/combat';
import { skillModifier, getSkill } from '../utils/characterBuilder';
import {
  openShop, shopKey, currentNode, shopsAt, buyItem, sellItem, describeTrade, describeShopsForPrompt, normalizeShops, SHOP_TYPES
} from '../utils/shops';
import { drinkPotion, healingDice, addItem, roundCoins } from '../utils/items';
import { generateLoot, describeLoot } from '../utils/loot';
import ShopModal from './game/ShopModal';
import {
  normalizeQuests, applyQuestChanges, abandonQuest, describeQuestChange, questFact, unseenQuestCount, payReward
} from '../utils/quests';
import { huntChangesAfterVictory, withHuntTargets } from '../utils/localQuests';

// The bestiary (and its builder) is only needed when a fight is being prepared
// The bestiary is big: loaded the first time Duncan may start a fight
const loadBestiary = () => import('../utils/bestiary');

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

  // Older saves get hands and limbs (see equipment.js)
  const [character, setCharacter] = useState(() => {
    if (activeCampaign?.character) return normalizeEquipment(activeCampaign.character);
    if (currentCampaignId) {
      const camp = getCampaignById(currentCampaignId);
      if (camp?.character) return normalizeEquipment(camp.character);
    }
    return normalizeEquipment(activeCharacter);
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

  // Campaign memory for the AI Dungeon Master (see campaignMemory.js)
  const storedCampaign = () => activeCampaign || (currentCampaignId ? getCampaignById(currentCampaignId) : null);
  const [summary, setSummary] = useState(() => storedCampaign()?.summary || '');
  const [summaryCoverage, setSummaryCoverage] = useState(() => storedCampaign()?.summaryCoverage || 0);
  const [events, setEvents] = useState(() => storedCampaign()?.events || []);
  const recordEvent = text => setEvents(prev => addEvent(prev, text));

  // Combat encounter in progress (null outside combat); saved with the campaign
  const [encounter, setEncounter] = useState(() => storedCampaign()?.encounter || null);
  // How each recent fight started (the last MAX_SNAPSHOTS), to replay it in the simulator
  const [combatSnapshots, setCombatSnapshots] = useState(() => normalizeSnapshots(storedCampaign()?.combatSnapshots));

  // Shops visited (their stock is kept) and the one open now; saved with the campaign
  const [shops, setShops] = useState(() => normalizeShops(storedCampaign()?.shops));
  const [activeShopKey, setActiveShopKey] = useState(null);
  const [combatBusy, setCombatBusy] = useState(false);

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
  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);

  // Guards against double-creation under React.StrictMode (effects run twice in dev)
  const campaignInitRef = useRef(false);
  // Skip prop-sync effects on first mount so a stored campaign isn't overwritten by default props
  // (compare with the previous prop value; a "first run" flag breaks under StrictMode's double effects)
  const prevActiveCharacterRef = useRef(activeCharacter);
  const prevActiveWorldRef = useRef(activeWorld);

  // Warm up the 3D dice engine in the background so the first roll starts instantly
  useEffect(() => {
    if (!is3DDiceEnabled()) return undefined;
    const timer = setTimeout(() => {
      import('../dice3d/engine').catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

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
      setCharacter(normalizeEquipment(activeCampaign.character));
      setMessages(activeCampaign.messages || []);
      setSummary(activeCampaign.summary || '');
      setSummaryCoverage(activeCampaign.summaryCoverage || 0);
      setEvents(activeCampaign.events || []);
      setEncounter(activeCampaign.encounter || null);
      setCombatSnapshots(normalizeSnapshots(activeCampaign.combatSnapshots));
      setShops(normalizeShops(activeCampaign.shops));
      setQuests(normalizeQuests(activeCampaign.quests));
      setActiveShopKey(null);
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
      setCharacter(normalizeEquipment(activeCharacter));
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
      suggestedActions,
      summary,
      summaryCoverage,
      events,
      encounter,
      shops,
      combatSnapshots,
      quests
    });
    if (saved) {
      setSaveStatus('saved');
    } else {
      setSaveStatus(isQuotaError(getLastSaveError()) ? 'quota' : 'error');
    }
  }, [messages, character, world, campaignTitle, currentCampaignId, suggestedActions, summary, summaryCoverage, events, encounter, shops, combatSnapshots, quests]);

  const toggleSound = () => {
    const newState = tavernAudio.toggleTavernAmbience();
    setIsAudioActive(newState);
  };

  // Main Action Dispatcher
  // `sheet`: pass the just-updated character when the caller changed it in this same tick
  // (state updates are not visible here until the next render)
  // `spellCast` / `rest`: what the action was, so the Dungeon Master narrates it properly
  // `effectsApplied`: HP / gold for this action were already changed here (drinks, rests, healing)
  const handleSendAction = async (actionText, {
    playerRoll = null, sheet = character, spellCast = null, rest = null, effectsApplied = false,
    weaponAttack = null, combatResult = null, loot = null
  } = {}) => {
    if (!actionText || isGenerating) return;

    // Add player's action to messages (not for the narration after a fight)
    const newMsgList = combatResult ? messages : [
      ...messages,
      {
        sender: 'player',
        text: actionText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    // (the fight's own system lines were just added with functional updates: keep them)
    if (!combatResult) setMessages(newMsgList);
    setIsGenerating(true);

    try {
      const currentKeys = getStoredGeminiKeys();
      setGeminiKeys(currentKeys);

      // A plain action outside combat may start a fight: Duncan gets a short list of creatures
      const mayStartFight = !encounter && !combatResult && !playerRoll && !spellCast && !rest && !weaponAttack;
      // ...or open a shop (the game sets the prices)
      const here = currentNode(world);
      const bestiaryModule = mayStartFight ? await loadBestiary().catch(() => null) : null;
      // (the target of an active hunt is always among them)
      const bestiary = bestiaryModule
        ? withHuntTargets(
          bestiaryModule.encounterCandidates(sheet.level || 1, { tags: bestiaryModule.WORLD_TAGS[world?.id] || null }),
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
        here
      });
      // A fight starts: the game resolves it, so nothing from this reply touches the sheet
      const fightGroups = response.combat && bestiaryModule
        ? bestiaryModule.resolveCombatRequest(response.combat, sheet.level || 1)
        : [];
      if (fightGroups.length) {
        response.damageTaken = 0;
        response.healing = 0;
        response.goldEarned = 0;
        response.xpEarned = 0;
      }
      // Quests opened, updated or closed by the story; the game pays the rewards it fixed
      const questResult = applyQuestChanges(questsRef.current, response.questChanges || [], {
        character: sheet, scene: newMsgList.length + 1, place: here?.name || ''
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
        setCharacter(prev => questsPaid.reduce((hero, a) => payReward(hero, a.quest.reward).character, prev));
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

      // Apply the consequences of the scene to the character sheet
      // When the game already applied this action's healing and gold, the narrator can only add damage
      const damage = response.damageTaken || 0;
      const healing = effectsApplied ? 0 : response.healing || 0;
      const goldChange = effectsApplied ? 0 : response.goldEarned || 0;
      const effects = { damage, healing, goldChange };
      const outcome = applySceneOutcome(sheet, effects);
      if (damage || healing || goldChange) {
        // Recomputed from the latest state, in case the sheet changed while Duncan was thinking
        setCharacter(prev => {
          const next = applySceneOutcome(prev, effects);
          return { ...prev, hp: next.hp, gold: next.gold };
        });
      }

      // Limbs lost, disabled or healed in the story (validated by parseDMReply)
      const limbs = fightGroups.length ? { applied: [] } : applyLimbChanges(sheet, response.limbChanges || []);
      if (limbs.applied.length) {
        setCharacter(prev => applyLimbChanges(prev, response.limbChanges).character);
        limbs.applied.forEach(change => recordEvent(limbFact(sheet.name, change)));
      }

      // Conditions applied or removed by the story (validated by parseDMReply)
      const conditionResult = fightGroups.length ? { applied: [], collapsed: false } : applyConditionChanges(sheet, response.conditionChanges || []);
      if (conditionResult.applied.length) {
        setCharacter(prev => {
          const next = applyConditionChanges(prev, response.conditionChanges).character;
          // Exhaustion 6: the hero collapses and Duncan picks them up (level 5 left)
          if (!conditionResult.collapsed) return next;
          const rescue = rescueKnockedOut(next);
          return { ...reduceExhaustion(next, 1).creature, hp: Math.min(next.hp, rescue.hp), gold: rescue.gold };
        });
        conditionResult.applied.forEach(change => {
          const fact = conditionFact(sheet.name, change);
          if (fact) recordEvent(fact);
        });
      }

      // Experience: tell the player once when they can go up a level
      const questXp = questsPaid.reduce((sum, a) => sum + (a.given?.xp || 0), 0);
      const xpGained = (response.xpEarned || 0) + questXp;
      const reachesNewLevel = xpGained > 0 && !canLevelUp(sheet) && canLevelUp(addXp(sheet, xpGained));
      if (response.xpEarned > 0) setCharacter(prev => addXp(prev, response.xpEarned));

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
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      limbs.applied.forEach(change => {
        const icon = change.status === 'ok' ? '🩹' : '🦴';
        const dropped = change.dropped.length ? ` ${change.dropped.join(' y ')} va${change.dropped.length > 1 ? 'n' : ''} a la mochila.` : '';
        const effect = change.status === 'ok' ? ''
          : /Arm$/.test(change.limb) ? ' Esa mano ya no puede sostener nada.' : ' Huir de un combate será más difícil.';
        pushSystemMessage(`${icon} ${limbFact(sheet.name, change)}.${effect}${dropped}`);
      });

      conditionResult.applied.forEach(change => pushSystemMessage(describeConditionChange(sheet.name, change)));
      questResult.applied.forEach(change => pushSystemMessage(describeQuestChange(change)));
      if (conditionResult.collapsed) {
        recordEvent(`${sheet.name} se desplomó de agotamiento y Duncan lo recogió`);
        pushSystemMessage(`💀 ${sheet.name} llega al sexto nivel de agotamiento y se desploma. Maese Duncan te recoge y te mete en un catre: sigues con agotamiento de nivel 5 y la mitad de tu oro se va en cuidados.`);
      }

      if (reachesNewLevel) {
        pushSystemMessage(`✨ ¡${sheet.name} tiene experiencia suficiente para subir a nivel ${(sheet.level || 1) + 1}! Pulsa «Subir de nivel» en tu ficha.`);
      }

      // Dropping to 0 HP: Duncan patches the hero up... at a price
      if (outcome.knockedOut) {
        recordEvent(`${sheet.name} cayó inconsciente y Duncan lo curó`);
        setMessages(prev => [
          ...prev,
          {
            sender: 'system',
            text: `💀 ${sheet.name} cae inconsciente. Maese Duncan te arrastra junto a la chimenea y te remienda: despiertas con ${outcome.hp} HP${outcome.goldLost > 0 ? ` y ${outcome.goldLost} monedas de oro menos por los cuidados` : ''}.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }

      if (response.suggestedActions) {
        setSuggestedActions(response.suggestedActions);
      }

      if (fightGroups.length) startEncounter(fightGroups, sheet, { byDuncan: true });
      else if (response.shop && SHOP_TYPES[response.shop]) handleOpenShop(response.shop, { byDuncan: true });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ---------------------------------------------------------------- combat encounters
  const combatDie = sides => rollDie(sides, { silent: true });

  // `sheet`: the hero as it is now (Duncan may start a fight right after changing it)
  const startEncounter = (groups, sheet = character, { byDuncan = false } = {}) => {
    // How the fight starts, kept so it can be fought again in the simulator
    const snapshot = makeSnapshot({ character: sheet, groups, world, place: currentNode(world)?.name || '', byDuncan });
    let next = { ...createEncounter(groups, sheet, combatDie), byDuncan, narrated: 0, snapshotId: snapshot.id };
    let hero = sheet;
    // Enemies that won initiative act before the hero
    const logStart = next.log.length;
    ({ encounter: next, character: hero } = runEnemyTurns(next, hero, combatDie));
    recordInjuries(next.log.slice(logStart), sheet.name);
    const finished = next;
    setCombatSnapshots(prev => {
      const list = addSnapshot(prev, snapshot);
      return finished.status === 'active' ? list : setSnapshotResult(list, snapshot.id, finished);
    });
    const names = groups.map(g => {
      const label = g.name ? `${g.name} (${g.monster.name}${g.elite ? ', élite' : ''})` : g.monster.name;
      return g.count > 1 ? `${g.count} × ${label}` : label;
    }).join(', ');
    pushSystemMessage(`⚔️ ¡Combate! ${sheet.name} se enfrenta a: ${names}.`);
    setActiveShopKey(null);
    setEncounter(next);
    if (hero !== sheet) setCharacter(hero);
    setMobileTab('story');
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
  const recordInjuries = (entries, name) => {
    injuriesIn(entries).forEach(injury => recordEvent(limbFact(name, injury, injury.by ? `en combate contra ${injury.by}` : 'en combate')));
  };

  const handleCombatAction = async (action) => {
    if (!encounter || combatBusy) return;
    const result = playerAction(encounter, character, action, combatDie);
    if (!result.ok) {
      setEncounter(prev => ({ ...prev, log: [...prev.log, { round: prev.round, kind: 'info', text: `⚠️ ${result.error}` }] }));
      return;
    }
    recordInjuries(result.encounter.log.slice(encounter.log.length), character.name);
    if (result.encounter.status !== 'active' && encounter.snapshotId) {
      setCombatSnapshots(prev => setSnapshotResult(prev, encounter.snapshotId, result.encounter));
    }
    setCombatBusy(true);
    try {
      for (const roll of result.animations) {
        await animateRoll(roll);
      }
    } finally {
      setEncounter(narrateKeyMoments(encounter, result.encounter, result.character));
      setCharacter(result.character);
      setCombatBusy(false);
    }
  };

  // Close a finished fight: chronicle line, XP, loot, recorded fact, rescue if the hero fell
  const handleFinishEncounter = () => {
    if (!encounter || encounter.status === 'active') return;
    const loot = generateLoot(encounter);
    const won = encounter.status === 'victory';
    const line = `${describeEncounterResult(encounter, character)}${won ? ` Botín (ya en la mochila): ${describeLoot(loot)}.` : ''}`;
    pushSystemMessage(line);
    const defeated = encounter.enemies.filter(e => e.status !== 'active').map(e => e.name);
    if (encounter.status === 'victory') recordEvent(`Vence en combate a ${defeated.slice(0, 3).join(', ')}${defeated.length > 3 ? '…' : ''}`);
    if (encounter.status === 'fled') recordEvent('Huye de un combate');

    // Effects that lasted turns or depended on the enemies end with the fight
    const { creature: afterFight, removed: endedConditions } = endCombatConditions(character);
    let hero = afterFight;
    if (endedConditions.length) {
      const names = [...new Set(endedConditions.map(c => conditionName(c.id).toLowerCase()))];
      pushSystemMessage(`🩹 Al acabar el combate, ${hero.name} deja de estar ${names.join(', ')}.`);
    }
    if (won) {
      hero = {
        ...hero,
        gold: roundCoins((Number(hero.gold) || 0) + loot.coins),
        inventory: loot.items.reduce((list, item) => addItem(list, item), hero.inventory || [])
      };
      if (loot.items.length) recordEvent(`Botín: ${loot.items.map(i => i.name).join(', ')}`);
    }
    if (encounter.xp > 0) {
      const leveledBefore = canLevelUp(hero);
      hero = addXp(hero, encounter.xp);
      if (!leveledBefore && canLevelUp(hero)) {
        pushSystemMessage(`✨ ¡${hero.name} tiene experiencia suficiente para subir a nivel ${(hero.level || 1) + 1}! Pulsa «Subir de nivel» en tu ficha.`);
      }
    }
    // Hunting quests of the local engine are done with a victory
    let questLine = '';
    if (won) {
      const result = applyQuestChanges(questsRef.current, huntChangesAfterVictory(questsRef.current, encounter), {
        character: hero, scene: messages.length + 1, place: currentNode(world)?.name || ''
      });
      if (result.applied.length) {
        const leveledBefore = canLevelUp(hero);
        hero = result.character;
        setQuests(result.quests);
        result.facts.forEach(recordEvent);
        result.applied.forEach(change => pushSystemMessage(describeQuestChange(change)));
        questLine = ` ${result.applied.map(a => `Misión cumplida: «${a.quest.title}» (la recompensa ya está entregada).`).join(' ')}`;
        if (!leveledBefore && canLevelUp(hero)) {
          pushSystemMessage(`✨ ¡${hero.name} tiene experiencia suficiente para subir a nivel ${(hero.level || 1) + 1}! Pulsa «Subir de nivel» en tu ficha.`);
        }
      }
    }
    if (encounter.status === 'defeat') {
      const rescue = rescueKnockedOut(hero);
      hero = { ...hero, hp: rescue.hp, gold: rescue.gold };
      recordEvent(`${hero.name} cayó en combate y Duncan lo curó`);
      pushSystemMessage(`💀 ${hero.name} cae inconsciente. Maese Duncan te arrastra junto a la chimenea y te remienda: despiertas con ${rescue.hp} HP${rescue.goldLost > 0 ? ` y ${rescue.goldLost} monedas de oro menos por los cuidados` : ''}.`);
    }
    setCharacter(hero);
    setEncounter(null);
    // Duncan narrates the outcome (and any loot) from the result the game computed
    handleSendAction('Narra el final del combate', { sheet: hero, combatResult: `${line}${questLine}`, loot: won ? loot : null });
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

  // Shortcut under the chronicle: attack with the first weapon in hand
  const handleQuickAttack = () => {
    const options = attackOptions(character);
    const option = options.find(o => o.weapon) || options[0];
    if (!option) {
      pushSystemMessage('⚔️ No tienes nada con lo que atacar: equipa un arma o deja una mano libre (pestaña «Equipo» de tu ficha).');
      return;
    }
    handleAttack({ optionId: option.id });
  };

  // Shortcut under the chronicle: a skill check with the hero's sheet
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
        label: `Tirada de ${label}`
      });

      const tired = mods.penalty ? ` (agotamiento: −${mods.penalty})` : '';
      const textDesc = `Realizo una tirada de ${label}${disadvantage ? ` con desventaja (${disadvantage})` : advantage ? ` con ventaja (${advantage})` : ''}${tired} [🎲 D20: ${check.rawRoll} (${check.modifier >= 0 ? `+${check.modifier}` : check.modifier}) = ${check.total} vs CD ${check.dc}].`;
      handleSendAction(textDesc, { playerRoll: check });
    } finally {
      isRollingCheckRef.current = false;
    }
  };

  const pushSystemMessage = (text) => {
    setMessages(prev => [
      ...prev,
      { sender: 'system', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
  };

  // Casting a spell from the sheet: roll its dice, spend the slot and tell the Dungeon Master
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

      setCharacter(result.character);
      if (cast.cured?.length) pushSystemMessage(`✨ ${character.name} se libra de: ${cast.cured.join(', ')}.`);
      setMobileTab('story');
      handleSendAction(describeCast(cast, { target, dc: SPELL_ATTACK_DC }), {
        sheet: result.character,
        playerRoll,
        spellCast: cast,
        effectsApplied: Boolean(cast.heal)
      });
    } finally {
      isRollingCheckRef.current = false;
    }
  };

  const handleLevelUpConfirmed = (next, summary) => {
    setCharacter(next);
    setIsLevelUpOpen(false);
    tavernAudio.playCritSuccess();
    pushSystemMessage(describeLevelUp(next, summary));
    recordEvent(`Sube a nivel ${next.level}${summary.features.length ? ` (${summary.features.slice(0, 2).join(', ')})` : ''}`);
  };

  // Short rest (an hour by the fire) or long rest (a night in a room, for a price)
  const handleRest = (kind) => {
    if (isGenerating || isRollingCheckRef.current) return;

    // What the rest does to the conditions (longRest / shortRest apply it): chronicle and memory
    const describeRestConditions = () => {
      const { removed, exhaustion } = restConditions(character, kind);
      const parts = [];
      const names = [...new Set(removed.map(c => conditionName(c.id).toLowerCase()))];
      if (names.length) parts.push(`deja de estar ${names.join(', ')}`);
      if (exhaustion.before > exhaustion.after) {
        parts.push(exhaustion.after ? `su agotamiento baja a nivel ${exhaustion.after}` : 'ya no sufre agotamiento');
        recordEvent(exhaustion.after ? `El agotamiento de ${character.name} baja a nivel ${exhaustion.after}` : `${character.name} se recupera del agotamiento`);
      }
      removed.forEach(c => {
        const fact = conditionFact(character.name, { id: c.id, action: 'remove', level: null, condition: c });
        if (fact && c.id !== 'agotamiento') recordEvent(fact);
      });
      if (parts.length) pushSystemMessage(`🛏️ Tras el descanso, ${character.name} ${parts.join(' y ')}.`);
      return parts.length ? ` Además, ${parts.join(' y ')}.` : '';
    };

    if (kind === 'long') {
      if (character.gold < LONG_REST_COST) {
        pushSystemMessage(`🛏️ Necesitas ${LONG_REST_COST} monedas de oro para una habitación.`);
        return;
      }
      const rested = { ...longRest(character), gold: character.gold - LONG_REST_COST };
      const extra = describeRestConditions();
      setCharacter(rested);
      setMobileTab('story');
      handleSendAction(
        `Pago ${LONG_REST_COST} monedas de oro por una habitación y hago un descanso largo hasta el amanecer. Recupero todos mis puntos de golpe${rested.spellcasting ? ' y mi magia' : ''}.${extra}`,
        { sheet: rested, rest: 'long', effectsApplied: true }
      );
      return;
    }

    const { character: rested, healed, die, slotsRecovered } = shortRest(character, sides => rollDie(sides, { silent: true }));
    const gains = [
      healed > 0 && `gasto mi dado de golpe (d${character.hitDie}: ${die}) y recupero ${healed} puntos de golpe`,
      slotsRecovered && 'recupero mi magia de pacto'
    ].filter(Boolean);
    const extra = describeRestConditions();
    setCharacter(rested);
    setMobileTab('story');
    handleSendAction(
      `Hago un descanso corto de una hora junto al fuego${gains.length ? `: ${gains.join(' y ')}` : ''}.${extra}`,
      { sheet: rested, rest: 'short', effectsApplied: true }
    );
  };

  // When ordering a drink from Duncan's tavern menu
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
  // Open a shop of the current location (from the map, or because Duncan took the hero there).
  // The stock is generated the first time and kept in the campaign.
  const handleOpenShop = (type, { byDuncan = false } = {}) => {
    if (encounter && encounter.status === 'active') return;
    const node = currentNode(world);
    setShops(prev => openShop(prev, { node, world, type }).shops);
    setActiveShopKey(shopKey(node?.id, type));
    if (byDuncan) pushSystemMessage(`🛒 Se abre ${SHOP_TYPES[type].name.toLowerCase()}: los precios los pone el juego (los del SRD; vendes a la mitad).`);
  };

  const activeShop = activeShopKey ? shops[activeShopKey] : null;

  // Buy / sell at the open shop: returns an error for the shop window, or null
  const trade = (result, kind) => {
    if (!result.ok) return result.error;
    setCharacter(normalizeEquipment(result.character));
    setShops(prev => ({ ...prev, [result.shop.key]: result.shop }));
    pushSystemMessage(describeTrade(kind, result.item, result.price, result.shop));
    if (result.price >= 100) recordEvent(`${kind === 'buy' ? 'Compra' : 'Vende'} ${result.item.name}`);
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
    pushSystemMessage(`🏳 ${character.name} abandona la misión «${quest.title}».`);
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

          {/* Combat simulator: practice fights and replay recent ones (never changes the campaign) */}
          <button
            onClick={() => onOpenSimulator({ campaignId: currentCampaignId })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#121a22] hover:bg-stone-800 border border-sky-900/50 text-sky-200 text-xs font-bold transition-all"
            title="Simulador de combates: prueba combates o revive los recientes sin afectar a tu campaña"
          >
            <FlaskConical className="w-3.5 h-3.5 text-sky-300" />
            <span className="hidden md:inline">Simulador</span>
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

        {/* Center: the campaign's hero */}
        <div className="hidden md:flex items-center gap-2 min-w-0 text-xs text-stone-300">
          <span className="text-base leading-none">{character.avatar || '🛡️'}</span>
          <span className="font-cinzel font-bold text-stone-100 truncate max-w-[180px]">{character.name}</span>
          <span className="text-stone-500 truncate hidden lg:inline">{character.race} · {character.class}</span>
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

          {/* Share button */}
          <button
            onClick={onOpenInvite}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-300 hover:text-amber-300 text-xs font-semibold transition-all"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compartir</span>
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
      <div className="lg:hidden flex border-b border-amber-950/60 bg-[#14101c] text-xs font-semibold">
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
          {unseenQuestCount(quests) > 0 && (
            <span className="ml-1 inline-block w-2 h-2 rounded-full bg-amber-400 align-middle" aria-label="Novedades en el diario de misiones" />
          )}
        </button>
      </div>

      {/* Main 3-Column Desktop Layout / Tabbed Mobile View */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Column: Party & Sheet (300px on desktop) */}
        <div className={`w-full lg:w-72 xl:w-80 2xl:w-88 shrink-0 ${mobileTab === 'party' ? 'block' : 'hidden lg:block'}`}>
          <PartyPanel
            character={character}
            onUpdateCharacter={next => setCharacter(normalizeEquipment(next))}
            onOrderDrink={handleOrderDrink}
            onRollCheck={handleRollCheck}
            onCastSpell={handleCastSpell}
            onRest={handleRest}
            onLevelUp={() => setIsLevelUpOpen(true)}
            onAttack={handleAttack}
            onUseItem={handleUseItem}
            busy={isGenerating}
            inCombat={Boolean(encounter && encounter.status === 'active')}
          />
        </div>

        {/* Center Column: Story Stream (Flexible width) */}
        <div className={`flex-1 min-w-0 flex-col h-full overflow-hidden ${mobileTab === 'story' ? 'flex' : 'hidden lg:flex'}`}>
          {encounter ? (
            <CombatView
              encounter={encounter}
              character={character}
              onAction={handleCombatAction}
              onFinish={handleFinishEncounter}
              busy={combatBusy}
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
          ) : (
            <StoryStream
              messages={messages}
              isGenerating={isGenerating}
              suggestedActions={suggestedActions}
              character={character}
              world={world}
              onSendAction={handleSendAction}
              onOpenGeminiConnect={onOpenGeminiConnect}
              keysCount={geminiKeys.length}
              onQuickAttack={handleQuickAttack}
              onQuickCheck={handleQuickCheck}
            />
          )}
        </div>

        {/* Right Column: World Map & Factions (300px on desktop) */}
        <div className={`w-full lg:w-72 xl:w-80 2xl:w-88 shrink-0 ${mobileTab === 'map' ? 'block' : 'hidden lg:block'}`}>
          <WorldMapPanel
            world={world}
            onTravelToNode={handleTravelToNode}
            summary={summary}
            events={events}
            quests={quests}
            onAbandonQuest={handleAbandonQuest}
            onQuestSeen={handleQuestSeen}
            onOpenShop={handleOpenShop}
            shopsLocked={encounter ? 'No hay tiempo para compras en mitad de un combate.' : null}
          />
        </div>

      </div>

      {/* Floating 3D Dice Roller Tray */}

      {activeShop && !encounter && (
        <ShopModal
          shop={activeShop}
          character={character}
          onBuy={handleBuy}
          onSell={handleSell}
          onClose={() => setActiveShopKey(null)}
        />
      )}

      {isLevelUpOpen && canLevelUp(character) && (
        <LevelUpModal
          character={character}
          onConfirm={handleLevelUpConfirmed}
          onClose={() => setIsLevelUpOpen(false)}
        />
      )}

      {/* Hidden during a fight: the combat rolls its own dice (and the button would cover its controls) */}
      {!encounter && <DiceRollerTray onSendRollToChat={handleDiceRollToChat} />}

    </div>
  );
}
