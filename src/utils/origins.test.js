import { describe, it, expect } from 'vitest';
import { PRESET_WORLDS, PRESET_CHARACTERS } from '../data/gameData';
import { START_ZONES } from '../data/startZones';
import { BACKGROUNDS, SPECIES } from '../data/srd';
import { SETTLEMENTS } from './shops';
import {
  speciesOf, backgroundOf, suggestZone, zonesFor, worldZones, templateZones, prepareWorld, meetingNodeOf,
  startFromOrigins, parseZonesReply, cleanMeetingHook, localHook, narrateMeeting, fitLabel, MIN_ZONES
} from './origins';
import { isSplit, groupsOf, sceneMessages } from './splitParty';

const hero = (over = {}) => ({ id: over.id || 'h1', name: 'Hero', race: 'Humano', class: 'Guerrero (Nivel 1)', hp: 10, maxHp: 10, ac: 12, gold: 10, inventory: [], stats: {}, ...over });

describe('zonas de inicio de los mundos predefinidos', () => {
  it('cada mundo tiene al menos 4 zonas con su asentamiento', () => {
    PRESET_WORLDS.forEach(world => {
      const zones = START_ZONES[world.id];
      expect(zones.length).toBeGreaterThanOrEqual(MIN_ZONES);
      zones.forEach(z => {
        expect(SETTLEMENTS[z.settlement]).toBeTruthy();
        expect(z.intro.length).toBeGreaterThan(40);
        expect(world.mapNodes.some(n => n.id === z.id)).toBe(false);
      });
    });
  });

  it('todos los trasfondos y especies encajan en alguna zona de cada mundo', () => {
    PRESET_WORLDS.forEach(world => {
      const zones = START_ZONES[world.id];
      BACKGROUNDS.forEach(b => expect(zones.some(z => z.backgrounds.includes(b.id)), `${world.id}: ${b.id}`).toBe(true));
      SPECIES.forEach(s => expect(zones.some(z => z.species.includes(s.id)), `${world.id}: ${s.id}`).toBe(true));
    });
  });
});

describe('asignación por origen', () => {
  const zones = START_ZONES.oakhaven;

  it('un enano herrero va a la ciudad minera y un acólito al monasterio', () => {
    expect(suggestZone(hero({ speciesId: 'dwarf', backgroundId: 'smith' }), zones).id).toBe('zone-hierro');
    expect(suggestZone(hero({ speciesId: 'human', backgroundId: 'acolyte' }), zones).id).toBe('zone-campana');
    expect(suggestZone(hero({ speciesId: 'elf', backgroundId: 'poacher' }), zones).id).toBe('zone-sauces');
  });

  it('el trasfondo pesa más que la especie', () => {
    // Elfo criminal: el barrio del puente (trasfondo) antes que el bosque (especie)
    expect(suggestZone(hero({ speciesId: 'elf', backgroundId: 'criminal' }), zones).id).toBe('zone-puente');
  });

  it('adivina especie y trasfondo de los personajes predefinidos', () => {
    const [kaelen, brog, lyra, valeria] = PRESET_CHARACTERS;
    expect(speciesOf(kaelen)).toBe('elf');
    expect(speciesOf(brog)).toBe('orc');
    expect(speciesOf(lyra)).toBe('human');
    expect(backgroundOf(kaelen)).toBe('criminal');
    expect(backgroundOf(lyra)).toBe('sage');
    expect(backgroundOf(valeria)).toBe('acolyte');
    expect(suggestZone(valeria, zones).id).toBe('zone-campana');
  });

  it('dice por qué encaja', () => {
    expect(fitLabel(hero({ speciesId: 'dwarf', backgroundId: 'smith' }), zones[2])).toBe('Aprendiz de Herrero · Enano');
  });
});

