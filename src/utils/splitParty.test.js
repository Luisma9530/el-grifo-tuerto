import { describe, it, expect } from 'vitest';
import { createParty, normalizeParty, removeMember, addMember, memberSheet } from './party';
import { restParty, applySceneEffects, finishFight } from './partyActions';
import {
  startApart, isSplit, groupOf, scopeParty, unscopeParty, inScope, moveGroup, countSceneTurn, nextQueued,
  sceneWorld, sceneMessages, tagNewMessages, readablePrologues, visibleScenes, placeNewMember, setHook,
  normalizeSplit, SCENE_TURNS, sceneIdOf
} from './splitParty';

const hero = (id, name, over = {}) => ({ id, name, race: 'Humano', class: 'Guerrero', hp: 10, maxHp: 20, ac: 12, gold: 0, inventory: [], stats: { con: 10 }, hitDie: 10, level: 1, ...over });
const world = {
  id: 'w', name: 'Mundo',
  mapNodes: [
    { id: 'tavern', name: 'Taberna', settlement: 'tavern', status: 'current' },
    { id: 'z1', name: 'Minas', settlement: 'town', status: 'discovered' },
    { id: 'z2', name: 'Monasterio', settlement: 'village', status: 'discovered' },
    { id: 'z3', name: 'Bosque', settlement: 'village', status: 'discovered' }
  ]
};

const apart = () => startApart(
  createParty([hero('a', 'Ana'), hero('b', 'Bruno'), hero('c', 'Cira')]),
  { a: 'z1', b: 'z2', c: 'z2' },
  { gold: { a: 10, b: 20, c: 5 }, meetingNodeId: 'tavern' }
);

describe('party separada', () => {
  it('los que empiezan en la misma zona comparten grupo y bolsa', () => {
    const party = apart();
    expect(isSplit(party)).toBe(true);
    expect(party.split.groups).toHaveLength(2);
    expect(groupOf(party, 'b').id).toBe(groupOf(party, 'c').id);
    expect(groupOf(party, 'b').gold).toBe(25);
    expect(groupOf(party, 'a').gold).toBe(10);
  });

  it('el ámbito de una escena solo tiene a los presentes y su bolsa', () => {
    const party = apart();
    const scope = scopeParty(party, 'b');
    expect(scope.members.map(m => m.id)).toEqual(['b', 'c']);
    expect(scope.gold).toBe(25);
    expect(memberSheet(scope, 'b').gold).toBe(25);
  });

  it('los descansos solo afectan a los presentes y pagan de su bolsa', () => {
    const party = apart();
    const next = inScope(party, 'b', scope => restParty(scope, 'long', () => 1).party);
    expect(next.members.find(m => m.id === 'b').hp).toBe(20);
    expect(next.members.find(m => m.id === 'c').hp).toBe(20);
    expect(next.members.find(m => m.id === 'a').hp).toBe(10);
    expect(groupOf(next, 'b').gold).toBe(15); // 2 habitaciones de 5
    expect(groupOf(next, 'a').gold).toBe(10);
  });

  it('los efectos de escena «todos» no alcanzan a los que están lejos', () => {
    const party = apart();
    const next = inScope(party, 'a', scope => applySceneEffects(scope, 'a', { damage: 3, damageTargets: ['todos'], goldChange: 4 }).party);
    expect(next.members.map(m => m.hp)).toEqual([7, 10, 10]);
    expect(groupOf(next, 'a').gold).toBe(14);
    expect(groupOf(next, 'b').gold).toBe(25);
  });

  it('un combate solo da experiencia y botín a los que lucharon', () => {
    const party = apart();
    const encounter = { status: 'victory', heroIds: ['b', 'c'], xp: 100, enemies: [] };
    const next = inScope(party, 'b', scope => finishFight(scope, encounter, { loot: { coins: 6, items: [] }, receiverId: 'b' }).party);
    expect(next.members.find(m => m.id === 'a').xp || 0).toBe(0);
    expect(next.members.find(m => m.id === 'b').xp).toBe(50);
    expect(groupOf(next, 'b').gold).toBe(31);
    expect(groupOf(next, 'a').gold).toBe(10);
  });

  it('un compañero reclutado se une al grupo de quien actúa', () => {
    const party = apart();
    const next = inScope(party, 'a', scope => addMember(scope, hero('d', 'Dario')).party);
    expect(next.members).toHaveLength(4);
    expect(groupOf(next, 'd').id).toBe(groupOf(next, 'a').id);
  });

  it('despedir al único de un grupo deshace la separación si solo queda otro', () => {
    const party = apart();
    const res = removeMember(party, 'a');
    expect(isSplit(res.party)).toBe(false);
    expect(res.party.gold).toBe(35);
  });

  it('cada escena ve el mundo desde su lugar', () => {
    const party = apart();
    const seen = sceneWorld(world, party, 'a');
    expect(seen.mapNodes.find(n => n.status === 'current').id).toBe('z1');
    expect(sceneWorld(world, party, 'b').mapNodes.find(n => n.status === 'current').id).toBe('z2');
    expect(sceneWorld(world, createParty([hero('x', 'X')]))).toBe(world);
  });
});

