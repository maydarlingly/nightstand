// Цветы: розы, ромашки и лаванда — букеты в вазах, горшочки и гирлянды.
// Мелкие детали одного цвета склеиваются в одну геометрию, чтобы сцена не тормозила.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const petal = color => new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide });
const MATS = {
    blush: petal(0xf5b8c4), rose: petal(0xe46f8b), peach: petal(0xf8c9a6), white: petal(0xfbf5ec),
    lilac: petal(0xb89ad9), yellow: petal(0xf2cc58),
    stem: new THREE.MeshStandardMaterial({ color: 0x6c9450, roughness: 0.8 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x6a9a50, roughness: 0.7, side: THREE.DoubleSide }),
    vase: new THREE.MeshPhysicalMaterial({ color: 0xf6f1e8, roughness: 0.25, clearcoat: 0.6 }),
    pot: new THREE.MeshStandardMaterial({ color: 0xc8805a, roughness: 0.85 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 1 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xdcb46a, metalness: 0.55, roughness: 0.35 }),
};

// Отражения для золотой каймы и глазури вазы
export function useFlowerEnv(envMap) {
    for (const key of ['vase', 'gold']) {
        MATS[key].envMap = envMap;
        MATS[key].needsUpdate = true;
    }
}

const SPHERE = new THREE.SphereGeometry(1, 10, 8);
const SPHERE_LO = new THREE.SphereGeometry(1, 6, 5);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 6);
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

function rng(seed) {
    let s = seed * 9301 + 49297;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

const fromUp = dir => new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());

// Собирает детали по цветам, а в конце склеивает их
class Bunch {
    constructor() {
        this.parts = {};
        this.o = new THREE.Object3D();
    }

    put(geo, key, pos, quat, scale) {
        this.o.position.copy(pos);
        this.o.quaternion.copy(quat);
        this.o.scale.copy(scale);
        this.o.updateMatrix();
        (this.parts[key] ||= []).push(geo.clone().applyMatrix4(this.o.matrix));
    }

    // Деталь в системе координат цветка: P — центр, Q — поворот, s — размер
    local(geo, key, P, Q, s, lp, le, ls) {
        const pos = new THREE.Vector3(...lp).multiplyScalar(s).applyQuaternion(Q).add(P);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...le)).premultiply(Q);
        this.put(geo, key, pos, q, new THREE.Vector3(...ls).multiplyScalar(s));
    }

    stem(a, b, r) {
        const dir = new THREE.Vector3().subVectors(b, a);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        this.put(CYL, 'stem', mid, fromUp(dir), new THREE.Vector3(r, dir.length(), r));
    }

    leaf(at, dir, len) {
        const q = fromUp(dir);
        const pos = at.clone().addScaledVector(dir.clone().normalize(), len * 0.5);
        this.put(SPHERE_LO, 'leaf', pos, q, new THREE.Vector3(len * 0.22, len * 0.5, len * 0.05));
    }

    build() {
        const g = new THREE.Group();
        for (const [key, list] of Object.entries(this.parts)) {
            const m = new THREE.Mesh(mergeGeometries(list), MATS[key]);
            m.castShadow = m.receiveShadow = true;
            m.userData.keep = true;      // букет не пересоздаётся при смене размеров тумбы
            g.add(m);
            list.forEach(x => x.dispose());
        }
        return g;
    }
}

// ---------- Головки цветов ----------
function rose(b, P, Q, s, color) {
    b.local(SPHERE, color, P, Q, s, [0, 0.2, 0], [0, 0, 0], [0.4, 0.42, 0.4]);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        b.local(SPHERE, color, P, Q, s, [Math.cos(a) * 0.32, 0.16, Math.sin(a) * 0.32], [0, -a, 1.1], [0.36, 0.1, 0.34]);
    }
    for (let i = 0; i < 6; i++) {
        const a = ((i + 0.5) / 6) * TAU;
        b.local(SPHERE, color, P, Q, s, [Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62], [0, -a, 0.55], [0.42, 0.09, 0.4]);
    }
}

function daisy(b, P, Q, s) {
    b.local(SPHERE, 'yellow', P, Q, s, [0, 0.06, 0], [0, 0, 0], [0.28, 0.14, 0.28]);
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        b.local(SPHERE_LO, 'white', P, Q, s, [Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55], [0, -a, 0.15], [0.42, 0.05, 0.13]);
    }
}

