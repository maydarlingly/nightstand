// Тумба: столешница с профилем, боковины с филёнками, выдвижной ящик с кольцами,
// дверца с арочной филёнкой и коваными петлями, точёные ножки.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applyBoxUV, makeNoise } from './textures.js';
import { makeCandle, makeHolder, archedPanelGeo } from './room.js';
import { makeBouquet } from './flowers.js';

// Допустимые размеры, мм
export const LIMITS = { width: [300, 1200], height: [450, 1100], depth: [300, 700] };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function rbox(w, h, d, r = 3) {
    return new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
}

function shade(m) {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

// ---------- Фурнитура ----------
// Кольцо-ручка на розетке: кольцо висит и слегка отходит от фасада
function ringPull(metal, s = 1) {
    const g = new THREE.Group();
    const plate = shade(new THREE.Mesh(new THREE.CylinderGeometry(20 * s, 22 * s, 4, 32), metal));
    plate.rotation.x = Math.PI / 2;
    plate.position.z = 2;
    const rim = shade(new THREE.Mesh(new THREE.TorusGeometry(21 * s, 2 * s, 8, 32), metal));
    rim.position.z = 4;
    const boss = shade(new THREE.Mesh(new THREE.SphereGeometry(6 * s, 16, 12), metal));
    boss.position.z = 8;
    const pivot = new THREE.Group();
    pivot.position.z = 10 * s;
    const ring = shade(new THREE.Mesh(new THREE.TorusGeometry(17 * s, 3.2 * s, 12, 40), metal));
    ring.position.y = -15 * s;
    pivot.add(ring);
    pivot.rotation.x = -0.22;
    g.add(plate, rim, boss, pivot);
    g.userData.ring = pivot;
    return g;
}

// Накладка с замочной скважиной
function keyhole(metal, s = 1) {
    const g = new THREE.Group();
    const plate = shade(new THREE.Mesh(new THREE.CylinderGeometry(13 * s, 13 * s, 3, 24), metal));
    plate.rotation.x = Math.PI / 2;
    const dark = new THREE.MeshBasicMaterial({ color: 0x0b0806 });
    const hole = new THREE.Mesh(new THREE.CircleGeometry(3.6 * s, 16), dark);
    hole.position.set(0, 3 * s, 1.6);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(3 * s, 9 * s), dark);
    slot.position.set(0, -2 * s, 1.6);
    g.add(plate, hole, slot);
    return g;
}

// Кованая петля-полоса с гвоздями
function strapHinge(iron, len) {
    const g = new THREE.Group();
    const strap = shade(new THREE.Mesh(new THREE.BoxGeometry(len, 16, 3), iron));
    strap.position.x = len / 2;
    const tip = shade(new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 3, 20), iron));
    tip.rotation.x = Math.PI / 2;
    tip.position.x = len;
    const barrel = shade(new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 34, 12), iron));
    barrel.position.set(-2, 0, -2);
    g.add(strap, tip, barrel);
    for (const t of [0.3, 0.62, 0.95]) {
        const nail = shade(new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), iron));
        nail.position.set(len * t, 0, 2);
        g.add(nail);
    }
    return g;
}

// Точёная ножка: профиль «ваза + кольца», волокна идут вдоль ножки
const LEG_PROFILE = [[0, 0], [13, 0], [16, 0.03], [17, 0.08], [12, 0.13], [14, 0.17], [11, 0.21], [15, 0.45], [18, 0.62],
    [13, 0.75], [11, 0.8], [16, 0.84], [13, 0.88], [18, 0.92], [20, 0.97], [20, 1], [0, 1]];

function turnedLeg(len, R) {
    const k = R / 20;
    const geo = new THREE.LatheGeometry(LEG_PROFILE.map(([r, t]) => new THREE.Vector2(r * k, t * len)), 28);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i), v = uv.getY(i);
        uv.setXY(i, v * len / 500, u * 2 * Math.PI * R / 500);
    }
    return geo;
}

