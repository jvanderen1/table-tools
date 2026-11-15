/**
 * Polyhedral dice for the on-screen throw.
 *
 * The number is chosen before the animation. Each face stores the rotation that
 * turns that value toward the camera, so the tumble ends on the logged roll.
 */

export type DieFace = {
  sides: number;
  value: number;
  /** Advantage / disadvantage die that is shown, but not kept. */
  dropped?: boolean;
};

export type FaceLabelMode = "number" | "d10" | "percentile" | "units";

export type ThrownDie = {
  kind: "die";
  sides: SupportedSides;
  /** Face index in the model. A d10 is numbered 0–9. */
  face: number;
  mode: FaceLabelMode;
  dropped: boolean;
  landX: number;
  fromX: number;
  delay: number;
  /** Bounding-sphere radius in px. */
  radius: number;
  /** Extra full turns, in degrees, added on the way to the settled orientation. */
  spin: { x: number; y: number; z: number };
};

export type ThrownChip = {
  kind: "chip";
  extra: number;
  landX: number;
  fromX: number;
  delay: number;
  radius: number;
};

export type ThrownPiece = ThrownDie | ThrownChip;

type V = [number, number, number];
/** Row-major 3×3. */
type Mat = [V, V, V];

const SUPPORTED = [4, 6, 8, 10, 12, 20] as const;
export type SupportedSides = (typeof SUPPORTED)[number];

export type DieFaceModel = {
  value: number;
  /** CSS transform that seats this face on the solid. */
  transform: string;
  clip: string;
  /** Edge length of the square that holds the clipped face, in px. */
  size: number;
  font: number;
  /** 0–1, brighter faces point toward the upper front. */
  shade: number;
  /** Settled `rotateX/Y/Z` degrees that bring this face to the camera, number upright. */
  orient: { x: number; y: number; z: number };
};

const modelCache = new Map<string, DieFaceModel[]>();

export function dieModel(sides: SupportedSides, radius: number): DieFaceModel[] {
  const key = `${sides}:${radius}`;
  const hit = modelCache.get(key);
  if (hit) return hit;
  const built = buildModel(sides, radius).map((face) => face.model);
  modelCache.set(key, built);
  return built;
}

export function faceLabel(value: number, mode: FaceLabelMode): string {
  if (mode === "percentile") return value === 0 ? "00" : String(value * 10);
  if (mode === "units") return String(value);
  if (mode === "d10") return value === 0 ? "10" : String(value);
  return String(value);
}

export function isSupportedSides(sides: number): sides is SupportedSides {
  return (SUPPORTED as readonly number[]).includes(sides);
}

/** Largest error, in vector length, between the settled rotation and a camera-facing face. */
export function orientationError(sides: SupportedSides) {
  let error = 0;
  for (const face of buildModel(sides, 40)) {
    const settled = settleMatrix(face.model.orient);
    error = Math.max(error, dist(matMulVec(settled, face.normal), [0, 0, 1]));
    error = Math.max(error, dist(matMulVec(settled, face.down), [0, 1, 0]));
    error = Math.max(error, dist(matMulVec(settled, face.right), [1, 0, 0]));
  }
  return error;
}

export function solidReport(sides: SupportedSides) {
  const built = buildModel(sides, 40);
  const values = built.map((face) => face.model.value).sort((a, b) => a - b);
  return {
    count: built.length,
    planarity: Math.max(...built.map((face) => face.planarity)),
    opposite: Math.max(...built.map((face) => face.opposite)),
    orientation: orientationError(sides),
    values,
    corners: built.map((face) => face.corners),
  };
}

/**
 * Notation for `@3d-dice/dice-box-threejs`. One `@` list, applied left to right.
 * A d100 is a tens die (00–90) plus a ones die (0–9). 00 and 0 is 100.
 * A d10 that rolled 10 is the 0 face.
 */
