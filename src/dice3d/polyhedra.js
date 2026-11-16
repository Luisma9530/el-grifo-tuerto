// Pure geometry for polyhedral dice (no rendering / physics dependencies).
// Every die is a convex polyhedron centred on the origin with faces wound
// counter-clockwise when seen from outside.

const PHI = (1 + Math.sqrt(5)) / 2;

// --- tiny vector helpers ----------------------------------------------------
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
export const length = a => Math.hypot(a[0], a[1], a[2]);
export const normalize = a => scale(a, 1 / (length(a) || 1));

export function centroid(points) {
  const sum = points.reduce((acc, p) => add(acc, p), [0, 0, 0]);
  return scale(sum, 1 / points.length);
}

/** Rotate vector v by quaternion q = [x, y, z, w]. */
export function applyQuaternion(v, q) {
  const [x, y, z, w] = q;
  const u = [x, y, z];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, w)), cross(u, t));
}

// --- face construction ------------------------------------------------------

/** Order the given vertex indices counter-clockwise around the outward normal n. */
function orderFace(vertices, indices, n) {
  const c = centroid(indices.map(i => vertices[i]));
  const e1 = normalize(sub(vertices[indices[0]], c));
  const e2 = cross(n, e1);
  return indices
    .map(i => {
      const d = sub(vertices[i], c);
      return { i, angle: Math.atan2(dot(d, e2), dot(d, e1)) };
    })
    .sort((a, b) => a.angle - b.angle)
    .map(p => p.i);
}

/** A face is the set of vertices furthest along each face-normal direction. */
function facesFromNormals(vertices, normals) {
  return normals.map(raw => {
    const n = normalize(raw);
    const dots = vertices.map(v => dot(v, n));
    const max = Math.max(...dots);
    const indices = dots.map((d, i) => (max - d < 1e-6 ? i : -1)).filter(i => i >= 0);
    return orderFace(vertices, indices, n);
  });
}

function signedPermutations(coords) {
  // All sign combinations of a coordinate triple (zeros are not duplicated)
  const out = [];
  const signs = [1, -1];
  signs.forEach(sx => signs.forEach(sy => signs.forEach(sz => {
    const v = [coords[0] * sx, coords[1] * sy, coords[2] * sz];
    if (!out.some(o => length(sub(o, v)) < 1e-9)) out.push(v);
  })));
  return out;
}

function cyclic(coords) {
  const [a, b, c] = coords;
  return [[a, b, c], [c, a, b], [b, c, a]].flatMap(signedPermutations);
}

const CUBE_VERTS = signedPermutations([1, 1, 1]);
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const ICOSA_VERTS = cyclic([0, 1, PHI]);
const DODECA_VERTS = [...CUBE_VERTS, ...cyclic([0, 1 / PHI, PHI])];

function buildD10() {
  // Pentagonal trapezohedron: two apexes and a zig-zag ring of 10 vertices.
  const c = Math.cos(Math.PI / 5);
  const h = 1;
  const d = (h * (1 - c)) / (1 + c); // makes the kite faces planar
  const ring = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5;
    return [Math.cos(a), Math.sin(a), i % 2 === 0 ? d : -d];
  });
  const vertices = [[0, 0, h], [0, 0, -h], ...ring];
  const V = i => 2 + (i % 10);
  const faces = [];
  for (let k = 0; k < 5; k++) {
    faces.push([0, V(2 * k), V(2 * k + 1), V(2 * k + 2)]); // top kite, apex first
    faces.push([1, V(2 * k + 1), V(2 * k + 2), V(2 * k + 3)]); // bottom kite
  }
  return { vertices, faces };
}

/** Make sure a face is wound CCW seen from outside, keeping its first vertex first. */
function fixWinding(vertices, face) {
  const [a, b, c] = face.map(i => vertices[i]);
  const n = cross(sub(b, a), sub(c, a));
  const centre = centroid(face.map(i => vertices[i]));
  return dot(n, centre) >= 0 ? face : [face[0], ...face.slice(1).reverse()];
}

const SHAPES = {
  d4: () => {
    const vertices = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    return { vertices, faces: facesFromNormals(vertices, vertices.map(v => scale(v, -1))) };
  },
  d6: () => ({ vertices: CUBE_VERTS, faces: facesFromNormals(CUBE_VERTS, AXES) }),
  d8: () => ({ vertices: AXES, faces: facesFromNormals(AXES, CUBE_VERTS) }),
  d10: buildD10,
  // Face normals are the vertices of the dual solid (in its matching orientation)
  d12: () => ({ vertices: DODECA_VERTS, faces: facesFromNormals(DODECA_VERTS, cyclic([0, PHI, 1])) }),
  d20: () => ({
    vertices: ICOSA_VERTS,
    faces: facesFromNormals(ICOSA_VERTS, [...CUBE_VERTS, ...cyclic([0, PHI, 1 / PHI])])
  })
};

// Circumradius of each die, so they look similarly sized on the table
const RADIUS = { d4: 1.5, d6: 1.3, d8: 1.4, d10: 1.4, d12: 1.3, d20: 1.35 };

const cache = new Map();

/**
 * Build (and cache) a die definition.
 * @param {'d4'|'d6'|'d8'|'d10'|'d12'|'d20'} kind
 * @returns {{
 *   kind: string, sides: number, readFrom: 'face'|'vertex',
 *   vertices: number[][], faces: number[][], normals: number[][],
 *   opposite: number[], labels: number[]
 * }}
 *   `labels[i]` is the value shown on face i (or on vertex i for the d4, which is
 *   read from the vertex pointing up). `opposite[i]` is the antipodal face (-1 if none).
 */
