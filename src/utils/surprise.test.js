import { describe, it, expect } from 'vitest';
import {
  createEncounter, addOpening, playerAction, currentHeroUid, isPlayerTurn, openingPending, describeEncounterResult,
  describeSurprise, passivePerception
} from './encounter';
import {
  cleanSurprise, cleanOpeningHint, readCombatStart, detectOpeningStrike, openingReady, localSurprise, localAmbush,
  isQuietScene, checkFromAction, AMBUSH_CHANCE
} from './surprise';
import { buildCharacter, emptyDraft, sanitizeDraft } from './characterBuilder';
import { attackOptions } from './combat';
import { spellRows } from './spellcasting';

const dice = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

const goblin = {
  id: 'goblin', name: 'Goblin', type: 'humanoide', cr: 0.25, xp: 50, ac: 13, hp: 7, initiative: 2,
  stats: { fue: 8, des: 14, con: 10, int: 10, sab: 8, car: 8 },
  actions: [{ id: 'scimitar', name: 'Cimitarra', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'perforante' }]
};
const guard = {
  id: 'guard', name: 'Guardia', type: 'humanoide', cr: 0.125, xp: 25, ac: 16, hp: 11, initiative: 1,
  stats: { fue: 13, des: 12, con: 12, int: 10, sab: 11, car: 10 },
  actions: [{ id: 'spear', name: 'Lanza', kind: 'melee', bonus: 3, damage: '1d6+1', type: 'perforante' }]
};
const ogre = {
  id: 'ogre', name: 'Ogro', type: 'gigante', cr: 2, xp: 450, ac: 11, hp: 59, initiative: -1, fearless: true,
  stats: { fue: 19, des: 8, con: 16, int: 5, sab: 7, car: 7 },
  actions: [{ id: 'club', name: 'Garrote', kind: 'melee', bonus: 6, damage: '2d8+4', type: 'contundente' }]
};

const fighter = (name, id) => buildCharacter(sanitizeDraft({
  ...emptyDraft(), classId: 'fighter', backgroundId: 'soldier', speciesId: 'orc',
  baseScores: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['acrobatics', 'survival'], name, languages: ['Enano', 'Élfico']
}), { id });

