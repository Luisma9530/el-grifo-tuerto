// three.js scene that plays a pre-simulated dice throw on a transparent canvas.
// This module (with three + cannon-es) is loaded lazily on the first roll.

import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, BufferGeometry, Float32BufferAttribute,
  MeshStandardMaterial, CanvasTexture, SRGBColorSpace, HemisphereLight, DirectionalLight,
  PlaneGeometry, ShadowMaterial, Vector3, Quaternion, Color
} from 'three';
import { getDie, getFaceLayout, labelsForResult, planDice } from './polyhedra';
import { simulateThrow, FRAME_DT } from './simulate';

const CELL = 256; // texture atlas cell size (px)
const PAD = 12;
const FONT = 'Cinzel, Georgia, "Times New Roman", serif';

// Amber resin dice with dark inked numerals (matches the tavern palette)
const FACE_CENTER = '#f7b23b';
const FACE_RIM = '#c9780f';
const EDGE = '#7a3f07';
const INK = '#1c1109';
const INK_HIGHLIGHT = 'rgba(255, 226, 170, 0.45)';

const HIGHLIGHT_COLORS = { crit: 0x4ade80, fumble: 0xff3b3b, normal: 0xffb347 };

const CAMERA_TILT = (15 * Math.PI) / 180; // from straight-down: the top face must read clearly
const TARGET_HALF_EXTENT = 8; // visible half-size of the smaller screen dimension (world units)
const WALL_MARGIN = 1.8; // keep dice fully on screen
const MAX_HALF_W = 12;
const MAX_HALF_D = 9;

