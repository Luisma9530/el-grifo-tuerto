import { describe, it, expect } from 'vitest';
import {
  cleanRecruitOffer, cleanDeparture, classIdFrom, speciesIdFrom, buildRecruit, makeRecruitOffer, recruitAllowed, departingMember
} from './recruit';
import { localRecruitScene, looksForCompanions } from './localRecruit';
import { createParty, addMember } from './party';
import { parseDMReply, dmResponseSchema, buildDMPrompt } from './dmPrompt';
import { partyBudget, resolveCombatRequest, encounterCandidates, getMonster, XP_BUDGET } from './bestiary';
import { quickHero } from './simulator';
import { XP_FOR_LEVEL } from '../data/progression';

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const hero = (classId = 'fighter', level = 1) => quickHero({ classId, level, rng: seeded(3) });

describe('validating a companion offer from Duncan', () => {
  it('accepts a name and a known class (Spanish, with or without accents)', () => {
    expect(cleanRecruitOffer({ nombre: '  Brena  Hachafría ', clase: 'Clérigo', especie: 'Enana', motivo: 'Busca venganza' }))
      .toEqual({ name: 'Brena Hachafría', classId: 'cleric', speciesId: 'dwarf', reason: 'Busca venganza' });
    expect(classIdFrom('clerigo')).toBe('cleric');
    expect(classIdFrom('Pícara')).toBe('rogue');
    expect(speciesIdFrom('elfa')).toBe('elf');
  });

  it('drops unusable offers and ignores an unknown species', () => {
    expect(cleanRecruitOffer({ nombre: 'X', clase: 'Guerrero' })).toBeNull();
    expect(cleanRecruitOffer({ nombre: 'Brena', clase: 'Astronauta' })).toBeNull();
    expect(cleanRecruitOffer(null)).toBeNull();
    expect(cleanRecruitOffer({ nombre: 'Brena', clase: 'Guerrero', especie: 'Marciana' }).speciesId).toBeNull();
    expect(cleanRecruitOffer({ nombre: 'a'.repeat(80), clase: 'Mago' }).name).toHaveLength(40);
  });

  it('validates departures', () => {
    expect(cleanDeparture({ nombre: 'Brena', motivo: 'Vuelve a su clan' })).toEqual({ name: 'Brena', reason: 'Vuelve a su clan' });
    expect(cleanDeparture({ motivo: 'x' })).toBeNull();
  });

  it('parseDMReply reads "reclutar" and "abandona"', () => {
    const reply = JSON.stringify({
      narracion: 'Una enana se acerca.', usaTirada: false, danio: 0, curacion: 0, oro: 0, experiencia: 0, opciones: ['a'],
      reclutar: { nombre: 'Brena', clase: 'Guerrero' }, abandona: { nombre: 'Tomás' }
    });
    const parsed = parseDMReply(reply, { maxHp: 10, gold: 0 });
    expect(parsed.recruit).toMatchObject({ name: 'Brena', classId: 'fighter' });
    expect(parsed.departure).toMatchObject({ name: 'Tomás' });
    expect(parseDMReply('Texto plano').recruit).toBeNull();
  });

  it('the schema asks for them only when allowed', () => {
    expect(dmResponseSchema(false, false, false).properties.reclutar).toBeUndefined();
    const schema = dmResponseSchema(false, false, false, { allowRecruit: true, allowDeparture: true });
    expect(schema.properties.reclutar.properties.clase.enum).toContain('Clérigo');
    expect(schema.properties.abandona).toBeDefined();
  });
});

