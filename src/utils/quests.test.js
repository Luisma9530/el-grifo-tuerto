import { describe, it, expect } from 'vitest';
import {
  questGoldCap, questXp, validateReward, resolveRewardItem, cleanQuestChanges, applyQuestChanges,
  abandonQuest, normalizeQuests, describeReward, describeQuestsForPrompt, activeQuests, finishedQuests,
  unseenQuestCount, describeQuestChange
} from './quests';
import { localQuestScene, huntChangesAfterVictory, pickHuntTarget, isHuntTarget, bestiaryForHunts, withHuntTargets } from './localQuests';
import { characterLevel, withLevel } from './characterLevel';
import { normalizeEquipment } from './equipment';
import { buildDMPrompt, parseDMReply, DM_RESPONSE_SCHEMA } from './dmPrompt';

const hero = { name: 'Aria', level: 1, xp: 0, gold: 10, hp: 10, maxHp: 10, inventory: [] };
const open = (extra = {}) => ({
  action: 'open', title: 'Lobos en el molino', giver: 'Marta', place: 'Molino', objective: 'Ahuyentar a los lobos.',
  reward: { gold: 30, xp: true, importance: 'normal' }, ...extra
});

describe('reward caps', () => {
  it('scales the gold cap by tier of level', () => {
    expect(questGoldCap(1)).toBe(50);
    expect(questGoldCap(4)).toBe(200);
    expect(questGoldCap(5)).toBe(750);
    expect(questGoldCap(11)).toBe(5500);
    expect(questGoldCap(20)).toBe(30000);
    expect(questGoldCap(99)).toBe(30000);
  });

  it('gives XP as a share of the gap to the next level', () => {
    expect(questXp(1, 'minor')).toBe(30);
    expect(questXp(1, 'normal')).toBe(60);
    expect(questXp(1, 'major')).toBe(105);
    expect(questXp(20, 'normal')).toBeGreaterThan(0);
  });

  it('caps the gold Duncan proposes and keeps an item that fits', () => {
    expect(validateReward({ gold: 9999, xp: false }, 1)).toMatchObject({ gold: 50, itemKey: null, xp: 0 });
    // the potion (50 po) fills the level 1 cap: the gold goes down to fit it
    expect(validateReward({ gold: 40, item: 'Poción de curación' }, 1))
      .toMatchObject({ gold: 0, itemKey: 'potion:healing', itemName: 'Poción de curación' });
    // plate armor (1500 po) is far above a level 1 cap: dropped
    expect(validateReward({ gold: 20, item: 'Armadura de placas' }, 1)).toMatchObject({ gold: 20, itemKey: null });
    expect(validateReward({ gold: 20, item: 'Espada mágica del destino' }, 1).itemKey).toBeNull();
    expect(validateReward({ gold: -5 }, 1).gold).toBe(0);
  });

  it('a story-only quest pays nothing', () => {
    expect(validateReward({ gold: 40, xp: true, storyOnly: true }, 3)).toMatchObject({ gold: 0, itemKey: null, xp: 0 });
    expect(describeReward(validateReward({ storyOnly: true }, 3))).toBe('solo la historia');
  });

  it('resolves catalog items by key or name', () => {
    expect(resolveRewardItem('weapon:longsword')).toBe('weapon:longsword');
    expect(resolveRewardItem('weapon:nope')).toBeNull();
    expect(resolveRewardItem('Espada larga')).toBe('weapon:longsword');
    expect(resolveRewardItem('')).toBeNull();
  });
});

