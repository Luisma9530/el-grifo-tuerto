import React, { useEffect, useRef, useState } from 'react';
import { FlaskConical, Footprints, Shield, Skull, Swords, Wand2, Heart, Flag, Hand, Unlock, Brain } from 'lucide-react';
import { attackOptions, damageLabel, rageBonus } from '../../utils/combat';
import { spellRows, spellSummary } from '../../utils/spellcasting';
import { formatModifier } from '../../utils/characterBuilder';
import { activeEnemies, isPlayerTurn, escapableCondition, escapeBonus, currentHeroUid, concentrationOf } from '../../utils/encounter';
import { speedZeroReason, conditionName } from '../../utils/conditions';
import ConditionBadges from './ConditionBadges';
import { normalizeEquipment, fleeDC } from '../../utils/equipment';
import EquipmentPanel from './EquipmentPanel';
import { healingDice } from '../../utils/items';

const LOG_COLORS = {
  info: 'text-stone-400', hit: 'text-emerald-300', crit: 'text-emerald-200 font-semibold', miss: 'text-stone-400',
  heal: 'text-sky-300', down: 'text-amber-300 font-semibold', morale: 'text-amber-200', end: 'text-amber-100 font-semibold',
  enemyHit: 'text-red-300', enemyCrit: 'text-red-200 font-semibold', enemyMiss: 'text-stone-500',
  duncan: 'text-amber-100/90 italic font-serif', injury: 'text-red-400 font-bold',
  condition: 'text-fuchsia-300', conditionEnd: 'text-teal-300', herodown: 'text-red-300 font-semibold'
};

const ACTION_TABS = [
  { id: 'attacks', label: 'Atacar', icon: Swords },
  { id: 'spells', label: 'Conjuros', icon: Wand2 },
  { id: 'gear', label: 'Equipo', icon: Hand },
  { id: 'other', label: 'Otras', icon: Shield }
];

/**
 * Change what the hero holds. House rule: it takes the whole turn, so the
 * choice is staged here and confirmed with one button.
 */
function SwapGear({ character, disabled, onSwap }) {
  const current = normalizeEquipment(character);
  const [draft, setDraft] = useState(current);
  const changed = draft.hands.main !== current.hands.main || draft.hands.off !== current.hands.off;
  return (
    <div className="space-y-2">
      <EquipmentPanel character={draft} onChange={setDraft} showLimbs={false} lockArmor="La armadura no se cambia en mitad de un combate." />
      <div className="flex items-center gap-2">
        <button disabled={disabled || !changed} onClick={() => onSwap(draft.hands)}
          className="flex-1 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 text-xs font-bold">
          Cambiar de equipo · gasta tu acción
        </button>
        {changed && (
          <button onClick={() => setDraft(current)} className="px-3 py-2 rounded-lg border border-stone-700 text-stone-300 text-xs">Deshacer</button>
        )}
      </div>
    </div>
  );
}

const STATUS_LABELS = { dead: 'Abatido', fled: 'Ha huido', surrendered: 'Se ha rendido' };

function EnemyCard({ enemy, selected, onSelect, isTurn, nameOf }) {
  const out = enemy.status !== 'active';
  const percent = Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100));
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={out}
      aria-pressed={selected}
      className={`text-left p-2.5 rounded-xl border transition-colors ${
        out ? 'bg-stone-950/60 border-stone-900 opacity-50' :
        selected ? 'bg-red-500/15 border-red-400' : 'bg-[#17131f] border-stone-800 hover:border-red-700/60'
      } ${isTurn ? 'ring-2 ring-amber-400/70' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold truncate ${out ? 'text-stone-500 line-through' : 'text-stone-100'}`}>{enemy.name}</span>
        <span className="text-[10px] font-mono text-stone-400 shrink-0">CA {enemy.ac}</span>
      </div>
      {(enemy.elite || enemy.baseName !== enemy.name.replace(/ \d+$/, '')) && (
        <p className="text-[10px] text-stone-500 truncate">
          {enemy.baseName}{enemy.elite && <span className="ml-1 text-amber-400 font-semibold">· élite</span>}
        </p>
      )}
      {enemy.trait && <p className="text-[10px] italic text-stone-400 truncate" title={enemy.trait}>{enemy.trait}</p>}
      {out ? (
        <p className="text-[10px] text-stone-500 mt-1">{STATUS_LABELS[enemy.status]}</p>
      ) : (
        <>
          <div className="mt-1.5 h-1.5 rounded-full bg-stone-900 overflow-hidden">
            <div className={`h-full ${percent > 50 ? 'bg-emerald-500' : percent > 25 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${percent}%` }} />
          </div>
          <p className="text-[10px] font-mono text-stone-500 mt-0.5">{enemy.hp}/{enemy.maxHp} PG{enemy.skipTurns ? ' · pierde su turno' : ''}</p>
          <ConditionBadges creature={enemy} nameOf={nameOf} focusable={false} size="xs" className="mt-1" />
        </>
      )}
    </button>
  );
}

