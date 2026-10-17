// Старинные книги: светлая кожа, золотое тиснение, бинты на корешке, золотые уголки и застёжка.
// Обложки и корешки рисуются на <canvas>, название — настоящей книги.
import * as THREE from 'three';

const FONT = '"Cormorant Garamond", Georgia, serif';
const GOLD = '#d2a44c';

// Книги в стопке: снизу вверх. L — длина вдоль корешка, W — ширина, T — толщина (мм)
const BOOKS = [
    { title: ['Джейн Эйр'], author: 'Шарлотта Бронте', leather: '#b98f63', dark: '#8a643f', L: 262, W: 186, T: 52, seed: 3 },
    { title: ['Гордость', 'и предубеждение'], author: 'Джейн Остин', leather: '#dcc39b', dark: '#b08c60', L: 232, W: 162, T: 40, seed: 8 },
];
const BANDS = [0.1, 0.2, 0.8, 0.9];          // бинты на корешке (доля длины)

const gold = new THREE.MeshStandardMaterial({ color: 0xdcb46a, metalness: 0.6, roughness: 0.35 });
const textured = [];                           // материалы с золотым тиснением (им нужны отражения)

export function useBookEnv(envMap) {
    for (const m of [gold, ...textured]) {
        m.envMap = envMap;
        m.needsUpdate = true;
    }
}

function rng(seed) {
    let s = seed * 9301 + 49297;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

// ---------- Рисование ----------
// Кожа: светлая основа с мягкими пятнами и потемнением к краям
function leather(g, w, h, base, dark, seed) {
    const rnd = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
        const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 90;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, rnd() < 0.5 ? 'rgba(255,245,225,.10)' : 'rgba(90,60,30,.10)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const edge = Math.min(w, h) * 0.18;
    for (const [x0, y0, x1, y1] of [[0, 0, edge, 0], [w, 0, w - edge, 0], [0, 0, 0, edge], [0, h, 0, h - edge]]) {
        const grd = g.createLinearGradient(x0, y0, x1, y1);
        grd.addColorStop(0, dark + '99');
        grd.addColorStop(1, dark + '00');
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
    }
}

// Маленький цветок-флерон: четыре округлых лепестка крестом и точки между ними
function fleuron(g, x, y, s) {
    for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.36, s * 0.26, a, 0, Math.PI * 2);
        g.fill();
        const b = a + Math.PI / 4;
        g.beginPath(); g.arc(x + Math.cos(b) * s * 0.62, y + Math.sin(b) * s * 0.62, s * 0.09, 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.arc(x, y, s * 0.16, 0, Math.PI * 2); g.fill();
}

function diamond(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath(); g.fill();
}

// Текст уменьшается, пока не влезет по ширине
function fitText(g, text, maxW, size, weight = 700, style = '') {
    let s = size;
    do { g.font = `${style} ${weight} ${s}px ${FONT}`; s -= 2; } while (g.measureText(text).width > maxW && s > 10);
}

// mask = true рисует только золото белым по чёрному (для блеска и рельефа тиснения)
function drawCover(c, b, mask) {
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const ink = mask ? '#ffffff' : GOLD;
    if (mask) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); } else leather(g, w, h, b.leather, b.dark, b.seed);
    g.strokeStyle = ink; g.fillStyle = ink;
    // двойная рамка и внутренняя панель
    g.lineWidth = 6; g.strokeRect(34, 34, w - 68, h - 68);
    g.lineWidth = 2; g.strokeRect(50, 50, w - 100, h - 100);
    g.lineWidth = 3; g.strokeRect(92, 92, w - 184, h - 184);
    for (const [x, y] of [[92, 92], [w - 92, 92], [92, h - 92], [w - 92, h - 92]]) fleuron(g, x, y, 30);
    for (const [x, y] of [[w / 2, 50], [w / 2, h - 50], [50, h / 2], [w - 50, h / 2]]) diamond(g, x, y, 10);
    // название и автор
    const lines = b.title, size = h * 0.13;
    const total = lines.length * size * 1.05;
    let y = h / 2 - total / 2 - size * 0.25;
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (const line of lines) {
        fitText(g, line, w - 260, size);
        if (!mask) { g.fillStyle = 'rgba(70,45,20,.45)'; g.fillText(line, w / 2 + 2, y + 3); g.fillStyle = ink; }
        g.fillText(line, w / 2, y);
        y += size * 1.05;
    }
    y += size * 0.25;
    g.fillRect(w / 2 - 130, y, 100, 3); g.fillRect(w / 2 + 30, y, 100, 3);
    diamond(g, w / 2, y + 1.5, 9);
    fitText(g, b.author, w - 300, size * 0.55, 500, 'italic');
    g.fillText(b.author, w / 2, y + size * 0.3);
}

