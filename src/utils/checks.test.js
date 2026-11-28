import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DC_SCALE, clampDC, dcBand, findCheck, cleanCheckRequest, resolveCheck, resolveOpponent, profileOpponent,
  creatureOpponent, opponentFromText, passiveScore, planLocalCheck, rollTargetSave, targetAC, NPC_PROFILES,
  LOCAL_DC_TABLE, DEFAULT_DC
} from './checks';
import { parseDMReply, DM_RESPONSE_SCHEMA } from './dmPrompt';
import { getMonster, MONSTERS } from './bestiary';
import { generateDMResponse } from './gameEngine';
import { describeCast } from './spellcasting';
import { narrateSpell } from './spellNarration';
import { createCondition } from './conditions';

/** A die that returns these numbers in order (then the last one). */
const dice = (...values) => {
  let i = 0;
  return vi.fn(() => values[Math.min(i++, values.length - 1)]);
};

const hero = {
  name: 'Kaelen', race: 'Elfo', class: 'Pícaro', hp: 20, maxHp: 20, gold: 10, proficiencyBonus: 2,
  stats: { fue: 10, des: 16, con: 12, int: 12, sab: 10, car: 14 },
  skills: ['deception', 'stealth']
};

afterEach(() => vi.restoreAllMocks());

describe('the DC scale of the 2024 rules', () => {
  it('goes from 5 (very easy) to 30 (nearly impossible)', () => {
    expect(DC_SCALE.map(s => s.dc)).toEqual([5, 10, 15, 20, 25, 30]);
    expect(dcBand(15)).toBe('media');
    expect(dcBand(14)).toBe('media');
    expect(dcBand(23)).toBe('muy difícil');
    expect(dcBand(30)).toBe('casi imposible');
  });

  it('clamps the DC to 5-30 and rejects what is not a number', () => {
    expect(clampDC(99)).toBe(30);
    expect(clampDC(2)).toBe(5);
    expect(clampDC('17')).toBe(17);
    expect(clampDC(12.6)).toBe(13);
    expect(clampDC('difícil')).toBeNull();
    expect(clampDC(null)).toBeNull();
  });

  it('finds skills and abilities by Spanish name or id', () => {
    expect(findCheck('Engaño')).toEqual({ skillId: 'deception', ability: 'car', label: 'Engaño' });
    expect(findCheck('engano')).toMatchObject({ skillId: 'deception' });
    expect(findCheck('Fuerza')).toEqual({ skillId: null, ability: 'fue', label: 'Fuerza' });
    expect(findCheck('Telepatía')).toBeNull();
  });
});

describe("Duncan's check field (prueba)", () => {
  const reply = prueba => JSON.stringify({ narracion: 'Le sueltas el cuento.', usaTirada: true, danio: 9, curacion: 0, oro: 0, experiencia: 0, opciones: ['a'], prueba });

  it('is in the response schema, with the skills as an enum and both outcomes required', () => {
    const field = DM_RESPONSE_SCHEMA.properties.prueba;
    expect(field.properties.habilidad.enum).toContain('Perspicacia');
    expect(field.properties.habilidad.enum).toContain('Fuerza');
    expect(field.properties.contra.properties.perfil.enum).toContain('erudito');
    expect(field.required).toEqual(['habilidad', 'exito', 'fallo']);
    expect(DM_RESPONSE_SCHEMA.required).not.toContain('prueba');
  });

  it('validates the skill, clamps the DC and cleans the numbers of each outcome', () => {
    const parsed = parseDMReply(reply({
      habilidad: 'Atletismo', cd: 40,
      exito: { narracion: ' Subes. ', oro: 9999, opciones: ['Mirar', ''] },
      fallo: { narracion: 'Caes.', danio: 500, experiencia: -3 }
    }), hero);
    expect(parsed.check).toMatchObject({ skillId: 'athletics', ability: 'fue', dc: 30, against: null });
    expect(parsed.check.success).toEqual({ text: 'Subes.', damageTaken: 0, healing: 0, goldEarned: 500, xpEarned: 0, suggestedActions: ['Mirar'], conditionChanges: [], limbChanges: [] });
    expect(parsed.check.failure).toMatchObject({ text: 'Caes.', damageTaken: 20, xpEarned: 0, suggestedActions: null });
  });

  it('uses 15 when the DC is missing and drops a check with an unknown skill', () => {
    expect(cleanCheckRequest({ habilidad: 'Historia', exito: {}, fallo: {} }).dc).toBe(DEFAULT_DC);
    expect(cleanCheckRequest({ habilidad: 'Telepatía', cd: 10 })).toBeNull();
    expect(cleanCheckRequest('Engaño')).toBeNull();
    expect(parseDMReply(reply(null), hero).check).toBeNull();
  });

  it('keeps who resists: a profile, a creature id or a name', () => {
    const check = cleanCheckRequest({ habilidad: 'Engaño', cd: 12, contra: { perfil: 'Erudito', nombre: ' Albus ' }, exito: {}, fallo: {} });
    expect(check.against).toEqual({ profile: 'erudito', creature: null, name: 'Albus', skillId: null });
    expect(cleanCheckRequest({ habilidad: 'Sigilo', contra: { criatura: 'guard' }, exito: {}, fallo: {} }).against)
      .toMatchObject({ creature: 'guard', profile: null });
    expect(cleanCheckRequest({ habilidad: 'Sigilo', contra: { criatura: '<script>' }, exito: {}, fallo: {} }).against).toBeNull();
    expect(cleanCheckRequest({ habilidad: 'Sigilo', contra: { perfil: 'dragón' }, exito: {}, fallo: {} }).against).toBeNull();
  });
});