// Фигурная царга: снизу — пологая арка между ножками
function apronGeo(len, height, thick, legZone) {
    const s = new THREE.Shape();
    const sag = Math.min(height * 0.45, 26);
    s.moveTo(-len / 2, 0);
    s.lineTo(-len / 2 + legZone, 0);
    s.quadraticCurveTo(0, sag * 2, len / 2 - legZone, 0);
    s.lineTo(len / 2, 0);
    s.lineTo(len / 2, height);
    s.lineTo(-len / 2, height);
    s.lineTo(-len / 2, 0);
    return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2, curveSegments: 20 });
}

// ---------- Тумба ----------
export function buildTumba({ w, h, d, wood, inner, brass, iron }) {
    // Сдвиги текстуры для каждой детали постоянные — рисунок не «прыгает» при изменении размеров
    let n = 0;
    const P = (geo, mat, x, y, z, { tile = 700, vertical = false } = {}) => {
        n++;
        applyBoxUV(geo, tile, [(n * 0.373) % 1, (n * 0.619) % 1], vertical);
        const m = shade(new THREE.Mesh(geo, mat));
        m.position.set(x, y, z);
        return m;
    };

    const g = new THREE.Group();
    const rings = [];
    const T = 18;                                   // толщина щитов
    const legH = Math.round(clamp(h * 0.18, 120, 190));
    const topT = 30;
    const bodyB = legH, bodyT = h - topT, bodyH = bodyT - bodyB;
    const fz = d / 2;                               // плоскость фасада
    const iw = w - 2 * T;                           // ширина проёма

    // Столешница и профиль под ней
    g.add(P(rbox(w + 24, topT, d + 18, 7), wood, 0, h - topT / 2, 9));
    g.add(P(rbox(w + 8, 14, d + 6, 4), wood, 0, bodyT - 7, 3));

    // Боковины с выпуклыми филёнками
    const sideH = bodyH - 14, sideY = bodyB + sideH / 2;
    const pm = clamp(Math.min(sideH, d) * 0.12, 28, 60);
    for (const s of [-1, 1]) {
        g.add(P(rbox(T, sideH, d, 3), wood, s * (w / 2 - T / 2), sideY, 0, { vertical: true }));
        g.add(P(rbox(8, sideH - 2 * pm, d - 2 * pm, 3), wood, s * (w / 2 + 2), sideY, 0, { vertical: true }));
    }

    // Задняя стенка и дно
    g.add(P(new THREE.BoxGeometry(iw, sideH, 10), inner, 0, sideY, -d / 2 + 5));
    g.add(P(new THREE.BoxGeometry(iw, T, d - 10), inner, 0, bodyB + T / 2, 5));

    // Разметка фасада: ящик сверху, дверца снизу
    const railT = 24, midRail = 22;
    const drawerH = Math.round(clamp(bodyH * 0.28, 110, 210));
    const dTop = bodyT - 14 - railT, dBot = dTop - drawerH;
    const doorTop = dBot - midRail, doorBot = bodyB + railT;
    const doorH = doorTop - doorBot;
    g.add(P(new THREE.BoxGeometry(iw, railT, T), wood, 0, dTop + railT / 2, fz - T / 2));
    g.add(P(new THREE.BoxGeometry(iw, midRail, T), wood, 0, dBot - midRail / 2, fz - T / 2));
    g.add(P(new THREE.BoxGeometry(iw, railT, T), wood, 0, bodyB + railT / 2, fz - T / 2));
    g.add(P(new THREE.BoxGeometry(iw, 12, d - 30), inner, 0, dBot - 6, -6));

    // ---- Выдвижной ящик ----
    const drawer = new THREE.Group();
    drawer.userData.part = 'drawer';
    const fw = iw - 6, fh = drawerH - 6, dy = dBot + drawerH / 2;
    drawer.add(P(rbox(fw, fh, 20, 3), wood, 0, dy, fz - 8));
    const m = clamp(fh * 0.17, 14, 30);
    drawer.add(P(rbox(fw - 2 * m, fh - 2 * m, 10, 3), wood, 0, dy, fz + 2));
    const dd = d - 70, bh = drawerH - 34, bw = fw - 30, by = dBot + 4 + bh / 2, bz = fz - 18 - dd / 2;
    for (const s of [-1, 1]) drawer.add(P(new THREE.BoxGeometry(12, bh, dd), inner, s * (bw / 2 - 6), by, bz));
    drawer.add(P(new THREE.BoxGeometry(bw, 12, dd), inner, 0, dBot + 10, bz));
    drawer.add(P(new THREE.BoxGeometry(bw, bh, 12), inner, 0, by, fz - 18 - dd + 6));
    // письмо с сургучной печатью внутри ящика
    const letter = shade(new THREE.Mesh(new THREE.BoxGeometry(bw * 0.45, 3, dd * 0.4), new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.9 })));
    letter.position.set(-bw * 0.12, dBot + 18, bz);
    letter.rotation.y = 0.15;
    const seal = shade(new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 4, 20), new THREE.MeshStandardMaterial({ color: 0x8a1712, roughness: 0.4 })));
    seal.position.set(-bw * 0.12, dBot + 21, bz);
    drawer.add(letter, seal);
    const ps = clamp(drawerH / 160, 0.75, 1.15);
    for (const x of fw > 640 ? [-fw * 0.27, fw * 0.27] : [0]) {
        const pull = ringPull(brass, ps);
        pull.position.set(x, dy + 10 * ps, fz + 7);
        drawer.add(pull);
        rings.push(pull.userData.ring);
    }
    g.add(drawer);

    // ---- Дверца ----
    let door = null;
    if (doorH >= 80) {
        const dw = iw - 6, dh = doorH - 6;
        door = new THREE.Group();
        door.userData.part = 'door';
        door.position.set(-iw / 2 + 3, doorBot + doorH / 2, fz + 2);    // ось петель — левый край
        door.add(P(rbox(dw, dh, 20, 3), wood, dw / 2, 0, -10));
        const pm2 = clamp(Math.min(dw, dh) * 0.14, 22, 50);
        door.add(P(archedPanelGeo(dw - 2 * pm2, dh - 2 * pm2), wood, dw / 2, 0, -2, { vertical: true }));
        for (const sy of [1, -1]) {
            const hinge = strapHinge(brass, clamp(dw * 0.28, 60, 150));
            hinge.position.set(0, sy * (dh / 2 - pm2 / 2), 1.5);
            door.add(hinge);
        }
        const ks = clamp(dh / 300, 0.5, 0.75);
        const hx = dw - pm2 - 34 * ks;
        const pull = ringPull(brass, ks);
        pull.position.set(hx, dh * 0.04, 7.5);
        door.add(pull);
        rings.push(pull.userData.ring);
        const kh = keyhole(brass, ks);
        kh.position.set(hx, dh * 0.04 - 58 * ks, 8.5);
        door.add(kh);
        g.add(door);

        // полка и кувшин внутри
        if (doorH > 260) g.add(P(new THREE.BoxGeometry(iw, T, d - 50), inner, 0, doorBot + doorH * 0.5, -d / 2 + 10 + (d - 50) / 2));
        if (doorH > 200) {
            const jh = Math.min(doorH * (doorH > 260 ? 0.4 : 0.6), 190);
            const jug = shade(new THREE.Mesh(new THREE.LatheGeometry(
                [[0, 0], [30, 0], [38, 0.1], [44, 0.35], [40, 0.6], [22, 0.8], [18, 0.9], [24, 1], [0, 1]]
                    .map(([r, t]) => new THREE.Vector2(r * jh / 190, t * jh)), 24),
                new THREE.MeshStandardMaterial({ color: 0x8a4b2a, roughness: 0.75 })));
            jug.position.set(-iw * 0.22, bodyB + T, -d * 0.05);
            g.add(jug);
        }
    }

    // ---- Ножки и царги ----
    const blockH = 60, lr = 22, turnedH = legH - blockH;
    const lx = w / 2 - lr - 6, lz = d / 2 - lr - 6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        g.add(P(rbox(2 * lr + 6, blockH, 2 * lr + 6, 3), wood, sx * lx, legH - blockH / 2, sz * lz, { vertical: true }));
        const leg = shade(new THREE.Mesh(turnedLeg(turnedH, lr), wood));
        leg.position.set(sx * lx, 0, sz * lz);
        g.add(leg);
    }
    const legZone = 2 * lr + 12;
    g.add(P(apronGeo(w - 4, blockH, T, legZone), wood, 0, legH - blockH, fz - T));
    for (const s of [-1, 1]) {
        const side = P(apronGeo(d - 4, blockH, T, legZone), wood, s > 0 ? w / 2 - T : -w / 2, legH - blockH, 0);
        side.rotation.y = Math.PI / 2;
        g.add(side);
    }
    g.add(P(new THREE.BoxGeometry(w - 4, blockH, T), wood, 0, legH - blockH / 2, -d / 2 + T / 2));

    return { group: g, drawer, door, rings, travel: dd * 0.85 };
}

