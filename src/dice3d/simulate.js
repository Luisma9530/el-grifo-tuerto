// Rigid-body simulation of a dice throw (cannon-es). The whole throw is
// computed up-front so we know which face lands up before the animation plays;
// the faces are then relabelled so that face shows the value that was rolled.

import { World, Body, Plane, ConvexPolyhedron, Vec3, Material, ContactMaterial } from 'cannon-es';
import { getDie, getTopIndex } from './polyhedra';

const STEP = 1 / 120; // physics step (s)
const RECORD_EVERY = 2; // -> 60 recorded frames per second
export const FRAME_DT = STEP * RECORD_EVERY;
const MAX_TIME = 5; // give up waiting for the dice to settle after this (s)
const PREFERRED_MAX_DURATION = 2.7; // prefer throws that settle within this time (s)
const GRAVITY = 70;
const MIN_ALIGNMENT = 0.985; // below this the die is "cocked" (leaning on something)

const shapeCache = new Map();
function getShape(kind) {
  if (!shapeCache.has(kind)) {
    const die = getDie(kind);
    shapeCache.set(kind, new ConvexPolyhedron({
      vertices: die.vertices.map(v => new Vec3(v[0], v[1], v[2])),
      faces: die.faces.map(f => [...f])
    }));
  }
  return shapeCache.get(kind);
}

function addPlane(world, material, position, eulerX, eulerY) {
  const body = new Body({ mass: 0, shape: new Plane(), material });
  body.quaternion.setFromEuler(eulerX, eulerY, 0);
  body.position.set(position[0], position[1], position[2]);
  world.addBody(body);
}

function runOnce(kinds, bounds, rng) {
  const { halfW, halfD } = bounds;
  const world = new World({ gravity: new Vec3(0, -GRAVITY, 0) });
  world.allowSleep = true;
  world.solver.iterations = 16;

  const diceMat = new Material('dice');
  const floorMat = new Material('floor');
  const wallMat = new Material('wall');
  world.addContactMaterial(new ContactMaterial(diceMat, floorMat, { friction: 0.42, restitution: 0.42 }));
  world.addContactMaterial(new ContactMaterial(diceMat, wallMat, { friction: 0.1, restitution: 0.55 }));
  world.addContactMaterial(new ContactMaterial(diceMat, diceMat, { friction: 0.1, restitution: 0.4 }));

  addPlane(world, floorMat, [0, 0, 0], -Math.PI / 2, 0); // floor, normal +y
  addPlane(world, wallMat, [halfW, 0, 0], 0, -Math.PI / 2); // right wall, normal -x
  addPlane(world, wallMat, [-halfW, 0, 0], 0, Math.PI / 2); // left wall, normal +x
  addPlane(world, wallMat, [0, 0, halfD], 0, Math.PI); // near wall, normal -z
  addPlane(world, wallMat, [0, 0, -halfD], 0, 0); // far wall, normal +z

  const rand = (min, max) => min + rng() * (max - min);
  const impacts = [];
  let time = 0;

  // Thrown from the lower-right corner towards the upper-left area
  const start = [halfW - 2.2, rand(3.5, 5), halfD - 2.2];
  const target = [-halfW * rand(0.15, 0.5), 0, -halfD * rand(0.1, 0.45)];
  const dx = target[0] - start[0];
  const dz = target[2] - start[2];
  const dist = Math.hypot(dx, dz) || 1;
  const speed = Math.min(34, Math.max(16, dist * 1.9)) * rand(0.9, 1.15);
  // Perpendicular offset so several dice don't start inside each other
  const px = -dz / dist;
  const pz = dx / dist;

  const bodies = kinds.map((kind, i) => {
    const offset = (i - (kinds.length - 1) / 2) * 3.4;
    const body = new Body({
      mass: 1,
      shape: getShape(kind),
      material: diceMat,
      linearDamping: 0.12,
      angularDamping: 0.22,
      allowSleep: true,
      sleepSpeedLimit: 0.5,
      sleepTimeLimit: 0.2
    });
    body.position.set(start[0] + px * offset, start[1] + i * 0.6, start[2] + pz * offset);
    body.quaternion.set(rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1));
    body.quaternion.normalize();
    const jitter = rand(0.9, 1.1);
    body.velocity.set((dx / dist) * speed * jitter, rand(-3, 2), (dz / dist) * speed * jitter);
    body.angularVelocity.set(rand(-22, 22), rand(-22, 22), rand(-22, 22));
    body.addEventListener('collide', event => {
      const strength = Math.abs(event.contact.getImpactVelocityAlongNormal());
      if (strength > 1.5) impacts.push({ time, strength });
    });
    world.addBody(body);
    return body;
  });

  const frames = [];
  const record = () => {
    const frame = new Float32Array(bodies.length * 7);
    bodies.forEach((b, i) => {
      frame.set([b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w], i * 7);
    });
    frames.push(frame);
  };

  record();
  let settled = false;
  const maxSteps = Math.round(MAX_TIME / STEP);
  for (let step = 1; step <= maxSteps; step++) {
    world.step(STEP);
    time = step * STEP;
    if (step % RECORD_EVERY === 0) record();
    if (bodies.every(b => b.sleepState === Body.SLEEPING)) {
      settled = true;
      break;
    }
  }
  record();

  const last = frames[frames.length - 1];
  const tops = kinds.map((kind, i) => {
    const q = [last[i * 7 + 3], last[i * 7 + 4], last[i * 7 + 5], last[i * 7 + 6]];
    return getTopIndex(getDie(kind), q);
  });

  const inBounds = bodies.every(b =>
    Math.abs(b.position.x) < halfW && Math.abs(b.position.z) < halfD && b.position.y < 3
  );
  const flat = tops.every(t => t.alignment >= MIN_ALIGNMENT);

  return {
    frames,
    impacts,
    duration: (frames.length - 1) * FRAME_DT,
    tops: tops.map(t => t.index),
    ok: settled && inBounds && flat
  };
}

/**
 * Simulate throwing the given dice inside a walled rectangle on the floor.
 * @param {string[]} kinds        e.g. ['d20'] or ['d10', 'd10']
 * @param {{halfW: number, halfD: number}} bounds  half extents of the tray (world units)
 * @param {() => number} [rng]    random source in [0, 1)
 * @returns {{ frames: Float32Array[], impacts: {time: number, strength: number}[], duration: number, tops: number[], ok: boolean }}
 *   frames: one Float32Array per 1/60 s with [x, y, z, qx, qy, qz, qw] per die;
 *   tops: index of the face (vertex for d4) that ended up for each die.
 */
export function simulateThrow(kinds, bounds, rng = Math.random) {
  let best = null;
  // Simulating is cheap (a few ms), so try a handful of throws and keep one that
  // settles flat inside the tray without dragging on for too long.
  for (let attempt = 0; attempt < 8; attempt++) {
    const result = runOnce(kinds, bounds, rng);
    if (result.ok && result.duration <= PREFERRED_MAX_DURATION) return result;
    const better = !best || (result.ok && !best.ok) || (result.ok === best.ok && result.duration < best.duration);
    if (better) best = result;
  }
  return best;
}
