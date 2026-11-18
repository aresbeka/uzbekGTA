import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ==========================================
// 1. AVTOMATIK .GLB MASHINALAR VA .MP3 MUSIQALAR
// ==========================================
const glbModules = import.meta.glob('./models/*.glb', { eager: true, query: '?url', import: 'default' });
const musicModules = import.meta.glob(['./music/*.mp3', './music/*.ogg', './music/*.wav'], { eager: true, query: '?url', import: 'default' });

const MODEL_LIST = Object.entries(glbModules).map(([path, url]) => {
  const id = path.split('/').pop().replace(/\.glb$/i, '');
  return { id, name: id.replace(/[_-]+/g, ' ').toUpperCase(), url };
});

const TRACKS = Object.entries(musicModules).map(([path, url]) => ({
  title: path.split('/').pop().replace(/\.(mp3|ogg|wav)$/i, ''),
  url
}));

// ==========================================
// 2. WEB AUDIO OVOZLAR (O'q ovozi, Signal, Radio)
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
  osc.frequency.setValueAtTime(160, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.14);
  gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
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

// Radio MP3 pleyer
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
  radioTitle.textContent = "🎵 " + TRACKS[trackIdx].title;
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
// 3. THREE.JS SAHNA VA SHAHAR QURILISHI
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec8e3);
scene.fog = new THREE.Fog(0x7ec8e3, 45, 170);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 240);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(40, 70, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
scene.add(sun);

// Asfalt asos
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(320, 320),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Yo'l chiziqlari
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

// Shahar kvartallari, trotuarlar, binolar va daraxtlar
const buildingBoxes = [];
const blockCenters = [-54, -18, 18, 54];
const sideMat = new THREE.MeshStandardMaterial({ color: 0x78909c });
const bColors = [0xcfd8dc, 0xffe0b2, 0xb0bec5, 0xd7ccc8, 0xb2dfdb, 0xe0e0e0];

blockCenters.forEach((bx, ix) => {
  blockCenters.forEach((bz, iz) => {
    // Trotuar (24x24)
    const sw = new THREE.Mesh(new THREE.BoxGeometry(24, 0.22, 24), sideMat);
    sw.position.set(bx, 0.11, bz);
    sw.receiveShadow = true;
    scene.add(sw);

    // Bino (16x16)
    const h = 8 + ((ix * 7 + iz * 11) % 5) * 4.5;
    const bMat = new THREE.MeshStandardMaterial({ color: bColors[(ix + iz) % bColors.length] });
    const b = new THREE.Mesh(new THREE.BoxGeometry(16, h, 16), bMat);
    b.position.set(bx, h / 2 + 0.22, bz);
    b.castShadow = true; b.receiveShadow = true;
    scene.add(b);

    buildingBoxes.push({ minX: bx - 8.2, maxX: bx + 8.2, minZ: bz - 8.2, maxZ: bz + 8.2 });

    // Daraxt (trotuar burchagida)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2, 6), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
    trunk.position.set(bx + 9.8, 1.1, bz + 9.8);
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
    crown.position.set(bx + 9.8, 2.7, bz + 9.8);
    crown.castShadow = true;
    scene.add(trunk, crown);
  });
});

function hitsBuilding(x, z, r = 0.6) {
  if (Math.abs(x) > 88 || Math.abs(z) > 88) return true;
  for (const b of buildingBoxes) {
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
  }
  return false;
}

// ==========================================
// 4. ODAM YASASH FUNKSIYASI (O'YINCHI + NPC)
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

  // To'pponcha (o'ng qo'lga biriktirilgan)
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.36), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  gun.position.set(0, -0.25, 0.18);
  gun.visible = false;
  armR.add(gun);

  g.add(head, torso, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, gun, walkTime: 0 };
  return g;
}

const player = createPersonMesh(0x1565c0, 0x212121);
player.position.set(0, 0, -4);
scene.add(player);

// ==========================================
// 5. SHAHARDAGI MASHINALAR (.GLB YUKLASH)
// ==========================================
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('./draco/');
loader.setDRACOLoader(draco);

