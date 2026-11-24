// Starting zones by origin: which zones a world has, which one fits a
// character (by background and species of the 2024 rules), how the map and the
// chronicle of a campaign that starts "cada uno desde su origen" look, the
// reasons Duncan or the local engine give each group to go to the meeting point,
// and how the local engine narrates the meeting.
//
// Pure functions except `generateZonesWithAI` (it asks Gemini).

import { BACKGROUNDS, SPECIES } from '../data/srd';
import { presetZones } from '../data/startZones';
import { SETTLEMENTS } from './shops';
import { createParty } from './party';
import { startApart, HOOK_KINDS, joinNames, groupsOf, groupOf, groupNames } from './splitParty';
import { requestGemini } from './geminiClient';

export const START_MODES = { together: 'together', origins: 'origins' };
export const MIN_ZONES = 4;
const MAX_ZONES = 6;
const BACKGROUND_IDS = BACKGROUNDS.map(b => b.id);
const SPECIES_IDS = SPECIES.map(s => s.id);
const HOOK_MAX = 240;

// Where the zones of a forged world go on its map (percent), away from its own nodes
const ZONE_SLOTS = [{ x: 10, y: 18 }, { x: 12, y: 84 }, { x: 62, y: 12 }, { x: 88, y: 86 }, { x: 40, y: 88 }, { x: 90, y: 14 }];

// ---------------------------------------------------------------- the character's origin

const SPECIES_WORDS = [
  ['dragonborn', /drac[oó]nid|dragon/i], ['dwarf', /enan/i], ['gnome', /gnom/i], ['goliath', /goliat/i],
  ['halfling', /median/i], ['orc', /orc/i], ['tiefling', /tiefling/i], ['elf', /elf/i], ['human', /human/i]
];
// Characters without a background of the 2024 rules (the presets): the closest one by class
const CLASS_BACKGROUND = [
  [/p[ií]car/i, 'criminal'], [/b[aá]rbar/i, 'poacher'], [/explorador/i, 'poacher'], [/druid/i, 'poacher'],
  [/mag[oa]|brujo|hechicer/i, 'sage'], [/palad[ií]n|cl[eé]rig|monj/i, 'acolyte'], [/guerrer/i, 'soldier'], [/bard/i, 'minstrel']
];

/** The species id of a character (its own `speciesId`, or guessed from the race's name). */
export function speciesOf(character) {
  if (SPECIES_IDS.includes(character?.speciesId)) return character.speciesId;
  const race = String(character?.race || '');
  return SPECIES_WORDS.find(([, words]) => words.test(race))?.[0] || null;
}

/** The background id of a character (its own, by name, or the closest one to its class). */
export function backgroundOf(character) {
  if (BACKGROUND_IDS.includes(character?.backgroundId)) return character.backgroundId;
  const byName = BACKGROUNDS.find(b => b.name.toLowerCase() === String(character?.background || '').toLowerCase());
  if (byName) return byName.id;
  const cls = `${character?.className || ''} ${character?.class || ''}`;
  return CLASS_BACKGROUND.find(([words]) => words.test(cls))?.[1] || null;
}

/** How well a zone fits a character: 2 for the background, 1 for the species. */
export function zoneScore(character, zone) {
  const bg = backgroundOf(character);
  const sp = speciesOf(character);
  return (bg && zone.backgrounds?.includes(bg) ? 2 : 0) + (sp && zone.species?.includes(sp) ? 1 : 0);
}

/** The zone that fits a character best (the first one of the list on a tie). */
export function suggestZone(character, zones) {
  if (!zones?.length) return null;
  return zones.reduce((best, zone) => (zoneScore(character, zone) > zoneScore(character, best) ? zone : best), zones[0]);
}

