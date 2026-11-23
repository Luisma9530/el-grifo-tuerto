import React, { useMemo, useState } from 'react';
import { Check, Dice5, Heart, Sparkles, Star, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  levelUpPlan, emptyLevelUpChoices, learnableSpells, hpGain, asiBonuses, levelUpIssues, applyLevelUp,
  featureInfo, EPIC_MAX_ABILITY_SCORE
} from '../../utils/leveling';
import { EPIC_BOONS } from '../../data/progression';
import { getSpell, spellSummary } from '../../utils/spellcasting';
import { abilityModifier, formatModifier } from '../../utils/characterBuilder';
import { ABILITIES, MAX_ABILITY_SCORE } from '../../data/srd';
import { animateRoll } from '../../dice3d/controller';
import { rollDie } from '../../utils/dice';

function Section({ title, children }) {
  return (
    <section className="rounded-xl bg-[#16121d] border border-amber-900/30 p-4">
      <h3 className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Choice({ selected, disabled, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      title={title}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        selected
          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
          : disabled
            ? 'bg-stone-900/40 border-stone-800 text-stone-600 cursor-not-allowed'
            : 'bg-[#1b1624] border-stone-700 text-stone-300 hover:border-amber-600/60 hover:text-amber-200'
      }`}
    >
      {children}
    </button>
  );
}

function SpellPick({ spell, selected, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        selected ? 'bg-purple-500/15 border-purple-400/70' : 'bg-[#1b1624] border-stone-800 hover:border-purple-700/60'
      }`}
    >
      <span className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
        selected ? 'bg-purple-500 border-purple-300 text-white' : 'border-stone-600'
      }`}>
        {selected && <Check className="w-3 h-3" />}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className={`text-sm font-medium ${selected ? 'text-purple-100' : 'text-stone-200'}`}>{spell.name}</span>
          <span className="text-[10px] font-mono text-stone-500">
            {spell.level === 0 ? 'Truco' : `Nivel ${spell.level}`} · {spellSummary(spell)}
          </span>
        </span>
        <span className="block text-[11px] text-stone-400 leading-snug">{spell.desc}</span>
      </span>
    </button>
  );
}

/**
 * Level-up dialog: hit points (average or a 3D die roll), new features, the
 * ability score improvement and new spells. Calls onConfirm(newCharacter, summary).
 * Online, a player sends the choices instead (onSubmitChoices(choices)) and the
 * host applies them; with `hostRolls` the hit die is rolled by the host.
 */
export default function LevelUpModal({ character, onConfirm, onClose, onSubmitChoices = null, hostRolls = false }) {
  const plan = useMemo(() => levelUpPlan(character), [character]);
  const [choices, setChoices] = useState(() => emptyLevelUpChoices(character));
  const [rolling, setRolling] = useState(false);
  // Spell level shown in the "new spells" list (high levels have many options)
  const [spellLevelFilter, setSpellLevelFilter] = useState(() => plan.spells?.maxSpellLevel || 1);
  useEscapeKey(true, () => !rolling && onClose());

  // The host rolls the die later: check the rest of the choices as if it were the average
  const hostRoll = hostRolls && choices.hp.method === 'roll';
  const checked = hostRoll ? { ...choices, hp: { method: 'average', roll: null } } : choices;
  const issues = levelUpIssues(character, plan, checked);
  const gain = hpGain(plan, checked);
  const bonuses = plan.asi ? asiBonuses(choices) : {};

  const set = patch => setChoices(current => ({ ...current, ...patch }));
  const setSpells = patch => setChoices(current => ({ ...current, spells: { ...current.spells, ...patch } }));

  const rollHitDie = async () => {
    if (hostRolls) {
      set({ hp: { method: 'roll', roll: null } });
      return;
    }
    setRolling(true);
    const value = rollDie(plan.hitDie, { silent: true });
    await animateRoll({ sides: plan.hitDie, value, label: 'Puntos de golpe' });
    set({ hp: { method: 'roll', roll: value } });
    setRolling(false);
  };

  const toggleAsi = id => {
    const { mode, abilities } = choices.asi;
    if (mode === 'two') {
      set({ asi: { mode, abilities: abilities[0] === id ? [] : [id] } });
    } else if (abilities.includes(id)) {
      set({ asi: { mode, abilities: abilities.filter(a => a !== id) } });
    } else if (abilities.length < 2) {
      set({ asi: { mode, abilities: [...abilities, id] } });
    }
  };

  const toggleSpell = (field, id, max) => {
    const current = choices.spells[field];
    if (current.includes(id)) {
      setSpells({ [field]: current.filter(s => s !== id), prepared: choices.spells.prepared.filter(s => s !== id) });
    } else if (current.length < max) {
      const patch = { [field]: [...current, id] };
      // Wizards: a newly learned spell starts prepared while there is room
      if (field === 'spells' && plan.spells.prepared != null && choices.spells.prepared.length < plan.spells.prepared) {
        patch.prepared = [...choices.spells.prepared, id];
      }
      setSpells(patch);
    }
  };

  const togglePrepared = id => {
    const { prepared } = choices.spells;
    if (prepared.includes(id)) setSpells({ prepared: prepared.filter(s => s !== id) });
    else if (prepared.length < plan.spells.prepared) setSpells({ prepared: [...prepared, id] });
  };

  // Wizard spellbook (old class spells + new ones), for choosing what is prepared
  const spellbook = plan.spells?.prepared != null
    ? [
        ...character.spellcasting.known
          .filter(k => (k.sourceKey ? k.sourceKey === 'class' : k.source === plan.className) && getSpell(k.id)?.level > 0)
          .map(k => k.id),
        ...choices.spells.spells
      ].map(getSpell)
    : [];

  const confirm = () => {
    if (issues.length > 0) return;
    if (onSubmitChoices) {
      onSubmitChoices(choices);
      return;
    }
    const { character: next, summary } = applyLevelUp(character, choices);
    onConfirm(next, summary);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#131018] border-2 border-amber-500/50 shadow-2xl shadow-amber-900/30"
        role="dialog"
        aria-modal="true"
        aria-labelledby="levelup-title"
      >
        <header className="p-5 border-b border-amber-950/60 flex items-start justify-between gap-3 bg-gradient-to-r from-amber-950/50 to-transparent">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400/90">¡Has ganado experiencia suficiente!</p>
            <h2 id="levelup-title" className="font-cinzel text-xl sm:text-2xl font-bold text-amber-100">
              {character.name} sube a nivel {plan.level}
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">{plan.className} de nivel {plan.level}</p>
          </div>
          <button onClick={onClose} disabled={rolling} className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800" aria-label="Decidir más tarde">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Hit points */}
          <Section title="Puntos de golpe">
            <div className="flex flex-wrap items-center gap-2">
              <Choice selected={choices.hp.method === 'average'} onClick={() => set({ hp: { method: 'average', roll: null } })}>
                Media fija: {plan.hpAverage}
              </Choice>
              <Choice selected={choices.hp.method === 'roll'} disabled={rolling || Boolean(choices.hp.roll)} onClick={rollHitDie}
                title={choices.hp.roll ? 'Ya has tirado: el resultado se queda' : hostRolls ? `El anfitrión tira 1d${plan.hitDie} al confirmar` : `Tira 1d${plan.hitDie}`}>
                <span className="inline-flex items-center gap-1.5">
                  <Dice5 className="w-3.5 h-3.5" />
                  {choices.hp.roll ? `Tirada: ${choices.hp.roll}` : `Tirar 1d${plan.hitDie}`}
                </span>
              </Choice>
            </div>
            {hostRoll ? (
              <p className="text-sm text-stone-200 mt-3 flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400" />
                <span>El anfitrión tirará 1d{plan.hitDie} al confirmar (el resultado aparecerá en la crónica).</span>
              </p>
            ) : (
            <p className="text-sm text-stone-200 mt-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-400" />
              <span>
                +<strong className="text-emerald-300">{gain}</strong> puntos de golpe máximos
                <span className="text-xs text-stone-500">
                  {' '}({choices.hp.method === 'roll' && choices.hp.roll ? choices.hp.roll : plan.hpAverage}
                  {' '}{formatModifier(plan.conMod)} Constitución{plan.extraHpPerLevel ? ` +${plan.extraHpPerLevel} enano` : ''})
                </span>
              </span>
            </p>
            )}
            {choices.hp.method === 'average' && (
              <p className="text-[11px] text-stone-500 mt-1">Si tiras el dado, el resultado es definitivo.</p>
            )}
          </Section>

          {/* Features */}
          <Section title="Nuevos rasgos">
            {plan.subclass && (
              <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-600/40">
                <p className="text-sm font-cinzel font-bold text-amber-200 flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> Subclase: {plan.subclass.name}
                </p>
                <p className="text-xs text-stone-300 mt-0.5">{plan.subclass.desc}</p>
              </div>
            )}
            <ul className="space-y-1.5">
              {plan.features.filter(f => f !== plan.subclass?.name).map(feature => (
                <li key={feature} className="text-xs">
                  <span className="font-semibold text-stone-100">{feature}</span>
                  {featureInfo(feature) && <span className="text-stone-400"> — {featureInfo(feature)}</span>}
                </li>
              ))}
              {plan.proficiencyAfter > plan.proficiencyBefore && (
                <li className="text-xs text-emerald-300">Bonificador de competencia +{plan.proficiencyAfter}</li>
              )}
            </ul>
          </Section>

          {/* Ability Score Improvement */}
          {plan.asi && (
            <Section title="Mejora de característica">
              <div className="flex flex-wrap gap-2 mb-3">
                <Choice selected={choices.asi.mode === 'two'} onClick={() => set({ asi: { mode: 'two', abilities: [] } })}>+2 a una</Choice>
                <Choice selected={choices.asi.mode === 'split'} onClick={() => set({ asi: { mode: 'split', abilities: [] } })}>+1 a dos</Choice>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ABILITIES.map(ability => {
                  const score = character.stats[ability.id];
                  const step = choices.asi.mode === 'two' ? 2 : 1;
                  const selected = choices.asi.abilities.includes(ability.id);
                  const full = choices.asi.mode === 'split' && choices.asi.abilities.length >= 2 && !selected;
                  const after = score + (bonuses[ability.id] || 0);
                  return (
                    <button
                      key={ability.id}
                      type="button"
                      onClick={() => toggleAsi(ability.id)}
                      disabled={(!selected && score + step > MAX_ABILITY_SCORE) || full}
                      aria-pressed={selected}
                      className={`p-2.5 rounded-lg border text-left transition-colors disabled:opacity-40 ${
                        selected ? 'bg-amber-500/15 border-amber-400' : 'bg-[#1b1624] border-stone-800 hover:border-amber-700/60'
                      }`}
                    >
                      <span className="block text-xs text-stone-300">{ability.name}</span>
                      <span className="font-cinzel font-bold text-amber-300">{score}{after !== score && <span className="text-emerald-300"> → {after}</span>}</span>
                      <span className="ml-1.5 text-[11px] font-mono text-stone-500">{formatModifier(abilityModifier(after))}</span>
                    </button>
                  );
                })}
              </div>
              {bonuses.con && (
                <p className="text-[11px] text-stone-400 mt-2">Si tu modificador de Constitución sube, ganas además 1 punto de golpe por cada nivel.</p>
              )}
            </Section>
          )}

          {/* Epic Boon (level 19) */}
          {plan.epicBoon && (
            <Section title="Don Épico">
              <p className="text-xs text-stone-400 mb-3">
                Una dote legendaria. Además, mejora una característica en +1 (hasta {EPIC_MAX_ABILITY_SCORE}).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                {EPIC_BOONS.map(boon => {
                  const selected = choices.boon?.id === boon.id;
                  return (
                    <button
                      key={boon.id}
                      type="button"
                      onClick={() => set({ boon: { ...choices.boon, id: boon.id } })}
                      aria-pressed={selected}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                        selected ? 'bg-amber-500/15 border-amber-400' : 'bg-[#1b1624] border-stone-800 hover:border-amber-700/60'
                      }`}
                    >
                      <span className={`block text-sm font-medium ${selected ? 'text-amber-200' : 'text-stone-200'}`}>{boon.name}</span>
                      <span className="block text-[11px] text-stone-400 leading-snug">{boon.desc}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {ABILITIES.map(ability => (
                  <Choice
                    key={ability.id}
                    selected={choices.boon?.ability === ability.id}
                    disabled={character.stats[ability.id] + 1 > EPIC_MAX_ABILITY_SCORE}
                    onClick={() => set({ boon: { ...choices.boon, ability: ability.id } })}
                  >
                    {ability.name} {character.stats[ability.id]} → {character.stats[ability.id] + 1}
                  </Choice>
                ))}
              </div>
            </Section>
          )}

          {/* Spells */}
          {plan.spells && (plan.spells.cantrips > 0 || plan.spells.spells > 0 || plan.spells.prepared != null || plan.spells.arcanumLevel) && (
            <Section title="Magia">
              <div className="flex flex-wrap gap-2 mb-3 text-[11px] font-mono">
                {plan.spells.slotsAfter.map(row => {
                  const before = plan.spells.slotsBefore.find(r => r.level === row.level)?.max || 0;
                  return (
                    <span key={row.level} className={`px-2 py-1 rounded border ${row.max > before ? 'bg-purple-950/40 border-purple-700/60 text-purple-200' : 'bg-stone-900 border-stone-800 text-stone-400'}`}>
                      Nivel {row.level}: {row.max} {row.max === 1 ? 'espacio' : 'espacios'}{row.max > before ? ` (+${row.max - before})` : ''}
                    </span>
                  );
                })}
              </div>

              {plan.spells.cantrips > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs text-stone-300 mb-2">
                    Trucos nuevos — elige {plan.spells.cantrips} ({choices.spells.cantrips.length}/{plan.spells.cantrips})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {learnableSpells(character, plan, 0).map(spell => {
                      const selected = choices.spells.cantrips.includes(spell.id);
                      return (
                        <SpellPick key={spell.id} spell={spell} selected={selected}
                          disabled={!selected && choices.spells.cantrips.length >= plan.spells.cantrips}
                          onToggle={() => toggleSpell('cantrips', spell.id, plan.spells.cantrips)} />
                      );
                    })}
                  </div>
                </div>
              )}

              {plan.spells.spells > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs text-stone-300 mb-2">
                    {plan.spells.prepared != null ? 'Conjuros nuevos para tu libro' : 'Conjuros nuevos'} — elige {plan.spells.spells}{' '}
                    ({choices.spells.spells.length}/{plan.spells.spells}) · hasta nivel {plan.spells.maxSpellLevel}
                  </h4>
                  {plan.spells.maxSpellLevel > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      <span className="text-[11px] text-stone-500 mr-1">Nivel:</span>
                      {Array.from({ length: plan.spells.maxSpellLevel }, (_, i) => i + 1).map(level => {
                        const picked = choices.spells.spells.filter(id => getSpell(id)?.level === level).length;
                        return (
                          <Choice key={level} selected={spellLevelFilter === level} onClick={() => setSpellLevelFilter(level)}>
                            {level}{picked > 0 ? ` · ${picked}✓` : ''}
                          </Choice>
                        );
                      })}
                    </div>
                  )}
                  {[spellLevelFilter].map(level => {
                    const options = learnableSpells(character, plan, level);
                    if (options.length === 0) return <p key={level} className="text-xs text-stone-500">Ya conoces todos los conjuros de este nivel.</p>;
                    return (
                      <div key={level} className="mb-3">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-purple-300/80 mb-1.5">Nivel {level}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {options.map(spell => {
                            const selected = choices.spells.spells.includes(spell.id);
                            return (
                              <SpellPick key={spell.id} spell={spell} selected={selected}
                                disabled={!selected && choices.spells.spells.length >= plan.spells.spells}
                                onToggle={() => toggleSpell('spells', spell.id, plan.spells.spells)} />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {plan.spells.arcanumLevel && (
                <div className="mb-4">
                  <h4 className="text-xs text-stone-300 mb-1">Arcano Místico — elige un conjuro de nivel {plan.spells.arcanumLevel}</h4>
                  <p className="text-[11px] text-stone-500 mb-2">Tu patrón te lo concede: lo lanzas una vez por descanso largo sin gastar espacio.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {learnableSpells(character, plan, plan.spells.arcanumLevel).map(spell => (
                      <SpellPick key={spell.id} spell={spell} selected={choices.spells.arcanum === spell.id}
                        onToggle={() => setSpells({ arcanum: choices.spells.arcanum === spell.id ? null : spell.id })} />
                    ))}
                  </div>
                </div>
              )}

              {plan.spells.prepared != null && (
                <div>
                  <h4 className="text-xs text-stone-300 mb-2">
                    Conjuros preparados — {choices.spells.prepared.length}/{plan.spells.prepared}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {spellbook.map(spell => {
                      const selected = choices.spells.prepared.includes(spell.id);
                      return (
                        <Choice key={spell.id} selected={selected}
                          disabled={!selected && choices.spells.prepared.length >= plan.spells.prepared}
                          onClick={() => togglePrepared(spell.id)}>
                          {selected ? '★ ' : ''}{spell.name} <span className="text-stone-500">· {spell.level}</span>
                        </Choice>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>

        <footer className="p-4 border-t border-amber-950/60 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-300 min-w-0" role="status" aria-live="polite">{issues[0] || ''}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onClose} disabled={rolling} className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-sm text-stone-300">
              Más tarde
            </button>
            <button
              onClick={confirm}
              disabled={issues.length > 0 || rolling}
              className="px-5 py-2.5 rounded-xl text-sm font-cinzel font-bold flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-stone-950 shadow-lg shadow-amber-900/40 disabled:from-stone-800 disabled:to-stone-800 disabled:text-stone-500 disabled:shadow-none"
            >
              <Sparkles className="w-4 h-4" /> Subir a nivel {plan.level}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
