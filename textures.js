// Процедурные текстуры: дерево, доски пола, камень, штукатурка, ткань, ковёр, гобелен.
// Всё рисуется на <canvas> прямо в браузере, поэтому отдельные картинки не нужны.
import * as THREE from 'three';

// ---------- Шум ----------
function hash(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

// Плавный шум, который повторяется каждые px × py клеток — поэтому текстура без швов
function noise(x, y, px, py, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = hash(x0, y0, seed), b = hash(x1, y0, seed);
    const c = hash(x0, y1, seed), d = hash(x1, y1, seed);
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Несколько слоёв шума. u, v — от 0 до 1, cx × cy — число клеток (целые числа)
function fbm(u, v, cx, cy, seed, octaves = 4) {
    let sum = 0, amp = 0.5, norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += noise(u * cx, v * cy, cx, cy, seed + i * 31) * amp;
        norm += amp;
        cx *= 2; cy *= 2; amp *= 0.5;
    }
    return sum / norm;
}

// Предсказуемый генератор случайных чисел: при каждом запуске рисунок одинаковый
function random(seed) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
const rgb = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

function canvas(w, h = w) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

// Попиксельное рисование: fn(x, y, out) пишет в out [r, g, b, высота 0..1]
// Получаем сразу два холста: цвет и карту рельефа (bump)
function paint(w, h, fn) {
    const color = canvas(w, h), bump = canvas(w, h);
    const cctx = color.getContext('2d'), bctx = bump.getContext('2d');
    const ci = cctx.createImageData(w, h), bi = bctx.createImageData(w, h);
    const out = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            fn(x, y, out);
            const i = (y * w + x) * 4;
            ci.data[i] = out[0]; ci.data[i + 1] = out[1]; ci.data[i + 2] = out[2]; ci.data[i + 3] = 255;
            const hv = clamp01(out[3]) * 255;
            bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = hv; bi.data[i + 3] = 255;
        }
    }
    cctx.putImageData(ci, 0, 0);
    bctx.putImageData(bi, 0, 0);
    return { color, bump };
}

