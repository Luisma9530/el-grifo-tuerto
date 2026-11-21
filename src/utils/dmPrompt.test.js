import { describe, it, expect } from 'vitest';
import { buildDMPrompt, parseDMReply, dmResponseSchema, DM_RESPONSE_SCHEMA, cleanLimbChanges } from './dmPrompt';

const character = {
  name: 'Kaelen', race: 'Elfo Silvano', class: 'Pícaro (Nivel 3)', hp: 12, maxHp: 28, ac: 15, gold: 10,
  stats: { fue: 10, des: 17, con: 12, int: 13, sab: 14, car: 15 },
  inventory: [{ name: 'Daga de Acero' }, { name: 'Poción de Curación' }]
};
const world = {
  name: 'Oakhaven', genre: 'Fantasía Oscura', initialLocation: 'Taberna',
  mapNodes: [{ name: 'Viejo Molino', status: 'current' }]
};

describe('buildDMPrompt', () => {
  it('gives the model the character sheet, location and the die already rolled', () => {
    const prompt = buildDMPrompt({ playerAction: 'Trepo el muro', character, world, history: [], d20: 14 });
    expect(prompt).toContain('Kaelen');
    expect(prompt).toContain('12/28');
    expect(prompt).toContain('Destreza 17 (+3)');
    expect(prompt).toContain('Daga de Acero');
    expect(prompt).toContain('Viejo Molino');
    expect(prompt).toContain('ha salido: 14');
    expect(prompt).toContain('"usaTirada"');
    expect(prompt).toContain('Trepo el muro');
  });

  it('flags natural 20s and 1s', () => {
    expect(buildDMPrompt({ playerAction: 'x', character, world, d20: 20 })).toContain('20 (crítico natural)');
    expect(buildDMPrompt({ playerAction: 'x', character, world, d20: 1 })).toContain('1 (pifia natural)');
  });

  it("uses the player's own check when there is one", () => {
    const playerRoll = { statName: 'Destreza', rawRoll: 4, total: 7, dc: 12, success: false, isNat20: false, isNat1: false };
    const prompt = buildDMPrompt({ playerAction: 'x', character, world, d20: 4, playerRoll });
    expect(prompt).toContain('tirada de Destreza: d20 = 4, total 7 contra CD 12 → FALLO');
    expect(prompt).not.toContain('YA se ha lanzado');
  });

  it('keeps only recent history, labelled by speaker and truncated', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ sender: i % 2 ? 'duncan' : 'player', text: `mensaje-${i}` }));
    history.push({ sender: 'system', text: '🎲 Tirada de dados: d20 (11)' });
    history.push({ sender: 'duncan', text: 'x'.repeat(2000) });
    const prompt = buildDMPrompt({ playerAction: 'x', character, world, history, d20: 10 });
    // At most 14 messages: 20 + 2 messages -> the first 8 are left out
    expect(prompt).not.toContain('mensaje-7\n');
    expect(prompt).toContain('Kaelen: mensaje-8');
    expect(prompt).toContain('Maese Duncan (DM): mensaje-19');
    expect(prompt).toContain('Sistema (dados): 🎲');
    expect(prompt).not.toContain('x'.repeat(501));
  });

  it('can ask for the legacy plain-text format', () => {
    const prompt = buildDMPrompt({ playerAction: 'x', character, world, d20: 10, structured: false });
    expect(prompt).toContain('OPCIONES:');
    expect(prompt).not.toContain('"usaTirada"');
  });
});

describe('buildDMPrompt with a wizard-made hero', () => {
  it('describes background, proficient skills, traits and backstory', () => {
    const hero = {
      ...character, background: 'Criminal', alignment: 'Caótico Neutral', proficiencyBonus: 2,
      skills: ['stealth', 'sleightOfHand'], classFeatures: ['Ataque Furtivo'], feats: ['Alerta'], traits: ['Trance'],
      backstory: 'Le debe dinero a medio Oakhaven.'
    };
    const prompt = buildDMPrompt({ playerAction: 'x', character: hero, world, d20: 10 });
    expect(prompt).toContain('Trasfondo: Criminal. Alineamiento: Caótico Neutral.');
    expect(prompt).toContain('Competente (suma +2 en esas tiradas) en: Sigilo, Juego de Manos.');
    expect(prompt).toContain('Rasgos y dotes: Ataque Furtivo, Alerta, Trance.');
    expect(prompt).toContain('Historia: Le debe dinero a medio Oakhaven.');
  });

  it('adds nothing for characters from older saves', () => {
    const prompt = buildDMPrompt({ playerAction: 'x', character: { ...character, backstory: undefined }, world, d20: 10 });
    expect(prompt).not.toContain('Trasfondo:');
    expect(prompt).not.toContain('Competente');
  });
});

