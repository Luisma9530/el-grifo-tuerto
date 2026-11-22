import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Shuffle, Swords, X } from 'lucide-react';
import {
  emptyDraft, sanitizeDraft, stepIssues, buildCharacter, randomDraft, finalScores,
  getClass, getBackground, getSpecies, abilityModifier, formatModifier, computeArmorClass, computeMaxHp
} from '../../utils/characterBuilder';
import { needsSpellChoices } from '../../utils/spellcasting';
import { ABILITIES } from '../../data/srd';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  StepClass, StepBackground, StepSpecies, StepAbilities, StepSkills, StepIdentity, StepSummary
} from './WizardSteps';
import StepSpells from './StepSpells';

const ALL_STEPS = [
  { id: 'class', label: 'Clase', Component: StepClass },
  { id: 'background', label: 'Trasfondo', Component: StepBackground },
  { id: 'species', label: 'Especie', Component: StepSpecies },
  { id: 'abilities', label: 'Características', Component: StepAbilities },
  { id: 'skills', label: 'Competencias', Component: StepSkills },
  { id: 'spells', label: 'Conjuros', Component: StepSpells },
  { id: 'identity', label: 'Identidad', Component: StepIdentity },
  { id: 'summary', label: 'Resumen', Component: null }
];

/** Live preview of the hero while it is being built (desktop sidebar). */
function Preview({ draft }) {
  const cls = getClass(draft.classId);
  const background = getBackground(draft.backgroundId);
  const species = getSpecies(draft.speciesId);
  const scores = finalScores(draft);
  const hasScores = ABILITIES.every(a => draft.baseScores[a.id] != null);

  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-amber-950/60 bg-[#110e16] p-5 overflow-y-auto">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-amber-950/80 border-2 border-amber-500/40 flex items-center justify-center text-3xl">{draft.avatar}</div>
        <div className="min-w-0">
          <div className="font-cinzel font-bold text-stone-100 truncate">{draft.name.trim() || 'Héroe sin nombre'}</div>
          <div className="text-xs text-amber-400 truncate">
            {[species?.name, cls?.name].filter(Boolean).join(' · ') || 'Aún por definir'}
          </div>
          <div className="text-[11px] text-stone-500 truncate">{background?.name || '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-5 text-center">
        {ABILITIES.map(ability => (
          <div key={ability.id} className="rounded-lg bg-stone-900/60 border border-stone-800 py-1.5">
            <div className="text-[10px] font-mono text-stone-500">{ability.short}</div>
            <div className="font-cinzel font-bold text-sm text-amber-300">
              {draft.baseScores[ability.id] == null ? '—' : scores[ability.id]}
            </div>
            <div className="text-[10px] font-mono text-stone-500">
              {draft.baseScores[ability.id] == null ? ' ' : formatModifier(abilityModifier(scores[ability.id]))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 text-center">
        <div className="rounded-lg bg-stone-900/60 border border-stone-800 py-2">
          <div className="text-[10px] font-mono text-stone-500">PUNTOS DE GOLPE</div>
          <div className="font-cinzel font-bold text-stone-100">{cls && hasScores ? computeMaxHp(cls, species, scores) : '—'}</div>
        </div>
        <div className="rounded-lg bg-stone-900/60 border border-stone-800 py-2">
          <div className="text-[10px] font-mono text-stone-500">ARMADURA</div>
          <div className="font-cinzel font-bold text-stone-100">{cls && hasScores ? computeArmorClass(cls, scores) : '—'}</div>
        </div>
      </div>

      <p className="text-[10px] text-stone-600 mt-auto pt-6 leading-relaxed">
        Creación de personaje con las reglas de D&D 2024 (SRD 5.2). Todos los héroes empiezan en nivel 1.
      </p>
    </aside>
  );
}

/**
 * Full-screen character creation, shown before a new campaign starts.
 * @param {object} props
 * @param {object} props.world              the world the campaign will be played in
 * @param {(character: object, draft: object) => void} props.onComplete  (draft: the choices, for an online host to build the sheet itself)
 * @param {() => void} props.onCancel
 */
export default function CharacterWizard({ world, onComplete, onCancel, completeLabel = 'Comenzar la aventura' }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [stepId, setStepId] = useState('class');
  const [showIssues, setShowIssues] = useState(false);
  const scrollRef = useRef(null);

  // The spells step only exists for heroes with magic to choose
  const steps = useMemo(
    () => ALL_STEPS.filter(s => s.id !== 'spells' || needsSpellChoices(draft)),
    [draft]
  );
  const stepIndex = Math.max(0, steps.findIndex(s => s.id === stepId));
  const step = steps[stepIndex];

  const issues = useMemo(() => stepIssues(draft), [draft]);
  const isSummary = step.id === 'summary';
  const allIssues = Object.values(issues).flat();
  const currentIssues = isSummary ? allIssues : issues[step.id];

  const character = useMemo(
    () => (allIssues.length === 0 ? buildCharacter(draft) : null),
    [draft, allIssues.length]
  );

  const hasProgress = draft.classId || draft.backgroundId || draft.speciesId || draft.name.trim();
  const handleCancel = () => {
    if (!hasProgress || window.confirm('¿Salir de la creación de personaje? Perderás lo que llevas hecho.')) onCancel();
  };
  useEscapeKey(true, handleCancel);

  const update = patch => setDraft(current => {
    const next = { ...current, ...patch };
    // Picking a class pre-fills the recommended scores, unless the player already touched them
    const untouched = ABILITIES.every(a => current.baseScores[a.id] == null);
    if (patch.classId && next.method === 'standard' && untouched) {
      next.baseScores = { ...getClass(patch.classId).suggestedArray };
    }
    return sanitizeDraft(next);
  });

  const goTo = id => {
    setStepId(id);
    setShowIssues(false);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const handleNext = () => {
    if (currentIssues.length > 0) {
      setShowIssues(true);
      return;
    }
    if (isSummary) onComplete(character, draft);
    else goTo(steps[stepIndex + 1].id);
  };

  const handleRandom = () => {
    const hasChoices = draft.classId || draft.backgroundId || draft.speciesId;
    if (hasChoices && !window.confirm('¿Generar un héroe al azar? Sustituirá lo que has elegido hasta ahora.')) return;
    setDraft(randomDraft());
    goTo('summary');
  };

  // The summary can't be opened until every earlier step is complete
  const complete = allIssues.length === 0;
  const canOpen = s => s.id !== 'summary' || complete;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b090e] text-stone-200" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      {/* Header */}
      <header className="shrink-0 border-b border-amber-950/60 bg-[#120f18] px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 truncate">Nueva aventura en {world.name}</p>
            <h2 id="wizard-title" className="font-cinzel text-lg sm:text-xl font-bold text-stone-100">Crea tu héroe</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRandom}
              className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs text-stone-200 flex items-center gap-1.5"
              title="Genera un héroe completo y válido al azar; podrás retocarlo"
              aria-label="Héroe al azar"
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Héroe al azar</span>
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              aria-label="Cancelar la creación de personaje"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Steps */}
        <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Pasos de la creación">
          {steps.map((s, index) => {
            const isLast = s.id === 'summary';
            const done = !isLast && issues[s.id].length === 0;
            const active = s.id === step.id;
            const enabled = canOpen(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => enabled && goTo(s.id)}
                disabled={!enabled}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
                  active
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : enabled
                      ? 'bg-[#16121d] border-stone-800 text-stone-300 hover:border-amber-700/60'
                      : 'bg-transparent border-stone-900 text-stone-600 cursor-not-allowed'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono ${
                  done ? 'bg-emerald-600 text-stone-950' : 'bg-stone-800 text-stone-400'
                }`}>
                  {done ? <Check className="w-3 h-3" /> : index + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <main ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="max-w-4xl mx-auto">
            {isSummary
              ? character && <StepSummary character={character} world={world} />
              : <step.Component draft={draft} update={update} />}
          </div>
        </main>
        {!isSummary && <Preview draft={draft} />}
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t border-amber-950/60 bg-[#120f18] px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (stepIndex === 0 ? handleCancel() : goTo(steps[stepIndex - 1].id))}
            className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-sm text-stone-200 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> {stepIndex === 0 ? 'Cancelar' : 'Atrás'}
          </button>

          <div className="flex-1 min-w-0 text-right" role="status" aria-live="polite">
            {showIssues && currentIssues.length > 0 && (
              <span className="text-xs text-amber-300">{currentIssues[0]}</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className={`px-5 py-2.5 rounded-xl text-sm font-cinzel font-bold flex items-center gap-2 transition-all ${
              currentIssues.length === 0
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-stone-950 shadow-lg shadow-amber-900/40'
                : 'bg-stone-800 text-stone-400 border border-stone-700'
            }`}
          >
            {isSummary ? (
              <><Swords className="w-4 h-4" /> {completeLabel}</>
            ) : (
              <>Siguiente <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