describe('opposed checks', () => {
  it('deceiving a child is easier than deceiving a scholar (their Insight)', () => {
    // Kaelen: Deception +4 (Charisma +2, proficient). Both roll a 10.
    const child = resolveCheck({ character: hero, skillId: 'deception', opponent: profileOpponent('nino'), rollDie: dice(10, 10) });
    const scholar = resolveCheck({ character: hero, skillId: 'deception', opponent: profileOpponent('erudito'), rollDie: dice(10, 10) });
    expect(child).toMatchObject({ total: 14, success: true, dc: null });
    expect(child.versus).toMatchObject({ label: 'Perspicacia', total: 9, passive: false });
    expect(scholar.versus.total).toBe(15);
    expect(scholar.success).toBe(false);
    expect(scholar.text).toBe('Engaño 14 contra Perspicacia del erudito 15');
  });

  it('a tie keeps things as they are: whoever acts fails', () => {
    const tie = resolveCheck({ character: hero, skillId: 'persuasion', opponent: profileOpponent('plebeyo'), rollDie: dice(10, 12) });
    expect(tie.total).toBe(12);
    expect(tie.versus.total).toBe(12);
    expect(tie.success).toBe(false);
  });

  it('hiding goes against passive Perception: 10 + Wisdom for a creature without more data', () => {
    const boar = creatureOpponent(getMonster('boar'));
    expect(passiveScore(boar, 'perception')).toBe(10 + Math.floor((getMonster('boar').stats.sab - 10) / 2));
    const roll = dice(8);
    const sneak = resolveCheck({ character: hero, skillId: 'stealth', opponent: creatureOpponent(getMonster('guard')), rollDie: roll });
    expect(roll).toHaveBeenCalledTimes(1); // the guard does not roll
    expect(sneak.versus).toMatchObject({ label: 'Percepción', passive: true, total: 12 }); // SRD Guard: Perception +2
    expect(sneak.total).toBe(13);
    expect(sneak.success).toBe(true);
    expect(sneak.against).toBe('Percepción pasiva de guardia 12');
  });

  it('grappling goes against the best of Athletics and Acrobatics', () => {
    const grapple = resolveCheck({ character: hero, skillId: 'athletics', opponent: profileOpponent('soldado'), rollDie: dice(15, 10) });
    expect(grapple.versus).toMatchObject({ skillId: 'athletics', total: 15 }); // soldier: Athletics +5
  });

  it("resolves Duncan's opponent with the bestiary or a profile, and its own name", () => {
    expect(resolveOpponent({ creature: 'wolf' }, { getMonster })).toMatchObject({ kind: 'creature', id: 'wolf' });
    expect(resolveOpponent({ creature: 'nope', profile: 'guardia' }, { getMonster })).toMatchObject({ kind: 'profile', id: 'guardia' });
    expect(resolveOpponent({ profile: 'noble', name: 'la condesa Ilse' }).of).toBe('de la condesa Ilse');
    expect(resolveOpponent({ name: 'un viejo erudito' })).toMatchObject({ id: 'erudito' });
    expect(resolveOpponent({ name: 'Bob' })).toBeNull();
  });

  it('every profile has sane scores and a known AC', () => {
    Object.values(NPC_PROFILES).forEach(p => {
      Object.values(p.stats).forEach(v => expect(v).toBeGreaterThanOrEqual(3));
      expect(p.ac).toBeGreaterThanOrEqual(10);
    });
  });

  it('conditions still give Disadvantage (poisoned) and a natural 20 always succeeds', () => {
    const poisoned = { ...hero, conditions: [createCondition({ id: 'envenenado' })] };
    const check = resolveCheck({ character: poisoned, skillId: 'athletics', dc: 10, rollDie: dice(18, 3) });
    expect(check.rawRoll).toBe(3);
    expect(check.disadvantage).toContain('envenenado');
    expect(check.tag).toContain('con desventaja (envenenado)');
    expect(resolveCheck({ character: hero, skillId: 'athletics', dc: 30, rollDie: dice(20) }).success).toBe(true);
  });
});