describe('parseDMReply', () => {
  const reply = extra => JSON.stringify({
    narracion: 'Duncan **asiente**.', usaTirada: true, danio: 3, curacion: 0, oro: -4, opciones: ['Huir', ' Luchar ', ''], ...extra
  });

  it('reads the structured reply', () => {
    expect(parseDMReply(reply(), character)).toEqual({
      text: 'Duncan **asiente**.',
      suggestedActions: ['Huir', 'Luchar'],
      damageTaken: 3,
      healing: 0,
      goldEarned: -4,
      xpEarned: 0,
      usedRoll: true,
      summary: null,
      combat: null,
      limbChanges: []
    });
    expect(parseDMReply(reply({ experiencia: 60 }), character).xpEarned).toBe(60);
    expect(parseDMReply(reply({ experiencia: 5000 }), character).xpEarned).toBe(300);
    expect(parseDMReply(reply({ experiencia: -20 }), character).xpEarned).toBe(0);
  });

  it('accepts JSON wrapped in a code fence', () => {
    expect(parseDMReply('```json\n' + reply() + '\n```', character).damageTaken).toBe(3);
  });

  it('clamps numbers so the sheet cannot be wrecked', () => {
    const wild = parseDMReply(reply({ danio: 9999, curacion: -5, oro: -9999 }), character);
    expect(wild.damageTaken).toBe(28); // at most max HP
    expect(wild.healing).toBe(0);
    expect(wild.goldEarned).toBe(-10); // cannot spend more gold than the character has
    expect(parseDMReply(reply({ oro: 100000 }), character).goldEarned).toBe(500);
    expect(parseDMReply(reply({ danio: 'mucho', oro: null }), character)).toMatchObject({ damageTaken: 0, goldEarned: 0 });
  });

  it('falls back to default options and only trusts usaTirada === true', () => {
    const parsed = parseDMReply(reply({ opciones: 'ninguna', usaTirada: 'sí' }), character);
    expect(parsed.suggestedActions).toHaveLength(4);
    expect(parsed.usedRoll).toBe(false);
  });

  it('parses the legacy plain-text format', () => {
    const parsed = parseDMReply('Duncan gruñe [🎲 D20: 14].\n\nOPCIONES: Beber | Pelear | Salir', character);
    expect(parsed).toMatchObject({
      text: 'Duncan gruñe [🎲 D20: 14].',
      suggestedActions: ['Beber', 'Pelear', 'Salir'],
      damageTaken: 0,
      goldEarned: 0,
      usedRoll: true
    });
    expect(parseDMReply('Solo charla.', character).usedRoll).toBe(false);
  });

  it('rejects empty or unusable replies', () => {
    expect(parseDMReply('', character)).toBeNull();
    expect(parseDMReply(undefined, character)).toBeNull();
    expect(parseDMReply('{"narracion": ""}', character)).toBeNull(); // never show raw JSON
  });
});

