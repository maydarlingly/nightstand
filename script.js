import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// 1. НАСТРОЙКА СЦЕНЫ И ФОНА
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xC3B091); // Новый цвет фона 

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(1500, 1500, 2000);

const renderer = new THREE.WebGLRenderer({ antialias: true }); // Сглаживание краев
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; 
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Делаем тени мягкими и реалистичными
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Специальный рендерер, чтобы рисовать HTML-текст поверх 3D (для размеров)
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none'; 
document.body.appendChild(labelRenderer.domElement);

// Управление камерой с помощью мыши
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Плавная инерция при вращении

// 2. СВЕТ И КӨЛЕҢКЕ (ТЕНИ)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Визуальное представление Солнца (Желтый шар)
const sunGeo = new THREE.SphereGeometry(60, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd700 }); 
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
scene.add(sunMesh);

// Главный направленный свет, который отбрасывает тень
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.castShadow = true; 

// Настройка "камеры теней", чтобы тень доставала до пола и была четкой
dirLight.shadow.mapSize.width = 2048; 
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 8000;
const d = 2500; 
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

// Создание пола
const planeGeo = new THREE.PlaneGeometry(10000, 10000);
const planeMat = new THREE.MeshStandardMaterial({ color: 0x5b7535 }); // Новый цвет пола
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true; // Пол настроен на принятие тени
scene.add(plane);

// 3. СОЗДАНИЕ ТУМБЫ
let tumbaGroup;

function createTumba() {
    const w = Number(document.getElementById('width').value);
    const h = Number(document.getElementById('height').value);
    const depth = Number(document.getElementById('depth').value);

    // Удаляем старые надписи размеров, чтобы они не накладывались друг на друга
    const oldLabels = document.querySelectorAll('.dimension-label');
    oldLabels.forEach(label => label.remove());

    // Если тумба уже есть на экране - удаляем её перед созданием новой
    if (tumbaGroup) scene.remove(tumbaGroup);
    tumbaGroup = new THREE.Group();

    // Материал тумбы (реагирует на свет)
    const material = new THREE.MeshStandardMaterial({ 
        color: Number(currentColor), 
        roughness: 0.6 
    });

    const legHeight = 80; // Высота ножек
    const bodyHeight = h - legHeight; // Высота самого ящика тумбы

    // Корпус тумбы
    const bodyGeo = new THREE.BoxGeometry(w, bodyHeight, depth - 20); 
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = legHeight + bodyHeight / 2; // Приподнимаем на высоту ножек
    body.position.z = -10;
    body.castShadow = true; 
    body.receiveShadow = true; 
    tumbaGroup.add(body);

    // Дверца тумбы
    const doorGeo = new THREE.BoxGeometry(w, bodyHeight, 20);
    const door = new THREE.Mesh(doorGeo, material);
    door.position.y = legHeight + bodyHeight / 2; 
    door.position.z = depth / 2 - 10;
    door.castShadow = true;
    door.receiveShadow = true;

    // Металлическая ручка на дверце
    const handleGeo = new THREE.CylinderGeometry(5, 5, bodyHeight * 0.15);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(w / 2 - 30, 0, 15); 
    handle.castShadow = true;
    door.add(handle);

    tumbaGroup.add(door);

    // Создание 4-х ножек
    const legGeo = new THREE.CylinderGeometry(10, 5, legHeight, 16); // Сужаются книзу
    const legMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }); 

    const legOffsetX = w / 2 - 20; 
    const legOffsetZBack = -depth / 2 + 20; 
    const legOffsetZFront = depth / 2 - 40; 

    const legPositions = [
        [legOffsetX, legOffsetZBack],   // Задняя правая
        [-legOffsetX, legOffsetZBack],  // Задняя левая
        [legOffsetX, legOffsetZFront],  // Передняя правая
        [-legOffsetX, legOffsetZFront]  // Передняя левая
    ];

    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(pos[0], legHeight / 2, pos[1]); 
        leg.castShadow = true; 
        leg.receiveShadow = true;
        tumbaGroup.add(leg);
    });

    // Функция для создания HTML-надписей
    function createLabel(text, x, y, z) {
        const div = document.createElement('div');
        div.className = 'dimension-label';
        div.innerHTML = text; 
        const label = new CSS2DObject(div);
        label.position.set(x, y, z);
        return label;
    }

    // Расставляем надписи размеров так, чтобы они не перекрывали тумбу
    tumbaGroup.add(createLabel(`↔ Ені: ${w} мм`, 0, h + 60, depth / 2)); // Ширина
    tumbaGroup.add(createLabel(`↕ Биіктігі: ${h} мм`, w/2 + 70, h/2, depth / 2)); // Высота
    tumbaGroup.add(createLabel(`↙ Тереңдігі: ${depth} мм`, -w/2 - 70, legHeight + 40, 0)); // Глубина

    scene.add(tumbaGroup);
}

// 4. УПРАВЛЕНИЕ И СОБЫТИЯ
let currentColor = 0xfffcf5; // Устанавливаем стартовый цвет

// Перерисовываем тумбу, если пользователь ввел новые размеры
document.getElementById('width').addEventListener('input', createTumba);
document.getElementById('height').addEventListener('input', createTumba);
document.getElementById('depth').addEventListener('input', createTumba);

// Меняем цвет при клике на кнопки
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentColor = e.target.getAttribute('data-color');
        createTumba(); 
    });
});

// Математика кругового вращения Солнца
function updateSunPosition() {
    const angleDeg = Number(document.getElementById('sunAngle').value);
    const height = Number(document.getElementById('sunHeight').value);
    const radius = Number(document.getElementById('sunRadius').value);

    // Перевод градусов в радианы для математических расчетов
    const angleRad = angleDeg * (Math.PI / 180);
    
    // Вычисляем координаты X и Z по кругу (используя Синус и Косинус)
    const x = Math.cos(angleRad) * radius;
    const z = Math.sin(angleRad) * radius;

    // Передвигаем свет и желтый шарик
    dirLight.position.set(x, height, z);
    sunMesh.position.set(x, height, z);
}

// Слушаем изменения ползунков орбиты
document.getElementById('sunAngle').addEventListener('input', updateSunPosition);
document.getElementById('sunHeight').addEventListener('input', updateSunPosition);
document.getElementById('sunRadius').addEventListener('input', updateSunPosition);

// Первоначальный запуск функций
createTumba();
updateSunPosition(); 

// 5. АНИМАЦИЯ (Ежесекундное обновление экрана)
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Обновление контроллера мыши
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera); // Отрисовка HTML-текста
}
animate();

// Подстраиваем размеры, если пользователь изменил окно браузера или перевернул телефон
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});