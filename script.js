import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { woodCanvases, makeWood } from './textures.js';
import { buildRoom, flames, ROOM, WINDOW, NIGHTSTAND_RIGHT } from './room.js';
import { useFlowerEnv } from './flowers.js';
import { buildTumba, buildTopItems, LIMITS } from './tumba.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Породы дерева: светлый тон древесины и цвет годовых колец
const WOODS = [
    { id: 'oak', kk: 'Ақ емен', ru: 'Белёный дуб', base: 0xe4d5b9, dark: 0xb59d76, rings: 7, seed: 2 },
    { id: 'gray', kk: 'Сұр', ru: 'Серый ясень', base: 0xa6a19a, dark: 0x6b665f, rings: 8, seed: 5 },
    { id: 'walnut', kk: 'Жаңғақ', ru: 'Орех', base: 0x7d4b2c, dark: 0x3a1f10, rings: 6, seed: 8 },
    { id: 'bog', kk: 'Қара емен', ru: 'Морёный дуб', base: 0x4d3523, dark: 0x1e130a, rings: 7, seed: 12 },
];

// Яркость света днём и ночью
const LIGHTS = {
    day: { sun: 2.4, sunColor: 0xfff1dc, hemi: 1.7, sky: 0xfff6ee, fire: 1.4e6, candle: 2e5, chand: 3e5, exposure: 1.0 },
    night: { sun: 0.5, sunColor: 0xa9b6e6, hemi: 0.55, sky: 0xc4c6ec, fire: 3e6, candle: 6e5, chand: 1.6e6, exposure: 1.15 },
};

const state = {
    width: 600, height: 800, depth: 400, wood: 'oak',
    drawer: 0, door: 0, drawerT: 0, doorT: 0,   // 0 — закрыто, 1 — открыто
    dims: true, night: false,
};

// ---------- 1. РЕНДЕР, СЦЕНА, КАМЕРА ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;    // мягкие тени
renderer.toneMapping = THREE.ACESFilmicToneMapping;  // киношная цветопередача
$('canvas-container').appendChild(renderer.domElement);

// HTML-подписи размеров поверх 3D
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.id = 'labels';
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3e9df);
// Отражения для металла и лака
const envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 10, 20000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 600;
controls.maxDistance = 4200;
controls.maxPolarAngle = Math.PI * 0.49;

// ---------- 2. СВЕТ ----------
// Мягкий рассеянный свет от светлых стен — комната без тёмных углов
const hemi = new THREE.HemisphereLight(0xfff6ee, 0xe2cdb8, 1.7);
scene.add(hemi);

// Солнце светит снаружи через окно, тень от стены оставляет на полу световое пятно
const sun = new THREE.DirectionalLight(0xffe7c4, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3600, right: 3600, top: 3600, bottom: -3600, near: 500, far: 14000 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 2;
sun.target.position.set(-ROOM.w / 2, (WINDOW.sill + WINDOW.top) / 2, WINDOW.z);
scene.add(sun, sun.target);

// Свеча на тумбе
const candleLight = new THREE.PointLight(0xffb066, 2.5e5, 0, 2);
candleLight.castShadow = true;
candleLight.shadow.mapSize.set(512, 512);
candleLight.shadow.camera.near = 5;
candleLight.shadow.camera.far = 5000;
candleLight.shadow.camera.updateProjectionMatrix();
candleLight.shadow.bias = -0.003;

// ---------- 3. МАТЕРИАЛЫ ТУМБЫ ----------
const woodMat = new THREE.MeshPhysicalMaterial({
    roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.38, bumpScale: 0.7, envMap, envMapIntensity: 0.35,
});
const innerMat = new THREE.MeshStandardMaterial({ color: 0xa8957d, roughness: 0.85, bumpScale: 0.5 });
const brass = new THREE.MeshStandardMaterial({ color: 0xcfa45c, metalness: 0.7, roughness: 0.32, envMap, envMapIntensity: 1.1 });
const iron = new THREE.MeshStandardMaterial({ color: 0x2c2a29, metalness: 0.85, roughness: 0.5, envMap, envMapIntensity: 0.6 });

const woodCache = {};
function setWood(id) {
    const wd = WOODS.find(x => x.id === id);
    const tex = woodCache[id] ||= makeWood(wd);
    state.wood = id;
    for (const mat of [woodMat, innerMat]) {
        mat.map = tex.map;
        mat.bumpMap = tex.bump;
        mat.needsUpdate = true;
    }
    document.querySelectorAll('.wood').forEach(b => {
        b.classList.toggle('is-active', b.dataset.id === id);
        b.setAttribute('aria-pressed', b.dataset.id === id);
    });
}

// ---------- 4. ПОДПИСИ РАЗМЕРОВ ----------
const dimMat = new THREE.MeshBasicMaterial({ color: 0xe0b85c, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false });
const Y = new THREE.Vector3(0, 1, 0);

// Размерная линия со стрелками на концах и выносными засечками
function dimLine(a, b, tick) {
    const g = new THREE.Group();
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    dir.normalize();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, len - 44, 8), dimMat);
    shaft.position.copy(a).add(b).multiplyScalar(0.5);
    shaft.quaternion.setFromUnitVectors(Y, dir);
    g.add(shaft);
    for (const [p, s] of [[a, -1], [b, 1]]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(8, 24, 12), dimMat);
        cone.quaternion.setFromUnitVectors(Y, dir.clone().multiplyScalar(s));
        cone.position.copy(p).addScaledVector(dir, -s * 12);
        const t = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 70, 6), dimMat);
        t.quaternion.setFromUnitVectors(Y, tick);
        t.position.copy(p);
        g.add(cone, t);
    }
    g.children.forEach(m => { m.renderOrder = 999; });
    return g;
}