const cars = [];
const spawnSpots = [
  { x: 3.5, z: 6, yaw: 0 },
  { x: -3.5, z: -16, yaw: Math.PI },
  { x: 36, z: 10, yaw: 0 },
  { x: -36, z: -12, yaw: Math.PI / 2 },
  { x: 14, z: 36, yaw: -Math.PI / 2 }
];

function createFallbackCar(color) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 4.2), new THREE.MeshStandardMaterial({ color }));
  b.position.y = 0.65; b.castShadow = true;
  const r = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.0), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  r.position.set(0, 1.25, -0.2);
  g.add(b, r);
  return g;
}

const fbColors = [0xffffff, 0x212121, 0x1976d2, 0xd32f2f, 0x388e3c];
spawnSpots.forEach((sp, i) => {
  const container = new THREE.Group();
  const wrapper = new THREE.Group();
  container.add(wrapper);
  container.position.set(sp.x, 0, sp.z);
  container.rotation.y = sp.yaw;
  scene.add(container);

  const cfg = MODEL_LIST.length > 0 ? MODEL_LIST[i % MODEL_LIST.length] : null;
  const carObj = {
    id: cfg ? cfg.id + '_' + i : 'fb_' + i,
    modelId: cfg ? cfg.id : 'fb',
    container, wrapper, speed: 0, yaw: sp.yaw
  };
  cars.push(carObj);

  if (cfg) {
    const savedRot = Number(localStorage.getItem('rot_' + cfg.id) || 0);
    loader.load(cfg.url, (gltf) => {
      const m = gltf.scene;
      m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(m);
      const sz = box.getSize(new THREE.Vector3());
      const maxD = Math.max(sz.x, sz.y, sz.z);
      if (maxD > 0) m.scale.setScalar(4.3 / maxD);
      box.setFromObject(m);
      const c = box.getCenter(new THREE.Vector3());
      m.position.x -= c.x; m.position.z -= c.z; m.position.y -= box.min.y;
      wrapper.rotation.y = savedRot;
      wrapper.add(m);
    }, undefined, () => wrapper.add(createFallbackCar(fbColors[i % fbColors.length])));
  } else {
    wrapper.add(createFallbackCar(fbColors[i % fbColors.length]));
  }
});

// ==========================================
// 6. KO'CHADAGI ODAMLAR (NPC) VA O'QLAR
// ==========================================
const npcs = [];
const npcShirts = [0xe53935, 0x8e24aa, 0x43a047, 0xfb8c00, 0x00897b];
for (let i = 0; i < 14; i++) {
  const mesh = createPersonMesh(npcShirts[i % npcShirts.length], 0x37474f);
  const roadX = roads[i % roads.length] + (i % 2 === 0 ? 6.5 : -6.5);
  const z = (Math.random() - 0.5) * 120;
  mesh.position.set(roadX, 0.22, z);
  scene.add(mesh);
  npcs.push({ mesh, dir: i % 2 === 0 ? 1 : -1, alive: true, respawn: 0 });
}

const bullets = [];
let money = 500;
let stars = 0;
let hasWeapon = false;
let shootCooldown = 0;

function addReward(cash, starAdd = 0) {
  money += cash;
  stars = Math.min(5, stars + starAdd);
  document.getElementById('moneyVal').textContent = money;
  document.getElementById('starsVal').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

function fireWeapon() {
  if (inCar || !hasWeapon || shootCooldown > 0) return;
  shootCooldown = 0.28;
  playGunshot();

  const b = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffeb3b })
  );
  const yaw = player.rotation.y;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  b.position.set(player.position.x + fx * 0.8, 1.35, player.position.z + fz * 0.8);
  scene.add(b);
  bullets.push({ mesh: b, vx: fx * 55, vz: fz * 55, life: 1.4 });
}

// ==========================================
// 7. BOSHQARUV (JOYSTIK, KAMERA, MASHINA)
// ==========================================
let inCar = false;
let activeCar = null;
let camYaw = 0;
let camPitch = 0.25;

