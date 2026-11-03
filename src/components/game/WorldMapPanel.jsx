import React from 'react';
import { Compass, MapPin, Shield, Flag, Skull, CheckCircle2 } from 'lucide-react';

export default function WorldMapPanel({ world, onTravelToNode }) {
  return (
    <div className="h-full flex flex-col bg-[#120f18] border-l border-amber-950/60 overflow-hidden text-stone-200">
      
      {/* World Map Header */}
      <div className="p-4 bg-gradient-to-b from-[#1c1626] to-[#120f18] border-b border-amber-950/50">
        <div className="flex items-center gap-2 mb-1">
          <Compass className="w-4 h-4 text-amber-500" />
          <h3 className="font-cinzel font-bold text-stone-100 text-sm">
            Mapa de {world.name}
          </h3>
        </div>
        <p className="text-xs text-stone-400 font-mono">
          UBICACIÓN: <span className="text-amber-300 font-semibold">{world.initialLocation}</span>
        </p>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-6">
        
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
                onClick={() => !isLocked && onTravelToNode(node)}
                title={`${node.name} - ${node.desc}`}
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
                  {isCurrent ? '📍' : isLocked ? '🔒' : '🏛️'}
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
        <div>
          <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-2">
            Puntos de Interés Registrados:
          </span>
          <div className="space-y-2">
            {world.mapNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => node.status !== 'locked' && onTravelToNode(node)}
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
                </div>
                {node.status === 'discovered' && (
                  <button className="text-[10px] text-amber-400 hover:text-amber-300 font-bold shrink-0 self-center">
                    Viajar →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Faction Reputations */}
        <div>
          <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-2">
            Reputación con Facciones:
          </span>
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
        </div>

        {/* Active Quests */}
        <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-800 text-xs">
          <div className="flex items-center gap-1.5 text-amber-400 font-cinzel font-bold mb-2">
            <Flag className="w-3.5 h-3.5" />
            <span>Misiones en Curso</span>
          </div>
          <ul className="space-y-1.5 text-stone-300 text-[11px]">
            <li className="flex items-center gap-1.5">
              <span className="text-amber-500">▹</span>
              <span>Averiguar quién es el encapuchado del rincón.</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="text-amber-500">▹</span>
              <span>Explorar el viejo molino quebrado antes del anochecer.</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="text-stone-500 line-through">▹ Pagar la primera ronda a Maese Duncan.</span>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