const cleric = (name, id) => buildCharacter(sanitizeDraft({
  ...emptyDraft(), classId: 'cleric', backgroundId: 'soldier', speciesId: 'orc',
  baseScores: { fue: 14, des: 8, con: 13, int: 10, sab: 15, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['medicine', 'religion'],
  spells: { class: { cantrips: ['sacredFlame', 'guidance', 'light'], spells: ['cureWounds', 'guidingBolt', 'bless', 'healingWord'] } },
  name, languages: ['Orco', 'Enano']
}), { id });

const weaponOf = hero => attackOptions(hero).find(o => o.weapon);

describe('surprise: the initiative with Disadvantage', () => {
  it('surprised enemies roll two d20 and keep the lower', () => {
    const hero = fighter('Brega', 'a');
    // goblin: 18 and 3 -> 3 + 2 = 5; Brega 10 + 2
    const enc = createEncounter([{ monster: goblin }], [hero], dice(18, 3, 10), { surprise: { side: 'enemies', reason: 'en plena charla' } });
    expect(enc.enemies[0].initiative).toBe(5);
    expect(enc.enemies[0].surprised).toBe(true);
    expect(enc.surprise).toMatchObject({ side: 'enemies', uids: ['goblin-1'], names: ['Goblin'] });
    expect(enc.log.find(e => e.kind === 'surprise').text).toMatch(/Goblin no lo ve venir: queda sorprendido \(en plena charla\) y tira la iniciativa con desventaja/);
  });

  it('without surprise nothing changes (one d20 each)', () => {
    const hero = fighter('Brega', 'a');
    const enc = createEncounter([{ monster: goblin }], [hero], dice(18, 3, 10));
    expect(enc.enemies[0].initiative).toBe(20);
    expect(enc.surprise).toBeUndefined();
    expect(enc.log.some(e => e.kind === 'surprise')).toBe(false);
  });

  it('only the named enemies are surprised', () => {
    const hero = fighter('Brega', 'a');
    const enc = createEncounter([{ monster: goblin }, { monster: ogre }], [hero], dice(18, 3, 15, 10), { surprise: { side: 'enemies', who: ['ogre'] } });
    expect(enc.enemies.find(e => e.monsterId === 'goblin').surprised).toBeUndefined();
    expect(enc.enemies.find(e => e.monsterId === 'goblin').initiative).toBe(20);
    // ogre: 3 and 15 -> 3 - 1
    expect(enc.enemies.find(e => e.monsterId === 'ogre').initiative).toBe(2);
  });

  it('an ambush: the surprised heroes roll with Disadvantage', () => {
    const party = [fighter('Brega', 'a'), fighter('Tora', 'b')];
    // goblin 10; Brega 19 and 4 -> 4 + 2; Tora 12 (not surprised)
    const enc = createEncounter([{ monster: goblin }], party, dice(10, 19, 4, 12), { surprise: { side: 'heroes', who: ['Brega'] } });
    expect(enc.order.find(o => o.uid === 'a').initiative).toBe(6);
    expect(enc.order.find(o => o.uid === 'b').initiative).toBe(14);
    expect(enc.surprise.uids).toEqual(['a']);
    expect(enc.log.find(e => e.kind === 'surprise').text).toContain('Brega cae en una emboscada');
  });

  it('a whole party ambushed', () => {
    const party = [fighter('Brega', 'a'), fighter('Tora', 'b')];
    const enc = createEncounter([{ monster: goblin }], party, dice(10), { surprise: { side: 'heroes' } });
    expect(enc.surprise.uids).toEqual(['a', 'b']);
    expect(enc.log.find(e => e.kind === 'surprise').text).toContain('El grupo cae en una emboscada');
  });

  it('a Stealth check against passive Perception: whoever notices it is not surprised', () => {
    const hero = fighter('Brega', 'a');
    // Goblin: passive Perception 9; Guardia 10. Brega rolls 8 + Stealth
    const stealth = { side: 'enemies', check: { skill: 'stealth', heroUid: 'a' } };
    expect(passivePerception({ stats: goblin.stats }, false)).toBe(9);
    const enc = createEncounter([{ monster: goblin }, { monster: guard }], [hero], dice(8, 10, 10, 10, 10, 10), { surprise: stealth });
    const total = enc.surprise.check.total;
    expect(enc.surprise.check.skill).toBe('stealth');
    const surprised = enc.enemies.filter(e => e.surprised).map(e => e.monsterId);
    expect(surprised).toEqual([9, 10].filter(pp => pp < total).map(pp => (pp === 9 ? 'goblin' : 'guard')));
    expect(enc.log.find(e => e.kind === 'surprise').text).toMatch(/Brega tira Sigilo/);
  });

  it('a check nobody fails to notice: nobody is surprised', () => {
    const hero = fighter('Brega', 'a');
    const enc = createEncounter([{ monster: ogre }], [hero], dice(1, 10, 10), { surprise: { side: 'enemies', check: { skill: 'deception', heroUid: 'a' } } });
    expect(enc.enemies[0].surprised).toBeUndefined();
    expect(enc.surprise.uids).toEqual([]);
    expect(enc.log.filter(e => e.kind === 'surprise').map(e => e.text).join(' ')).toContain('Nadie queda sorprendido');
  });

  it('the ambushers roll Stealth against each hero', () => {
    const party = [fighter('Brega', 'a'), fighter('Tora', 'b')];
    // A natural 20 + 2: nobody notices
    const enc = createEncounter([{ monster: goblin }], party, dice(20, 10, 10, 10, 10, 10), { surprise: { side: 'heroes', check: { skill: 'stealth' } } });
    expect(enc.surprise.uids).toEqual(['a', 'b']);
    expect(enc.log.find(e => e.kind === 'surprise').text).toMatch(/Los atacantes tiran Sigilo: 20\+2 = 22/);
  });
});

describe('the opening strike', () => {
  it('the weapon and the target named are detected', () => {
    const hero = fighter('Brega', 'a');
    const enc = createEncounter([{ monster: goblin }, { monster: ogre }], [hero], dice(10));
    const weapon = weaponOf(hero);
    const opening = detectOpeningStrike(`Le clavo la ${weapon.name.toLowerCase()} al ogro`, hero, enc.enemies);
    expect(opening.suggest).toEqual({ type: 'attack', optionId: weapon.id, targetUid: 'ogre-2' });
    expect(openingReady(opening)).toBe(true);
  });

  it('without a weapon named, the weapon in hand; without a target named among different enemies, the player chooses', () => {
    const hero = fighter('Brega', 'a');
    const enc = createEncounter([{ monster: goblin }, { monster: ogre }], [hero], dice(10));
    const opening = detectOpeningStrike('¡Ataco!', hero, enc.enemies);
    expect(opening.suggest.optionId).toBe(weaponOf(hero).id);
    expect(opening.needs).toEqual({ means: false, target: true });
    expect(opening.choices.targets).toEqual(['goblin-1', 'ogre-2']);
    expect(openingReady(opening)).toBe(false);
  });

  it('copies of the same creature are one choice (and a number picks one)', () => {
    const hero = fighter('Brega', 'a');
    const enc = createEncounter([{ monster: guard, count: 3 }], [hero], dice(10));
    expect(detectOpeningStrike('ataco al guardia', hero, enc.enemies).suggest.targetUid).toBe('guard-1');
    expect(detectOpeningStrike('ataco a los guardias', hero, enc.enemies).needs.target).toBe(false);
    expect(detectOpeningStrike('ataco al guardia 2', hero, enc.enemies).suggest.targetUid).toBe('guard-2');
  });

  it("Duncan's target is used when the words don't name one", () => {
    const hero = fighter('Brega', 'a');
    const enc = createEncounter([{ monster: goblin }, { monster: ogre, name: 'Grum', trait: 'el tabernero' }], [hero], dice(10));
    expect(detectOpeningStrike('Le doy un tajo', hero, enc.enemies, { targetId: 'ogre' }).suggest.targetUid).toBe('ogre-2');
    // ...and a proper name or a trait works too
    expect(detectOpeningStrike('Le doy un tajo al tabernero', hero, enc.enemies).suggest.targetUid).toBe('ogre-2');
    expect(detectOpeningStrike('Voy a por Grum', hero, enc.enemies).suggest.targetUid).toBe('ogre-2');
  });

  it('a spell named', () => {
    const hero = cleric('Sora', 'c');
    const enc = createEncounter([{ monster: goblin }], [hero], dice(10));
    const opening = detectOpeningStrike('Le lanzo una llama sagrada al goblin', hero, enc.enemies);
    expect(opening.suggest).toEqual({ type: 'spell', spellId: 'sacredFlame', targetUid: 'goblin-1' });
  });

  it('"un conjuro" with several offensive spells: the player chooses which', () => {
    const hero = cleric('Sora', 'c');
    const enc = createEncounter([{ monster: goblin }], [hero], dice(10));
    const opening = detectOpeningStrike('Le lanzo un conjuro', hero, enc.enemies);
    expect(opening.needs.means).toBe(true);
    expect(opening.choices.spells).toEqual(expect.arrayContaining(['sacredFlame', 'guidingBolt']));
    expect(opening.choices.spells).not.toContain('cureWounds');
  });

  it('two different weapons in hand and none named: the player chooses', () => {
    const base = fighter('Brega', 'a');
    const dagger = { id: 'dg', name: 'Daga', type: 'weapon', weaponId: 'dagger' };
    const sword = { id: 'sw', name: 'Espada corta', type: 'weapon', weaponId: 'shortsword' };
    const hero = { ...base, inventory: [...base.inventory, dagger, sword], hands: { main: 'sw', off: 'dg' } };
    const names = attackOptions(hero).filter(o => o.weapon).map(o => o.name);
    expect(new Set(names).size).toBe(2);
    const enc = createEncounter([{ monster: goblin }], [hero], dice(10));
    const opening = detectOpeningStrike('Me lanzo contra el goblin', hero, enc.enemies);
    expect(opening.needs).toEqual({ means: true, target: false });
    expect(opening.choices.options).toEqual(['sw', 'dg']);
    expect(detectOpeningStrike('Le clavo la daga al goblin', hero, enc.enemies).suggest.optionId).toBe('dg');
  });

  it('is played before the initiative, with Advantage against a surprised target, and its damage counts', () => {
    const hero = fighter('Brega', 'a');
    const weapon = weaponOf(hero);
    // initiative: ogre 18/2 -> 2 - 1 = 1 (surprised); Brega 5 + 2 = 7
    let enc = createEncounter([{ monster: ogre }], [hero], dice(18, 2, 5), { surprise: { side: 'enemies' } });
    enc = addOpening(enc, [hero], { heroUid: 'a', suggest: { type: 'attack', optionId: weapon.id, targetUid: 'ogre-1' } });
    expect(openingPending(enc)).toBe(true);
    expect(isPlayerTurn(enc)).toBe(true);
    expect(currentHeroUid(enc)).toBe('a');
    // Attack with Advantage: 3 and 15; damage dice 6s
    const res = playerAction(enc, [hero], { type: 'attack', optionId: weapon.id, targetUid: 'ogre-1' }, dice(3, 15, 6, 6, 6, 6));
    expect(res.ok).toBe(true);
    const log = res.encounter.log.map(e => e.text).join('\n');
    expect(log).toContain('objetivo desprevenido');
    const ogreNow = res.encounter.enemies[0];
    expect(ogreNow.hp).toBeLessThan(59);
    expect(ogreNow.unaware).toBeUndefined();
    expect(res.encounter.opening).toMatchObject({ done: true, result: { targetUid: 'ogre-1', damage: 59 - ogreNow.hp, surprised: true } });
    expect(log).toMatch(/Golpe de apertura de Brega .*: \d+ de daño; Ogro empieza el combate herido/);
    // The strike was Brega's turn of round 1: his slot (7) is skipped, the ogre (1) acts,
    // and from round 2 on Brega acts in his normal order
    const log2 = res.encounter.log.map(e => e.text);
    const skipped = log2.findIndex(t => t === 'Brega ya actuó en esta ronda con su golpe de apertura.');
    expect(skipped).toBeGreaterThan(-1);
    expect(log2.findIndex(t => t.startsWith('Ogro ataca'))).toBeGreaterThan(skipped);
    expect(res.encounter.round).toBe(2);
    expect(currentHeroUid(res.encounter)).toBe('a');
    expect(res.encounter.actionUsed).toBe(false);
    expect(res.encounter.opening.turnSpent).toBe(true);
    expect(res.animations[0].label).toContain('ataque');
    // Round 2: Brega acts and the turn goes on normally (no second skip)
    const r2 = playerAction(res.encounter, res.heroes, { type: 'dodge' }, dice(1, 1, 1));
    expect(r2.encounter.log.filter(e => e.text.includes('ya actuó en esta ronda'))).toHaveLength(1);
    expect(r2.encounter.round).toBe(3);
  });

  it('a hero who gives the strike up keeps the turn of round 1', () => {
    const hero = fighter('Brega', 'a');
    let enc = createEncounter([{ monster: ogre }], [hero], dice(1, 20));
    enc = addOpening(enc, [hero], { heroUid: 'a' });
    const res = playerAction(enc, [hero], { type: 'endTurn' }, dice(1));
    expect(res.encounter.round).toBe(1);
    expect(currentHeroUid(res.encounter)).toBe('a');
    expect(res.encounter.log.some(e => e.text.includes('ya actuó en esta ronda'))).toBe(false);
  });

  it('a target that is not surprised: no Advantage', () => {
    const hero = fighter('Brega', 'a');
    const weapon = weaponOf(hero);
    let enc = createEncounter([{ monster: ogre }], [hero], dice(1, 20));
    enc = addOpening(enc, [hero], { heroUid: 'a', suggest: { type: 'attack', optionId: weapon.id, targetUid: 'ogre-1' } });
    const res = playerAction(enc, [hero], { type: 'attack', optionId: weapon.id, targetUid: 'ogre-1' }, dice(15, 3, 3, 3, 3));
    expect(res.encounter.log.map(e => e.text).join('\n')).not.toContain('desprevenido');
  });

  it('the target may die before the initiative (and the fight may end there)', () => {
    const hero = fighter('Brega', 'a');
    const weapon = weaponOf(hero);
    const weak = { ...goblin, hp: 1 };
    let enc = createEncounter([{ monster: weak }], [hero], dice(20, 20, 1), { surprise: { side: 'enemies' } });
    enc = addOpening(enc, [hero], { heroUid: 'a' });
    const res = playerAction(enc, [hero], { type: 'attack', optionId: weapon.id, targetUid: 'goblin-1' }, dice(15, 15, 6, 6));
    expect(res.encounter.enemies[0].status).toBe('dead');
    expect(res.encounter.status).toBe('victory');
    expect(res.encounter.opening.result.status).toBe('dead');
    expect(res.encounter.log.map(e => e.text).join('\n')).toContain('Goblin cae antes de poder reaccionar');
    expect(describeSurprise(res.encounter, [hero])).toMatch(/^Brega sorprende a Goblin; golpe de apertura de Brega contra Goblin .*, y Goblin cae\.$/);
    expect(describeEncounterResult(res.encounter, [hero])).toContain('Brega sorprende a Goblin');
  });

  it('the target dies and the rest of the fight goes on with the initiative', () => {
    const hero = fighter('Brega', 'a');
    const weapon = weaponOf(hero);
    const weak = { ...goblin, hp: 1 };
    // goblin 1: 20; goblin 2: 19; Brega 1 + 2. Enemies act first after the opening
    let enc = createEncounter([{ monster: weak, count: 2 }], [hero], dice(20, 19, 1));
    enc = addOpening(enc, [hero], { heroUid: 'a' });
    const res = playerAction(enc, [hero], { type: 'attack', optionId: weapon.id, targetUid: 'goblin-1' }, dice(15, 6, 6, 2, 2, 2, 2, 2));
    expect(res.encounter.enemies[0].status).toBe('dead');
    expect(res.encounter.status).toBe('active');
    // Goblin 2 had its turn; now Brega's
    expect(res.encounter.log.some(e => e.kind?.startsWith('enemy') && e.text.startsWith('Goblin 2'))).toBe(true);
    expect(currentHeroUid(res.encounter)).toBe('a');
  });

  it('a spell as opening strike: slots, damage and concentration count', () => {
    const hero = cleric('Sora', 'c');
    const slotsBefore = hero.spellcasting.slots;
    let enc = createEncounter([{ monster: ogre }], [hero], dice(1, 20));
    enc = addOpening(enc, [hero], { heroUid: 'c' });
    const res = playerAction(enc, [hero], { type: 'spell', spellId: 'guidingBolt', targetUid: 'ogre-1' }, dice(18, 6, 6, 6, 6));
    expect(res.ok).toBe(true);
    expect(res.encounter.enemies[0].hp).toBeLessThan(59);
    expect(res.character.spellcasting.slots).not.toEqual(slotsBefore);
    expect(res.encounter.opening.result.with).toBe('Saeta Guía');
  });

  it('a healing spell or a dodge is not an opening strike', () => {
    const hero = cleric('Sora', 'c');
    let enc = createEncounter([{ monster: ogre }], [hero], dice(1, 20));
    enc = addOpening(enc, [hero], { heroUid: 'c' });
    expect(playerAction(enc, [hero], { type: 'spell', spellId: 'cureWounds' }, dice(5)).ok).toBe(false);
    expect(playerAction(enc, [hero], { type: 'dodge' }, dice(5)).ok).toBe(false);
    // A target is needed
    const sacred = spellRows(hero).find(s => s.id === 'sacredFlame');
    expect(playerAction(enc, [hero], { type: 'spell', spellId: sacred.id }, dice(5)).error).toMatch(/Elige a qué enemigo/);
  });

  it('can be given up: the initiative starts', () => {
    const hero = fighter('Brega', 'a');
    let enc = createEncounter([{ monster: ogre }], [hero], dice(20, 1));
    enc = addOpening(enc, [hero], { heroUid: 'a' });
    const res = playerAction(enc, [hero], { type: 'endTurn' }, dice(1, 1, 1));
    expect(res.ok).toBe(true);
    expect(res.encounter.opening).toMatchObject({ done: true, result: { skipped: true } });
    // The ogre won the initiative and already attacked
    expect(res.encounter.log.some(e => e.text.startsWith('Ogro ataca'))).toBe(true);
    expect(describeSurprise(res.encounter, [hero])).toBe('');
  });

  it('any member of the party can strike first; the others wait for the initiative', () => {
    const party = [fighter('Brega', 'a'), fighter('Tora', 'b')];
    const weapon = weaponOf(party[1]);
    // goblin 20, Brega 5, Tora 3
    let enc = createEncounter([{ monster: ogre }], party, dice(20, 5, 3));
    enc = addOpening(enc, party, { heroUid: 'b' });
    expect(currentHeroUid(enc)).toBe('b');
    const res = playerAction(enc, party, { type: 'attack', optionId: weapon.id, targetUid: 'ogre-1' }, dice(15, 4, 4, 1, 1, 1, 1));
    expect(res.ok).toBe(true);
    expect(res.character.id).toBe('b');
    expect(res.encounter.opening.result.target).toBe('Ogro');
    expect(res.encounter.enemies[0].targetUid).toBe('b'); // it goes for whoever hit it
    expect(describeSurprise(res.encounter, party)).toMatch(/^Golpe de apertura de Tora contra Ogro/);
  });

  it('only a hero of the fight, once, before it begins', () => {
    const hero = fighter('Brega', 'a');
    const enc = createEncounter([{ monster: ogre }], [hero], dice(10));
    expect(addOpening(enc, [hero], { heroUid: 'zzz' })).toBe(enc);
    const once = addOpening(enc, [hero], { heroUid: 'a' });
    expect(addOpening(once, [hero], { heroUid: 'a' })).toBe(once);
  });
});

describe("Duncan's surprise field (validated)", () => {
  const ctx = { enemyIds: ['bandit', 'thug'], partyNames: ['Brega', 'Tora'], actorId: 'a' };

  it('the enemies surprised, all or some', () => {
    expect(cleanSurprise({ quien: 'enemigos', motivo: 'en mitad de la charla' }, ctx)).toEqual({ side: 'enemies', who: 'all', reason: 'en mitad de la charla' });
    expect(cleanSurprise({ quien: 'enemigos', afectados: ['thug', 'dragon'] }, ctx).who).toEqual(['thug']);
    expect(cleanSurprise({ quien: 'enemigos', afectados: ['todos'] }, ctx).who).toBe('all');
    // Unknown names only: the whole side
    expect(cleanSurprise({ quien: 'enemigos', afectados: ['el guardia'] }, ctx).who).toBe('all');
  });

  it('the party ambushed, never by its own attack', () => {
    expect(cleanSurprise({ quien: 'grupo', afectados: ['tora'] }, ctx)).toMatchObject({ side: 'heroes', who: ['tora'] });
    expect(cleanSurprise({ quien: 'grupo' }, { ...ctx, heroAttacks: true })).toBeNull();
  });

  it('the checks', () => {
    expect(cleanSurprise({ quien: 'enemigos', tirada: 'engano' }, ctx).check).toEqual({ skill: 'deception', heroUid: 'a' });
    expect(cleanSurprise({ quien: 'enemigos', tirada: 'Sigilo' }, ctx).check).toEqual({ skill: 'stealth', heroUid: 'a' });
    // Ambushers hide: always Stealth
    expect(cleanSurprise({ quien: 'grupo', tirada: 'engano' }, ctx).check).toEqual({ skill: 'stealth' });
    expect(cleanSurprise({ quien: 'enemigos', tirada: 'acrobacias' }, ctx).check).toBeUndefined();
  });

  it('nonsense is ignored', () => {
    expect(cleanSurprise(null, ctx)).toBeNull();
    expect(cleanSurprise('enemigos', ctx)).toBeNull();
    expect(cleanSurprise({ quien: 'nadie' }, ctx)).toBeNull();
    expect(cleanSurprise({ quien: 'todos' }, ctx)).toBeNull();
    expect(cleanSurprise({ quien: 'enemigos', motivo: 'x'.repeat(500) }, ctx).reason).toHaveLength(120);
  });

  it("the hero's attack and its target", () => {
    expect(cleanOpeningHint({ ataqueDelHeroe: true, objetivo: 'thug' }, ['bandit', 'thug'])).toEqual({ attacks: true, targetId: 'thug' });
    expect(cleanOpeningHint({ ataqueDelHeroe: 'sí', objetivo: 'dragon' }, ['bandit'])).toEqual({ attacks: null, targetId: null });
  });

  it('readCombatStart: Duncan decides, the words fill the gaps', () => {
    const combat = { enemigos: [{ id: 'bandit', cantidad: 2 }], sorpresa: { quien: 'enemigos' }, objetivo: 'bandit' };
    expect(readCombatStart(combat, { aggressive: true, partyNames: ['Brega'], actorId: 'a' }))
      .toMatchObject({ heroAttacks: true, targetId: 'bandit', surprise: { side: 'enemies', who: 'all' } });
    // Duncan says the hero doesn't attack: no opening strike
    expect(readCombatStart({ ...combat, ataqueDelHeroe: false }, { aggressive: true }).heroAttacks).toBe(false);
    // An ambush while the hero attacks is dropped
    expect(readCombatStart({ enemigos: [{ id: 'bandit' }], sorpresa: { quien: 'grupo' } }, { aggressive: true }).surprise).toBeNull();
  });
});

describe('the local engine', () => {
  it('an attack in a quiet scene surprises the enemies', () => {
    const quiet = [{ sender: 'duncan', text: 'Duncan te sirve otra jarra y sigue con su historia del molino.' }];
    expect(isQuietScene(quiet)).toBe(true);
    expect(localSurprise({ actionText: 'Le clavo la daga al tabernero', history: quiet, aggressive: true, actorId: 'a' }))
      .toEqual({ side: 'enemies', who: 'all', reason: 'nadie esperaba el ataque' });
  });

  it('a tense scene: no surprise, unless the hero sneaks up or lies', () => {
    const tense = [{ sender: 'duncan', text: 'El matón desenvaina y te amenaza con la hoja.' }];
    expect(isQuietScene(tense)).toBe(false);
    expect(localSurprise({ actionText: 'Ataco al matón', history: tense, aggressive: true })).toBeNull();
    expect(localSurprise({ actionText: 'Me acerco por la espalda y lo apuñalo', history: tense, aggressive: true, actorId: 'a' }))
      .toMatchObject({ side: 'enemies', check: { skill: 'stealth', heroUid: 'a' } });
    expect(checkFromAction('Mientras le hablo, le clavo la daga')).toBe('deception');
    expect(localSurprise({ actionText: 'hola', history: [], aggressive: false })).toBeNull();
  });

  it('exploring the wild may meet an ambush; a settlement is safe', () => {
    const wild = { name: 'Bosque', settlement: null };
    expect(AMBUSH_CHANCE).toBe(0.08);
    // Never two in a row
    expect(localAmbush({ actionText: 'Me adentro en el bosque', here: wild, rng: () => 0, lastWasAmbush: true })).toBeNull();
    expect(localAmbush({ actionText: 'Me adentro en el bosque', here: wild, rng: () => AMBUSH_CHANCE / 2 }))
      .toEqual({ side: 'heroes', who: 'all', reason: 'los esperaban escondidos', check: { skill: 'stealth' } });
    expect(localAmbush({ actionText: 'Me adentro en el bosque', here: wild, rng: () => 0.99 })).toBeNull();
    expect(localAmbush({ actionText: 'Recorro el mercado', here: { settlement: 'town' }, rng: () => 0 })).toBeNull();
    expect(localAmbush({ actionText: 'Pido una cerveza', here: wild, rng: () => 0 })).toBeNull();
  });
});
