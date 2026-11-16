import { describe, it, expect } from 'vitest';
import { applySceneOutcome } from './sceneOutcome';

const hero = { hp: 20, maxHp: 28, gold: 41 };

describe('applySceneOutcome', () => {
  it('applies damage, healing and gold within limits', () => {
    expect(applySceneOutcome(hero, { damage: 5 })).toEqual({ hp: 15, gold: 41, knockedOut: false, goldLost: 0 });
    expect(applySceneOutcome(hero, { healing: 50 }).hp).toBe(28); // never above max
    expect(applySceneOutcome(hero, { goldChange: -100 }).gold).toBe(0); // never negative
    expect(applySceneOutcome(hero, { goldChange: 9 }).gold).toBe(50);
    expect(applySceneOutcome(hero)).toEqual({ hp: 20, gold: 41, knockedOut: false, goldLost: 0 });
  });

  it('knocks the hero out at 0 HP: half HP back, half the gold as fee', () => {
    expect(applySceneOutcome(hero, { damage: 20 })).toEqual({ hp: 14, gold: 21, knockedOut: true, goldLost: 20 });
    expect(applySceneOutcome(hero, { damage: 999 }).knockedOut).toBe(true);
  });

  it('counts gold earned in the same scene before taking the fee', () => {
    expect(applySceneOutcome(hero, { damage: 20, goldChange: 9 })).toMatchObject({ gold: 25, goldLost: 25 });
  });

  it('healing in the same scene can prevent the knock-out', () => {
    expect(applySceneOutcome(hero, { damage: 20, healing: 3 })).toMatchObject({ hp: 3, knockedOut: false });
  });

  it('copes with odd sheets', () => {
    expect(applySceneOutcome({ hp: 1, maxHp: 1, gold: 0 }, { damage: 1 })).toEqual({ hp: 1, gold: 0, knockedOut: true, goldLost: 0 });
    expect(applySceneOutcome({ hp: 0, maxHp: 10, gold: 5 }, {})).toMatchObject({ hp: 0, knockedOut: false });
  });
});