describe('cleanQuestChanges (Duncan reply)', () => {
  it('reads open, update and close changes', () => {
    const changes = cleanQuestChanges([
      { accion: 'abrir', titulo: ' Lobos ', objetivo: 'Ahuyentarlos', quienEncarga: 'Marta', recompensa: { oro: 30, experiencia: true, importancia: 'mayor' } },
      { accion: 'actualizar', id: 'm1', nota: 'Hay huellas' },
      { accion: 'cumplir', id: 'm2' }
    ]);
    expect(changes).toHaveLength(3);
    expect(changes[0]).toMatchObject({ action: 'open', title: 'Lobos', giver: 'Marta', reward: { gold: 30, xp: true, importance: 'major' } });
    expect(changes[1]).toMatchObject({ action: 'update', id: 'm1', note: 'Hay huellas' });
    expect(changes[2]).toMatchObject({ action: 'complete', id: 'm2' });
  });

  it('drops broken entries and keeps at most three', () => {
    expect(cleanQuestChanges('nope')).toEqual([]);
    expect(cleanQuestChanges([
      { accion: 'borrar', id: 'm1' }, { accion: 'abrir', titulo: 'Sin objetivo' }, { accion: 'actualizar', id: 'm1' }, null
    ])).toEqual([]);
    const many = Array.from({ length: 6 }, (_, i) => ({ accion: 'cumplir', id: `m${i}` }));
    expect(cleanQuestChanges(many)).toHaveLength(3);
  });

  it('is part of the schema and the parsed reply', () => {
    expect(DM_RESPONSE_SCHEMA.properties.misiones.items.properties.accion.enum).toEqual(['abrir', 'actualizar', 'cumplir', 'fallar']);
    const parsed = parseDMReply(JSON.stringify({
      narracion: 'Marta te pide ayuda.', usaTirada: false, danio: 0, curacion: 0, oro: 0, experiencia: 0, opciones: [],
      misiones: [{ accion: 'abrir', titulo: 'Lobos', objetivo: 'Ahuyentarlos' }]
    }), hero);
    expect(parsed.questChanges[0]).toMatchObject({ action: 'open', title: 'Lobos' });
  });

  it('the prompt lists the active quests and the cap for the level', () => {
    const { quests } = applyQuestChanges([], [open()], { character: hero, scene: 3 });
    const prompt = buildDMPrompt({ playerAction: 'x', character: hero, world: { name: 'V' }, d20: 5, quests: describeQuestsForPrompt(quests) });
    expect(prompt).toContain('m1 = «Lobos en el molino»');
    expect(prompt).toContain('no inventes otros');
    expect(prompt).toContain('50 po');
    expect(buildDMPrompt({ playerAction: 'x', character: hero, world: { name: 'V' }, d20: 5 })).toContain('no hay misiones activas');
  });
});