export function getDie(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const build = SHAPES[kind];
  if (!build) throw new Error(`Unknown die: ${kind}`);

  const shape = build();
  const maxR = Math.max(...shape.vertices.map(length));
  const vertices = shape.vertices.map(v => scale(v, RADIUS[kind] / maxR));
  const faces = shape.faces.map(f => fixWinding(vertices, f));
  const normals = faces.map(f => {
    const [a, b, c] = f.map(i => vertices[i]);
    return normalize(cross(sub(b, a), sub(c, a)));
  });

  const readFrom = kind === 'd4' ? 'vertex' : 'face';
  const sides = readFrom === 'vertex' ? vertices.length : faces.length;

  const opposite = normals.map((n, i) =>
    normals.findIndex((m, j) => j !== i && dot(n, m) < -0.999)
  );

  // Standard numbering: opposite faces add up to sides + 1
  const labels = new Array(sides).fill(0);
  if (readFrom === 'vertex') {
    labels.forEach((_, i) => { labels[i] = i + 1; });
  } else {
    let next = 1;
    for (let i = 0; i < sides; i++) {
      if (labels[i]) continue;
      labels[i] = next;
      if (opposite[i] >= 0) labels[opposite[i]] = sides + 1 - next;
      next++;
      while (labels.includes(next)) next++;
    }
  }

  const die = { kind, sides, readFrom, vertices, faces, normals, opposite, labels };
  cache.set(kind, die);
  return die;
}

/**
 * Which face (or vertex, for the d4) points up for a die with orientation `quat`.
 * Returns { index, alignment } where alignment is 1 when perfectly flat.
 */
export function getTopIndex(die, quat) {
  const directions = die.readFrom === 'vertex' ? die.vertices.map(normalize) : die.normals;
  let index = 0;
  let best = -Infinity;
  directions.forEach((dir, i) => {
    const y = applyQuaternion(dir, quat)[1];
    if (y > best) {
      best = y;
      index = i;
    }
  });
  if (die.readFrom === 'vertex') {
    // A resting tetrahedron has one face flat on the table: measure that instead
    const down = Math.max(...die.normals.map(n => -applyQuaternion(n, quat)[1]));
    return { index, alignment: down };
  }
  return { index, alignment: best };
}

/**
 * Relabel a die so that the face (or vertex) that landed up shows `value`,
 * keeping opposite faces adding up to sides + 1.
 */
export function labelsForResult(die, landedIndex, value) {
  const labels = [...die.labels];
  const current = labels.indexOf(value);
  if (current < 0) throw new Error(`Value ${value} is not on a ${die.kind}`);
  if (current === landedIndex) return labels;

  const swap = (a, b) => {
    [labels[a], labels[b]] = [labels[b], labels[a]];
  };
  const oppLanded = die.readFrom === 'face' ? die.opposite[landedIndex] : -1;
  const oppCurrent = die.readFrom === 'face' ? die.opposite[current] : -1;

  swap(landedIndex, current);
  if (oppLanded >= 0 && oppCurrent >= 0 && oppLanded !== current) {
    swap(oppLanded, oppCurrent);
  }
  return labels;
}

/**
 * 2D layout of a face for texturing: vertices projected on the face plane,
 * with +y pointing "up" for the numeral.
 * Returns { points: [x, y][], inradius } in die units, centred on the face centroid.
 */
export function getFaceLayout(die, faceIndex) {
  const face = die.faces[faceIndex];
  const pts = face.map(i => die.vertices[i]);
  const c = centroid(pts);
  const n = die.normals[faceIndex];

  // Numerals point to a vertex, except on the cube where they align with an edge
  const upTarget = die.kind === 'd6' ? scale(add(pts[0], pts[1]), 0.5) : pts[0];
  const up = normalize(sub(upTarget, c));
  const right = cross(up, n);

  const points = pts.map(p => {
    const d = sub(p, c);
    return [dot(d, right), dot(d, up)];
  });

  let inradius = Infinity;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    const ex = q[0] - p[0];
    const ey = q[1] - p[1];
    const dist = Math.abs(p[0] * ey - p[1] * ex) / Math.hypot(ex, ey);
    inradius = Math.min(inradius, dist);
  });

  return { points, inradius };
}

// --- roll plans -------------------------------------------------------------

export const SUPPORTED_SIDES = [4, 6, 8, 10, 12, 20, 100];

/**
 * Which physical dice to throw for a roll of `sides` that must show `value`.
 * A d100 is a tens die ("00"–"90") plus a units die ("0"–"9").
 * Returns [{ kind, value, format }] where format(faceValue) is the text on a face.
 */
export function planDice(sides, value) {
  if (!SUPPORTED_SIDES.includes(sides)) throw new Error(`Unsupported die: d${sides}`);
  if (!Number.isInteger(value) || value < 1 || value > sides) {
    throw new Error(`Invalid value ${value} for a d${sides}`);
  }

  if (sides === 100) {
    const tens = Math.floor((value % 100) / 10);
    const units = value % 10;
    return [
      { kind: 'd10', value: tens === 0 ? 10 : tens, format: v => String((v % 10) * 10).padStart(2, '0') },
      { kind: 'd10', value: units === 0 ? 10 : units, format: v => String(v % 10) }
    ];
  }
  return [{ kind: `d${sides}`, value, format: v => String(v) }];
}