describe('el encuentro', () => {
  it('al llegar donde está otro grupo se unen; los prólogos se conservan', () => {
    let party = apart();
    const ga = groupOf(party, 'a').id;
    const gb = groupOf(party, 'b').id;
    party = setHook(party, ga, { kind: 'rumor', text: 'Oyó hablar del monasterio.', source: 'duncan' });
    const res = moveGroup(party, ga, 'z2', { place: 'Monasterio' });
    expect(res.ended).toBe(true);
    expect(isSplit(res.party)).toBe(false);
    expect(res.party.gold).toBe(35);
    expect(res.met.joined.map(j => j.names)).toEqual(['Ana', 'Bruno y Cira']);
    expect(res.met.joined[0].hook.text).toContain('monasterio');
    expect(res.party.prologues.map(p => p.id)).toEqual([ga, gb]);
    expect(res.party.prologues[1].memberIds).toEqual(['b', 'c']);
  });

  it('sin coincidir, solo cambia de lugar', () => {
    const party = apart();
    const ga = groupOf(party, 'a').id;
    const res = moveGroup(party, ga, 'tavern');
    expect(res.met).toBeNull();
    expect(groupOf(res.party, 'a').nodeId).toBe('tavern');
  });

  it('con tres grupos, dos se unen y el tercero sigue aparte', () => {
    let party = startApart(createParty([hero('a', 'Ana'), hero('b', 'Bruno'), hero('c', 'Cira')]), { a: 'z1', b: 'z2', c: 'z3' }, { meetingNodeId: 'tavern' });
    party = moveGroup(party, groupOf(party, 'a').id, 'tavern').party;
    const res = moveGroup(party, groupOf(party, 'b').id, 'tavern');
    expect(res.ended).toBe(false);
    expect(res.party.split.groups).toHaveLength(2);
    expect(groupOf(res.party, 'a').id).toBe(groupOf(res.party, 'b').id);
    expect(res.met.groupId).toBe(groupOf(res.party, 'a').id);
    // la nueva crónica común del grupo unido es otra escena
    expect(sceneIdOf(res.party, 'a')).not.toBe(res.met.joined[0].id);
  });
});

describe('turnos entre escenas', () => {
  it(`tras ${SCENE_TURNS} acciones la escena pasa al siguiente grupo`, () => {
    let party = apart();
    const ga = groupOf(party, 'a').id;
    let res;
    for (let i = 0; i < SCENE_TURNS - 1; i++) {
      res = countSceneTurn(party, ga);
      expect(res.pass).toBeNull();
      party = res.party;
    }
    res = countSceneTurn(party, ga);
    expect(res.pass.id).toBe(groupOf(party, 'b').id);
    expect(groupOf(res.party, 'a').turns).toBe(SCENE_TURNS);
  });

  it('la cola online alterna entre grupos', () => {
    const party = apart();
    const ga = groupOf(party, 'a').id;
    const queue = [{ id: 1, characterId: 'a' }, { id: 2, characterId: 'a' }, { id: 3, characterId: 'c' }];
    expect(nextQueued(queue, party, null).id).toBe(1);
    expect(nextQueued(queue, party, ga).id).toBe(3);
    expect(nextQueued([{ id: 1, characterId: 'a' }], party, ga).id).toBe(1);
    expect(nextQueued(queue, createParty([hero('a', 'Ana')]), ga).id).toBe(1);
  });
});