function lavender(b, P, Q, s) {
    for (let k = 0; k < 10; k++) {
        const a = k * 2.4;
        b.local(SPHERE_LO, 'lilac', P, Q, s, [Math.cos(a) * 0.12, k * 0.26, Math.sin(a) * 0.12], [0, 0, 0], [0.16, 0.2, 0.16]);
    }
}

function head(b, kind, P, Q, s, color) {
    if (kind === 'daisy') daisy(b, P, Q, s);
    else if (kind === 'lavender') lavender(b, P, Q, s);
    else rose(b, P, Q, s, color);
}

// ---------- Букет ----------
const VASE = [[0, 0], [0.55, 0], [0.62, 0.06], [0.9, 0.35], [0.85, 0.6], [0.5, 0.85], [0.45, 0.95], [0.58, 1], [0.5, 1]];
const POT = [[0, 0], [0.72, 0], [0.92, 0.82], [1.04, 0.85], [1.04, 1], [0.9, 1]];

export function makeBouquet({
    height = 300, count = 9, spread = 1, vase = 'vase', seed = 1,
    kinds = ['rose', 'rose', 'daisy', 'lavender'], colors = ['blush', 'rose', 'peach'],
} = {}) {
    const rnd = rng(seed);
    const b = new Bunch();
    const mr = height * 0.1;                        // радиус горлышка
    let top;
    if (vase === 'pot') {
        const ph = height * 0.3;
        const geo = new THREE.LatheGeometry(POT.map(([r, t]) => new THREE.Vector2(r * mr * 1.5, t * ph)), 24);
        b.put(geo, 'pot', new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        b.put(CYL, 'soil', new THREE.Vector3(0, ph * 0.92, 0), new THREE.Quaternion(), new THREE.Vector3(mr * 1.3, 4, mr * 1.3));
        top = ph * 0.92;
    } else {
        const vh = height * 0.42;
        const geo = new THREE.LatheGeometry(VASE.map(([r, t]) => new THREE.Vector2(r * mr * 1.7, t * vh)), 28);
        b.put(geo, 'vase', new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        const rim = new THREE.TorusGeometry(mr * 0.95, Math.max(2, mr * 0.07), 8, 32);
        b.put(rim, 'gold', new THREE.Vector3(0, vh, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1));
        top = vh;
    }
    for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count, rr = Math.sqrt(t);
        const a = i * 2.39996 + rnd() * 0.4;
        const base = new THREE.Vector3(Math.cos(a) * mr * 0.5 * rr, top - 8, Math.sin(a) * mr * 0.5 * rr);
        const R = mr * 0.5 + height * 0.3 * spread * rr;
        const tip = new THREE.Vector3(Math.cos(a) * R, top + height * (0.42 - 0.16 * rr + rnd() * 0.12), Math.sin(a) * R);
        const dir = tip.clone().sub(base).normalize();
        b.stem(base, tip, Math.max(1.5, height * 0.008));
        const out = new THREE.Vector3(Math.cos(a), 0.4, Math.sin(a));
        for (const k of [0.35, 0.6]) {
            const at = base.clone().lerp(tip, k);
            b.leaf(at, dir.clone().add(out.clone().multiplyScalar(0.9 + rnd() * 0.5)), height * 0.11);
        }
        const kind = kinds[Math.floor(rnd() * kinds.length)];
        const color = colors[Math.floor(rnd() * colors.length)];
        const s = height * (kind === 'daisy' ? 0.07 : 0.085) * (0.85 + rnd() * 0.3);
        head(b, kind, tip, fromUp(dir), s, color);
    }
    return b.build();
}

// ---------- Гирлянда вдоль кривой ----------
export function makeGarland(points, { count = 40, size = 26, facing = new THREE.Vector3(0, 0, 1), seed = 4 } = {}) {
    const rnd = rng(seed);
    const b = new Bunch();
    const curve = new THREE.CatmullRomCurve3(points);
    const colors = ['blush', 'rose', 'white', 'peach'];
    for (let i = 0; i < count; i++) {
        const p = curve.getPoint(i / (count - 1));
        const tan = curve.getTangent(i / (count - 1));
        b.leaf(p, tan.clone().add(facing.clone().multiplyScalar(0.3)), size * 2.2);
        b.leaf(p, tan.clone().negate().add(facing.clone().multiplyScalar(0.3)), size * 2.2);
        if (i % 2 === 0) {
            const dir = facing.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).multiplyScalar(0.6));
            const kind = rnd() < 0.25 ? 'daisy' : 'rose';
            head(b, kind, p, fromUp(dir), size * (0.8 + rnd() * 0.4), colors[Math.floor(rnd() * colors.length)]);
        }
    }
    return b.build();
}