describe('campaign memory and resolved attacks in the prompt', () => {
  it('includes the summary and the recorded facts', () => {
    const prompt = buildDMPrompt({
      playerAction: 'x', character, world, history: [], d20: 10,
      summary: 'Le debes 20 po a Duncan. El encapuchado es un espía del Círculo.',
      events: ['Viaja a: Viejo Molino', 'Sube a nivel 2']
    });
    expect(prompt).toContain('Resumen de la campaña hasta ahora');
    expect(prompt).toContain('espía del Círculo');
    expect(prompt).toContain('Hechos registrados por el juego: Viaja a: Viejo Molino · Sube a nivel 2.');
    expect(prompt).not.toContain('"resumen"');
  });

  it('asks for an updated summary only when requested', () => {
    const prompt = buildDMPrompt({ playerAction: 'x', character, world, history: [], d20: 10, requestSummary: true });
    expect(prompt).toContain('"resumen": reescribe el resumen de la campaña');
    expect(dmResponseSchema(false)).toBe(DM_RESPONSE_SCHEMA);
    expect(dmResponseSchema(true).required).toContain('resumen');
    expect(DM_RESPONSE_SCHEMA.required).not.toContain('resumen');
  });

  it('reads and trims the summary in the reply', () => {
    const reply = JSON.stringify({ narracion: 'Hola.', usaTirada: false, danio: 0, curacion: 0, oro: 0, experiencia: 0, opciones: [], resumen: '  Hechos.  ' });
    expect(parseDMReply(reply, character).summary).toBe('Hechos.');
    const long = JSON.stringify({ narracion: 'Hola.', resumen: 'a'.repeat(5000) });
    expect(parseDMReply(long, character).summary.length).toBeLessThanOrEqual(1200);
  });

  it('tells the model not to roll for attacks the game resolved', () => {
    const prompt = buildDMPrompt({ playerAction: 'Ataco con mi espadón...', character, world, history: [], d20: 10, weaponAttack: { hits: 1 } });
    expect(prompt).toContain('El juego YA ha resuelto este ataque');
    expect(prompt).not.toContain('YA se ha lanzado para esta acción');
  });
});

describe('limbs in the structured reply', () => {
  it('the schema and the prompt ask for them', () => {
    const limbs = DM_RESPONSE_SCHEMA.properties.extremidades;
    expect(limbs.items.properties.extremidad.enum).toEqual(['brazoDerecho', 'brazoIzquierdo', 'piernaDerecha', 'piernaIzquierda']);
    expect(limbs.items.properties.estado.enum).toEqual(['sana', 'inutilizada', 'perdida']);
    expect(DM_RESPONSE_SCHEMA.required).not.toContain('extremidades');
    expect(dmResponseSchema(true, true).properties.extremidades).toBe(limbs);
    const prompt = buildDMPrompt({ playerAction: 'x', character, world, d20: 10 });
    expect(prompt).toContain('"extremidades"');
    expect(prompt).toContain('En las manos: Daga de Acero.'); // older sheet: the first weapon goes in hand
  });

  it('tells Duncan what is in hand and which limbs are injured', () => {
    const armed = { ...character, inventory: [{ id: 'd', name: 'Daga de Acero', type: 'weapon' }], limbs: { leftArm: 'lost', rightLeg: 'disabled' } };
    const prompt = buildDMPrompt({ playerAction: 'x', character: armed, world, d20: 10 });
    expect(prompt).toContain('En las manos: Daga de Acero.');
    expect(prompt).toContain('Extremidades heridas: brazo izquierdo perdido, pierna derecha inutilizada.');
  });

  it('keeps only valid changes, one per limb', () => {
    expect(cleanLimbChanges([
      { extremidad: 'brazoIzquierdo', estado: 'perdida' },
      { extremidad: 'cola', estado: 'perdida' },
      { extremidad: 'piernaDerecha', estado: 'rota' },
      { extremidad: 'piernaDerecha', estado: 'Inutilizada' },
      'nada', null,
      { extremidad: 'brazoIzquierdo', estado: 'sana' }
    ])).toEqual([{ limb: 'leftArm', status: 'ok' }, { limb: 'rightLeg', status: 'disabled' }]);
    expect(cleanLimbChanges('brazo')).toEqual([]);
    expect(cleanLimbChanges(undefined)).toEqual([]);
  });

  it('parses them from the reply', () => {
    const raw = JSON.stringify({
      narracion: 'La trampa se cierra sobre tu brazo.', usaTirada: false, danio: 4, curacion: 0, oro: 0, experiencia: 0,
      opciones: ['Gritar'], extremidades: [{ extremidad: 'brazoDerecho', estado: 'inutilizada' }]
    });
    expect(parseDMReply(raw, character).limbChanges).toEqual([{ limb: 'rightArm', status: 'disabled' }]);
    expect(parseDMReply('Texto sin JSON', character).limbChanges).toEqual([]);
  });
});