/** Why a zone fits: "Acólito · Humano" (what of the character matches it), or ''. */
export function fitLabel(character, zone) {
  const bg = backgroundOf(character);
  const sp = speciesOf(character);
  return [
    bg && zone.backgrounds?.includes(bg) ? BACKGROUNDS.find(b => b.id === bg)?.name : null,
    sp && zone.species?.includes(sp) ? SPECIES.find(s => s.id === sp)?.name : null
  ].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- zones of a world

const cleanList = (list, known) => [...new Set((Array.isArray(list) ? list : []).filter(id => known.includes(id)))];
const text = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** A zone checked (from the data, a saved world or the AI); null when unusable. */
export function cleanZone(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const name = text(raw.name, 60);
  if (!name) return null;
  const slot = ZONE_SLOTS[index % ZONE_SLOTS.length];
  const num = (v, d) => (Number.isFinite(Number(v)) ? Math.min(95, Math.max(5, Number(v))) : d);
  return {
    id: text(raw.id, 40) || `zone-${index + 1}`,
    name,
    settlement: SETTLEMENTS[raw.settlement] && raw.settlement !== 'tavern' ? raw.settlement : 'village',
    x: num(raw.x, slot.x),
    y: num(raw.y, slot.y),
    desc: text(raw.desc, 160),
    backgrounds: cleanList(raw.backgrounds, BACKGROUND_IDS),
    species: cleanList(raw.species, SPECIES_IDS),
    intro: text(raw.intro, 600),
    suggestions: (Array.isArray(raw.suggestions) ? raw.suggestions : []).map(s => text(s, 80)).filter(Boolean).slice(0, 4)
  };
}

const cleanZones = list => {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((z, i) => {
    const zone = cleanZone(z, i);
    if (zone && !out.some(o => o.id === zone.id || o.name === zone.name)) out.push(zone);
  });
  return out.slice(0, MAX_ZONES);
};

/**
 * Zones for a forged world without AI: four generic places, one per kind of
 * origin, named after the world.
 */
export function templateZones(world) {
  const where = world?.name || 'estas tierras';
  const genre = String(world?.genre || 'fantasía').toLowerCase();
  return cleanZones([
    {
      id: 'zone-santuario', name: 'Santuario del Alba', settlement: 'village',
      desc: `Un lugar de culto y estudio en los márgenes de ${where}.`,
      backgrounds: ['acolyte', 'sage'], species: ['human', 'dragonborn', 'tiefling'],
      intro: `En el Santuario del Alba los textos antiguos hablan de un presagio que se cumple hoy: una señal en el cielo de ${where} que nadie sabe leer del todo.`,
      suggestions: ['Estudiar la señal en los textos', 'Hablar con el guardián del santuario', 'Rezar y esperar una respuesta', 'Salir a preguntar a los peregrinos']
    },
    {
      id: 'zone-artesanos', name: 'Barrio de los Artesanos', settlement: 'town',
      desc: 'Talleres, forjas y cuarteles donde se fabrica y se defiende todo lo que importa.',
      backgrounds: ['smith', 'soldier', 'innkeeper'], species: ['dwarf', 'gnome', 'goliath'],
      intro: `En el Barrio de los Artesanos el trabajo no para, pero hoy un encargo de la guarnición ha desaparecido del taller y alguien tendrá que responder por él antes del anochecer.`,
      suggestions: ['Buscar el encargo desaparecido', 'Interrogar a los aprendices', 'Hablar con el sargento de la guarnición', 'Revisar las herramientas del taller']
    },
    {
      id: 'zone-linde', name: 'Aldea del Linde Salvaje', settlement: 'village',
      desc: 'Cazadores, recolectores y cantores en el borde de la espesura.',
      backgrounds: ['poacher', 'minstrel'], species: ['elf', 'halfling'],
      intro: `En el linde salvaje los animales huyen hacia la aldea como si algo los empujara. Los ancianos dicen que no pasaba desde hace generaciones en ${where}.`,
      suggestions: ['Seguir el rastro de los animales', 'Hablar con los ancianos', 'Montar guardia en la empalizada', 'Cantar junto al fuego y escuchar']
    },
    {
      id: 'zone-bajos', name: 'Los Bajos Fondos', settlement: 'city',
      desc: `Callejones, mercados negros y tabernas donde se cruza lo peor y lo mejor de ${where}.`,
      backgrounds: ['criminal', 'minstrel', 'innkeeper'], species: ['human', 'orc', 'tiefling', 'halfling'],
      intro: `En los bajos fondos todo tiene precio. Esta noche un viejo conocido te debe un favor, otro te busca para cobrarse una deuda, y en el aire de este rincón de ${genre} huele a problemas.`,
      suggestions: ['Buscar al que te debe un favor', 'Esconderse de quien te busca', 'Escuchar rumores en una taberna', 'Hacer un trabajito rápido']
    }
  ]);
}

/** The starting zones of a world: its own (forged or saved), the preset ones, or none. */
export function worldZones(world) {
  const own = cleanZones(world?.startZones);
  if (own.length >= MIN_ZONES) return own;
  return presetZones(world?.id);
}

/** Zones always available for a world: its own, the preset ones, or the generic template. */
export const zonesFor = world => {
  const zones = worldZones(world);
  return zones.length >= MIN_ZONES ? zones : templateZones(world);
};

/** The common place where the groups meet: Duncan's tavern, else the first node that is no zone. */
export function meetingNodeOf(world, zones = []) {
  const nodes = world?.mapNodes || [];
  const zoneIds = new Set(zones.map(z => z.id));
  const free = nodes.filter(n => !zoneIds.has(n.id));
  return (free.find(n => n.settlement === 'tavern' || n.id === 'tavern') || free.find(n => n.status === 'current') || free[0] || null)?.id || null;
}

/**
 * The world of a new campaign with its starting zones on the map (as
 * discovered settlements) and kept in `startZones`. Zones already on the map
 * are not added twice.
 */
export function prepareWorld(world, zones) {
  const list = cleanZones(zones);
  if (!list.length) return world;
  const taken = new Set((world.mapNodes || []).map(n => n.id));
  const nodes = list.filter(z => !taken.has(z.id)).map(z => ({
    id: z.id, name: z.name, settlement: z.settlement, status: 'discovered', x: z.x, y: z.y, desc: z.desc, zone: true
  }));
  return { ...world, startZones: list, mapNodes: [...(world.mapNodes || []), ...nodes] };
}

// ---------------------------------------------------------------- the opening of the campaign

const bgName = character => BACKGROUNDS.find(b => b.id === backgroundOf(character))?.name || '';

/** Duncan's opening of a scene in a starting zone. */
export function zoneIntro(zone, members, world) {
  const names = members.map(m => m.name);
  const many = names.length > 1;
  const who = members.map(m => `**${m.name}**${bgName(m) ? ` (${bgName(m).toLowerCase()})` : ''}`);
  return `*(Maese Duncan da una calada a la pipa: esta historia no empieza en su taberna, sino lejos de ella, en ${world?.name || 'estas tierras'}.)*

**${zone.name}.** ${zone.desc ? `${zone.desc} ` : ''}${zone.intro || ''}

Aquí ${many ? 'empezáis' : 'empieza'} ${joinNames(who)}, en ${many ? 'vuestra' : 'su'} tierra, entre gente que ${many ? 'os conoce' : 'le conoce'} de siempre.

—*${many ? 'Cada cosa a su tiempo, muchachos' : `Cada cosa a su tiempo, ${names[0]}`}. Los caminos se cruzan cuando tienen que cruzarse. ¿Qué ${many ? 'hacéis' : 'haces'}?*`;
}

/**
 * Everything a campaign that starts apart needs.
 * @param characters the characters made for it (with their starting gold)
 * @param choices    zone id for each character (same order); missing: the suggested one
 * @returns {{ party, world, messages, suggestedActions }}
 */
export function startFromOrigins(world, characters, choices = [], zones = zonesFor(world)) {
  const prepared = prepareWorld(world, zones);
  const list = prepared.startZones || [];
  const party = createParty(characters);
  const assignments = {};
  const gold = {};
  party.members.forEach((m, i) => {
    const wanted = list.find(z => z.id === choices[i]);
    assignments[m.id] = (wanted || suggestZone(characters[i], list))?.id || null;
    gold[m.id] = Number(characters[i]?.gold) || 0;
  });
  const meetingNodeId = meetingNodeOf(prepared, list);
  const apart = startApart(party, assignments, { gold, meetingNodeId });
  const groups = apart.split?.groups || [{ id: null, memberIds: party.members.map(m => m.id), nodeId: assignments[party.members[0].id] }];
  const messages = groups.map(g => {
    const zone = list.find(z => z.id === g.nodeId);
    const members = apart.members.filter(m => g.memberIds.includes(m.id));
    return { sender: 'duncan', text: zoneIntro(zone || { name: prepared.initialLocation || 'El camino' }, members, prepared), timestamp: 'Inicio de Campaña', ...(g.id ? { groupId: g.id } : {}) };
  });
  // Each group starts in its zone; everyone together (all chose the same one): the party is there
  let next = apart;
  if (next.split) {
    next = { ...next, split: { ...next.split, groups: next.split.groups.map(g => ({ ...g, suggestions: list.find(z => z.id === g.nodeId)?.suggestions || [] })) } };
  }
  const startNode = groups[0].nodeId;
  const finalWorld = next.split ? prepared : {
    ...prepared,
    mapNodes: prepared.mapNodes.map(n => (n.id === startNode ? { ...n, status: 'current' } : n.status === 'current' ? { ...n, status: 'discovered' } : n))
  };
  const firstZone = list.find(z => z.id === startNode);
  return { party: next, world: finalWorld, messages, suggestedActions: firstZone?.suggestions || [] };
}

// ---------------------------------------------------------------- zones made by Duncan (forged worlds)

const TYPE_TO_SETTLEMENT = { aldea: 'village', pueblo: 'town', puerto: 'port', ciudad: 'city' };

export const ZONES_SCHEMA = {
  type: 'OBJECT',
  properties: {
    zonas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nombre: { type: 'STRING' },
          tipo: { type: 'STRING', enum: Object.keys(TYPE_TO_SETTLEMENT) },
          descripcion: { type: 'STRING' },
          intro: { type: 'STRING' },
          trasfondos: { type: 'ARRAY', items: { type: 'STRING', enum: BACKGROUND_IDS } },
          especies: { type: 'ARRAY', items: { type: 'STRING', enum: SPECIES_IDS } },
          opciones: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['nombre', 'tipo', 'descripcion', 'intro', 'trasfondos', 'especies']
      }
    }
  },
  required: ['zonas']
};

