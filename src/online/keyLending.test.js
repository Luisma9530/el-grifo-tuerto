import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createLendingOffer, verifyLendingOffer, sealKey, openSealedKey, keyPrint, isPlausibleGeminiKey, createKeyVault
} from './keyLending';
import { createIdentity, signText, containsSecret, memorySecretCount } from './security';
import { createLocalTransport } from './transport';
import { createHostSession, createGuestSession } from './session';
import { createRoom } from './room';
import { buildSections } from './snapshot';
import { sanitizeIntent } from './protocol';
import { sceneApiKeys, lentKeysByScene, sharedLentKeys } from '../utils/sceneKeys';

// Fictitious keys (the shape of a Gemini key, never real ones)
const ANA_KEY = 'AIzaFAKE-ana-0000000000000000000000';
const BEA_KEY = 'AIzaFAKE-bea-1111111111111111111111';
const HOST_KEY = 'AIzaFAKE-host-222222222222222222222';

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0));
};

describe('the encryption of a lent key', () => {
  it('only the host opens it, for that room and that player', async () => {
    const signer = await createIdentity('s');
    const { privateKey, offer } = await createLendingOffer(signer);
    const sealed = await sealKey(offer.hostKey, ANA_KEY, { code: 'ABC123', playerId: 'p_ana' });
    expect(JSON.stringify(sealed)).not.toContain(ANA_KEY);
    expect(JSON.stringify(sealed)).not.toContain('ana-0000');
    expect(await openSealedKey(privateKey, sealed, { code: 'ABC123', playerId: 'p_ana' })).toBe(ANA_KEY);
    // Resent as someone else's, or in another room: it does not open
    expect(await openSealedKey(privateKey, sealed, { code: 'ABC123', playerId: 'p_eve' })).toBeNull();
    expect(await openSealedKey(privateKey, sealed, { code: 'OTRA', playerId: 'p_ana' })).toBeNull();
    // Another host's key does not open it either
    const other = await createLendingOffer(signer);
    expect(await openSealedKey(other.privateKey, sealed, { code: 'ABC123', playerId: 'p_ana' })).toBeNull();
    expect(await openSealedKey(privateKey, { ...sealed, ct: 'basura' }, { code: 'ABC123', playerId: 'p_ana' })).toBeNull();
  });

  it('what opens must look like a Gemini key', async () => {
    const { privateKey, offer } = await createLendingOffer(await createIdentity('s'));
    const sealed = await sealKey(offer.hostKey, 'hola <script>', { code: 'A', playerId: 'p' });
    expect(await openSealedKey(privateKey, sealed, { code: 'A', playerId: 'p' })).toBeNull();
    expect(isPlausibleGeminiKey(ANA_KEY)).toBe(true);
    expect(isPlausibleGeminiKey('corta')).toBe(false);
  });

  it('a player trusts only the host it pinned (or the one in the link)', async () => {
    const host = await createIdentity('s');
    const eve = await createIdentity('s');
    const real = (await createLendingOffer(host)).offer;
    const fake = (await createLendingOffer(eve)).offer;
    expect(await verifyLendingOffer(real)).not.toBeNull();
    expect(await verifyLendingOffer(fake, { pinned: host.publicJwk })).toBeNull();
    expect(await verifyLendingOffer(fake, { print: await keyPrint(host.publicJwk) })).toBeNull();
    expect(await verifyLendingOffer(real, { print: await keyPrint(host.publicJwk) })).not.toBeNull();
    // Eve signing a host key that is not hers with her key, but claiming the host's signing key
    const forged = { ...fake, signKey: host.publicJwk };
    expect(await verifyLendingOffer(forged)).toBeNull();
    expect(await verifyLendingOffer({ ...real, sig: await signText(eve.privateJwk, 'x') })).toBeNull();
  });

  it('the intent carries only the sealed key, with its sizes checked', async () => {
    const { offer } = await createLendingOffer(await createIdentity('s'));
    const sealed = await sealKey(offer.hostKey, ANA_KEY, { code: 'A', playerId: 'p' });
    expect(sanitizeIntent({ type: 'lend', sealed, key: ANA_KEY })).toEqual({ ok: true, intent: { type: 'lend', sealed } });
    expect(sanitizeIntent({ type: 'lend', sealed: { ...sealed, ct: 'x'.repeat(500) } }).ok).toBe(false);
    expect(sanitizeIntent({ type: 'lend', key: ANA_KEY }).ok).toBe(false);
    expect(sanitizeIntent({ type: 'unlend' }).ok).toBe(true);
  });

  it('the vault keeps the keys in memory only, and they are secrets while held', () => {
    const vault = createKeyVault();
    vault.put('p_ana', ANA_KEY);
    vault.put('p_bea', BEA_KEY);
    expect(containsSecret(`hola ${ANA_KEY}`)).toBe(true);
    expect(vault.lenders()).toEqual(['p_ana', 'p_bea']);
    expect(vault.keepOnly(['p_bea'])).toBe(true);
    expect(vault.all()).toEqual({ p_bea: BEA_KEY });
    expect(containsSecret(`hola ${ANA_KEY}`)).toBe(false);
    vault.clear();
    expect(memorySecretCount()).toBe(0);
  });
});

