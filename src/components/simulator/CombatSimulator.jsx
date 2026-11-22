import React, { useMemo, useState } from 'react';
import {
  FlaskConical, X, Swords, Shuffle, Users, BookOpen, Hammer, History, RotateCcw, Settings2, BarChart3, ShieldAlert, Skull, Flag, Footprints
} from 'lucide-react';
import CombatView from '../game/CombatView';
import EncounterBuilder from '../game/EncounterBuilder';
import HeroTuner from './HeroTuner';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { getAllCampaigns } from '../../utils/campaignStorage';
import { PRESET_CHARACTERS } from '../../data/gameData';
import { CLASSES } from '../../data/srd';
import { buildCharacter, randomDraft } from '../../utils/characterBuilder';
import { canAdvance } from '../../utils/leveling';
import { getMonster, eliteVersion, encounterXp, difficultyOf } from '../../utils/bestiary';
import { playerAction } from '../../utils/encounter';
import { rollDie } from '../../utils/gameEngine';
import { animateRoll } from '../../dice3d/controller';
import { recentFights, groupsFromData, describeGroups, RESULT_LABELS, MAX_SNAPSHOTS } from '../../utils/combatSnapshots';
import {
  simulatorHero, quickHero, levelHeroTo, setPotions, potionCount, startSimulation, fightSummary, simulateMany
} from '../../utils/simulator';

const combatDie = sides => rollDie(sides, { silent: true });
const DEFAULT_POTIONS = 2;

const RESULT_STYLES = {
  victory: 'text-emerald-300 border-emerald-800/60 bg-emerald-950/30',
  defeat: 'text-red-300 border-red-900/60 bg-red-950/30',
  fled: 'text-amber-300 border-amber-800/60 bg-amber-950/30',
  timeout: 'text-stone-300 border-stone-700 bg-stone-900/40'
};

const formatDate = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const percent = n => `${Math.round(n * 100)} %`;

function Notice({ className = '' }) {
  return (
    <div className={`px-4 py-1.5 bg-sky-950/70 border-b border-sky-800/60 text-[11px] text-sky-100 flex items-center gap-2 ${className}`}>
      <ShieldAlert className="w-3.5 h-3.5 text-sky-300 shrink-0" />
      <span><b>Simulacro:</b> no afecta a tu campaña. Sin PX, oro, botín, heridas ni memoria de Duncan, y sin IA.</span>
    </div>
  );
}

const TABS = [
  { id: 'recent', label: 'Combates recientes', icon: History },
  { id: 'campaign', label: 'De tus campañas', icon: BookOpen },
  { id: 'preset', label: 'Predefinidos', icon: Users },
  { id: 'quick', label: 'Crear rápido', icon: Hammer }
];

/**
 * The combat simulator (a full-screen layer, loaded on demand).
 * It only reads saved campaigns: every hero is a copy and nothing is ever saved.
 * `initialSnapshot`: a fight of a campaign to replay; `campaignId`: the campaign
 * the player came from (its fights are listed first).
 */