describe('applyQuestChanges', () => {
  it('opens a quest with a validated reward, a stamp and a fact', () => {
    const r = applyQuestChanges([], [open({ reward: { gold: 500, xp: true } })], { character: hero, scene: 4, date: '2026-01-02T00:00:00Z' });
    expect(r.quests).toHaveLength(1);
    expect(r.quests[0]).toMatchObject({ id: 'm1', status: 'active', reward: { gold: 50, xp: 60 }, started: { scene: 4 }, unseen: 'new' });
    expect(r.facts).toEqual(['Misión aceptada: «Lobos en el molino» (encargo de Marta)']);
    expect(r.character).toBe(hero);
  });

  it('ignores a repeated title', () => {
    const first = applyQuestChanges([], [open()], { character: hero });
    expect(applyQuestChanges(first.quests, [open({ title: 'lobos en el MOLINO' })], { character: hero }).applied).toEqual([]);
  });

  it('adds notes and changes the objective', () => {
    const first = applyQuestChanges([], [open()], { character: hero });
    const seen = first.quests.map(q => ({ ...q, unseen: false }));
    const r = applyQuestChanges(seen, [{ action: 'update', id: 'm1', note: 'Huellas al norte', objective: 'Seguir las huellas.' }], { character: hero, scene: 7 });
    expect(r.quests[0].notes.at(-1)).toMatchObject({ text: 'Huellas al norte', scene: 7 });
    expect(r.quests[0].objective).toBe('Seguir las huellas.');
    expect(r.quests[0].unseen).toBe('updated');
  });

  it('pays the promised reward when completed, and only then', () => {
    const first = applyQuestChanges([], [open({ reward: { gold: 30, item: 'Daga', xp: true, importance: 'normal' } })], { character: hero });
    const done = applyQuestChanges(first.quests, [{ action: 'complete', id: 'm1' }], { character: hero, scene: 9 });
    expect(done.quests[0]).toMatchObject({ status: 'completed', closed: { scene: 9 } });
    expect(done.character.gold).toBe(10 + done.quests[0].reward.gold);
    expect(done.character.inventory.map(i => i.name)).toEqual(['Daga']);
    expect(done.character.xp).toBe(60);
    expect(done.facts).toEqual(['Misión cumplida: «Lobos en el molino»']);
    expect(describeQuestChange(done.applied[0])).toContain('Recibes');
    // closing it again does nothing
    const again = applyQuestChanges(done.quests, [{ action: 'complete', id: 'm1' }], { character: done.character });
    expect(again.applied).toEqual([]);
    expect(again.character).toBe(done.character);
  });

  it('a failed quest pays nothing; unknown ids are ignored', () => {
    const first = applyQuestChanges([], [open()], { character: hero });
    const failed = applyQuestChanges(first.quests, [{ action: 'fail', id: 'm1' }, { action: 'complete', id: 'm7' }], { character: hero });
    expect(failed.quests[0].status).toBe('failed');
    expect(failed.character).toBe(hero);
    expect(failed.applied).toHaveLength(1);
  });

  it('finds the quest by title when the id is wrong', () => {
    const first = applyQuestChanges([], [open()], { character: hero });
    const r = applyQuestChanges(first.quests, [{ action: 'complete', id: 'x', title: 'Lobos en el molino' }], { character: hero });
    expect(r.quests[0].status).toBe('completed');
  });

  it('the player can abandon an active quest, without reward', () => {
    const first = applyQuestChanges([], [open()], { character: hero });
    const { quests, quest } = abandonQuest(first.quests, 'm1', { scene: 5 });
    expect(quest.status).toBe('abandoned');
    expect(activeQuests(quests)).toEqual([]);
    expect(finishedQuests(quests)).toHaveLength(1);
    expect(abandonQuest(quests, 'm1').quest).toBeNull();
  });
});

describe('normalizeQuests (old saves)', () => {
  it('starts empty and drops broken entries', () => {
    expect(normalizeQuests(undefined)).toEqual([]);
    const list = normalizeQuests([{ id: 'm1', title: 'A', status: 'raro', unseen: true }, { title: 'sin id' }, null]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ status: 'active', notes: [], unseen: false, reward: { gold: 0, xp: 0 } });
    expect(unseenQuestCount(list)).toBe(0);
  });
});

