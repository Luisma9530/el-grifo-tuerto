import React from 'react';
import { Dice5, Minus, Plus, Shuffle, Wand2 } from 'lucide-react';
import {
  ABILITIES, SKILLS, CLASSES, BACKGROUNDS, SPECIES, FEATS, LANGUAGES, ALIGNMENTS, AVATARS,
  STANDARD_ARRAY, POINT_BUY_BUDGET, POINT_BUY_COST, LANGUAGE_CHOICES, LEVEL_1_PROFICIENCY_BONUS
} from '../../data/srd';
import {
  getClass, getBackground, getSpecies, getFeat, getSkill, getAbility, abilityModifier, formatModifier,
  finalScores, backgroundBonuses, pointBuySpent, rollAbilityScore, unassignedPoolValues, scorePool,
  backgroundSkills, speciesSkillOptions, classSkillOptions, isExtraFeatAllowed, randomName
} from '../../utils/characterBuilder';
import { tavernAudio } from '../../utils/audio';
import { spellRows, slotsLeft } from '../../utils/spellcasting';

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function OptionCard({ selected, onClick, icon, title, subtitle, badge, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`text-left rounded-xl p-3.5 border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        selected
          ? 'bg-amber-500/15 border-amber-400 shadow-lg shadow-amber-900/30'
          : 'bg-[#16121d] border-stone-800 hover:border-amber-700/60 hover:bg-[#1b1624]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-cinzel font-bold text-sm ${selected ? 'text-amber-200' : 'text-stone-100'}`}>{title}</span>
            {badge}
          </div>
          {subtitle && <p className="text-[11px] text-stone-400 leading-snug mt-0.5">{subtitle}</p>}
          {children}
        </div>
      </div>
    </button>
  );
}

function Chip({ selected, disabled, onClick, children, title }) {
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
            : 'bg-[#16121d] border-stone-700 text-stone-300 hover:border-amber-600/60 hover:text-amber-200'
      }`}
    >
      {children}
    </button>
  );
}

export function Panel({ title, children, className = '' }) {
  return (
    <div className={`rounded-xl bg-[#14101a] border border-amber-900/30 p-4 ${className}`}>
      {title && <h4 className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mb-2">{title}</h4>}
      {children}
    </div>
  );
}

export function StepIntro({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-stone-100">{title}</h3>
      <p className="text-sm text-stone-400 mt-1 max-w-2xl">{children}</p>
    </div>
  );
}

const abilityNames = ids => ids.map(id => getAbility(id).name).join(', ');
const skillNames = ids => ids.map(id => getSkill(id).name).join(', ');

// ---------------------------------------------------------------------------
// 1. Class
// ---------------------------------------------------------------------------

