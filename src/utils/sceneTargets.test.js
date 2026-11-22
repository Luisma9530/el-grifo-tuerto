import { describe, it, expect } from 'vitest';
import { cleanTargets, parseDMReply, dmResponseSchema, buildDMPrompt, cleanConditionChanges, cleanLimbChanges } from './dmPrompt';
import { createParty, resolveTargets } from './party';
import { applySceneEffects, applySceneConditions, applySceneLimbs } from './partyActions';
import { applySceneOutcome } from './sceneOutcome';
import { quickHero } from './simulator';
import { hasCondition, exhaustionLevel } from './conditions';

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const hero = (classId, name) => ({ ...quickHero({ classId, level: 2, rng: seeded(classId.length) }), name });
const party = (gold = 40) => createParty([hero('fighter', 'Brega'), hero('wizard', 'Tomás'), hero('rogue', 'Lía')], { gold });
const ids = p => p.members.map(m => m.id);

describe('validating who a scene effect hits', () => {
  it('keeps short names, "todos" wins, nothing means whoever acts', () => {
    expect(cleanTargets([' Tomás ', 'Lía', 'Tomás', 3])).toEqual(['Tomás', 'Lía']);
    expect(cleanTargets(['Tomás', 'TODOS'])).toEqual(['todos']);
    expect(cleanTargets('Lía')).toEqual(['Lía']);
    expect(cleanTargets([])).toBeNull();
    expect(cleanTargets(null)).toBeNull();
    expect(cleanTargets(['a', 'b', 'c', 'd', 'e', 'f'])).toHaveLength(4);
  });

  it('parseDMReply reads the targets of damage, healing, conditions and limbs', () => {
    const reply = JSON.stringify({
      narracion: '¡La trampa estalla!', usaTirada: true, danio: 4, curacion: 0, oro: 0, experiencia: 0, opciones: ['a'],
      afectadosDanio: ['todos'],
      condiciones: [{ condicion: 'ensordecido', accion: 'aplicar', afectados: ['Tomás', 'Lía'] }],
      extremidades: [{ extremidad: 'brazoDerecho', estado: 'inutilizada', afectados: ['Brega'] }]
    });
    const parsed = parseDMReply(reply, { maxHp: 20, gold: 0 });
    expect(parsed.damageTargets).toEqual(['todos']);
    expect(parsed.healingTargets).toBeNull();
    expect(parsed.conditionChanges[0].targets).toEqual(['Tomás', 'Lía']);
    expect(parsed.limbChanges[0]).toEqual({ limb: 'rightArm', status: 'disabled', targets: ['Brega'] });
  });

  it('the same condition or limb can hit different members in one reply', () => {
    expect(cleanConditionChanges([
      { condicion: 'envenenado', accion: 'aplicar', afectados: ['Tomás'] },
      { condicion: 'envenenado', accion: 'aplicar' }
    ])).toHaveLength(2);
    expect(cleanLimbChanges([
      { extremidad: 'piernaDerecha', estado: 'inutilizada', afectados: ['Lía'] },
      { extremidad: 'piernaDerecha', estado: 'inutilizada' }
    ])).toHaveLength(2);
  });

  it('the schema and the prompt explain them', () => {
    const schema = dmResponseSchema();
    expect(schema.properties.afectadosDanio.type).toBe('ARRAY');
    expect(schema.properties.condiciones.items.properties.afectados).toBeDefined();
    const prompt = buildDMPrompt({
      playerAction: 'Abro el cofre', character: { name: 'Brega', hp: 10, maxHp: 10, gold: 0 }, world: { name: 'Mundo' },
      history: [], d20: 10, companions: 'Tomás (...)', partySize: 3
    });
    expect(prompt).toContain('"afectadosDanio"');
    expect(prompt).toContain('una trampa, una explosión');
    expect(prompt).toContain('["todos"]');
  });
});