export function toTexture(cnv, isColor = true) {
    const tex = new THREE.CanvasTexture(cnv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function pack({ color, bump }) {
    return { map: toTexture(color), bump: toTexture(bump, false), canvas: color };
}

// ---------- Дерево ----------
// Рисунок волокон: 0 — светлая древесина, 1 — тёмные годовые кольца
function grain(u, v, seed, rings) {
    const warp = fbm(u, v, 2, 3, seed, 3) * 2.6;
    const r = v * rings + warp + Math.sin(u * Math.PI * 2 + seed) * 0.25;
    const ring = Math.pow(Math.abs(Math.sin(r * Math.PI)), 4);
    const pores = fbm(u, v, 4, 40, seed + 7, 2);
    const fibre = noise(u * 8, v * 260, 8, 260, seed + 13);
    return clamp01(ring * 0.6 + (pores - 0.5) * 0.8 + (fibre - 0.5) * 0.22 + 0.1);
}

export function woodCanvases({ base, dark, size = 512, rings = 6, seed = 1 }) {
    const B = rgb(base), D = rgb(dark);
    return paint(size, size, (x, y, o) => {
        const t = grain(x / size, y / size, seed, rings);
        o[0] = B[0] + (D[0] - B[0]) * t;
        o[1] = B[1] + (D[1] - B[1]) * t;
        o[2] = B[2] + (D[2] - B[2]) * t;
        o[3] = 1 - t * 0.7;
    });
}

export const makeWood = opts => pack(woodCanvases(opts));

// ---------- Дощатый пол ----------
export function makePlanks({ size = 1024, rows = 6, base = 0x6b4529, dark = 0x2e1b0e, seed = 3 } = {}) {
    const rnd = random(seed);
    const rowH = size / rows;
    const info = Array.from({ length: rows }, () => ({ n: rnd() < 0.5 ? 1 : 2, off: Math.floor(rnd() * size) }));
    const B = rgb(base), D = rgb(dark);
    return pack(paint(size, size, (x, y, o) => {
        const row = Math.floor(y / rowH), r = info[row];
        const len = size / r.n;
        const xs = (x - r.off + size) % size;
        const k = Math.floor(xs / len);
        const lx = xs - k * len, ly = y - row * rowH;
        const edge = Math.min(lx, len - lx, ly, rowH - ly);
        if (edge < 2.2) {   // щель между досками
            o[0] = D[0] * 0.45; o[1] = D[1] * 0.45; o[2] = D[2] * 0.45; o[3] = 0;
            return;
        }
        const id = row * 7 + k;
        const tone = 0.82 + hash(id, 1, seed) * 0.32;
        const t = grain(x / size, y / size, seed + id * 5, 12);
        o[0] = (B[0] + (D[0] - B[0]) * t) * tone;
        o[1] = (B[1] + (D[1] - B[1]) * t) * tone;
        o[2] = (B[2] + (D[2] - B[2]) * t) * tone;
        o[3] = (0.55 + 0.45 * (1 - t)) * clamp01((edge - 2.2) / 4);
    }));
}

// ---------- Каменная кладка ----------
export function makeStone({
    size = 1024, rows = 7, seed = 11, soot = 0.7, mortarColor = 0x4f4840,
    palette: tones = [0x8c8274, 0x7b7366, 0x968b7b, 0x70695f, 0x9b9282, 0x857a6a],
} = {}) {
    const rnd = random(seed);
    const rowH = size / rows;
    const rowsInfo = [];
    for (let r = 0; r < rows; r++) {
        const cuts = [0];
        let x = 0;
        for (;;) {
            const bw = rowH * (1.1 + rnd() * 1.5);
            if (x + bw > size - rowH * 0.8) break;
            x += bw;
            cuts.push(x);
        }
        cuts.push(size);
        rowsInfo.push({ cuts, off: Math.floor(rnd() * size) });
    }
    const palette = tones.map(rgb);
    const M = rgb(mortarColor);
    const mortar = 4;
    return pack(paint(size, size, (x, y, o) => {
        const u = x / size, v = y / size;
        const row = Math.floor(y / rowH), info = rowsInfo[row];
        const xs = (x + info.off) % size;
        let k = 0;
        while (info.cuts[k + 1] <= xs) k++;
        const dx = Math.min(xs - info.cuts[k], info.cuts[k + 1] - xs);
        const ly = y - row * rowH;
        const dy = Math.min(ly, rowH - ly);
        const e = Math.min(dx, dy) + (fbm(u, v, 16, 16, seed, 2) - 0.5) * 9;
        const surf = fbm(u, v, 8, 8, seed + 3, 4);
        if (e < mortar) {   // раствор между камнями
            const m = 0.8 + surf * 0.4;
            o[0] = M[0] * m; o[1] = M[1] * m; o[2] = M[2] * m; o[3] = 0.05;
            return;
        }
        const c = palette[Math.floor(hash(row * 17 + k, 2, seed) * palette.length)];
        const stain = fbm(u, v, 3, 3, seed + 9, 3);
        const tone = (0.78 + surf * 0.38) * (1 - Math.max(0, stain - 0.6) * soot);
        o[0] = c[0] * tone; o[1] = c[1] * tone; o[2] = c[2] * tone;
        o[3] = Math.sqrt(clamp01((e - mortar) / 16)) * (0.7 + surf * 0.3);
    }));
}

// ---------- Штукатурка ----------
export const makePlaster = opts => pack(makePlasterCanvases(opts));

function makePlasterCanvases({ size = 512, base = 0xd6c7a8, seed = 21 } = {}) {
    const B = rgb(base);
    return paint(size, size, (x, y, o) => {
        const u = x / size, v = y / size;
        const t = fbm(u, v, 4, 4, seed, 5);
        const s = fbm(u, v, 24, 24, seed + 3, 2);
        const stain = Math.max(0, fbm(u, v, 2, 2, seed + 8, 3) - 0.55) * 0.5;
        const k = 0.88 + t * 0.2 - stain;
        o[0] = B[0] * k; o[1] = B[1] * k; o[2] = B[2] * k * 0.98;
        o[3] = 0.5 + (t - 0.5) * 0.8 + (s - 0.5) * 0.3;
    });
}

// ---------- Шумная поверхность: кожа, кора, угли ----------
export function makeNoise({ base, amount = 0.25, cells = 16, size = 256, seed = 31 }) {
    const B = rgb(base);
    return pack(paint(size, size, (x, y, o) => {
        const t = fbm(x / size, y / size, cells, cells, seed, 4);
        const k = 1 - amount / 2 + t * amount;
        o[0] = B[0] * k; o[1] = B[1] * k; o[2] = B[2] * k; o[3] = t;
    }));
}

// ---------- Ткань (лён, шерсть с полосками) ----------
export function makeFabric({ base, stripe = null, size = 512, seed = 41 }) {
    const B = rgb(base), S = stripe ? rgb(stripe) : null;
    return pack(paint(size, size, (x, y, o) => {
        const u = x / size, v = y / size;
        const weave = ((x >> 1) ^ (y >> 1)) & 1 ? 1 : 0.9;
        const t = fbm(u, v, 8, 8, seed, 3);
        let c = B;
        if (S) {
            const s = (v * 4) % 1;
            if ((s > 0.06 && s < 0.11) || (s > 0.14 && s < 0.16)) c = S;
        }
        const k = weave * (0.85 + t * 0.25);
        o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k;
        o[3] = weave * 0.6 + t * 0.4;
    }));
}

// Лёгкая «зернистость ткани» поверх нарисованного холста
function grainOverlay(c, seed, amount = 0.12) {
    const g = c.getContext('2d');
    const img = g.getImageData(0, 0, c.width, c.height);
    for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            const k = 1 - amount / 2 + hash(x, y, seed) * amount - ((x + y) % 3 === 0 ? 0.04 : 0);
            img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
        }
    }
    g.putImageData(img, 0, 0);
}