describe('mundos de la Forja', () => {
  const forged = { id: 'custom_1', name: 'Tierra de Sal', genre: 'Western', mapNodes: [{ id: 'tavern', name: 'La Vieja Posada', settlement: 'tavern', status: 'current', x: 25, y: 50 }] };

  it('sin zonas propias usa la plantilla genérica', () => {
    expect(worldZones(forged)).toEqual([]);
    const zones = zonesFor(forged);
    expect(zones).toHaveLength(4);
    expect(zones.map(z => z.id)).toEqual(templateZones(forged).map(z => z.id));
  });

  it('valida las zonas que propone Duncan y descarta las inválidas', () => {
    const reply = JSON.stringify({
      zonas: [
        { nombre: 'Pozo Amargo', tipo: 'aldea', descripcion: 'Un pozo.', intro: 'El pozo se ha secado.', trasfondos: ['poacher', 'hacker'], especies: ['elf'] },
        { nombre: 'Fuerte Ceniza', tipo: 'ciudad', descripcion: 'Un fuerte.', intro: 'Llegan los bandidos.', trasfondos: ['soldier'], especies: ['orc'] },
        { nombre: 'Misión de San Polvo', tipo: 'pueblo', descripcion: 'Una misión.', intro: 'El cura ha desaparecido.', trasfondos: ['acolyte'], especies: ['human'] },
        { nombre: 'La Vieja Posada', tipo: 'pueblo', descripcion: 'Repetida.', intro: 'x', trasfondos: ['innkeeper'], especies: [] },
        { nombre: 'Barranco del Cuervo', tipo: 'nave', descripcion: 'Un barranco.', intro: 'Hay oro en el barranco.', trasfondos: ['criminal'], especies: ['tiefling'] }
      ]
    });
    const zones = parseZonesReply(reply, forged);
    expect(zones.map(z => z.name)).toEqual(['Pozo Amargo', 'Fuerte Ceniza', 'Misión de San Polvo', 'Barranco del Cuervo']);
    expect(zones[0].backgrounds).toEqual(['poacher']);
    expect(zones[3].settlement).toBe('village');
    expect(parseZonesReply('{"zonas": []}', forged)).toBeNull();
    expect(parseZonesReply('no es json', forged)).toBeNull();
  });

  it('las zonas se añaden al mapa como asentamientos descubiertos, sin repetir', () => {
    const world = prepareWorld(forged, templateZones(forged));
    expect(world.mapNodes).toHaveLength(5);
    expect(world.mapNodes.filter(n => n.zone).every(n => n.status === 'discovered')).toBe(true);
    expect(prepareWorld(world, world.startZones).mapNodes).toHaveLength(5);
    expect(meetingNodeOf(world, world.startZones)).toBe('tavern');
  });
});

describe('empezar cada uno desde su origen', () => {
  const world = PRESET_WORLDS[0];
  const dwarf = hero({ id: 'a', name: 'Durin', speciesId: 'dwarf', backgroundId: 'smith', gold: 15 });
  const monk = hero({ id: 'b', name: 'Sor Ana', speciesId: 'human', backgroundId: 'acolyte', gold: 8 });

  it('cada uno en su zona sugerida, con su propia bolsa y su crónica', () => {
    const start = startFromOrigins(world, [dwarf, monk]);
    expect(isSplit(start.party)).toBe(true);
    const groups = groupsOf(start.party);
    expect(groups.map(g => g.nodeId)).toEqual(['zone-hierro', 'zone-campana']);
    expect(groups.map(g => g.gold)).toEqual([15, 8]);
    expect(start.party.startMode).toBe('origins');
    expect(start.party.split.meetingNodeId).toBe('tavern');
    expect(start.messages).toHaveLength(2);
    expect(sceneMessages(start.messages, groups[0].id)[0].text).toContain('Minas de Hierro Viejo');
    expect(sceneMessages(start.messages, null)).toHaveLength(0);
    expect(groups[0].suggestions.length).toBeGreaterThan(0);
    expect(start.world.mapNodes.some(n => n.id === 'zone-hierro')).toBe(true);
  });

  it('el jugador puede elegir otra zona; si eligen la misma empiezan juntos', () => {
    const start = startFromOrigins(world, [dwarf, monk], ['zone-puente', 'zone-puente']);
    expect(isSplit(start.party)).toBe(false);
    expect(start.party.gold).toBe(23);
    expect(start.world.mapNodes.find(n => n.status === 'current').id).toBe('zone-puente');
    expect(start.messages).toHaveLength(1);
    expect(start.messages[0].groupId).toBeUndefined();
  });
});

describe('motivos para ir al punto de encuentro', () => {
  it('valida el campo «reunion» de Duncan', () => {
    expect(cleanMeetingHook({ tipo: 'rumor', motivo: 'Dicen que en la taberna buscan gente.' })).toEqual({ kind: 'rumor', text: 'Dicen que en la taberna buscan gente.' });
    expect(cleanMeetingHook({ tipo: 'orden', motivo: 'Ve a la taberna ya.' })).toBeNull();
    expect(cleanMeetingHook({ tipo: 'mision', motivo: 'corto' })).toBeNull();
    expect(cleanMeetingHook(null)).toBeNull();
    expect(cleanMeetingHook({ tipo: 'encargo', motivo: 'x'.repeat(500) }).text).toHaveLength(240);
  });

  it('el motor local da un motivo con el destino', () => {
    const hook = localHook('Durin', 'Taberna del Jabalí', () => 0);
    expect(hook.kind).toBe('encargo');
    expect(hook.text).toContain('Taberna del Jabalí');
  });

  it('el motor local narra el encuentro con los motivos de cada uno', () => {
    const { text, suggestedActions } = narrateMeeting({
      joined: [{ names: 'Durin', hook: { kind: 'rumor', text: 'Oyó hablar de la taberna.' } }, { names: 'Sor Ana', hook: null }],
      place: 'Taberna del Jabalí', world: PRESET_WORLDS[0]
    });
    expect(text).toContain('Durin');
    expect(text).toContain('Sor Ana');
    expect(text).toContain('Taberna del Jabalí');
    expect(suggestedActions.length).toBeGreaterThan(2);
  });
});