function dimLabel(kk, ru, value, pos) {
    const el = document.createElement('div');
    el.className = 'dim-label';
    el.innerHTML = `<span class="dim-name">${kk} · ${ru}</span><span class="dim-value">${value}<small>мм</small></span>`;
    const o = new CSS2DObject(el);
    o.position.copy(pos);
    return o;
}

function buildDims(w, h, d) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const fz = d / 2, lx = -w / 2;
    g.add(dimLine(V(-w / 2, 14, fz + 120), V(w / 2, 14, fz + 120), V(0, 0, 1)));
    g.add(dimLine(V(lx - 70, 0, fz + 40), V(lx - 70, h, fz + 40), V(1, 0, 0)));
    g.add(dimLine(V(lx - 120, 14, -d / 2), V(lx - 120, 14, fz), V(1, 0, 0)));
    g.add(dimLabel('Ені', 'Ширина', w, V(0, 50, fz + 120)));
    g.add(dimLabel('Биіктігі', 'Высота', h, V(lx - 70, h / 2, fz + 40)));
    g.add(dimLabel('Тереңдігі', 'Глубина', d, V(lx - 120, 50, 0)));
    return g;
}

// ---------- 5. СБОРКА ТУМБЫ ----------
const tumbaRoot = new THREE.Group();
scene.add(tumbaRoot);
const targetGoal = new THREE.Vector3();
let tumba = null, items = null, dims = null;

function disposeTree(obj) {
    obj.traverse(o => {
        if (o.geometry && !o.userData.keep) o.geometry.dispose();
        if (o.element) o.element.remove();    // HTML-подписи
    });
}

function rebuild() {
    const { width: w, height: h, depth: d } = state;
    for (const old of [tumba?.group, items?.group, dims]) {
        if (!old) continue;
        tumbaRoot.remove(old);
        disposeTree(old);
    }
    tumba = buildTumba({ w, h, d, wood: woodMat, inner: innerMat, brass, iron });
    items = buildTopItems({ w, h, d, metal: brass });
    dims = buildDims(w, h, d);
    dims.visible = state.dims;
    items.anchor.add(candleLight);
    tumbaRoot.add(tumba.group, items.group, dims);
    // правый край тумбы у кровати, задняя стенка у стены
    tumbaRoot.position.set(NIGHTSTAND_RIGHT - w / 2, 0, -ROOM.d / 2 + d / 2 + 20);
    targetGoal.set(tumbaRoot.position.x, h * 0.5, tumbaRoot.position.z);
    applyMoves();
}

let rebuildQueued = false;
function scheduleRebuild() {
    if (rebuildQueued) return;
    rebuildQueued = true;
    requestAnimationFrame(() => { rebuildQueued = false; rebuild(); });
}

