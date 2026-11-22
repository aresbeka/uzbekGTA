import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ==========================================
// 1. VERTIKAL REJIM VA AVTOMATIK .GLB / .MP3
// ==========================================
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('portrait').catch(() => {});
}

const glbModules = import.meta.glob('./models/*.glb', { eager: true, query: '?url', import: 'default' });
const musicModules = import.meta.glob(['./music/*.mp3', './music/*.ogg', './music/*.wav'], { eager: true, query: '?url', import: 'default' });

let CITY_MODEL_URL = null;
const CAR_MODELS = [];

Object.entries(glbModules).forEach(([path, url]) => {
  const id = path.split('/').pop().replace(/\.glb$/i, '');
  // city_opt.glb (yoki nomida 'city' bor fayl) ni shahar deb ajratamiz
  if (/city/i.test(id)) {
    CITY_MODEL_URL = url;
  } else {
    CAR_MODELS.push({ id, name: id.replace(/[_-]+/g, ' ').toUpperCase(), url });
  }
});

const TRACKS = Object.entries(musicModules).map(([path, url]) => ({
  title: path.split('/').pop().replace(/\.(mp3|ogg|wav)$/i, ''),
  url
}));

// Yuklanish ekrani yordamchisi
const loadingScreen = document.getElementById('loadingScreen');
const loadingText = document.getElementById('loadingText');
const loadFill = document.getElementById('loadFill');
function setLoadProgress(pct, text) {
  loadFill.style.width = pct + '%';
  if (text) loadingText.textContent = text;
}
function hideLoading() {
  setLoadProgress(100, 'Tayyor!');
  setTimeout(() => {
    loadingScreen.style.opacity = '0';
    setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
  }, 250);
}

// ==========================================
// 2. WEB AUDIO OVOZLAR VA RADIO
// ==========================================
let audioCtx = null;
function ensureAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playGunshot() {
  ensureAudioCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(175, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(28, audioCtx.currentTime + 0.14);
  gain.gain.setValueAtTime(0.32, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.16);
}

function playHorn() {
  ensureAudioCtx();
  const o1 = audioCtx.createOscillator();
  const o2 = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o1.frequency.value = 340; o2.frequency.value = 425;
  g.gain.setValueAtTime(0.18, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
  o1.connect(g); o2.connect(g); g.connect(audioCtx.destination);
  o1.start(); o2.start();
  o1.stop(audioCtx.currentTime + 0.36); o2.stop(audioCtx.currentTime + 0.36);
}

const radioAudio = new Audio();
radioAudio.loop = false;
let trackIdx = 0;
let radioPlaying = false;
const radioTitle = document.getElementById('radioTitle');
const rPlayBtn = document.getElementById('rPlay');

function loadTrack(idx, autoPlay = true) {
  if (TRACKS.length === 0) {
    radioTitle.textContent = "src/music ga MP3 qo'shing";
    return;
  }
  trackIdx = (idx + TRACKS.length) % TRACKS.length;
  radioAudio.src = TRACKS[trackIdx].url;
  radioTitle.textContent = '🎵 ' + TRACKS[trackIdx].title;
  if (autoPlay) {
    radioAudio.play().then(() => {
      radioPlaying = true; rPlayBtn.textContent = '⏸';
    }).catch(() => {});
  }
}
radioAudio.addEventListener('ended', () => loadTrack(trackIdx + 1, true));
document.getElementById('rPrev').onclick = () => loadTrack(trackIdx - 1, true);
document.getElementById('rNext').onclick = () => loadTrack(trackIdx + 1, true);
rPlayBtn.onclick = () => {
  if (TRACKS.length === 0) return loadTrack(0, false);
  if (radioPlaying) {
    radioAudio.pause(); radioPlaying = false; rPlayBtn.textContent = '▶';
  } else {
    if (!radioAudio.src) loadTrack(trackIdx, true);
    else radioAudio.play().then(() => { radioPlaying = true; rPlayBtn.textContent = '⏸'; }).catch(() => {});
  }
};

// ==========================================
// 3. THREE.JS SAHNA (VERTIKALGA MOS KAMERA)
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 55, 220);

function getPortraitFOV() {
  return window.innerHeight > window.innerWidth ? 74 : 62;
}
const camera = new THREE.PerspectiveCamera(getPortraitFOV(), window.innerWidth / window.innerHeight, 0.15, 320);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.3));
const sun = new THREE.DirectionalLight(0xfff5e4, 1.45);
sun.position.set(50, 90, 45);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
scene.add(sun);