// Ekranni surib kamerani aylantirish
let camTouchId = null, lastCamX = 0, lastCamY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  camTouchId = e.pointerId; lastCamX = e.clientX; lastCamY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== camTouchId) return;
  camYaw -= (e.clientX - lastCamX) * 0.006;
  camPitch = Math.max(-0.1, Math.min(0.85, camPitch + (e.clientY - lastCamY) * 0.004));
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
  joyY = -dy / maxR; // tepaga = +1
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

// Piyoda qurol tugmalari
const btnWeapon = document.getElementById('btnWeapon');
btnWeapon.onclick = () => {
  hasWeapon = !hasWeapon;
  player.userData.gun.visible = hasWeapon;
  btnWeapon.textContent = hasWeapon ? '🔫' : '👊';
  btnWeapon.classList.toggle('armed', hasWeapon);
  player.userData.armR.rotation.x = hasWeapon ? -Math.PI / 2 : 0;
};
document.getElementById('btnShoot').addEventListener('pointerdown', (e) => { e.stopPropagation(); fireWeapon(); });

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

document.getElementById('btnRotateCar').onclick = () => {
  if (!activeCar) return;
  activeCar.wrapper.rotation.y += Math.PI / 2;
  localStorage.setItem('rot_' + activeCar.modelId, activeCar.wrapper.rotation.y);
};

// Mashinaga minish / tushish
const enterExitBtn = document.getElementById('enterExitBtn');
function toggleEnterExit() {
  ensureAudioCtx();
  if (!inCar) {
    const nearest = findNearestCar();
    if (!nearest) return;
    activeCar = nearest;
    inCar = true;
    player.visible = false;
    document.getElementById('footControls').style.display = 'none';
    document.getElementById('carControls').style.display = 'flex';
    document.getElementById('radioBox').style.display = 'flex';
    document.getElementById('carSpeedBox').style.display = 'block';
    enterExitBtn.textContent = '🚶 Tushish';
    enterExitBtn.style.display = 'block';
    camYaw = activeCar.yaw;
    if (TRACKS.length > 0 && !radioAudio.src) loadTrack(0, true);
    else if (radioPlaying) radioAudio.play().catch(() => {});
  } else {
    inCar = false;
    const leftX = Math.cos(activeCar.yaw) * 2.1;
    const leftZ = -Math.sin(activeCar.yaw) * 2.1;
    player.position.set(activeCar.container.position.x + leftX, 0, activeCar.container.position.z + leftZ);
    player.visible = true;
    activeCar = null;
    document.getElementById('footControls').style.display = 'flex';
    document.getElementById('carControls').style.display = 'none';
    document.getElementById('radioBox').style.display = 'none';
    document.getElementById('carSpeedBox').style.display = 'none';
    radioAudio.pause();
  }
}
enterExitBtn.onclick = toggleEnterExit;

function findNearestCar() {
  let best = null, minD = 4.2;
  for (const c of cars) {
    const d = player.position.distanceTo(c.container.position);
    if (d < minD) { minD = d; best = c; }
  }
  return best;
}

