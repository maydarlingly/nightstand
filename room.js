// Светлая средневековая спальня принцессы: светлый камень, расписные стены, звёздный потолок,
// арочное окно со шторами, камин с гирляндой, кровать с балдахином, цветы, гобелен и золотая люстра.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TX from './textures.js';
import { makeBouquet, makeGarland } from './flowers.js';

// Все размеры в миллиметрах, как у тумбы
export const ROOM = { w: 5200, d: 4400, h: 3000 };
export const WINDOW = { z: -1350, width: 1100, sill: 850, top: 2500, wall: 320 };
export const BED = { x: 350, w: 1600, len: 2100 };
// Тумба стоит слева от кровати: её правый край не двигается, она растёт влево
export const NIGHTSTAND_RIGHT = BED.x - BED.w / 2 - 90;
const FIRE_Z = -450;

// Огоньки, которые мерцают (их анимирует script.js)
export const flames = [];

// ---------- Свеча и подсвечник ----------
const glowMat = new THREE.SpriteMaterial({
    map: TX.makeGlow(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
});
const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffc46b, transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
});
const flameGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(4.5, 3), new THREE.Vector2(6.5, 9),
    new THREE.Vector2(6, 16), new THREE.Vector2(3.5, 24), new THREE.Vector2(0, 32),
], 16);
const waxMat = new THREE.MeshStandardMaterial({ color: 0xf0e4c8, roughness: 0.55, emissive: 0x3a2008, emissiveIntensity: 0.25 });
const wickMat = new THREE.MeshBasicMaterial({ color: 0x1a1410 });

export function makeCandle({ height = 150, radius = 16, register = true } = {}) {
    const g = new THREE.Group();
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.94, radius, height, 24), waxMat);
    wax.position.y = height / 2;
    wax.castShadow = wax.receiveShadow = true;
    const drip = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.85, radius * 0.18, 8, 24), waxMat);
    drip.rotation.x = Math.PI / 2;
    drip.position.y = height - radius * 0.1;
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1, 12, 6), wickMat);
    wick.position.y = height + 5;
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = height + 8;
    const base = radius / 16;
    flame.scale.setScalar(base);
    const glow = new THREE.Sprite(glowMat);
    glow.position.y = height + 22;
    glow.scale.set(radius * 9, radius * 11, 1);
    g.add(wax, drip, wick, flame, glow);
    const entry = { obj: flame, base, glow, glowBase: [glow.scale.x, glow.scale.y], phase: Math.random() * 20 };
    if (register) flames.push(entry);
    return { group: g, flame: entry, tipY: height + 24 };
}

export function makeHolder(iron) {
    const g = new THREE.Group();
    const pts = [[0, 0], [52, 0], [54, 4], [50, 8], [16, 12], [10, 22], [13, 30], [8, 40], [9, 46], [30, 48], [32, 54], [0, 54]]
        .map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), iron);
    body.castShadow = body.receiveShadow = true;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(18, 4, 8, 24), iron);
    loop.position.set(62, 22, 0);
    loop.castShadow = true;
    g.add(body, loop);
    g.userData.top = 54;
    return g;
}

// Выпуклая арочная филёнка с фаской (для изголовья и дверцы тумбы)
export function archedPanelGeo(pw, ph, depth = 4, bevel = 5) {
    const w = pw - 2 * bevel, hh = ph - 2 * bevel;
    const r = Math.min(w / 2, hh * 0.32);
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -hh / 2);
    s.lineTo(w / 2, -hh / 2);
    s.lineTo(w / 2, hh / 2 - r);
    s.absellipse(0, hh / 2 - r, w / 2, r, 0, Math.PI, false);
    s.lineTo(-w / 2, -hh / 2);
    return new THREE.ExtrudeGeometry(s, {
        depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24,
    });
}

// ---------- Вспомогательное ----------
function mesh(geo, mat, cast = true, receive = true) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

