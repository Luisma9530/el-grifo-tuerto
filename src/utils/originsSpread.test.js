import { describe, it, expect } from 'vitest';
import { PRESET_WORLDS } from '../data/gameData';
import { START_ZONES } from '../data/startZones';
import { BACKGROUNDS, SPECIES } from '../data/srd';
import { buildCharacter, randomDraft } from './characterBuilder';
import { startFromOrigins, suggestZones, templateZones } from './origins';
import { groupsOf } from './splitParty';

// Luisma created 4 characters and all of them started in the same zone: four
// characters of different origins must start in four different zones

const hero = (id, backgroundId, speciesId) => ({ id, name: id, race: '', class: 'Guerrero', hp: 10, maxHp: 10, ac: 12, gold: 10, inventory: [], stats: {}, backgroundId, speciesId });

describe('cuatro personajes de orígenes distintos', () => {
  const four = [
    hero('Durin', 'smith', 'dwarf'),
    hero('Sor Ana', 'acolyte', 'human'),
    hero('Lirael', 'poacher', 'elf'),
    hero('Zaz', 'criminal', 'tiefling')
  ];

  it('en Oakhaven empiezan en cuatro zonas distintas', () => {
    const start = startFromOrigins(PRESET_WORLDS[0], four);
    const groups = groupsOf(start.party);
    expect(groups).toHaveLength(4);
    expect(groups.map(g => g.nodeId)).toEqual(['zone-hierro', 'zone-campana', 'zone-sauces', 'zone-puente']);
    expect(start.messages).toHaveLength(4);
  });

  it('en cada mundo predefinido se reparten (al menos tres zonas distintas)', () => {
    PRESET_WORLDS.forEach(world => {
      const start = startFromOrigins(world, four);
      expect(new Set(groupsOf(start.party).map(g => g.nodeId)).size, world.id).toBeGreaterThanOrEqual(3);
    });
  });

  it('el jugador puede elegir otra zona para cualquiera', () => {
    const start = startFromOrigins(PRESET_WORLDS[0], four, [null, null, 'zone-hierro', null]);
    const zones = groupsOf(start.party).map(g => g.nodeId);
    expect(zones).toContain('zone-hierro');
    expect(zones).not.toContain('zone-sauces');
    expect(groupsOf(start.party).find(g => g.nodeId === 'zone-hierro').memberIds).toHaveLength(2);
  });
});

describe('desempate al sugerir', () => {
  it('entre zonas que encajan igual, se reparte', () => {
    // Dos sabios humanos: el monasterio y el archivo encajan igual en el Arrecife (sabio)
    const zones = START_ZONES['sunken-abyss'];
    const two = suggestZones([hero('a', 'sage', 'goliath'), hero('b', 'sage', 'goliath')], zones);
    expect(two[0].id).not.toBe(two[1].id);
  });

  it('si una zona es claramente la suya, los del mismo origen la comparten', () => {
    const zones = START_ZONES.oakhaven;
    const two = suggestZones([hero('a', 'smith', 'dwarf'), hero('b', 'smith', 'dwarf')], zones);
    expect(two.map(z => z.id)).toEqual(['zone-hierro', 'zone-hierro']);
  });
});

describe('los campos de origen de cada personaje', () => {
  it('el héroe al azar y el asistente guardan trasfondo y especie', () => {
    for (let i = 0; i < 30; i++) {
      const c = buildCharacter(randomDraft());
      expect(BACKGROUNDS.some(b => b.id === c.backgroundId)).toBe(true);
      expect(SPECIES.some(s => s.id === c.speciesId)).toBe(true);
    }
  });

  it('la plantilla de la Forja cubre todos los trasfondos y especies', () => {
    const zones = templateZones({ name: 'Mundo', genre: 'Western' });
    BACKGROUNDS.forEach(b => expect(zones.some(z => z.backgrounds.includes(b.id)), b.id).toBe(true));
    SPECIES.forEach(s => expect(zones.some(z => z.species.includes(s.id)), s.id).toBe(true));
  });
});
