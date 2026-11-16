import React from 'react';
import { Check, Star } from 'lucide-react';
import { Panel, StepIntro } from './WizardSteps';
import { getAbility, getSpecies, finalScores, abilityModifier, formatModifier } from '../../utils/characterBuilder';
import { spellSources, spellOptions, picksFor, speciesCantrips, getSpell, spellSummary } from '../../utils/spellcasting';
import { LEVEL_1_PROFICIENCY_BONUS } from '../../data/srd';
import { CLASS_SPELLCASTING } from '../../data/spells';

function SpellRow({ spell, selected, disabled, onToggle, prepared, onTogglePrepared, canPrepare }) {
  return (
    <div
      className={`flex items-stretch rounded-lg border transition-colors ${
        selected ? 'bg-amber-500/10 border-amber-500/60' : 'bg-[#16121d] border-stone-800'
      } ${disabled ? 'opacity-45' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={selected}
        className="flex-1 min-w-0 flex items-start gap-2.5 px-3 py-2 text-left disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
      >
        <span className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
          selected ? 'bg-amber-500 border-amber-400 text-stone-950' : 'border-stone-600'
        }`}>
          {selected && <Check className="w-3 h-3" />}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={`text-sm font-medium ${selected ? 'text-amber-200' : 'text-stone-200'}`}>{spell.name}</span>
            <span className="text-[10px] font-mono text-stone-500">{spellSummary(spell)}</span>
          </span>
          <span className="block text-[11px] text-stone-400 leading-snug">{spell.desc}</span>
        </span>
      </button>

      {onTogglePrepared && selected && (
        <button
          type="button"
          onClick={onTogglePrepared}
          disabled={!prepared && !canPrepare}
          aria-pressed={prepared}
          title={prepared ? 'Preparado: podrás lanzarlo' : 'En el libro, sin preparar'}
          className={`px-3 border-l text-[10px] font-mono flex items-center gap-1 rounded-r-lg disabled:opacity-40 ${
            prepared ? 'border-amber-600/50 text-amber-300 bg-amber-500/10' : 'border-stone-800 text-stone-500 hover:text-stone-300'
          }`}
        >
          <Star className={`w-3 h-3 ${prepared ? 'fill-amber-400' : ''}`} />
          <span className="hidden sm:inline">{prepared ? 'PREPARADO' : 'PREPARAR'}</span>
        </button>
      )}
    </div>
  );
}

export default function StepSpells({ draft, update }) {
  const sources = spellSources(draft);
  const species = getSpecies(draft.speciesId);
  const innate = speciesCantrips(draft).map(getSpell).filter(Boolean);
  const scores = finalScores(draft);

  const setPicks = (key, patch) => update({
    spells: { ...draft.spells, [key]: { ...picksFor(draft, key), ...patch } }
  });

  const toggle = (source, field, id, max) => {
    const picks = picksFor(draft, source.key);
    const current = picks[field];
    if (current.includes(id)) {
      setPicks(source.key, { [field]: current.filter(s => s !== id), prepared: picks.prepared.filter(s => s !== id) });
    } else if (current.length < max) {
      const patch = { [field]: [...current, id] };
      // Wizards: new spells start prepared while there is room
      if (field === 'spells' && source.prepared && picks.prepared.length < source.prepared) {
        patch.prepared = [...picks.prepared, id];
      }
      setPicks(source.key, patch);
    }
  };

  const togglePrepared = (source, id) => {
    const { prepared } = picksFor(draft, source.key);
    if (prepared.includes(id)) setPicks(source.key, { prepared: prepared.filter(s => s !== id) });
    else if (prepared.length < source.prepared) setPicks(source.key, { prepared: [...prepared, id] });
  };

  return (
    <div>
      <StepIntro title="Conjuros">
        Tu magia. Los <span className="text-amber-300">trucos</span> se lanzan siempre que quieras; los conjuros de nivel 1 gastan
        un espacio de conjuro, que recuperas al descansar.
      </StepIntro>

      <div className="space-y-5">
        {sources.map(source => {
          const picks = picksFor(draft, source.key);
          const modifier = abilityModifier(scores[source.ability]);
          const casting = source.key === 'class' ? CLASS_SPELLCASTING[source.list] : null;
          const cantrips = spellOptions(draft, source, 0);
          const spells = spellOptions(draft, source, 1);

          return (
            <Panel key={source.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h4 className="font-cinzel font-bold text-base text-amber-200">{source.title}</h4>
                <span className="text-[11px] font-mono text-stone-400">
                  {getAbility(source.ability).name} · CD {8 + LEVEL_1_PROFICIENCY_BONUS + modifier} · ataque{' '}
                  {formatModifier(LEVEL_1_PROFICIENCY_BONUS + modifier)}
                  {casting && ` · ${casting.slots} ${casting.slots === 1 ? 'espacio' : 'espacios'} de nivel 1`}
                </span>
              </div>
              {source.key !== 'class' && (
                <p className="text-[11px] text-stone-400 mb-3">
                  Dote: podrás lanzar su conjuro de nivel 1 una vez por descanso largo sin gastar espacio.
                </p>
              )}
              {casting?.recovery === 'short' && (
                <p className="text-[11px] text-stone-400 mb-3">Magia de pacto: recuperas tu espacio de conjuro con un descanso corto.</p>
              )}

              {source.cantrips > 0 && (
                <div className="mb-4">
                  <h5 className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mb-2">
                    Trucos — elige {source.cantrips} ({picks.cantrips.length}/{source.cantrips})
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {cantrips.map(spell => {
                      const selected = picks.cantrips.includes(spell.id);
                      return (
                        <SpellRow
                          key={spell.id}
                          spell={spell}
                          selected={selected}
                          disabled={!selected && picks.cantrips.length >= source.cantrips}
                          onToggle={() => toggle(source, 'cantrips', spell.id, source.cantrips)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <h5 className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mb-2">
                {source.prepared
                  ? `Libro de conjuros — elige ${source.spells} (${picks.spells.length}/${source.spells}) y prepara ${source.prepared} (${picks.prepared.length}/${source.prepared})`
                  : `Conjuros de nivel 1 — elige ${source.spells} (${picks.spells.length}/${source.spells})`}
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {spells.map(spell => {
                  const selected = picks.spells.includes(spell.id);
                  return (
                    <SpellRow
                      key={spell.id}
                      spell={spell}
                      selected={selected}
                      disabled={!selected && picks.spells.length >= source.spells}
                      onToggle={() => toggle(source, 'spells', spell.id, source.spells)}
                      prepared={picks.prepared.includes(spell.id)}
                      canPrepare={picks.prepared.length < (source.prepared || 0)}
                      onTogglePrepared={source.prepared ? () => togglePrepared(source, spell.id) : null}
                    />
                  );
                })}
              </div>
            </Panel>
          );
        })}

        {innate.length > 0 && (
          <Panel title={`Magia innata · ${species.name}`}>
            <ul className="space-y-1 text-xs">
              {innate.map(spell => (
                <li key={spell.id}>
                  <span className="text-amber-300 font-semibold">{spell.name}.</span>{' '}
                  <span className="text-stone-300">{spell.desc}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
