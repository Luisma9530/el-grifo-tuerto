import { describe, it, expect } from 'vitest';
import { normalizeRoll, diceNotation, getRollOutcome } from './controller';

describe('dice roll helpers', () => {
  it('writes dice notation', () => {
    expect(diceNotation([{ sides: 20, value: 3 }])).toBe('d20');
    expect(diceNotation([{ sides: 6, value: 1 }, { sides: 6, value: 2 }, { sides: 6, value: 3 }])).toBe('3d6');
    expect(diceNotation([{ sides: 8, value: 1 }, { sides: 8, value: 2 }, { sides: 4, value: 3 }])).toBe('2d8 + 1d4');
  });

  it('normalizes a single die', () => {
    expect(normalizeRoll({ sides: 20, value: 20, modifier: 3, label: 'Fuerza' })).toMatchObject({
      dice: [{ sides: 20, value: 20 }], value: 20, notation: 'd20', outcome: 'crit', modifier: 3, label: 'Fuerza'
    });
    expect(normalizeRoll({ sides: 20, value: 1 }).outcome).toBe('fumble');
    expect(normalizeRoll({ sides: 12, value: 12 }).outcome).toBe('normal');
  });

  it('sums several dice and never treats them as a critical', () => {
    const roll = normalizeRoll({ dice: [{ sides: 6, value: 6 }, { sides: 6, value: 5 }, { sides: 6, value: 1 }], label: 'Daño' });
    expect(roll).toMatchObject({ value: 12, notation: '3d6', outcome: 'normal' });
    expect(normalizeRoll({ dice: [{ sides: 20, value: 20 }, { sides: 20, value: 20 }] }).outcome).toBe('normal');
  });

  it('only a d20 can crit or fumble', () => {
    expect(getRollOutcome(20, 20)).toBe('crit');
    expect(getRollOutcome(20, 1)).toBe('fumble');
    expect(getRollOutcome(6, 1)).toBe('normal');
  });
});