export default function CombatSimulator({ onClose, initialSnapshot = null, campaignId = null }) {
  // Read once: copies of the saved campaigns (the simulator never writes them)
  const [campaigns] = useState(() => getAllCampaigns());
  const fights = useMemo(() => {
    const all = recentFights(campaigns);
    return campaignId ? [...all.filter(f => f.campaignId === campaignId), ...all.filter(f => f.campaignId !== campaignId)] : all;
  }, [campaigns, campaignId]);

  const fromSnapshot = snapshot => ({
    base: { hero: simulatorHero(snapshot.character), label: `${snapshot.heroName} · combate del ${formatDate(snapshot.date)}${snapshot.place ? ` en ${snapshot.place}` : ''}`, kind: 'snapshot', minLevel: snapshot.level },
    groups: groupsFromData(snapshot.groups, { getMonster, eliteVersion }),
    snapshot
  });

  const initial = initialSnapshot ? fromSnapshot(initialSnapshot) : null;
  const [tab, setTab] = useState(initialSnapshot || fights.length ? 'recent' : 'quick');
  const [base, setBase] = useState(initial?.base || null);   // the chosen hero, before adjustments
  const [hero, setHero] = useState(initial?.base.hero || null); // the adjusted copy that will fight
  const [groups, setGroups] = useState(initial?.groups || []);
  const [replaying, setReplaying] = useState(initial?.snapshot || null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [quick, setQuick] = useState({ classId: CLASSES[0].id, level: 3 });
  const [fight, setFight] = useState(null); // { encounter, character, start }
  const [phase, setPhase] = useState('setup'); // setup | fight | summary
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState({ runs: 100, healBelow: 35, result: null });
  const [error, setError] = useState('');

  useEscapeKey(!builderOpen && phase !== 'fight', onClose);

  const choose = (nextBase, nextGroups = null, snapshot = null) => {
    setBase(nextBase);
    setHero(nextBase.hero);
    if (nextGroups) setGroups(nextGroups);
    setReplaying(snapshot);
    setBatch(b => ({ ...b, result: null }));
    setError('');
  };

  const chooseFight = snapshot => {
    const { base: b, groups: g } = fromSnapshot(snapshot);
    if (!g.length) { setError('Los enemigos de ese combate ya no están en el bestiario.'); return; }
    choose(b, g, snapshot);
  };

  const chooseCampaignHero = campaign => choose({
    hero: simulatorHero(campaign.character), label: `${campaign.character.name} · copia de «${campaign.title}»`, kind: 'campaign', minLevel: campaign.character.level || 1
  });

  const choosePreset = preset => choose({ hero: simulatorHero(preset), label: `${preset.name} · predefinido`, kind: 'preset' });

  const chooseRandom = () => {
    const h = simulatorHero(buildCharacter(randomDraft(), { id: `sim_${Date.now()}` }));
    choose({ hero: setPotions(h, 'healing', DEFAULT_POTIONS), label: `${h.name} · al azar (${h.className})`, kind: 'quick', classId: h.classId });
  };

  const chooseQuick = () => {
    try {
      const h = quickHero({ classId: quick.classId, level: quick.level });
      choose({ hero: setPotions(h, 'healing', DEFAULT_POTIONS), label: `${h.name} · ${h.className} de nivel ${h.level}`, kind: 'quick', classId: h.classId });
    } catch (e) {
      setError(e.message);
    }
  };

  // Quick heroes are rebuilt at the new level; copies only go up (with quick choices)
  const changeLevel = level => {
    if (base.kind === 'quick') {
      const h = setPotions(quickHero({ classId: base.classId || hero.classId, level }), 'healing', potionCount(hero, 'healing'));
      setBase({ ...base, hero: h, label: `${h.name} · ${h.className} de nivel ${h.level}` });
      setHero(h);
    } else {
      setHero(levelHeroTo(hero, level));
    }
  };

  const rating = groups.length && hero ? difficultyOf(hero.level || 1, encounterXp(groups)) : null;

  // ------------------------------------------------------------------ fights
  const begin = () => {
    if (!hero || !groups.length) return;
    const start = simulatorHero(hero);
    const { encounter, character } = startSimulation(start, groups, combatDie);
    setFight({ encounter, character, start });
    setPhase('fight');
  };

  const handleAction = async action => {
    if (!fight || busy) return;
    const result = playerAction(fight.encounter, fight.character, action, combatDie);
    if (!result.ok) {
      setFight(f => ({ ...f, encounter: { ...f.encounter, log: [...f.encounter.log, { round: f.encounter.round, kind: 'info', text: `⚠️ ${result.error}` }] } }));
      return;
    }
    setBusy(true);
    try {
      for (const roll of result.animations) await animateRoll(roll);
    } finally {
      setFight(f => ({ ...f, encounter: result.encounter, character: result.character }));
      setBusy(false);
    }
  };

  const giveUp = () => setFight(f => ({ ...f, encounter: { ...f.encounter, status: 'fled', log: [...f.encounter.log, { round: f.encounter.round, kind: 'end', text: 'Abandonas el simulacro.' }] } }));

  const runBatch = () => {
    if (!hero || !groups.length) return;
    setBatch(b => ({ ...b, result: simulateMany(hero, groups, b.runs, { healBelow: b.healBelow / 100 }) }));
  };

  const summary = fight && phase === 'summary' ? fightSummary(fight.encounter, fight.start, fight.character) : null;

  // ------------------------------------------------------------------ render
  if (phase === 'fight' && fight) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#0b090e] flex flex-col">
        <div className="flex-1 min-h-0">
          <CombatView
            encounter={fight.encounter}
            character={fight.character}
            onAction={handleAction}
            onFinish={() => setPhase('summary')}
            busy={busy}
            finishLabel="Ver resumen"
            banner={(
              <div className="flex items-center justify-between bg-sky-950/70 border-b border-sky-800/60">
                <Notice className="border-b-0 flex-1" />
                {fight.encounter.status === 'active' && (
                  <button onClick={giveUp} className="mx-3 text-[11px] text-sky-200 hover:text-white underline shrink-0">Abandonar</button>
                )}
              </div>
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-stretch sm:items-center justify-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="sim-title"
        className="w-full max-w-4xl sm:max-h-[94vh] flex flex-col sm:rounded-2xl bg-[#100e15] border-sky-900/60 sm:border-2 shadow-2xl overflow-hidden">
        <header className="p-4 sm:p-5 border-b border-sky-950 flex items-start justify-between gap-3 bg-gradient-to-r from-sky-950/50 to-transparent">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-sky-300/80 flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> Simulador de combates</p>
            <h2 id="sim-title" className="font-cinzel text-xl font-bold text-stone-100">
              {phase === 'summary' ? 'Resumen del simulacro' : 'Prepara un simulacro'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800" aria-label="Cerrar el simulador">
            <X className="w-5 h-5" />
          </button>
        </header>
        <Notice />

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && <p className="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg p-2">{error}</p>}

          {phase === 'summary' && summary ? (
            <FightSummaryPanel summary={summary} hero={fight.character} />
          ) : (
            <>
              {/* 1. Hero */}
              <section>
                <h3 className="text-sm font-cinzel font-bold text-sky-100 mb-2">1. El héroe {base && <span className="font-sans font-normal text-xs text-stone-400">— {base.label}</span>}</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
                        className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 ${tab === t.id ? 'bg-sky-500/20 border-sky-400 text-sky-100' : 'border-stone-800 text-stone-400 hover:text-stone-200'}`}>
                        <Icon className="w-3.5 h-3.5" /> {t.label}
                      </button>
                    );
                  })}
                  <button onClick={chooseRandom} className="px-3 py-1.5 rounded-lg border border-stone-800 text-xs text-stone-300 hover:text-white hover:border-sky-600/60 flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5" /> Héroe al azar
                  </button>
                </div>

                {tab === 'recent' && (
                  fights.length === 0 ? (
                    <p className="text-xs text-stone-500">Aún no hay combates guardados. Cada combate de una campaña guarda cómo empezó (los {MAX_SNAPSHOTS} últimos) para poder revivirlo aquí.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {fights.map(f => (
                        <li key={`${f.campaignId}-${f.id}`}>
                          <button onClick={() => chooseFight(f)} aria-pressed={replaying?.id === f.id}
                            className={`w-full text-left p-2 rounded-lg border flex items-center justify-between gap-2 ${replaying?.id === f.id ? 'bg-sky-500/15 border-sky-500' : 'bg-[#16121d] border-stone-800 hover:border-sky-700/60'}`}>
                            <span className="min-w-0">
                              <span className="block text-xs text-stone-100 truncate">{f.heroName} (nv. {f.level}) contra {describeGroups(f.groups)}</span>
                              <span className="block text-[10px] text-stone-500 truncate">{formatDate(f.date)}{f.place ? ` · ${f.place}` : ''} · {f.campaignTitle}</span>
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${RESULT_STYLES[f.result] || 'text-stone-400 border-stone-700'}`}>
                              {f.result ? `${RESULT_LABELS[f.result]}${f.rounds ? ` · ${f.rounds} r.` : ''}` : 'Sin terminar'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}

                {tab === 'campaign' && (
                  campaigns.length === 0 ? <p className="text-xs text-stone-500">No tienes campañas guardadas.</p> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {campaigns.map(c => (
                        <button key={c.id} onClick={() => chooseCampaignHero(c)}
                          className="text-left p-2 rounded-lg bg-[#16121d] border border-stone-800 hover:border-sky-700/60">
                          <span className="block text-xs text-stone-100 truncate">{c.character.avatar} {c.character.name} · {c.character.className || c.character.class} nv. {c.character.level || 1}</span>
                          <span className="block text-[10px] text-stone-500 truncate">{c.title} · {c.character.hp}/{c.character.maxHp} PG</span>
                        </button>
                      ))}
                    </div>
                  )
                )}

                {tab === 'preset' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {PRESET_CHARACTERS.map(p => (
                      <button key={p.id} onClick={() => choosePreset(p)} className="text-left p-2 rounded-lg bg-[#16121d] border border-stone-800 hover:border-sky-700/60">
                        <span className="block text-xs text-stone-100">{p.avatar} {p.name}</span>
                        <span className="block text-[10px] text-stone-500">{p.race} · {p.class} · {p.maxHp} PG · CA {p.ac}</span>
                      </button>
                    ))}
                  </div>
                )}

                {tab === 'quick' && (
                  <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-[#16121d] border border-stone-800">
                    <label className="text-xs text-stone-300 flex flex-col gap-1">Clase
                      <select value={quick.classId} onChange={e => setQuick(q => ({ ...q, classId: e.target.value }))}
                        className="bg-[#1a1523] border border-stone-700 rounded-lg px-2 py-1.5 text-sm text-stone-100">
                        {CLASSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-stone-300 flex flex-col gap-1">Nivel
                      <input type="number" min={1} max={20} value={quick.level}
                        onChange={e => setQuick(q => ({ ...q, level: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))}
                        className="w-20 bg-[#1a1523] border border-stone-700 rounded-lg px-2 py-1.5 text-sm text-stone-100 font-mono" />
                    </label>
                    <button onClick={chooseQuick} className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold">Crear héroe</button>
                    <p className="w-full text-[10px] text-stone-500">Especie, trasfondo y conjuros al azar; el equipo inicial de su clase y {DEFAULT_POTIONS} pociones de curación. Sube de nivel con elecciones rápidas (la media de PG).</p>
                  </div>
                )}
              </section>

              {hero && (
                <section>
                  <h3 className="text-sm font-cinzel font-bold text-sky-100 mb-2 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Ajustes antes de empezar
                    <span className="font-sans font-normal text-[11px] text-stone-400">{hero.avatar} {hero.name} · CA {hero.ac}</span>
                    <button onClick={() => setHero(base.hero)} className="ml-auto font-sans font-normal text-[11px] text-sky-300 hover:underline">Deshacer ajustes</button>
                  </h3>
                  <HeroTuner
                    key={`${base.label}-${hero.level}`}
                    hero={hero}
                    onChange={setHero}
                    onLevel={changeLevel}
                    minLevel={base.kind === 'quick' ? 1 : base.minLevel || hero.level || 1}
                    levelLocked={base.kind !== 'quick' && !canAdvance(hero) ? 'Este héroe no se creó con el asistente y no puede subir de nivel.' : null}
                  />
                </section>
              )}

              {/* 2. Enemies */}
              <section>
                <h3 className="text-sm font-cinzel font-bold text-sky-100 mb-2">2. Los enemigos</h3>
                <div className="p-3 rounded-xl bg-[#16121d] border border-red-900/30 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-stone-300">
                    {groups.length ? describeGroups(groups.map(g => ({ monsterName: g.monster.name, count: g.count, name: g.name, elite: g.elite }))) : 'Ninguno todavía.'}
                    {rating && <span className="ml-2 text-stone-500">· {rating.name} para nivel {hero.level || 1} · {encounterXp(groups)} PX</span>}
                  </p>
                  <button disabled={!hero} onClick={() => setBuilderOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5" /> {groups.length ? 'Cambiar enemigos' : 'Elegir enemigos'}
                  </button>
                </div>
              </section>

              {/* Optional: many fights with a simple AI */}
              {hero && groups.length > 0 && (
                <section className="p-3 rounded-xl bg-[#121620] border border-sky-900/40">
                  <h3 className="text-xs font-bold text-sky-100 mb-2 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Simular N veces (IA sencilla)</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
                    <label className="flex items-center gap-1.5">Combates
                      <input type="number" min={1} max={1000} value={batch.runs} onChange={e => setBatch(b => ({ ...b, runs: Math.max(1, Math.min(1000, Number(e.target.value) || 1)) }))}
                        className="w-20 bg-[#1a1523] border border-stone-700 rounded-lg px-2 py-1 font-mono" />
                    </label>
                    <label className="flex items-center gap-1.5">Bebe poción por debajo del
                      <input type="number" min={0} max={100} value={batch.healBelow} onChange={e => setBatch(b => ({ ...b, healBelow: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                        className="w-16 bg-[#1a1523] border border-stone-700 rounded-lg px-2 py-1 font-mono" /> % de PG
                    </label>
                    <button onClick={runBatch} className="px-3 py-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 text-white font-bold">Simular</button>
                  </div>
                  <p className="mt-1 text-[10px] text-stone-500">El héroe ataca con su mejor arma o truco al enemigo más débil y se cura por debajo del umbral. No gasta espacios de conjuro.</p>
                  {batch.result && (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                      <Stat label="Victorias" value={percent(batch.result.winRate)} tone="text-emerald-300" />
                      <Stat label="Derrotas" value={`${batch.result.defeat}/${batch.result.runs}`} tone="text-red-300" />
                      <Stat label="Rondas (media)" value={batch.result.avgRounds.toFixed(1)} />
                      <Stat label="PG al ganar" value={percent(batch.result.avgHpLeft)} />
                      <Stat label="Pociones (media)" value={batch.result.avgPotions.toFixed(1)} />
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        <footer className="p-4 border-t border-sky-950 flex flex-wrap items-center justify-end gap-2">
          {phase === 'summary' ? (
            <>
              <button onClick={() => setPhase('setup')} className="px-4 py-2 rounded-xl border border-stone-700 text-stone-200 text-sm flex items-center gap-1.5">
                <Settings2 className="w-4 h-4" /> Cambiar y repetir
              </button>
              <button onClick={begin} className="px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-sm font-cinzel font-bold flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> Repetir igual
              </button>
            </>
          ) : (
            <button onClick={begin} disabled={!hero || !groups.length}
              className="px-5 py-2.5 rounded-xl text-sm font-cinzel font-bold flex items-center gap-2 bg-gradient-to-r from-sky-700 to-sky-600 hover:brightness-110 text-white disabled:opacity-40">
              <Swords className="w-4 h-4" /> ¡Al simulacro!
            </button>
          )}
        </footer>
      </div>

      {builderOpen && hero && (
        <EncounterBuilder
          character={hero}
          world={replaying?.worldId ? { id: replaying.worldId } : null}
          initialGroups={groups}
          allowElite
          startLabel="Usar estos enemigos"
          note="Simulacro: elige libremente, nada de esto afecta a tu campaña."
          onStart={g => { setGroups(g); setBuilderOpen(false); setBatch(b => ({ ...b, result: null })); }}
          onClose={() => setBuilderOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'text-stone-100' }) {
  return (
    <div className="p-2 rounded-lg bg-black/30 border border-stone-800">
      <p className={`text-base font-mono font-bold ${tone}`}>{value}</p>
      <p className="text-[10px] text-stone-500">{label}</p>
    </div>
  );
}

const OUTCOME = {
  victory: { text: '¡Victoria!', icon: Flag, tone: 'text-emerald-300' },
  defeat: { text: 'Derrota', icon: Skull, tone: 'text-red-300' },
  fled: { text: 'Huida', icon: Footprints, tone: 'text-amber-300' },
  timeout: { text: 'Sin final', icon: Footprints, tone: 'text-stone-300' }
};

function FightSummaryPanel({ summary, hero }) {
  const outcome = OUTCOME[summary.status] || OUTCOME.timeout;
  const Icon = outcome.icon;
  return (
    <div className="space-y-3">
      <p className={`text-lg font-cinzel font-bold flex items-center gap-2 ${outcome.tone}`}>
        <Icon className="w-5 h-5" /> {outcome.text} <span className="text-sm font-sans font-normal text-stone-400">· {hero.name} termina con {summary.hpLeft}/{hero.maxHp} PG</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        <Stat label="Rondas" value={summary.rounds} />
        <Stat label="Daño hecho" value={summary.dealt} tone="text-emerald-300" />
        <Stat label="Daño recibido" value={summary.taken} tone="text-red-300" />
        <Stat label="Pociones" value={summary.potions} tone="text-sky-300" />
        <Stat label="Espacios de conjuro" value={summary.slots} tone="text-purple-300" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-[#16121d] border border-stone-800">
          <p className="text-stone-400 mb-1">Conjuros lanzados</p>
          <p className="text-stone-100">{summary.spells.length ? summary.spells.join(', ') : 'Ninguno'}</p>
          <p className="text-stone-400 mt-2 mb-1">Condiciones sufridas</p>
          <p className="text-stone-100">{summary.conditions.length ? summary.conditions.join(', ') : 'Ninguna'}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#16121d] border border-stone-800">
          <p className="text-stone-400 mb-1">Enemigos</p>
          <ul className="space-y-0.5">
            {summary.enemies.map(e => (
              <li key={e.name} className="flex justify-between gap-2">
                <span className="text-stone-100 truncate">{e.name}</span>
                <span className="text-stone-500 font-mono shrink-0">{e.status === 'active' ? `${e.hp}/${e.maxHp} PG` : { dead: 'abatido', fled: 'huyó', surrendered: 'se rindió' }[e.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-[11px] text-stone-500">«Repetir igual»: el mismo héroe (como estaba al empezar) y los mismos enemigos, con dados nuevos. «Cambiar y repetir»: vuelve a los ajustes.</p>
    </div>
  );
}
