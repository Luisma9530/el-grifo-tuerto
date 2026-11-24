import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Shuffle, Swords, Trash2, Users, X, MapPin, Compass, Loader2 } from 'lucide-react';
import { PRESET_CHARACTERS } from '../../data/gameData';
import { buildCharacter, randomDraft } from '../../utils/characterBuilder';
import { MAX_PARTY } from '../../utils/party';
import { formatCoins } from '../../utils/items';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { worldZones, zonesFor, suggestZone, fitLabel, generateZonesWithAI, START_MODES } from '../../utils/origins';
import { getStoredGeminiKeys } from '../../utils/geminiKeys';

/**
 * The party of a new campaign: one to four characters, made with the creation
 * wizard, at random or from the presets. One player controls all of them.
 *
 * How it starts: «Empezar juntos» (everyone in the world's tavern, as always) or
 * «Cada uno desde su origen»: each character gets the starting zone that fits
 * their background and species (see origins.js) and the player may pick another
 * one. A forged world without zones gets them from Duncan (with the AI) or from
 * a generic template.
 * @param {{ world, members: object[], onAddWithWizard, onChange(members),
 *   onStart(members, { mode, zones, choices }), onCancel }} props
 */
const START_OPTIONS = world => [
  { id: START_MODES.together, icon: Users, title: 'Empezar juntos', text: `Todo el grupo empieza en ${world.initialLocation || 'la taberna'}, como siempre.` },
  { id: START_MODES.origins, icon: Compass, title: 'Cada uno desde su origen', text: 'Cada personaje empieza en la zona que encaja con su trasfondo y su especie; la historia os juntará después.' }
];

/** Where a character starts: the suggested zone or another one of the list. */
function ZonePicker({ member, zones, zone, onPick }) {
  const suggested = suggestZone(member, zones);
  const why = zone ? fitLabel(member, zone) : '';
  return (
    <label className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-stone-300">
      <span className="flex items-center gap-1 text-emerald-300"><MapPin className="w-3 h-3" /> Empieza en</span>
      <select
        value={zone?.id || ''}
        onChange={e => onPick(e.target.value)}
        className="bg-[#1a1523] border border-stone-700 rounded-lg px-1.5 py-1 text-[11px] text-stone-200 max-w-full"
        aria-label={`Zona de inicio de ${member.name}`}
      >
        {zones.map(z => <option key={z.id} value={z.id}>{z.name}{z.id === suggested?.id ? ' (sugerida)' : ''}</option>)}
      </select>
      {why && <span className="text-[10px] text-stone-500">Encaja por: {why}</span>}
    </label>
  );
}