// Klaviatura (PK da test uchun)
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
// 8. ASOSIY O'YIN TSIKLI
// ==========================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (shootCooldown > 0) shootCooldown -= dt;

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
      const spd = 6.5;
      const nx = player.position.x + vx * spd * dt;
      const nz = player.position.z + vz * spd * dt;
      if (!hitsBuilding(nx, player.position.z, 0.5)) player.position.x = nx;
      if (!hitsBuilding(player.position.x, nz, 0.5)) player.position.z = nz;
      player.rotation.y = Math.atan2(vx, vz);

      // Yurish animatsiyasi
      player.userData.walkTime += dt * 10;
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

    // Yaqin mashina bormi?
    const near = findNearestCar();
    if (near) {
      enterExitBtn.textContent = '🚗 Minish';
      enterExitBtn.style.display = 'block';
    } else {
      enterExitBtn.style.display = 'none';
    }

    // Kamera (Piyoda)
    const camDist = 5.5;
    camera.position.set(
      player.position.x - fx * camDist * Math.cos(camPitch),
      player.position.y + 1.9 + camDist * Math.sin(camPitch),
      player.position.z - fz * camDist * Math.cos(camPitch)
    );
    camera.lookAt(player.position.x, player.position.y + 1.3, player.position.z);

  } else if (activeCar) {
    // --- MASHINA HARAKATI ---
    const gas = carInput.gas || keys['KeyW'] || keys['ArrowUp'];
    const brk = carInput.brake || keys['KeyS'] || keys['ArrowDown'];
    const lft = carInput.left || keys['KeyA'] || keys['ArrowLeft'];
    const rgt = carInput.right || keys['KeyD'] || keys['ArrowRight'];

    if (gas) activeCar.speed = Math.min(36, activeCar.speed + 18 * dt);
    else if (brk) activeCar.speed = Math.max(-12, activeCar.speed - 24 * dt);
    else activeCar.speed *= Math.pow(0.25, dt);

    if (Math.abs(activeCar.speed) > 0.3) {
      const dir = activeCar.speed >= 0 ? 1 : -1;
      const turn = Math.min(1, Math.abs(activeCar.speed) / 7) * 2.2 * dir * dt;
      if (lft) activeCar.yaw += turn;
      if (rgt) activeCar.yaw -= turn;
    }

    const fx = Math.sin(activeCar.yaw), fz = Math.cos(activeCar.yaw);
    const nx = activeCar.container.position.x + fx * activeCar.speed * dt;
    const nz = activeCar.container.position.z + fz * activeCar.speed * dt;

    if (!hitsBuilding(nx, nz, 1.5)) {
      activeCar.container.position.x = nx;
      activeCar.container.position.z = nz;
    } else {
      activeCar.speed = -activeCar.speed * 0.3;
    }
    activeCar.container.rotation.y = activeCar.yaw;
    document.getElementById('speedVal').textContent = Math.round(Math.abs(activeCar.speed) * 3.6);

    // Kamera (Mashinada)
    if (!camTouchId && !lft && !rgt) {
      camYaw += (activeCar.yaw - camYaw) * 0.04;
    }
    const cfx = Math.sin(camYaw), cfz = Math.cos(camYaw);
    camera.position.lerp(new THREE.Vector3(
      activeCar.container.position.x - cfx * 9,
      3.8 + camPitch * 4,
      activeCar.container.position.z - cfz * 9
    ), 0.14);
    camera.lookAt(activeCar.container.position.x, 1.2, activeCar.container.position.z);
  }

  // --- O'QLAR VA NPC ODAMLAR ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.x += b.vx * dt;
    b.mesh.position.z += b.vz * dt;
    b.life -= dt;
    let hit = b.life <= 0 || hitsBuilding(b.mesh.position.x, b.mesh.position.z, 0.2);

    if (!hit) {
      for (const n of npcs) {
        if (n.alive && Math.hypot(b.mesh.position.x - n.mesh.position.x, b.mesh.position.z - n.mesh.position.z) < 0.85) {
          n.alive = false; n.mesh.visible = false; n.respawn = 7;
          addReward(50, 1);
          hit = true; break;
        }
      }
    }
    if (hit) { scene.remove(b.mesh); bullets.splice(i, 1); }
  }

  for (const n of npcs) {
    if (!n.alive) {
      n.respawn -= dt;
      if (n.respawn <= 0) { n.alive = true; n.mesh.visible = true; }
      continue;
    }
    n.mesh.position.z += n.dir * 2.1 * dt;
    if (Math.abs(n.mesh.position.z) > 80) n.dir *= -1;
    n.mesh.rotation.y = n.dir > 0 ? 0 : Math.PI;
    n.mesh.userData.walkTime += dt * 7;
    const s = Math.sin(n.mesh.userData.walkTime) * 0.5;
    n.mesh.userData.legL.rotation.x = s;
    n.mesh.userData.legR.rotation.x = -s;

    // Mashina urib yuborishi
    if (inCar && activeCar && Math.abs(activeCar.speed) > 5) {
      if (n.mesh.position.distanceTo(activeCar.container.position) < 2.2) {
        n.alive = false; n.mesh.visible = false; n.respawn = 7;
        addReward(35, 1);
      }
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