// An in-memory BroadcastChannel that also records everything sent on it
function makeBus(log) {
  const channels = new Map();
  return name => {
    const list = channels.get(name) || new Set();
    channels.set(name, list);
    const ch = {
      onmessage: null,
      postMessage(data) {
        const copy = JSON.parse(JSON.stringify(data));
        log.push(JSON.stringify(data));
        list.forEach(other => { if (other !== ch) queueMicrotask(() => other.onmessage?.({ data: copy })); });
      },
      close() { list.delete(ch); }
    };
    list.add(ch);
    return ch;
  };
}

describe('lending a key in a room (local transport)', () => {
  let bus;
  let log;
  let host;
  let lenders;
  let transports;
  let sessions;
  const tab = selfId => {
    const t = createLocalTransport({ code: 'ABC123', selfId, makeChannel: bus, heartbeatMs: 60_000 });
    transports.push(t);
    return t;
  };
  const guest = async (name, { hostPrint = '' } = {}) => {
    const identity = await createIdentity();
    const transport = tab(identity.id);
    const session = createGuestSession({ transport, identity, name, code: 'ABC123', hostPrint, helloRetryMs: 60_000 });
    sessions.push(session);
    return { identity, transport, session };
  };
  const allStorage = () => Object.keys(localStorage).map(k => `${k}=${localStorage.getItem(k)}`).join('\n');

  beforeEach(async () => {
    transports = [];
    sessions = [];
    log = [];
    lenders = [];
    // The host has a key of its own in this browser
    localStorage.setItem('tavern_gemini_keys', JSON.stringify([{ id: 'k', label: 'Mía', key: HOST_KEY }]));
    bus = makeBus(log);
    host = createHostSession({
      transport: tab('h'),
      room: createRoom({ code: 'ABC123', hostId: 'h', hostName: 'Luisma' }),
      getGame: () => ({ characterIds: ['brena', 'tobias'], names: { brena: 'Brena', tobias: 'Tobías' } }),
      signer: await createIdentity('s'),
      onLending: ids => { lenders = ids; },
      throttleMs: 0
    });
    host.publish(buildSections({ title: 'Prueba', party: { members: [{ id: 'brena', name: 'Brena' }] }, messages: [] }));
    await flush();
  });
  afterEach(() => {
    host.close();
    sessions.forEach(x => x.close());
    transports.splice(0).forEach(t => t.close());
    localStorage.clear();
  });

  it('the key reaches only the host, in memory, and never travels in clear', async () => {
    const ana = await guest('Ana');
    const bea = await guest('Bea');
    await flush();
    expect(ana.session.state.lending.ready).toBe(true);

    // Ana pasted her key (it is not in this browser's storage)
    expect(await ana.session.lendKey(ANA_KEY)).toEqual({ ok: true });
    await flush();
    await host.settle();
    await flush();

    expect(host.lentKeys()).toEqual({ [ana.identity.id]: ANA_KEY });
    expect(lenders).toEqual([ana.identity.id]);
    expect(ana.session.state.lending.lent).toBe(true);
    // The others see who lent one, never the key
    expect(bea.session.state.view.lending.lenders).toEqual([ana.identity.id]);
    expect(JSON.stringify(bea.session.state)).not.toContain(ANA_KEY);
    expect(JSON.stringify(host.room)).not.toContain(ANA_KEY);
    // Nothing on the channel carried it in clear (nor any part of it)
    expect(log.length).toBeGreaterThan(5);
    expect(log.some(m => m.includes(ANA_KEY) || m.includes('ana-0000'))).toBe(false);
    expect(log.some(m => m.includes(HOST_KEY))).toBe(false);
    // Nor is it stored anywhere
    expect(allStorage()).not.toContain(ANA_KEY);
    expect(JSON.stringify(sessionStorage)).not.toContain(ANA_KEY);
  });

  it('while held, nothing that contains it can be sent (chat, state...)', async () => {
    const ana = await guest('Ana');
    await flush();
    await ana.session.lendKey(ANA_KEY);
    await flush();
    await host.settle();
    await flush();
    // Ana pastes it in the chat by mistake: her transport refuses it
    const before = log.length;
    await ana.session.send({ type: 'chat', text: `mi clave es ${ANA_KEY}` });
    await flush();
    expect(log.slice(before).some(m => m.includes(ANA_KEY))).toBe(false);
    // And the host can't share it either
    expect(() => host.notice('x', ANA_KEY)).not.toThrow();
    expect(log.some(m => m.includes(ANA_KEY))).toBe(false);
  });

  it('it goes when the player takes it back or leaves the room', async () => {
    const ana = await guest('Ana');
    const bea = await guest('Bea');
    await flush();
    await ana.session.lendKey(ANA_KEY);
    await bea.session.lendKey(BEA_KEY);
    await flush();
    await host.settle();
    await flush();
    expect(Object.keys(host.lentKeys()).sort()).toEqual([ana.identity.id, bea.identity.id].sort());

    // Bea withdraws it
    await bea.session.withdrawKey();
    await flush();
    await host.settle();
    await flush();
    expect(host.lentKeys()).toEqual({ [ana.identity.id]: ANA_KEY });
    expect(bea.session.state.lending.lent).toBe(false);

    // Ana closes her tab: the host forgets her key
    ana.session.close();
    await flush();
    expect(host.lentKeys()).toEqual({});
    expect(lenders).toEqual([]);
    expect(containsSecret(ANA_KEY, null)).toBe(false);
    bea.session.close();
    expect(memorySecretCount()).toBe(0);
  });

  it('a removed player takes their key, and closing the room forgets them all', async () => {
    const ana = await guest('Ana');
    await flush();
    await ana.session.lendKey(ANA_KEY);
    await flush();
    await host.settle();
    await flush();
    host.update(r => ({ ...r, players: Object.fromEntries(Object.entries(r.players).filter(([id]) => id !== ana.identity.id)) }));
    expect(host.lentKeys()).toEqual({});

    const bea = await guest('Bea');
    await flush();
    await bea.session.lendKey(BEA_KEY);
    await flush();
    await host.settle();
    await flush();
    expect(host.lentKeys()).toEqual({ [bea.identity.id]: BEA_KEY });
    host.close();
    expect(host.lentKeys()).toEqual({});
    bea.session.close();
    ana.session.close();
    expect(memorySecretCount()).toBe(0);
  });

  it('nobody can pass another player\'s sealed key as their own', async () => {
    const ana = await guest('Ana');
    const eve = await guest('Eve');
    await flush();
    await ana.session.lendKey(ANA_KEY);
    await flush();
    await host.settle();
    // Eve copies Ana's sealed key from the channel and sends it signed by herself
    const anaIntent = log.map(m => JSON.parse(m)).find(m => m.d && JSON.parse(m.d).t === 'intent' && JSON.parse(JSON.parse(m.d).b).type === 'lend');
    const sealed = JSON.parse(JSON.parse(anaIntent.d).b).sealed;
    await eve.session.send({ type: 'lend', sealed });
    await flush();
    await host.settle();
    await flush();
    expect(Object.keys(host.lentKeys())).toEqual([ana.identity.id]);
    expect(eve.session.state.notices.at(-1).text).toMatch(/no llegó bien/);
  });

  it('a player that came by the link lends only to the host of that link', async () => {
    const wrong = await keyPrint((await createIdentity('s')).publicJwk);
    const ana = await guest('Ana', { hostPrint: wrong });
    await flush();
    expect(ana.session.state.status).toBe('joined');
    expect(ana.session.state.lending.ready).toBe(false);
    expect((await ana.session.lendKey(ANA_KEY)).ok).toBe(false);
    await flush();
    await host.settle();
    expect(host.lentKeys()).toEqual({});
    ana.session.close();
  });
});