// Taglik asfalt (agar shahar chetidan chiqib ketsa tushib ketmasligi uchun)
const baseGround = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.95 })
);
baseGround.rotation.x = -Math.PI / 2;
baseGround.position.y = -0.05;
baseGround.receiveShadow = true;
scene.add(baseGround);

// ==========================================
// 4. GLTF LOADER VA CITY_OPT.GLB SHAHAR YUKLASH
// ==========================================
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('./draco/');
loader.setDRACOLoader(draco);

const cityMeshes = []; // Raycaster kolliziya uchun
const fallbackBuildingBoxes = [];
let cityBounds = { minX: -95, maxX: 95, minZ: -95, maxZ: 95 };
let useCityGLB = false;

const raycaster = new THREE.Raycaster();
const downDir = new THREE.Vector3(0, -1, 0);
const tmpOrigin = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

function buildFallbackCity() {
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const roads = [-72, -36, 0, 36, 72];
  roads.forEach(r => {
    for (let i = -84; i <= 84; i += 8) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3.5), lineMat);
      s1.rotation.x = -Math.PI / 2; s1.position.set(r, 0.02, i);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.3), lineMat);
      s2.rotation.x = -Math.PI / 2; s2.position.set(i, 0.02, r);
      scene.add(s1, s2);
    }
  });
  const blockCenters = [-54, -18, 18, 54];
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x78909c });
  const bColors = [0xcfd8dc, 0xffe0b2, 0xb0bec5, 0xd7ccc8, 0xb2dfdb, 0xe0e0e0];
  blockCenters.forEach((bx, ix) => {
    blockCenters.forEach((bz, iz) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(24, 0.22, 24), sideMat);
      sw.position.set(bx, 0.11, bz); sw.receiveShadow = true; scene.add(sw);
      const h = 8 + ((ix * 7 + iz * 11) % 5) * 4.5;
      const b = new THREE.Mesh(new THREE.BoxGeometry(16, h, 16), new THREE.MeshStandardMaterial({ color: bColors[(ix + iz) % bColors.length] }));
      b.position.set(bx, h / 2 + 0.22, bz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      fallbackBuildingBoxes.push({ minX: bx - 8.2, maxX: bx + 8.2, minZ: bz - 8.2, maxZ: bz + 8.2 });
    });
  });
}

function loadCity() {
  return new Promise((resolve) => {
    if (!CITY_MODEL_URL) {
      buildFallbackCity();
      resolve();
      return;
    }
    setLoadProgress(25, 'city_opt.glb shahar yuklanmoqda...');
    loader.load(
      CITY_MODEL_URL,
      (gltf) => {
        const city = gltf.scene;
        // O'lchamni tekshirish va yerga tekislash
        const box = new THREE.Box3().setFromObject(city);
        const size = box.getSize(new THREE.Vector3());
        const maxHorizontal = Math.max(size.x, size.z);
        // Agar model juda kichik eksport qilingan bo'lsa kattalashtiramiz
        if (maxHorizontal > 0 && maxHorizontal < 40) {
          city.scale.setScalar(180 / maxHorizontal);
        }
        box.setFromObject(city);
        const center = box.getCenter(new THREE.Vector3());
        city.position.x -= center.x;
        city.position.z -= center.z;
        city.position.y -= box.min.y;

        city.traverse((c) => {
          if (c.isMesh) {
            c.castShadow = false; // Telefon FPS ni saqlash uchun shahar soyasini yengil qilamiz
            c.receiveShadow = true;
            cityMeshes.push(c);
          }
        });
        scene.add(city);

        const finalBox = new THREE.Box3().setFromObject(city);
        cityBounds = {
          minX: Math.max(finalBox.min.x + 4, -220),
          maxX: Math.min(finalBox.max.x - 4, 220),
          minZ: Math.max(finalBox.min.z + 4, -220),
          maxZ: Math.min(finalBox.max.z - 4, 220)
        };
        useCityGLB = true;
        setLoadProgress(60, 'Mashinalar yuklanmoqda...');
        resolve();
      },
      undefined,
      () => {
        buildFallbackCity();
        resolve();
      }
    );
  });
}

// Yer balandligini olish
function getGroundY(x, z, currentY = 0) {
  if (!useCityGLB || cityMeshes.length === 0) return 0;
  tmpOrigin.set(x, currentY + 2.5, z);
  raycaster.set(tmpOrigin, downDir);
  raycaster.far = 8;
  const hits = raycaster.intersectObjects(cityMeshes, false);
  if (hits.length > 0) return hits[0].point.y;
  return 0;
}