describe('the game builds the companion with the rules', () => {
  it('a hero of that class and species, at the party level, with starting gear and no gold', () => {
    const recruit = buildRecruit({ name: 'Brena', classId: 'cleric', speciesId: 'dwarf', reason: 'Busca venganza.' }, { level: 3, rng: seeded(11) });
    expect(recruit).toMatchObject({ name: 'Brena', classId: 'cleric', speciesId: 'dwarf', level: 3, gold: 0, rulesVersion: 'srd-5.2' });
    expect(recruit.hp).toBe(recruit.maxHp);
    expect(recruit.xp).toBeGreaterThanOrEqual(XP_FOR_LEVEL[3]);
    expect(recruit.inventory.length).toBeGreaterThan(0);
    expect(recruit.spellcasting).toBeTruthy();
    expect(recruit.backstory).toContain('Busca venganza.');
  });

  it('an offer joins at the average level of the party; never when full or already a member', () => {
    let party = createParty([hero('fighter', 2), hero('wizard', 4)]);
    const offer = makeRecruitOffer({ name: 'Brena', classId: 'rogue', speciesId: null }, party, { rng: seeded(5) });
    expect(offer.character.level).toBe(3);
    expect(recruitAllowed(party, { name: party.members[0].name })).toBe(false);
    party = addMember(party, offer.character).party;
    party = addMember(party, hero('bard')).party;
    expect(makeRecruitOffer({ name: 'Otra', classId: 'rogue' }, party)).toBeNull();
  });

  it('a departure names a member, never the last one', () => {
    const party = createParty([hero('fighter'), { ...hero('wizard'), name: 'Tomás' }]);
    expect(departingMember(party, { name: 'tomás' })?.name).toBe('Tomás');
    expect(departingMember(createParty([hero()]), { name: hero().name })).toBeNull();
  });
});

describe('the local engine offers companions', () => {
  it('when the party looks for someone to join', () => {
    expect(looksForCompanions('busco compañeros de viaje')).toBe(true);
    expect(looksForCompanions('ataco al orco')).toBe(false);
    const scene = localRecruitScene('quiero reclutar a alguien', { character: { name: 'Brega' }, partyNames: ['Brega'], partySize: 1, rng: seeded(2) });
    expect(scene.text).toContain('Brega');
    expect(scene.recruit).toMatchObject({ classId: expect.any(String), name: expect.any(String) });
    expect(localRecruitScene('quiero reclutar a alguien', { character: {}, partySize: 4 })).toBeNull();
  });
});

describe('encounters sized to the party', () => {
  it('adds up the XP budget of each character, as the SRD says', () => {
    expect(partyBudget(3)).toEqual(XP_BUDGET[3]);
    expect(partyBudget([3, 3, 2])).toEqual([150 + 150 + 100, 225 + 225 + 150, 400 + 400 + 200]);
    expect(encounterCandidates([2, 2, 2, 2]).budget.moderate).toBe(600);
    expect(encounterCandidates([2, 2, 2, 2]).partySize).toBe(4);
  });

  it('trims Duncan\'s fights to the deadly budget of the whole party', () => {
    const request = { enemigos: [{ id: 'scout', cantidad: 6 }] };
    const solo = resolveCombatRequest(request, 1);
    const four = resolveCombatRequest(request, [1, 1, 1, 1]);
    expect(solo[0].count).toBeLessThan(four[0].count);
    expect(solo[0].count).toBe(1);
    expect(four[0].count).toBe(6);
    expect(getMonster('scout')).toBeTruthy();
  });

  it('Duncan knows who acts and who the companions are', () => {
    const party = createParty([hero('fighter'), { ...hero('wizard'), name: 'Tomás' }]);
    const prompt = buildDMPrompt({
      playerAction: 'Miro alrededor', character: { ...party.members[1], gold: party.gold }, world: { name: 'Mundo', initialLocation: 'Taberna' },
      history: [{ sender: 'player', actor: party.members[0].name, text: 'Hola' }], d20: 10,
      companions: 'Brega (Orco Guerrero nivel 1, 12/12 PG, CA 16)', partySize: 2, allowRecruit: true, bestiary: { creatures: [], budget: { low: 1, moderate: 2, high: 3 } }
    });
    expect(prompt).toContain('Actúa ahora: Tomás');
    expect(prompt).toContain('Brega (Orco Guerrero');
    expect(prompt).toContain('Para el grupo de 2');
    expect(prompt).toContain('"reclutar"');
    expect(prompt).toContain(`${party.members[0].name}: Hola`);
  });
});