// Цветочек на холсте: лепестки-эллипсы вокруг серединки
function flower2d(g, x, y, r, n, color, center = '#e9c46a', rot = 0) {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.3, a, 0, Math.PI * 2);
        g.fill();
    }
    g.fillStyle = center;
    g.beginPath(); g.arc(x, y, r * 0.28, 0, Math.PI * 2); g.fill();
}

function leaf2d(g, x, y, len, angle, color) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x + Math.cos(angle) * len * 0.5, y + Math.sin(angle) * len * 0.5, len * 0.5, len * 0.2, angle, 0, Math.PI * 2);
    g.fill();
}

// ---------- Ковёр: пудрово-розовый с шалфеем и золотом ----------
export function makeRug() {
    const W = 1024, H = 704;
    const c = canvas(W, H), g = c.getContext('2d');
    const sage = '#a9bda3', gold = '#c9a35a', cream = '#f8efe5', field = '#f0dcd4', rose = '#e3a2b0', rose2 = '#c97d90', sageLt = '#dfe8d8';
    const frame = (inset, color) => { g.fillStyle = color; g.fillRect(inset, inset, W - 2 * inset, H - 2 * inset); };
    frame(0, sage); frame(14, gold); frame(20, cream);
    // кайма с цветочками
    let n = 0;
    for (let x = 52; x < W - 40; x += 40) { flower2d(g, x, 42, 13, 4, n % 2 ? rose : sage, gold, 0.6); flower2d(g, x, H - 42, 13, 4, n++ % 2 ? rose : sage, gold, 0.6); }
    for (let y = 84; y < H - 60; y += 40) { flower2d(g, 42, y, 13, 4, n % 2 ? rose : sage, gold, 0.6); flower2d(g, W - 42, y, 13, 4, n++ % 2 ? rose : sage, gold, 0.6); }
    frame(64, gold); frame(70, field);
    // мелкие цветочки по полю
    for (let y = 108; y < H - 90; y += 50) {
        for (let x = 108 + ((y / 50) % 2) * 25; x < W - 90; x += 50) flower2d(g, x, y, 8, 4, (x + y) % 3 ? rose : sage, cream, 0.3);
    }
    // угловые четверти круга
    g.strokeStyle = gold; g.lineWidth = 4;
    for (const [x, y, a] of [[70, 70, 0], [W - 70, 70, Math.PI / 2], [W - 70, H - 70, Math.PI], [70, H - 70, -Math.PI / 2]]) {
        g.fillStyle = sageLt;
        g.beginPath(); g.moveTo(x, y); g.arc(x, y, 150, a, a + Math.PI / 2); g.closePath(); g.fill(); g.stroke();
        flower2d(g, x + Math.cos(a + Math.PI / 4) * 70, y + Math.sin(a + Math.PI / 4) * 70, 22, 5, rose, gold);
    }
    // центральный медальон с розеткой
    const cx = W / 2, cy = H / 2;
    g.fillStyle = gold; g.beginPath(); g.ellipse(cx, cy, 250, 180, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = sageLt; g.beginPath(); g.ellipse(cx, cy, 242, 172, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = cream; g.beginPath(); g.ellipse(cx, cy, 170, 120, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        leaf2d(g, cx + Math.cos(a) * 150, cy + Math.sin(a) * 105, 42, a, '#8fac88');
        flower2d(g, cx + Math.cos(a + 0.26) * 200, cy + Math.sin(a + 0.26) * 140, 14, 5, i % 2 ? rose : '#ffffff', gold);
    }
    flower2d(g, cx, cy, 90, 8, rose, gold);
    flower2d(g, cx, cy, 52, 8, rose2, gold, 0.4);
    grainOverlay(c, 5, 0.1);
    return toTexture(c);
}

// ---------- Гобелен «мильфлёр»: тысяча цветов и корона ----------
export function makeTapestry() {
    const W = 512, H = 768, bodyH = H - 70;
    const c = canvas(W, H), g = c.getContext('2d');
    const gold = '#cba253';
    const rnd = random(77);
    const outline = () => {
        g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, bodyH);
        const teeth = 7;
        for (let i = teeth - 1; i >= 0; i--) { g.lineTo((i + 0.5) * W / teeth, H - 6); g.lineTo(i * W / teeth, bodyH); }
        g.closePath();
    };
    outline(); g.fillStyle = '#a3bb9e'; g.fill();
    g.save(); outline(); g.clip();
    // россыпь цветов
    const colors = ['#ffffff', '#f2b3c0', '#e58aa0', '#f4d675', '#c8b3e6', '#fbe3d6'];
    for (let i = 0; i < 260; i++) {
        const x = rnd() * W, y = rnd() * H, r = 5 + rnd() * 7;
        leaf2d(g, x, y, r * 2, rnd() * Math.PI * 2, '#7f9f7a');
        flower2d(g, x, y, r, 5, colors[Math.floor(rnd() * colors.length)], '#f0c75e', rnd());
    }
    // каймы
    g.strokeStyle = '#d9919f'; g.lineWidth = 14; g.strokeRect(22, 22, W - 44, bodyH - 44);
    g.strokeStyle = gold; g.lineWidth = 3; g.strokeRect(14, 14, W - 28, bodyH - 28); g.strokeRect(30, 30, W - 60, bodyH - 60);
    // медальон с розой
    const cx = W / 2, cy = 330;
    g.fillStyle = gold; g.beginPath(); g.arc(cx, cy, 118, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fbf3ea'; g.beginPath(); g.arc(cx, cy, 110, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 10; i++) leaf2d(g, cx, cy, 95, (i / 10) * Math.PI * 2, '#93b28c');
    flower2d(g, cx, cy, 70, 7, '#f2b3c0', '#e58aa0');
    flower2d(g, cx, cy, 44, 6, '#e58aa0', '#c9667f', 0.4);
    flower2d(g, cx, cy, 20, 5, '#c9667f', gold, 0.8);
    // корона
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(cx - 60, 196); g.lineTo(cx - 70, 140); g.lineTo(cx - 35, 168); g.lineTo(cx, 126);
    g.lineTo(cx + 35, 168); g.lineTo(cx + 70, 140); g.lineTo(cx + 60, 196); g.closePath(); g.fill();
    for (const dx of [-70, 0, 70]) { g.beginPath(); g.arc(cx + dx, dx ? 136 : 120, 8, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#e58aa0'; g.beginPath(); g.arc(cx, 178, 7, 0, Math.PI * 2); g.fill();
    g.restore();
    outline(); g.strokeStyle = gold; g.lineWidth = 6; g.stroke();
    grainOverlay(c, 9, 0.12);
    const tex = toTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

// ---------- Расписной фриз под потолком: лоза с розами ----------
export function makeFrieze() {
    const W = 1024, H = 160;
    const c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#f7ede3'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#cba253'; g.fillRect(0, 10, W, 5); g.fillRect(0, H - 15, W, 5);
    g.fillStyle = '#e9b9c2'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 8, W, 8);
    const vine = x => H / 2 + Math.sin((x / W) * Math.PI * 8) * 26;
    g.strokeStyle = '#86a77f'; g.lineWidth = 4;
    g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, vine(x)); g.stroke();
    for (let x = 16; x < W; x += 32) leaf2d(g, x, vine(x), 24, (x / 32) % 2 ? -0.9 : 2.2, '#93b28c');
    for (let k = 0; k < 8; k++) {
        const x = (k + 0.25) * (W / 8);
        flower2d(g, x, vine(x), 22, 6, k % 2 ? '#e58aa0' : '#f2b3c0', '#f0c75e', k);
        flower2d(g, x, vine(x), 11, 5, '#c9667f', '#f0c75e', k + 0.5);
        flower2d(g, x + W / 16, vine(x + W / 16), 9, 5, '#ffffff', '#f0c75e');
    }
    grainOverlay(c, 13, 0.08);
    const tex = toTexture(c);
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

// ---------- Штукатурка с трафаретными цветочками ----------
export function makeStencil({ base = 0xf3e6dc, seed = 21 } = {}) {
    const res = makePlasterCanvases({ size: 512, base, seed });
    const g = res.color.getContext('2d');
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const x = col * 128 + (row % 2) * 64 + 32, y = row * 128 + 64;
            leaf2d(g, x - 2, y + 6, 18, 2.4, 'rgba(126,158,116,.35)');
            leaf2d(g, x + 2, y + 6, 18, 0.7, 'rgba(126,158,116,.35)');
            flower2d(g, x, y, 12, 5, 'rgba(220,140,158,.42)', 'rgba(203,162,83,.7)', row);
        }
    }
    return pack(res);
}

// ---------- Голубой потолок с золотыми звёздами ----------
export function makeStarCeiling() {
    const res = makePlasterCanvases({ size: 512, base: 0xd3e1ef, seed: 31 });
    const g = res.color.getContext('2d');
    g.fillStyle = '#cfa44f';
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const x = col * 128 + (row % 2) * 64 + 32, y = row * 128 + 64;
            g.beginPath();
            for (let i = 0; i < 16; i++) {
                const r = i % 2 ? 4 : 13, a = (i / 16) * Math.PI * 2;
                g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            }
            g.closePath(); g.fill();
        }
    }
    return pack(res);
}

