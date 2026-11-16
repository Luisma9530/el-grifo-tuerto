import React, { useState, useEffect } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { X, Plus, Heart, Shield, Coins, MapPin, Clock, ScrollText, Trash2, Play } from 'lucide-react';
import { getAllCampaigns, deleteCampaign } from '../utils/campaignStorage';
import { parseClassAndLevel, getCurrentLocation, formatLastPlayed, stripMarkdown } from '../utils/saveSlots';

/**
 * Save-slot picker shown when the player chooses a world:
 * lists that world's saved campaigns and an empty "+" slot to start a new one.
 */
export default function WorldSavesModal({ isOpen, world, onClose, onLoadCampaign, onCreateNew }) {
  useEscapeKey(isOpen, onClose);
  const [saves, setSaves] = useState([]);

  useEffect(() => {
    if (isOpen && world) {
      setSaves(getAllCampaigns().filter(c => c.world?.id === world.id));
    }
  }, [isOpen, world]);

  if (!isOpen || !world) return null;

  const handleDelete = (campaign, e) => {
    e.stopPropagation();
    if (window.confirm(`¿Eliminar la partida "${campaign.title}"? Esta acción no se puede deshacer.`)) {
      deleteCampaign(campaign.id);
      setSaves(getAllCampaigns().filter(c => c.world?.id === world.id));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[#131018] border-2 border-amber-900/50 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="world-saves-title"
      >
        {/* Header */}
        <div className={`p-5 sm:p-6 border-b border-amber-950/60 flex items-start justify-between gap-3 shrink-0 bg-gradient-to-r ${world.coverGradient || 'from-stone-900 to-stone-950'}`}>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-amber-400/80 font-mono mb-1">
              Elige tu partida
            </p>
            <h2 id="world-saves-title" className="font-cinzel text-xl sm:text-2xl font-bold text-amber-100">
              {world.name}
            </h2>
            <p className="text-xs text-stone-300/80 mt-1">
              {saves.length > 0
                ? `${saves.length} partida${saves.length === 1 ? '' : 's'} guardada${saves.length === 1 ? '' : 's'} en este mundo`
                : 'Aún no tienes partidas en este mundo'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-black/30 hover:bg-black/50 text-stone-300 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slots */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
          {saves.map((camp, index) => {
            const ch = camp.character || {};
            const { className, level } = parseClassAndLevel(ch);
            const preview = stripMarkdown(camp.lastPreview || camp.messages?.[camp.messages.length - 1]?.text || '');
            const turns = camp.messageCount ?? camp.messages?.length ?? 0;
            const hpPct = ch.maxHp ? Math.max(0, Math.min(100, (ch.hp / ch.maxHp) * 100)) : null;

            return (
              <div
                key={camp.id}
                role="button"
                tabIndex={0}
                onClick={() => onLoadCampaign(camp)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLoadCampaign(camp); } }}
                className="group relative w-full text-left rounded-xl bg-[#1a1522] hover:bg-[#211a2b] border border-amber-900/40 hover:border-amber-500/70 p-4 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/60"
              >
                <div className="flex gap-4">
                  {/* Slot number + avatar */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono text-stone-500">RANURA {index + 1}</span>
                    <div className="w-14 h-14 rounded-xl bg-stone-950/80 border border-amber-800/50 flex items-center justify-center text-3xl">
                      {ch.avatar || '🛡️'}
                    </div>
                    {level != null && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        NV {level}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-cinzel font-bold text-amber-100 truncate">{ch.name || 'Héroe sin nombre'}</h3>
                        <p className="text-xs text-stone-400 truncate">
                          {[ch.race, className].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-stone-500 shrink-0" title={camp.updatedAt}>
                        <Clock className="w-3 h-3" />
                        {formatLastPlayed(camp.updatedAt)}
                      </span>
                    </div>

                    {camp.title && (
                      <p className="text-[11px] text-amber-400/70 italic truncate mt-0.5">«{camp.title}»</p>
                    )}

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-stone-300">
                      {ch.maxHp != null && (
                        <span className="flex items-center gap-1.5">
                          <Heart className="w-3 h-3 text-red-400" />
                          {ch.hp}/{ch.maxHp}
                          <span className="w-12 h-1.5 rounded-full bg-stone-800 overflow-hidden">
                            <span
                              className={`block h-full ${hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${hpPct}%` }}
                            />
                          </span>
                        </span>
                      )}
                      {ch.ac != null && (
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-sky-400" />CA {ch.ac}</span>
                      )}
                      {ch.gold != null && (
                        <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-yellow-400" />{ch.gold} po</span>
                      )}
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-400" />{getCurrentLocation(camp.world)}</span>
                      <span className="flex items-center gap-1"><ScrollText className="w-3 h-3 text-stone-400" />{turns} entradas</span>
                    </div>

                    {preview && (
                      <p className="text-xs text-stone-500 mt-2 line-clamp-2">“{preview}”</p>
                    )}
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus:opacity-100 transition-opacity">
                  <button
                    onClick={e => handleDelete(camp, e)}
                    className="p-1.5 rounded-lg bg-stone-900/90 hover:bg-red-900/70 border border-stone-700 hover:border-red-600 text-stone-400 hover:text-red-200 transition-colors"
                    title="Eliminar partida"
                    aria-label={`Eliminar partida ${camp.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-stone-950 text-xs font-bold">
                    <Play className="w-3 h-3" /> Continuar
                  </span>
                </div>
              </div>
            );
          })}

          {/* Empty slot: new game */}
          <button
            onClick={onCreateNew}
            className="w-full min-h-[112px] rounded-xl border-2 border-dashed border-stone-700 hover:border-amber-500/80 bg-stone-950/40 hover:bg-amber-950/20 text-stone-500 hover:text-amber-300 flex flex-col items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/60 group"
          >
            <span className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6" />
            </span>
            <span className="font-cinzel font-bold text-sm">Nueva partida</span>
            <span className="text-[11px] text-stone-600 group-hover:text-stone-400">
              Ranura vacía · Comienza una nueva aventura en {world.name}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