export function diceBoxNotation(faces: DieFace[]): string {
  const dice: { type: string; value: number }[] = [];
  for (const face of faces) {
    if (face.sides === 100) {
      const value = face.value === 100 ? 0 : face.value;
      dice.push({ type: "d100", value: Math.floor(value / 10) * 10 });
      dice.push({ type: "d10", value: value % 10 });
      continue;
    }
    if (face.sides === 10) {
      dice.push({ type: "d10", value: face.value === 10 ? 0 : face.value });
      continue;
    }
    if (face.sides !== 4 && face.sides !== 6 && face.sides !== 8 && face.sides !== 12 && face.sides !== 20) {
      continue;
    }
    dice.push({ type: `d${face.sides}`, value: face.value });
  }
  if (dice.length === 0) return "";
  return `${dice.map((die) => `1${die.type}`).join("+")}@${dice.map((die) => die.value).join(",")}`;
}

/** Turn logged faces into the pieces that fly across the screen. */
export function layoutThrow(faces: DieFace[], viewportWidth: number): ThrownPiece[] {
  const expanded = faces.flatMap((face) => expandFace(face));
  const maxSlots = 4;
  const overflow = expanded.length > maxSlots;
  const shown = overflow ? expanded.slice(0, maxSlots - 1) : expanded;
  const extra = overflow ? expanded.length - shown.length : 0;
  const slots = shown.length + (extra > 0 ? 1 : 0);
  const radius = throwRadius(slots, viewportWidth);
  const stride = radius * 2 + Math.round(radius * 0.28);
  const width = Math.max(slots - 1, 0) * stride;
  const travel = Math.max(viewportWidth * 0.62, radius * 6);

  const pieces: ThrownPiece[] = shown.map((die, index) => ({
    kind: "die",
    ...die,
    landX: index * stride - width / 2,
    fromX: index % 2 === 0 ? -travel : travel,
    delay: index * 80,
    radius: die.dropped ? radius * 0.78 : radius,
    spin: {
      x: 360 * (2 + (index % 2)),
      y: 360 * (index % 2 === 0 ? -2 : 1),
      z: 360 * (index % 3 === 0 ? 1 : -1),
    },
  }));

  if (extra > 0) {
    pieces.push({
      kind: "chip",
      extra,
      landX: shown.length * stride - width / 2,
      fromX: shown.length % 2 === 0 ? -travel : travel,
      delay: shown.length * 80,
      radius,
    });
  }
  return pieces;
}

type Expanded = {
  sides: SupportedSides;
  face: number;
  mode: FaceLabelMode;
  dropped: boolean;
};

function expandFace(face: DieFace): Expanded[] {
  const dropped = face.dropped === true;
  // A d100 at the table is a tens die (00–90) and a ones die (0–9). 00 and 0 is 100.
  if (face.sides === 100) {
    const value = face.value === 100 ? 0 : face.value;
    return [
      { sides: 10, face: Math.floor(value / 10), mode: "percentile", dropped },
      { sides: 10, face: value % 10, mode: "units", dropped },
    ];
  }
  if (face.sides === 10) {
    return [{ sides: 10, face: face.value % 10, mode: "d10", dropped }];
  }
  if (!isSupportedSides(face.sides)) return [];
  return [{ sides: face.sides, face: face.value, mode: "number", dropped }];
}

function throwRadius(slots: number, viewportWidth: number) {
  const preferred = slots <= 1 ? 56 : slots === 2 ? 44 : 34;
  const fitted = (viewportWidth - 36) / Math.max(slots, 1) / 2.3;
  return Math.round(Math.max(26, Math.min(preferred, fitted)));
}

type BuiltFace = {
  model: DieFaceModel;
  normal: V;
  down: V;
  right: V;
  planarity: number;
  opposite: number;
  corners: number;
};