describe('local engine quests', () => {
  const world = { name: 'Valle', mapNodes: [{ id: 'a', name: 'Taberna', status: 'current' }, { id: 'b', name: 'Molino', status: 'discovered' }] };
  const here = world.mapNodes[0];

  it('ignores actions that are not about work', () => {
    expect(localQuestScene('pido una cerveza', { world, character: hero, here })).toBeNull();
  });

  const bestiary = {
    creatures: [
      { id: 'wolf', name: 'Lobo', cr: 0.25, xp: 50, type: 'bestia' },
      { id: 'boar', name: 'Jabalí', cr: 0.25, xp: 50, type: 'bestia' },
      { id: 'bandit', name: 'Bandido', cr: 0.125, xp: 25, type: 'humanoide' },
      { id: 'ogre', name: 'Ogro', cr: 2, xp: 450, type: 'gigante' }
    ],
    budget: { low: 50, moderate: 75, high: 100 }
  };
  const fight = (status, enemies) => ({ status, enemies });
  const enemy = (monsterId, type, status = 'dead') => ({ monsterId, type, status });

  it('picks a hunt target the hero can face: a creature or a whole type', () => {
    expect(pickHuntTarget(null)).toBeNull();
    // 0.9: no type hunt; picks a creature within the moderate budget (never the ogre)
    const creature = pickHuntTarget(bestiary, () => 0.9);
    expect(creature).toMatchObject({ by: 'creature' });
    expect(creature.monsterId).not.toBe('ogre');
    // 0.1: a type with at least two creatures (beasts)
    expect(pickHuntTarget(bestiary, () => 0.1)).toEqual({ by: 'type', type: 'bestia', name: 'bestias' });
  });

  it('offers a hunt that saves its target and only that target completes it', () => {
    const scene = localQuestScene('miro el tablón de anuncios', { world, character: hero, here, bestiary, rng: () => 0.9 });
    const target = scene.questChanges[0].goal.target;
    expect(scene.questChanges[0]).toMatchObject({ action: 'open', goal: { kind: 'hunt', target: { by: 'creature' } } });
    expect(scene.questChanges[0].title).toContain(target.name);
    const { quests } = applyQuestChanges([], scene.questChanges, { character: hero });
    expect(quests[0].goal.target).toEqual(target);

    // a victory against something else does not count
    expect(huntChangesAfterVictory(quests, fight('victory', [enemy('ogre', 'gigante')]))).toEqual([]);
    // the target fled: does not count; a lost fight does not count
    expect(huntChangesAfterVictory(quests, fight('victory', [enemy('ogre', 'gigante'), enemy(target.monsterId, 'x', 'fled')]))).toEqual([]);
    expect(huntChangesAfterVictory(quests, fight('defeat', [enemy(target.monsterId, 'x')]))).toEqual([]);
    // killed or surrendered: done, and the reward is paid
    expect(huntChangesAfterVictory(quests, fight('victory', [enemy(target.monsterId, 'x', 'surrendered')]))).toHaveLength(1);
    const changes = huntChangesAfterVictory(quests, fight('victory', [enemy(target.monsterId, 'x')]));
    expect(changes).toEqual([{ action: 'complete', id: 'm1', note: `Objetivo vencido en combate: ${target.name}.` }]);
    const done = applyQuestChanges(quests, changes, { character: hero });
    expect(done.quests[0].status).toBe('completed');
    expect(done.character.gold).toBeGreaterThan(hero.gold);
  });

  it('a hunt of a type is done by any creature of that type', () => {
    const target = { by: 'type', type: 'bestia', name: 'bestias' };
    expect(isHuntTarget(target, enemy('boar', 'bestia'))).toBe(true);
    expect(isHuntTarget(target, enemy('bandit', 'humanoide'))).toBe(false);
    const quests = [{ id: 'm1', title: 'Plaga de bestias', status: 'active', notes: [], goal: { kind: 'hunt', target } }];
    expect(huntChangesAfterVictory(quests, fight('victory', [enemy('wolf', 'bestia')]))).toHaveLength(1);
    // old hunts without a target are never closed by a fight
    expect(huntChangesAfterVictory([{ ...quests[0], goal: { kind: 'hunt' } }], fight('victory', [enemy('wolf', 'bestia')]))).toEqual([]);
  });

  it('the local engine fights the hunt target most of the time', () => {
    const quests = [{ id: 'm1', title: 'Se busca: Bandido', status: 'active', notes: [], goal: { kind: 'hunt', target: { by: 'creature', monsterId: 'bandit', name: 'Bandido' } } }];
    expect(bestiaryForHunts(bestiary, quests, () => 0.1).creatures.map(c => c.id)).toEqual(['bandit']);
    expect(bestiaryForHunts(bestiary, quests, () => 0.9)).toBe(bestiary);
    expect(bestiaryForHunts(bestiary, [], () => 0.1)).toBe(bestiary);
  });

  it('the hunt target is always among the creatures offered for a fight', () => {
    const quests = [{ id: 'm1', title: 'Se busca: Oso', status: 'active', notes: [], goal: { kind: 'hunt', target: { by: 'creature', monsterId: 'bear', name: 'Oso' } } }];
    const getMonster = id => (id === 'bear' ? { id: 'bear', name: 'Oso', cr: 1, xp: 200, type: 'bestia', hp: 34 } : null);
    const offered = withHuntTargets(bestiary, quests, getMonster);
    expect(offered.creatures.at(-1)).toEqual({ id: 'bear', name: 'Oso', cr: 1, xp: 200, type: 'bestia' });
    expect(withHuntTargets(offered, quests, getMonster)).toBe(offered);
    expect(withHuntTargets(bestiary, [], getMonster)).toBe(bestiary);
  });

  it('the prompt tells Duncan the hunt target', () => {
    const quests = [{ id: 'm1', title: 'Se busca: Bandido', objective: 'Vencer al bandido', status: 'active', notes: [], reward: { gold: 5, xp: 0 }, goal: { kind: 'hunt', target: { by: 'creature', monsterId: 'bandit', name: 'Bandido' } } }];
    expect(describeQuestsForPrompt(quests)).toContain('objetivo de caza: Bandido (id bandit)');
  });

  it('without creatures nor other places, there is no work today', () => {
    const lonely = { name: 'Valle', mapNodes: [here] };
    expect(localQuestScene('busco trabajo', { world: lonely, character: hero, here }).questChanges).toEqual([]);
  });

  it('offers an errand that is handed over at its destination', () => {
    const scene = localQuestScene('busco trabajo', { world, character: hero, here, rng: () => 0.1 });
    expect(scene.questChanges[0]).toMatchObject({ action: 'open', goal: { kind: 'errand', nodeId: 'b' } });
    const { quests } = applyQuestChanges([], scene.questChanges, { character: hero });
    // not there yet: no delivery
    expect(localQuestScene('entrego el paquete', { quests, world, character: hero, here, rng: () => 0.1 })).toBeNull();
    const there = localQuestScene('entrego el paquete', { quests, world, character: hero, here: world.mapNodes[1] });
    expect(there.questChanges).toEqual([{ action: 'complete', id: 'm1', note: 'Entregado en Molino.' }]);
  });

  it('does not pile up more than two local quests', () => {
    let quests = [];
    for (let i = 0; i < 2; i++) {
      const scene = localQuestScene('busco trabajo', { quests, world, character: hero, here, rng: () => (i ? 0.9 : 0.1) });
      quests = applyQuestChanges(quests, scene.questChanges, { character: hero }).quests;
    }
    expect(activeQuests(quests)).toHaveLength(2);
    expect(localQuestScene('¿alguna misión?', { quests, world, character: hero, here }).questChanges).toEqual([]);
  });
});