/** A hero of the party in the fight: HP, AC, conditions, concentration; the one whose turn it is is highlighted. */
function HeroCard({ hero, encounter, isTurn, nameOf }) {
  const conc = concentrationOf(encounter, hero.id || 'player');
  const down = hero.hp <= 0;
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-xl border ${isTurn ? 'bg-sky-950/40 border-amber-400 ring-2 ring-amber-400/50' : 'bg-[#121620] border-sky-900/40'} ${down ? 'opacity-70' : ''}`}>
      <span className={`text-xl ${down ? 'grayscale' : ''}`}>{hero.avatar || '🛡️'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-sky-100 truncate">{hero.name}{isTurn ? ' · su turno' : ''}</span>
          <span className="font-mono text-stone-300 flex items-center gap-1 shrink-0"><Heart className="w-3 h-3 text-red-400" /> {hero.hp}/{hero.maxHp} · CA {hero.ac}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-stone-900 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${Math.max(0, Math.round((hero.hp / hero.maxHp) * 100))}%` }} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <ConditionBadges creature={hero} nameOf={nameOf} />
          {conc && (
            <span className="inline-flex items-center gap-1 rounded border border-purple-600/60 bg-purple-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-purple-200"
              title={`${hero.name} se concentra en ${conc.name}: si recibe daño, salvación de Constitución (CD 10 o la mitad del daño) para mantenerlo.`}>
              <Brain className="w-3 h-3" /> Concentración: {conc.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The combat screen (it replaces the chronicle while a fight is on).
 * onAction(action) — see playerAction in encounter.js; onFinish() closes a finished fight.
 * finishLabel: text of that button; endActions: more buttons for a finished fight
 * (e.g. "Revivir en el simulador"); banner: a line above the fight (the simulator's notice).
 */
export default function CombatView({ encounter, heroes: heroesIn = null, character: lone = null, onAction, onFinish, busy, finishLabel = 'Volver a la crónica', endActions = null, banner = null, waitingFor = null, canFinish = true }) {
  const heroes = heroesIn || (lone ? [lone] : []);
  const turnUid = currentHeroUid(encounter);
  // The hero whose turn it is acts; between turns, the first one still standing is shown
  const character = heroes.find(h => (h.id || 'player') === turnUid) || heroes.find(h => h.hp > 0) || heroes[0];
  const group = heroes.length > 1;
  const living = activeEnemies(encounter);
  const [allyUid, setAllyUid] = useState(null);
  const [targetUid, setTargetUid] = useState(living[0]?.uid || null);
  const [raging, setRaging] = useState(false);
  const [tab, setTab] = useState('attacks');
  const logEnd = useRef(null);
  // Online: the hero of this turn is played by somebody else (`waitingFor`: who)
  const playerTurn = isPlayerTurn(encounter) && !busy && !waitingFor;
  const over = encounter.status !== 'active';
  const currentTurn = encounter.order[encounter.turn];

  // Keep a living target selected
  useEffect(() => {
    if (!living.some(e => e.uid === targetUid)) setTargetUid(living[0]?.uid || null);
  }, [living, targetUid]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [encounter.log.length]);

  const spells = spellRows(character).filter(s => !s.blocked);
  const potions = (character.inventory || []).filter(i => healingDice(i));
  const act = action => onAction({ ...action, targetUid });
  // Potions and healing spells: on themselves, or on an ally
  const ally = group ? heroes.find(h => h.id === allyUid && h.id !== character.id) : null;
  const actOnAlly = action => onAction({ ...action, targetUid: ally ? ally.id : targetUid });
  const nameOf = uid => heroes.find(h => (h.id || 'player') === uid)?.name || encounter.enemies.find(e => e.uid === uid)?.name || 'alguien';
  const held = escapableCondition(character);
  const stuck = speedZeroReason(character);
  // Drinking a potion is a Bonus Action: one per turn, and the turn goes on
  const bonusUsed = Boolean(encounter.bonusUsed);
  const actionUsed = Boolean(encounter.actionUsed);
  // Attack, spell, change gear, dodge or flee: one per turn
  const canAct = playerTurn && !actionUsed;

  return (
    <div className="h-full flex flex-col bg-[radial-gradient(ellipse_at_top,_#1d1018_0%,_#0b0a0e_100%)]">
      {banner}
      {/* Header: round and initiative */}
      <div className="px-4 py-2.5 border-b border-red-950/60 bg-[#140d14] flex items-center gap-3 overflow-x-auto">
        <span className="font-cinzel font-bold text-red-200 text-sm shrink-0 flex items-center gap-1.5">
          <Swords className="w-4 h-4" /> Ronda {encounter.round}
        </span>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          {encounter.order.map((slot, index) => {
            const enemy = slot.kind === 'enemy' ? encounter.enemies.find(e => e.uid === slot.uid) : null;
            if (enemy && enemy.status !== 'active') return null;
            const current = index === encounter.turn && !over;
            return (
              <span key={slot.uid || 'player'}
                className={`px-2 py-0.5 rounded border whitespace-nowrap ${
                  current ? 'bg-amber-500/20 border-amber-400 text-amber-200' :
                  slot.kind === 'player' ? 'border-sky-800/60 text-sky-300' : 'border-stone-800 text-stone-400'
                }`}>
                {slot.initiative} · {slot.kind === 'player' ? nameOf(slot.uid || 'player') : enemy.name}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Enemies */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {encounter.enemies.map(enemy => (
            <EnemyCard
              key={enemy.uid}
              enemy={enemy}
              selected={enemy.uid === targetUid}
              isTurn={currentTurn?.uid === enemy.uid && !over}
              onSelect={() => setTargetUid(enemy.uid)}
              nameOf={nameOf}
            />
          ))}
        </div>

        {/* The party */}
        <div className={`grid gap-2 ${group ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {heroes.map(hero => (
            <HeroCard key={hero.id || 'player'} hero={hero} encounter={encounter} nameOf={nameOf} isTurn={!over && (hero.id || 'player') === turnUid} />
          ))}
        </div>

        {/* Log */}
        <div className="rounded-xl bg-black/30 border border-stone-800 p-3 max-h-64 overflow-y-auto text-xs space-y-1" aria-live="polite">
          {encounter.log.map((entry, index) => (
            <p key={index} className={LOG_COLORS[entry.kind] || 'text-stone-300'}>
              <span className="text-stone-600 font-mono mr-1.5">R{entry.round}</span>{entry.text}
            </p>
          ))}
          <div ref={logEnd} />
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-red-950/60 bg-[#110d14] p-3">
        {over ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-100 flex items-center gap-2">
              {encounter.status === 'victory' ? <Flag className="w-4 h-4 text-emerald-400" /> : <Skull className="w-4 h-4 text-red-400" />}
              {encounter.status === 'victory'
                ? `¡Victoria! +${encounter.xp} PX${group ? ' para repartir' : ''}`
                : encounter.status === 'fled' ? (group ? 'El grupo ha escapado del combate.' : 'Has escapado del combate.') : (group ? 'Todo el grupo ha caído.' : 'Has caído en combate.')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {endActions}
              {canFinish ? (
                <button onClick={onFinish} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-cinzel font-bold">
                  {finishLabel}
                </button>
              ) : (
                <span className="text-xs text-stone-400">El anfitrión cerrará el combate.</span>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex gap-1 text-xs">
                {ACTION_TABS.filter(t => t.id !== 'spells' || spells.length > 0).map(t => {
                  const TabIcon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
                      className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${tab === t.id ? 'bg-red-500/20 border-red-400 text-red-100' : 'border-stone-800 text-stone-400 hover:text-stone-200'}`}>
                      <TabIcon className="w-3.5 h-3.5" /> {t.label}
                    </button>
                  );
                })}
              </div>
              <span className={`text-[11px] font-mono ${playerTurn ? 'text-amber-300' : 'text-stone-500'}`}>
                {playerTurn
                  ? `${group ? `Turno de ${character.name}` : 'Tu turno'} · objetivo: ${living.find(e => e.uid === targetUid)?.name || '—'}${bonusUsed ? ' · acción adicional usada' : ''}`
                  : waitingFor && isPlayerTurn(encounter) ? `Turno de ${character.name} · lo juega ${waitingFor}` : 'Los enemigos actúan…'}
              </span>
            </div>

            {playerTurn && (actionUsed || bonusUsed) && (
              <div className="mb-2 p-2 rounded-lg bg-sky-950/30 border border-sky-800/50 flex items-center justify-between gap-2">
                <p className="text-[11px] text-sky-200">
                  {actionUsed
                    ? 'Ya has hecho tu acción. Aún puedes beber una poción (acción adicional, pestaña «Otras») o terminar el turno.'
                    : 'Has bebido una poción (acción adicional). Ahora haz tu acción: atacar, un conjuro, esquivar, huir o cambiar de equipo.'}
                </p>
                <button onClick={() => onAction({ type: 'endTurn' })}
                  className="px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-stone-50 text-[11px] font-bold shrink-0">
                  Terminar turno
                </button>
              </div>
            )}

            {group && (tab === 'spells' || tab === 'other') && (
              <div className="mb-2 flex flex-wrap items-center gap-1 text-[10px]" role="radiogroup" aria-label="Sobre quién usar pociones y curaciones">
                <span className="text-stone-500">Pociones y curaciones sobre:</span>
                {heroes.map(h => {
                  const self = h.id === character.id;
                  const on = self ? !ally : ally?.id === h.id;
                  return (
                    <button key={h.id} type="button" role="radio" aria-checked={on} onClick={() => setAllyUid(self ? null : h.id)}
                      className={`px-1.5 py-0.5 rounded border ${on ? 'border-sky-400 text-sky-100 bg-sky-950/50' : 'border-stone-700 text-stone-400 hover:text-stone-200'}`}>
                      {self ? `${h.name} (sí mismo)` : `${h.name}${h.hp <= 0 ? ' 💤' : ''} ${h.hp}/${h.maxHp}`}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto">
              {tab === 'attacks' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {rageBonus(character) > 0 && (
                    <label className="sm:col-span-2 flex items-center gap-2 text-xs text-stone-300">
                      <input type="checkbox" checked={raging} onChange={e => setRaging(e.target.checked)} className="accent-red-500" />
                      En furia (+{rageBonus(character)} al daño con Fuerza)
                    </label>
                  )}
                  {attackOptions(character).length === 0 && (
                    <p className="sm:col-span-2 text-[11px] text-stone-500">No tienes con qué atacar: cambia de equipo en la pestaña «Equipo» (gasta tu acción).</p>
                  )}
                  {attackOptions(character).map(option => (
                    <button key={option.id} disabled={!canAct || !targetUid}
                      onClick={() => act({ type: 'attack', optionId: option.id, raging })}
                      className="text-left p-2 rounded-lg bg-[#1b1420] border border-stone-800 hover:border-red-600/60 disabled:opacity-40">
                      <span className="block text-xs font-semibold text-stone-100">{option.itemName}</span>
                      <span className="block text-[10px] font-mono text-stone-400">{formatModifier(option.attackBonus)} · {damageLabel(option)} {option.type}</span>
                    </button>
                  ))}
                </div>
              )}

              {tab === 'spells' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {spells.map(spell => (
                    <button key={spell.id} disabled={!canAct || (['attack', 'save', 'auto'].includes(spell.kind) && !targetUid)}
                      onClick={() => (spell.kind === 'heal' ? actOnAlly : act)({ type: 'spell', spellId: spell.id })}
                      className="text-left p-2 rounded-lg bg-[#17121f] border border-stone-800 hover:border-purple-500/60 disabled:opacity-40">
                      <span className="block text-xs font-semibold text-purple-100">{spell.name} <span className="text-stone-500 font-normal">· {spell.level === 0 ? 'truco' : `nivel ${spell.level}`}</span></span>
                      <span className="block text-[10px] font-mono text-stone-400">{spellSummary(spell)}</span>
                    </button>
                  ))}
                </div>
              )}

              {tab === 'gear' && (
                <SwapGear
                  key={JSON.stringify([character.id, normalizeEquipment(character).hands, character.limbs])}
                  character={character}
                  disabled={!canAct}
                  onSwap={hands => act({ type: 'equip', hands })}
                />
              )}

              {tab === 'other' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {potions.length > 0 && (
                    <p className="sm:col-span-2 text-[10px] text-sky-300/80">
                      {bonusUsed
                        ? 'Ya has usado tu acción adicional este turno: podrás beber otra poción en tu siguiente turno.'
                        : 'Beber una poción es una acción adicional: no gasta tu acción y puedes beberla antes o después de ella (una por turno).'}
                    </p>
                  )}
                  {potions.map(item => (
                    <button key={item.id} disabled={!playerTurn || bonusUsed} onClick={() => actOnAlly({ type: 'potion', itemId: item.id })}
                      title={bonusUsed ? 'Ya has usado tu acción adicional este turno' : 'Acción adicional: no gasta tu acción'}
                      className="text-left p-2 rounded-lg bg-[#121a1a] border border-stone-800 hover:border-sky-600/60 disabled:opacity-40 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-sky-300" />
                      <span className="text-xs text-stone-100">{ally ? `Dar ${item.name} a ${ally.name}` : item.name}{item.uses !== undefined ? ` (${item.uses})` : ''} <span className="text-stone-500">· {healingDice(item)} PG · acción adicional</span></span>
                    </button>
                  ))}
                  <button disabled={!canAct} onClick={() => act({ type: 'dodge' })}
                    className="text-left p-2 rounded-lg bg-[#16161c] border border-stone-800 hover:border-stone-500 disabled:opacity-40 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-stone-300" />
                    <span className="text-xs text-stone-100">Esquivar <span className="text-stone-500">· desventaja a sus ataques</span></span>
                  </button>
                  {held && (
                    <button disabled={!canAct} onClick={() => act({ type: 'escape' })}
                      className="text-left p-2 rounded-lg bg-[#1a1416] border border-fuchsia-900/60 hover:border-fuchsia-500/60 disabled:opacity-40 flex items-center gap-2">
                      <Unlock className="w-4 h-4 text-fuchsia-300" />
                      <span className="text-xs text-stone-100">Liberarte <span className="text-stone-500">· {conditionName(held.id).toLowerCase()}, {escapeBonus(character).name} CD {held.duration.dc} · gasta tu acción</span></span>
                    </button>
                  )}
                  <button disabled={!canAct || fleeDC(character) == null || Boolean(stuck)} onClick={() => act({ type: 'flee' })}
                    className="text-left p-2 rounded-lg bg-[#1c1614] border border-stone-800 hover:border-amber-600/60 disabled:opacity-40 flex items-center gap-2">
                    <Footprints className="w-4 h-4 text-amber-300" />
                    <span className="text-xs text-stone-100">Huir <span className="text-stone-500">· {stuck ? `imposible: ${stuck.toLowerCase()} (velocidad 0)` : fleeDC(character) == null ? 'imposible con las dos piernas heridas' : `Destreza CD ${fleeDC(character)}`}</span></span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