describe('the local DC table', () => {
  it('has a base DC for each kind of action, all on the scale', () => {
    LOCAL_DC_TABLE.forEach(row => expect([5, 10, 15, 20, 25, 30]).toContain(row.dc));
    expect(planLocalCheck('Trepo por la tapia del cementerio')).toMatchObject({ kind: 'climb', skillId: 'athletics', dc: 15 });
    expect(planLocalCheck('Salto el arroyo')).toMatchObject({ kind: 'jump', dc: 10 });
    expect(planLocalCheck('Intento recordar la leyenda del rey')).toMatchObject({ kind: 'history', skillId: 'history', dc: 15 });
    expect(planLocalCheck('Pido una cerveza')).toBeNull();
  });

  it('changes the DC with words of the action and the scene', () => {
    expect(planLocalCheck('Fuerzo la cerradura de calidad del cofre')).toMatchObject({ kind: 'lock', ability: 'des', dc: 20 });
    expect(planLocalCheck('Fuerzo la cerradura oxidada')).toMatchObject({ dc: 10 });
    expect(planLocalCheck('Trepo por la cuerda')).toMatchObject({ dc: 10 });
    expect(planLocalCheck('Escalo el muro liso', { sceneText: 'Cae una tormenta' })).toMatchObject({ dc: 25 });
    const night = planLocalCheck('Me escondo detrás del carro', { sceneText: 'Es noche cerrada' });
    expect(night.dc).toBe(10);
    expect(night.reasons[0]).toContain('a oscuras');
  });

  it('opposes social checks to the person named in the action, not in the scene', () => {
    const child = planLocalCheck('Engaño al niño para que me dé la llave');
    expect(child).toMatchObject({ kind: 'deceive', skillId: 'deception' });
    expect(child.opponent).toMatchObject({ id: 'nino' });
    expect(planLocalCheck('Intento engañar al erudito').opponent.id).toBe('erudito');
    expect(planLocalCheck('Miento sobre mi nombre', { sceneText: 'Guardias por todas partes' }).opponent).toBeNull();
    // Climbing next to a guard is not opposed
    expect(planLocalCheck('Trepo el muro del guardia').opponent).toBeNull();
  });

  it('a check asked for from the sheet takes its kind from the chronicle', () => {
    const plan = planLocalCheck('Intento una prueba de Sigilo.', {
      intent: { skillId: 'stealth', label: 'Sigilo' }, contextText: 'Un centinela vigila la puerta en plena noche'
    });
    expect(plan).toMatchObject({ kind: 'hide', skillId: 'stealth' });
    expect(plan.opponent.id).toBe('guardia');
    const unknown = planLocalCheck('Intento una prueba de Medicina.', { intent: { skillId: 'medicine' } });
    expect(unknown).toMatchObject({ skillId: 'medicine', dc: 10 });
    const ability = planLocalCheck('Intento una prueba de Carisma.', { intent: { ability: 'car' } });
    expect(ability).toMatchObject({ kind: 'generic', ability: 'car', dc: 15 });
  });
});

describe('spells outside combat', () => {
  it("the target saves with its own bonus against the caster's DC", () => {
    const guardSave = rollTargetSave({ opponent: creatureOpponent(getMonster('cultist')), ability: 'sab', dc: 13, rollDie: dice(11) });
    expect(guardSave).toMatchObject({ raw: 11, bonus: getMonster('cultist').saves.sab ?? 0, known: true });
    const scholar = rollTargetSave({ opponent: profileOpponent('erudito'), ability: 'int', dc: 13, rollDie: dice(10) });
    expect(scholar).toMatchObject({ bonus: 3, total: 13, success: true, of: 'del erudito' });
    const unknown = rollTargetSave({ ability: 'des', dc: 13, rollDie: dice(11) });
    expect(unknown).toMatchObject({ bonus: 1, total: 12, success: false, known: false });
  });

  it('spell attacks use the target Armor Class (12 when unknown)', () => {
    expect(targetAC(opponentFromText('el guardia de la puerta', MONSTERS))).toBe(16);
    expect(targetAC(opponentFromText('el lobo', MONSTERS))).toBe(getMonster('wolf').ac);
    expect(targetAC(opponentFromText('la sombra rara', []))).toBe(12);
  });

  it('the chronicle and the local narration show the save the game rolled', () => {
    const spell = { id: 'x', name: 'Rayo', level: 1, kind: 'save', save: 'des', half: true, desc: 'Un rayo.' };
    const targetSave = rollTargetSave({ opponent: profileOpponent('guardia'), ability: 'des', dc: 13, rollDie: dice(15) });
    const cast = { spell, saveDC: 13, damage: { total: 8, type: 'relámpago', dice: [8], bonus: 0 }, targetSave };
    const line = describeCast(cast, { target: 'el guardia' });
    expect(line).toContain('Salvación de Destreza del guardia: 15 +1 = 16 vs CD 13');
    expect(line).toContain('Resiste y sufre la mitad: 4');
    const told = narrateSpell(cast, { character: hero, enemyRoll: 2 });
    expect(told.text).toContain('**15** +1 = 16 vs CD 13');
    expect(told.text).toContain('(Resiste)');
  });
});