function buildModel(sides: SupportedSides, radius: number): BuiltFace[] {
  const raw = solid(sides);
  const unit = normalize(center(raw.verts));
  const faces = raw.faces.map((indices) => outward(indices, unit));
  const normals = faces.map((indices) => normalOf(indices, unit));
  const values = numberFaces(normals, sides);
  return faces.map((indices, index) => {
    const value = values[index];
    const mine = normals[index];
    if (value === undefined || !mine) throw new Error("unnumbered die face");
    const seated = seat(indices, unit, radius, value);
    let opposite = 1;
    for (let other = 0; other < normals.length; other++) {
      const neighbor = normals[other];
      if (other !== index && neighbor) opposite = Math.min(opposite, dot(mine, neighbor));
    }
    return {
      ...seated,
      planarity: planeGap(indices, unit),
      opposite,
      corners: indices.length,
    };
  });
}

function solid(sides: SupportedSides): { verts: V[]; faces: number[][] } {
  if (sides === 4) return { verts: tetraVerts(), faces: triangles(tetraVerts()) };
  if (sides === 6) return { verts: cubeVerts(), faces: cubeFaces() };
  if (sides === 8) return { verts: octaVerts(), faces: triangles(octaVerts()) };
  if (sides === 10) return d10Solid();
  if (sides === 12) return { verts: dodecaVerts(), faces: walkFaces(dodecaVerts()) };
  return { verts: icosaVerts(), faces: triangles(icosaVerts()) };
}

function tetraVerts(): V[] {
  return [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ];
}

function cubeVerts(): V[] {
  const verts: V[] = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) verts.push([x, y, z]);
    }
  }
  return verts;
}

function cubeFaces(): number[][] {
  // x, then y, then z, each −1 then +1. See cubeVerts.
  return [
    [1, 5, 7, 3],
    [0, 2, 6, 4],
    [4, 6, 7, 5],
    [0, 1, 3, 2],
    [2, 3, 7, 6],
    [0, 4, 5, 1],
  ];
}

function octaVerts(): V[] {
  return [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
}

function icosaVerts(): V[] {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: V[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      verts.push([0, a, b * t], [a, b * t, 0], [b * t, 0, a]);
    }
  }
  return verts;
}

function dodecaVerts(): V[] {
  const p = (1 + Math.sqrt(5)) / 2;
  const inv = 1 / p;
  const verts: V[] = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) verts.push([x, y, z]);
    }
  }
  for (const y of [-inv, inv]) {
    for (const z of [-p, p]) verts.push([0, y, z]);
  }
  for (const x of [-inv, inv]) {
    for (const y of [-p, p]) verts.push([x, y, 0]);
  }
  for (const x of [-p, p]) {
    for (const z of [-inv, inv]) verts.push([x, 0, z]);
  }
  return verts;
}

/** Kite-faced d10. The equatorial lift is solved so each kite is planar. */
function d10Solid(): { verts: V[]; faces: number[][] } {
  let lo = 0;
  let hi = 1.2;
  for (let step = 0; step < 60; step++) {
    const mid = (lo + hi) / 2;
    // Volume changes sign across the planar lift; drive it to zero.
    if (kiteVolume(mid) > 0) hi = mid;
    else lo = mid;
  }
  const lift = (lo + hi) / 2;
  const verts: V[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10;
    verts.push([Math.cos(angle), Math.sin(angle), lift * (i % 2 ? 1 : -1)]);
  }
  verts.push([0, 0, -1], [0, 0, 1]);
  const faces: number[][] = [];
  for (let k = 0; k < 5; k++) {
    const upper0 = (2 * k + 1) % 10;
    const lower = (2 * k + 2) % 10;
    const upper1 = (2 * k + 3) % 10;
    faces.push([11, upper0, lower, upper1]);
    const lower0 = (2 * k) % 10;
    const upper = (2 * k + 1) % 10;
    const lower1 = (2 * k + 2) % 10;
    faces.push([10, lower1, upper, lower0]);
  }
  return { verts, faces };
}