// Ящик выезжает, дверца поворачивается на петлях, кольца покачиваются
function applyMoves() {
    if (!tumba) return;
    tumba.drawer.position.z = state.drawerT * tumba.travel;
    if (tumba.door) tumba.door.rotation.y = -state.doorT * 1.6;
    const swing = clamp((state.drawer - state.drawerT) * 1.2, -0.6, 0.6);
    for (const r of tumba.rings) r.rotation.x = -0.22 + swing;
}

// ---------- 6. ПАНЕЛЬ УПРАВЛЕНИЯ ----------
function paintRange(r) {
    r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
}

function setupDims() {
    for (const key of ['width', 'height', 'depth']) {
        const num = $(key), range = $(`${key}-range`);
        const [min, max] = LIMITS[key];
        num.min = range.min = min;
        num.max = range.max = max;
        num.value = range.value = state[key];
        paintRange(range);
        const apply = v => {
            num.value = range.value = v;
            paintRange(range);
            if (state[key] !== v) { state[key] = v; scheduleRebuild(); }
        };
        range.addEventListener('input', () => apply(Number(range.value)));
        // при наборе цифр применяем только допустимые значения, остальное поправим при выходе из поля
        num.addEventListener('input', () => {
            const v = Number(num.value);
            if (num.value !== '' && v >= min && v <= max) { range.value = v; paintRange(range); state[key] = v; scheduleRebuild(); }
        });
        num.addEventListener('change', () => apply(clamp(Math.round(Number(num.value) || state[key]), min, max)));
    }
}

function setupWoods() {
    const box = $('woods');
    for (const wd of WOODS) {
        const b = document.createElement('button');
        b.className = 'wood';
        b.dataset.id = wd.id;
        b.setAttribute('aria-label', `${wd.kk} · ${wd.ru}`);
        b.style.backgroundImage = `url(${woodCanvases({ ...wd, size: 160 }).color.toDataURL()})`;
        b.innerHTML = `<span>${wd.kk}<small>${wd.ru}</small></span>`;
        b.addEventListener('click', () => setWood(wd.id));
        box.appendChild(b);
    }
}

function toggleDrawer() {
    state.drawer = 1 - state.drawer;
    const b = $('drawerBtn');
    b.classList.toggle('is-on', state.drawer === 1);
    b.innerHTML = state.drawer ? 'Тартпаны жабу<small>Закрыть ящик</small>' : 'Тартпаны ашу<small>Открыть ящик</small>';
}

function toggleDoor() {
    state.door = 1 - state.door;
    const b = $('doorBtn');
    b.classList.toggle('is-on', state.door === 1);
    b.innerHTML = state.door ? 'Есікті жабу<small>Закрыть дверцу</small>' : 'Есікті ашу<small>Открыть дверцу</small>';
}

function toggleDims() {
    state.dims = !state.dims;
    if (dims) dims.visible = state.dims;
    labelRenderer.domElement.classList.toggle('is-hidden', !state.dims);
    const b = $('toggleDims');
    b.setAttribute('aria-pressed', state.dims);
    b.classList.toggle('is-on', !state.dims);
    b.textContent = state.dims ? 'Жасыру · Скрыть' : 'Көрсету · Показать';
}

let room;
function setNight(on) {
    state.night = on;
    const L = LIGHTS[on ? 'night' : 'day'];
    sun.intensity = L.sun;
    sun.color.set(L.sunColor);
    hemi.intensity = L.hemi;
    hemi.color.set(L.sky);
    renderer.toneMappingExposure = L.exposure;
    room.skyMat.map = on ? room.skyNight : room.skyDay;
    room.skyMat.needsUpdate = true;
    const b = $('nightBtn');
    b.classList.toggle('is-on', on);
    b.textContent = on ? '☀ Күн · День' : '☾ Түн · Ночь';
}

function updateSun() {
    const az = THREE.MathUtils.degToRad(Number($('sunAngle').value));
    const el = THREE.MathUtils.degToRad(Number($('sunHeight').value));
    const t = sun.target.position, R = 6000;
    sun.position.set(t.x - R * Math.cos(el) * Math.cos(az), t.y + R * Math.sin(el), t.z + R * Math.cos(el) * Math.sin(az));
    paintRange($('sunAngle'));
    paintRange($('sunHeight'));
}

// Клик по ящику или дверце открывает их
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function pick(e) {
    if (!tumba) return null;
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(tumba.group, true)[0];
    for (let o = hit?.object; o; o = o.parent) if (o.userData.part) return o.userData.part;
    return null;
}