describe('checks in the game engine', () => {
  const world = { name: 'Oakhaven', genre: 'Fantasía', factions: [{ name: 'Guardia' }, { name: 'Círculo' }] };
  const forceD20 = value => vi.spyOn(Math, 'random').mockReturnValue((value - 1) / 20 + 0.001);

  it('the local engine rolls an opposed check against the profile in the action', async () => {
    forceD20(11);
    const res = await generateDMResponse({ playerAction: 'Intento engañar al erudito con un cuento', character: hero, world });
    expect(res.check).toMatchObject({ skillId: 'deception', total: 15 });
    expect(res.check.versus).toMatchObject({ label: 'Perspicacia', total: 16 }); // 11 + 5
    expect(res.check.success).toBe(false);
    expect(res.roll).toMatchObject({ sides: 20, value: 11, success: false, against: 'Perspicacia del erudito 16' });
    expect(res.text).toContain('Engaño D20: **11** +4 = 15 contra Perspicacia del erudito 16');
  });

  it('picking the lock of a merchant is a check, not a shop', async () => {
    forceD20(10);
    const res = await generateDMResponse({
      playerAction: 'Fuerzo la cerradura de calidad del cofre del mercader', character: hero, world,
      allowShop: true, shopTypesHere: ['general']
    });
    expect(res.shop).toBeNull();
    expect(res.check).toMatchObject({ dc: 20, label: 'Destreza (ganzúas)' });
    expect(res.text).toContain('contra CD 20 (difícil)');
    expect(res.text).toContain('obra de calidad');
  });

  it('the local engine uses its table for a check asked for from the sheet', async () => {
    forceD20(12);
    const res = await generateDMResponse({
      playerAction: 'Intento una prueba de Atletismo.', character: hero, world,
      checkIntent: { skillId: 'athletics', label: 'Atletismo' }, contextText: 'Quieres trepar el muro liso'
    });
    expect(res.check).toMatchObject({ skillId: 'athletics', dc: 20, total: 12, success: false });
    expect(res.damageTaken).toBe(3);
    expect(res.roll).toMatchObject({ dc: 20, against: 'CD 20 (difícil)' });
  });

  it("Gemini: an opposed check against a creature of the bestiary picks Duncan's outcome", async () => {
    forceD20(9);
    const payload = {
      narracion: 'Te pegas a la pared mientras el lobo olfatea.', usaTirada: true, danio: 0, curacion: 0, oro: 0, experiencia: 0, opciones: ['x'],
      prueba: { habilidad: 'Sigilo', cd: 5, contra: { criatura: 'wolf' }, exito: { narracion: 'Pasa de largo.', experiencia: 20 }, fallo: { narracion: 'Te huele.', danio: 1 } }
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) }));
    const res = await generateDMResponse({ playerAction: 'Me escondo del lobo', character: hero, world, apiKeys: ['clave-de-prueba-123'], getMonster });
    // Stealth +5 → 14 against the wolf's passive Perception 15 (+5): the DC of 5 is ignored
    expect(res.check.versus).toMatchObject({ passive: true, total: 15 });
    expect(res.text).toContain('Te huele.');
    expect(res.damageTaken).toBe(1);
    expect(res.xpEarned).toBe(0);
    expect(res.roll.against).toBe('Percepción pasiva de lobo 15');
    vi.unstubAllGlobals();
  });

  it('Gemini: a check asked for from the sheet without a prueba still gets a DC from the table', async () => {
    forceD20(19);
    const payload = { narracion: 'Recuerdas algo.', usaTirada: false, danio: 0, curacion: 0, oro: 0, experiencia: 0, opciones: ['x'] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const res = await generateDMResponse({
      playerAction: 'Intento una prueba de Historia.', character: hero, world, apiKeys: ['clave-de-prueba-123'],
      checkIntent: { skillId: 'history', label: 'Historia' }
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text).toContain('ha pedido hacer una prueba de Historia');
    expect(res.check).toMatchObject({ skillId: 'history', dc: 15, success: true });
    expect(res.text).toContain('Historia D20: **19** +1 = 20 contra CD 15 (media)');
    vi.unstubAllGlobals();
  });
});