// Devor / bino kolliziyasini tekshirish
function hitsObstacle(x, z, dirX, dirZ, dist = 1.0, height = 0.9) {
  if (x < cityBounds.minX || x > cityBounds.maxX || z < cityBounds.minZ || z > cityBounds.maxZ) {
    return true;
  }
  if (!useCityGLB) {
    for (const b of fallbackBuildingBoxes) {
      if (x + dist > b.minX && x - dist < b.maxX && z + dist > b.minZ && z - dist < b.maxZ) return true;
    }
    return false;
  }
  const len = Math.hypot(dirX, dirZ);
  if (len < 0.001) return false;
  tmpOrigin.set(x, height, z);
  tmpDir.set(dirX / len, 0, dirZ / len);
  raycaster.set(tmpOrigin, tmpDir);
  raycaster.far = dist;
  const hits = raycaster.intersectObjects(cityMeshes, false);
  return hits.length > 0;
}

// ==========================================
// 5. ODAM YASASH (O'YINCHI + NPC)
// ==========================================
function createPersonMesh(shirtColor = 0x1e88e5, pantsColor = 0x263238) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccbc });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor });

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skinMat);
  head.position.y = 1.62; head.castShadow = true;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.26), shirtMat);
  torso.position.y = 1.12; torso.castShadow = true;

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pantsMat);
  legL.position.set(-0.13, 0.4, 0); legL.castShadow = true;
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pantsMat);
  legR.position.set(0.13, 0.4, 0); legR.castShadow = true;

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.16), shirtMat);
  armL.position.set(-0.34, 1.1, 0); armL.castShadow = true;
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.16), shirtMat);
  armR.position.set(0.34, 1.1, 0); armR.castShadow = true;

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.38), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  gun.position.set(0, -0.25, 0.2);
  gun.visible = false;
  armR.add(gun);

  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffeb3b }));
  flash.position.set(0, -0.22, 0.44);
  flash.visible = false;
  armR.add(flash);

  g.add(head, torso, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, gun, flash, walkTime: 0 };
  return g;
}

const player = createPersonMesh(0x1565c0, 0x212121);
player.position.set(0, 0, -4);
scene.add(player);

let playerVelY = 0;
let isGrounded = true;

// ==========================================
// 6. BARCHA .GLB MASHINALARNI KESHLASH VA AI TRAFIK
// ==========================================
const carTemplateCache = new Map();
const cars = [];
const fbColors = [0xffffff, 0x212121, 0x1976d2, 0xd32f2f, 0x388e3c, 0xfbc02d, 0x7b1fa2];

function createFallbackCar(color) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 4.2), new THREE.MeshStandardMaterial({ color }));
  b.position.y = 0.65; b.castShadow = true;
  const r = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.0), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  r.position.set(0, 1.25, -0.2);
  g.add(b, r);
  return g;
}

function preloadCarModels() {
  if (CAR_MODELS.length === 0) return Promise.resolve();
  let loaded = 0;
  return Promise.all(
    CAR_MODELS.map((cfg) => new Promise((resolve) => {
      loader.load(
        cfg.url,
        (gltf) => {
          const m = gltf.scene;
          m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
          const box = new THREE.Box3().setFromObject(m);
          const sz = box.getSize(new THREE.Vector3());
          const maxD = Math.max(sz.x, sz.y, sz.z);
          if (maxD > 0) m.scale.setScalar(4.35 / maxD);
          box.setFromObject(m);
          const c = box.getCenter(new THREE.Vector3());
          m.position.x -= c.x;
          m.position.z -= c.z;
          m.position.y -= box.min.y;
          carTemplateCache.set(cfg.id, m);
          loaded++;
          setLoadProgress(60 + Math.round((loaded / CAR_MODELS.length) * 35), `Mashinalar: ${loaded}/${CAR_MODELS.length}`);
          resolve();
        },
        undefined,
        () => { loaded++; resolve(); }
      );
    }))
  );
}

