import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocalTransport } from './transport';
import { createHostSession, createGuestSession } from './session';
import { createRoom, controllerOf } from './room';
import { createIdentity, signText, assertNoSecrets, containsSecret } from './security';
import { buildSections } from './snapshot';

// An in-memory BroadcastChannel: every channel with the same name hears the others
function makeBus() {
  const channels = new Map();
  return name => {
    const list = channels.get(name) || new Set();
    channels.set(name, list);
    const ch = {
      onmessage: null,
      postMessage(data) {
        const copy = JSON.parse(JSON.stringify(data));
        list.forEach(other => { if (other !== ch) queueMicrotask(() => other.onmessage?.({ data: copy })); });
      },
      close() { list.delete(ch); }
    };
    list.add(ch);
    return ch;
  };
}

const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0));
};

const GEMINI_KEY = 'AIzaSyTESTKEY-1234567890-abcdef';
const CHARS = ['brena', 'tobias', 'ilsa'];

describe('a game between tabs (local transport)', () => {
  let bus;
  let host;
  let combat;
  let game;
  const transports = [];
  const tab = (selfId) => {
    const t = createLocalTransport({ code: 'ABC123', selfId, makeChannel: bus, heartbeatMs: 60_000 });
    transports.push(t);
    return t;
  };
  const guest = async (name) => {
    const identity = await createIdentity();
    const transport = tab(identity.id);
    const session = createGuestSession({ transport, identity, name, helloRetryMs: 60_000 });
    return { identity, transport, session };
  };

  beforeEach(() => {
    localStorage.setItem('tavern_gemini_keys', JSON.stringify([{ id: 'k', label: 'Mía', key: GEMINI_KEY }]));
    bus = makeBus();
    combat = vi.fn();
    game = { characterIds: CHARS, names: { brena: 'Brena', tobias: 'Tobías', ilsa: 'Ilsa' }, inCombat: false, turnCharacterId: null, combatBusy: false };
    host = createHostSession({
      transport: tab('h'),
      room: createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' }),
      getGame: () => game,
      onCombat: combat,
      throttleMs: 0
    });
    host.publish(buildSections({ title: 'Prueba', party: { members: [{ id: 'brena', name: 'Brena' }] }, messages: [{ sender: 'duncan', text: 'Hola', keyIndex: 0 }] }));
  });
  afterEach(() => {
    transports.splice(0).forEach(t => t.close());
    localStorage.clear();
  });

  it('players enter, get the whole state and choose their characters', async () => {
    const ana = await guest('Ana');
    await flush();
    expect(ana.session.state.status).toBe('joined');
    expect(ana.session.state.view.meta.title).toBe('Prueba');
    expect(host.room.players[ana.identity.id]).toMatchObject({ name: 'Ana', connected: true });

    await ana.session.send({ type: 'claim', characterId: 'brena' });
    await flush();
    await host.settle();
    expect(controllerOf(host.room, 'brena')).toBe(ana.identity.id);
    await flush();
    expect(ana.session.state.view.room.claims).toEqual({ brena: ana.identity.id });
  });

  it('a second player with the same name is refused', async () => {
    await guest('Ana');
    await flush();
    const other = await guest('ana');
    await flush();
    expect(other.session.state.status).toBe('rejected');
    expect(other.session.state.error).toMatch(/Ya hay alguien/);
  });

  it('only the player of the hero whose turn it is can act in combat', async () => {
    const ana = await guest('Ana');
    const bea = await guest('Bea');
    await flush();
    await ana.session.send({ type: 'claim', characterId: 'brena' });
    await bea.session.send({ type: 'claim', characterId: 'tobias' });
    await flush();
    await host.settle();
    game = { ...game, inCombat: true, turnCharacterId: 'brena' };

    await bea.session.send({ type: 'combat', characterId: 'brena', action: { type: 'dodge' } });
    await bea.session.send({ type: 'combat', characterId: 'tobias', action: { type: 'dodge' } });
    await flush();
    await host.settle();
    expect(combat).not.toHaveBeenCalled();
    await flush();
    expect(bea.session.state.notices.map(n => n.text)).toEqual(['No controlas a Brena.', 'Ahora es el turno de Brena.']);

    await ana.session.send({ type: 'combat', characterId: 'brena', action: { type: 'dodge' } });
    await flush();
    await host.settle();
    expect(combat).toHaveBeenCalledWith('brena', { type: 'dodge' }, ana.identity.id);
  });

  it('outside combat the actions wait in a queue, in order', async () => {
    const ana = await guest('Ana');
    const bea = await guest('Bea');
    await flush();
    await ana.session.send({ type: 'claim', characterId: 'brena' });
    await bea.session.send({ type: 'claim', characterId: 'tobias' });
    await flush();
    await host.settle();
    await ana.session.send({ type: 'act', characterId: 'brena', kind: 'text', payload: { text: 'Abro la puerta' } });
    await flush();
    await host.settle();
    await bea.session.send({ type: 'act', characterId: 'tobias', kind: 'text', payload: { text: 'Vigilo el pasillo' } });
    await flush();
    await host.settle();
    expect(host.room.queue.map(q => q.label)).toEqual(['Brena: «Abro la puerta»', 'Tobías: «Vigilo el pasillo»']);
  });

  it('refuses intents signed by someone else, and replays', async () => {
    const ana = await guest('Ana');
    const bea = await guest('Bea');
    await flush();
    await ana.session.send({ type: 'claim', characterId: 'brena' });
    await flush();
    await host.settle();
    // Bea pretends to be Ana: she can't sign with Ana's key
    const b = JSON.stringify({ type: 'act', characterId: 'brena', kind: 'text', payload: { text: 'Me rindo' }, seq: Date.now() + 10_000 });
    bea.transport.send({ t: 'intent', id: ana.identity.id, b, s: await signText(bea.identity.privateJwk, b) });
    await flush();
    await host.settle();
    expect(host.room.queue).toHaveLength(0);

    // A message Ana really signed, sent twice: the second one is ignored
    const real = JSON.stringify({ type: 'chat', text: 'hola', seq: Date.now() + 20_000 });
    const sig = await signText(ana.identity.privateJwk, real);
    ana.transport.send({ t: 'intent', id: ana.identity.id, b: real, s: sig });
    ana.transport.send({ t: 'intent', id: ana.identity.id, b: real, s: sig });
    await flush();
    await host.settle();
    expect(host.room.chat).toHaveLength(1);
  });

  it('refuses a hello with a known id but another key (another browser)', async () => {
    const ana = await guest('Ana');
    await flush();
    const thief = await createIdentity();
    const t = tab(thief.id);
    const session = createGuestSession({ transport: t, identity: { ...thief, id: ana.identity.id }, name: 'Ana', helloRetryMs: 60_000 });
    await flush();
    expect(session.state.status).toBe('rejected');
  });

  it('a player who leaves gives their character to the host until they come back', async () => {
    const ana = await guest('Ana');
    await flush();
    await ana.session.send({ type: 'claim', characterId: 'brena' });
    await flush();
    await host.settle();
    ana.session.close();
    await flush();
    expect(host.room.players[ana.identity.id].connected).toBe(false);
    expect(controllerOf(host.room, 'brena')).toBe('h');

    // Same browser, same name: same identity
    const transport = tab(ana.identity.id);
    const back = createGuestSession({ transport, identity: ana.identity, name: 'Ana', helloRetryMs: 60_000 });
    await flush();
    expect(back.state.status).toBe('joined');
    expect(controllerOf(host.room, 'brena')).toBe(ana.identity.id);
  });

  it('the players see the room paused when the host leaves', async () => {
    const ana = await guest('Ana');
    await flush();
    expect(ana.session.state.hostOnline).toBe(true);
    host.close();
    await flush();
    expect(ana.session.state.hostOnline).toBe(false);
  });

  it('the Gemini key never leaves the browser', async () => {
    const seen = [];
    const spy = tab('spy');
    spy.onMessage(m => seen.push(JSON.stringify(m)));
    const ana = await guest('Ana');
    await flush();
    await ana.session.send({ type: 'chat', text: 'hola' });
    await flush();
    await host.settle();
    await flush();
    expect(seen.length).toBeGreaterThan(2);
    expect(seen.some(text => text.includes(GEMINI_KEY))).toBe(false);
    // ...and if it ever got into a message, the transport would refuse to send it
    expect(() => host.notice('x', `mi clave es ${GEMINI_KEY}`)).not.toThrow();
    await flush();
    expect(seen.some(text => text.includes(GEMINI_KEY))).toBe(false);
    expect(() => spy.send({ text: GEMINI_KEY })).toThrow(/clave de Gemini/);
  });
});

describe('secrets guard', () => {
  it('detects the stored keys and lets everything else through', () => {
    expect(containsSecret(`x${GEMINI_KEY}y`, [GEMINI_KEY])).toBe(true);
    expect(containsSecret('nada que ver', [GEMINI_KEY])).toBe(false);
    expect(assertNoSecrets({ a: 1 }, [GEMINI_KEY])).toBe('{"a":1}');
    expect(() => assertNoSecrets({ a: GEMINI_KEY }, [GEMINI_KEY])).toThrow();
  });
  it('the shared state carries no AI bookkeeping', () => {
    const sections = buildSections({ messages: [{ sender: 'duncan', text: 'hola', keyIndex: 2, totalKeys: 3 }] });
    expect(sections.chronicle[0].keyIndex).toBeUndefined();
    expect(sections.chronicle[0].totalKeys).toBeUndefined();
  });
});