/** The prompt that asks Duncan for the starting zones of a forged world. */
export function buildZonesPrompt(world) {
  const bgs = BACKGROUNDS.map(b => `${b.id} (${b.name})`).join(', ');
  const sps = SPECIES.map(s => `${s.id} (${s.name})`).join(', ');
  const nodes = (world?.mapNodes || []).map(n => n.name).join(', ');
  return `Eres Maese Duncan, Dungeon Master. Diseña ${MIN_ZONES} zonas de inicio para el mundo de rol "${world?.name || 'Mundo propio'}" (${world?.genre || 'fantasía'}).
Descripción del mundo: ${world?.description || world?.tagline || 'sin descripción'}.${nodes ? `\nLugares que ya existen en el mapa (no los repitas): ${nodes}.` : ''}
Cada zona es un pueblo o asentamiento donde puede empezar un personaje según su origen, acorde con el tono del mundo. Para cada una:
- "nombre": nombre propio y evocador (máximo 50 caracteres).
- "tipo": aldea, pueblo, puerto o ciudad.
- "descripcion": una frase.
- "intro": 2 o 3 frases que planteen un problema inmediato allí (en segunda persona del plural o neutra).
- "trasfondos": los que encajan, de estos ids: ${bgs}.
- "especies": las que encajan, de estos ids: ${sps}.
- "opciones": 3 o 4 primeras acciones breves.
Entre todas las zonas, que cada trasfondo y cada especie encaje en al menos una. Todo en español. Responde solo con el JSON.`;
}

