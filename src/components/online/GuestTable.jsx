import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { ArrowLeft, Wifi, WifiOff, Loader2, ScrollText, Swords, Shield, Users, Map as MapIcon } from 'lucide-react';
import PartyPanel from '../game/PartyPanel';
import StoryStream from '../game/StoryStream';
import WorldMapPanel from '../game/WorldMapPanel';
import { MobileTabBar, SideColumn } from '../game/GameLayout';
import RoomPanel from './RoomPanel';
import { CombatView, LevelUpModal, preloadGameParts } from '../game/lazyParts';
import { whenIdle } from '../../utils/lazyWithPreload';
import OnlineToast from './OnlineToast';
import { useGuestRoom } from '../../online/useOnlineRoom';
import { roomLink } from '../../online/transport';
import { controllerOf, canControl, playerName, claimOf, unreadChatCount, lastChatAt } from '../../online/room';
import { useMediaQuery, WIDE_LAYOUT } from '../../hooks/useMediaQuery';
import { sheetIntents } from '../../online/actions';
import { isAtTavern } from '../../utils/shops';
import { memberSheets, MAX_PARTY } from '../../utils/party';
import { currentHeroUid } from '../../utils/encounter';
import { longRestCost } from '../../utils/partyActions';
import { canLevelUp } from '../../utils/leveling';
import {
  isSplit, sceneIdOf, chronicleKey, scopeParty, sceneWorld, sceneMessages, readablePrologues, visibleScenes, groupById, groupOf, isOriginsCampaign
} from '../../utils/splitParty';
import { zonesFor, suggestZone, fitLabel } from '../../utils/origins';

// The creation wizard: only loaded if this player creates a character
const CharacterWizard = lazy(() => import('../wizard/CharacterWizard'));

const HOST_ONLY = 'Esto lo decide el anfitrión (descansos, tiendas, viajes, compañeros y repartir objetos se hacen en su pantalla). Si el grupo está separado, cada uno viaja con el suyo desde el mapa.';

/**
 * A player's table in someone else's room: the game as the host shares it, and
 * what this player sends (actions for the characters they play, combat turns,
 * votes, chat). Nothing is decided here: the host checks and plays everything.
 */