describe('crónicas por escena', () => {
  it('los mensajes nuevos se etiquetan con su escena', () => {
    const prev = [{ text: 'a' }];
    const next = tagNewMessages(prev, [...prev, { text: 'b' }], 'g1');
    expect(next[0].groupId).toBeUndefined();
    expect(next[1].groupId).toBe('g1');
    expect(sceneMessages(next, 'g1')).toHaveLength(1);
    expect(sceneMessages(next, null)).toHaveLength(1);
    expect(tagNewMessages(prev, [...prev, { text: 'b' }], null)[1].groupId).toBeUndefined();
  });

  it('cada jugador lee solo los prólogos y escenas de sus personajes', () => {
    let party = apart();
    party = moveGroup(party, groupOf(party, 'a').id, 'z2').party;
    expect(readablePrologues(party, ['a'])).toHaveLength(1);
    expect(readablePrologues(party, null)).toHaveLength(2);
    const three = startApart(createParty([hero('a', 'Ana'), hero('b', 'Bruno')]), { a: 'z1', b: 'z2' });
    expect(visibleScenes(three, world, ['a']).map(s => s.place)).toEqual(['Minas']);
    expect(visibleScenes(three, world, null)).toHaveLength(2);
  });
});

describe('nuevos personajes y guardado', () => {
  it('un héroe nuevo empieza en su zona; si el grupo está allí, se queda con él', () => {
    const party = createParty([hero('a', 'Ana'), hero('b', 'Bruno')]);
    const split = placeNewMember(party, 'b', 'z1', { hereNodeId: 'tavern' });
    expect(isSplit(split)).toBe(true);
    expect(groupOf(split, 'b').nodeId).toBe('z1');
    expect(groupOf(split, 'a').nodeId).toBe('tavern');
    expect(isSplit(placeNewMember(party, 'b', 'tavern', { hereNodeId: 'tavern' }))).toBe(false);
  });

  it('se guarda y se migra: las campañas antiguas siguen juntas', () => {
    const old = normalizeParty({ character: hero('a', 'Ana', { gold: 7 }) });
    expect(old.split).toBeUndefined();
    expect(old.startMode).toBeUndefined();
    const saved = JSON.parse(JSON.stringify(apart()));
    const back = normalizeParty({ party: saved });
    expect(back.split.groups).toEqual(saved.split.groups);
    expect(back.startMode).toBe('origins');
  });

  it('la migración limpia grupos rotos', () => {
    const party = createParty([hero('a', 'Ana'), hero('b', 'Bruno')]);
    const clean = normalizeSplit(party, { split: { groups: [{ id: 'g1', memberIds: ['a', 'zzz'], gold: -3 }, { id: 'g2', memberIds: [] }, 'x'] } });
    expect(isSplit(clean)).toBe(false); // un solo grupo válido: juntos
    const two = normalizeSplit(party, { split: { groups: [{ id: 'g1', memberIds: ['a'], nodeId: 'z1', gold: 3, hook: { kind: 'otro', text: 'x' } }, { id: 'g2', memberIds: [], nodeId: 'z2' }, { id: 'g3', memberIds: ['b', 'a'], nodeId: 'z3' }] } });
    expect(two.split.groups.map(g => g.memberIds)).toEqual([['a'], ['b']]);
    expect(two.split.groups[0].hook).toBeNull();
  });

  it('unscope con la party junta devuelve el ámbito tal cual', () => {
    const party = createParty([hero('a', 'Ana')]);
    const scope = scopeParty(party, 'a');
    expect(scope).toBe(party);
    const changed = { ...party, gold: 9 };
    expect(unscopeParty(party, 'a', changed)).toBe(changed);
  });
});