export function StepClass({ draft, update }) {
  const selected = getClass(draft.classId);
  return (
    <div>
      <StepIntro title="Elige tu clase">
        Tu clase es tu vocación: define cómo luchas, qué sabes hacer y cuánto aguantas. Es la decisión más importante.
      </StepIntro>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {CLASSES.map(cls => (
          <OptionCard
            key={cls.id}
            selected={draft.classId === cls.id}
            onClick={() => update({ classId: cls.id })}
            icon={cls.icon}
            title={cls.name}
            subtitle={cls.tagline}
            badge={<span className="text-[10px] font-mono text-stone-500 shrink-0">d{cls.hitDie}</span>}
          />
        ))}
      </div>

      {selected && (
        <Panel className="mt-4">
          <p className="text-sm text-stone-200">{selected.desc}</p>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div><dt className="text-stone-500">Dado de golpe</dt><dd className="text-stone-200">d{selected.hitDie} por nivel</dd></div>
            <div><dt className="text-stone-500">Característica principal</dt><dd className="text-amber-300">{abilityNames(selected.primary)}</dd></div>
            <div><dt className="text-stone-500">Tiradas de salvación</dt><dd className="text-stone-200">{abilityNames(selected.savingThrows)}</dd></div>
            <div>
              <dt className="text-stone-500">Habilidades</dt>
              <dd className="text-stone-200">
                Eliges {selected.skillChoices.count}{selected.skillChoices.from === 'any' ? ' cualesquiera' : ''}
              </dd>
            </div>
            <div className="sm:col-span-2"><dt className="text-stone-500">Rasgos de nivel 1</dt><dd className="text-stone-200">{selected.features.join(' · ')}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Equipo inicial</dt>
              <dd className="text-stone-200">{selected.equipment.map(i => i.name).join(', ')} y {selected.gold} po</dd>
            </div>
          </dl>
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Background
// ---------------------------------------------------------------------------

export function StepBackground({ draft, update }) {
  const selected = getBackground(draft.backgroundId);
  const feat = selected && getFeat(selected.feat);
  return (
    <div>
      <StepIntro title="Elige tu trasfondo">
        Tu origen: qué eras antes de lanzarte a la aventura. Mejora tres características y te da una dote, dos habilidades,
        una herramienta y equipo.
      </StepIntro>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {BACKGROUNDS.map(bg => (
          <OptionCard
            key={bg.id}
            selected={draft.backgroundId === bg.id}
            onClick={() => update({ backgroundId: bg.id })}
            icon={bg.icon}
            title={bg.name}
            subtitle={bg.desc}
            badge={bg.source === 'original' && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/50 text-purple-300 shrink-0" title="Trasfondo propio de El Grifo Tuerto, creado con las reglas de trasfondos">
                DEL GRIFO
              </span>
            )}
          />
        ))}
      </div>

      {selected && (
        <Panel className="mt-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div><dt className="text-stone-500">Mejora de características</dt><dd className="text-amber-300">{abilityNames(selected.abilities)}</dd></div>
            <div><dt className="text-stone-500">Habilidades</dt><dd className="text-stone-200">{skillNames(selected.skills)}</dd></div>
            <div><dt className="text-stone-500">Herramienta</dt><dd className="text-stone-200">{selected.tool}</dd></div>
            <div><dt className="text-stone-500">Dote de origen</dt><dd className="text-stone-200">{feat.name}</dd></div>
            <div className="sm:col-span-2 text-stone-400 italic">{feat.desc}</div>
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Equipo</dt>
              <dd className="text-stone-200">{selected.equipment.map(i => i.name).join(', ')} y {selected.gold} po</dd>
            </div>
          </dl>
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Species
// ---------------------------------------------------------------------------

export function StepSpecies({ draft, update }) {
  const selected = getSpecies(draft.speciesId);
  return (
    <div>
      <StepIntro title="Elige tu especie">
        De qué pueblo vienes. Tu especie te da rasgos únicos; en las reglas actuales ya no modifica tus características.
      </StepIntro>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {SPECIES.map(sp => (
          <OptionCard
            key={sp.id}
            selected={draft.speciesId === sp.id}
            onClick={() => update({ speciesId: sp.id })}
            icon={sp.icon}
            title={sp.name}
            subtitle={sp.desc}
          />
        ))}
      </div>

      {selected && (
        <Panel className="mt-4">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-300 mb-3">
            <span><span className="text-stone-500">Tamaño:</span> {selected.size}</span>
            <span><span className="text-stone-500">Velocidad:</span> {selected.speed === 35 ? '10,5 m' : '9 m'}</span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {selected.traits.map(trait => (
              <li key={trait.name}>
                <span className="text-amber-300 font-semibold">{trait.name}.</span>{' '}
                <span className="text-stone-300">{trait.desc}</span>
              </li>
            ))}
          </ul>

          {selected.options && (
            <div className="mt-4 pt-3 border-t border-stone-800">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mb-2">{selected.options.label}</h4>
              <div className="flex flex-wrap gap-2">
                {selected.options.choices.map(choice => (
                  <Chip
                    key={choice.id}
                    selected={draft.speciesOption === choice.id}
                    onClick={() => update({ speciesOption: choice.id })}
                    title={choice.desc}
                  >
                    {choice.name}
                  </Chip>
                ))}
              </div>
              {draft.speciesOption && (
                <p className="text-xs text-stone-400 italic mt-2">
                  {selected.options.choices.find(c => c.id === draft.speciesOption)?.desc}
                </p>
              )}
            </div>
          )}

          {selected.extraFeat && (
            <div className="mt-4 pt-3 border-t border-stone-800">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mb-2">Dote de origen (Versátil)</h4>
              <div className="flex flex-wrap gap-2">
                {FEATS.map(feat => {
                  const allowed = isExtraFeatAllowed(draft, feat.id);
                  return (
                    <Chip
                      key={feat.id}
                      selected={draft.extraFeatId === feat.id}
                      disabled={!allowed}
                      onClick={() => update({ extraFeatId: feat.id })}
                      title={allowed ? feat.desc : 'Ya la tienes por tu trasfondo'}
                    >
                      {feat.name}
                    </Chip>
                  );
                })}
              </div>
              {getFeat(draft.extraFeatId) && (
                <p className="text-xs text-stone-400 italic mt-2">{getFeat(draft.extraFeatId).desc}</p>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Ability scores
// ---------------------------------------------------------------------------

const METHODS = [
  { id: 'standard', name: 'Conjunto estándar', desc: `Reparte ${STANDARD_ARRAY.join(', ')}.` },
  { id: 'pointbuy', name: 'Compra de puntos', desc: `${POINT_BUY_BUDGET} puntos para subir desde 8.` },
  { id: 'roll', name: 'Tirar dados', desc: '4d6 y descartas el más bajo, seis veces.' }
];

const BLANK_SCORES = { fue: null, des: null, con: null, int: null, sab: null, car: null };
const ALL_EIGHTS = { fue: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 };

export function StepAbilities({ draft, update }) {
  const cls = getClass(draft.classId);
  const background = getBackground(draft.backgroundId);
  const bonuses = backgroundBonuses(draft);
  const totals = finalScores(draft);
  const pool = scorePool(draft);
  const free = unassignedPoolValues(draft);
  const spent = pointBuySpent(draft.baseScores);

  const changeMethod = method => {
    if (method === draft.method) return;
    if (method === 'pointbuy') update({ method, baseScores: { ...ALL_EIGHTS } });
    else if (method === 'standard') update({ method, baseScores: cls ? { ...cls.suggestedArray } : { ...BLANK_SCORES } });
    else update({ method, baseScores: { ...BLANK_SCORES }, rolledPool: null });
  };

  const rollPool = () => {
    tavernAudio.playDiceRoll();
    const d6 = () => Math.floor(Math.random() * 6) + 1;
    const rolled = Array.from({ length: 6 }, () => rollAbilityScore(d6).total).sort((a, b) => b - a);
    update({ rolledPool: rolled, baseScores: { ...BLANK_SCORES } });
  };

  // Assign a pool value; if another ability holds the last copy of it, the two swap
  const assign = (abilityId, raw) => {
    const value = raw === '' ? null : Number(raw);
    const scores = { ...draft.baseScores };
    const previous = scores[abilityId];
    if (value != null && !free.includes(value)) {
      const holder = ABILITIES.map(a => a.id).find(id => id !== abilityId && scores[id] === value);
      if (holder) scores[holder] = previous;
    }
    scores[abilityId] = value;
    update({ baseScores: scores });
  };

  const stepPointBuy = (abilityId, delta) => {
    const next = draft.baseScores[abilityId] + delta;
    if (!(next in POINT_BUY_COST)) return;
    const scores = { ...draft.baseScores, [abilityId]: next };
    if (pointBuySpent(scores) > POINT_BUY_BUDGET) return;
    update({ baseScores: scores });
  };

  const setBonus = patch => update({ bonus: { ...draft.bonus, ...patch } });

  return (
    <div>
      <StepIntro title="Características">
        Seis números que definen a tu héroe. Elige cómo generarlos, repártelos y aplica las mejoras de tu trasfondo.
        {cls && <> Para un {cls.name.toLowerCase()} lo más importante es <span className="text-amber-300">{abilityNames(cls.primary)}</span>.</>}
      </StepIntro>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
        {METHODS.map(method => (
          <OptionCard
            key={method.id}
            selected={draft.method === method.id}
            onClick={() => changeMethod(method.id)}
            icon={method.id === 'roll' ? '🎲' : method.id === 'pointbuy' ? '🧮' : '📋'}
            title={method.name}
            subtitle={method.desc}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 min-h-[34px]">
        {draft.method === 'standard' && cls && (
          <button
            type="button"
            onClick={() => update({ baseScores: { ...cls.suggestedArray } })}
            className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs text-stone-200 flex items-center gap-1.5"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" /> Reparto recomendado para {cls.name}
          </button>
        )}
        {draft.method === 'roll' && (
          <>
            <button
              type="button"
              onClick={rollPool}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Dice5 className="w-3.5 h-3.5" /> {pool ? 'Volver a tirar' : 'Tirar los dados'}
            </button>
            {pool && <span className="text-xs text-stone-400 font-mono">Resultados: {pool.join(' · ')}</span>}
          </>
        )}
        {draft.method === 'pointbuy' && (
          <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border ${
            spent === POINT_BUY_BUDGET ? 'text-emerald-300 border-emerald-800/60 bg-emerald-950/30' : 'text-amber-300 border-amber-800/50 bg-amber-950/30'
          }`}>
            Puntos restantes: {POINT_BUY_BUDGET - spent} / {POINT_BUY_BUDGET}
          </span>
        )}
        {pool && free.length > 0 && draft.method !== 'pointbuy' && (
          <span className="text-xs text-stone-400">Por asignar: <span className="font-mono text-amber-300">{free.join(', ')}</span></span>
        )}
      </div>

      <div className="rounded-xl border border-amber-900/30 overflow-hidden">
        {ABILITIES.map((ability, index) => {
          const base = draft.baseScores[ability.id];
          const bonus = bonuses[ability.id] || 0;
          const isPrimary = cls?.primary.includes(ability.id);
          // Options for this row: free values plus its own, without repeating equal numbers
          const options = pool ? [...new Set([...(base != null ? [base] : []), ...free, ...pool])].sort((a, b) => b - a) : [];
          return (
            <div
              key={ability.id}
              className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 ${index % 2 ? 'bg-[#14101a]' : 'bg-[#17131e]'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-cinzel font-bold text-sm text-stone-100">{ability.name}</span>
                  {isPrimary && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-600/40 text-amber-300">CLAVE</span>}
                </div>
                <p className="text-[11px] text-stone-500 hidden sm:block">{ability.desc}</p>
              </div>

              {draft.method === 'pointbuy' ? (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => stepPointBuy(ability.id, -1)} disabled={base <= 8} aria-label={`Bajar ${ability.name}`}
                    className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 disabled:opacity-30 flex items-center justify-center hover:border-amber-600/60">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono font-bold text-stone-100">{base}</span>
                  <button type="button" onClick={() => stepPointBuy(ability.id, 1)}
                    disabled={base >= 15 || pointBuySpent({ ...draft.baseScores, [ability.id]: base + 1 }) > POINT_BUY_BUDGET}
                    aria-label={`Subir ${ability.name}`}
                    className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 disabled:opacity-30 flex items-center justify-center hover:border-amber-600/60">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <select
                  value={base ?? ''}
                  onChange={e => assign(ability.id, e.target.value)}
                  disabled={!pool}
                  aria-label={`Puntuación de ${ability.name}`}
                  className="bg-[#1c1724] border border-stone-700 rounded-lg px-2 py-1.5 text-sm font-mono text-stone-100 focus:outline-none focus:border-amber-500 disabled:opacity-40"
                >
                  <option value="">—</option>
                  {options.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              )}

              <span className={`w-9 text-center text-xs font-mono ${bonus ? 'text-emerald-400' : 'text-stone-700'}`}>
                {bonus ? `+${bonus}` : '·'}
              </span>
              <div className="w-16 text-right">
                <span className="font-cinzel font-bold text-lg text-amber-300">{base == null ? '—' : totals[ability.id]}</span>
                <span className="ml-1.5 text-xs font-mono text-stone-400">
                  {base == null ? '' : formatModifier(abilityModifier(totals[ability.id]))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Panel title="Mejoras de tu trasfondo" className="mt-4">
        {!background ? (
          <p className="text-xs text-stone-400">Elige primero un trasfondo: es lo que mejora tus características.</p>
        ) : (
          <>
            <p className="text-xs text-stone-400 mb-3">
              <span className="text-stone-200">{background.name}</span> mejora {abilityNames(background.abilities)}.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Chip selected={draft.bonus.mode === 'twoOne'} onClick={() => setBonus({ mode: 'twoOne' })}>+2 a una y +1 a otra</Chip>
              <Chip selected={draft.bonus.mode === 'allOne'} onClick={() => setBonus({ mode: 'allOne' })}>+1 a las tres</Chip>
            </div>
            {draft.bonus.mode === 'twoOne' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[['plus2', '+2'], ['plus1', '+1']].map(([key, label]) => (
                  <div key={key}>
                    <span className="text-[11px] text-stone-500 block mb-1.5">{label} a…</span>
                    <div className="flex flex-wrap gap-2">
                      {background.abilities.map(id => {
                        const other = key === 'plus2' ? draft.bonus.plus1 : draft.bonus.plus2;
                        return (
                          <Chip
                            key={id}
                            selected={draft.bonus[key] === id}
                            onClick={() => setBonus(other === id
                              ? { [key]: id, [key === 'plus2' ? 'plus1' : 'plus2']: draft.bonus[key] }
                              : { [key]: id })}
                          >
                            {getAbility(id).name}
                          </Chip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Skills
// ---------------------------------------------------------------------------

export function StepSkills({ draft, update }) {
  const cls = getClass(draft.classId);
  const species = getSpecies(draft.speciesId);
  const background = getBackground(draft.backgroundId);
  const fromBackground = backgroundSkills(draft);
  const speciesChoice = speciesSkillOptions(draft);
  const classChoice = classSkillOptions(draft);
  const totals = finalScores(draft);

  const toggle = (key, id, max) => {
    const current = draft[key];
    if (current.includes(id)) update({ [key]: current.filter(s => s !== id) });
    else if (max === 1) update({ [key]: [id] });
    else if (current.length < max) update({ [key]: [...current, id] });
  };

  const label = id => {
    const skill = getSkill(id);
    const mod = abilityModifier(totals[skill.ability]) + LEVEL_1_PROFICIENCY_BONUS;
    return `${skill.name} (${getAbility(skill.ability).short} ${formatModifier(mod)})`;
  };

  return (
    <div>
      <StepIntro title="Competencias">
        Las habilidades en las que destaca tu héroe. En ellas sumarás tu bonificador de competencia (+{LEVEL_1_PROFICIENCY_BONUS}) a la
        tirada. El número indica el modificador que tendrías.
      </StepIntro>

      <div className="space-y-4">
        <Panel title={`De tu trasfondo${background ? ` · ${background.name}` : ''}`}>
          {fromBackground.length === 0 ? (
            <p className="text-xs text-stone-400">Elige un trasfondo para ver sus habilidades.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {fromBackground.map(id => (
                <span key={id} className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-emerald-950/30 border-emerald-800/50 text-emerald-300">
                  ✓ {label(id)}
                </span>
              ))}
            </div>
          )}
        </Panel>

        {speciesChoice.count > 0 && (
          <Panel title={`De tu especie · ${species.name} — elige ${speciesChoice.count} (${draft.speciesSkills.length}/${speciesChoice.count})`}>
            <div className="flex flex-wrap gap-2">
              {speciesChoice.options.map(id => (
                <Chip key={id} selected={draft.speciesSkills.includes(id)} onClick={() => toggle('speciesSkills', id, speciesChoice.count)}>
                  {label(id)}
                </Chip>
              ))}
            </div>
          </Panel>
        )}

        <Panel title={cls ? `De tu clase · ${cls.name} — elige ${classChoice.count} (${draft.classSkills.length}/${classChoice.count})` : 'De tu clase'}>
          {!cls ? (
            <p className="text-xs text-stone-400">Elige una clase para ver sus habilidades.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classChoice.options.map(id => {
                const selected = draft.classSkills.includes(id);
                return (
                  <Chip
                    key={id}
                    selected={selected}
                    disabled={!selected && draft.classSkills.length >= classChoice.count}
                    onClick={() => toggle('classSkills', id, classChoice.count)}
                  >
                    {label(id)}
                  </Chip>
                );
              })}
            </div>
          )}
        </Panel>

        <p className="text-[11px] text-stone-500">
          Hay {SKILLS.length} habilidades. Podrás intentar cualquiera durante la partida; en las que no seas competente tirarás solo con
          el modificador de la característica.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Identity
// ---------------------------------------------------------------------------

export function StepIdentity({ draft, update }) {
  const toggleLanguage = language => {
    if (draft.languages.includes(language)) update({ languages: draft.languages.filter(l => l !== language) });
    else if (draft.languages.length < LANGUAGE_CHOICES) update({ languages: [...draft.languages, language] });
  };

  return (
    <div>
      <StepIntro title="Identidad">
        Dale nombre y rostro a tu héroe. Lo que escribas en la historia se lo contaremos a Maese Duncan.
      </StepIntro>

      <div className="space-y-4">
        <Panel>
          <label htmlFor="hero-name" className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block mb-2">Nombre</label>
          <div className="flex gap-2">
            <input
              id="hero-name"
              type="text"
              value={draft.name}
              maxLength={40}
              onChange={e => update({ name: e.target.value })}
              placeholder="¿Cómo te llaman en las tabernas?"
              className="flex-1 min-w-0 bg-[#1c1724] border border-stone-700 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => update({ name: randomName(draft.speciesId) })}
              className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs text-stone-200 flex items-center gap-1.5 shrink-0"
              title="Sugerir un nombre acorde a tu especie"
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-400" /> Sugerir
            </button>
          </div>
        </Panel>

        <Panel title="Retrato">
          <div className="flex flex-wrap gap-2">
            {AVATARS.map(avatar => (
              <button
                key={avatar}
                type="button"
                onClick={() => update({ avatar })}
                aria-pressed={draft.avatar === avatar}
                aria-label={`Retrato ${avatar}`}
                className={`w-11 h-11 rounded-xl text-2xl flex items-center justify-center border transition-all ${
                  draft.avatar === avatar ? 'bg-amber-500/20 border-amber-400 scale-110' : 'bg-[#16121d] border-stone-800 hover:border-amber-700/60'
                }`}
              >
                {avatar}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={`Idiomas — Común y ${LANGUAGE_CHOICES} más (${draft.languages.length}/${LANGUAGE_CHOICES})`}>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(language => {
              const selected = draft.languages.includes(language);
              return (
                <Chip
                  key={language}
                  selected={selected}
                  disabled={!selected && draft.languages.length >= LANGUAGE_CHOICES}
                  onClick={() => toggleLanguage(language)}
                >
                  {language}
                </Chip>
              );
            })}
          </div>
        </Panel>

        <Panel title="Alineamiento (opcional)">
          <div className="flex flex-wrap gap-2">
            {ALIGNMENTS.map(alignment => (
              <Chip
                key={alignment}
                selected={draft.alignment === alignment}
                onClick={() => update({ alignment: draft.alignment === alignment ? '' : alignment })}
              >
                {alignment}
              </Chip>
            ))}
          </div>
        </Panel>

        <Panel>
          <label htmlFor="hero-backstory" className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block mb-2">
            Historia (opcional)
          </label>
          <textarea
            id="hero-backstory"
            value={draft.backstory}
            maxLength={500}
            rows={3}
            onChange={e => update({ backstory: e.target.value })}
            placeholder="De dónde vienes, qué buscas, a quién le debes dinero…"
            className="w-full bg-[#1c1724] border border-stone-700 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none resize-none"
          />
          <p className="text-[10px] text-stone-600 text-right mt-1">{draft.backstory.length}/500</p>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Summary
// ---------------------------------------------------------------------------

export function StepSummary({ character, world }) {
  return (
    <div>
      <StepIntro title="Tu héroe está listo">
        Repasa la ficha. Si algo no te convence, vuelve a cualquier paso; cuando empiece la aventura en {world.name}, este será
        tu personaje para toda la campaña.
      </StepIntro>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-amber-950/80 border-2 border-amber-500/50 flex items-center justify-center text-3xl">{character.avatar}</div>
            <div className="min-w-0">
              <div className="font-cinzel font-bold text-lg text-stone-100 truncate">{character.name}</div>
              <div className="text-xs text-amber-400">{character.race} · {character.className} de nivel 1</div>
              <div className="text-[11px] text-stone-400">{character.background}{character.alignment ? ` · ${character.alignment}` : ''}</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            {[['HP', character.maxHp], ['CA', character.ac], ['Vel.', character.speed === 35 ? '10,5 m' : '9 m'], ['Oro', `${character.gold} po`]].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-stone-900/70 border border-stone-800 py-2">
                <div className="text-[10px] font-mono text-stone-500">{label}</div>
                <div className="font-cinzel font-bold text-sm text-stone-100">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-400 italic mt-3">“{character.backstory}”</p>
        </Panel>

        <Panel title="Características">
          <div className="grid grid-cols-3 gap-2 text-center">
            {ABILITIES.map(ability => (
              <div key={ability.id} className="rounded-lg bg-stone-900/70 border border-stone-800 py-2">
                <div className="text-[10px] font-mono text-stone-500">{ability.short}</div>
                <div className="font-cinzel font-bold text-base text-amber-300">{character.stats[ability.id]}</div>
                <div className="text-[11px] font-mono text-stone-400">{formatModifier(abilityModifier(character.stats[ability.id]))}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-stone-400 mt-3">
            <span className="text-stone-500">Salvaciones:</span> {abilityNames(character.savingThrows)} ·{' '}
            <span className="text-stone-500">Competencia:</span> +{character.proficiencyBonus}
          </p>
        </Panel>

        <Panel title="Competencias y rasgos">
          <dl className="space-y-2 text-xs">
            <div><dt className="text-stone-500">Habilidades</dt><dd className="text-stone-200">{skillNames(character.skills)}</dd></div>
            <div><dt className="text-stone-500">Herramientas</dt><dd className="text-stone-200">{character.tools.join(', ')}</dd></div>
            <div><dt className="text-stone-500">Idiomas</dt><dd className="text-stone-200">{character.languages.join(', ')}</dd></div>
            <div><dt className="text-stone-500">Dotes</dt><dd className="text-stone-200">{character.feats.join(', ')}</dd></div>
            <div><dt className="text-stone-500">Rasgos de clase</dt><dd className="text-stone-200">{character.classFeatures.join(', ')}</dd></div>
            <div><dt className="text-stone-500">Rasgos de especie</dt><dd className="text-stone-200">{character.traits.join(', ')}</dd></div>
          </dl>
        </Panel>

        {character.spellcasting && (
          <Panel title="Magia" className="md:col-span-2">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {character.spellcasting.slots && (
                <div>
                  <dt className="text-stone-500">Espacios de conjuro de nivel 1</dt>
                  <dd className="text-stone-200">
                    {slotsLeft(character)}{character.spellcasting.slots.recovery === 'short' ? ' (se recupera con un descanso corto)' : ''}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-stone-500">Trucos</dt>
                <dd className="text-stone-200">{spellRows(character).filter(s => s.level === 0).map(s => s.name).join(', ') || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-stone-500">Conjuros de nivel 1</dt>
                <dd className="text-stone-200">
                  {spellRows(character).filter(s => s.level === 1).map(s => `${s.name}${s.entry.prepared ? '' : ' (sin preparar)'}`).join(', ') || '—'}
                </dd>
              </div>
            </dl>
          </Panel>
        )}

        <Panel title="Equipo">
          <ul className="space-y-1 text-xs">
            {character.inventory.map(item => (
              <li key={item.id} className="flex gap-2">
                <span className="text-stone-200 shrink-0">{item.name}</span>
                <span className="text-stone-500 truncate">{item.desc || item.effect}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
