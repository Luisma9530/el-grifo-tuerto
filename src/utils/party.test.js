import { describe, it, expect } from 'vitest';
import {
  createParty, normalizeParty, memberSheet, activeSheet, updateMember, setActiveMember, addMember, removeMember,
  transferItem, splitXp, partyLevel, mergeHeroes, findMemberByName, describeCompanions, MAX_PARTY, LOCAL_CONTROLLER,
  updateEveryone, controllerOf
} from './party';
import { migrateCampaign } from './campaignStorage';
import { buildCharacter, emptyDraft, sanitizeDraft } from './characterBuilder';
import { createCondition } from './conditions';
import { XP_FOR_LEVEL } from '../data/progression';

const fighter = (name = 'Brega') => buildCharacter(sanitizeDraft({
  ...emptyDraft(), classId: 'fighter', backgroundId: 'soldier', speciesId: 'orc',
  baseScores: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['acrobatics', 'survival'], name, languages: ['Enano', 'Élfico']
}), { id: `hero_${name}` });

describe('creating a party', () => {
  it('pools the starting gold of every hero in a shared purse and gives them unique ids', () => {
    const a = fighter('Brega');
    const b = { ...fighter('Brena'), id: a.id }; // same id on purpose
    const party = createParty([a, b]);
    expect(party.members).toHaveLength(2);
    expect(new Set(party.members.map(m => m.id)).size).toBe(2);
    expect(party.gold).toBe(a.gold + b.gold);
    expect(party.members.every(m => m.gold === undefined)).toBe(true);
    expect(party.members.every(m => m.controlledBy === LOCAL_CONTROLLER)).toBe(true);
    expect(party.activeId).toBe(party.members[0].id);
  });

  it('keeps at most four members', () => {
    const party = createParty([1, 2, 3, 4, 5].map(n => fighter(`Héroe ${n}`)));
    expect(party.members).toHaveLength(MAX_PARTY);
  });
});

describe('old campaigns become a party of one without losing anything', () => {
  it('turns the single character into the only member, with their gold as the purse', () => {
    const hero = { ...fighter(), gold: 37.5, xp: 120, inventory: [{ id: 'p', name: 'Poción de curación', type: 'consumable', uses: 2 }] };
    const party = normalizeParty({ character: hero });
    expect(party.members).toHaveLength(1);
    expect(party.gold).toBe(37.5);
    expect(memberSheet(party, party.activeId)).toMatchObject({ name: 'Brega', xp: 120, gold: 37.5 });
    expect(memberSheet(party, party.activeId).inventory.find(i => i.id === 'p').uses).toBe(2);
  });

  it('migrateCampaign adds the party and keeps `character` as the lead with the purse', () => {
    const migrated = migrateCampaign({ world: { name: 'X' }, character: { ...fighter(), gold: 12 }, messages: [] });
    expect(migrated.party.members[0].name).toBe('Brega');
    expect(migrated.character).toMatchObject({ name: 'Brega', gold: 12 });
    // Running it again changes nothing
    expect(migrateCampaign(migrated).party).toEqual(migrated.party);
  });

  it('converts a fight in progress of the lone hero ("player") to the party format', () => {
    const hero = {
      ...fighter(),
      id: 'hero_old',
      conditions: [createCondition({ id: 'agarrado', duration: { escape: 12 } }, { sourceUid: 'goblin-1', targetUid: 'player' })]
    };
    const sleep = createCondition({ id: 'incapacitado', duration: 'endOfSourceNextTurn' }, { sourceUid: 'player', targetUid: 'goblin-1' });
    const encounter = {
      round: 2, turn: 0, status: 'active', xp: 0, log: [{ round: 1, kind: 'condition', text: '...', target: 'player' }],
      order: [{ kind: 'player', initiative: 15 }, { kind: 'enemy', uid: 'goblin-1', initiative: 10 }],
      enemies: [{ uid: 'goblin-1', name: 'Goblin', hp: 7, maxHp: 7, status: 'active', conditions: [sleep], actions: [] }],
      dodging: true,
      concentration: { spellId: 'holdPerson', name: 'Inmovilizar persona', token: 't1' },
      immunities: ['goblin-1:gaze']
    };
    const migrated = migrateCampaign({ world: { name: 'X' }, character: hero, encounter, messages: [] });
    const id = migrated.party.members[0].id;
    expect(id).toBe('hero_old');
    expect(migrated.encounter.order[0]).toMatchObject({ kind: 'player', uid: id });
    expect(migrated.encounter.heroIds).toEqual([id]);
    expect(migrated.encounter.dodging).toEqual([id]);
    expect(migrated.encounter.concentrations).toEqual({ [id]: encounter.concentration });
    expect(migrated.encounter.immunities).toEqual([`goblin-1:gaze:${id}`]);
    expect(migrated.encounter.enemies[0].conditions[0].sourceUid).toBe(id);
    expect(migrated.encounter.enemies[0].conditions[0].duration.of).toBe(id);
    expect(migrated.encounter.log[0].target).toBe(id);
    expect(migrated.party.members[0].conditions[0].sourceUid).toBe('goblin-1');
  });
});