// Брусок с текстурой «по размеру»
function block(w, h, d, mat, x, y, z, { tile = 1200, round = 0, vertical = false } = {}) {
    const geo = round
        ? new RoundedBoxGeometry(w, h, d, 2, Math.min(round, w / 2.2, h / 2.2, d / 2.2))
        : new THREE.BoxGeometry(w, h, d);
    TX.applyBoxUV(geo, tile, [Math.abs(x * 0.0007) % 1, Math.abs(z * 0.0011) % 1], vertical);
    const m = mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
}

function archPath(path, cx, halfW, bottom, top) {
    const spring = top - halfW;
    path.moveTo(cx - halfW, bottom);
    path.lineTo(cx + halfW, bottom);
    path.lineTo(cx + halfW, spring);
    path.absarc(cx, spring, halfW, 0, Math.PI, false);
    path.lineTo(cx - halfW, bottom);
    return path;
}

// Цилиндр между двумя точками (цепи люстры)
function rod(a, b, r, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), mat, true, false);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
}

// ---------- Ткани ----------
// Штора со складками: собрана к одному краю (anchor −1 — левый, +1 — правый) и подхвачена лентой
function curtainGeo(width, height, { tie = 0.48, gather = 0.28, folds = 7, depth = 28, anchor = -1 } = {}) {
    const geo = new THREE.PlaneGeometry(width, height, 40, 30);
    const p = geo.attributes.position;
    const x0 = anchor * width / 2;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        const ty = (y + height / 2) / height;           // 0 — низ, 1 — верх
        const k = ty > tie
            ? gather + (1 - gather) * ((ty - tie) / (1 - tie))
            : gather + (0.55 - gather) * ((tie - ty) / tie);
        const z = Math.sin(((x + width / 2) / width) * folds * Math.PI * 2) * depth * (1.3 - k * 0.6);
        p.setXYZ(i, x0 + (x - x0) * k, y, z);
    }
    geo.computeVertexNormals();
    return geo;
}

// Золотая лента-подхват вокруг собранной шторы
function tieBand(mat, x, y, z, halfLen) {
    const band = mesh(new THREE.TorusGeometry(1, 0.1, 8, 28), mat, false, false);
    band.scale.set(55, halfLen, 170);
    band.rotation.x = Math.PI / 2;
    band.position.set(x, y, z);
    return band;
}

// Полоса ткани с мелкими складками (ламбрекен, задник балдахина)
function pleatGeo(width, height, depth = 12, step = 0.045) {
    const geo = new THREE.PlaneGeometry(width, height, Math.ceil(width / 25), 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * step) * depth);
    geo.computeVertexNormals();
    return geo;
}