function spawnCar(cfg, x, z, yaw, isTraffic = true) {
  const container = new THREE.Group();
  const wrapper = new THREE.Group();
  container.add(wrapper);
  const gy = getGroundY(x, z, 0);
  container.position.set(x, gy, z);
  container.rotation.y = yaw;
  scene.add(container);

  const modelId = cfg ? cfg.id : 'fb';
  if (cfg && carTemplateCache.has(cfg.id)) {
    wrapper.add(carTemplateCache.get(cfg.id).clone());
    wrapper.rotation.y = Number(localStorage.getItem('rot_' + cfg.id) || 0);
  } else {
    wrapper.add(createFallbackCar(fbColors[cars.length % fbColors.length]));
  }

  const carObj = {
    id: modelId + '_' + cars.length,
    modelId,
    container,
    wrapper,
    speed: isTraffic ? 7 + Math.random() * 5 : 0,
    yaw,
    isAI: isTraffic,
    aiTargetSpeed: 8 + Math.random() * 6,
    aiTurnTimer: 0,
    aiCheckOffset: cars.length % 4
  };
  cars.push(carObj);
  return carObj;
}

function spawnCityCars() {
  // O'yinchi yonida 2 ta tayyor turgan mashina + shahar bo'ylab ko'p yuradigan AI trafik
  const totalCars = Math.max(12, Math.min(22, CAR_MODELS.length * 2 + 8));
  const spanX = (cityBounds.maxX - cityBounds.minX) * 0.72;
  const spanZ = (cityBounds.maxZ - cityBounds.minZ) * 0.72;

  for (let i = 0; i < totalCars; i++) {
    const cfg = CAR_MODELS.length > 0 ? CAR_MODELS[i % CAR_MODELS.length] : null;
    if (i === 0) {
      spawnCar(cfg, 4, 5, 0, false); // O'yinchi yonida
    } else if (i === 1) {
      spawnCar(cfg, -4.5, 9, Math.PI, false); // O'yinchi yonida
    } else {
      const rx = (Math.random() - 0.5) * spanX;
      const rz = (Math.random() - 0.5) * spanZ;
      const yaw = (Math.floor(Math.random() * 4)) * (Math.PI / 2);
      spawnCar(cfg, rx, rz, yaw, true);
    }
  }
}

// GARAJ / MASHINA CHAQIRISH MENYUSI
const garageModal = document.getElementById('garageModal');
const garageList = document.getElementById('garageList');
document.getElementById('btnOpenGarage').onclick = () => {
  garageList.innerHTML = '';
  const list = CAR_MODELS.length > 0 ? CAR_MODELS : [{ id: 'fb', name: 'STANDART MASHINA' }];
  list.forEach((cfg) => {
    const btn = document.createElement('button');
    btn.className = 'car-item';
    btn.textContent = cfg.name;
    btn.onclick = () => {
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const basePos = inCar && activeCar ? activeCar.container.position : player.position;
      spawnCar(cfg.id === 'fb' ? null : cfg, basePos.x + fx * 6, basePos.z + fz * 6, camYaw, false);
      garageModal.style.display = 'none';
    };
    garageList.appendChild(btn);
  });
  garageModal.style.display = 'flex';
};
document.getElementById('btnCloseGarage').onclick = () => { garageModal.style.display = 'none'; };

// ==========================================
// 7. KO'CHADAGI ODAMLAR (NPC) VA O'QLAR
// ==========================================
const npcs = [];
const npcShirts = [0xe53935, 0x8e24aa, 0x43a047, 0xfb8c00, 0x00897b, 0x3949ab];

function spawnNPCs() {
  for (let i = 0; i < 16; i++) {
    const mesh = createPersonMesh(npcShirts[i % npcShirts.length], 0x37474f);
    const x = (Math.random() - 0.5) * (cityBounds.maxX - cityBounds.minX) * 0.65;
    const z = (Math.random() - 0.5) * (cityBounds.maxZ - cityBounds.minZ) * 0.65;
    mesh.position.set(x, getGroundY(x, z, 0), z);
    scene.add(mesh);
    npcs.push({ mesh, yaw: Math.random() * Math.PI * 2, alive: true, respawn: 0 });
  }
}

const bullets = [];
let money = 500;
let stars = 0;
let hasWeapon = false;
let shootCooldown = 0;
let flashTimer = 0;

function addReward(cash, starAdd = 0) {
  money += cash;
  stars = Math.min(5, stars + starAdd);
  document.getElementById('moneyVal').textContent = money;
  document.getElementById('starsVal').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

function fireWeapon() {
  if (inCar || !hasWeapon || shootCooldown > 0) return;
  shootCooldown = 0.24;
  flashTimer = 0.06;
  player.userData.flash.visible = true;
  playGunshot();

  const b = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffeb3b })
  );
  const yaw = player.rotation.y;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  b.position.set(player.position.x + fx * 0.85, player.position.y + 1.35, player.position.z + fz * 0.85);
  scene.add(b);
  bullets.push({ mesh: b, vx: fx * 60, vz: fz * 60, life: 1.3 });
}