// ---------- Свинцовая решётка окна (ромбы) ----------
export function makeLattice() {
    const W = 512, H = 800;
    const c = canvas(W, H), g = c.getContext('2d');
    g.strokeStyle = '#26221f'; g.lineWidth = 7; g.lineCap = 'round';
    const step = 74, run = H / 1.55;
    for (let k = -H; k < W + H; k += step) {
        g.beginPath(); g.moveTo(k, 0); g.lineTo(k + run, H); g.stroke();
        g.beginPath(); g.moveTo(k, 0); g.lineTo(k - run, H); g.stroke();
    }
    g.lineWidth = 16; g.strokeRect(0, 0, W, H);
    const tex = toTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

// ---------- Небо за окном: холмы и замок вдали ----------
export function makeSky(night) {
    const W = 1024, H = 768;
    const c = canvas(W, H), g = c.getContext('2d');
    const rnd = random(night ? 7 : 3);
    const grd = g.createLinearGradient(0, 0, 0, H * 0.66);
    if (night) { grd.addColorStop(0, '#050916'); grd.addColorStop(0.7, '#14203d'); grd.addColorStop(1, '#2b3352'); }
    else { grd.addColorStop(0, '#6f9cc9'); grd.addColorStop(0.6, '#bcd3e0'); grd.addColorStop(1, '#f2e2bf'); }
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    if (night) {
        for (let i = 0; i < 260; i++) {
            g.fillStyle = `rgba(255,248,230,${0.3 + rnd() * 0.7})`;
            g.fillRect(rnd() * W, rnd() * H * 0.6, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
        }
        const moon = g.createRadialGradient(W * 0.68, H * 0.2, 10, W * 0.68, H * 0.2, 110);
        moon.addColorStop(0, 'rgba(240,235,210,.5)'); moon.addColorStop(1, 'rgba(240,235,210,0)');
        g.fillStyle = moon; g.fillRect(0, 0, W, H);
        g.fillStyle = '#f3edd7'; g.beginPath(); g.arc(W * 0.68, H * 0.2, 30, 0, Math.PI * 2); g.fill();
    } else {
        g.fillStyle = 'rgba(255,255,255,.55)';
        for (let i = 0; i < 9; i++) {
            const x = rnd() * W, y = 60 + rnd() * H * 0.35;
            for (let j = 0; j < 6; j++) { g.beginPath(); g.ellipse(x + j * 34 - 90, y + Math.sin(j) * 8, 60, 22, 0, 0, Math.PI * 2); g.fill(); }
        }
    }
    const hill = (base, amp, color, phase) => {
        g.fillStyle = color; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, base + Math.sin(x * 0.006 + phase) * amp + Math.sin(x * 0.017 + phase * 2) * amp * 0.4);
        g.lineTo(W, H); g.closePath(); g.fill();
    };
    hill(H * 0.62, 24, night ? '#0f1a22' : '#8796a0', 1);
    // замок на дальнем холме
    const cx = W * 0.32, cy = H * 0.6;
    g.fillStyle = night ? '#0b131a' : '#76838c';
    g.fillRect(cx - 70, cy - 40, 140, 50);
    for (const [tx, tw, th] of [[-80, 30, 90], [50, 30, 80], [-15, 34, 130]]) {
        g.fillRect(cx + tx, cy - th, tw, th + 10);
        for (let k = 0; k < tw; k += 10) g.fillRect(cx + tx + k, cy - th - 8, 6, 8);
    }
    if (night) { g.fillStyle = '#ffcf6a'; g.fillRect(cx - 4, cy - 100, 5, 8); g.fillRect(cx + 60, cy - 50, 4, 6); }
    hill(H * 0.72, 18, night ? '#0a120f' : '#5b7444', 3);
    // деревья на ближнем холме
    g.fillStyle = night ? '#060b08' : '#3e5a2f';
    for (let i = 0; i < 26; i++) {
        const x = rnd() * W, y = H * 0.71 + Math.sin(x * 0.006 + 3) * 18;
        g.beginPath(); g.ellipse(x, y - 14, 14 + rnd() * 10, 22 + rnd() * 12, 0, 0, Math.PI * 2); g.fill();
    }
    const tex = toTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

// ---------- Свечение огня ----------
export function makeGlow() {
    const c = canvas(128), g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,214,150,0.9)');
    grd.addColorStop(0.25, 'rgba(255,170,80,0.35)');
    grd.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// ---------- Развёртки ----------
// Текстура ложится «по размеру» детали: у большой и маленькой доски волокна одинаковые
export function applyBoxUV(geo, tile = 600, offset = [0, 0], vertical = false) {
    const [tu, tv] = Array.isArray(tile) ? tile : [tile, tile];
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
        let a, b;
        if (ax >= ay && ax >= az) { a = z; b = y; }
        else if (ay >= az) { a = x; b = z; }
        else { a = x; b = y; }
        if (vertical) [a, b] = [b, a];
        uv[i * 2] = a / tu + offset[0];
        uv[i * 2 + 1] = b / tv + offset[1];
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
}

export function scaleUV(geo, su, sv = su) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    uv.needsUpdate = true;
    return geo;
}

// Растянуть текстуру ровно на плоскую фигуру (окно)
export function fitUV(geo) {
    geo.computeBoundingBox();
    const { min, max } = geo.boundingBox;
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
        uv.setXY(i, (pos.getX(i) - min.x) / (max.x - min.x), (pos.getY(i) - min.y) / (max.y - min.y));
    }
    uv.needsUpdate = true;
    return geo;
}