function kiteVolume(lift: number) {
  const step = (Math.PI * 2) / 10;
  const top: V = [0, 0, 1];
  const a: V = [Math.cos(step), Math.sin(step), lift];
  const mid: V = [Math.cos(2 * step), Math.sin(2 * step), -lift];
  const b: V = [Math.cos(3 * step), Math.sin(3 * step), lift];
  return dot(cross(sub(a, top), sub(mid, top)), sub(b, top));
}

function triangles(verts: V[]): number[][] {
  const centered = center(verts);
  const edge = minDistance(centered) * 1.08;
  const faces: number[][] = [];
  const n = centered.length;
  for (let i = 0; i < n; i++) {
    const a = centered[i];
    if (!a) continue;
    for (let j = i + 1; j < n; j++) {
      const b = centered[j];
      if (!b || dist(a, b) > edge) continue;
      for (let k = j + 1; k < n; k++) {
        const c = centered[k];
        if (!c || dist(a, c) > edge || dist(b, c) > edge) continue;
        faces.push([i, j, k]);
      }
    }
  }
  return faces;
}

/** Trace each face of a convex polyhedron by taking the tightest turn at every vertex. */
function walkFaces(verts: V[]): number[][] {
  const centered = center(verts);
  const edge = minDistance(centered) * 1.12;
  const adj: number[][] = centered.map(() => []);
  for (let i = 0; i < centered.length; i++) {
    const from = centered[i];
    const fromAdj = adj[i];
    if (!from || !fromAdj) continue;
    for (let j = i + 1; j < centered.length; j++) {
      const to = centered[j];
      const toAdj = adj[j];
      if (!to || !toAdj || dist(from, to) > edge) continue;
      fromAdj.push(j);
      toAdj.push(i);
    }
  }

  const seen = new Set<string>();
  const faces: number[][] = [];

  function nextVertex(prev: number, cur: number) {
    const origin = centered[cur];
    const neighbors = adj[cur];
    const back = centered[prev];
    const first = neighbors?.[0];
    if (!origin || !neighbors || first === undefined || !back) return prev;
    const radial = norm(origin);
    const incoming = project(norm(sub(back, origin)), radial);
    let best = first;
    let bestAngle = Infinity;
    for (const candidate of neighbors) {
      if (candidate === prev) continue;
      const next = centered[candidate];
      if (!next) continue;
      const outgoing = project(norm(sub(next, origin)), radial);
      const sin = dot(cross(incoming, outgoing), radial);
      const cos = dot(incoming, outgoing);
      let angle = Math.atan2(sin, cos);
      if (angle <= 1e-6) angle += Math.PI * 2;
      if (angle < bestAngle) {
        bestAngle = angle;
        best = candidate;
      }
    }
    return best;
  }

  for (let i = 0; i < centered.length; i++) {
    const neighbors = adj[i];
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      const face = [i];
      let prev = i;
      let cur = neighbor;
      let guard = 0;
      while (cur !== i && guard++ < 14) {
        face.push(cur);
        const next = nextVertex(prev, cur);
        prev = cur;
        cur = next;
      }
      if (cur !== i || face.length < 3) continue;
      const key = canonical(face);
      if (seen.has(key)) continue;
      seen.add(key);
      faces.push(face);
    }
  }
  return faces;
}