// ==========================================
// 8. BOSHQARUV (JOYSTIK, KAMERA, MASHINA)
// ==========================================
let inCar = false;
let activeCar = null;
let camYaw = 0;
let camPitch = 0.22;

let camTouchId = null, lastCamX = 0, lastCamY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  camTouchId = e.pointerId; lastCamX = e.clientX; lastCamY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== camTouchId) return;
  camYaw -= (e.clientX - lastCamX) * 0.0065;
  camPitch = Math.max(-0.08, Math.min(0.82, camPitch + (e.clientY - lastCamY) * 0.0045));
  lastCamX = e.clientX; lastCamY = e.clientY;
});
window.addEventListener('pointerup', (e) => { if (e.pointerId === camTouchId) camTouchId = null; });

// Virtual Joystik
const joyZone = document.getElementById('joyZone');
const joyKnob = document.getElementById('joyKnob');
let joyX = 0, joyY = 0, joyTouchId = null;

function updateJoy(clientX, clientY) {
  const rect = joyZone.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  let dx = clientX - cx, dy = clientY - cy;
  const maxR = rect.width / 2 - 20;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joyX = dx / maxR;
  joyY = -dy / maxR;
}
joyZone.addEventListener('pointerdown', (e) => {
  e.stopPropagation(); joyTouchId = e.pointerId;
  joyZone.setPointerCapture(e.pointerId); updateJoy(e.clientX, e.clientY);
});
joyZone.addEventListener('pointermove', (e) => { if (e.pointerId === joyTouchId) updateJoy(e.clientX, e.clientY); });
const resetJoy = (e) => {
  if (e.pointerId !== joyTouchId) return;
  joyTouchId = null; joyX = 0; joyY = 0;
  joyKnob.style.transform = 'translate(-50%, -50%)';
};
joyZone.addEventListener('pointerup', resetJoy);
joyZone.addEventListener('pointercancel', resetJoy);

// Piyoda tugmalari
const btnWeapon = document.getElementById('btnWeapon');
btnWeapon.onclick = () => {
  hasWeapon = !hasWeapon;
  player.userData.gun.visible = hasWeapon;
  btnWeapon.textContent = hasWeapon ? '🔫' : '👊';
  btnWeapon.classList.toggle('armed', hasWeapon);
  player.userData.armR.rotation.x = hasWeapon ? -Math.PI / 2 : 0;
};
document.getElementById('btnShoot').addEventListener('pointerdown', (e) => { e.stopPropagation(); fireWeapon(); });
document.getElementById('btnJump').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (!inCar && isGrounded) { playerVelY = 7.2; isGrounded = false; }
});

// Mashina tugmalari
const carInput = { gas: false, brake: false, left: false, right: false };
const bindBtn = (id, key) => {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); carInput[key] = true; });
  el.addEventListener('pointerup', () => carInput[key] = false);
  el.addEventListener('pointercancel', () => carInput[key] = false);
};
bindBtn('btnCarGas', 'gas'); bindBtn('btnCarBrake', 'brake');
bindBtn('btnSteerL', 'left'); bindBtn('btnSteerR', 'right');
document.getElementById('btnHorn').onclick = playHorn;

const btnRotateCar = document.getElementById('btnRotateCar');
btnRotateCar.onclick = () => {
  if (!activeCar) return;
  const newRot = activeCar.wrapper.rotation.y + Math.PI / 2;
  localStorage.setItem('rot_' + activeCar.modelId, newRot);
  // Bir xil modeldagi barcha mashinalarni ham to'g'rilab qo'yamiz
  cars.forEach(c => { if (c.modelId === activeCar.modelId) c.wrapper.rotation.y = newRot; });
};

