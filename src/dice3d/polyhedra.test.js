import { describe, it, expect } from 'vitest';
import {
  getDie, getTopIndex, labelsForResult, getFaceLayout, planDice,
  dot, sub, cross, centroid, normalize
} from './polyhedra';

// kind -> [vertices, faces, vertices per face]
const KINDS = { d4: [4, 4, 3], d6: [8, 6, 4], d8: [6, 8, 3], d10: [12, 10, 4], d12: [20, 12, 5], d20: [12, 20, 3] };

describe.each(Object.entries(KINDS))('%s geometry', (kind, [vertexCount, faceCount, faceSize]) => {
  const die = getDie(kind);

  it('has the right number of vertices, faces and edges', () => {
    expect(die.vertices).toHaveLength(vertexCount);
    expect(die.faces).toHaveLength(faceCount);
    die.faces.forEach(f => expect(f).toHaveLength(faceSize));
    const edges = new Set();
    die.faces.forEach(f => f.forEach((a, i) => {
      const b = f[(i + 1) % f.length];
      edges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }));
    expect(vertexCount - edges.size + faceCount).toBe(2); // Euler characteristic
  });

  it('has planar faces wound counter-clockwise seen from outside', () => {
    die.faces.forEach((f, i) => {
      const pts = f.map(v => die.vertices[v]);
      const n = die.normals[i];
      expect(dot(n, centroid(pts))).toBeGreaterThan(0);
      pts.forEach(p => expect(Math.abs(dot(sub(p, pts[0]), n))).toBeLessThan(1e-6));
      pts.forEach((p, k) => {
        const q = pts[(k + 1) % pts.length];
        const r = pts[(k + 2) % pts.length];
        expect(dot(cross(sub(q, p), sub(r, q)), n)).toBeGreaterThan(0); // convex, CCW
      });
    });
  });

  it('numbers every value once, with opposite faces adding up to sides + 1', () => {
    expect([...die.labels].sort((a, b) => a - b)).toEqual(Array.from({ length: die.sides }, (_, i) => i + 1));
    if (die.readFrom === 'face') {
      die.opposite.forEach((o, i) => {
        expect(o).toBeGreaterThanOrEqual(0);
        expect(die.labels[i] + die.labels[o]).toBe(die.sides + 1);
      });
    }
  });

  it('relabels so any landed face shows any value, keeping the numbering valid', () => {
    for (let landed = 0; landed < die.sides; landed++) {
      for (let value = 1; value <= die.sides; value++) {
        const labels = labelsForResult(die, landed, value);
        expect(labels[landed]).toBe(value);
        expect(new Set(labels).size).toBe(die.sides);
        if (die.readFrom === 'face') {
          die.opposite.forEach((o, i) => expect(labels[i] + labels[o]).toBe(die.sides + 1));
        }
      }
    }
  });

  it('lays out faces for texturing with the numeral upright', () => {
    die.faces.forEach((_, i) => {
      const { points, inradius } = getFaceLayout(die, i);
      expect(points).toHaveLength(faceSize);
      expect(inradius).toBeGreaterThan(0.2);
      // Signed area > 0: not mirrored when seen from outside
      const area = points.reduce((sum, p, k) => {
        const q = points[(k + 1) % points.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0);
      expect(area).toBeGreaterThan(0);
    });
  });
});

describe('getTopIndex', () => {
  it('finds the face pointing up', () => {
    const die = getDie('d6');
    const up = die.normals.findIndex(n => n[1] > 0.99);
    const top = getTopIndex(die, [0, 0, 0, 1]);
    expect(top.index).toBe(up);
    expect(top.alignment).toBeCloseTo(1, 5);
    // Rotate 90 degrees around X: the face that pointed to -z now points up
    const s = Math.SQRT1_2;
    const rotated = getTopIndex(die, [s, 0, 0, s]);
    expect(die.normals[rotated.index][2]).toBeCloseTo(-1, 5);
  });

  it('reads the d4 from the vertex pointing up', () => {
    const die = getDie('d4');
    // Rotate so vertex 0 points straight up
    const v = normalize(die.vertices[0]);
    const axis = normalize(cross(v, [0, 1, 0]));
    const half = Math.acos(v[1]) / 2;
    const q = [axis[0] * Math.sin(half), axis[1] * Math.sin(half), axis[2] * Math.sin(half), Math.cos(half)];
    const top = getTopIndex(die, q);
    expect(top.index).toBe(0);
    expect(top.alignment).toBeCloseTo(1, 5);
  });
});

describe('planDice', () => {
  it('uses a single die for standard dice', () => {
    const [d] = planDice(20, 17);
    expect(d).toMatchObject({ kind: 'd20', value: 17 });
    expect(d.format(17)).toBe('17');
  });

  it('splits a d100 into tens and units', () => {
    const read = value => planDice(100, value).map(d => d.format(d.value));
    expect(read(57)).toEqual(['50', '7']);
    expect(read(7)).toEqual(['00', '7']);
    expect(read(30)).toEqual(['30', '0']);
    expect(read(100)).toEqual(['00', '0']);
    planDice(100, 100).forEach(d => expect(d.value).toBe(10));
  });

  it('rejects unsupported dice and out-of-range values', () => {
    expect(() => planDice(7, 1)).toThrow();
    expect(() => planDice(20, 21)).toThrow();
    expect(() => planDice(6, 0)).toThrow();
  });
});