// ---------- Комната ----------
export function buildRoom(scene, envMap) {
    const { w, d, h } = ROOM;
    const room = new THREE.Group();
    scene.add(room);

    // Материалы: светлый камень, расписная штукатурка, медовое дерево, пудровые ткани
    const planks = TX.makePlanks({ base: 0xc49b6e, dark: 0x8f6a45 });
    const stone = TX.makeStone({
        palette: [0xebe2d3, 0xe2d7c4, 0xf0e8db, 0xdccfb9, 0xe7dccb, 0xd8ccb8], mortarColor: 0xc9bca6, soot: 0.25,
    });
    const stencil = TX.makeStencil();
    const stars = TX.makeStarCeiling();
    const beam = TX.makeWood({ base: 0xcda678, dark: 0x9a754d, rings: 5, seed: 17 });
    const bedWood = TX.makeWood({ base: 0xf6efe4, dark: 0xe0d3bf, rings: 7, seed: 23 });
    const bark = TX.makeNoise({ base: 0x5a3c26, amount: 0.6, cells: 12, seed: 51 });
    const ember = TX.makeNoise({ base: 0xff6a20, amount: 1.4, cells: 10, seed: 57 });
    const linen = TX.makeFabric({ base: 0xfbf6ef, seed: 3 });
    const blush = TX.makeFabric({ base: 0xf2c3ca, stripe: 0xfbf1ea, seed: 9 });
    const silk = TX.makeFabric({ base: 0xf7e4e2, seed: 15 });
    const sheer = TX.makeFabric({ base: 0xfdf8f2, seed: 19 });

    const floorMat = new THREE.MeshStandardMaterial({ map: planks.map, bumpMap: planks.bump, bumpScale: 2.5, roughness: 0.55 });
    const stoneMat = new THREE.MeshStandardMaterial({ map: stone.map, bumpMap: stone.bump, bumpScale: 10, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ map: stencil.map, bumpMap: stencil.bump, bumpScale: 1.5, roughness: 0.95 });
    const ceilMat = new THREE.MeshStandardMaterial({ map: stars.map, bumpMap: stars.bump, bumpScale: 1.5, roughness: 0.9 });
    const beamMat = new THREE.MeshStandardMaterial({ map: beam.map, bumpMap: beam.bump, bumpScale: 1.2, roughness: 0.7 });
    const bedMat = new THREE.MeshPhysicalMaterial({
        map: bedWood.map, bumpMap: bedWood.bump, bumpScale: 0.6, roughness: 0.5,
        clearcoat: 0.25, clearcoatRoughness: 0.4, envMap, envMapIntensity: 0.3,
    });
    const gold = new THREE.MeshStandardMaterial({ color: 0xdcb46a, metalness: 0.55, roughness: 0.35, envMap, envMapIntensity: 1 });
    const sootMat = new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 1 });
    const barkMat = new THREE.MeshStandardMaterial({ map: bark.map, bumpMap: bark.bump, bumpScale: 6, roughness: 1 });
    const linenMat = new THREE.MeshStandardMaterial({ map: linen.map, bumpMap: linen.bump, bumpScale: 1, roughness: 0.95 });
    const blushMat = new THREE.MeshStandardMaterial({ map: blush.map, bumpMap: blush.bump, bumpScale: 1.2, roughness: 0.95 });
    const silkMat = new THREE.MeshStandardMaterial({ map: silk.map, bumpMap: silk.bump, bumpScale: 0.8, roughness: 0.75, side: THREE.DoubleSide });
    const sheerMat = new THREE.MeshStandardMaterial({
        map: sheer.map, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.88,
    });

    // ---- Пол, стены, потолок ----
    const floor = mesh(TX.scaleUV(new THREE.PlaneGeometry(w, d), w / 1800, d / 1800), floorMat, false, true);
    floor.rotation.x = -Math.PI / 2;
    room.add(floor);

    const back = mesh(TX.scaleUV(new THREE.PlaneGeometry(w, h), w / 2200, h / 2200), stoneMat, false, true);
    back.position.set(0, h / 2, -d / 2);
    room.add(back);

    // Левая стена — толстая, с арочным проёмом: через него падает солнце
    const hw = WINDOW.width / 2, cu = -WINDOW.z;
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-d / 2, 0); wallShape.lineTo(d / 2, 0); wallShape.lineTo(d / 2, h); wallShape.lineTo(-d / 2, h); wallShape.lineTo(-d / 2, 0);
    wallShape.holes.push(archPath(new THREE.Path(), cu, hw, WINDOW.sill, WINDOW.top));
    const left = mesh(TX.scaleUV(new THREE.ExtrudeGeometry(wallShape, { depth: WINDOW.wall, bevelEnabled: false, curveSegments: 32 }), 1 / 1400), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.x = -w / 2 - WINDOW.wall;
    room.add(left);

    const right = mesh(TX.scaleUV(new THREE.PlaneGeometry(d, h), d / 1400, h / 1400), wallMat, false, true);
    right.rotation.y = -Math.PI / 2;
    right.position.set(w / 2, h / 2, 0);
    room.add(right);

    const front = mesh(TX.scaleUV(new THREE.PlaneGeometry(w, h), w / 1400, h / 1400), wallMat, false, true);
    front.rotation.y = Math.PI;
    front.position.set(0, h / 2, d / 2);
    room.add(front);

    const ceil = mesh(TX.scaleUV(new THREE.PlaneGeometry(w, d), w / 1400, d / 1400), ceilMat, false, true);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = h;
    room.add(ceil);

    // Расписной фриз с розами по периметру под балками
    const friezeMat = new THREE.MeshStandardMaterial({ map: TX.makeFrieze(), roughness: 0.9 });
    const fy = h - 170 - 115;
    for (const [len, x, z, ry] of [[w, 0, -d / 2 + 3, 0], [d, -w / 2 + 3, 0, Math.PI / 2], [d, w / 2 - 3, 0, -Math.PI / 2], [w, 0, d / 2 - 3, Math.PI]]) {
        const strip = mesh(TX.scaleUV(new THREE.PlaneGeometry(len, 220), len / 1400, 1), friezeMat, false, true);
        strip.position.set(x, fy, z);
        strip.rotation.y = ry;
        room.add(strip);
    }

    // ---- Балки и фахверк ----
    for (const z of [-1700, -650, 400, 1450]) room.add(block(w, 200, 170, beamMat, 0, h - 100, z, { tile: 1600 }));
    room.add(block(w, 170, 120, beamMat, 0, h - 85, -d / 2 + 60, { tile: 1600 }));
    room.add(block(w, 170, 120, beamMat, 0, h - 85, d / 2 - 60, { tile: 1600 }));
    room.add(block(120, 170, d, beamMat, -w / 2 + 60, h - 85, 0, { tile: 1600 }));
    room.add(block(120, 170, d, beamMat, w / 2 - 60, h - 85, 0, { tile: 1600 }));
    for (const z of [-d / 2 + 90, 250, 1450]) room.add(block(70, h, 160, beamMat, -w / 2 + 35, h / 2, z, { tile: 1600, vertical: true }));
    for (const z of [-d / 2 + 90, 800, 1800]) room.add(block(70, h, 160, beamMat, w / 2 - 35, h / 2, z, { tile: 1600, vertical: true }));
    for (const x of [-w / 2 + 90, -900, 900, w / 2 - 90]) room.add(block(160, h, 70, beamMat, x, h / 2, d / 2 - 35, { tile: 1600, vertical: true }));

    // ---- Окно ----
    const inner = 70;
    const fx = -w / 2 - WINDOW.wall * 0.55;
    const frameShape = archPath(new THREE.Shape(), cu, hw, WINDOW.sill, WINDOW.top);
    frameShape.holes.push(archPath(new THREE.Path(), cu, hw - inner, WINDOW.sill + inner, WINDOW.top - inner));
    const frame = mesh(TX.scaleUV(new THREE.ExtrudeGeometry(frameShape, { depth: 90, bevelEnabled: false, curveSegments: 32 }), 1 / 900), bedMat);
    frame.rotation.y = Math.PI / 2;
    frame.position.x = fx;
    room.add(frame);
    const midX = fx + 45;
    room.add(block(90, WINDOW.top - WINDOW.sill - 2 * inner, 40, bedMat, midX, (WINDOW.sill + WINDOW.top) / 2, WINDOW.z, { vertical: true }));
    room.add(block(90, 40, 2 * (hw - inner), bedMat, midX, WINDOW.top - hw, WINDOW.z));
    const paneGeo = TX.fitUV(new THREE.ShapeGeometry(archPath(new THREE.Shape(), cu, hw - inner, WINDOW.sill + inner, WINDOW.top - inner), 32));
    const lattice = mesh(paneGeo, new THREE.MeshStandardMaterial({
        map: TX.makeLattice(), alphaTest: 0.5, color: 0xb9b2a8, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide,
    }), true, false);
    lattice.rotation.y = Math.PI / 2;
    lattice.position.x = midX;
    room.add(lattice);
    const glass = new THREE.Mesh(paneGeo, new THREE.MeshStandardMaterial({
        color: 0xe6f0f2, transparent: true, opacity: 0.1, roughness: 0.08, depthWrite: false, side: THREE.DoubleSide,
    }));
    glass.rotation.y = Math.PI / 2;
    glass.position.x = midX + 3;
    room.add(glass);
    room.add(block(226, 50, WINDOW.width + 140, stoneMat, -w / 2 + 27, WINDOW.sill - 25, WINDOW.z, { tile: 900 }));

    const skyDay = TX.makeSky(false), skyNight = TX.makeSky(true);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyDay, toneMapped: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(6000, 4500), skyMat);
    sky.rotation.y = Math.PI / 2;
    sky.position.set(-w / 2 - 2500, 1800, WINDOW.z);
    room.add(sky);

    // Лёгкие шторы на золотом карнизе
    const cx = -w / 2 + 150, rodY = 2680;
    const rodA = -d / 2 + 40, rodB = WINDOW.z + 920;
    const rodBar = mesh(new THREE.CylinderGeometry(14, 14, rodB - rodA, 12), gold);
    rodBar.rotation.x = Math.PI / 2;
    rodBar.position.set(cx, rodY, (rodA + rodB) / 2);
    room.add(rodBar);
    for (const z of [rodA, rodB]) {
        const knob = mesh(new THREE.SphereGeometry(30, 16, 12), gold);
        knob.position.set(cx, rodY, z);
        room.add(knob);
    }
    for (const [zc, anchor] of [[WINDOW.z - 560, 1], [WINDOW.z + 620, -1]]) {
        const c = mesh(curtainGeo(560, rodY - 30, { anchor, folds: 6, gather: 0.32 }), sheerMat, false, true);
        c.rotation.y = Math.PI / 2;
        c.position.set(cx, 30 + (rodY - 30) / 2, zc);
        room.add(c);
        const tieZ = zc - anchor * (280 - 560 * 0.32 / 2);
        room.add(tieBand(gold, cx, 30 + (rodY - 30) * 0.48, tieZ, 110));
    }

    // ---- Камин из светлого камня ----
    const fp = new THREE.Group();
    room.add(fp);
    const wx = w / 2, openW = 1100, openH = 1000, jamb = 280, depth = 520, hearthH = 70;
    fp.add(block(720, hearthH, openW + 2 * jamb + 300, stoneMat, wx - 360, hearthH / 2, FIRE_Z, { tile: 1100 }));
    for (const s of [-1, 1]) {
        fp.add(block(depth, openH, jamb, stoneMat, wx - depth / 2, hearthH + openH / 2, FIRE_Z + s * (openW / 2 + jamb / 2), { tile: 1100 }));
    }
    const mantelY = hearthH + openH;
    fp.add(block(depth + 90, 190, openW + 2 * jamb + 180, beamMat, wx - (depth + 90) / 2, mantelY + 95, FIRE_Z, { tile: 1600 }));
    const hoodH = h - 170 - (mantelY + 190);
    fp.add(block(depth - 80, hoodH, openW + 2 * jamb - 60, stoneMat, wx - (depth - 80) / 2, mantelY + 190 + hoodH / 2, FIRE_Z, { tile: 1100 }));
    fp.add(block(60, openH, openW, sootMat, wx - 30, hearthH + openH / 2, FIRE_Z));
    fp.add(block(depth - 60, 40, openW, sootMat, wx - depth / 2, mantelY - 20, FIRE_Z));
    for (const [x, y, z, rot] of [[wx - 300, hearthH + 50, FIRE_Z - 150, 0.1], [wx - 260, hearthH + 50, FIRE_Z + 150, -0.12], [wx - 280, hearthH + 140, FIRE_Z, 0.5]]) {
        const log = mesh(new THREE.CylinderGeometry(55, 60, 760, 14), barkMat);
        log.rotation.set(Math.PI / 2, 0, rot);
        log.position.set(x, y, z);
        fp.add(log);
    }
    const embers = new THREE.Mesh(new THREE.BoxGeometry(380, 10, 820), new THREE.MeshStandardMaterial({
        color: 0x1a0a04, emissive: 0xff4a12, emissiveIntensity: 1.6, emissiveMap: ember.map, roughness: 1,
    }));
    embers.position.set(wx - 280, hearthH + 5, FIRE_Z);
    fp.add(embers);
    const fireGlow = new THREE.Sprite(glowMat);
    fireGlow.scale.set(1100, 800, 1);
    fireGlow.position.set(wx - 300, hearthH + 260, FIRE_Z);
    fp.add(fireGlow);
    for (let i = 0; i < 7; i++) {
        const f = new THREE.Mesh(flameGeo, flameMat);
        const s = 7 + ((i * 37) % 5);
        f.scale.setScalar(s);
        f.position.set(wx - 270 + ((i * 53) % 120) - 60, hearthH + 90, FIRE_Z + (i - 3) * 95);
        fp.add(f);
        flames.push({ obj: f, base: s, phase: i * 2.7, glow: i === 3 ? fireGlow : null, glowBase: [1100, 800] });
    }
    const fireLight = new THREE.PointLight(0xff9a50, 2e6, 0, 2);
    fireLight.position.set(wx - 500, hearthH + 350, FIRE_Z);
    room.add(fireLight);
    const mantelTop = mantelY + 190;
    for (const s of [-1, 1]) {
        const holder = makeHolder(gold);
        holder.position.set(wx - 230, mantelTop, FIRE_Z + s * 620);
        const c = makeCandle({ height: 200 + s * 40, radius: 18 });
        c.group.position.set(wx - 230, mantelTop + holder.userData.top, FIRE_Z + s * 620);
        fp.add(holder, c.group);
    }
    const mantelVase = makeBouquet({ height: 380, count: 11, seed: 5 });
    mantelVase.position.set(wx - 300, mantelTop, FIRE_Z);
    fp.add(mantelVase);
    // гирлянда из роз по краю каминной полки
    const gx = wx - depth - 100, span = (openW + 2 * jamb + 180) / 2 - 40;
    fp.add(makeGarland([
        new THREE.Vector3(gx, mantelTop - 20, FIRE_Z - span), new THREE.Vector3(gx - 10, mantelTop - 170, FIRE_Z - span / 2),
        new THREE.Vector3(gx, mantelTop - 30, FIRE_Z), new THREE.Vector3(gx - 10, mantelTop - 170, FIRE_Z + span / 2),
        new THREE.Vector3(gx, mantelTop - 20, FIRE_Z + span),
    ], { count: 46, size: 24, facing: new THREE.Vector3(-1, 0.3, 0), seed: 8 }));

    // ---- Кровать с балдахином ----
    const bx = BED.x, bw = BED.w, z0 = -d / 2;
    const headZ = z0 + 70, footZ = z0 + BED.len - 55;
    const midZ = (headZ + footZ) / 2, railLen = footZ - headZ;
    const postH = 2150;
    const px = s => bx + s * (bw / 2 - 55);
    for (const s of [-1, 1]) {
        for (const z of [headZ, footZ]) {
            room.add(block(110, postH, 110, bedMat, px(s), postH / 2, z, { tile: 900, vertical: true, round: 6 }));
            const fin = mesh(new THREE.SphereGeometry(48, 20, 14), gold);
            fin.position.set(px(s), postH + 50, z);
            room.add(fin);
        }
        room.add(block(70, 200, railLen, bedMat, bx + s * (bw / 2 - 35), 330, midZ, { tile: 900 }));
        room.add(block(110, 100, railLen, bedMat, px(s), postH - 50, midZ, { tile: 900 }));
    }
    for (const z of [headZ, footZ]) room.add(block(bw, 100, 110, bedMat, bx, postH - 50, z, { tile: 900 }));
    // изголовье с арочными филёнками и золотой кромкой
    room.add(block(bw - 110, 640, 50, bedMat, bx, 840, headZ, { tile: 900, round: 4 }));
    room.add(block(bw - 40, 70, 90, bedMat, bx, 1195, headZ, { tile: 900, round: 10 }));
    room.add(block(bw - 60, 10, 92, gold, bx, 1160, headZ));
    const pg = 50, pw = (bw - 110 - 4 * pg) / 3;
    for (let i = 0; i < 3; i++) {
        const geo = TX.applyBoxUV(archedPanelGeo(pw, 470), 900, [i * 0.3, 0.2], true);
        const p = mesh(geo, bedMat);
        p.position.set(bx - (bw - 110) / 2 + pg + pw / 2 + i * (pw + pg), 845, headZ + 25);
        room.add(p);
    }
    room.add(block(bw - 110, 360, 50, bedMat, bx, 440, footZ, { tile: 900, round: 4 }));
    // балдахин: крыша, задник, ламбрекены и шторы у столбиков
    const roof = mesh(new THREE.PlaneGeometry(bw, railLen), silkMat, false, true);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(bx, postH - 30, midZ);
    room.add(roof);
    const backPanel = mesh(pleatGeo(bw - 110, postH - 1240, 14, 0.05), silkMat, false, true);
    backPanel.position.set(bx, (1240 + postH) / 2, headZ - 35);
    room.add(backPanel);
    const valH = 250, valY = postH - valH / 2 - 10;
    const footVal = mesh(pleatGeo(bw + 60, valH), silkMat, false, true);
    footVal.position.set(bx, valY, footZ + 62);
    room.add(footVal, block(bw + 60, 16, 16, gold, bx, valY - valH / 2, footZ + 64));
    for (const s of [-1, 1]) {
        const val = mesh(pleatGeo(railLen + 120, valH), silkMat, false, true);
        val.rotation.y = s * Math.PI / 2;
        val.position.set(px(s) + s * 62, valY, midZ);
        room.add(val, block(16, 16, railLen + 120, gold, px(s) + s * 64, valY - valH / 2, midZ));
        const ch = postH - 60;
        for (const [anchorZ, anchor] of [[footZ + 40, -1], [headZ + 30, 1]]) {
            const c = mesh(curtainGeo(760, ch, { anchor, folds: 7 }), silkMat, false, true);
            c.rotation.y = Math.PI / 2;
            c.position.set(px(s) + s * 75, 30 + ch / 2, anchorZ + anchor * 380);
            room.add(c);
            room.add(tieBand(gold, px(s) + s * 75, 30 + ch * 0.48, anchorZ + anchor * 110, 120));
        }
    }
    room.add(makeGarland([
        new THREE.Vector3(px(-1), valY - valH / 2, footZ + 80), new THREE.Vector3(bx - bw / 4, valY - valH / 2 - 120, footZ + 80),
        new THREE.Vector3(bx, valY - valH / 2 - 10, footZ + 80), new THREE.Vector3(bx + bw / 4, valY - valH / 2 - 120, footZ + 80),
        new THREE.Vector3(px(1), valY - valH / 2, footZ + 80),
    ], { count: 40, size: 22, facing: new THREE.Vector3(0, 0.2, 1), seed: 12 }));
    // постель
    const mw = bw - 150, ml = railLen - 80;
    room.add(block(mw, 220, ml, linenMat, bx, 520, midZ, { tile: 700, round: 60 }));
    const blanketL = ml * 0.64;
    room.add(block(mw + 70, 190, blanketL, blushMat, bx, 560, footZ - 40 - blanketL / 2, { tile: 900, round: 40 }));
    room.add(block(mw + 80, 70, 160, linenMat, bx, 640, footZ - blanketL, { tile: 700, round: 30 }));
    for (const s of [-1, 1]) {
        const pillow = block(600, 160, 380, linenMat, bx + s * 340, 690, headZ + 260, { tile: 700, round: 70 });
        pillow.rotation.x = -0.35;
        const small = block(420, 130, 260, blushMat, bx + s * 230, 700, headZ + 470, { tile: 700, round: 55 });
        small.rotation.x = -0.25;
        room.add(pillow, small);
    }

    // ---- Сундук у изножья с букетом ----
    const chest = new THREE.Group();
    chest.position.set(bx, 0, footZ + 420);
    room.add(chest);
    const cw = 1050, chH = 430, cd = 520;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) chest.add(block(70, 30, 70, gold, sx * (cw / 2 - 50), 15, sz * (cd / 2 - 50)));
    chest.add(block(cw, chH, cd, bedMat, 0, 30 + chH / 2, 0, { tile: 900, round: 6 }));
    chest.add(block(cw + 30, 90, cd + 30, bedMat, 0, 30 + chH + 45, 0, { tile: 900, round: 20 }));
    for (const x of [-cw * 0.32, cw * 0.32]) chest.add(block(40, chH + 96, cd + 40, gold, x, 30 + (chH + 96) / 2, 0));
    chest.add(block(110, 130, 12, gold, 0, chH - 10, cd / 2 + 18));
    const chestFlowers = makeBouquet({ height: 440, count: 13, seed: 21 });
    chestFlowers.position.set(cw * 0.18, 30 + chH + 90, 0);
    chest.add(chestFlowers);

    // ---- Цветы у окна ----
    for (const s of [-1, 1]) {
        const pot = makeBouquet({ height: 230, count: 7, vase: 'pot', kinds: ['daisy', 'rose', 'rose'], colors: ['blush', 'white'], seed: 30 + s });
        pot.position.set(-w / 2 + 40, WINDOW.sill, WINDOW.z + s * 330);
        room.add(pot);
    }
    const floorVase = makeBouquet({ height: 900, count: 16, spread: 0.8, kinds: ['lavender', 'rose', 'lavender', 'daisy'], seed: 41 });
    floorVase.position.set(-w / 2 + 320, 0, -180);
    room.add(floorVase);

    // ---- Ковёр ----
    const rugMap = TX.makeRug();
    const rug = mesh(new THREE.BoxGeometry(3000, 10, 2000), new THREE.MeshStandardMaterial({
        map: rugMap, bumpMap: rugMap, bumpScale: 1.2, roughness: 1,
    }), false, true);
    rug.position.set(-150, 5, -650);
    room.add(rug);

    // ---- Гобелен «мильфлёр» справа от кровати ----
    const tapX = 1850;
    const tapGeo = new THREE.PlaneGeometry(900, 1350, 30, 1);
    const tp = tapGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) tp.setZ(i, Math.sin(tp.getX(i) * 0.03) * 10 + Math.sin(tp.getX(i) * 0.011) * 6);
    tapGeo.computeVertexNormals();
    const tap = mesh(tapGeo, new THREE.MeshStandardMaterial({ map: TX.makeTapestry(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }));
    tap.position.set(tapX, 1850, -d / 2 + 30);
    room.add(tap);
    const tapRod = mesh(new THREE.CylinderGeometry(12, 12, 1060, 12), gold);
    tapRod.rotation.z = Math.PI / 2;
    tapRod.position.set(tapX, 2540, -d / 2 + 40);
    room.add(tapRod);
    for (const s of [-1, 1]) {
        const knob = mesh(new THREE.SphereGeometry(24, 16, 12), gold);
        knob.position.set(tapX + s * 545, 2540, -d / 2 + 40);
        room.add(knob);
    }

    // ---- Золотая люстра со свечами ----
    const chand = new THREE.Group();
    chand.position.set(-250, h - 1000, -650);
    room.add(chand);
    const ring = mesh(new THREE.TorusGeometry(420, 14, 10, 64), gold);
    ring.rotation.x = Math.PI / 2;
    chand.add(ring);
    for (let k = 0; k < 2; k++) {
        const spoke = block(860, 12, 12, gold, 0, 0, 0);
        spoke.rotation.y = k * Math.PI / 2;
        chand.add(spoke);
    }
    const top = new THREE.Vector3(0, 800, 0);
    chand.add(rod(new THREE.Vector3(0, 0, 0), top, 8, gold));
    for (let k = 0; k < 3; k++) {
        const a = k * Math.PI * 2 / 3;
        chand.add(rod(new THREE.Vector3(Math.cos(a) * 420, 0, Math.sin(a) * 420), top, 3.5, gold));
    }
    for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + Math.PI / 6;
        const x = Math.cos(a) * 420, z = Math.sin(a) * 420;
        const cup = mesh(new THREE.CylinderGeometry(32, 24, 22, 16), gold);
        cup.position.set(x, 20, z);
        const c = makeCandle({ height: 130, radius: 15 });
        c.group.position.set(x, 31, z);
        chand.add(cup, c.group);
    }
    const chandLight = new THREE.PointLight(0xffc27a, 1e6, 0, 2);
    chandLight.position.set(0, 200, 0);
    chand.add(chandLight);

    return { skyMat, skyDay, skyNight, fireLight, chandLight };
}