// Mashinaga minish / tushish
const enterExitBtn = document.getElementById('enterExitBtn');
function toggleEnterExit() {
  ensureAudioCtx();
  if (!inCar) {
    const nearest = findNearestCar();
    if (!nearest) return;
    activeCar = nearest;
    activeCar.isAI = false; // O'yinchi o'g'irladi / mindi!
    activeCar.speed = 0;
    inCar = true;
    player.visible = false;
    document.getElementById('footControls').style.display = 'none';
    document.getElementById('carControls').style.display = 'flex';
    document.getElementById('radioBox').style.display = 'flex';
    document.getElementById('carSpeedBox').style.display = 'block';
    btnRotateCar.style.display = 'flex';
    enterExitBtn.textContent = '🚶 Tushish';
    enterExitBtn.style.display = 'block';
    camYaw = activeCar.yaw;
    if (TRACKS.length > 0 && !radioAudio.src) loadTrack(0, true);
    else if (radioPlaying) radioAudio.play().catch(() => {});
  } else {
    inCar = false;
    const leftX = Math.cos(activeCar.yaw) * 2.2;
    const leftZ = -Math.sin(activeCar.yaw) * 2.2;
    const px = activeCar.container.position.x + leftX;
    const pz = activeCar.container.position.z + leftZ;
    player.position.set(px, getGroundY(px, pz, activeCar.container.position.y), pz);
    player.visible = true;
    activeCar = null;
    document.getElementById('footControls').style.display = 'flex';
    document.getElementById('carControls').style.display = 'none';
    document.getElementById('radioBox').style.display = 'none';
    document.getElementById('carSpeedBox').style.display = 'none';
    btnRotateCar.style.display = 'none';
    radioAudio.pause();
  }
}
enterExitBtn.onclick = toggleEnterExit;

function findNearestCar() {
  let best = null, minD = 5.0;
  for (const c of cars) {
    const d = Math.hypot(player.position.x - c.container.position.x, player.position.z - c.container.position.z);
    if (d < minD) { minD = d; best = c; }
  }
  return best;
}

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyF') toggleEnterExit();
  if (e.code === 'Space' && !inCar) fireWeapon();
  if (e.code === 'KeyH' && inCar) playHorn();
  if (e.code === 'KeyR' && inCar) loadTrack(trackIdx + 1, true);
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ==========================================
// 9. GTA MINI-XARITA (RADAR) CHIZISH
// ==========================================
const mapCanvas = document.getElementById('minimap');
const mapCtx = mapCanvas.getContext('2d');

function drawMinimap() {
  const w = mapCanvas.width, h = mapCanvas.height;
  const cx = w / 2, cy = h / 2;
  const scale = 0.72; // 1 metr = 0.72 px
  mapCtx.clearRect(0, 0, w, h);

  const px = inCar && activeCar ? activeCar.container.position.x : player.position.x;
  const pz = inCar && activeCar ? activeCar.container.position.z : player.position.z;
  const rot = camYaw;
  const cosR = Math.cos(rot), sinR = Math.sin(rot);

  // Radar doiralari
  mapCtx.strokeStyle = 'rgba(255,255,255,0.12)';
  mapCtx.lineWidth = 1;
  mapCtx.beginPath(); mapCtx.arc(cx, cy, 24, 0, Math.PI * 2); mapCtx.stroke();
  mapCtx.beginPath(); mapCtx.arc(cx, cy, 42, 0, Math.PI * 2); mapCtx.stroke();

  // Mashinalar (ko'k nuqtalar)
  for (const c of cars) {
    if (c === activeCar) continue;
    const dx = c.container.position.x - px;
    const dz = c.container.position.z - pz;
    const rx = (dx * cosR - dz * sinR) * scale;
    const ry = -(dx * sinR + dz * cosR) * scale;
    if (Math.hypot(rx, ry) < 43) {
      mapCtx.fillStyle = c.isAI ? '#40c4ff' : '#ffd54f';
      mapCtx.fillRect(cx - rx - 2.5, cy + ry - 2.5, 5, 5);
    }
  }

  // NPC odamlar (oq nuqtalar)
  mapCtx.fillStyle = 'rgba(255,255,255,0.65)';
  for (const n of npcs) {
    if (!n.alive) continue;
    const dx = n.mesh.position.x - px;
    const dz = n.mesh.position.z - pz;
    const rx = (dx * cosR - dz * sinR) * scale;
    const ry = -(dx * sinR + dz * cosR) * scale;
    if (Math.hypot(rx, ry) < 43) {
      mapCtx.beginPath(); mapCtx.arc(cx - rx, cy + ry, 1.8, 0, Math.PI * 2); mapCtx.fill();
    }
  }

  // O'yinchi markazda (yashil uchburchak)
  mapCtx.fillStyle = '#00e676';
  mapCtx.beginPath();
  mapCtx.moveTo(cx, cy - 6);
  mapCtx.lineTo(cx - 4.5, cy + 5);
  mapCtx.lineTo(cx + 4.5, cy + 5);
  mapCtx.closePath();
  mapCtx.fill();
}

