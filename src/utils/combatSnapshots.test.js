import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_SNAPSHOTS, makeSnapshot, addSnapshot, setSnapshotResult, normalizeSnapshots, groupsToData, groupsFromData,
  describeGroups, recentFights
} from './combatSnapshots';
import { getMonster, eliteVersion } from './bestiary';
import { migrateCampaign, saveCampaign, getCampaignById, importCampaignsFromJson, getAllCampaigns } from './campaignStorage';
import { buildCharacter, randomDraft } from './characterBuilder';

const bandit = getMonster('bandit');
const cultist = getMonster('cultist');
const hero = {
  name: 'Aria', level: 3, hp: 12, maxHp: 20,
  inventory: [{ id: 'p', name: 'Poción de curación', type: 'consumable', potionId: 'healing', heal: '2d4+2', uses: 2 }],
  conditions: [], limbs: { rightArm: 'disabled' }
};
const groups = [
  { monster: bandit, count: 2 },
  { monster: eliteVersion(cultist), count: 1, name: 'Grak', trait: 'Odia la luz', elite: true }
];

beforeEach(() => localStorage.clear());

describe('snapshots of the start of a fight', () => {
  it('copy the hero as it was and name the enemies by bestiary id', () => {
    const snap = makeSnapshot({ character: hero, groups, world: { id: 'w', name: 'Valle' }, place: 'El puente', date: '2026-01-02T10:00:00.000Z' });
    expect(snap.character).toEqual(hero);
    expect(snap.character).not.toBe(hero);
    expect(snap).toMatchObject({ heroName: 'Aria', level: 3, place: 'El puente', worldName: 'Valle', result: null });
    expect(snap.groups).toEqual([
      { monsterId: 'bandit', monsterName: bandit.name, count: 2 },
      { monsterId: 'cultist', monsterName: cultist.name, count: 1, name: 'Grak', trait: 'Odia la luz', elite: true }
    ]);
    expect(describeGroups(snap.groups)).toBe(`2 × ${bandit.name}, Grak (${cultist.name}, élite)`);
  });

  it('rebuild the same groups, elite stat blocks included', () => {
    const back = groupsFromData(groupsToData(groups), { getMonster, eliteVersion });
    expect(back[0]).toEqual({ monster: bandit, count: 2 });
    expect(back[1].monster).toEqual(eliteVersion(cultist));
    expect(back[1]).toMatchObject({ name: 'Grak', trait: 'Odia la luz', elite: true });
    expect(groupsFromData([{ monsterId: 'nope', count: 1 }], { getMonster, eliteVersion })).toEqual([]);
  });

  it('keep only the last MAX_SNAPSHOTS, newest first', () => {
    let list = [];
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) list = addSnapshot(list, makeSnapshot({ character: hero, groups, id: `s${i}` }));
    expect(list).toHaveLength(MAX_SNAPSHOTS);
    expect(list[0].id).toBe(`s${MAX_SNAPSHOTS + 2}`);
    expect(list.map(s => s.id)).not.toContain('s0');
  });

  it('record the result of the fight', () => {
    const list = addSnapshot([], makeSnapshot({ character: hero, groups, id: 'a' }));
    const done = setSnapshotResult(list, 'a', { status: 'defeat', round: 4 });
    expect(done[0]).toMatchObject({ result: 'defeat', rounds: 4 });
    expect(list[0].result).toBeNull();
    expect(setSnapshotResult(list, 'a', { status: 'active', round: 2 })[0].result).toBeNull();
  });

  it('drop broken entries', () => {
    expect(normalizeSnapshots(null)).toEqual([]);
    expect(normalizeSnapshots([null, { id: 'x' }, { character: hero, groups: [] }])).toEqual([]);
  });
});

describe('snapshots saved with the campaign', () => {
  const campaign = { id: 'c1', title: 'Valle', world: { name: 'Valle', initialStory: '...' }, character: hero, messages: [] };

  it('older campaigns get an empty list', () => {
    expect(migrateCampaign(campaign).combatSnapshots).toEqual([]);
    localStorage.setItem('tavern_saved_campaigns', JSON.stringify([campaign]));
    expect(getCampaignById('c1').combatSnapshots).toEqual([]);
  });

  it('are saved, trimmed and survive export and import', () => {
    const many = Array.from({ length: MAX_SNAPSHOTS + 2 }, (_, i) => makeSnapshot({ character: hero, groups, id: `s${i}` }));
    saveCampaign({ ...campaign, combatSnapshots: many });
    const stored = getCampaignById('c1');
    expect(stored.combatSnapshots).toHaveLength(MAX_SNAPSHOTS);
    expect(stored.combatSnapshots[0].character).toEqual(hero);
    const result = importCampaignsFromJson(JSON.stringify({ campaign: stored }));
    expect(result.success).toBe(true);
    expect(getCampaignById(result.lastImportedId).combatSnapshots).toHaveLength(MAX_SNAPSHOTS);
  });

  it('list the recent fights of every campaign, newest first', () => {
    saveCampaign({ ...campaign, combatSnapshots: [makeSnapshot({ character: hero, groups, id: 'old', date: '2026-01-01T00:00:00Z' })] });
    saveCampaign({ ...campaign, id: 'c2', title: 'Otra', combatSnapshots: [makeSnapshot({ character: hero, groups, id: 'new', date: '2026-02-01T00:00:00Z' })] });
    const fights = recentFights(getAllCampaigns());
    expect(fights.map(f => [f.id, f.campaignTitle])).toEqual([['new', 'Otra'], ['old', 'Valle']]);
  });

  it('a full list of real hero sheets stays small', () => {
    const sheet = buildCharacter(randomDraft());
    const list = Array.from({ length: MAX_SNAPSHOTS }, (_, i) => makeSnapshot({ character: sheet, groups, id: `s${i}` }));
    expect(JSON.stringify(list).length).toBeLessThan(150000);
  });
});
