import React, { useMemo, useState } from 'react';
import { ArrowLeft, Wifi, WifiOff, Loader2 } from 'lucide-react';
import PartyPanel from '../game/PartyPanel';
import StoryStream from '../game/StoryStream';
import CombatView from '../game/CombatView';
import WorldMapPanel from '../game/WorldMapPanel';
import RoomPanel from './RoomPanel';
import OnlineToast from './OnlineToast';
import { useGuestRoom } from '../../online/useOnlineRoom';
import { roomLink } from '../../online/transport';
import { controllerOf, canControl, playerName } from '../../online/room';
import { sheetIntents, quickAttackOption } from '../../online/actions';
import { memberSheets } from '../../utils/party';
import { currentHeroUid } from '../../utils/encounter';
import { longRestCost } from '../../utils/partyActions';

const HOST_ONLY = 'En esta fase lo decide el anfitrión (descansos, tiendas, viajes, equipo y subir de nivel se hacen en su pantalla).';

/**
 * A player's table in someone else's room: the game as the host shares it, and
 * what this player sends (actions for the characters they play, combat turns,
 * votes, chat). Nothing is decided here: the host checks and plays everything.
 */
export default function GuestTable({ code, name, kind, onLeave }) {
  const room = useGuestRoom({ code, name, kind });
  const { view, playerId } = room;
  const [selectedId, setSelectedId] = useState(null);
  const [mobileTab, setMobileTab] = useState('story');
  const [sideTab, setSideTab] = useState('room');
  const [localNotice, setLocalNotice] = useState(null);

  const shared = view.room || null;
  const heroes = useMemo(() => (view.party ? memberSheets(view.party) : []), [view.party]);
  const mine = shared ? heroes.filter(h => canControl(shared, playerId, h.id)) : [];
  const character = heroes.find(h => h.id === selectedId) || mine[0] || heroes[0] || null;
  const encounter = view.encounter || null;
  const inCombat = Boolean(encounter && encounter.status === 'active');
  const turnUid = inCombat ? currentHeroUid(encounter) : null;
  const meta = view.meta || {};
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
  const turnPlayer = turnUid && controllerOf(shared, turnUid) !== playerId ? playerName(shared, controllerOf(shared, turnUid)) : null;
  const storyNotice = mine.length === 0
    ? 'Aún no juegas con ningún personaje: elige uno libre en la pestaña «Sala» (o vota los que sobran).'
    : !mayAct ? `${character.name} lo juega ${playerName(shared, controllerOf(shared, character.id))}: elige a uno de los tuyos para actuar.`
      : meta.isGenerating ? 'Duncan está respondiendo: lo que escribas esperará en la cola de la sala.' : null;
  const tabClass = on => `flex-1 py-2 text-center border-b-2 ${on ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-transparent text-stone-400'}`;

  return (
    <div className="h-screen flex flex-col bg-[#0b090e] overflow-hidden text-[#e8ded2]">
      <header className="h-14 bg-[#120f18] border-b border-sky-950/60 px-4 flex items-center justify-between shrink-0 z-30 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={onLeave} className="flex items-center gap-1 text-xs text-stone-400 hover:text-amber-300">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Salir</span>
          </button>
          <span className="font-cinzel font-bold text-amber-200 text-sm truncate">{meta.title || 'Partida online'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${room.hostOnline ? 'border-sky-700/60 bg-sky-950/60 text-sky-200' : 'border-red-800/60 bg-red-950/50 text-red-200'}`}>
            {room.hostOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            Sala {shared?.code || code}
          </span>
          <span className="hidden md:inline text-stone-400">Juegas como <strong className="text-stone-100">{name}</strong></span>
        </div>
      </header>

      <div className="lg:hidden flex border-b border-amber-950/60 bg-[#14101c] text-xs font-semibold">
        <button onClick={() => setMobileTab('story')} className={tabClass(mobileTab === 'story')}>Crónica</button>
        <button onClick={() => setMobileTab('party')} className={tabClass(mobileTab === 'party')}>Grupo</button>
        <button onClick={() => setMobileTab('side')} className={tabClass(mobileTab === 'side')}>
          Sala y mapa{shared?.chat?.length ? ` (${shared.chat.length})` : ''}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`w-full lg:w-72 xl:w-80 shrink-0 ${mobileTab === 'party' ? 'block' : 'hidden lg:block'}`}>
          <PartyPanel
            character={character}
            party={heroes}
            purse={view.party.gold}
            onSelectMember={setSelectedId}
            onDismissMember={hostOnly}
            onTransferItem={() => HOST_ONLY}
            longRestCost={longRestCost(view.party)}
            onUpdateCharacter={hostOnly}
            onOrderDrink={hostOnly}
            onRollCheck={actFor(acts.check)}
            onCastSpell={actFor(acts.spell)}
            onRest={hostOnly}
            onLevelUp={hostOnly}
            onAttack={actFor(acts.attack)}
            onUseItem={actFor(acts.item)}
            busy={false}
            inCombat={inCombat}
          />
        </div>

        <div className={`flex-1 min-w-0 flex-col h-full overflow-hidden ${mobileTab === 'story' ? 'flex' : 'hidden lg:flex'}`}>
          {encounter ? (
            <CombatView
              encounter={encounter}
              heroes={heroes}
              onAction={action => send({ type: 'combat', characterId: turnUid, action })}
              onFinish={() => {}}
              canFinish={false}
              busy={Boolean(meta.combatBusy)}
              waitingFor={turnPlayer}
            />
          ) : (
            <StoryStream
              messages={view.chronicle || []}
              isGenerating={Boolean(meta.isGenerating)}
              suggestedActions={meta.suggestedActions || []}
              character={character}
              party={heroes}
              actors={mine}
              onSelectMember={setSelectedId}
              pendingRecruit={null}
              world={view.world}
              onSendAction={actFor(acts.text)}
              onOpenGeminiConnect={() => setLocalNotice(meta.aiActive ? 'Duncan usa la clave de Gemini del anfitrión: tú no necesitas ninguna.' : 'El anfitrión juega con el motor local (sin IA). Si conecta su clave de Gemini, Duncan narrará para todos.')}
              keysCount={meta.aiActive ? 1 : 0}
              onQuickAttack={() => {
                const option = quickAttackOption(character);
                if (option) actFor(acts.attack)({ optionId: option.id });
              }}
              onQuickCheck={skillId => actFor(acts.check)({ skillId })}
              inputLocked={mine.length === 0}
              inputNotice={meta.pendingRecruit ? `${meta.pendingRecruit.character?.name} quiere unirse al grupo: decide el anfitrión.` : storyNotice}
            />
          )}
        </div>

        <div className={`w-full lg:w-80 xl:w-96 shrink-0 flex-col h-full overflow-hidden border-l border-amber-950/60 bg-[#120f18] ${mobileTab === 'side' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex border-b border-amber-950/60 text-xs font-semibold shrink-0">
            <button onClick={() => setSideTab('room')} className={tabClass(sideTab === 'room')}>Sala y chat</button>
            <button onClick={() => setSideTab('map')} className={tabClass(sideTab === 'map')}>Mapa y misiones</button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {sideTab === 'room' ? (
              <RoomPanel room={shared} me={playerId} characters={heroes} link={roomLink(shared.code, kind)} onIntent={send} />
            ) : (
              <WorldMapPanel
                world={view.world}
                onTravelToNode={hostOnly}
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

      <OnlineToast text={notice} onClose={closeNotice} />
    </div>
  );
}