function setupEvents() {
    $('toggleDims').addEventListener('click', toggleDims);
    $('drawerBtn').addEventListener('click', toggleDrawer);
    $('doorBtn').addEventListener('click', toggleDoor);
    $('nightBtn').addEventListener('click', () => setNight(!state.night));
    $('sunAngle').addEventListener('input', updateSun);
    $('sunHeight').addEventListener('input', updateSun);
    $('collapseBtn').addEventListener('click', e => {
        const collapsed = $('ui-panel').classList.toggle('collapsed');
        e.currentTarget.textContent = collapsed ? '+' : '–';
        e.currentTarget.setAttribute('aria-expanded', !collapsed);
        updateViewOffset();
    });

    const canvas = renderer.domElement;
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', e => {
        if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
        const part = pick(e);
        if (part === 'drawer') toggleDrawer();
        if (part === 'door') toggleDoor();
    });
    canvas.addEventListener('pointermove', e => {
        if (e.buttons) return;
        canvas.style.cursor = pick(e) ? 'pointer' : '';
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
        updateViewOffset();
    });
}

// Центр кадра — в свободной части экрана, а не под панелью
function updateViewOffset() {
    const W = window.innerWidth, H = window.innerHeight;
    camera.fov = camera.aspect < 0.8 ? 62 : 42;    // на узком экране телефона — шире обзор
    const panel = $('ui-panel').getBoundingClientRect();
    if (W > 640) camera.setViewOffset(W, H, -Math.round(panel.right / 2), 0, W, H);
    else camera.setViewOffset(W, H, 0, Math.round(panel.height / 2), W, H);
    camera.updateProjectionMatrix();
}

// ---------- 7. АНИМАЦИЯ ----------
const clock = new THREE.Clock();
// Неровное «дыхание» огня, 0..1
const wave = (t, s) => 0.5 + 0.25 * Math.sin(t * 7.3 + s) + 0.15 * Math.sin(t * 17.9 + s * 2.3) + 0.1 * Math.sin(t * 31.1 + s * 0.7);

function flicker(f, t) {
    const k = wave(t, f.phase);
    const side = f.base * (0.92 + 0.12 * k);
    f.obj.scale.set(side, f.base * (0.8 + 0.4 * k), side);
    f.obj.rotation.z = Math.sin(t * 4.3 + f.phase) * 0.07;
    if (f.glow) {
        const g = 0.9 + 0.2 * k;
        f.glow.scale.set(f.glowBase[0] * g, f.glowBase[1] * g, 1);
    }
}

function clampCamera() {
    const p = camera.position, m = 160;
    p.x = clamp(p.x, -ROOM.w / 2 + m, ROOM.w / 2 - m);
    p.y = clamp(p.y, 120, ROOM.h - 280);
    p.z = clamp(p.z, -ROOM.d / 2 + m, ROOM.d / 2 - m);
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 7);
    state.drawerT += (state.drawer - state.drawerT) * k;
    state.doorT += (state.door - state.doorT) * k;
    applyMoves();

    for (const f of flames) flicker(f, t);
    if (items) flicker(items.flame, t);
    const L = LIGHTS[state.night ? 'night' : 'day'];
    room.fireLight.intensity = L.fire * (0.8 + 0.2 * wave(t, 1.3));
    room.chandLight.intensity = L.chand * (0.9 + 0.1 * wave(t, 7.7));
    candleLight.intensity = L.candle * (0.88 + 0.12 * wave(t, 4.1));

    controls.target.lerp(targetGoal, k * 0.6);
    controls.update();
    clampCamera();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// ---------- 8. ЗАПУСК ----------
function init() {
    useFlowerEnv(envMap);
    room = buildRoom(scene, envMap);
    setupWoods();
    setupDims();
    setupEvents();
    setWood(state.wood);
    setNight(false);
    updateSun();
    rebuild();
    controls.target.copy(targetGoal);
    updateViewOffset();
    camera.position.set(targetGoal.x - 750, 1500, targetGoal.z + 2800);
    animate();                              // первый кадр рисуется сразу
    $('loader').classList.add('done');
}

window.addEventListener('error', e => {
    $('loader').querySelector('p').innerHTML = `Қате · Ошибка<br><small>${e.message}</small>`;
});

// Даём экрану загрузки отрисоваться, затем строим комнату
setTimeout(init, 30);