// ---------- Вещи на столешнице ----------
const leathers = [0x6b2416, 0x2c3f2a, 0x4a2c16].map((base, i) => {
    const t = makeNoise({ base, amount: 0.35, cells: 20, seed: 61 + i });
    return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.2, roughness: 0.7 });
});
const pageMat = new THREE.MeshStandardMaterial({ color: 0xe9dcb8, roughness: 0.9 });

function book(bw, bt, bd, cover) {
    const g = new THREE.Group();
    g.add(shade(new THREE.Mesh(rbox(bw, 5, bd, 2), cover)).translateY(bt / 2 - 2.5));
    g.add(shade(new THREE.Mesh(rbox(bw, 5, bd, 2), cover)).translateY(-(bt / 2 - 2.5)));
    g.add(shade(new THREE.Mesh(rbox(10, bt, bd, 3), cover)).translateX(-bw / 2 + 5));
    g.add(shade(new THREE.Mesh(new THREE.BoxGeometry(bw - 14, bt - 10, bd - 8), pageMat)).translateX(3));
    return g;
}

// Букет на тумбе строится один раз и переносится при смене размеров
let bouquet = null;

export function buildTopItems({ w, h, d, metal }) {
    const g = new THREE.Group();
    const roomy = w >= 460;
    const cx = roomy ? -w * 0.24 : 0, cz = -d * 0.1;
    const holder = makeHolder(metal);
    holder.position.set(cx, h, cz);
    const candle = makeCandle({ height: 150, radius: 16, register: false });
    candle.group.position.set(cx, h + holder.userData.top, cz);
    const anchor = new THREE.Object3D();
    anchor.position.set(cx, h + holder.userData.top + candle.tipY + 12, cz);
    g.add(holder, candle.group, anchor);
    if (roomy) {
        bouquet ||= makeBouquet({ height: 250, count: 9, seed: 3 });
        bouquet.position.set(w * 0.22, h, -d * 0.05);
        g.add(bouquet);
    }
    if (w >= 820) {
        const b1 = book(240, 46, Math.min(175, d - 60), leathers[0]);
        b1.position.set(-w * 0.02, h + 23, d * 0.05);
        b1.rotation.y = 0.2;
        const b2 = book(200, 36, Math.min(150, d - 80), leathers[1]);
        b2.position.set(-w * 0.02 + 6, h + 46 + 18, d * 0.05);
        b2.rotation.y = -0.12;
        g.add(b1, b2);
    }
    return { group: g, anchor, flame: candle.flame };
}
