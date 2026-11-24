import { describe, it, expect } from 'vitest';
import { sanitizeIntent, applyIntent } from './protocol';
import { createRoom, joinPlayer, claimCharacter, setShareScenes, restoreRoom, roomToSave } from './room';
import { buildSections, chronicleForPlayers, MAX_CHRONICLE } from './snapshot';
import { sheetIntents } from './actions';
import { randomDraft } from '../utils/characterBuilder';

// Online with a party apart (see splitParty.js): each player moves their own group,
// a new hero chooses where they start, the host decides whether the players may
// read the others' scenes, and every message says which scene it belongs to.

const CHARS = ['brena', 'tobias'];
const names = { brena: 'Brena', tobias: 'Tobías' };
const room0 = () => {
  let room = createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' });
  room = joinPlayer(room, { id: 'a', name: 'Ana' }).room;
  return claimCharacter(room, 'a', 'brena', CHARS).room;
};
const game = (extra = {}) => ({ characterIds: CHARS, names, inCombat: false, turnCharacterId: null, combatBusy: false, nodeIds: ['tavern', 'z1'], apart: true, labelFor: (kind, p) => (kind === 'travel' ? { tavern: 'La Taberna', z1: 'Minas' }[p.nodeId] : ''), ...extra });
const travel = (characterId, nodeId) => sanitizeIntent(sheetIntents(characterId).travel({ id: nodeId })).intent;

describe('viajar con el propio grupo', () => {
  it('se valida el destino', () => {
    expect(sanitizeIntent({ type: 'act', characterId: 'brena', kind: 'travel', payload: { nodeId: 'a b' } }).ok).toBe(false);
    expect(travel('brena', 'tavern')).toEqual({ type: 'act', characterId: 'brena', kind: 'travel', payload: { nodeId: 'tavern' } });
  });

  it('separados, cada jugador viaja con el suyo: va a la cola como una acción', () => {
    const res = applyIntent(room0(), game(), 'a', travel('brena', 'tavern'));
    expect(res.ok).toBe(true);
    expect(res.room.queue[0].label).toBe('Brena: viaja a La Taberna');
  });

  it('a un lugar que no está en el mapa (o bloqueado), no', () => {
    const res = applyIntent(room0(), game(), 'a', travel('brena', 'tower'));
    expect(res.ok).toBe(false);
  });

  it('juntos, los viajes los decide el anfitrión', () => {
    const res = applyIntent(room0(), game({ apart: false }), 'a', travel('brena', 'tavern'));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/anfitrión/);
  });

  it('nadie mueve a un personaje que no controla', () => {
    expect(applyIntent(room0(), game(), 'a', travel('tobias', 'tavern')).ok).toBe(false);
  });
});

describe('un héroe nuevo elige dónde empieza', () => {
  const draft = JSON.parse(JSON.stringify(randomDraft(() => 0.3)));
  it('la zona viaja con la ficha y se valida', () => {
    const ok = sanitizeIntent({ type: 'create', draft, zoneId: 'zone-hierro' });
    expect(ok.ok).toBe(true);
    {
      expect(ok.intent.zoneId).toBe('zone-hierro');
      let room = createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' });
      room = joinPlayer(room, { id: 'b', name: 'Bea' }).room;
      const res = applyIntent(room, game(), 'b', ok.intent);
      expect(res.direct).toMatchObject({ kind: 'create', zoneId: 'zone-hierro' });
    }
    expect(sanitizeIntent({ type: 'create', draft, zoneId: { $ne: 1 } }).ok).toBe(false);
  });
});

describe('leer las escenas de los demás', () => {
  it('desactivado por defecto; el anfitrión lo cambia y se guarda', () => {
    const room = room0();
    expect(room.shareScenes).toBe(false);
    const on = setShareScenes(room, true);
    expect(on.shareScenes).toBe(true);
    expect(restoreRoom(roomToSave(on), { hostId: 'h' }).shareScenes).toBe(true);
    expect(restoreRoom(roomToSave(room), { hostId: 'h' }).shareScenes).toBe(false);
    expect(buildSections({ room: on }).room.shareScenes).toBe(true);
  });
});

describe('la crónica que se comparte', () => {
  it('cada mensaje lleva su escena', () => {
    const sections = buildSections({ messages: [{ sender: 'duncan', text: 'a', groupId: 'g1' }, { sender: 'duncan', text: 'b' }] });
    expect(sections.chronicle[0].groupId).toBe('g1');
    expect(sections.chronicle[1].groupId).toBeUndefined();
  });

  it('una escena muy activa no deja sin crónica a las demás', () => {
    const quiet = Array.from({ length: 5 }, (_, i) => ({ sender: 'duncan', text: `b${i}`, groupId: 'g2' }));
    const busy = Array.from({ length: MAX_CHRONICLE + 20 }, (_, i) => ({ sender: 'duncan', text: `a${i}`, groupId: 'g1' }));
    const out = chronicleForPlayers([...quiet, ...busy]);
    expect(out.filter(m => m.groupId === 'g2')).toHaveLength(5);
    expect(out.filter(m => m.groupId === 'g1')).toHaveLength(MAX_CHRONICLE);
    expect(out[0].text).toBe('b0');
  });

  it('sin escenas, igual que antes: los últimos mensajes', () => {
    const list = Array.from({ length: MAX_CHRONICLE + 10 }, (_, i) => ({ sender: 'duncan', text: String(i) }));
    const out = chronicleForPlayers(list);
    expect(out).toHaveLength(MAX_CHRONICLE);
    expect(out.at(-1).text).toBe(String(MAX_CHRONICLE + 9));
  });
});