// ==========================================
// 10. ASOSIY O'YIN TSIKLI
// ==========================================
const clock = new THREE.Clock();
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  frameCount++;

  if (shootCooldown > 0) shootCooldown -= dt;
  if (flashTimer > 0) {
    flashTimer -= dt;
    if (flashTimer <= 0) player.userData.flash.visible = false;
  }

  if (!inCar) {
    // --- PIYODA HARAKATI ---
    let mx = joyX, my = joyY;
    if (keys['KeyW'] || keys['ArrowUp']) my = 1;
    if (keys['KeyS'] || keys['ArrowDown']) my = -1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx = -1;
    if (keys['KeyD'] || keys['ArrowRight']) mx = 1;

    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    let vx = fx * my + rx * mx;
    let vz = fz * my + rz * mx;
    const len = Math.hypot(vx, vz);

    if (len > 0.1) {
      vx /= len; vz /= len;
      const spd = 7.2;
      if (!hitsObstacle(player.position.x, player.position.z, vx, vz, 0.75, player.position.y + 0.9)) {
        player.position.x += vx * spd * dt;
        player.position.z += vz * spd * dt;
      }
      player.rotation.y = Math.atan2(vx, vz);

      player.userData.walkTime += dt * 11;
      const s = Math.sin(player.userData.walkTime) * 0.65;
      player.userData.legL.rotation.x = s;
      player.userData.legR.rotation.x = -s;
      player.userData.armL.rotation.x = -s;
      if (!hasWeapon) player.userData.armR.rotation.x = s;
    } else {
      player.userData.legL.rotation.x = 0;
      player.userData.legR.rotation.x = 0;
      player.userData.armL.rotation.x = 0;
      if (!hasWeapon) player.userData.armR.rotation.x = 0;
    }

    // Gravitatsiya va sakrash
    const gy = getGroundY(player.position.x, player.position.z, player.position.y);
    playerVelY -= 20 * dt;
    player.position.y += playerVelY * dt;
    if (player.position.y <= gy) {
      player.position.y = gy;
      playerVelY = 0;
      isGrounded = true;
    }

    const near = findNearestCar();
    if (near) {
      enterExitBtn.textContent = '🚗 Minish';
      enterExitBtn.style.display = 'block';
    } else {
      enterExitBtn.style.display = 'none';
    }

    // Kamera (Piyoda)
    const camDist = window.innerHeight > window.innerWidth ? 6.2 : 5.4;
    camera.position.set(
      player.position.x - fx * camDist * Math.cos(camPitch),
      player.position.y + 1.9 + camDist * Math.sin(camPitch),
      player.position.z - fz * camDist * Math.cos(camPitch)
    );
    camera.lookAt(player.position.x, player.position.y + 1.35, player.position.z);

  } else if (activeCar) {
    // --- MASHINA HARAKATI ---
    const gas = carInput.gas || keys['KeyW'] || keys['ArrowUp'];
    const brk = carInput.brake || keys['KeyS'] || keys['ArrowDown'];
    const lft = carInput.left || keys['KeyA'] || keys['ArrowLeft'];
    const rgt = carInput.right || keys['KeyD'] || keys['ArrowRight'];

    if (gas) activeCar.speed = Math.min(42, activeCar.speed + 20 * dt);
    else if (brk) activeCar.speed = Math.max(-14, activeCar.speed - 28 * dt);
    else activeCar.speed *= Math.pow(0.28, dt);

    if (Math.abs(activeCar.speed) > 0.3) {
      const dir = activeCar.speed >= 0 ? 1 : -1;
      const turn = Math.min(1, Math.abs(activeCar.speed) / 7) * 2.3 * dir * dt;
      if (lft) activeCar.yaw += turn;
      if (rgt) activeCar.yaw -= turn;
    }

    const fx = Math.sin(activeCar.yaw), fz = Math.cos(activeCar.yaw);
    const moveDir = activeCar.speed >= 0 ? 1 : -1;
    if (!hitsObstacle(activeCar.container.position.x, activeCar.container.position.z, fx * moveDir, fz * moveDir, 2.3, activeCar.container.position.y + 0.85)) {
      activeCar.container.position.x += fx * activeCar.speed * dt;
      activeCar.container.position.z += fz * activeCar.speed * dt;
      const gy = getGroundY(activeCar.container.position.x, activeCar.container.position.z, activeCar.container.position.y);
      activeCar.container.position.y += (gy - activeCar.container.position.y) * 0.35;
    } else {
      activeCar.speed = -activeCar.speed * 0.35;
    }
    activeCar.container.rotation.y = activeCar.yaw;
    document.getElementById('speedVal').textContent = Math.round(Math.abs(activeCar.speed) * 3.6);

    if (!camTouchId && !lft && !rgt) {
      camYaw += (activeCar.yaw - camYaw) * 0.05;
    }
    const cfx = Math.sin(camYaw), cfz = Math.cos(camYaw);
    const carCamDist = window.innerHeight > window.innerWidth ? 10.5 : 8.8;
    camera.position.lerp(new THREE.Vector3(
      activeCar.container.position.x - cfx * carCamDist,
      activeCar.container.position.y + 4.1 + camPitch * 4,
      activeCar.container.position.z - cfz * carCamDist
    ), 0.14);
    camera.lookAt(activeCar.container.position.x, activeCar.container.position.y + 1.2, activeCar.container.position.z);
  }

  // --- SHAHARDAGI AI TRAFIK MASHINALARI ---
  for (const c of cars) {
    if (!c.isAI || c === activeCar) continue;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);

    // Har 4 kadrda bir oldidagi devorni tekshiradi (yuqori FPS uchun)
    if ((frameCount + c.aiCheckOffset) % 4 === 0) {
      const blocked = hitsObstacle(c.container.position.x, c.container.position.z, fx, fz, 5.2, c.container.position.y + 0.85);
      // O'yinchi yoki boshqa mashinaga juda yaqin kelsa to'xtaydi/buriladi
      const playerDist = Math.hypot(c.container.position.x - player.position.x, c.container.position.z - player.position.z);
      if (blocked) {
        c.yaw += (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2);
        c.speed = 2;
      } else if (!inCar && playerDist < 4.5) {
        c.speed *= 0.6;
      } else {
        c.speed += (c.aiTargetSpeed - c.speed) * 0.08;
      }
    }

    c.container.position.x += Math.sin(c.yaw) * c.speed * dt;
    c.container.position.z += Math.cos(c.yaw) * c.speed * dt;
    c.container.rotation.y = c.yaw;
  }

  // --- O'QLAR VA NPC ODAMLAR ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.x += b.vx * dt;
    b.mesh.position.z += b.vz * dt;
    b.life -= dt;
    let hit = b.life <= 0 || hitsObstacle(b.mesh.position.x, b.mesh.position.z, b.vx, b.vz, 0.5, b.mesh.position.y);

    if (!hit) {
      for (const n of npcs) {
        if (n.alive && Math.hypot(b.mesh.position.x - n.mesh.position.x, b.mesh.position.z - n.mesh.position.z) < 0.9) {
          n.alive = false; n.mesh.visible = false; n.respawn = 7;
          addReward(50, 1);
          hit = true; break;
        }
      }
    }
    if (hit) { scene.remove(b.mesh); bullets.splice(i, 1); }
  }

  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (!n.alive) {
      n.respawn -= dt;
      if (n.respawn <= 0) { n.alive = true; n.mesh.visible = true; }
      continue;
    }
    const nx = Math.sin(n.yaw), nz = Math.cos(n.yaw);
    if ((frameCount + i) % 8 === 0 && hitsObstacle(n.mesh.position.x, n.mesh.position.z, nx, nz, 1.4, n.mesh.position.y + 0.9)) {
      n.yaw += Math.PI * (0.5 + Math.random() * 0.5);
    }
    n.mesh.position.x += Math.sin(n.yaw) * 2.0 * dt;
    n.mesh.position.z += Math.cos(n.yaw) * 2.0 * dt;
    n.mesh.rotation.y = n.yaw;
    n.mesh.userData.walkTime += dt * 7;
    const s = Math.sin(n.mesh.userData.walkTime) * 0.5;
    n.mesh.userData.legL.rotation.x = s;
    n.mesh.userData.legR.rotation.x = -s;

    if (inCar && activeCar && Math.abs(activeCar.speed) > 5) {
      if (Math.hypot(n.mesh.position.x - activeCar.container.position.x, n.mesh.position.z - activeCar.container.position.z) < 2.3) {
        n.alive = false; n.mesh.visible = false; n.respawn = 7;
        addReward(35, 1);
      }
    }
  }

  if (frameCount % 2 === 0) drawMinimap();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.fov = getPortraitFOV();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// O'yinni ishga tushirish
(async function initGame() {
  await loadCity();
  await preloadCarModels();
  spawnCityCars();
  spawnNPCs();
  player.position.y = getGroundY(player.position.x, player.position.z, 0);
  hideLoading();
  animate();
})();