function seat(indices: number[], verts: V[], radius: number, value: number) {
  const points = taken(indices, verts);
  const centroid = average(points);
  const normal = normalOf(indices, verts);
  const helper: V = Math.abs(normal[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  const right = norm(cross(helper, normal));
  const down = cross(normal, right);
  // Columns of F are the face's local axes in die space: +X right, +Y down the glyph, +Z outward.
  const basis: Mat = [
    [right[0], down[0], normal[0]],
    [right[1], down[1], normal[1]],
    [right[2], down[2], normal[2]],
  ];
  const local = points.map((point) => {
    const offset = sub(point, centroid);
    return { u: dot(offset, right), v: dot(offset, down) };
  });
  const rho = Math.max(...local.map((point) => Math.hypot(point.u, point.v)));
  const size = 2 * rho * radius * 1.006;
  const light = norm([-0.3, -0.8, 0.5]);
  const shade = 0.55 + 0.45 * Math.max(0, dot(normal, light));
  const clip = local
    .map((point) => {
      const x = 50 + (50 * point.u) / rho;
      const y = 50 + (50 * point.v) / rho;
      return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
    })
    .join(", ");
  const fontScale = indices.length >= 5 ? 0.4 : indices.length === 4 ? 0.2 : 0.28;
  const model: DieFaceModel = {
    value,
    transform: `${matrixCss(basis)} translateZ(${(dot(normal, centroid) * radius).toFixed(3)}px)`,
    clip: `polygon(${clip})`,
    size,
    font: Math.max(13, Math.round(size * fontScale)),
    shade,
    orient: euler(transpose(basis)),
  };
  return { model, normal, down, right };
}

function numberFaces(normals: V[], sides: SupportedSides) {
  const used = new Set<number>();
  const pairs: [number, number][] = [];
  for (let i = 0; i < normals.length; i++) {
    if (used.has(i)) continue;
    let partner = -1;
    let best = Infinity;
    const mine = normals[i];
    if (!mine) continue;
    for (let j = 0; j < normals.length; j++) {
      const other = normals[j];
      if (i === j || used.has(j) || !other) continue;
      const score = dot(mine, other);
      if (score < best) {
        best = score;
        partner = j;
      }
    }
    used.add(i);
    if (partner >= 0) used.add(partner);
    pairs.push([i, partner]);
  }
  const zeroBased = sides === 10;
  const values = new Array<number>(normals.length);
  pairs.forEach(([a, b], index) => {
    const low = zeroBased ? index : index + 1;
    const high = zeroBased ? sides - 1 - index : sides + 1 - low;
    values[a] = low;
    if (b >= 0) values[b] = high;
  });
  return values;
}

function outward(indices: number[], verts: V[]) {
  const [a, b, c] = corners(taken(indices, verts));
  const n = cross(sub(b, a), sub(c, a));
  if (dot(n, average(taken(indices, verts))) < 0) return [...indices].reverse();
  return indices;
}

function normalOf(indices: number[], verts: V[]): V {
  const points = taken(indices, verts);
  const [a, b, c] = corners(points);
  const n = norm(cross(sub(b, a), sub(c, a)));
  return dot(n, average(points)) < 0 ? mul(n, -1) : n;
}

function planeGap(indices: number[], verts: V[]) {
  const points = taken(indices, verts);
  const anchor = points[0];
  if (!anchor) return 0;
  const n = normalOf(indices, verts);
  const plane = dot(n, anchor);
  return Math.max(0, ...points.map((point) => Math.abs(dot(n, point) - plane)));
}

function taken(indices: number[], verts: V[]) {
  const points: V[] = [];
  for (const index of indices) {
    const point = verts[index];
    if (point) points.push(point);
  }
  return points;
}

function corners(points: V[]): [V, V, V] {
  const a = points[0];
  const b = points[1];
  const c = points[2];
  if (!a || !b || !c) throw new Error("A die face needs three corners");
  return [a, b, c];
}

function center(verts: V[]) {
  const mid = average(verts);
  return verts.map((vert) => sub(vert, mid));
}

function normalize(verts: V[]) {
  const peak = Math.max(...verts.map((vert) => len(vert)));
  return verts.map((vert) => mul(vert, 1 / peak));
}

function average(verts: V[]): V {
  const sum = verts.reduce<V>((acc, vert) => add(acc, vert), [0, 0, 0]);
  return mul(sum, 1 / verts.length);
}

function minDistance(verts: V[]) {
  let best = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const from = verts[i];
    if (!from) continue;
    for (let j = i + 1; j < verts.length; j++) {
      const to = verts[j];
      if (!to) continue;
      const gap = dist(from, to);
      if (gap > 1e-6 && gap < best) best = gap;
    }
  }
  return best;
}

function canonical(cycle: number[]) {
  const key = [...rotations(cycle), ...rotations([...cycle].reverse())].sort()[0];
  return key ?? "";
}

function rotations(cycle: number[]) {
  return cycle.map((_, index) =>
    [...cycle.slice(index), ...cycle.slice(0, index)].join(","),
  );
}

function project(v: V, ontoUnit: V) {
  return norm(sub(v, mul(ontoUnit, dot(v, ontoUnit))));
}

function euler(matrix: Mat) {
  // matrix = Rx * Ry * Rz, matching CSS `rotateX() rotateY() rotateZ()`.
  const sy = clamp(matrix[0][2], -1, 1);
  const cy = Math.hypot(matrix[0][0], matrix[0][1]);
  const y = Math.atan2(sy, cy);
  // At ±90° the X and Z turns collapse into one, so park the twist on X.
  const x =
    cy > 1e-6
      ? Math.atan2(-matrix[1][2], matrix[2][2])
      : Math.atan2(sy < 0 ? -matrix[1][0] : matrix[1][0], matrix[1][1]);
  const z = cy > 1e-6 ? Math.atan2(-matrix[0][1], matrix[0][0]) : 0;
  return { x: deg(x), y: deg(y), z: deg(z) };
}

function matrixCss(matrix: Mat) {
  const columns = [0, 1, 2].map((col) => [
    matrix[0][col] ?? 0,
    matrix[1][col] ?? 0,
    matrix[2][col] ?? 0,
  ]);
  const values = columns.flatMap((column) => [column[0], column[1], column[2], 0]);
  values.push(0, 0, 0, 1);
  return `matrix3d(${values.map((value) => (value ?? 0).toFixed(6)).join(",")})`;
}

function transpose(matrix: Mat): Mat {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]],
  ];
}