describe('changing members', () => {
  it('updateMember writes the gold spent by one member to the shared purse', () => {
    let party = createParty([fighter('Aldo'), fighter('Bruna')], { gold: 50 });
    const [a, b] = party.members;
    party = updateMember(party, a.id, sheet => ({ ...sheet, gold: sheet.gold - 20, hp: 3 }));
    expect(party.gold).toBe(30);
    expect(memberSheet(party, b.id).gold).toBe(30);
    expect(party.members[0].hp).toBe(3);
    expect(party.members[0].gold).toBeUndefined();
  });

  it('updateEveryone changes each member (a rest for the whole party)', () => {
    let party = createParty([fighter('Aldo'), fighter('Bruna')]);
    party = updateEveryone(party, sheet => ({ ...sheet, hp: 1 }));
    expect(party.members.map(m => m.hp)).toEqual([1, 1]);
  });

  it('chooses who acts outside combat', () => {
    let party = createParty([fighter('Aldo'), fighter('Bruna')]);
    party = setActiveMember(party, party.members[1].id);
    expect(activeSheet(party).name).toBe('Bruna');
    expect(setActiveMember(party, 'nobody')).toBe(party);
  });

  it('adds companions up to four and never removes the last member', () => {
    let party = createParty([fighter('Aldo')]);
    for (const name of ['Bruna', 'Ciro', 'Dana']) party = addMember(party, fighter(name)).party;
    expect(addMember(party, fighter('Enzo'))).toMatchObject({ ok: false });
    const out = removeMember(party, party.members[0].id);
    expect(out.ok).toBe(true);
    expect(out.party.members.map(m => m.name)).toEqual(['Bruna', 'Ciro', 'Dana']);
    expect(out.party.activeId).toBe(out.party.members[0].id);
    const lone = createParty([fighter('Solo')]);
    expect(removeMember(lone, lone.members[0].id)).toMatchObject({ ok: false });
  });

  it('a companion who joins does not bring gold to the purse', () => {
    const party = createParty([fighter('Aldo')], { gold: 10 });
    expect(addMember(party, { ...fighter('Bruna'), gold: 99 }).party.gold).toBe(10);
  });

  it('finds members by name', () => {
    const party = createParty([fighter('Brena Hachafría'), fighter('Tomás')]);
    expect(findMemberByName(party, 'brena')?.name).toBe('Brena Hachafría');
    expect(findMemberByName(party, 'Tomás')?.name).toBe('Tomás');
    expect(findMemberByName(party, 'Nadie')).toBeNull();
  });

  it('mergeHeroes puts the heroes of a fight back, keeping the purse', () => {
    const party = createParty([fighter('Aldo'), fighter('Bruna')], { gold: 5 });
    const heroes = party.members.map(m => ({ ...m, hp: 2, gold: 999 }));
    const merged = mergeHeroes(party, heroes);
    expect(merged.gold).toBe(5);
    expect(merged.members.map(m => m.hp)).toEqual([2, 2]);
  });

  it('every member is controlled by the local player for now', () => {
    const party = createParty([fighter('Aldo')]);
    expect(controllerOf(party, party.members[0].id)).toBe('local');
  });
});

describe('passing items between members', () => {
  it('takes the item off the giver (hands or armor) and puts it in the receiver\'s backpack', () => {
    let party = createParty([fighter('Aldo'), fighter('Bruna')]);
    const [a, b] = party.members;
    const weapon = a.hands.main;
    const armor = a.wornArmor;
    let res = transferItem(party, a.id, b.id, weapon);
    expect(res.ok).toBe(true);
    party = res.party;
    expect(party.members[0].hands.main).toBeNull();
    expect(party.members[0].inventory.some(i => i.id === weapon)).toBe(false);
    expect(party.members[1].inventory.filter(i => i.name === res.item.name).length).toBeGreaterThan(0);
    res = transferItem(party, a.id, b.id, armor);
    expect(res.party.members[0].wornArmor).toBeNull();
    expect(res.party.members[0].ac).toBeLessThan(a.ac);
    // ids stay unique in the receiver's backpack
    const ids = res.party.members[1].inventory.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stacks potions and refuses impossible transfers', () => {
    const potion = id => ({ id, name: 'Poción de curación', type: 'consumable', potionId: 'healing', uses: 1 });
    let party = createParty([{ ...fighter('Aldo'), inventory: [potion('p1')] }, { ...fighter('Bruna'), inventory: [potion('p2')] }]);
    const [a, b] = party.members;
    party = transferItem(party, a.id, b.id, 'p1').party;
    expect(party.members[1].inventory.filter(i => i.potionId === 'healing')).toEqual([expect.objectContaining({ uses: 2 })]);
    expect(transferItem(party, a.id, a.id, 'p1').ok).toBe(false);
    expect(transferItem(party, a.id, b.id, 'nope').ok).toBe(false);
  });
});

describe('experience for the party', () => {
  it('splits the XP between the members who took part, rounding down', () => {
    let party = createParty([fighter('Aldo'), fighter('Bruna'), fighter('Ciro')]);
    const ids = party.members.map(m => m.id);
    const res = splitXp(party, 100, ids.slice(0, 2));
    expect(res.share).toBe(50);
    expect(res.party.members.map(m => m.xp)).toEqual([50, 50, 0]);
    party = res.party;
    expect(splitXp(party, 1, ids).share).toBe(0);
  });

  it('says who can now go up a level', () => {
    const party = createParty([fighter('Aldo'), { ...fighter('Bruna'), xp: XP_FOR_LEVEL[2] - 10 }]);
    const res = splitXp(party, 40);
    expect(res.ready).toEqual(['Bruna']);
  });

  it('partyLevel is the average level rounded down', () => {
    const party = createParty([{ ...fighter('Aldo'), level: 3 }, { ...fighter('Bruna'), level: 4 }]);
    expect(partyLevel(party)).toBe(3);
  });
});

describe('the summary of the companions for Duncan', () => {
  it('lists the others, not the one who acts', () => {
    const party = createParty([fighter('Aldo'), { ...fighter('Bruna'), hp: 0 }]);
    const text = describeCompanions(party, party.members[0].id);
    expect(text).toContain('Bruna (');
    expect(text).toContain('inconsciente');
    expect(text).not.toContain('Aldo (');
  });
});