describe('which keys Duncan uses', () => {
  const host = [{ key: 'host-1' }, { key: 'host-2' }];
  const lent = { p_ana: 'ana-k', p_bea: 'bea-k' };
  const playerOf = cid => ({ brena: 'h', tobias: 'p_ana', ilsa: 'p_bea', kael: 'p_cid' }[cid]);

  it('together: the lent keys join the host\'s pool', () => {
    expect(sceneApiKeys(host, { sharedKeys: sharedLentKeys(lent) }).map(k => k.key)).toEqual(['host-1', 'host-2', 'ana-k', 'bea-k']);
    expect(sceneApiKeys(host, { sharedKeys: [] })).toBe(host);
    // The same key twice counts once
    expect(sceneApiKeys(host, { sharedKeys: [{ key: 'host-1' }] }).length).toBe(2);
  });

  it('apart: each group uses the keys of its players; without, the host\'s', () => {
    const groups = [{ id: 'g1', memberIds: ['tobias'] }, { id: 'g2', memberIds: ['brena', 'ilsa'] }, { id: 'g3', memberIds: ['kael'] }];
    const byScene = lentKeysByScene({ groups, playerOf, lent, hostId: 'h', hostKeys: host });
    expect(byScene.g1.map(k => k.key)).toEqual(['ana-k']);
    // The host plays in g2: its keys and Bea's
    expect(byScene.g2.map(k => k.key)).toEqual(['host-1', 'host-2', 'bea-k']);
    expect(byScene.g3).toBeUndefined();
    expect(sceneApiKeys(host, { sceneId: 'g1', keysByScene: byScene }).map(k => k.key)).toEqual(['ana-k']);
    expect(sceneApiKeys(host, { sceneId: 'g3', keysByScene: byScene })).toBe(host);
  });

  it('without lent keys, everything as today', () => {
    expect(sceneApiKeys(host)).toBe(host);
    expect(sceneApiKeys(host, { sceneId: 'g1', keysByScene: lentKeysByScene({ groups: [{ id: 'g1', memberIds: ['tobias'] }], playerOf, lent: {} }) })).toBe(host);
  });
});
