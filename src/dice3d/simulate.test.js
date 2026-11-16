import { describe, it, expect } from 'vitest';
import { simulateThrow, FRAME_DT } from './simulate';
import { getDie, getTopIndex, labelsForResult } from './polyhedra';

// Deterministic random source so the tests are reproducible
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WIDE = { halfW: 11, halfD: 6.2 };
const TALL = { halfW: 5.5, halfD: 10 };

describe('simulateThrow', () => {
  it.each(['d4', 'd6', 'd8', 'd10', 'd12', 'd20'])('a %s settles flat inside the tray', kind => {
    const rng = seeded(7);
    for (const bounds of [WIDE, TALL]) {
      for (let i = 0; i < 12; i++) {
        const sim = simulateThrow([kind], bounds, rng);
        expect(sim.ok).toBe(true);
        expect(sim.duration).toBeGreaterThan(0.5);
        expect(sim.duration).toBeLessThan(5.1);

        const last = sim.frames[sim.frames.length - 1];
        expect(Math.abs(last[0])).toBeLessThan(bounds.halfW);
        expect(Math.abs(last[2])).toBeLessThan(bounds.halfD);

        // The recorded final orientation agrees with the reported top face
        const die = getDie(kind);
        const top = getTopIndex(die, [last[3], last[4], last[5], last[6]]);
        expect(top.index).toBe(sim.tops[0]);
        expect(top.alignment).toBeGreaterThan(0.98);
      }
    }
  });

  it('can make the landed face show any rolled value', () => {
    const die = getDie('d20');
    const sim = simulateThrow(['d20'], WIDE, seeded(3));
    for (let value = 1; value <= 20; value++) {
      expect(labelsForResult(die, sim.tops[0], value)[sim.tops[0]]).toBe(value);
    }
  });

  it('throws two dice for a d100 without overlapping at rest', () => {
    const rng = seeded(11);
    for (let i = 0; i < 10; i++) {
      const sim = simulateThrow(['d10', 'd10'], TALL, rng);
      expect(sim.ok).toBe(true);
      expect(sim.tops).toHaveLength(2);
      const last = sim.frames[sim.frames.length - 1];
      expect(last).toHaveLength(14);
      const gap = Math.hypot(last[0] - last[7], last[2] - last[9]);
      expect(gap).toBeGreaterThan(1.5);
    }
  });

  it('records frames at 60 fps and impacts for sound effects', () => {
    const sim = simulateThrow(['d6'], WIDE, seeded(5));
    expect(FRAME_DT).toBeCloseTo(1 / 60, 6);
    expect(sim.frames.length).toBeGreaterThan(30);
    expect(sim.impacts.length).toBeGreaterThan(1);
    sim.impacts.forEach(hit => {
      expect(hit.time).toBeGreaterThan(0);
      expect(hit.time).toBeLessThanOrEqual(sim.duration + FRAME_DT);
      expect(hit.strength).toBeGreaterThan(0);
    });
  });
});