function drawNumeral(ctx, text, x, y, rotation, size, underline) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.font = `800 ${Math.round(size)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const dy = size * 0.05;
  // Light offset copy underneath gives an engraved look
  ctx.fillStyle = INK_HIGHLIGHT;
  ctx.fillText(text, size * 0.02, dy + size * 0.03);
  ctx.fillStyle = INK;
  ctx.fillText(text, 0, dy);
  if (underline) {
    ctx.fillRect(-size * 0.26, dy + size * 0.46, size * 0.52, size * 0.07);
  }
  ctx.restore();
}

/** Draw every face of the die into a texture atlas and return it with per-face UVs. */
function buildAtlas(die, labels, format) {
  const faceCount = die.faces.length;
  const cols = Math.ceil(Math.sqrt(faceCount));
  const rows = Math.ceil(faceCount / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = EDGE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 6 and 9 look alike once the die rolls: underline them (on a d6 too)
  const needsUnderline = text => die.sides >= 6 && (text === '6' || text === '9');

  const uvs = die.faces.map((face, i) => {
    const { points, inradius } = getFaceLayout(die, i);
    const maxR = Math.max(...points.map(p => Math.hypot(p[0], p[1])));
    const s = (CELL / 2 - PAD) / maxR;
    const cx = ((i % cols) + 0.5) * CELL;
    const cy = (Math.floor(i / cols) + 0.5) * CELL;
    const px = points.map(p => [cx + p[0] * s, cy - p[1] * s]);

    ctx.beginPath();
    px.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * s);
    gradient.addColorStop(0, FACE_CENTER);
    gradient.addColorStop(1, FACE_RIM);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = CELL * 0.04;
    ctx.strokeStyle = EDGE;
    ctx.stroke();

    if (die.readFrom === 'vertex') {
      // d4: each corner shows the value of its vertex; the upright one is the result
      face.forEach((vertexIndex, k) => {
        const [x, y] = points[k];
        const text = format(labels[vertexIndex]);
        drawNumeral(ctx, text, cx + x * s * 0.5, cy - y * s * 0.5, Math.atan2(x, y), inradius * s * 0.72, false);
      });
    } else {
      const text = format(labels[i]);
      const size = inradius * s * (text.length > 1 ? 0.98 : 1.3);
      drawNumeral(ctx, text, cx, cy, 0, size, needsUnderline(text));
    }

    return px.map(([x, y]) => [x / canvas.width, 1 - y / canvas.height]);
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, uvs };
}

/**
 * Build the mesh of a die. `resultFace` is the face that will end up on top:
 * it gets its own material so only that face lights up with the result
 * (-1 for the d4, which is read from a vertex: the whole die glows instead).
 */
function buildDieMesh(die, labels, format, resultFace) {
  const { texture, uvs } = buildAtlas(die, labels, format);
  const positions = [];
  const normals = [];
  const uv = [];

  // The result face goes last so it can be a separate material group
  const order = die.faces.map((_, i) => i).filter(i => i !== resultFace);
  if (resultFace >= 0) order.push(resultFace);

  let resultStart = 0;
  order.forEach(i => {
    const face = die.faces[i];
    const n = die.normals[i];
    if (i === resultFace) resultStart = positions.length / 3;
    for (let k = 1; k < face.length - 1; k++) {
      [0, k, k + 1].forEach(corner => {
        positions.push(...die.vertices[face[corner]]);
        normals.push(...n);
        uv.push(...uvs[i][corner]);
      });
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));

  const makeMaterial = () => new MeshStandardMaterial({
    map: texture,
    roughness: 0.3,
    metalness: 0.12,
    // The glow is filtered by the face texture, so the numerals stay dark
    emissive: new Color(0x000000),
    emissiveMap: texture,
    emissiveIntensity: 0
  });

  const vertexCount = positions.length / 3;
  let materials;
  if (resultFace >= 0) {
    geometry.addGroup(0, resultStart, 0);
    geometry.addGroup(resultStart, vertexCount - resultStart, 1);
    materials = [makeMaterial(), makeMaterial()];
  } else {
    geometry.addGroup(0, vertexCount, 0);
    materials = [makeMaterial()];
  }

  const mesh = new Mesh(geometry, materials);
  mesh.castShadow = true;
  // The material that glows when the result is revealed
  mesh.userData.glow = materials[materials.length - 1];
  mesh.userData.glowsWholeDie = resultFace < 0;
  return mesh;
}

function disposeMesh(mesh) {
  mesh.geometry.dispose();
  mesh.material[0].map?.dispose(); // the texture is shared by the die's materials
  mesh.material.forEach(material => material.dispose());
}

/**
 * Create the dice engine on a canvas. Throws if WebGL is not available.
 */
export async function createDiceEngine(canvas) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;

  // Make sure the numeral font is ready before drawing textures (don't wait forever)
  try {
    await Promise.race([
      document.fonts.load(`800 64px ${FONT.split(',')[0]}`),
      new Promise(resolve => setTimeout(resolve, 800))
    ]);
  } catch {
    // Fallback fonts will be used
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 200);

  scene.add(new HemisphereLight(0xfff3e0, 0x3a2414, 1.5));
  const key = new DirectionalLight(0xffffff, 2.6);
  key.position.set(-7, 20, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -16;
  key.shadow.camera.right = 16;
  key.shadow.camera.top = 16;
  key.shadow.camera.bottom = -16;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new DirectionalLight(0xffc98a, 0.7);
  fill.position.set(10, 8, -6);
  scene.add(fill);

  const floor = new Mesh(new PlaneGeometry(120, 120), new ShadowMaterial({ opacity: 0.45 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  let width = 1;
  let height = 1;
  let bounds = { halfW: 8, halfD: 6 };
  let meshes = [];
  let playback = null; // { sim, startedAt, impactIndex, onImpact, resolve, finished }
  let effect = null; // { startedAt, color }
  let frameRequest = 0;
  let disposed = false;

  const qa = new Quaternion();
  const qb = new Quaternion();
  const tmp = new Vector3();

  /** Ground point (y = 0) under a screen position given in NDC. */
  function groundPoint(ndcX, ndcY) {
    tmp.set(ndcX, ndcY, 0.5).unproject(camera);
    const dir = tmp.sub(camera.position).normalize();
    const t = -camera.position.y / dir.y;
    return [camera.position.x + dir.x * t, camera.position.z + dir.z * t];
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    const place = distance => {
      camera.position.set(0, distance * Math.cos(CAMERA_TILT), distance * Math.sin(CAMERA_TILT));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const [nearX, nearZ] = groundPoint(1, -1); // bottom-right corner of the screen
      const [, farZ] = groundPoint(0, 1); // top centre
      return { halfW: Math.abs(nearX), halfD: Math.min(Math.abs(nearZ), Math.abs(farZ)) };
    };

    // Ground extents scale linearly with distance: measure once, then rescale
    const probe = place(30);
    const visible = place((30 * TARGET_HALF_EXTENT) / Math.min(probe.halfW, probe.halfD));
    bounds = {
      halfW: Math.min(MAX_HALF_W, visible.halfW - WALL_MARGIN),
      halfD: Math.min(MAX_HALF_D, visible.halfD - WALL_MARGIN)
    };
  }

  function clearDice() {
    meshes.forEach(mesh => {
      scene.remove(mesh);
      disposeMesh(mesh);
    });
    meshes = [];
    effect = null;
  }

  function applyFrame(frameA, frameB, alpha) {
    meshes.forEach((mesh, i) => {
      const o = i * 7;
      mesh.position.set(
        frameA[o] + (frameB[o] - frameA[o]) * alpha,
        frameA[o + 1] + (frameB[o + 1] - frameA[o + 1]) * alpha,
        frameA[o + 2] + (frameB[o + 2] - frameA[o + 2]) * alpha
      );
      qa.set(frameA[o + 3], frameA[o + 4], frameA[o + 5], frameA[o + 6]);
      qb.set(frameB[o + 3], frameB[o + 4], frameB[o + 5], frameB[o + 6]);
      mesh.quaternion.slerpQuaternions(qa, qb, alpha);
    });
  }

  function finishPlayback() {
    if (!playback || playback.finished) return;
    playback.finished = true;
    const last = playback.sim.frames[playback.sim.frames.length - 1];
    applyFrame(last, last, 0);
    meshes.forEach(mesh => mesh.scale.setScalar(1));
    playback.resolve();
  }

  function tick(now) {
    frameRequest = 0;
    if (disposed) return;

    if (playback && !playback.finished) {
      // The first frame's timestamp can be a little earlier than the moment the roll started
      const t = Math.max(0, (now - playback.startedAt) / 1000);
      const { sim } = playback;

      while (playback.impactIndex < sim.impacts.length && sim.impacts[playback.impactIndex].time <= t) {
        playback.onImpact?.(sim.impacts[playback.impactIndex].strength);
        playback.impactIndex++;
      }

      if (t >= sim.duration) {
        finishPlayback();
      } else {
        const f = t / FRAME_DT;
        const i0 = Math.min(sim.frames.length - 1, Math.floor(f));
        const i1 = Math.min(sim.frames.length - 1, i0 + 1);
        applyFrame(sim.frames[i0], sim.frames[i1], f - i0);
        // Quick scale-in so the dice don't pop into existence
        const grow = Math.min(1, t / 0.12);
        meshes.forEach(mesh => mesh.scale.setScalar(0.55 + 0.45 * grow));
      }
    }

    if (effect) {
      const t = (now - effect.startedAt) / 1000;
      const fadeIn = Math.min(1, t / 0.18);
      const pulse = 0.75 + 0.25 * Math.sin(t * 7);
      const pop = 1 + 0.14 * Math.sin(Math.PI * Math.min(1, t / 0.32));
      meshes.forEach(mesh => {
        const strength = mesh.userData.glowsWholeDie ? effect.strength * 0.45 : effect.strength;
        mesh.userData.glow.emissiveIntensity = strength * fadeIn * pulse;
        mesh.scale.setScalar(pop);
      });
    }

    renderer.render(scene, camera);
    if (meshes.length > 0) frameRequest = requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if (!frameRequest && !disposed) frameRequest = requestAnimationFrame(tick);
  }

  return {
    resize,

    /**
     * Throw the dice for a roll and animate them.
     * @param {{dice: {sides: number, value: number}[]}} roll  normalized by animateRoll()
     * @param {{onImpact?: (strength: number) => void}} [options]
     * @returns {{ done: Promise<void>, skip: () => void, duration: number }} duration in seconds
     */
    roll(roll, options = {}) {
      finishPlayback();
      clearDice();

      const plan = roll.dice.flatMap(die => planDice(die.sides, die.value));
      const sim = simulateThrow(plan.map(p => p.kind), bounds);

      meshes = plan.map((p, i) => {
        const die = getDie(p.kind);
        const labels = labelsForResult(die, sim.tops[i], p.value);
        const mesh = buildDieMesh(die, labels, p.format, die.readFrom === 'face' ? sim.tops[i] : -1);
        scene.add(mesh);
        return mesh;
      });
      applyFrame(sim.frames[0], sim.frames[0], 0);

      let resolve;
      const done = new Promise(r => {
        resolve = r;
      });
      playback = {
        sim,
        startedAt: performance.now(),
        impactIndex: 0,
        onImpact: options.onImpact,
        resolve,
        finished: false
      };
      ensureLoop();
      return { done, skip: finishPlayback, duration: sim.duration };
    },

    /** Light up the face showing the result: 'crit' | 'fumble' | 'normal'. */
    highlight(kind) {
      const color = HIGHLIGHT_COLORS[kind] ?? HIGHLIGHT_COLORS.normal;
      meshes.forEach(mesh => mesh.userData.glow.emissive.setHex(color));
      effect = { startedAt: performance.now(), strength: kind === 'normal' ? 0.55 : 1.1 };
      ensureLoop();
    },

    /**
     * Where to anchor the result banner (CSS px): `x` is the centre of the dice,
     * `above` is just over them on screen and `below` just under them.
     */
    getAnchor() {
      if (meshes.length === 0) return { x: width / 2, above: height / 2, below: height / 2 };
      const centreX = meshes.reduce((sum, mesh) => sum + mesh.position.x, 0) / meshes.length;
      const toScreen = (y, z) => {
        tmp.set(centreX, y, z).project(camera);
        return { x: ((tmp.x + 1) / 2) * width, y: ((1 - tmp.y) / 2) * height };
      };
      // The dice edge furthest from the camera is the top one on screen
      const top = toScreen(1.6, Math.min(...meshes.map(mesh => mesh.position.z)) - 1.7);
      const bottom = toScreen(0, Math.max(...meshes.map(mesh => mesh.position.z)) + 2.2);
      return { x: top.x, above: top.y, below: bottom.y };
    },

    /** Remove the dice and stop rendering until the next roll. */
    stop() {
      finishPlayback();
      playback = null;
      clearDice();
      if (frameRequest) cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      renderer.render(scene, camera); // clear the canvas
    },

    dispose() {
      disposed = true;
      if (frameRequest) cancelAnimationFrame(frameRequest);
      finishPlayback();
      clearDice();
      floor.geometry.dispose();
      floor.material.dispose();
      renderer.dispose();
    }
  };
}