describe('resolving the targets in the party', () => {
  it('names, ids and "todos"; unknown names fall back to whoever acts', () => {
    const p = party();
    const [a, b, c] = ids(p);
    expect(resolveTargets(p, null, b)).toEqual([b]);
    expect(resolveTargets(p, ['todos'], b)).toEqual([a, b, c]);
    expect(resolveTargets(p, ['tomás', c], a)).toEqual([b, c]);
    expect(resolveTargets(p, ['Nadie'], c)).toEqual([c]);
  });
});

describe('applying the scene to the party', () => {
  it('without targets it is exactly the old rule for whoever acts', () => {
    const p = party(40);
    const [a] = ids(p);
    const actor = { ...p.members[0], gold: p.gold };
    const res = applySceneEffects(p, a, { damage: 3, goldChange: 5 });
    const old = applySceneOutcome(actor, { damage: 3, goldChange: 5 });
    expect(res.party.members[0].hp).toBe(old.hp);
    expect(res.party.gold).toBe(old.gold);
    expect(res.party.members.slice(1).map(m => m.hp)).toEqual(p.members.slice(1).map(m => m.hp));
  });

  it('a trap hits everyone with the full damage; Duncan\'s fee for the fallen is paid once', () => {
    let p = party(40);
    p = { ...p, members: p.members.map((m, i) => (i === 2 ? { ...m, hp: 2 } : m)) };
    const res = applySceneEffects(p, ids(p)[0], { damage: 5, damageTargets: ['todos'] });
    expect(res.party.members.map(m => m.hp)).toEqual([p.members[0].hp - 5, p.members[1].hp - 5, Math.ceil(p.members[2].maxHp / 2)]);
    expect(res.knockedOut.map(k => k.name)).toEqual(['Lía']);
    expect(res.goldLost).toBe(20);
    expect(res.party.gold).toBe(20);
    expect(res.hit).toEqual(['Brega', 'Tomás', 'Lía']);
  });

  it('healing can go to other members', () => {
    let p = party();
    p = { ...p, members: p.members.map(m => ({ ...m, hp: 1 })) };
    const res = applySceneEffects(p, ids(p)[0], { healing: 3, healingTargets: ['Tomás', 'Lía'] });
    expect(res.party.members.map(m => m.hp)).toEqual([1, 4, 4]);
  });

  it('conditions go to their own targets', () => {
    const p = party();
    const res = applySceneConditions(p, ids(p)[0], [
      { id: 'ensordecido', action: 'add', duration: { rest: 'long' }, targets: ['todos'] },
      { id: 'envenenado', action: 'add', duration: { rest: 'long' }, targets: ['Lía'] }
    ]);
    expect(res.party.members.every(m => hasCondition(m, 'ensordecido'))).toBe(true);
    expect(res.party.members.map(m => hasCondition(m, 'envenenado'))).toEqual([false, false, true]);
    expect(res.applied.map(a => a.name)).toEqual(['Brega', 'Tomás', 'Lía', 'Lía']);
  });

  it('exhaustion 6 makes each member collapse; Duncan charges once', () => {
    const p = party(40);
    const res = applySceneConditions(p, ids(p)[0], [{ id: 'agotamiento', action: 'add', level: 6, targets: ['Brega', 'Tomás'] }]);
    expect(res.collapsed).toEqual(['Brega', 'Tomás']);
    expect(res.party.members.slice(0, 2).map(exhaustionLevel)).toEqual([5, 5]);
    expect(res.goldLost).toBe(20);
  });

  it('limbs go to their own targets', () => {
    const p = party();
    const res = applySceneLimbs(p, ids(p)[0], [{ limb: 'leftLeg', status: 'disabled', targets: ['Tomás'] }]);
    expect(res.party.members[1].limbs.leftLeg).toBe('disabled');
    expect(res.party.members[0].limbs.leftLeg).toBe('ok');
    expect(res.applied).toEqual([{ name: 'Tomás', change: expect.objectContaining({ limb: 'leftLeg', status: 'disabled' }) }]);
  });
});