function drawSpine(c, b, mask) {
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const ink = mask ? '#ffffff' : GOLD;
    if (mask) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); } else leather(g, w, h, b.leather, b.dark, b.seed + 5);
    g.fillStyle = ink; g.strokeStyle = ink;
    // золотые линии по обе стороны от каждого бинта
    for (const p of BANDS) { g.fillRect(p * w - 14, 0, 3, h); g.fillRect(p * w + 11, 0, 3, h); }
    for (const p of [0.05, 0.15, 0.85, 0.95]) fleuron(g, p * w, h / 2, h * 0.18);
    // тёмная наклейка с названием между бинтами
    const x0 = 0.24 * w, x1 = 0.76 * w;
    if (!mask) { g.fillStyle = b.dark; g.fillRect(x0, h * 0.12, x1 - x0, h * 0.76); g.fillStyle = ink; }
    g.lineWidth = 3; g.strokeRect(x0 + 6, h * 0.12 + 6, x1 - x0 - 12, h * 0.76 - 12);
    const text = b.title.join(' ').toUpperCase();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, text, x1 - x0 - 40, h * 0.34);
    g.fillText(text, w / 2, h * 0.5);
}

function drawPlain(c, b) {
    leather(c.getContext('2d'), c.width, c.height, b.leather, b.dark, b.seed + 11);
}

// Обрез страниц: тонкие светлые полоски с лёгкой позолотой
function drawPages(c) {
    const g = c.getContext('2d');
    g.fillStyle = '#efdcae'; g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < c.height; y += 3) {
        g.fillStyle = y % 6 ? 'rgba(190,150,80,.22)' : 'rgba(255,250,235,.35)';
        g.fillRect(0, y, c.width, 1);
    }
}

// ---------- Текстуры (перерисовываются, когда загрузится шрифт) ----------
const redraws = [];

function tex(w, h, draw, color = true) {
    const c = canvas(w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    const paint = () => { draw(c); t.needsUpdate = true; };
    paint();
    redraws.push(paint);
    return t;
}

if (document.fonts?.load) {
    document.fonts.load(`700 64px ${FONT}`, 'Гордость Джейн').then(() => redraws.forEach(f => f())).catch(() => {});
}

const pagesMat = new THREE.MeshStandardMaterial({ map: tex(256, 256, drawPages), roughness: 0.8, metalness: 0.15 });

function materials(b) {
    const ch = Math.round(1024 * b.W / b.L), sh = Math.round(1024 * b.T / b.L);
    const stamped = (draw, h) => {
        const mask = tex(1024, h, c => draw(c, b, true), false);
        const m = new THREE.MeshStandardMaterial({
            map: tex(1024, h, c => draw(c, b, false)), metalnessMap: mask, metalness: 0.65,
            bumpMap: mask, bumpScale: -0.5, roughness: 0.55,
        });
        textured.push(m);
        return m;
    };
    const plain = new THREE.MeshStandardMaterial({ map: tex(512, 384, c => drawPlain(c, b)), roughness: 0.6 });
    return { cover: stamped(drawCover, ch), spine: stamped(drawSpine, sh), plain };
}

function part(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    m.userData.keep = true;       // книги не пересоздаются при смене размеров тумбы
    return m;
}

// Одна книга, лежит на столе; корешок смотрит вперёд (+z)
function book(b) {
    const { L, W, T } = b;
    const m = materials(b);
    const g = new THREE.Group();
    const board = 4.5, ov = 4;
    // порядок граней Box: +x, −x, +y (верх), −y, +z, −z
    g.add(part(new THREE.BoxGeometry(L, board, W), [m.plain, m.plain, m.cover, m.plain, m.plain, m.plain], 0, T - board / 2, 0));
    g.add(part(new THREE.BoxGeometry(L, board, W), m.plain, 0, board / 2, 0));
    g.add(part(new THREE.BoxGeometry(L, T, 8), [m.plain, m.plain, m.plain, m.plain, m.spine, m.plain], 0, T / 2, W / 2 - 2));
    g.add(part(new THREE.BoxGeometry(L - 2 * ov, T - 2 * board, W - ov - 6), pagesMat, 0, T / 2, (ov - 6) / 2));
    // выпуклые бинты на корешке
    for (const p of BANDS) g.add(part(new THREE.BoxGeometry(8, T - 3, 4), m.plain, (p - 0.5) * L, T / 2, W / 2 + 3));
    // золотые уголки со стороны обреза
    for (const sx of [-1, 1]) {
        g.add(part(new THREE.BoxGeometry(26, 1.6, 7), gold, sx * (L / 2 - 13), T + 0.8, -W / 2 + 3.5));
        g.add(part(new THREE.BoxGeometry(7, 1.6, 26), gold, sx * (L / 2 - 3.5), T + 0.8, -W / 2 + 13));
    }
    // кожаная застёжка с золотой пряжкой
    g.add(part(new THREE.BoxGeometry(22, T + 3, 3), m.plain, 0, T / 2, -W / 2 - 1.5));
    g.add(part(new THREE.BoxGeometry(22, 2, 24), m.plain, 0, T + 1, -W / 2 + 12));
    g.add(part(new THREE.BoxGeometry(30, 3, 10), gold, 0, T + 2.2, -W / 2 + 20));
    return g;
}

// Стопка из двух книг; «Гордость и предубеждение» — сверху
export function makeBookStack() {
    const stack = new THREE.Group();
    let y = 0;
    BOOKS.forEach((b, i) => {
        const bk = book(b);
        bk.position.set(i * 6, y, i * -4);
        bk.rotation.y = i ? -0.08 : 0.1;
        stack.add(bk);
        y += b.T;
    });
    return stack;
}
