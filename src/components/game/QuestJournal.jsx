import React, { useState } from 'react';
import { Flag, ChevronDown, ChevronRight } from 'lucide-react';
import { activeQuests, finishedQuests, describeReward, QUEST_STATUSES, unseenQuestCount } from '../../utils/quests';

const STATUS_STYLES = {
  active: 'text-amber-300 border-amber-700/60',
  completed: 'text-emerald-300 border-emerald-700/60',
  failed: 'text-red-300 border-red-800/60',
  abandoned: 'text-stone-400 border-stone-700'
};

const sceneLabel = stamp => {
  if (!stamp) return '';
  const date = stamp.date ? new Date(stamp.date) : null;
  const day = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
  return [stamp.scene ? `escena ${stamp.scene}` : '', day].filter(Boolean).join(' · ');
};

/**
 * Quest journal: the quests come from the story (Duncan or the local engine).
 * The player can only read them and give up an active one.
 * `onAbandon(id)`, `onSeen(id)`: the player abandons / opens a quest.
 */
export default function QuestJournal({ quests = [], onAbandon = () => {}, onSeen = () => {} }) {
  const [tab, setTab] = useState('active');
  const [openId, setOpenId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const active = activeQuests(quests);
  const finished = finishedQuests(quests).slice().reverse();
  const shown = tab === 'active' ? active : finished;
  const news = unseenQuestCount(quests);

  const toggle = quest => {
    setOpenId(openId === quest.id ? null : quest.id);
    setConfirmId(null);
    if (quest.unseen) onSeen(quest.id);
  };

  return (
    <div className="p-3 rounded-xl bg-[#17131f] border border-amber-900/30 text-xs" data-testid="quest-journal">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-amber-400 font-cinzel font-bold">
          <Flag className="w-3.5 h-3.5" /> Diario de misiones
        </span>
        {news > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-600/50 text-[10px] text-amber-300">
            {news} {news === 1 ? 'novedad' : 'novedades'}
          </span>
        )}
      </div>

      <div className="flex gap-1 mb-2" role="tablist">
        {[['active', `Activas (${active.length})`], ['finished', `Terminadas (${finished.length})`]].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 py-1 rounded-md text-[11px] font-semibold border ${
              tab === id ? 'bg-amber-950/50 border-amber-700/60 text-amber-200' : 'border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-[11px] text-stone-500 italic">
          {tab === 'active'
            ? 'Sin encargos por ahora. Las misiones llegan con la historia: un tablón de anuncios, un parroquiano con problemas...'
            : 'Todavía no has terminado ninguna misión.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map(quest => {
            const open = openId === quest.id;
            return (
              <li key={quest.id} className={`rounded-lg border bg-[#120f18] ${STATUS_STYLES[quest.status] || STATUS_STYLES.active}`}>
                <button onClick={() => toggle(quest)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left" aria-expanded={open}>
                  {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                  <span className="flex-1 font-semibold text-stone-200 text-[11px]">{quest.title}</span>
                  {quest.unseen && (
                    <span className="text-[9px] uppercase tracking-wide text-amber-300">
                      {quest.unseen === 'new' ? 'Nueva' : 'Actualizada'}
                    </span>
                  )}
                  {quest.status !== 'active' && <span className="text-[10px]">{QUEST_STATUSES[quest.status]}</span>}
                </button>
                {open && (
                  <div className="px-2.5 pb-2 space-y-1 text-[11px] text-stone-300">
                    <p>{quest.objective}</p>
                    {quest.giver && <p className="text-stone-400">Encargo de: <span className="text-stone-300">{quest.giver}</span></p>}
                    {quest.place && <p className="text-stone-400">Dónde: <span className="text-stone-300">{quest.place}</span></p>}
                    <p className="text-stone-400">Recompensa prometida: <span className="text-amber-200">{describeReward(quest.reward)}</span></p>
                    <p className="text-stone-500 text-[10px]">
                      Desde {sceneLabel(quest.started)}{quest.closed ? ` · ${QUEST_STATUSES[quest.status].toLowerCase()} en ${sceneLabel(quest.closed)}` : ''}
                    </p>
                    {quest.notes.length > 0 && (
                      <ul className="pt-1 border-t border-stone-800 space-y-0.5">
                        {quest.notes.map((note, i) => (
                          <li key={i} className="text-stone-400">· {note.text}</li>
                        ))}
                      </ul>
                    )}
                    {quest.status === 'active' && (
                      confirmId === quest.id ? (
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-stone-400">¿Abandonarla? No hay vuelta atrás ni recompensa.</span>
                          <button onClick={() => { onAbandon(quest.id); setConfirmId(null); }} className="px-2 py-0.5 rounded bg-red-950/60 border border-red-800/60 text-red-200">Sí</button>
                          <button onClick={() => setConfirmId(null)} className="px-2 py-0.5 rounded border border-stone-700 text-stone-300">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmId(quest.id)} className="mt-1 text-[10px] text-stone-500 hover:text-red-300 underline">
                          Abandonar misión
                        </button>
                      )
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
