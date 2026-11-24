import React, { useState, Suspense } from 'react';
import { Store, Map as MapIcon, Flag, ScrollText } from 'lucide-react';
import { QuestJournal } from './lazyParts';
import { currentNode, shopsAt, SHOP_TYPES } from '../../utils/shops';
import { unseenQuestCount } from '../../utils/quests';

/**
 * `onOpenShop(type)`: open a shop of the current location.
 * `shopsLocked`: why the shops can't be opened now (a fight...), or null.
 * Three tabs: the map (with the shops of the place), the quests and the campaign diary.
 * A party apart (see splitParty.js): `markers` [{ nodeId, label, current }] show where
 * each group this screen follows is, `meetingNodeId` the meeting point once this scene
 * has a reason to go there, `travelLocked` why travelling has to wait.
 */
export default function WorldMapPanel({
  world, onTravelToNode, summary = '', events = [], onOpenShop, shopsLocked = null,
  quests = [], onAbandonQuest = () => {}, onQuestSeen = () => {},
  markers = [], meetingNodeId = null, travelLocked = null
}) {
  const [tab, setTab] = useState('map'); // 'map' | 'quests' | 'diary'
  const travel = node => {
    if (travelLocked || node.status === 'current' || node.status === 'locked') return;
    onTravelToNode(node);
  };
  const othersAt = nodeId => markers.filter(m => m.nodeId === nodeId && !m.current).map(m => m.label);
  const here = currentNode(world);
  const shops = shopsAt(here, world);
  const news = unseenQuestCount(quests);
  const tabs = [
    { id: 'map', label: 'Mapa', icon: MapIcon },
    { id: 'quests', label: 'Misiones', icon: Flag, badge: news },
    { id: 'diary', label: 'Diario', icon: ScrollText }
  ];
  return (
    <div className="h-full flex flex-col bg-[#120f18] border-l border-amber-950/60 overflow-hidden text-stone-200">
      
      {/* Tabs: map, quests (with news), diary */}
      <div className="flex border-b border-amber-950/60 text-xs font-medium bg-[#16121e] shrink-0" role="tablist">
        {tabs.map(({ id, label, icon, badge }) => {
          const TabIcon = icon;
          return (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              tab === id ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-semibold' : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <TabIcon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {badge > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-amber-500 text-stone-950 text-[9px] font-bold flex items-center justify-center" aria-label={`${badge} novedades`}>{badge}</span>}
          </button>
          );
        })}
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-5">
        {tab === 'map' && (<>
        {/* Shops of the place (only where there are some) */}
        {shops.length > 0 && onOpenShop && (
          <div className="p-2.5 rounded-xl bg-[#17131f] border border-amber-900/30">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-stone-400 flex items-center gap-1 mr-0.5">
                <Store className="w-3.5 h-3.5" /> Aquí:
              </span>
              {shops.map(type => (
                <button
                  key={type}
                  onClick={() => onOpenShop(type)}
                  disabled={Boolean(shopsLocked)}
                  title={shopsLocked || `Entrar en ${SHOP_TYPES[type].name.toLowerCase()}`}
                  className="px-2 py-1 rounded-lg bg-[#1f1829] hover:bg-amber-950/50 border border-amber-800/50 text-amber-200 text-[11px] font-semibold disabled:opacity-40 transition-colors"
                >
                  {SHOP_TYPES[type].icon} {SHOP_TYPES[type].name}
                </button>
              ))}
            </div>
            {shopsLocked && <p className="mt-1.5 text-[10px] text-amber-300/80">{shopsLocked}</p>}
          </div>
        )}

        {/* Dynamic Parchment Visual Map */}
        <div className="relative w-full h-52 rounded-2xl bg-[#181320] border-2 border-amber-900/40 p-3 overflow-hidden shadow-inner flex items-center justify-center">
          {/* Decorative parchment background grid */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:16px_16px]" />
          
          {/* Compass rose decorative overlay */}
          <div className="absolute top-2 right-2 text-amber-600/30 text-2xl select-none font-cinzel">
            ✦ N
          </div>

          {/* SVG Connection Lines between nodes */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {world.mapNodes.map((node, i) => {
              if (i === 0) return null;
              const prev = world.mapNodes[i - 1];
              return (
                <line
                  key={`line-${i}`}
                  x1={`${prev.x}%`}
                  y1={`${prev.y}%`}
                  x2={`${node.x}%`}
                  y2={`${node.y}%`}
                  stroke={node.status === 'locked' ? '#382c46' : '#d97706'}
                  strokeWidth="2"
                  strokeDasharray={node.status === 'locked' ? '4 4' : '2 2'}
                  opacity={node.status === 'locked' ? 0.3 : 0.7}
                />
              );
            })}
          </svg>

          {/* Render interactive map nodes */}
          {world.mapNodes.map((node) => {
            const isCurrent = node.status === 'current';
            const isLocked = node.status === 'locked';

            return (
              <div
                key={node.id}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onClick={() => travel(node)}
                title={`${node.name} - ${node.desc}${othersAt(node.id).length ? ` · Aquí: ${othersAt(node.id).join(', ')}` : ''}${node.id === meetingNodeId ? ' · Punto de encuentro' : ''}`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
                  isLocked ? 'cursor-not-allowed opacity-50' : 'hover:scale-125'
                }`}
              >
                {/* Node icon / beacon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-md border ${
                  isCurrent 
                    ? 'bg-amber-600 border-yellow-300 text-stone-950 ring-4 ring-amber-500/30 font-bold' 
                    : isLocked
                    ? 'bg-stone-900 border-stone-700 text-stone-500'
                    : 'bg-[#241a2e] border-amber-600/70 text-amber-300'
                }`}>
                  {isCurrent ? '📍' : isLocked ? '🔒' : node.id === meetingNodeId ? '🧭' : othersAt(node.id).length ? '👥' : '🏛️'}
                </div>

                {/* Node name tooltip on hover */}
                <div className="absolute top-9 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 whitespace-nowrap px-2 py-1 rounded bg-stone-950 border border-amber-600/50 text-[10px] text-amber-200 shadow-xl pointer-events-none">
                  {node.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* Current Location & Explored Nodes list */}
        <details>
          <summary className="cursor-pointer select-none text-[11px] font-mono uppercase text-stone-400 tracking-wider mb-2 hover:text-amber-300">
            Lugares conocidos ({world.mapNodes.filter(n => n.status !== 'locked').length})
          </summary>
          <div className="space-y-2">
            {world.mapNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => travel(node)}
                className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 transition-colors ${
                  node.status === 'current'
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                    : node.status === 'locked'
                    ? 'bg-stone-900/40 border-stone-800 text-stone-500'
                    : 'bg-[#17131f] border-stone-800 hover:border-amber-600/40 cursor-pointer text-stone-300'
                }`}
              >
                <div>
                  <div className="font-cinzel font-bold text-xs flex items-center gap-1.5">
                    {node.status === 'current' && <span className="text-amber-400">● Actual:</span>}
                    <span>{node.name}</span>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">
                    {node.desc}
                  </p>
                  {node.id === meetingNodeId && <p className="text-[10px] text-emerald-300 mt-0.5">🧭 Punto de encuentro: allí os llevan vuestros motivos.</p>}
                  {othersAt(node.id).length > 0 && <p className="text-[10px] text-sky-300 mt-0.5">👥 Aquí: {othersAt(node.id).join(', ')}</p>}
                </div>
                {node.status === 'discovered' && !travelLocked && (
                  <button className="text-[10px] text-amber-400 hover:text-amber-300 font-bold shrink-0 self-center">
                    Viajar →
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>

        {/* Faction Reputations */}
        <details>
          <summary className="cursor-pointer select-none text-[11px] font-mono uppercase text-stone-400 tracking-wider mb-2 hover:text-amber-300">
            Reputación con facciones
          </summary>
          <div className="space-y-2">
            {world.factions.map((fac, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-[#17131f] border border-stone-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-stone-300">{fac.name}</span>
                  <span className={`text-[10px] font-mono font-bold ${fac.color}`}>
                    {fac.status} ({fac.rep}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-900 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      fac.status === 'Hostil' ? 'bg-red-500' :
                      fac.status === 'Amistoso' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${fac.rep}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </details>

        </>)}

        {tab === 'quests' && (<>
        {/* Quest journal: opened and closed by the story; the player can only abandon one */}
        <Suspense fallback={null}>
          <QuestJournal quests={quests} onAbandon={onAbandonQuest} onSeen={onQuestSeen} />
        </Suspense>

        </>)}

        {tab === 'diary' && (<>
        {/* Campaign diary: Duncan's summary + facts recorded by the game */}
        <div className="p-3 rounded-xl bg-[#17131f] border border-amber-900/30">
          <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-1.5">Diario de campaña</span>
          {summary ? (
            <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-line">{summary}</p>
          ) : (
            <p className="text-[11px] text-stone-500 italic">
              Con la IA conectada, Maese Duncan irá resumiendo aquí lo importante de la partida.
            </p>
          )}
          {events.length > 0 && (
            <ul className="mt-2 pt-2 border-t border-stone-800 space-y-0.5">
              {events.slice(-6).reverse().map((event, index) => (
                <li key={`${index}-${event}`} className="text-[11px] text-stone-400">· {event}</li>
              ))}
            </ul>
          )}
        </div>

        </>)}

      </div>
    </div>
  );
}
