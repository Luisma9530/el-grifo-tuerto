import React, { useState } from 'react';
import { Heart, Shield, Coins, Backpack, Coffee, Sparkles, Wand2, UserMinus } from 'lucide-react';
import { getModifier, getModifierNumber } from '../../utils/gameEngine';
import { skillRows, proficiencyBonus, formatModifier } from '../../utils/characterBuilder';
import { TAVERN_MENU } from '../../data/gameData';
import { tavernAudio } from '../../utils/audio';
import SpellsTab, { RestButtons } from './SpellsTab';
import AttacksPanel from './AttacksPanel';
import ConditionBadges from './ConditionBadges';
import EquipmentPanel from './EquipmentPanel';
import { normalizeEquipment, HANDS, isWorn } from '../../utils/equipment';
import { formatCoins, healingDice, inventoryWeight, formatKg } from '../../utils/items';

import { xpProgress, canLevelUp, canAdvance } from '../../utils/leveling';

const HELD_LABELS = { main: 'En la mano principal', off: 'En la mano secundaria', both: 'En las dos manos' };

/** Compact cards of the party: HP, AC, conditions. Clicking one selects who acts. */
function PartyRoster({ party, activeId, onSelect, busy }) {
  return (
    <div className="p-2 border-b border-amber-950/60 bg-[#100d15]" role="radiogroup" aria-label="Miembros del grupo">
      <div className="grid grid-cols-2 gap-1.5">
        {party.map(member => {
          const percent = Math.max(0, Math.min(100, Math.round((member.hp / Math.max(1, member.maxHp)) * 100)));
          const active = member.id === activeId;
          const down = member.hp <= 0;
          return (
            <button
              key={member.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(member.id)}
              disabled={busy}
              title={`${member.name}: ${member.hp}/${member.maxHp} PG, CA ${member.ac}${down ? ' (inconsciente)' : ''}`}
              className={`text-left p-1.5 rounded-lg border transition-colors ${active ? 'bg-amber-500/15 border-amber-400' : 'bg-[#17131f] border-stone-800 hover:border-amber-700/60'} ${down ? 'opacity-70' : ''}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-base leading-none ${down ? 'grayscale' : ''}`}>{member.avatar || '🛡️'}</span>
                <span className="text-[11px] font-semibold text-stone-100 truncate flex-1">{member.name}</span>
                {canLevelUp(member) && <Sparkles className="w-3 h-3 text-amber-300 shrink-0" aria-label="Puede subir de nivel" />}
              </div>
              <div className="mt-1 h-1 rounded-full bg-stone-900 overflow-hidden">
                <div className={`h-full ${percent > 50 ? 'bg-emerald-500' : percent > 20 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[10px] font-mono text-stone-400">
                <span>{down ? '💤 0' : member.hp}/{member.maxHp} PG</span>
                <span>CA {member.ac}</span>
              </div>
              <ConditionBadges creature={member} nameOf={() => 'un enemigo'} focusable={false} size="xs" className="mt-0.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Give an item to another member (outside combat). */
function GiveItem({ item, character, party, onTransfer }) {
  const [error, setError] = useState(null);
  const others = party.filter(m => m.id !== character.id);
  if (!others.length) return null;
  return (
    <div className="mt-1.5">
      <select
        value=""
        onChange={e => {
          if (!e.target.value) return;
          setError(onTransfer(character.id, e.target.value, item.id));
        }}
        aria-label={`Pasar ${item.name} a otro miembro del grupo`}
        className="bg-[#1a1523] border border-stone-800 rounded px-1.5 py-0.5 text-[10px] text-stone-300"
      >
        <option value="">Pasar a…</option>
        {others.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {error && <p className="text-[10px] text-amber-300 mt-0.5">{error}</p>}
    </div>
  );
}

export default function PartyPanel({
  character,
  party = [character],
  purse = character.gold,
  onSelectMember = () => {},
  onDismissMember = () => {},
  onTransferItem = () => null,
  longRestCost,
  onUpdateCharacter,
  onOrderDrink,
  onRollCheck,
  onCastSpell,
  onRest,
  onLevelUp,
  onAttack,
  onUseItem,
  busy = false,
  inCombat = false
}) {
  const progress = xpProgress(character);
  const levelUpReady = canLevelUp(character);
  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet' | 'spells' | 'inventory' | 'menu'
  const hasMagic = Boolean(character.spellcasting);
  const hands = normalizeEquipment(character).hands;
  const heldIn = itemId => {
    const where = HANDS.filter(h => hands[h] === itemId);
    return where.length === 2 ? 'both' : where[0] || null;
  };
  const hpPercent = Math.max(0, Math.min(100, Math.round((character.hp / character.maxHp) * 100)));

  // Potions roll their own healing; other consumables are narrated by Duncan
  const handleUseItem = (item) => {
    if (item.type !== 'consumable' || (item.uses !== undefined && item.uses <= 0)) return;
    tavernAudio.playTankardClink();
    onUseItem(item);
  };
  const weight = inventoryWeight(character);
  const group = party.length > 1;
  const dismiss = () => {
    if (window.confirm(`¿Despedir a ${character.name}? Dejará el grupo y se llevará su equipo (pásale antes lo que quieras conservar).`)) onDismissMember(character.id);
  };

  return (
    <div className="h-full flex flex-col bg-[#120f18] border-r border-amber-950/60 overflow-hidden text-stone-200">
      
      {group && <PartyRoster party={party} activeId={character.id} onSelect={onSelectMember} busy={false} />}

      {/* Character Profile Header */}
      <div className="p-4 bg-gradient-to-b from-[#1c1626] to-[#120f18] border-b border-amber-950/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-13 h-13 rounded-xl bg-amber-950/80 border-2 border-amber-500/50 flex items-center justify-center text-3xl shadow-inner"
            >
              {character.avatar || '🛡️'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel font-bold text-stone-100 text-base leading-tight">
                  {character.name}
                </h3>
              </div>
              <p className="text-xs text-amber-400 font-medium">
                {character.race} • {character.class}
              </p>
              {(character.background || character.subclass) && (
                <p className="text-[11px] text-stone-400">
                  {[character.subclass, character.background].filter(Boolean).join(' · ')}
                </p>
              )}
              <ConditionBadges creature={character} nameOf={() => 'un enemigo'} className="mt-1" />
            </div>
          </div>
          {group && !inCombat && (
            <button onClick={dismiss} disabled={busy} title={`Despedir a ${character.name} del grupo`}
              className="p-1.5 rounded-lg text-stone-500 hover:text-red-300 hover:bg-red-950/40 disabled:opacity-40" aria-label={`Despedir a ${character.name}`}>
              <UserMinus className="w-4 h-4" />
            </button>
          )}

        </div>

        {/* Vital stats bars: HP, AC, Gold */}
        <div className="mt-4 space-y-2">
          {/* Health Bar */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="flex items-center gap-1 text-red-400 font-semibold">
                <Heart className="w-3.5 h-3.5 fill-red-500/40" />
                <span>Puntos de Golpe (HP)</span>
              </span>
              <span className="font-bold text-stone-200">
                {character.hp} / {character.maxHp}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-stone-900 overflow-hidden border border-stone-800">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  hpPercent > 50 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                  hpPercent > 20 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                  'bg-gradient-to-r from-red-600 to-red-500 animate-pulse'
                }`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Experience */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="flex items-center gap-1 text-sky-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Nivel {progress.level}</span>
              </span>
              <span className="text-stone-400">
                {progress.next == null ? `${progress.xp} PX · nivel máximo` : `${progress.xp} / ${progress.next} PX`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-stone-900 overflow-hidden border border-stone-800">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-500" style={{ width: `${progress.percent}%` }} />
            </div>
            {levelUpReady && (
              <button
                onClick={onLevelUp}
                disabled={busy}
                className="mt-2 w-full py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-stone-950 text-xs font-cinzel font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-900/40 animate-pulse disabled:opacity-50 disabled:animate-none"
              >
                <Sparkles className="w-3.5 h-3.5" /> ¡Subir a nivel {progress.level + 1}!
              </button>
            )}
            {!canAdvance(character) && progress.next != null && progress.xp >= progress.next && (
              <p className="mt-1 text-[10px] text-stone-500">Los héroes de partidas antiguas no pueden subir de nivel: crea uno nuevo para disfrutarlo.</p>
            )}
          </div>

          {/* AC and Gold pill row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-[#181320] border border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>Armadura</span>
              </div>
              <span className="font-cinzel font-bold text-stone-100 text-sm">
                CA {character.ac}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-[#181320] border border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{group ? 'Bolsa común' : 'Oro'}</span>
              </div>
              <span className="font-mono font-bold text-amber-300 text-sm" title={group ? 'El oro es de todo el grupo' : undefined}>
                {formatCoins(purse)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-amber-950/60 text-xs font-medium bg-[#16121e]">
        <button
          onClick={() => setActiveTab('sheet')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'sheet'
              ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-semibold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <span>Atributos</span>
        </button>
        {hasMagic && (
          <button
            onClick={() => setActiveTab('spells')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'spells'
                ? 'border-purple-400 text-purple-200 bg-purple-500/10 font-semibold'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Conjuros</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-semibold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Backpack className="w-3.5 h-3.5" />
          <span>Equipo</span>
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'menu'
              ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-semibold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>Taberna</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        
        {/* STATS SHEET TAB */}
        {activeTab === 'sheet' && (
          <div className="space-y-4">
            <AttacksPanel character={character} onAttack={onAttack} busy={busy} />

            <div>
              <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-2">
                Tiradas de Habilidad (Haz clic para tirar):
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'fue', name: 'Fuerza', stat: character.stats.fue },
                  { key: 'des', name: 'Destreza', stat: character.stats.des },
                  { key: 'con', name: 'Constitución', stat: character.stats.con },
                  { key: 'int', name: 'Inteligencia', stat: character.stats.int },
                  { key: 'sab', name: 'Sabiduría', stat: character.stats.sab },
                  { key: 'car', name: 'Carisma', stat: character.stats.car }
                ].map(({ key, name, stat }) => (
                  <button
                    key={key}
                    onClick={() => onRollCheck({ label: name, modifier: getModifierNumber(stat), ability: key })}
                    className="p-2.5 rounded-xl bg-[#17131f] hover:bg-amber-950/40 border border-stone-800 hover:border-amber-600/50 flex items-center justify-between text-left transition-all group"
                  >
                    <div>
                      <span className="text-xs text-stone-300 font-medium group-hover:text-amber-300">
                        {name}
                      </span>
                      <div className="text-[10px] text-stone-400 font-mono">
                        Puntuación: {stat}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-amber-400 font-mono font-bold text-xs group-hover:border-amber-500">
                      {getModifier(stat)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Skills: proficient ones add the proficiency bonus */}
            <div>
              <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block mb-2">
                Habilidades (competencia +{proficiencyBonus(character)}):
              </span>
              <div className="rounded-xl border border-stone-800 overflow-hidden">
                {skillRows(character).map((skill, index) => (
                  <button
                    key={skill.id}
                    onClick={() => onRollCheck({ label: skill.name, modifier: skill.modifier, ability: skill.ability, skillId: skill.id })}
                    title={`Tirar ${skill.name} (${skill.abilityShort})${skill.proficient ? ', con competencia' : ''}`}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-amber-950/40 transition-colors group ${
                      index % 2 ? 'bg-[#15111c]' : 'bg-[#17131f]'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 border ${
                        skill.proficient ? 'bg-amber-400 border-amber-300' : 'border-stone-600'
                      }`}
                      aria-hidden="true"
                    />
                    <span className={`flex-1 truncate group-hover:text-amber-300 ${skill.proficient ? 'text-stone-100 font-medium' : 'text-stone-400'}`}>
                      {skill.name}
                    </span>
                    <span className="text-[10px] font-mono text-stone-600">{skill.abilityShort}</span>
                    <span className={`w-7 text-right font-mono font-bold ${skill.proficient ? 'text-amber-400' : 'text-stone-400'}`}>
                      {formatModifier(skill.modifier)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rules details for characters made with the creation wizard */}
            {character.rulesVersion && (
              <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-800 space-y-1.5 text-[11px]">
                <span className="text-[10px] font-mono uppercase text-stone-400 tracking-wider block mb-1">Rasgos y Competencias:</span>
                {[
                  ['Velocidad', character.speed === 35 ? '10,5 m' : '9 m'],
                  ['Dotes', character.feats?.join(', ')],
                  ['Clase', character.classFeatures?.join(', ')],
                  ['Especie', character.traits?.join(', ')],
                  ['Herramientas', character.tools?.join(', ')],
                  ['Idiomas', character.languages?.join(', ')],
                  ['Alineamiento', character.alignment]
                ].filter(([, value]) => value).map(([label, value]) => (
                  <p key={label} className="text-stone-300 leading-snug">
                    <span className="text-stone-500">{label}:</span> {value}
                  </p>
                ))}
              </div>
            )}

            {/* Backstory snippet */}
            <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-800">
              <span className="text-[10px] font-mono uppercase text-stone-400 tracking-wider block mb-1">
                Biografía del Héroe:
              </span>
              <p className="text-xs text-stone-300 italic font-serif leading-relaxed">
                "{character.backstory}"
              </p>
            </div>
          </div>
        )}

        {/* SPELLS TAB */}
        {activeTab === 'spells' && hasMagic && (
          <SpellsTab character={character} onCastSpell={onCastSpell} onRest={onRest} busy={busy} partyNames={party.map(m => m.name)} restCost={longRestCost} partySize={party.length} />
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="space-y-2.5">
            <EquipmentPanel
              character={character}
              onChange={onUpdateCharacter}
              locked={inCombat ? 'En combate, cambia de arma desde la vista de combate: gasta tu acción.' : null}
            />

            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider">
                Inventario (lo que no llevas puesto ni en las manos va en la mochila):
              </span>
              <span className="text-[10px] font-mono text-stone-400 shrink-0" title={weight.unknown ? `${weight.unknown} objetos sin peso conocido no cuentan` : 'Peso del equipo según el SRD'}>
                ⚖️ {formatKg(weight.kg)}{weight.unknown ? '*' : ''}
              </span>
            </div>

            {character.inventory?.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#171320] border border-stone-800 flex items-start justify-between gap-2"
              >
                <div>
                  <h5 className="font-cinzel text-xs font-bold text-amber-200">
                    {item.name}
                  </h5>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {item.bonus || item.effect || item.desc}
                  </p>
                  {item.uses !== undefined && (
                    <span className="inline-block mt-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-900">
                      Usos restantes: {item.uses}
                    </span>
                  )}
                  {group && !inCombat && <GiveItem item={item} character={character} party={party} onTransfer={onTransferItem} />}
                </div>

                {heldIn(item.id) && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold shrink-0 border bg-red-950/50 border-red-700/60 text-red-200">
                    ✋ {HELD_LABELS[heldIn(item.id)]}
                  </span>
                )}

                {isWorn(character, item.id) && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold shrink-0 border bg-sky-950/50 border-sky-700/60 text-sky-200">
                    👕 Puesta
                  </span>
                )}

                {item.type === 'consumable' && (
                  <button
                    onClick={() => handleUseItem(item)}
                    disabled={busy || inCombat}
                    title={inCombat ? 'En combate, bebe las pociones desde la vista de combate (pestaña «Otras»): es una acción adicional' : healingDice(item) ? `Recupera ${healingDice(item)} PG` : 'Usar'}
                    className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 text-xs font-bold shrink-0 transition-colors shadow-sm"
                  >
                    {healingDice(item) ? 'Beber' : 'Usar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAVERN BAR / MENU TAB */}
        {activeTab === 'menu' && (
          <div className="space-y-2.5">
            <RestButtons character={character} onRest={onRest} busy={busy} cost={longRestCost} partySize={party.length} />

            <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider block">
              Bebidas & Viandas de Maese Duncan:
            </span>

            {TAVERN_MENU.map((drink) => (
              <div
                key={drink.id}
                className="p-3 rounded-xl bg-[#171320] border border-amber-950/50 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{drink.icon}</span>
                  <div>
                    <h5 className="font-cinzel text-xs font-bold text-stone-200">
                      {drink.name}
                    </h5>
                    <p className="text-[10px] text-stone-400 leading-tight">
                      {drink.effect}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onOrderDrink(drink)}
                  disabled={character.gold < drink.cost}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 text-xs font-bold shrink-0 transition-all font-mono"
                >
                  {drink.cost} po
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