export default function GuestTable({ code, name, kind, onLeave }) {
  const room = useGuestRoom({ code, name, kind });
  // The combat view, leveling up, the sheet's tabs...: fetched while nothing happens
  useEffect(() => whenIdle(preloadGameParts), []);
  const { view, playerId } = room;
  const [selectedId, setSelectedId] = useState(null);
  const [mobileTab, setMobileTab] = useState('story');
  const [sideTab, setSideTab] = useState('room');
  // The side column folded during a fight (computer) and the time of the last chat line seen
  const [railOpen, setRailOpen] = useState(false);
  const [chatSeenAt, setChatSeenAt] = useState(0);
  const wide = useMediaQuery(WIDE_LAYOUT);
  const [localNotice, setLocalNotice] = useState(null);
  const [levelUpId, setLevelUpId] = useState(null);
  const [creating, setCreating] = useState(false);
  // A campaign that started apart: the new character's choices wait for where they start
  const [pendingDraft, setPendingDraft] = useState(null); // { character, draft, zoneId }

  const shared = view.room || null;
  const heroes = useMemo(() => (view.party ? memberSheets(view.party) : []), [view.party]);
  const mine = shared ? heroes.filter(h => canControl(shared, playerId, h.id)) : [];
  const character = heroes.find(h => h.id === selectedId) || mine[0] || heroes[0] || null;
  const meta = view.meta || {};
  // With the party apart each group is a system of its own: its fight, its Duncan
  const lane = view.party && character ? sceneIdOf(view.party, character.id) || '' : '';
  const encounter = (lane ? view.encounters?.[lane] : view.encounter) || null;
  const laneNow = lane ? meta.lanes?.[lane] || {} : { generating: meta.isGenerating, combat: meta.combatBusy };
  const inCombat = Boolean(encounter && encounter.status === 'active');
  const turnUid = inCombat ? currentHeroUid(encounter) : null;
  // A finished fight of their group: its players close it (the host may be watching another scene)
  const finisher = lane && encounter ? mine.find(h => (encounter.heroIds || []).includes(h.id)) : null;

  // New chat lines: seen while the chat is on screen (a phone on its tab; a computer
  // with the column open, which in a fight means the rail opened)
  if (!encounter && railOpen) setRailOpen(false);
  const chat = shared?.chat || [];
  const chatOnScreen = sideTab === 'room' && (wide ? (!encounter || railOpen) : mobileTab === 'side');
  if (chatOnScreen && lastChatAt(chat) > chatSeenAt) setChatSeenAt(lastChatAt(chat));
  const unreadChat = chatOnScreen ? 0 : unreadChatCount(chat, playerId, chatSeenAt);
  const notice = localNotice || room.notices[0]?.text || null;
  const closeNotice = () => {
    if (localNotice) setLocalNotice(null);
    else room.dismissNotice();
  };

  if (room.status !== 'joined' || !character || !view.world) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0b090e]">
        <div className="max-w-md w-full rounded-2xl bg-[#141019] border border-sky-900/60 p-6 text-center space-y-3">
          {room.status === 'rejected' ? (
            <>
              <WifiOff className="w-8 h-8 mx-auto text-red-300" />
              <p className="text-stone-100 font-cinzel font-bold">No has podido entrar en la sala {code}</p>
              <p className="text-sm text-stone-300">{room.error}</p>
            </>
          ) : (
            <>
              <Loader2 className="w-8 h-8 mx-auto text-sky-300 animate-spin" />
              <p className="text-stone-100 font-cinzel font-bold">Entrando en la sala {code}…</p>
              <p className="text-xs text-stone-400">{room.error || 'Esperando al anfitrión. Si tarda, comprueba el código y que su partida esté abierta.'}</p>
            </>
          )}
          <button onClick={onLeave} className="mt-2 px-4 py-2 rounded-xl border border-stone-700 text-stone-200 text-sm hover:bg-stone-800">Volver a la portada</button>
        </div>
      </div>
    );
  }

  const send = intent => {
    room.send(intent);
  };

  // A party apart (see splitParty.js): this player follows the scenes of the characters
  // they play (all of them if the host lets everyone read the others' scenes)
  const apart = isSplit(view.party);
  const viewerIds = shared?.shareScenes ? null : mine.map(h => h.id);
  const scenes = visibleScenes(view.party, view.world, viewerIds);
  const ownScene = sceneIdOf(view.party, character.id);
  const shownScene = !apart ? null : scenes.some(s => s.id === ownScene) ? ownScene : scenes[0]?.id || null;
  const shownLead = apart ? (groupById(view.party, shownScene)?.memberIds || []).find(id => heroes.some(h => h.id === id)) || character.id : character.id;
  const scope = scopeParty(view.party, shownLead);
  const sceneHeroes = memberSheets(encounter?.heroIds?.length ? scopeParty(view.party, encounter.heroIds[0]) : scope);
  const sceneWorldView = sceneWorld(view.world, view.party, shownLead);
  const chronicle = sceneMessages(view.chronicle || [], chronicleKey(groupById(view.party, shownScene)));
  const prologues = readablePrologues(view.party, viewerIds).map(p => ({ id: p.id, label: `Prólogo de ${p.names}${p.place ? ` (${p.place})` : ''}`, messages: sceneMessages(view.chronicle || [], p.id) }));
  const suggestions = shownScene ? groupById(view.party, shownScene)?.suggestions || [] : meta.suggestedActions || [];
  const placeOf = id => view.world.mapNodes?.find(n => n.id === groupOf(view.party, id)?.nodeId)?.name || '';
  const elsewhere = apart ? heroes.filter(h => !sceneHeroes.some(s => s.id === h.id) && (!viewerIds || viewerIds.includes(h.id))).map(h => ({ ...h, place: placeOf(h.id) })) : [];
  const sceneTabs = apart && scenes.length > 1 ? scenes.map(s => ({ id: s.id, label: s.names, place: s.place, active: s.id === shownScene, spotlight: s.spotlight })) : [];
  const chooseScene = id => {
    const g = groupById(view.party, id);
    const who = g?.memberIds.find(m => !viewerIds || viewerIds.includes(m));
    if (who) setSelectedId(who);
  };
  const mapMarkers = scenes.map(s => ({ nodeId: s.nodeId, label: s.names, current: s.id === shownScene }));
  const meetingNodeId = apart && groupById(view.party, shownScene)?.hook ? view.party.split.meetingNodeId : null;
  // Where a new character may start (a campaign that started apart): the zones on the map
  const startZones = isOriginsCampaign(view.party) ? zonesFor(view.world).filter(z => view.world.mapNodes?.some(n => n.id === z.id)) : [];
  const acts = sheetIntents(character.id);
  const mayAct = canControl(shared, playerId, character.id);
  const actFor = build => (...args) => {
    if (!mayAct) {
      setLocalNotice(`${character.name} lo juega ${playerName(shared, controllerOf(shared, character.id))}.`);
      return;
    }
    send(build(...args));
  };
  const hostOnly = () => setLocalNotice(HOST_ONLY);
  // Their own character: equipment (outside combat) and level up, checked by the host
  const changeEquipment = next => {
    if (!mayAct) return actFor(() => null)();
    send({ type: 'equip', characterId: character.id, hands: { main: next.hands?.main || null, off: next.hands?.off || null }, armorId: next.wornArmor || null });
  };
  const openLevelUp = () => {
    if (!mayAct) return actFor(() => null)();
    if (inCombat) return setLocalNotice('Sube de nivel cuando acabe el combate.');
    setLevelUpId(character.id);
  };
  // A player without a character of their own creates one while the party has room
  const canCreate = Boolean(shared) && !claimOf(shared, playerId) && heroes.length < MAX_PARTY && !inCombat;
  const levelingHero = heroes.find(h => h.id === levelUpId && canLevelUp(h) && canControl(shared, playerId, h.id)) || null;
  const turnPlayer = turnUid && controllerOf(shared, turnUid) !== playerId ? playerName(shared, controllerOf(shared, turnUid)) : null;
  const storyNotice = mine.length === 0
    ? (heroes.length < MAX_PARTY
      ? 'Aún no juegas con ningún personaje: crea el tuyo («Crear mi personaje») o elige uno libre en la pestaña «Sala».'
      : 'Aún no juegas con ningún personaje: el grupo está completo, así que elige uno libre en la pestaña «Sala» o espera a la votación.')
    : !mayAct ? `${character.name} lo juega ${playerName(shared, controllerOf(shared, character.id))}: elige a uno de los tuyos para actuar.`
      : laneNow.generating ? 'Duncan está respondiendo: lo que escribas esperará en la cola de la sala.' : null;
  const tabClass = on => `flex-1 py-2 text-center border-b-2 ${on ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-transparent text-stone-400'}`;

  return (
    <div className="h-screen flex flex-col bg-[#0b090e] overflow-hidden text-[#e8ded2]">
      <header className="h-14 bg-[#120f18] border-b border-sky-950/60 px-2 sm:px-4 flex items-center justify-between shrink-0 z-30 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={onLeave} className="flex items-center gap-1 text-xs text-stone-400 hover:text-amber-300">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Salir</span>
          </button>
          <span className="font-cinzel font-bold text-amber-200 text-sm truncate">{meta.title || 'Partida online'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${room.hostOnline ? 'border-sky-700/60 bg-sky-950/60 text-sky-200' : 'border-red-800/60 bg-red-950/50 text-red-200'}`}>
            {room.hostOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            Sala {shared?.code || code}
          </span>
          <span className="hidden md:inline text-stone-400">Juegas como <strong className="text-stone-100">{name}</strong></span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`w-full ${encounter ? 'lg:w-60 xl:w-64' : 'lg:w-72 xl:w-80'} shrink-0 ${mobileTab === 'party' ? 'block' : 'hidden lg:block'}`}>
          <PartyPanel
            character={character}
            party={sceneHeroes}
            elsewhere={elsewhere}
            purse={scope.gold}
            onSelectMember={setSelectedId}
            onDismissMember={hostOnly}
            onTransferItem={() => HOST_ONLY}
            longRestCost={longRestCost(scope)}
            onUpdateCharacter={changeEquipment}
            onOrderDrink={hostOnly}
            onRollCheck={actFor(acts.check)}
            onCastSpell={actFor(acts.spell)}
            onRest={hostOnly}
            onLevelUp={openLevelUp}
            onUseItem={actFor(acts.item)}
            busy={false}
            inCombat={inCombat}
            atTavern={isAtTavern(sceneWorldView)}
          />
        </div>

        <div className={`flex-1 min-w-0 flex-col h-full overflow-hidden ${mobileTab === 'story' ? 'flex' : 'hidden lg:flex'}`}>
          {canCreate && (
            <div className="px-4 py-2.5 bg-emerald-950/30 border-b border-emerald-900/60 flex flex-wrap items-center gap-2 text-xs" role="region" aria-label="Crear personaje">
              <span className="flex-1 min-w-[12rem] text-emerald-100">
                El grupo tiene sitio ({heroes.length}/{MAX_PARTY}): crea tu personaje y se unirá a la partida al nivel del grupo.
              </span>
              <button onClick={() => setCreating(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold">
                Crear mi personaje
              </button>
            </div>
          )}
          {encounter ? (
            <Suspense fallback={null}>
              <CombatView
                encounter={encounter}
                heroes={sceneHeroes}
                onAction={action => send({ type: 'combat', characterId: turnUid, action })}
                onFinish={() => (finisher ? send({ type: 'finish', characterId: finisher.id }) : null)}
                canFinish={Boolean(finisher)}
                busy={Boolean(laneNow.combat)}
                waitingFor={turnPlayer}
              />
            </Suspense>
          ) : (
            <StoryStream
              messages={chronicle}
              isGenerating={Boolean(laneNow.generating)}
              suggestedActions={suggestions}
              character={character}
              party={heroes}
              actors={mine}
              onSelectMember={setSelectedId}
              scenes={sceneTabs}
              onSelectScene={chooseScene}
              prologues={prologues}
              memberPlaces={apart ? Object.fromEntries(heroes.map(h => [h.id, placeOf(h.id)])) : null}
              pendingRecruit={null}
              world={sceneWorldView}
              onSendAction={actFor(acts.text)}
              onOpenGeminiConnect={() => setLocalNotice(meta.aiActive ? 'Duncan usa la clave de Gemini del anfitrión: tú no necesitas ninguna.' : 'El anfitrión juega con el motor local (sin IA). Si conecta su clave de Gemini, Duncan narrará para todos.')}
              keysCount={meta.aiActive ? 1 : 0}
              onQuickCheck={skillId => actFor(acts.check)({ skillId })}
              inputLocked={mine.length === 0}
              inputNotice={meta.pendingRecruit ? `${meta.pendingRecruit.character?.name} quiere unirse al grupo: decide el anfitrión.` : storyNotice}
            />
          )}
        </div>

        <SideColumn
          collapsed={Boolean(encounter)}
          open={railOpen}
          onOpenChange={setRailOpen}
          badge={unreadChat}
          mobileVisible={mobileTab === 'side'}
          label="Sala, chat y mapa"
          railIcons={[Users, MapIcon]}
          widthClass="lg:w-80 xl:w-96"
        >
        <div className="w-full h-full flex flex-col overflow-hidden border-l border-amber-950/60 bg-[#120f18]">
          <div className="flex border-b border-amber-950/60 text-xs font-semibold shrink-0">
            <button onClick={() => setSideTab('room')} className={tabClass(sideTab === 'room')}>Sala y chat{unreadChat > 0 ? ` (${unreadChat})` : ''}</button>
            <button onClick={() => setSideTab('map')} className={tabClass(sideTab === 'map')}>Mapa y misiones</button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {sideTab === 'room' ? (
              <RoomPanel room={shared} me={playerId} characters={heroes} link={roomLink(shared.code, kind)} onIntent={send} />
            ) : (
              <WorldMapPanel
                world={sceneWorldView}
                onTravelToNode={apart ? actFor(acts.travel) : hostOnly}
                markers={apart ? mapMarkers : []}
                meetingNodeId={meetingNodeId}
                travelLocked={apart && (laneNow.generating || inCombat) ? 'Espera a que Duncan termine para viajar.' : null}
                summary={view.journal?.summary || ''}
                events={view.journal?.events || []}
                quests={view.journal?.quests || []}
                onAbandonQuest={hostOnly}
                onQuestSeen={() => {}}
                onOpenShop={hostOnly}
                shopsLocked="Las compras las hace el anfitrión en esta fase."
              />
            )}
          </div>
        </div>
        </SideColumn>

        {/* The host left: the room waits */}
        {!room.hostOnline && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6" role="alertdialog" aria-label="Sala en pausa">
            <div className="max-w-sm rounded-2xl bg-[#141019] border border-red-900/60 p-5 text-center space-y-2">
              <WifiOff className="w-8 h-8 mx-auto text-red-300" />
              <p className="font-cinzel font-bold text-stone-100">Sala en pausa</p>
              <p className="text-sm text-stone-300">El anfitrión se ha desconectado. La partida sigue en su navegador: en cuanto vuelva, continuaréis donde lo dejasteis.</p>
            </div>
          </div>
        )}
      </div>

      {creating && canCreate && (
        <Suspense fallback={null}>
          <CharacterWizard
            world={view.world}
            completeLabel="Unirme al grupo"
            onCancel={() => setCreating(false)}
            onComplete={(built, draft) => {
              setCreating(false);
              // A campaign that started apart: first, where the character starts
              if (startZones.length) {
                setPendingDraft({ character: built, draft, zoneId: suggestZone(built, startZones)?.id || null });
                return;
              }
              // Only the choices travel: the host builds the sheet with the rules
              send({ type: 'create', draft });
              setLocalNotice('Ficha enviada al anfitrión: tu personaje aparecerá en el grupo en un momento.');
            }}
          />
        </Suspense>
      )}

      {pendingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="start-zone-title">
          <div className="max-w-md w-full rounded-2xl bg-[#141019] border border-emerald-900/60 p-5 space-y-3">
            <h2 id="start-zone-title" className="font-cinzel font-bold text-stone-100">¿Dónde empieza {pendingDraft.character?.name || 'tu personaje'}?</h2>
            <p className="text-xs text-stone-400">Esta campaña empezó «cada uno desde su origen»: tu personaje empieza en su tierra y la historia lo llevará hasta los demás.</p>
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {startZones.map(z => {
                const why = fitLabel(pendingDraft.character || {}, z);
                return (
                  <li key={z.id}>
                    <label className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer ${pendingDraft.zoneId === z.id ? 'border-emerald-500 bg-emerald-950/30 text-emerald-100' : 'border-stone-800 text-stone-300'}`}>
                      <input type="radio" name="start-zone" checked={pendingDraft.zoneId === z.id} onChange={() => setPendingDraft(prev => ({ ...prev, zoneId: z.id }))} className="mt-0.5 accent-emerald-500" />
                      <span>
                        <span className="font-semibold">{z.name}</span>{z.id === suggestZone(pendingDraft.character || {}, startZones)?.id ? ' (sugerida)' : ''}
                        <span className="block text-[10px] text-stone-500">{z.desc}{why ? ` · Encaja por: ${why}` : ''}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingDraft(null)} className="px-3 py-1.5 rounded-lg border border-stone-700 text-stone-300 text-xs">Cancelar</button>
              <button
                onClick={() => {
                  send({ type: 'create', draft: pendingDraft.draft, zoneId: pendingDraft.zoneId });
                  setPendingDraft(null);
                  setLocalNotice('Ficha enviada al anfitrión: tu personaje aparecerá en su zona en un momento.');
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-bold"
              >
                Empezar aquí
              </button>
            </div>
          </div>
        </div>
      )}

      {levelingHero && (
        <Suspense fallback={null}>
          <LevelUpModal
            key={levelingHero.id}
            character={levelingHero}
            hostRolls
            onSubmitChoices={choices => {
              send({ type: 'levelUp', characterId: levelingHero.id, choices });
              setLevelUpId(null);
            }}
            onClose={() => setLevelUpId(null)}
          />
        </Suspense>
      )}

      <OnlineToast text={notice} onClose={closeNotice} />

      {/* Phone: the sections in a bar at the bottom */}
      <MobileTabBar
        active={mobileTab}
        onChange={setMobileTab}
        tabs={[
          { id: 'story', label: encounter ? 'Combate' : 'Crónica', icon: encounter ? Swords : ScrollText },
          { id: 'party', label: 'Grupo', icon: Shield },
          { id: 'side', label: 'Sala y mapa', icon: Users, badge: unreadChat }
        ]}
      />
    </div>
  );
}