/** Apply Rx * Ry * Rz, the same composition CSS uses. */
export function settleMatrix(orient: { x: number; y: number; z: number }): Mat {
  return mulMat(rotX(orient.x), mulMat(rotY(orient.y), rotZ(orient.z)));
}

export function matMulVec(matrix: Mat, v: V): V {
  return [
    matrix[0][0] * v[0] + matrix[0][1] * v[1] + matrix[0][2] * v[2],
    matrix[1][0] * v[0] + matrix[1][1] * v[1] + matrix[1][2] * v[2],
    matrix[2][0] * v[0] + matrix[2][1] * v[1] + matrix[2][2] * v[2],
  ];
}

function rotX(degrees: number): Mat {
  const a = rad(degrees);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

function rotY(degrees: number): Mat {
  const a = rad(degrees);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

function rotZ(degrees: number): Mat {
  const a = rad(degrees);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

function mulMat(a: Mat, b: Mat): Mat {
  const out: Mat = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let row = 0; row < 3; row++) {
    const outRow = out[row];
    const aRow = a[row];
    const b0 = b[0];
    const b1 = b[1];
    const b2 = b[2];
    if (!outRow || !aRow || !b0 || !b1 || !b2) continue;
    for (let col = 0; col < 3; col++) {
      outRow[col] =
        aRow[0] * (b0[col] ?? 0) + aRow[1] * (b1[col] ?? 0) + aRow[2] * (b2[col] ?? 0);
    }
  }
  return out;
}

function add(a: V, b: V): V {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function sub(a: V, b: V): V {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function mul(a: V, s: number): V {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function dot(a: V, b: V) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: V, b: V): V {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function len(a: V) {
  return Math.hypot(a[0], a[1], a[2]);
}
function norm(a: V): V {
  const magnitude = len(a) || 1;
  return [a[0] / magnitude, a[1] / magnitude, a[2] / magnitude];
}
function dist(a: V, b: V) {
  return len(sub(a, b));
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function deg(radians: number) {
  return (radians * 180) / Math.PI;
}
function rad(degrees: number) {
  return (degrees * Math.PI) / 180;
}
