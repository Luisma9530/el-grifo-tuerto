import { describe, it, expect } from 'vitest';
import { buildDMPrompt, parseDMReply } from './dmPrompt';

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
    expect(prompt).not.toContain('mensaje-9\n');
    expect(prompt).toContain('Kaelen: mensaje-10');
    expect(prompt).toContain('Maese Duncan (DM): mensaje-19');
    expect(prompt).toContain('Sistema (dados): 🎲');
    expect(prompt).not.toContain('x'.repeat(701));
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
      usedRoll: true
    });
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
