import { describe, it, expect } from 'vitest';
import { createIdentity, signText, verifyText, publicOnly, createRateLimiter } from './security';
import { buildSections, changedSections, MAX_CHRONICLE } from './snapshot';
import { onlineConfig, roomLink } from './transport';

describe('signatures', () => {
  it('verifies what the identity signed, and nothing else', async () => {
    const me = await createIdentity();
    const other = await createIdentity();
    const sig = await signText(me.privateJwk, 'hola');
    expect(await verifyText(me.publicJwk, 'hola', sig)).toBe(true);
    expect(await verifyText(me.publicJwk, 'hola!', sig)).toBe(false);
    expect(await verifyText(other.publicJwk, 'hola', sig)).toBe(false);
    expect(await verifyText(me.publicJwk, 'hola', 'basura')).toBe(false);
    expect(await verifyText({ kty: 'RSA' }, 'hola', sig)).toBe(false);
  });
  it('keeps only the public part of a key', async () => {
    const me = await createIdentity();
    expect(publicOnly({ ...me.privateJwk })).toEqual({ kty: 'EC', crv: 'P-256', x: me.publicJwk.x, y: me.publicJwk.y });
    expect(me.publicJwk.d).toBeUndefined();
  });
});

describe('rate limit', () => {
  it('allows a few messages per window and then refuses', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 });
    expect([0, 1, 2, 3].map(t => limiter.allow('a', t))).toEqual([true, true, true, false]);
    expect(limiter.allow('b', 3)).toBe(true);
    expect(limiter.allow('a', 1500)).toBe(true);
  });
});

describe('shared state', () => {
  it('only sends the sections that changed', () => {
    const sent = {};
    const first = changedSections(buildSections({ title: 'A', messages: [] }), sent);
    expect(Object.keys(first)).toContain('meta');
    expect(changedSections(buildSections({ title: 'A', messages: [] }), sent)).toBeNull();
    const next = changedSections(buildSections({ title: 'A', messages: [{ sender: 'duncan', text: 'x' }] }), sent);
    expect(Object.keys(next)).toEqual(['chronicle']);
  });
  it('trims the chronicle', () => {
    const messages = Array.from({ length: 120 }, (_, i) => ({ sender: 'duncan', text: `m${i}` }));
    const { chronicle } = buildSections({ messages });
    expect(chronicle).toHaveLength(MAX_CHRONICLE);
    expect(chronicle.at(-1).text).toBe('m119');
  });
});

describe('configuration', () => {
  it('uses Supabase only when both variables are set, and the local transport on demand', () => {
    expect(onlineConfig({}, '').kind).toBeNull();
    expect(onlineConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' }, '').kind).toBeNull();
    expect(onlineConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }, '').kind).toBe('supabase');
    expect(onlineConfig({}, '?transporte=local').kind).toBe('local');
  });
  it('builds the link to share', () => {
    expect(roomLink('ABC123', 'supabase', 'https://grifo.app/')).toBe('https://grifo.app/?sala=ABC123');
    expect(roomLink('ABC123', 'local', 'http://localhost:5173/')).toBe('http://localhost:5173/?sala=ABC123&transporte=local');
  });
});