/** The zones in Duncan's reply, checked; null when there are not enough usable ones. */
export function parseZonesReply(raw, world) {
  let data;
  try {
    data = JSON.parse(String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    return null;
  }
  const taken = new Set((world?.mapNodes || []).map(n => String(n.name).toLowerCase()));
  const zones = cleanZones((Array.isArray(data?.zonas) ? data.zonas : []).map((z, i) => ({
    id: `zone-ia-${i + 1}`,
    name: z?.nombre,
    settlement: TYPE_TO_SETTLEMENT[z?.tipo],
    desc: z?.descripcion,
    intro: z?.intro,
    backgrounds: z?.trasfondos,
    species: z?.especies,
    suggestions: z?.opciones
  })).filter(z => typeof z.name === 'string' && !taken.has(z.name.trim().toLowerCase())));
  const usable = zones.filter(z => z.intro && (z.backgrounds.length || z.species.length));
  return usable.length >= MIN_ZONES ? usable : null;
}

/** Ask Gemini for the zones of a forged world. Null when it fails (the template is used). */
export async function generateZonesWithAI(world, key) {
  if (!key) return null;
  try {
    const reply = await requestGemini(key, {
      prompt: buildZonesPrompt(world),
      generationConfig: { responseMimeType: 'application/json', responseSchema: ZONES_SCHEMA }
    });
    return reply.ok ? parseZonesReply(reply.text, world) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- the reason to go to the meeting point

/** The reason in Duncan's reply ("reunion"): { tipo, motivo } → { kind, text }, or null. */
export function cleanMeetingHook(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = HOOK_KINDS.includes(raw.tipo) ? raw.tipo : null;
  const hookText = text(raw.motivo, HOOK_MAX);
  return kind && hookText.length >= 8 ? { kind, text: hookText } : null;
}

const LOCAL_HOOKS = [
  { kind: 'encargo', text: (names, place) => `Un mensajero sin aliento entrega a ${names} una carta lacrada: alguien paga bien por llevar un paquete a ${place} y entregarlo en mano a Maese Duncan.` },
  { kind: 'rumor', text: (names, place) => `Un viajero cuenta a ${names}, entre trago y trago, que en ${place} se está reuniendo gente con preguntas parecidas a las suyas... y que allí alguien tiene respuestas.` },
  { kind: 'mision', text: (names, place) => `En el tablón de la plaza, un aviso con el sello de ${place} pide ayuda urgente: «Se buscan valientes. Presentarse ante Maese Duncan». ${names} reconoce algo familiar en esa letra.` }
];

const HOOK_LABELS = { mision: 'Misión', rumor: 'Rumor', encargo: 'Encargo' };
export const hookLabel = kind => HOOK_LABELS[kind] || 'Motivo';

/** A reason from the local engine to go to the meeting point. */
export function localHook(names, place, rng = Math.random) {
  const pick = LOCAL_HOOKS[Math.floor(rng() * LOCAL_HOOKS.length) % LOCAL_HOOKS.length];
  return { kind: pick.kind, text: pick.text(names || 'el viajero', place || 'la taberna de Duncan') };
}

/** The paragraph added to a narration when a reason arrives. */
export const hookParagraph = (hook, place) => `**${hookLabel(hook.kind)}:** ${hook.text}${place && !hook.text.includes(place) ? ` (Destino: ${place}.)` : ''}`;

// ---------------------------------------------------------------- the meeting

/** The local engine narrates the meeting of groups in a place. */
export function narrateMeeting({ joined = [], place = '', world = null }) {
  const parts = joined.map(j => `**${j.names}**${j.hook ? ` (${hookLabel(j.hook.kind).toLowerCase()}: ${j.hook.text.replace(/\.$/, '')})` : ''}`);
  const all = joined.map(j => j.names);
  return {
    text: `*(Maese Duncan deja la jarra en la barra y sonríe por debajo del parche: lo estaba esperando.)*

En ${place || 'este lugar'} se cruzan por fin caminos que empezaron muy lejos: ${parts.join(' y ')}. Cada uno llegó por su motivo, pero las preguntas se parecen demasiado para ser casualidad.

Las miradas se encuentran, se miden y, tras un silencio incómodo, alguien suelta una carcajada. En ${world?.name || 'estas tierras'} nadie sobrevive mucho tiempo solo.

—*Bueno, bueno* —gruñe Duncan—. *${joinNames(all)}: a partir de ahora, lo que le pase a uno os pasa a todos. ¿Por dónde empezáis?*`,
    suggestedActions: ['Presentarse y contar qué los trajo aquí', 'Comparar las pistas que trae cada uno', 'Pedir una ronda para sellar el trato', 'Preguntar a Duncan qué sabe de todo esto']
  };
}

// ---------------------------------------------------------------- what Duncan is told about the scene

const nodeName = (world, id) => world?.mapNodes?.find(n => n.id === id)?.name || 'otro lugar';

/**
 * The note for Duncan's prompt while the party is apart: who is in this scene,
 * who is elsewhere (and must not appear), where they will meet; or, with
 * `meeting`, the groups that just met here.
 */
export function sceneNoteFor(party, memberId, world, { meeting = null } = {}) {
  const groups = groupsOf(party);
  if (meeting) {
    const who = meeting.joined.map(j => `${j.names}${j.hook ? ` (vino por un ${hookLabel(j.hook.kind).toLowerCase()}: ${j.hook.text.replace(/\.$/, '')})` : ''}`);
    const group = groupOf(party, memberId);
    const still = groups.filter(g => g.id !== group?.id).map(g => `${groupNames(party, g)} (en ${nodeName(world, g.nodeId)})`);
    return `ENCUENTRO: en ${meeting.place} se cruzan por primera vez los caminos de ${joinNames(who)}. Hasta ahora no se conocían ni sabían lo que le pasaba al otro. Narra cómo se encuentran, se miden y deciden seguir juntos como un solo grupo, y que cada uno traiga a la escena el motivo que lo trajo. Esta escena no necesita tirada ni empieza ningún combate.${still.length ? ` Aún faltan por llegar: ${still.join('; ')}.` : ''}`;
  }
  const group = groupOf(party, memberId);
  if (!group) return '';
  const others = groups.filter(g => g.id !== group.id).map(g => `${groupNames(party, g)} (en ${nodeName(world, g.nodeId)})`);
  const meetingName = nodeName(world, party.split.meetingNodeId);
  return `La historia va por separado: esta escena es solo de ${groupNames(party, group)}, en ${nodeName(world, group.nodeId)}. ${joinNames(others)} ${others.length > 1 ? 'están' : 'está'} lejos: no aparecen en esta escena ni saben lo que pasa aquí (no los menciones como presentes). Más adelante la historia juntará a todos en ${meetingName}.${group.hook ? ` Los de esta escena ya tienen un motivo para ir allí: ${group.hook.text}` : ''}`;
}
