import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateDMResponse } from './gameEngine';
import { buildDMPrompt, dmResponseSchema, parseDMReply } from './dmPrompt';
import { sceneNoteFor } from './origins';
import { createParty } from './party';
import { startApart, groupOf, moveGroup } from './splitParty';
import { tavernAudio } from './audio';

// The reason each group gets to go to the meeting point (Duncan's "reunion" field
// or the local engine), and how Duncan is told who is in the scene

const character = { id: 'a', name: 'Ana', race: 'Humana', class: 'Guerrera', hp: 10, maxHp: 10, gold: 5, stats: {} };
const world = {
  name: 'Oakhaven', genre: 'Fantasía', factions: [{ name: 'Guardia' }, { name: 'Círculo' }],
  mapNodes: [
    { id: 'tavern', name: 'Taberna del Jabalí', status: 'current' },
    { id: 'z1', name: 'Minas', status: 'discovered' },
    { id: 'z2', name: 'Monasterio', status: 'discovered' }
  ]
};
const party = () => startApart(createParty([character, { ...character, id: 'b', name: 'Bruno' }]), { a: 'z1', b: 'z2' }, { meetingNodeId: 'tavern' });
const geminiReply = payload => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) });

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(tavernAudio, 'playDiceRoll').mockImplementation(() => {});
  vi.spyOn(tavernAudio, 'playTankardClink').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('el campo «reunion» de Duncan', () => {
  it('solo se pide mientras el grupo no tiene motivo', () => {
    expect(dmResponseSchema(false, false, false, { allowMeetingHook: true }).properties.reunion).toBeTruthy();
    expect(dmResponseSchema(false, false, false, {}).properties.reunion).toBeUndefined();
    const prompt = buildDMPrompt({ playerAction: 'x', character, world, history: [], d20: 10, meetingPlace: 'Taberna del Jabalí' });
    expect(prompt).toContain('"reunion"');
    expect(prompt).toContain('Taberna del Jabalí');
    expect(buildDMPrompt({ playerAction: 'x', character, world, history: [], d20: 10 })).not.toContain('"reunion"');
  });

  it('se valida al leer la respuesta', () => {
    const raw = JSON.stringify({ narracion: 'Hola.', reunion: { tipo: 'encargo', motivo: 'Un noble paga por llevar una carta a la taberna.' } });
    expect(parseDMReply(raw).meetingHook).toEqual({ kind: 'encargo', text: 'Un noble paga por llevar una carta a la taberna.' });
    expect(parseDMReply(JSON.stringify({ narracion: 'Hola.', reunion: { tipo: 'otra', motivo: 'Lo que sea, de verdad.' } })).meetingHook).toBeNull();
  });

  it('Duncan da el motivo: se usa el suyo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply({ narracion: 'Un monje te mira.', usaTirada: false, danio: 0, curacion: 0, oro: 0, opciones: ['Ir'], reunion: { tipo: 'rumor', motivo: 'Dicen que en la taberna del Jabalí pagan por noticias.' } })));
    const res = await generateDMResponse({ playerAction: 'Pregunto', character, world, apiKeys: ['clave-de-prueba-123'], meetingHook: { place: 'Taberna del Jabalí', names: 'Ana', force: false } });
    expect(res.meetingHook).toEqual({ kind: 'rumor', text: 'Dicen que en la taberna del Jabalí pagan por noticias.', source: 'duncan' });
  });

  it('si Duncan no lo da cuando toca, lo pone el motor local en la narración', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply({ narracion: 'Un monje te mira.', usaTirada: false, danio: 0, curacion: 0, oro: 0, opciones: ['Ir'] })));
    const early = await generateDMResponse({ playerAction: 'Pregunto', character, world, apiKeys: ['clave-de-prueba-123'], meetingHook: { place: 'Taberna del Jabalí', names: 'Ana', force: false } });
    expect(early.meetingHook).toBeNull();
    const due = await generateDMResponse({ playerAction: 'Pregunto', character, world, apiKeys: ['clave-de-prueba-123'], meetingHook: { place: 'Taberna del Jabalí', names: 'Ana', force: true } });
    expect(due.meetingHook.source).toBe('local');
    expect(due.text).toContain('Taberna del Jabalí');
  });

  it('sin IA, el motor local lo da cuando toca y nunca al empezar un combate', async () => {
    const res = await generateDMResponse({ playerAction: 'Saludo al monje', character, world, meetingHook: { place: 'Taberna del Jabalí', names: 'Ana', force: true } });
    expect(res.meetingHook.source).toBe('local');
    expect(res.text).toContain(res.meetingHook.text);
    const fight = await generateDMResponse({
      playerAction: 'Voy a atacar al monje', character, world, meetingHook: { place: 'Taberna del Jabalí', names: 'Ana', force: true },
      bestiary: { creatures: [{ id: 'goblin', name: 'Goblin', cr: 0.25, xp: 50, tags: [] }], budget: { low: 50, moderate: 75, high: 100 } }
    });
    if (fight.combat) expect(fight.meetingHook).toBeNull();
  });

  it('el motor local narra el encuentro', async () => {
    const res = await generateDMResponse({
      playerAction: 'Llegamos a la taberna', character, world,
      meeting: { place: 'Taberna del Jabalí', joined: [{ names: 'Ana', hook: null }, { names: 'Bruno', hook: null }] }
    });
    expect(res.text).toContain('Bruno');
    expect(res.combat).toBeNull();
  });
});

describe('lo que Duncan sabe de la escena', () => {
  it('quién está aquí y quién está lejos', () => {
    const p = party();
    const note = sceneNoteFor(p, 'a', world);
    expect(note).toContain('solo de Ana, en Minas');
    expect(note).toContain('Bruno (en Monasterio)');
    expect(note).toContain('Taberna del Jabalí');
  });

  it('el encuentro, con los motivos de cada uno', () => {
    let p = party();
    const res = moveGroup(p, groupOf(p, 'a').id, 'z2');
    p = res.party;
    const note = sceneNoteFor(p, 'a', world, { meeting: { place: 'Monasterio', joined: res.met.joined } });
    expect(note).toContain('ENCUENTRO');
    expect(note).toContain('Ana y Bruno');
  });
});