describe('characterLevel (older heroes without a level field)', () => {
  it('reads the level field, then the class text, then the XP, then 1', () => {
    expect(characterLevel({ level: 7, class: 'Pícaro (Nivel 3)' })).toBe(7);
    expect(characterLevel({ class: 'Paladín de la Devoción (Nivel 3)' })).toBe(3);
    expect(characterLevel({ class: 'Guerrero', xp: 2700 })).toBe(4);
    expect(characterLevel({ class: 'Guerrero', xp: 2699 })).toBe(3);
    expect(characterLevel({ class: 'Guerrero' })).toBe(1);
    expect(characterLevel({ class: 'Mago (Nivel 99)' })).toBe(20);
    expect(characterLevel(null)).toBe(1);
  });

  it('the sheet normalizer writes it, so the whole game uses the same level', () => {
    const old = { name: 'Valeria', class: 'Paladín (Nivel 3)', hp: 30, maxHp: 30, ac: 18, inventory: [] };
    expect(withLevel(old).level).toBe(3);
    expect(normalizeEquipment(old).level).toBe(3);
    const modern = { ...old, level: 5 };
    expect(withLevel(modern)).toBe(modern);
  });

  it('quest caps use the real level of an older hero', () => {
    const old = { name: 'Valeria', class: 'Paladín (Nivel 3)', gold: 0, inventory: [] };
    const r = applyQuestChanges([], [open({ reward: { gold: 9999, xp: true, importance: 'normal' } })], { character: old });
    expect(r.quests[0].reward).toMatchObject({ gold: questGoldCap(3), xp: questXp(3, 'normal') });
  });
});