export default function PartySetup({ world, members, onAddWithWizard, onChange, onStart, onCancel }) {
  const [presetId, setPresetId] = useState('');
  const [mode, setMode] = useState(START_MODES.together);
  // The zone each character chose (by id); missing: the suggested one
  const [picked, setPicked] = useState({});
  // Zones of a forged world drawn by Duncan: null while there are none (the template is used)
  const [aiZones, setAiZones] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const full = members.length >= MAX_PARTY;
  const purse = members.reduce((sum, m) => sum + (Number(m.gold) || 0), 0);
  const ownZones = useMemo(() => worldZones(world), [world]);
  const zones = useMemo(() => aiZones || zonesFor(world), [aiZones, world]);
  const origins = mode === START_MODES.origins;
  const keyOf = (m, index) => m.id || `i${index}`;
  const zoneFor = (m, index) => zones.find(z => z.id === picked[keyOf(m, index)]) || suggestZone(m, zones);

  // A forged world without zones: Duncan draws them from its description (once), if the AI is connected
  const needsZones = origins && !ownZones.length && !aiZones;
  useEffect(() => {
    if (!needsZones) return undefined;
    const key = getStoredGeminiKeys()[0]?.key;
    if (!key) return undefined;
    let alive = true;
    setDrawing(true);
    generateZonesWithAI(world, key).then(found => {
      if (!alive) return;
      setDrawing(false);
      if (found) {
        setAiZones(found);
        setPicked({});
      }
    });
    return () => {
      alive = false;
      setDrawing(false);
    };
  }, [needsZones, world]);

  const start = () => {
    if (!origins) {
      onStart(members, { mode: START_MODES.together });
      return;
    }
    onStart(members, { mode: START_MODES.origins, zones, choices: members.map((m, i) => zoneFor(m, i)?.id || null) });
  };

  const handleCancel = () => {
    if (!members.length || window.confirm('¿Salir? Perderás los personajes creados para esta campaña.')) onCancel();
  };
  useEscapeKey(true, handleCancel);

  const addRandom = () => {
    if (full) return;
    onChange([...members, buildCharacter(randomDraft(), { id: `hero_${Date.now()}_${members.length}` })]);
  };
  const addPreset = id => {
    const preset = PRESET_CHARACTERS.find(p => p.id === id);
    if (!preset || full) return;
    onChange([...members, { ...JSON.parse(JSON.stringify(preset)), id: `${preset.id}_${Date.now()}_${members.length}` }]);
    setPresetId('');
  };
  const remove = index => onChange(members.filter((_, i) => i !== index));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b090e] text-stone-200" role="dialog" aria-modal="true" aria-labelledby="party-setup-title">
      <header className="shrink-0 border-b border-amber-950/60 bg-[#120f18] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 truncate">Nueva aventura en {world.name}</p>
          <h2 id="party-setup-title" className="font-cinzel text-lg sm:text-xl font-bold text-stone-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" /> Tu grupo
          </h2>
        </div>
        <button type="button" onClick={handleCancel} className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800" aria-label="Cancelar la nueva campaña">
          <X className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          <p className="text-sm text-stone-400">
            Juega con un solo héroe o con un grupo de hasta {MAX_PARTY} personajes; los controlas tú a todos. Fuera del combate eliges quién actúa;
            en combate, cada uno tiene su turno. Durante la historia, Duncan puede presentaros a alguien que quiera unirse.
          </p>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map((m, index) => (
              <li key={m.id || index} className="p-3 rounded-xl bg-[#17131f] border border-stone-800 flex items-center gap-3">
                <span className="text-3xl">{m.avatar || '🛡️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-cinzel font-bold text-stone-100 truncate">{m.name}</p>
                  <p className="text-xs text-amber-400 truncate">{m.race} · {m.class}</p>
                  <p className="text-[11px] font-mono text-stone-500">{m.maxHp} PG · CA {m.ac}</p>
                  {origins && zones.length > 0 && (
                    <ZonePicker
                      member={m}
                      zones={zones}
                      zone={zoneFor(m, index)}
                      onPick={id => setPicked(prev => ({ ...prev, [keyOf(m, index)]: id }))}
                    />
                  )}
                </div>
                <button type="button" onClick={() => remove(index)} className="p-2 rounded-lg text-stone-500 hover:text-red-300 hover:bg-red-950/40" aria-label={`Quitar a ${m.name} del grupo`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
            {!members.length && (
              <li className="sm:col-span-2 p-4 rounded-xl border border-dashed border-stone-700 text-sm text-stone-500 text-center">Aún no hay nadie en el grupo.</li>
            )}
          </ul>

          {/* How the story starts */}
          <fieldset className="p-4 rounded-xl bg-[#141019] border border-amber-900/40 space-y-2">
            <legend className="px-1 text-[11px] font-mono uppercase tracking-wider text-amber-400/80">Cómo empieza la historia</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Cómo empieza la historia">
              {START_OPTIONS(world).map(({ id, icon, title, text }) => {
                const OptionIcon = icon;
                return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  onClick={() => setMode(id)}
                  className={`text-left p-3 rounded-xl border transition-colors ${mode === id ? 'bg-amber-500/10 border-amber-500 text-amber-100' : 'bg-[#17131f] border-stone-800 text-stone-300 hover:border-amber-800'}`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-bold"><OptionIcon className="w-4 h-4" /> {title}</span>
                  <span className="block mt-1 text-[11px] text-stone-400">{text}</span>
                </button>
                );
              })}
            </div>
            {origins && (
              <p className="text-[11px] text-stone-400" role="status">
                {drawing
                  ? <span className="inline-flex items-center gap-1 text-sky-300"><Loader2 className="w-3 h-3 animate-spin" /> Duncan está trazando las zonas de este mundo…</span>
                  : <>Zonas de {world.name}: {zones.map(z => z.name).join(' · ')}. Cada uno juega su escena hasta que la historia os junte; quienes empiecen en la misma zona irán juntos desde el principio, y cada grupo lleva su propio oro hasta el encuentro.</>}
              </p>
            )}
          </fieldset>

          {!full && (
            <div className="p-4 rounded-xl bg-stone-900/50 border border-stone-800 space-y-3">
              <p className="text-[11px] font-mono uppercase tracking-wider text-stone-400">Añadir un personaje ({members.length}/{MAX_PARTY})</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onAddWithWizard} className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Crear con el asistente
                </button>
                <button type="button" onClick={addRandom} className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs text-stone-200 flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-amber-400" /> Héroe al azar
                </button>
                <label className="flex items-center gap-1.5 text-xs text-stone-300">
                  <span className="sr-only">Personaje predefinido</span>
                  <select value={presetId} onChange={e => addPreset(e.target.value)} className="bg-[#1a1523] border border-stone-700 rounded-lg px-2 py-2 text-xs text-stone-200">
                    <option value="">Predefinido…</option>
                    {PRESET_CHARACTERS.map(p => <option key={p.id} value={p.id}>{p.avatar} {p.name} ({p.class})</option>)}
                  </select>
                </label>
              </div>
            </div>
          )}

          {members.length > 1 && !origins && (
            <p className="text-xs text-stone-400">El oro inicial de todos va a una bolsa común del grupo: {formatCoins(purse)}.</p>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t border-amber-950/60 bg-[#120f18] px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={start}
            disabled={!members.length || (origins && drawing)}
            className="px-5 py-2.5 rounded-xl text-sm font-cinzel font-bold flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-stone-950 shadow-lg shadow-amber-900/40 disabled:opacity-40"
          >
            <Swords className="w-4 h-4" /> Comenzar la aventura{members.length > 1 ? ` (${members.length})` : ''}
          </button>
        </div>
      </footer>
    </div>
  );
}
