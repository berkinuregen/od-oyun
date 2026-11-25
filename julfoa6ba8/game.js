// OD Band — Anksiyete'den Kaç  (three.js endless runner)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const params = new URLSearchParams(location.hash.slice(1));
const MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
try { await Promise.all([document.fonts.load('64px Anton'), document.fonts.load('24px Manrope')]); } catch (e) { }

// ------------------------------------------------------------------ config
const LANE = 2.0, ROAD_W = 7.0, TURN_WIN = 13, GRAV = 36, JUMP_V = 12.2;
const NGIRLS = 5;
const BAND = [
  { name: 'Eylül', role: 'Davul', item: 'baget' },
  { name: 'Güneş', role: 'Vokal', item: 'nota' },
  { name: 'Umay', role: 'Bas gitar', item: 'pena' },
  { name: 'Sude', role: 'Gitar', item: 'pena' },
  { name: 'Öykü', role: 'Gitar', item: 'pena' },
];
const upTR = t => t.toLocaleUpperCase('tr-TR');
const SONGS = [
  { id: 'burdayim', file: 'audio/burdayim.mp3', title: 'Burdayım', artist: 'OD Band', world: 'beach', word: 'BURDAYIM',
    chorus: [[47, 68], [118, 138], [138, 148]] },
  { id: 'anksiyete', file: 'audio/anksiyete.mp3', title: 'Anksiyete', artist: 'Melis Karaduman & OD Band', world: 'night', word: 'ANKSİYETE',
    chorus: [[28, 48], [84, 104], [104, 140], [140, 167]] },
];
const WORLDS = {
  green: { fog: 0xd6e2cf, fogNear: 50, fogFar: 240, skyTop: 0x3a6fc0, skyMid: 0x9cc4e4, skyBot: 0xf6e7c4, sun: 0xfff0d2, sunI: 2.9, hemiSky: 0xdcefff, hemiGround: 0x56703a, hemiI: 1.15, sea: 0x5f8a3e, bloom: .3, stars: 0, fill: .45, spec: 0x000000 },
  stone: { fog: 0xf0cfae, fogNear: 45, fogFar: 230, skyTop: 0x44609f, skyMid: 0xe9b38c, skyBot: 0xffd4a0, sun: 0xffd9aa, sunI: 2.7, hemiSky: 0xffe6cc, hemiGround: 0x6a5444, hemiI: 1.1, sea: 0xb9a184, bloom: .4, stars: 0, fill: .5, spec: 0x000000 },
  beach: { fog: 0xf0a07a, fogNear: 45, fogFar: 230, skyTop: 0x2d2c6e, skyMid: 0xd8687a, skyBot: 0xffb36b, sun: 0xffd2a0, sunI: 2.6, hemiSky: 0xffc9a8, hemiGround: 0x5a3c58, hemiI: 1.1, sea: 0x6b4a7a, bloom: .55, stars: 0, fill: .5, spec: 0xffd0a0 },
  concert: { fog: 0x2a1840, fogNear: 40, fogFar: 210, skyTop: 0x0c0826, skyMid: 0x3a1f5e, skyBot: 0xd8604e, sun: 0xff9a7a, sunI: 1.0, hemiSky: 0x8a6ab8, hemiGround: 0x1c1028, hemiI: .95, sea: 0x1c1428, bloom: 1.0, stars: .7, fill: 1.3, spec: 0x000000 },
  night: { fog: 0x1a0f2e, fogNear: 30, fogFar: 190, skyTop: 0x05030c, skyMid: 0x1a0d33, skyBot: 0x4a1a5a, sun: 0x9db4ff, sunI: .9, hemiSky: 0x6a5aa8, hemiGround: 0x150a20, hemiI: .8, sea: 0x0d0a18, bloom: .85, stars: 1, fill: 1.6, spec: 0x221833 },
};
// Burdayım runs through three places: green road → stone streets → beach (sunset at the end of the song)
function biomeAt(songTime) { return songTime < 42 ? 'green' : songTime < 85 ? 'stone' : songTime < 127 ? 'beach' : 'concert'; }
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf0a07a, 45, 230);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 1200);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: MOBILE ? 0 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .55, .6, .82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < .8 ? 70 : 58;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// lights
const hemi = new THREE.HemisphereLight(0xffc9a8, 0x5a3c58, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd2a0, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 120 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(-12, 16, -70);
const fill = new THREE.DirectionalLight(0xffffff, .5); scene.add(fill, fill.target);

// ------------------------------------------------------------------ sky dome
const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(.3, .05, -1).normalize() }, sunCol: { value: new THREE.Color(0xfff0c8) }, stars: { value: 0 }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top,mid,bot,sunDir,sunCol; uniform float stars,time; varying vec3 vP;
    float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
    void main(){ float y=vP.y; vec3 c = y>0.18 ? mix(mid,top,smoothstep(.18,.75,y)) : mix(bot,mid,smoothstep(-.02,.18,y));
      float d=max(dot(vP,sunDir),0.); c += sunCol*(pow(d,900.)*3.0 + pow(d,24.)*.35 + pow(d,4.)*.12)*(1.-stars*.7);
      if(stars>0.){ vec3 q=floor(vP*260.); float s=step(.9975,h(q)); c+=vec3(s)*stars*smoothstep(0.05,.3,y)*(.6+.4*sin(time*3.+h(q)*40.)); }
      gl_FragColor=vec4(c,1.); }`
}));
sky.renderOrder = -1; scene.add(sky);

// sea / base ground (in green & stone worlds it's tinted like distant land)
const seaTex = noiseTexture(256, 4);
seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.repeat.set(60, 60);
const seaMat = new THREE.MeshPhongMaterial({ color: 0x6b4a7a, specular: 0xffd0a0, shininess: 90, normalMap: seaTex, normalScale: new THREE.Vector2(.6, .6) });
const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), seaMat);
sea.rotation.x = -Math.PI / 2; sea.position.y = -.45; sea.receiveShadow = false; scene.add(sea);

// distant silhouettes ring
const farGroup = new THREE.Group(); scene.add(farGroup);
let farWorld = null;
function buildFar(world) {
  farGroup.clear(); farWorld = world;
  const col = { green: 0x7c9a78, stone: 0xb08a7a, beach: 0x7a4a6a, concert: 0x1a1030, night: 0x120a22 }[world];
  const mat = new THREE.MeshBasicMaterial({ color: col, fog: false });
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2, r = 620; let m;
    if (world === 'night' || (world === 'concert' && i % 3 === 0)) { const h = rand(30, 120); m = new THREE.Mesh(new THREE.BoxGeometry(rand(20, 50), h, 20), mat); m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r); m.lookAt(0, h / 2, 0); }
    else if (world === 'beach') { if (Math.random() < .5) continue; m = new THREE.Mesh(new THREE.ConeGeometry(rand(40, 90), rand(14, 40), 5), mat); m.position.set(Math.cos(a) * r, -2, Math.sin(a) * r); }
    else { m = new THREE.Mesh(new THREE.SphereGeometry(rand(60, 120), 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.scale.y = world === 'green' ? rand(.35, .6) : rand(.25, .45); m.position.set(Math.cos(a) * r, -3, Math.sin(a) * r); }
    farGroup.add(m);
  }
}

// ------------------------------------------------------------------ textures
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
function noiseTexture(n, oct) {
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); const img = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const x = i % n, y = (i / n) | 0; const v = Math.sin(x * .19 + Math.sin(y * .07) * 3) * .5 + Math.sin(y * .23 + Math.sin(x * .05) * 2) * .5;
    img.data[i * 4] = 128 + v * 60 + rand(-20, 20); img.data[i * 4 + 1] = 128 + Math.cos(x * .13 + y * .11) * 60 + rand(-20, 20); img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); return t;
}
const T = {};
T.wood = canvasTex(256, 512, (g, w, h) => {
  const cols = ['#8b5a3c', '#7d4f34', '#93623f', '#86553a'];
  for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 4]; g.fillRect(0, i * 32, w, 31); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * 32 + 30, w, 2);
    for (let k = 0; k < 12; k++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,220,180' : '40,20,10'},.08)`; g.fillRect(rand(0, w), i * 32 + rand(2, 28), rand(30, 140), 1.5); }
    g.fillStyle = '#3a2418'; g.beginPath(); g.arc(18, i * 32 + 16, 2.2, 0, 7); g.arc(w - 18, i * 32 + 16, 2.2, 0, 7); g.fill(); }
}, true);
T.asphalt = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#1b1822'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; g.fillRect(rand(0, w), rand(0, h), 1.5, 1.5); }
  g.fillStyle = 'rgba(255,60,160,.9)'; for (const x of [w * .355, w * .645]) for (let y = 0; y < h; y += 128) g.fillRect(x - 3, y, 6, 70);
  g.fillStyle = 'rgba(80,220,255,.9)'; g.fillRect(6, 0, 5, h); g.fillRect(w - 11, 0, 5, h);
}, true);
T.windows = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#16121f'; g.fillRect(0, 0, w, h);
  for (let y = 10; y < h; y += 32) for (let x = 10; x < w; x += 30) { const on = Math.random(); g.fillStyle = on < .35 ? pick(['#ffcf7a', '#ff9ad5', '#9ad5ff', '#fff1c4']) : '#241d33'; g.fillRect(x, y, 18, 20); }
}, true);
T.shutter = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#e9e2d6'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(80,60,50,.35)'; for (let y = 4; y < h; y += 9) g.fillRect(4, y, w - 8, 3); g.strokeStyle = '#8a7a6a'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); });
T.wall = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f2e6d8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(120,90,70,${Math.random() * .08})`; g.fillRect(rand(0, w), rand(0, h), 3, 3); } }, true);
T.od = canvasTex(512, 160, (g, w, h) => { g.fillStyle = '#c4142c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#fff'; g.font = '110px Anton, Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OD BAND', w / 2, h / 2 + 6); });
T.burdayim = canvasTex(512, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff8a3d'); gr.addColorStop(1, '#ffcf4a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#2a1030'; g.font = '96px Anton, Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BURDAYIM', w / 2, h / 2 + 6); });
T.case = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#26252b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b9bdc6'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = '#b9bdc6'; for (const [x, y] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) { g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); } g.fillStyle = '#f1f1f1'; g.font = '44px Anton, Impact'; g.textAlign = 'center'; g.fillText('OD BAND', w / 2, h * .42); g.font = '26px Anton, Impact'; g.fillStyle = '#e8433b'; g.fillText('FRAGILE • TOUR 2026', w / 2, h * .62); });
T.amp = canvasTex(256, 192, (g, w, h) => { g.fillStyle = '#1a1a1d'; g.fillRect(0, 0, w, h); g.fillStyle = '#2c2c31'; g.fillRect(12, 12, w - 24, h - 24); for (let y = 16; y < h - 16; y += 6) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(14, y, w - 28, 2); } g.fillStyle = '#d8c9a0'; g.font = 'italic 28px Anton, Impact'; g.fillText('OD', 20, 40); });
T.checklist = canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8433b'; g.fillRect(0, 0, w, 56); g.fillStyle = '#fff'; g.font = '34px Anton, Impact'; g.textAlign = 'center'; g.fillText('CHECKLIST', w / 2, 40); g.textAlign = 'left'; g.font = '22px Manrope, sans-serif'; g.fillStyle = '#222';
  ['prova', 'mail at', 'uyu (?)', 'su iç', 'stüdyo', 'faturalar', 'nefes al', '...'].forEach((s, i) => { g.strokeStyle = '#222'; g.lineWidth = 3; g.strokeRect(18, 74 + i * 30, 18, 18); g.fillText(s, 46, 90 + i * 30); if (i === 0) { g.beginPath(); g.moveTo(20, 82); g.lineTo(27, 90); g.lineTo(38, 72); g.stroke(); } }); });
function tabTex(label) { return canvasTex(512, 300, (g, w, h) => { g.fillStyle = '#2a2140'; rr(g, 0, 30, w, h - 30, 18); g.fill(); g.fillStyle = '#3a2f58'; rr(g, 16, 0, 230, 54, 14); g.fill(); g.fillStyle = '#e8e2ff'; g.font = '26px Manrope, sans-serif'; g.fillText(label.tab, 40, 36); g.fillStyle = '#ff5f8a'; g.font = '30px Anton, Impact'; g.fillText('✕', 210, 38); g.fillStyle = '#fff'; g.font = '58px Anton, Impact'; g.textAlign = 'center'; g.fillText(label.big, w / 2, 170); g.font = '26px Manrope, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(label.small, w / 2, 230); }); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const TABS = [{ tab: 'yeni sekme', big: 'KAFAMDA BİN SEKME', small: '999+ sekme açık' }, { tab: 'kalp.exe', big: '148 BPM', small: 'uyku yok gündeminde' }, { tab: 'takvim', big: 'GEÇ KALDIN', small: 'geç kalmışlık hissi' }, { tab: 'loop.mp4', big: 'BAŞA SAR', small: 'bir filmi loop’a al' }, { tab: 'bildirim', big: 'YOKLAMA', small: 'dürtme, kemirme' }, { tab: 'misafir', big: 'DAVET ETMEDİM', small: 'evde bir misafir var' }].map(tabTex);
T.notif = canvasTex(512, 128, (g, w, h) => { g.fillStyle = 'rgba(30,24,48,.95)'; rr(g, 0, 0, w, h, 30); g.fill(); g.fillStyle = '#ff3b6b'; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '46px Anton, Impact'; g.textAlign = 'center'; g.fillText('!', 64, 80); g.textAlign = 'left'; g.font = '40px Anton, Impact'; g.fillText('99+ BİLDİRİM', 120, 62); g.font = '24px Manrope, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('Anksiyete seni etiketledi', 120, 98); });
T.ecg = canvasTex(512, 128, (g, w, h) => { g.strokeStyle = '#ff2d6a'; g.lineWidth = 7; g.shadowColor = '#ff2d6a'; g.shadowBlur = 12; g.beginPath(); let x = 0; g.moveTo(0, 70); while (x < w) { g.lineTo(x + 40, 70); g.lineTo(x + 50, 30); g.lineTo(x + 62, 115); g.lineTo(x + 72, 15); g.lineTo(x + 84, 70); x += 128; } g.stroke(); });
T.glow = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
T.smoke = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
function letterTex(ch) { return canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#ffcf4a'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke(); g.fillStyle = '#2a1030'; g.font = '80px Anton, Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70); }); }

function speckle(g, w, h, n, cols, r = [1, 3]) { for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); const s = rand(r[0], r[1]); g.fillRect(rand(0, w), rand(0, h), s, s); } }
T.grass = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5f8f3c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { const gr = g.createRadialGradient(rand(0, w), rand(0, h), 0, rand(0, w), rand(0, h), rand(20, 60)); gr.addColorStop(0, `rgba(${pick(['120,170,70', '70,120,40', '140,160,70'])},.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  for (let i = 0; i < 2600; i++) { g.strokeStyle = pick(['#4c7a2e', '#77a84a', '#86b552', '#3f6a26']); g.lineWidth = 1; const x = rand(0, w), y = rand(0, h); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-2, 2), y - rand(3, 7)); g.stroke(); }
  speckle(g, w, h, 40, ['#f4f0e0', '#f7d64a', '#e8679a'], [2, 3]);
}, true);
T.dirt = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b89468'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 3000, ['#a5845a', '#c9a77a', '#9a7a52', '#d4b98e'], [1, 3]);
  for (let i = 0; i < 120; i++) { g.fillStyle = pick(['#8d8a84', '#a8a39a', '#77736c']); g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(2, 5), rand(1.5, 4), rand(0, 3), 0, 7); g.fill(); }
  g.fillStyle = 'rgba(90,60,30,.18)'; for (const x of [w * .3, w * .7]) g.fillRect(x - 10, 0, 20, h); // wheel ruts
}, true);
T.cobble = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#6e655c'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 21) for (let x = (y / 21) % 2 ? -12 : 0; x < w; x += 25) {
    const c = pick(['#a99d8e', '#b8ab99', '#9c9184', '#c2b6a3', '#8f8578']); g.fillStyle = c; rr(g, x + 2, y + 2, 21, 17, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; rr(g, x + 4, y + 3, 14, 6, 3); g.fill();
  }
}, true);
T.paving = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#d6c6ad'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(110,90,70,.35)'; g.lineWidth = 2;
  for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); }
  speckle(g, w, h, 800, ['rgba(120,100,80,.15)', 'rgba(255,255,255,.12)'], [1, 3]);
}, true);
T.sand = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#e2bf92'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 9) { g.strokeStyle = 'rgba(160,120,80,.12)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * .05 + y) * 3); g.stroke(); }
  speckle(g, w, h, 2500, ['#d4ae7f', '#efd2a8', '#c99f72', '#f5e2c2'], [1, 2]);
}, true);
T.sandRoad = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#c9a274'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 2500, ['#b8915f', '#d8b487', '#a9845a'], [1, 2]);
  for (let i = 0; i < 26; i++) { const x = rand(20, w - 20), y = rand(0, h); g.fillStyle = 'rgba(120,85,50,.25)'; g.beginPath(); g.ellipse(x, y, 4, 8, rand(-.3, .3), 0, 7); g.fill(); } // footprints
}, true);
T.stage = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#1c1a20'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } speckle(g, w, h, 900, ['rgba(255,255,255,.04)', 'rgba(0,0,0,.3)'], [1, 3]); g.fillStyle = 'rgba(255,207,74,.5)'; g.fillRect(w / 2 - 3, 0, 6, h * .5); }, true);
T.screen = canvasTex(1024, 384, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a0f4a'); gr.addColorStop(.5, '#c4142c'); gr.addColorStop(1, '#ff8a3d'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '190px Anton, Impact'; g.fillText('OD BAND', w / 2, h * .56); g.font = '70px Anton, Impact'; g.fillStyle = '#ffe3a0'; g.fillText('BURDAYIM', w / 2, h * .86); });
T.nightGround = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#120d1c'; g.fillRect(0, 0, w, h); speckle(g, w, h, 200, ['#1b1528', '#0c0814'], [1, 3]); }, true);
T.net = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(30,30,30,.85)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, w, 14); });
T.awning = canvasTex(128, 64, (g, w, h) => { for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? '#f4efe4' : '#e8433b'; g.fillRect(x, 0, 16, h); } });
T.hut = canvasTex(128, 128, (g, w, h) => { for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? '#f4efe4' : '#3a8fc4'; g.fillRect(x, 0, 16, h); } });

// ------------------------------------------------------------------ shared geometries/materials
const M = {
  wood: new THREE.MeshStandardMaterial({ map: T.wood, roughness: .85 }),
  post: new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: .9 }),
  bulb: new THREE.MeshBasicMaterial({ color: 0xffd08a }),
  asphalt: new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: .6, metalness: .1, emissiveMap: T.asphalt, emissive: 0xffffff, emissiveIntensity: .35 }),
  sheet: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .9, side: THREE.DoubleSide }),
  rope: new THREE.MeshStandardMaterial({ color: 0xd8cbb0 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: .8, roughness: .35 }),
  stick: new THREE.MeshStandardMaterial({ color: 0xf0cf98, roughness: .5, emissive: 0x4a2a00, emissiveIntensity: .5 }),
  pick: new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: .6, roughness: .25, emissive: 0x6a3a00, emissiveIntensity: .6 }),
  wall: new THREE.MeshStandardMaterial({ map: T.wall, roughness: .95 }),
  roof: new THREE.MeshStandardMaterial({ color: 0xb4553a, roughness: .9 }),
  shutter: new THREE.MeshStandardMaterial({ map: T.shutter, roughness: .9 }),
  case: new THREE.MeshStandardMaterial({ map: T.case, roughness: .6 }),
  caseSide: new THREE.MeshStandardMaterial({ color: 0x1d1c21, roughness: .6 }),
  amp: new THREE.MeshStandardMaterial({ map: T.amp, roughness: .7 }),
  ampSide: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: .7 }),
  building: new THREE.MeshStandardMaterial({ map: T.windows, emissiveMap: T.windows, emissive: 0xffffff, emissiveIntensity: .9, roughness: .8 }),
  neonPink: new THREE.MeshBasicMaterial({ color: 0xff3d9a }),
  neonCyan: new THREE.MeshBasicMaterial({ color: 0x4de1ff }),
  clockRed: new THREE.MeshStandardMaterial({ color: 0xd8203a, roughness: .4, metalness: .2 }),
  clockFace: new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: .5 }),
  sand: new THREE.MeshStandardMaterial({ color: 0xd9a77e, roughness: 1 }),
};
const G = {
  pick: (() => { const s = new THREE.Shape(); s.moveTo(-.32, .25); s.quadraticCurveTo(0, .45, .32, .25); s.quadraticCurveTo(.3, -.1, 0, -.42); s.quadraticCurveTo(-.3, -.1, -.32, .25); const g = new THREE.ExtrudeGeometry(s, { depth: .06, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2 }); g.center(); return g; })(),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  sphere: new THREE.SphereGeometry(1, 16, 12),
};
G.sticks = (() => { const mk = a => { const c = new THREE.CylinderGeometry(.028, .045, 1.15, 8); const tip = new THREE.SphereGeometry(.045, 8, 6); tip.translate(0, .59, 0); const m = mergeGeometries([c, tip]); m.rotateZ(a); return m; }; return mergeGeometries([mk(.5), mk(-.5)]); })();
G.note = (() => { const sh = new THREE.Shape(); sh.absellipse(-.12, -.3, .19, .14, 0, Math.PI * 2, false, -.4); const st = new THREE.Shape(); st.moveTo(.04, -.28); st.lineTo(.1, -.28); st.lineTo(.1, .42); st.quadraticCurveTo(.34, .3, .3, .02); st.quadraticCurveTo(.28, .22, .1, .26); st.lineTo(.04, .26); st.closePath();
  const g = mergeGeometries([new THREE.ExtrudeGeometry(sh, { depth: .07, bevelEnabled: false }), new THREE.ExtrudeGeometry(st, { depth: .07, bevelEnabled: false })]); g.center(); g.scale(1.3, 1.3, 1.3); return g; })();

// ------------------------------------------------------------------ biome materials
const M2 = {
  grass: new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1 }),
  dirt: new THREE.MeshStandardMaterial({ map: T.dirt, roughness: 1 }),
  cobble: new THREE.MeshStandardMaterial({ map: T.cobble, roughness: .9 }),
  paving: new THREE.MeshStandardMaterial({ map: T.paving, roughness: .95 }),
  sand: new THREE.MeshStandardMaterial({ map: T.sand, roughness: 1 }),
  sandRoad: new THREE.MeshStandardMaterial({ map: T.sandRoad, roughness: 1 }),
  nightGround: new THREE.MeshStandardMaterial({ map: T.nightGround, roughness: 1 }),
  asphalt: new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: .6, metalness: .1, emissiveMap: T.asphalt, emissive: 0xffffff, emissiveIntensity: .35 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1 }),
  leaves: [0x4f8a34, 0x5d9a3c, 0x3f7a2c, 0x6aa246, 0x7aa83e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .95, flatShading: true })),
  pine: new THREE.MeshStandardMaterial({ color: 0x2f6a3a, roughness: .95, flatShading: true }),
  hedge: new THREE.MeshStandardMaterial({ color: 0x3f7a30, roughness: 1, flatShading: true }),
  hay: new THREE.MeshStandardMaterial({ color: 0xd8b25c, roughness: 1 }),
  fence: new THREE.MeshStandardMaterial({ color: 0xc9b08a, roughness: .9 }),
  flower: [0xf2ece0, 0xf6d24a, 0xe8679a, 0xb06ad8, 0xf28a3c].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 })),
  walls: [0xf4ede2, 0xefe2cc, 0xe8d2b0, 0xf2e4d4, 0xd9b08c].map(c => new THREE.MeshStandardMaterial({ map: T.wall, color: c, roughness: .95 })),
  shutters: [0x3f8f9a, 0x4a6fa8, 0x5c8f4a, 0x2f6f7a].map(c => new THREE.MeshStandardMaterial({ map: T.shutter, color: c, roughness: .9 })),
  tile: new THREE.MeshStandardMaterial({ color: 0xb4553a, roughness: .9, flatShading: true }),
  bougain: new THREE.MeshStandardMaterial({ color: 0xd8317a, roughness: .9, flatShading: true }),
  stoneEdge: new THREE.MeshStandardMaterial({ color: 0xcfc2ae, roughness: .95 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: .6, metalness: .4 }),
  palm: new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 }),
  frond: new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: .9, flatShading: true, side: THREE.DoubleSide }),
  rock: new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 1, flatShading: true }),
  lounger: new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: .8 }),
  net: new THREE.MeshBasicMaterial({ map: T.net, transparent: true, side: THREE.DoubleSide, alphaTest: .1 }),
  awning: new THREE.MeshStandardMaterial({ map: T.awning, roughness: .9, side: THREE.DoubleSide }),
  hut: new THREE.MeshStandardMaterial({ map: T.hut, roughness: .9 }),
  ball: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6 }),
  stage: new THREE.MeshStandardMaterial({ map: T.stage, roughness: .7 }),
  grassDark: new THREE.MeshStandardMaterial({ map: T.grass, color: 0x6a7058, roughness: 1 }),
  ledA: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3d9a).multiplyScalar(1.1), toneMapped: false }),
  ledB: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4de1ff).multiplyScalar(1.1), toneMapped: false }),
  ledBulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd68a).multiplyScalar(3), toneMapped: false }),
  crowd: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }),
  phones: new THREE.PointsMaterial({ map: T.glow, color: 0xcfe6ff, size: .35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  beamGeo: (() => { const g = new THREE.ConeGeometry(1.5, 16, 18, 1, true); g.translate(0, -8, 0); return g; })(),
  water: new THREE.MeshPhongMaterial({ color: 0x6b4a7a, specular: 0xffd0a0, shininess: 90, normalMap: (() => { const t = seaTex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.needsUpdate = true; return t; })(), normalScale: new THREE.Vector2(.6, .6) }),
  foam: new THREE.MeshBasicMaterial({ color: 0xfff4e6, transparent: true, opacity: .55, depthWrite: false }),
};
const crowdTime = { value: 0 };
M2.crowd.onBeforeCompile = sh => { sh.uniforms.uTime = crowdTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.y += abs(sin(uTime * 6.5 + float(gl_InstanceID) * 1.37)) * 0.3;'); };
const G2 = { ico: new THREE.IcosahedronGeometry(1, 0), cone: new THREE.ConeGeometry(1, 1, 7), dodec: new THREE.DodecahedronGeometry(1, 0) };

// ------------------------------------------------------------------ track
let segs = [];           // {sx,sz,dir,len,turn,group,objs,world}
let genWorld = 'green';
let curWorld = 'green';
let segCount = 0;
const root = new THREE.Group(); scene.add(root);

function segPoint(seg, s, lat, out = new THREE.Vector3()) {
  const d = DIRS[seg.dir], r = DIRS[(seg.dir + 1) % 4];
  return out.set(seg.sx + d[0] * s + r[0] * lat, 0, seg.sz + d[1] * s + r[1] * lat);
}
function yawOf(dir) { const d = DIRS[dir]; return Math.atan2(-d[0], -d[1]); }

function worldForNextSeg() {
  if (SONGS[songIdx].world !== 'beach') return SONGS[songIdx].world;
  // estimate when the player will reach this new segment and pick the biome for that moment of the song
  let ahead = 0; for (let i = segI ?? 0; i < segs.length; i++) ahead += segs[i].len; ahead -= (s || 0);
  const eta = (songs[songIdx]?.currentTime || 0) + Math.max(0, ahead) / Math.max(10, speed || 13);
  return params.get('biome2') || params.get('biome') || biomeAt(eta);
}
function addSeg(first) {
  const prev = segs[segs.length - 1];
  let sx = 0, sz = 0, dir = 0;
  if (prev) { const d = DIRS[prev.dir]; sx = prev.sx + d[0] * prev.len; sz = prev.sz + d[1] * prev.len; dir = (prev.dir + (prev.turn === 'R' ? 1 : 3)) % 4; }
  const len = first ? 150 : Math.round(rand(85, 150));
  let turn = Math.random() < .5 ? 'L' : 'R';
  if (prev && prev.turn === turn && Math.random() < .7) turn = turn === 'L' ? 'R' : 'L';
  const world = first ? genWorld : worldForNextSeg();
  const from = prev && prev.world !== world ? prev.world : null; // worlds blend into each other inside one segment
  if (world === 'beach' || from === 'beach') turn = 'R'; // keep the sea on the left
  const seg = { sx, sz, dir, len: from ? Math.max(len, 130) : len, turn, objs: [], world, from, group: new THREE.Group(), n: segCount++ };
  seg.group.position.set(sx, 0, sz); seg.group.rotation.y = yawOf(dir);
  root.add(seg.group);
  buildSegment(seg, first);
  segs.push(seg);
}
// local coords inside seg.group: forward = -Z, right = +X
function put(seg, obj, s, lat, y = 0) { obj.position.set(lat, y, -s); seg.group.add(obj); return obj; }
// flat textured strip from s0..s1, lat x0..x1 ; texture tiles every `tile` meters
function strip(seg, mat, s0, s1, x0, x1, y, tile = 6, tileV) {
  const w = x1 - x0, l = s1 - s0; const geo = new THREE.PlaneGeometry(w, l);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * l / (tileV || tile));
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; put(seg, m, (s0 + s1) / 2, (x0 + x1) / 2, y); return m;
}

function buildSegment(seg, first) {
  const H = ROAD_W / 2, s0 = first ? -12 : H, sEnd = seg.len + H;
  seg.gy = -.03 - (seg.n % 4) * .004; // ground layers of neighbouring segments never z-fight
  if (seg.from) { // transition: first half old world, second half new world, joined by a gate
    seg.mid = Math.round(seg.len * .5);
    buildPart(seg, seg.from, s0, seg.mid, true, false);
    buildPart(seg, seg.world, seg.mid, sEnd, false, true);
    gate(seg, seg.from, seg.world, seg.mid);
  } else buildPart(seg, seg.world, s0, sEnd, true, true);
  cornerWall(seg);
  const arrow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: arrowTex(seg.turn), transparent: true, depthWrite: false }));
  arrow.rotation.x = -Math.PI / 2; put(seg, arrow, seg.len - 9, 0, .02);
  spawnContent(seg, first ? 30 : 16);
}
function worldAt(seg, s) { return seg.from && s < seg.mid ? seg.from : seg.world; }

// builds road, ground and scenery of world `w` for the stretch a..b of a segment
function buildPart(seg, w, a, b, isStart, isEnd) {
  const H = ROAD_W / 2, gy = seg.gy;
  const ga = isStart ? a - 4 : a, gb = isEnd ? b + 30 : b; // ground extends past the ends
  const inPart = s => s >= a + 1 && s <= b - 1 && s > 9 && s < seg.len - 9; // also keep corners clear
  const range = (start, step, fn) => { for (let s = a + start; s < b; s += step()) if (inPart(s)) fn(s); };
  if (w === 'green') {
    strip(seg, M2.dirt, a, b, -H, H, 0, ROAD_W, 7);
    strip(seg, M2.grass, ga, gb, -160, 160, gy, 8);
    for (const side of [-1, 1]) {
      range(rand(2, 6), () => rand(3.5, 7), s => {
        tree(seg, s, side * rand(H + 3, H + 9));
        if (Math.random() < (MOBILE ? .3 : .55)) tree(seg, s + rand(-2, 2), side * rand(H + 10, H + 35));
        if (Math.random() < .5) bush(seg, s + rand(0, 3), side * rand(H + .9, H + 2.2));
        if (Math.random() < .35) flowers(seg, s + rand(0, 3), side * rand(H + .6, H + 3));
      });
      const fa = Math.max(a + 4, 10), fb = Math.min(b - 4, seg.len - 10); if (fb - fa > 12 && Math.random() < .5) fence(seg, side, fa, fb);
    }
  } else if (w === 'stone') {
    strip(seg, M2.cobble, a, b, -H, H, 0, 3);
    strip(seg, M2.paving, ga, gb, -160, 160, gy, 4);
    for (const side of [-1, 1]) {
      const ca = Math.max(a, 9), cb = Math.min(b, seg.len - 9);
      if (cb > ca) { const curb = new THREE.Mesh(G.box, M2.stoneEdge); curb.scale.set(1.4, .14, cb - ca); put(seg, curb, (ca + cb) / 2, side * (H + .7), .07); curb.receiveShadow = true; }
      for (let s = Math.max(a, 10); s < Math.min(b, seg.len - 12);) { const wdt = rand(5, 8); if (s + wdt < Math.min(b, seg.len - 10)) townHouse(seg, s + wdt / 2, side, wdt); s += wdt + rand(0, 1.5); }
      range(6, () => rand(14, 20), s => lamp(seg, s, side * (H + .9)));
    }
    range(rand(8, 20), () => rand(18, 30), s => overheadLine(seg, s));
  } else if (w === 'beach') {
    strip(seg, M2.sandRoad, a, b, -H, H, 0, ROAD_W, 7);
    strip(seg, M2.sand, ga, gb, -16, 160, gy, 6);
    strip(seg, M2.water, ga, gb, -230, -15, -.012, 14);
    strip(seg, M2.foam, ga, gb, -16.6, -14.6, -.008, 2, 4);
    range(rand(2, 8), () => rand(7, 13), s => {
      const r = Math.random();
      if (r < .35) palm(seg, s, rand(H + 2.5, H + 6) * (Math.random() < .5 ? -1 : 1));
      else if (r < .6) { umbrella(seg, s, rand(H + 3, H + 9)); if (Math.random() < .7) lounger(seg, s + 1.3, rand(H + 3, H + 9), false); }
      else if (r < .75) hut(seg, s, rand(H + 10, H + 14));
      else rocks(seg, s, -rand(12, 16));
      if (Math.random() < .3) palm(seg, s + 3, rand(H + 14, H + 30));
    });
  } else if (w === 'concert') {
    strip(seg, M2.stage, a, b, -H, H, 0, ROAD_W, 4);
    strip(seg, M2.grassDark, ga, gb, -160, 160, gy, 8);
    for (const side of [-1, 1]) {
      const led = new THREE.Mesh(G.box, side < 0 ? M2.ledA : M2.ledB); led.scale.set(.06, .04, b - a); put(seg, led, (a + b) / 2, side * (H - .05), .03);
      const ca = Math.max(a, 9), cb = Math.min(b, seg.len - 9);
      if (cb - ca > 2) { barrier(seg, side, ca, cb); crowd(seg, side, ca, cb); }
      range(rand(4, 10), () => rand(20, 26), s => lightTower(seg, s, side * (H + 13.5)));
    }
  } else { // night
    strip(seg, M2.asphalt, a, b, -H, H, 0, ROAD_W, 12);
    strip(seg, M2.nightGround, ga, gb, -160, 160, gy, 8);
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(G.box, side < 0 ? M.neonPink : M.neonCyan); curb.scale.set(.12, .12, b - a); put(seg, curb, (a + b) / 2, side * (H + .05), .05);
      for (let s = Math.max(a, 8); s < Math.min(b, seg.len - 10); s += rand(9, 15)) {
        const h = rand(10, 34), wdt = rand(7, 10);
        const bd = new THREE.Mesh(G.box, M.building); bd.scale.set(wdt, h, rand(7, 9)); put(seg, bd, s + 4, side * (H + 3 + wdt / 2), h / 2 - .5);
        if (Math.random() < .3) { const e = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: T.ecg, transparent: true, depthWrite: false })); e.rotation.y = -side * Math.PI / 2; put(seg, e, s + 4, side * (H + 2.9), rand(4, 8)); }
      }
    }
    range(rand(4, 14), () => rand(14, 24), s => {
      const side = Math.random() < .5 ? -1 : 1; const t = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1), new THREE.MeshBasicMaterial({ map: pick(TABS), transparent: true, side: THREE.DoubleSide }));
      t.rotation.y = -side * .7; put(seg, t, s, side * rand(4.6, 6), rand(3.2, 5.5)); t.userData.float = rand(0, 6); seg.objs.push({ t: 'deco', mesh: t, s });
    });
  }
}

// the gate that stitches two worlds together in the middle of a transition segment
const signCache = {};
function signTex(text, bg, fg, w = 512, h = 128) { if (text.length > 14) w = 1024;
  return signTex2(text, bg, fg, w, h); }
function signTex2(text, bg, fg, w, h) { return signCache[text + bg] ||= canvasTex(w, h, g => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = fg; let fs = Math.floor(h * .55); g.font = `${fs}px Anton, Impact`; const mw = g.measureText(text).width; if (mw > w * .88) { fs = Math.floor(fs * w * .88 / mw); g.font = `${fs}px Anton, Impact`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4); }); }
function gate(seg, from, to, s) {
  const H = ROAD_W / 2, g = new THREE.Group();
  const pillar = (mat, x, h, w = .9) => { const p = new THREE.Mesh(G.box, mat); p.scale.set(w, h, w); p.position.set(x, h / 2, 0); p.castShadow = true; g.add(p); };
  const beam = (mat, y, h, wdt = ROAD_W + 3) => { const b = new THREE.Mesh(G.box, mat); b.scale.set(wdt, h, .7); b.position.y = y; b.castShadow = true; g.add(b); };
  const sign = (text, bg, fg, y, w = 4.2, h = 1.05) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTex(text, bg, fg), side: THREE.DoubleSide })); p.position.set(0, y, .37); g.add(p); const p2 = p.clone(); p2.position.z = -.37; g.add(p2); };
  if (to === 'stone') { pillar(M2.stoneEdge, -H - .9, 4.8); pillar(M2.stoneEdge, H + .9, 4.8); beam(M2.stoneEdge, 4.9, .8); sign('YAZLIKLAR', '#f4ede2', '#3f6f7a', 4.9); for (const x of [-H - .9, H + .9]) { const b = new THREE.Mesh(G2.ico, M2.bougain); b.scale.setScalar(.9); b.position.set(x, 5.2, 0); g.add(b); } }
  else if (to === 'beach') { pillar(M2.palm, -H - .7, 4.2, .3); pillar(M2.palm, H + .7, 4.2, .3); beam(M2.palm, 4.25, .3); sign('PLAJ ☀', '#3a8fc4', '#fff6e6', 3.7, 3.4, .95); palm(seg, s + 1.5, -H - 2.6); palm(seg, s + 1.5, H + 2.6); }
  else if (to === 'concert') { pillar(M.metal, -H - .8, 5.2, .45); pillar(M.metal, H + .8, 5.2, .45); beam(M.metal, 5.3, .45); sign('OD BAND · BURDAYIM KONSERİ', '#c4142c', '#ffffff', 4.5, 6.6, 1.1);
    for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(G.sphere, M2.ledBulb); b.scale.setScalar(.09); b.position.set(-H - .8 + i * (ROAD_W + 1.6) / 8, 5.62, .25); g.add(b); } }
  else return;
  put(seg, g, s, 0, 0);
}

// ---------------- concert ground
function barrier(seg, side, a, b) {
  const lat = side * (ROAD_W / 2 + .6);
  for (const y of [.35, .95]) { const r = new THREE.Mesh(G.box, M.metal); r.scale.set(.05, .05, b - a); put(seg, r, (a + b) / 2, lat, y); }
  for (let s = a; s <= b; s += 2.2) { const p = new THREE.Mesh(G.box, M.metal); p.scale.set(.05, 1, .05); put(seg, p, s, lat, .5); const f = new THREE.Mesh(G.box, M.metal); f.scale.set(.6, .04, .05); put(seg, f, s, lat + side * .25, .02); }
}
let crowdGeo = null;
function crowd(seg, side, a, b) {
  if (!crowdGeo) {
    const body = new THREE.CapsuleGeometry(.22, .8, 2, 6); body.translate(0, .62, 0);
    const head = new THREE.SphereGeometry(.15, 8, 6); head.translate(0, 1.33, 0);
    const armL = new THREE.BoxGeometry(.08, .55, .08); armL.translate(-.18, 1.55, 0); armL.rotateZ(.12);
    const armR = new THREE.BoxGeometry(.08, .55, .08); armR.translate(.18, 1.55, 0); armR.rotateZ(-.12);
    crowdGeo = mergeGeometries([body, head, armL, armR]);
  }
  const rows = MOBILE ? 3 : 5, per = Math.floor((b - a) / 1.15) * rows;
  const im = new THREE.InstancedMesh(crowdGeo, M2.crowd, per); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  let i = 0;
  for (let r = 0; r < rows; r++) for (let s = a + rand(0, .6); s < b && i < per; s += rand(.9, 1.4)) {
    const lat = side * (ROAD_W / 2 + 1.5 + r * 1.9 + rand(-.4, .4));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), side > 0 ? Math.PI / 2 + rand(-.4, .4) : -Math.PI / 2 + rand(-.4, .4));
    m.compose(new THREE.Vector3(lat, 0, -s), q, new THREE.Vector3(1, rand(.9, 1.12), 1)); im.setMatrixAt(i, m);
    im.setColorAt(i, c.setHSL(rand(0, 1), rand(.15, .5), rand(.08, .28))); i++;
  }
  im.count = i; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = false; im.frustumCulled = false; seg.group.add(im);
  // phone lights
  const pts = []; for (let k = 0; k < i / 6; k++) pts.push(side * (ROAD_W / 2 + 1.5 + rand(0, 8)), rand(1.7, 2.0), -rand(a, b));
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  seg.group.add(new THREE.Points(pg, M2.phones));
}
function lightTower(seg, s, lat) {
  const g = new THREE.Group(); const h = 9;
  for (const x of [-.35, .35]) for (const z of [-.35, .35]) { const p = new THREE.Mesh(G.box, M.metal); p.scale.set(.08, h, .08); p.position.set(x, h / 2, z); g.add(p); }
  for (let y = 1; y < h; y += 1.2) { const r = new THREE.Mesh(G.box, M.metal); r.scale.set(.8, .05, .8); r.position.y = y; g.add(r); }
  const sp = new THREE.Mesh(G.box, M.ampSide); sp.scale.set(1.2, 2.2, 1); sp.position.set(0, 1.1, 0); g.add(sp);
  const heads = new THREE.Group(); heads.position.y = h + .2; g.add(heads);
  for (let k = 0; k < 3; k++) {
    const col = pick([0xff3d9a, 0x4de1ff, 0xffcf4a, 0x9a6bff, 0xffffff]);
    const lampG = new THREE.Group(); lampG.position.x = (k - 1) * .5; heads.add(lampG);
    const bulb = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(3), toneMapped: false })); bulb.scale.setScalar(.16); lampG.add(bulb);
    const beam = new THREE.Mesh(M2.beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    lampG.add(beam); lampG.userData = { ph: rand(0, 6), sp: rand(.5, 1.2) }; seg.objs.push({ t: 'deco', mesh: lampG, s, beam: true });
  }
  put(seg, g, s, lat, 0);
}
function stageAt(seg, s) { // the big stage that closes every concert corner
  const g = new THREE.Group(); const W = ROAD_W + 9;
  const deck = new THREE.Mesh(G.box, M.caseSide); deck.scale.set(W, 1.3, 6); deck.position.set(0, .65, -2.2); g.add(deck);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W - 3, 4.2), new THREE.MeshBasicMaterial({ map: T.screen, toneMapped: false, color: 0xcccccc })); screen.position.set(0, 4.2, -4.6); g.add(screen);
  for (const x of [-W / 2 + .8, W / 2 - .8]) { const sp = new THREE.Mesh(G.box, M.ampSide); sp.scale.set(1.4, 5.5, 1.2); sp.position.set(x, 4, -1); g.add(sp); const tw = new THREE.Mesh(G.box, M.metal); tw.scale.set(.3, 8, .3); tw.position.set(x, 4, -4.8); g.add(tw); }
  const roof = new THREE.Mesh(G.box, M.metal); roof.scale.set(W, .35, .35); roof.position.set(0, 7.9, -1.5); g.add(roof);
  for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(G.sphere, M2.ledBulb); b.scale.setScalar(.14); b.position.set(-W / 2 + 1 + i * (W - 2) / 7, 7.6, -1.3); g.add(b); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  put(seg, g, s, 0, 0);
}

const arrowTexCache = {};
function arrowTex(t) { return arrowTexCache[t] ||= canvasTex(128, 128, (g) => { g.translate(64, 64); if (t === 'L') g.scale(-1, 1); g.fillStyle = 'rgba(255,207,74,.95)'; g.beginPath(); g.moveTo(-40, 30); g.lineTo(-40, -6); g.lineTo(10, -6); g.lineTo(10, -30); g.lineTo(50, 4); g.lineTo(10, 38); g.lineTo(10, 14); g.lineTo(-20, 14); g.lineTo(-20, 30); g.closePath(); g.fill(); }); }

// dead end straight ahead (and on the outer side) of every corner: miss the turn and you hit it
function cornerWall(seg) {
  const H = ROAD_W / 2, w = seg.world, sW = seg.len + H + .9, outer = seg.turn === 'R' ? -1 : 1;
  const wall = (s, lat, sx, sz, rotY = 0) => {
    let m;
    if (w === 'green') { m = new THREE.Mesh(G.box, M2.hedge); m.scale.set(sx, 1.9, sz); m.position.y = .95; }
    else if (w === 'stone') { m = new THREE.Group(); const b = new THREE.Mesh(G.box, pick(M2.walls)); b.scale.set(sx, 5.5, sz); b.position.y = 2.75; m.add(b); const roof = new THREE.Mesh(G.box, M2.tile); roof.scale.set(sx + .4, .35, sz + .4); roof.position.y = 5.6; m.add(roof); }
    else if (w === 'beach') { m = new THREE.Group(); for (let i = 0; i < Math.max(sx, sz) / 1.3; i++) { const r = new THREE.Mesh(G2.dodec, M2.rock); r.scale.set(rand(.7, 1.2), rand(.6, 1.1), rand(.7, 1.1)); const along = -Math.max(sx, sz) / 2 + i * 1.3; if (sx > sz) r.position.set(along, .45, 0); else r.position.set(0, .45, along); m.add(r); } }
    else { m = new THREE.Mesh(G.box, M.building); m.scale.set(sx, 14, sz); m.position.y = 7; }
    const holder = new THREE.Group(); holder.add(m); holder.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    put(seg, holder, s, lat, 0);
  };
  if (w === 'concert') { stageAt(seg, sW + .2); const sp = new THREE.Mesh(G.box, M.ampSide); sp.scale.set(1.4, 4, ROAD_W + 2); sp.castShadow = true; put(seg, sp, seg.len, outer * (ROAD_W / 2 + 1), 2); return; }
  wall(sW, 0, ROAD_W + 4, 1.4);
  wall(seg.len, outer * (H + .9), 1.4, ROAD_W + 2);
}

// ---------------- green
function tree(seg, s, lat) {
  const g = new THREE.Group(); const h = rand(2.2, 3.6);
  if (Math.random() < .3) { // pine
    const tr = new THREE.Mesh(G.cyl, M2.trunk); tr.scale.set(.18, 1.2, .18); tr.position.y = .6; g.add(tr);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(G2.cone, M2.pine); const r = 1.6 - i * .4; c.scale.set(r, 1.6, r); c.position.y = 1.5 + i * 1.0; g.add(c); }
    g.scale.setScalar(rand(.9, 1.5));
  } else {
    const tr = new THREE.Mesh(G.cyl, M2.trunk); tr.scale.set(.2, h, .2); tr.position.y = h / 2; g.add(tr);
    const mat = pick(M2.leaves);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(G2.ico, mat); f.scale.setScalar(rand(1.1, 1.7)); f.position.set(rand(-.7, .7), h + rand(.2, 1.1), rand(-.7, .7)); f.rotation.set(rand(0, 3), rand(0, 3), 0); g.add(f); }
    g.scale.setScalar(rand(.9, 1.35));
  }
  g.rotation.y = rand(0, 6); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  put(seg, g, s, lat, 0);
}
function bush(seg, s, lat) { const b = new THREE.Mesh(G2.ico, pick(M2.leaves)); b.scale.set(rand(.5, .9), rand(.4, .7), rand(.5, .9)); b.castShadow = true; put(seg, b, s, lat, .3); }
function flowers(seg, s, lat) { const g = new THREE.Group(); const mat = pick(M2.flower); for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(G.sphere, mat); f.scale.setScalar(.09); f.position.set(rand(-.6, .6), rand(.12, .3), rand(-.6, .6)); g.add(f); } put(seg, g, s, lat, 0); }
function fence(seg, side, a, b) {
  const lat = side * (ROAD_W / 2 + .5);
  for (let s = a; s < b; s += 2.4) { const p = new THREE.Mesh(G.box, M2.fence); p.scale.set(.1, .9, .1); put(seg, p, s, lat, .45); }
  for (const y of [.4, .75]) { const r = new THREE.Mesh(G.box, M2.fence); r.scale.set(.05, .08, b - a); put(seg, r, (a + b) / 2, lat, y); }
}
// ---------------- stone
function townHouse(seg, s, side, wdt) {
  const g = new THREE.Group(); const h = rand(5, 8.5), d = rand(6, 8);
  const body = new THREE.Mesh(G.box, pick(M2.walls)); body.scale.set(d, h, wdt); body.position.y = h / 2; g.add(body);
  if (Math.random() < .6) { const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 1, 4, 1), M2.tile); roof.rotation.y = Math.PI / 4; roof.scale.set(d * .78, 1.8, wdt * .78); roof.position.y = h + .9; g.add(roof); }
  else { const top = new THREE.Mesh(G.box, M2.stoneEdge); top.scale.set(d + .2, .3, wdt + .2); top.position.y = h + .15; g.add(top); }
  const sh = pick(M2.shutters); const face = -side * (d / 2 + .02); // facade toward the road
  const floors = Math.floor(h / 2.7);
  for (let f = 0; f < floors; f++) for (let k = -1; k <= 1; k += 2) {
    if (wdt < 6 && k > 0 && f === 0) continue;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), sh); win.position.set(face, 1.6 + f * 2.7, k * wdt * .22); win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(win);
  }
  if (Math.random() < .5) { const bal = new THREE.Mesh(G.box, M2.iron); bal.scale.set(.6, .08, wdt * .5); bal.position.set(face - side * .3, 3.6, 0); g.add(bal);
    if (Math.random() < .7) for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(G2.ico, M2.bougain); b.scale.setScalar(rand(.35, .6)); b.position.set(face - side * rand(.2, .5), rand(3.6, 5.2), rand(-wdt * .4, wdt * .4)); g.add(b); } }
  if (Math.random() < .4) { const pot = new THREE.Mesh(G.cyl, M2.tile); pot.scale.set(.3, .45, .3); pot.position.set(face - side * .5, .22, rand(-wdt * .3, wdt * .3)); g.add(pot); const p = new THREE.Mesh(G2.ico, pick(M2.leaves)); p.scale.setScalar(.45); p.position.copy(pot.position).setY(.7); g.add(p); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  put(seg, g, s, side * (ROAD_W / 2 + 1.4 + d / 2), 0);
}
function lamp(seg, s, lat) {
  const g = new THREE.Group(); const p = new THREE.Mesh(G.cyl, M2.iron); p.scale.set(.06, 3.4, .06); p.position.y = 1.7; g.add(p);
  const b = new THREE.Mesh(G.sphere, M.bulb); b.scale.setScalar(.18); b.position.y = 3.45; g.add(b);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffb060, transparent: true, opacity: .45, depthWrite: false })); halo.scale.setScalar(1.4); halo.position.y = 3.45; g.add(halo);
  put(seg, g, s, lat, 0);
}
function overheadLine(seg, s) { // decorative laundry high above the street (out of reach)
  const rope = new THREE.Mesh(G.cyl, M.rope); rope.scale.set(.015, ROAD_W + 3, .015); rope.rotation.z = Math.PI / 2; put(seg, rope, s, 0, 4.6);
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(.8, rand(.6, 1)), new THREE.MeshStandardMaterial({ color: pick([0xf4f1ea, 0xe8433b, 0x3a8fc4, 0xf6d24a]), side: THREE.DoubleSide })); c.position.set(-2.4 + i * 1.6 + rand(-.3, .3), 4.2, -s); seg.group.add(c); }
}
// ---------------- beach
function palm(seg, s, lat) {
  const g = new THREE.Group(); const n = 7, lean = rand(.04, .1) * (Math.random() < .5 ? -1 : 1); let x = 0, y = 0;
  for (let i = 0; i < n; i++) { const c = new THREE.Mesh(G.cyl, M2.palm); c.scale.set(.16 - i * .01, .75, .16 - i * .01); c.position.set(x, y + .37, 0); c.rotation.z = -lean * i; g.add(c); x += Math.sin(lean * i) * .75; y += .72; }
  for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(G.sphere, M2.frond); f.scale.set(1.5, .06, .3); const a = k / 7 * Math.PI * 2; f.position.set(x + Math.cos(a) * 1.2, y - .25, Math.sin(a) * 1.2); f.rotation.set(0, -a, -.45); f.rotation.order = 'YZX'; g.add(f); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scale.setScalar(rand(.9, 1.25));
  put(seg, g, s, lat, 0);
}
function umbrella(seg, s, lat) {
  const g = new THREE.Group(); const pole = new THREE.Mesh(G.cyl, M.post); pole.scale.set(.05, 2.4, .05); pole.position.y = 1.2; g.add(pole);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.4, .6, 8), new THREE.MeshStandardMaterial({ color: pick([0xe8433b, 0xffcf4a, 0xf2efe6, 0x3a8fc4]) })); top.position.y = 2.5; top.castShadow = true; g.add(top);
  put(seg, g, s, lat, 0);
}
function lounger(seg, s, lat, asObstacle) {
  const g = new THREE.Group(); const bed = new THREE.Mesh(G.box, M2.lounger); bed.scale.set(.7, .08, 1.8); bed.position.y = .38; g.add(bed);
  const back = new THREE.Mesh(G.box, M2.lounger); back.scale.set(.7, .08, .8); back.position.set(0, .62, .85); back.rotation.x = .9; g.add(back);
  for (const x of [-.3, .3]) for (const z of [-.8, .8]) { const l = new THREE.Mesh(G.box, M2.palm); l.scale.set(.06, .38, .06); l.position.set(x, .19, z); g.add(l); }
  if (asObstacle) g.rotation.y = Math.PI / 2;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  if (!asObstacle) put(seg, g, s, lat, 0);
  return g;
}
function hut(seg, s, lat) { const g = new THREE.Group(); const b = new THREE.Mesh(G.box, M2.hut); b.scale.set(2.2, 2.4, 2.2); b.position.y = 1.2; g.add(b); const r = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 1, 4), M2.tile); r.rotation.y = Math.PI / 4; r.scale.set(2, 1, 2); r.position.y = 2.9; g.add(r); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); put(seg, g, s, lat, 0); }
function rocks(seg, s, lat) { for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(G2.dodec, M2.rock); r.scale.set(rand(.5, 1.2), rand(.4, .9), rand(.5, 1.1)); r.castShadow = true; put(seg, r, s + rand(-1.5, 1.5), lat + rand(-1, 1), .2); } }

// ------------------------------------------------------------------ obstacles
function spawnContent(seg, startS) {
  for (let s = startS; s < seg.len - 18;) {
    const diff = clamp((speed - 13) / 17, 0, 1);
    const lanes = [-1, 0, 1].sort(() => Math.random() - .5);
    if (Math.random() < .22) coinLine(seg, s, lanes[0], 7);
    else {
      const n = Math.random() < .25 + diff * .45 ? 2 : 1;
      for (let i = 0; i < n; i++) obstacle(seg, s, lanes[i]);
      const free = lanes[n];
      if (Math.random() < .75) coinLine(seg, s - 4, free, 5);
      else if (Math.random() < .5) { const lo = seg.objs.find(o => o.s === s && o.t === 'low'); if (lo) coinArc(seg, s, lo.lane); }
    }
    if (Math.random() < .07) powerup(seg, s + 6, lanes[2] ?? 0, Math.random() < .55 ? 'sun' : 'mic');
    if (Math.random() < .16) letter(seg, s + 8, lanes[1] ?? 0);
    s += lerp(19, 11, diff) + rand(0, 6);
  }
}
function sheetLine(g) { // clothesline with a white sheet (from the Burdayım video idea) — slide under
  for (const x of [-1.05, 1.05]) { const p = new THREE.Mesh(G.cyl, M.post); p.scale.set(.06, 2.9, .06); p.position.set(x, 1.45, 0); g.add(p); }
  const rope = new THREE.Mesh(G.cyl, M.rope); rope.scale.set(.02, 2.1, .02); rope.rotation.z = Math.PI / 2; rope.position.y = 2.75; g.add(rope);
  const sheetG = new THREE.PlaneGeometry(2.0, 1.4, 10, 6); sheetG.translate(0, -.7, 0);
  const sh = new THREE.Mesh(sheetG, M.sheet); sh.position.y = 2.75; g.add(sh); g.userData.sheet = sh; sh.userData.base = sheetG.attributes.position.array.slice();
}
function caseStack(g) {
  const mats = [M.caseSide, M.caseSide, M.caseSide, M.caseSide, M.case, M.caseSide];
  const a = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.2), mats); a.position.y = .6; g.add(a);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.1), mats); b.position.set(.05, 1.7, 0); b.rotation.y = .12; g.add(b);
}
function monitor(g) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, .8, .9), [M.ampSide, M.ampSide, M.ampSide, M.ampSide, M.amp, M.ampSide]); b.position.y = .4; b.rotation.x = -.25; g.add(b); }
function obstacle(seg, s, lane) {
  const w = worldAt(seg, s), k = Math.random(); let t;
  if (k < .36) t = 'low'; else if (k < .68) t = 'high'; else t = 'block';
  const g = new THREE.Group();
  if (w === 'concert') {
    if (t === 'low') { if (Math.random() < .5) monitor(g); else { for (const y of [.35, .85]) { const r = new THREE.Mesh(G.box, M.metal); r.scale.set(1.8, .06, .06); r.position.y = y; g.add(r); } for (const x of [-.85, .85]) { const p = new THREE.Mesh(G.box, M.metal); p.scale.set(.06, .9, .06); p.position.set(x, .45, 0); g.add(p); const f = new THREE.Mesh(G.box, M.metal); f.scale.set(.06, .04, .7); f.position.set(x, .02, 0); g.add(f); } } }
    else if (t === 'high') { for (const x of [-1.1, 1.1]) { const p = new THREE.Mesh(G.box, M.metal); p.scale.set(.12, 2.9, .12); p.position.set(x, 1.45, 0); g.add(p); } const tr = new THREE.Mesh(G.box, M.metal); tr.scale.set(2.4, .3, .3); tr.position.y = 2.0; g.add(tr); const tr2 = tr.clone(); tr2.position.y = 2.6; g.add(tr2);
      for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(G.sphere, i % 2 ? M2.ledA : M2.ledB); b.scale.setScalar(.12); b.position.set(-.8 + i * .53, 1.78, 0); g.add(b); } }
    else { for (const x of [-.45, .45]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.85, 2.4, .9), [M.ampSide, M.ampSide, M.ampSide, M.ampSide, M.amp, M.ampSide]); sp.position.set(x, 1.2, 0); g.add(sp); } }
  } else if (w === 'night') {
    if (t === 'low') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .45, 24), M.clockRed); body.rotation.x = Math.PI / 2; body.position.y = .72; g.add(body);
      const face = new THREE.Mesh(new THREE.CircleGeometry(.52, 24), M.clockFace); face.position.set(0, .72, .231); g.add(face);
      for (const x of [-.35, .35]) { const bell = new THREE.Mesh(G.sphere, M.clockRed); bell.scale.setScalar(.22); bell.position.set(x, 1.32, 0); g.add(bell); const leg = new THREE.Mesh(G.cyl, M.metal); leg.scale.set(.05, .3, .05); leg.position.set(x * .9, .15, 0); g.add(leg); }
      g.userData.shake = true;
    } else if (t === 'high') {
      for (const x of [-1.05, 1.05]) { const p = new THREE.Mesh(G.cyl, M.metal); p.scale.set(.05, 2.9, .05); p.position.set(x, 1.45, 0); g.add(p); }
      const n = new THREE.Mesh(new THREE.PlaneGeometry(2.3, .7), new THREE.MeshBasicMaterial({ map: T.notif, transparent: true, side: THREE.DoubleSide })); n.position.y = 2.05; g.add(n);
      const n2 = n.clone(); n2.position.y = 2.6; n2.scale.setScalar(.8); g.add(n2);
    } else {
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.3, .12), [M.caseSide, M.caseSide, M.caseSide, M.caseSide, new THREE.MeshStandardMaterial({ map: T.checklist, roughness: .8 }), M.caseSide]); board.position.y = 1.3; g.add(board);
    }
  } else if (t === 'low') {
    const r = Math.random();
    if (r < .3) monitor(g);
    else if (w === 'green') { const hay = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, 1.7, 16), M2.hay); hay.rotation.z = Math.PI / 2; hay.position.y = .48; g.add(hay); }
    else if (w === 'stone') { const p = new THREE.Mesh(G.box, M2.stoneEdge); p.scale.set(1.7, .6, .7); p.position.y = .3; g.add(p); for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(G2.ico, i % 2 ? M2.bougain : pick(M2.leaves)); f.scale.setScalar(.22); f.position.set(-.65 + i * .26, .72, rand(-.15, .15)); g.add(f); } }
    else { if (Math.random() < .5) g.add(lounger(null, 0, 0, true)); else { const c = new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, .6, 8), M2.sand); c.position.y = .3; g.add(c); const t2 = new THREE.Mesh(new THREE.CylinderGeometry(.25, .35, .4, 8), M2.sand); t2.position.y = .8; g.add(t2); } }
  } else if (t === 'high') {
    if (w === 'beach' && Math.random() < .6) { // volleyball net
      for (const x of [-1.15, 1.15]) { const p = new THREE.Mesh(G.cyl, M.post); p.scale.set(.06, 2.6, .06); p.position.set(x, 1.3, 0); g.add(p); }
      const n = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.0), M2.net); n.position.y = 1.95; g.add(n);
      const ball = new THREE.Mesh(G.sphere, M2.ball); ball.scale.setScalar(.12); ball.position.set(rand(-.6, .6), 2.9, 0); g.add(ball); g.userData.ball = ball;
    } else if (w === 'stone' && Math.random() < .35) { // OD banner
      for (const x of [-1.1, 1.1]) { const p = new THREE.Mesh(G.cyl, M.metal); p.scale.set(.06, 2.9, .06); p.position.set(x, 1.45, 0); g.add(p); }
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2.3, .75), new THREE.MeshStandardMaterial({ map: T.od, side: THREE.DoubleSide })); b.position.y = 2.15; g.add(b);
    } else sheetLine(g);
  } else caseStack(g);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  put(seg, g, s, lane * LANE, 0);
  seg.objs.push({ t, lane, s, mesh: g });
}

function coinLine(seg, s, lane, n) { for (let i = 0; i < n; i++) coin(seg, s + i * 2.2, lane, .9); }
function coinArc(seg, s, lane) { for (let i = -3; i <= 3; i++) coin(seg, s + i * 1.4, lane, .9 + 1.9 * (1 - (i * i) / 9)); }
function coin(seg, s, lane, y) {
  const it = BAND[sel].item; const m = new THREE.Mesh(it === 'baget' ? G.sticks : it === 'nota' ? G.note : G.pick, it === 'baget' ? M.stick : M.pick); m.scale.setScalar(1.05); put(seg, m, s, lane * LANE, y); seg.objs.push({ t: 'coin', lane, s, y, mesh: m });
}
function powerup(seg, s, lane, kind) {
  const g = new THREE.Group();
  if (kind === 'sun') {
    const core = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xffd36b })); core.scale.setScalar(.38); g.add(core);
    for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(new THREE.ConeGeometry(.08, .35, 6), new THREE.MeshBasicMaterial({ color: 0xffa83a })); const a = i / 10 * Math.PI * 2; r.position.set(Math.cos(a) * .55, Math.sin(a) * .55, 0); r.rotation.z = a - Math.PI / 2; g.add(r); }
  } else {
    const head = new THREE.Mesh(G.sphere, new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: .9, roughness: .3 })); head.scale.setScalar(.22); head.position.y = .2; g.add(head);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.09, .06, .55, 12), new THREE.MeshStandardMaterial({ color: 0x1c1c1c })); body.position.y = -.15; g.add(body);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: kind === 'sun' ? 0xffb040 : 0x9ad5ff, transparent: true, depthWrite: false, opacity: .8 })); halo.scale.setScalar(2.2); g.add(halo);
  put(seg, g, s, lane * LANE, 1.3); seg.objs.push({ t: kind, lane, s, y: 1.3, mesh: g });
}
function letter(seg, s, lane) {
  const word = [...SONGS[songIdx].word]; const ch = word[letterIdx % word.length];
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTex(ch), transparent: true })); sp.scale.setScalar(1.1);
  put(seg, sp, s, lane * LANE, 1.3); seg.objs.push({ t: 'letter', ch, lane, s, y: 1.3, mesh: sp });
}

// ------------------------------------------------------------------ characters
const loader = new GLTFLoader();
const girlTemplates = [];
async function loadGirls(onProgress) {
  let done = 0;
  await Promise.all([...Array(NGIRLS)].map((_, i) => new Promise(res => {
    loader.load(`models/girl${i + 1}.glb`, gltf => { girlTemplates[i] = prepGirl(gltf); onProgress(++done / NGIRLS); res(); },
      undefined, () => { girlTemplates[i] = null; onProgress(++done / NGIRLS); res(); });
  })));
}
function prepGirl(gltf) {
  const obj = gltf.scene;
  obj.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (o.material) { o.material.side = THREE.FrontSide; if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; o.material.roughness = Math.max(.6, o.material.roughness ?? .8); o.material.metalness = 0; } } });
  const box = new THREE.Box3().setFromObject(obj); const h = box.max.y - box.min.y;
  const c = box.getCenter(new THREE.Vector3());
  // shared clips (idle/jump/slide) come from another rig: keep rotations + vertical hip motion only
  for (const clip of gltf.animations) {
    if (/runfast/i.test(clip.name)) continue;
    clip.tracks = clip.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'Hips.position');
    const hp = clip.tracks.find(t => t.name === 'Hips.position');
    if (hp) for (let i = 0; i < hp.values.length; i += 3) { hp.values[i] = 0; hp.values[i + 2] = 0; }
  }
  return { scene: obj, animations: gltf.animations, scale: 1.72 / h, minY: box.min.y, cx: c.x, cz: c.z };
}
function findClip(anims, names) { for (const n of names) { const c = anims.find(a => a.name.toLowerCase().includes(n)); if (c) return c; } return null; }
function makeGirl(i) {
  const tpl = girlTemplates[i];
  const holder = new THREE.Group(); const inner = new THREE.Group(); holder.add(inner);
  let mixer = null, actions = {};
  if (tpl) {
    const m = SkeletonUtils.clone(tpl.scene); m.scale.setScalar(tpl.scale); m.position.set(-tpl.cx * tpl.scale, -tpl.minY * tpl.scale, -tpl.cz * tpl.scale); inner.add(m);
    inner.rotation.y = Math.PI; // models face +Z, we run toward -Z
    mixer = new THREE.AnimationMixer(m);
    const run = findClip(tpl.animations, ['runfast', 'run']) || tpl.animations[0];
    const map = { run };
    for (const k of ['idle', 'jump', 'slide', 'fall', 'reach', 'standup', 'help', 'cheer']) map[k] = findClip(tpl.animations, [k]);
    for (const k in map) if (map[k]) { actions[k] = mixer.clipAction(map[k]); }
    for (const k of ['jump', 'slide', 'fall', 'standup', 'help']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce); actions[k].clampWhenFinished = true; }
  } else {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.3, 1.0, 4, 8), new THREE.MeshStandardMaterial({ color: 0xe8433b })); body.position.y = .85; inner.add(body);
  }
  return { holder, inner, mixer, actions, cur: null };
}
function playAct(g, name, fade = .15, ts = 1) {
  const a = g.actions[name] || g.actions.run; if (!a) return;
  if (g.cur === a && !['jump', 'slide', 'fall', 'standup', 'help'].includes(name)) { a.timeScale = ts; return; }
  a.reset(); a.timeScale = ts; a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(fade).play();
  if (g.cur && g.cur !== a) g.cur.fadeOut(fade);
  g.cur = a;
}

// ------------------------------------------------------------------ the chaser: "Anksiyete"
const chaser = new THREE.Group(); scene.add(chaser); chaser.scale.setScalar(.66);
const smokeMat = new THREE.SpriteMaterial({ map: T.smoke, color: 0x07020c, transparent: true, depthWrite: false, opacity: .85 });
const smoke = [];
for (let i = 0; i < 70; i++) { const sp = new THREE.Sprite(smokeMat.clone()); sp.userData = { a: Math.random() * 6.28, r: Math.random(), h: Math.random(), sp: rand(.6, 1.6) }; chaser.add(sp); smoke.push(sp); }
const cBody = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), new THREE.MeshBasicMaterial({ color: 0x050008, transparent: true, opacity: .8, depthWrite: false })); cBody.scale.set(.75, 1.1, .7); cBody.position.y = 1.6; chaser.add(cBody);
const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .08, .16).multiplyScalar(6), toneMapped: false });
const eyes = [];
for (const x of [-.32, .32]) { const e = new THREE.Mesh(G.sphere, eyeMat); e.scale.set(.15, .06, .05); e.position.set(x, 2.15, -.72); e.rotation.z = x > 0 ? -.3 : .3; chaser.add(e); eyes.push(e); }
const arms = [];
for (const side of [-1, 1]) {
  const arm = new THREE.Group(); arm.position.set(side * .75, 1.9, -.2); chaser.add(arm);
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(.09, .16, 1.5, 8), new THREE.MeshBasicMaterial({ color: 0x050008 })); seg1.position.y = .7; arm.add(seg1);
  for (let k = -1; k <= 1; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.04, .45, 6), new THREE.MeshBasicMaterial({ color: 0x050008 })); f.position.set(k * .09, 1.62, 0); f.rotation.z = k * .3; arm.add(f); }
  arm.userData.side = side; arms.push(arm);
}
const chaserLight = new THREE.PointLight(0xff1838, 4, 6); chaserLight.position.set(0, 2.2, -1); chaser.add(chaserLight);

// shield bubble
const shield = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending }));
shield.visible = false;

// ------------------------------------------------------------------ state
let state = 'loading', sel = +(localStorage.getItem('od3_sel') ?? 2) || 0;
let player = null, menuGirls = [], friends = [], downT = 0, downReason = '', fallen = { x: 0, z: 0, yaw: 0 };
let speed, seg, segI, s, lane, lat, py, vy, sliding, slideT, turnQ, stumbleT, gap, score, picks, dist, magnet, sunT, letterIdx = 0, mult, deadT, fallY, camYaw;
let downReasonShown = false; let songIdx = 0, best = +localStorage.getItem('od3_best') || 0, muted = localStorage.getItem('od3_muted') === '1';
const clock = new THREE.Clock(); let hbT = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

// ------------------------------------------------------------------ audio
const songs = SONGS.map(sg => { const a = new Audio(sg.file); a.preload = 'auto'; a.volume = .8; return a; });
songs.forEach((a, i) => a.addEventListener('ended', () => { if (state === 'run') nextSong(); }));
let AC = null;
function ac() { if (!AC) try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } if (AC?.state === 'suspended') AC.resume(); return AC; }
function sfx(f, d = .08, type = 'square', v = .05, slide = 0) { const a = ac(); if (!a || muted) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f; if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), a.currentTime + d); g.gain.value = v; g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + d); }
function noise(d, v, lp = 2000) { const a = ac(); if (!a || muted) return; const b = a.createBuffer(1, a.sampleRate * d, a.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length); const src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; src.buffer = b; g.gain.value = v; src.connect(f).connect(g).connect(a.destination); src.start(); }
function setMuted(m) { muted = m; localStorage.setItem('od3_muted', m ? '1' : '0'); songs.forEach(a => a.muted = m); $('muteBtn').textContent = 'Ses: ' + (m ? 'kapalı' : 'açık'); }
setMuted(muted);
function playSong(i, from = 0) { songs.forEach(a => a.pause()); songIdx = i; const a = songs[i]; try { a.currentTime = from; } catch (e) { } a.play().catch(() => { }); $('songName').textContent = SONGS[i].title; $('songArtist').textContent = SONGS[i].artist; }
function nextSong() {
  const n = (songIdx + 1) % SONGS.length; playSong(n); letterIdx = 0; buildLetters();
  showMsg(SONGS[n].world === 'night' ? 'GECE: ANKSİYETE' : 'BURDAYIM', 2);
}

// ------------------------------------------------------------------ world look
const look = { cur: null };
function applyWorld(name, k = 1) {
  const W = WORLDS[name];
  const c = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);
  const from = look.cur || W;
  scene.fog.color.copy(c(from.fog, W.fog)); scene.fog.near = lerp(from.fogNear, W.fogNear, k); scene.fog.far = lerp(from.fogFar, W.fogFar, k);
  skyU.top.value.copy(c(from.skyTop, W.skyTop)); skyU.mid.value.copy(c(from.skyMid, W.skyMid)); skyU.bot.value.copy(c(from.skyBot, W.skyBot)); skyU.stars.value = lerp(from.stars, W.stars, k);
  sun.color.copy(c(from.sun, W.sun)); sun.intensity = lerp(from.sunI, W.sunI, k);
  hemi.color.copy(c(from.hemiSky, W.hemiSky)); hemi.groundColor.copy(c(from.hemiGround, W.hemiGround)); hemi.intensity = lerp(from.hemiI, W.hemiI, k);
  seaMat.color.copy(c(from.sea, W.sea)); bloom.strength = lerp(from.bloom, W.bloom, k);
  fill.intensity = lerp(from.fill ?? .5, W.fill, k); seaMat.specular.copy(c(from.spec ?? 0xffd0a0, W.spec));
}
let worldFade = null;
function setWorld(name, instant) {
  if (instant) { look.cur = null; applyWorld(name, 1); look.cur = WORLDS[name]; curWorld = name; buildFar(name); return; }
  worldFade = { from: snapshotLook(), to: name, t: 0 }; curWorld = name; buildFar(name);
}
function snapshotLook() { const W = { ...WORLDS[curWorld] }; W.fog = scene.fog.color.getHex(); W.fogNear = scene.fog.near; W.fogFar = scene.fog.far; W.skyTop = skyU.top.value.getHex(); W.skyMid = skyU.mid.value.getHex(); W.skyBot = skyU.bot.value.getHex(); W.stars = skyU.stars.value; W.sun = sun.color.getHex(); W.sunI = sun.intensity; W.hemiSky = hemi.color.getHex(); W.hemiGround = hemi.groundColor.getHex(); W.hemiI = hemi.intensity; W.sea = seaMat.color.getHex(); W.bloom = bloom.strength; W.fill = fill.intensity; W.spec = seaMat.specular.getHex(); return W; }

// ------------------------------------------------------------------ game flow
function clearTrack() { for (const sg of segs) { root.remove(sg.group); disposeGroup(sg.group); } segs = []; }
function disposeGroup(g) { g.traverse(o => { if (o.geometry && !Object.values(G).includes(o.geometry) && o.geometry !== G.pick) o.geometry.dispose?.(); }); }

function newRun() {
  clearTrack(); songIdx = +(params.get('song') || 0); segI = 0; s = 0; genWorld = SONGS[songIdx].world === 'night' ? 'night' : (params.get('biome') || 'green'); setWorld(genWorld, true); clearFriends();
  speed = 13; lane = 0; lat = 0; py = 0; vy = 0; sliding = false; slideT = 0; turnQ = null; stumbleT = 0; gap = 1; score = 0; picks = 0; dist = 0; magnet = 0; sunT = 0; letterIdx = 0; mult = 1; deadT = 0; fallY = 0;
  for (let i = 0; i < 4; i++) addSeg(i === 0);
  segI = 0; seg = segs[0]; camYaw = yawOf(seg.dir);
  if (player) scene.remove(player.holder);
  player = makeGirl(sel); scene.add(player.holder); player.holder.add(shield);
  playAct(player, 'run', 0, 1.15);
  buildLetters(); $('hudFace').src = `assets/f${sel + 1}.jpg`; $('hudName').textContent = BAND[sel].name; $('itemName').textContent = BAND[sel].item;
  songs.forEach(a => a.volume = .8); downT = 0;
}
function startRun() {
  ac(); newRun(); state = 'run'; showUI('hud'); playSong(songIdx, 0);
  hint(MOBILE ? 'sağa/sola kaydır: şerit · yukarı: zıpla · aşağı: kay · köşelerde dön' : '← →  şerit · ↑ zıpla · ↓ kay · köşelerde dön', 4); showMsg('KOŞ!', 1.2);
}
function gameOver(reason) { // she falls; the band comes back for her
  if (state !== 'run') return;
  state = 'down'; downT = 0; downReason = reason; downReasonShown = false; noise(.5, .3, 900); sfx(80, .5, 'sawtooth', .1, -30);
  songs[songIdx].volume = .35;
  sliding = false; vy = 0;
  playAct(player, 'fall', .12, 1.15);
  for (const o of seg.objs) if (o.mesh && o.s > s - 4 && o.s < s + 6) o.mesh.visible = false; // clear the stage for the band
  const sc = Math.floor(score); const nb = sc > best; if (nb) { best = sc; localStorage.setItem('od3_best', best); }
  $('overScore').textContent = sc; $('overPicks').textContent = picks; $('overDist').textContent = Math.floor(dist); $('overBest').textContent = best;
  $('newBest').classList.toggle('hide', !nb); $('overFace').src = `assets/f${sel + 1}.jpg`;
  $('overLine').textContent = `${BAND[sel].name} düştü ama yalnız değil.`; $('overItem').textContent = BAND[sel].item;
  $('hint').style.opacity = 0;
}
function clearFriends() { for (const f of friends) scene.remove(f.holder); friends = []; }
function spawnFriends() {
  clearFriends();
  const others = [...Array(NGIRLS).keys()].filter(i => i !== sel);
  // fallen girl lies face down along the road; helpers kneel at her sides, the others stand close
  const spots = [[.55, -.95, 'help'], [.55, .95, 'help'], [-1.3, -1.25, 'help2'], [-1.3, 1.25, 'help2']];
  others.forEach((gi, k) => {
    const f = makeGirl(gi); scene.add(f.holder);
    const [fs, fl, role] = spots[k];
    const start = segPoint(seg, s - 11 - k * 1.6, (k % 2 ? 1 : -1) * rand(.6, 1.6));
    const target = segPoint(seg, s + fs, lat + fl);
    f.holder.position.copy(start); f.holder.rotation.y = yawOf(seg.dir);
    f.target = target; f.role = role; f.arrived = false; f.delay = k * .18;
    playAct(f, 'run', 0, 1.1); friends.push(f);
  });
}
function showUI(which) {
  $('hud').classList.toggle('hide', which !== 'hud'); $('menu').classList.toggle('hide', which !== 'menu');
  $('over').classList.toggle('hide', which !== 'over'); $('pause').classList.toggle('hide', which !== 'pause');
}
let msgTimer = 0;
function showMsg(t, d = 1.4) { const m = $('msg'); m.textContent = t; m.classList.add('show'); msgTimer = d; }
let hintTimer = 0;
function hint(t, d) { $('hint').textContent = t; $('hint').style.opacity = 1; hintTimer = d; }
function buildLetters() { const w = [...SONGS[songIdx].word]; $('letters').innerHTML = w.map((c, i) => `<span class="${i < letterIdx ? 'on' : ''}">${c}</span>`).join(''); }
function flash(col = '#fff', a = .6) { const f = $('flash'); f.style.background = col; f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); }

// ------------------------------------------------------------------ input
function act(a) {
  if (state === 'menu') { if (a === 'left') selGirl(sel - 1); if (a === 'right') selGirl(sel + 1); if (a === 'go') startRun(); return; }
  if (state !== 'run') return;
  if (a === 'left' || a === 'right') {
    const want = a === 'left' ? 'L' : 'R';
    if (!turnQ && s > seg.len - TURN_WIN && s < seg.len + 3 && want === seg.turn) { turnQ = want; sfx(700, .07, 'triangle', .05, 300); return; }
    const nl = clamp(lane + (a === 'left' ? -1 : 1), -1, 1); if (nl !== lane) { lane = nl; sfx(520, .05, 'triangle', .04); }
  }
  if (a === 'up' && py <= .001) { vy = JUMP_V; sliding = false; sfx(380, .14, 'square', .04, 420); playAct(player, 'jump', .06, .3); }
  if (a === 'down') { if (py > .05) vy = -22; sliding = true; slideT = .8; sfx(260, .12, 'triangle', .05, -140); if (player.actions.slide) { playAct(player, 'slide', .08, 1.7); player.actions.slide.time = .15; } }
}
addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') act('left');
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') act('right');
  else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { state === 'run' ? act('up') : state === 'menu' && act('go'); }
  else if (k === 'ArrowDown' || k === 's' || k === 'S') act('down');
  else if (k === 'Enter') { if (state === 'menu') act('go'); else if (state === 'over' && downT > 7.6) startRun(); }
  else if (k === 'm' || k === 'M') setMuted(!muted);
  else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
  if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
});
let touch = null;
addEventListener('pointerdown', e => { ac(); touch = { x: e.clientX, y: e.clientY, used: false }; });
addEventListener('pointermove', e => { if (!touch || touch.used) return; const dx = e.clientX - touch.x, dy = e.clientY - touch.y; if (Math.hypot(dx, dy) > 28) { touch.used = true; if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right'); else act(dy < 0 ? 'up' : 'down'); } });
addEventListener('pointerup', () => touch = null);
addEventListener('pointercancel', () => touch = null);
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'run') togglePause(); });
function togglePause() {
  if (state === 'run') { state = 'pause'; songs[songIdx].pause(); showUI('pause'); }
  else if (state === 'pause') { state = 'run'; songs[songIdx].play().catch(() => { }); showUI('hud'); clock.getDelta(); }
}
$('pauseBtn').onclick = e => { e.stopPropagation(); togglePause(); };
$('resumeBtn').onclick = togglePause;
$('quitBtn').onclick = () => { songs.forEach(a => a.pause()); toMenu(); };
$('goBtn').onclick = () => startRun();
$('againBtn').onclick = () => startRun();
$('menuBtn').onclick = () => toMenu();
$('prevBtn').onclick = () => selGirl(sel - 1);
$('nextBtn').onclick = () => selGirl(sel + 1);
$('bandBtn').onclick = () => $('band').classList.remove('hide');
$('howBtn').onclick = () => $('how').classList.remove('hide');
$('muteBtn').onclick = () => setMuted(!muted);
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.panel').classList.add('hide'));
$('faces').innerHTML = [...Array(NGIRLS)].map((_, i) => `<button data-i="${i}" title="${BAND[i].name}"><img src="assets/f${i + 1}.jpg" alt="${BAND[i].name}"></button>`).join('');
$('faces').querySelectorAll('button').forEach(b => b.onclick = () => selGirl(+b.dataset.i));

// ------------------------------------------------------------------ menu scene: the whole band together
const menuStage = new THREE.Group(); scene.add(menuStage);
function toMenu() {
  state = 'menu'; showUI('menu'); clearTrack(); clearFriends(); if (player) { scene.remove(player.holder); player = null; }
  songs.forEach(a => { a.pause(); a.volume = .8; });
  genWorld = 'beach'; setWorld('beach', true);
  menuStage.clear(); menuStage.visible = true;
  const sm = M2.sand.clone(); sm.map = T.sand.clone(); sm.map.needsUpdate = true; sm.map.repeat.set(10, 10); const sand = new THREE.Mesh(new THREE.CircleGeometry(30, 48), sm); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; menuStage.add(sand);
  for (const x of [-3.2, 3.2]) { const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, .7), [M.ampSide, M.ampSide, M.ampSide, M.ampSide, M.amp, M.ampSide]); a.position.set(x, .65, -2.6); a.rotation.y = -x * .12; a.castShadow = true; menuStage.add(a); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(.55, .75, 40), new THREE.MeshBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: .8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .02; ring.name = 'ring'; menuStage.add(ring);
  menuGirls = [...Array(NGIRLS).keys()].map(i => { const g = makeGirl(i); menuStage.add(g.holder); playAct(g, 'idle', 0, 1); if (g.actions.idle) g.actions.idle.time = i * .7; g.holder.rotation.y = Math.PI; return g; });
  selGirl(sel, true);
  $('bestTxt').textContent = best ? `REKOR ${best}` : '';
}
function menuSlot(i) { // selected girl front & centre, the others in a row behind her
  if (i === sel) return [0, .9];
  const order = [...Array(NGIRLS).keys()].filter(k => k !== sel); const k = order.indexOf(i);
  return [(k - 1.5) * 1.05, -.9 - Math.abs(k - 1.5) * .15];
}
function selGirl(i, instant) {
  sel = (i + NGIRLS) % NGIRLS; localStorage.setItem('od3_sel', sel);
  $('faces').querySelectorAll('button').forEach((b, k) => b.classList.toggle('sel', k === sel));
  $('who').innerHTML = `${BAND[sel].name}<small>${BAND[sel].role} · ${BAND[sel].item} toplar</small>`;
  menuGirls.forEach((g, k) => { const [x, z] = menuSlot(k); g.slot = new THREE.Vector3(x, 0, z); if (instant) g.holder.position.copy(g.slot); });
  if (menuGirls[sel]?.actions.cheer && !instant) { playAct(menuGirls[sel], 'cheer', .2, 1); menuGirls[sel].cheerT = 1.9; }
  if (!instant) sfx(660, .05, 'triangle', .04);
}

// ------------------------------------------------------------------ update
function update(dt, t) {
  if (msgTimer > 0 && (msgTimer -= dt) <= 0) $('msg').classList.remove('show');
  if (hintTimer > 0 && (hintTimer -= dt) <= 0) $('hint').style.opacity = 0;
  skyU.time.value = t; crowdTime.value = t; seaTex.offset.x = t * .01; seaTex.offset.y = t * .006; M2.water.normalMap.offset.set(t * .02, t * .012); M2.foam.opacity = .4 + Math.sin(t * 1.3) * .2;
  if (worldFade) { worldFade.t += dt / 2.5; look.cur = worldFade.from; applyWorld(worldFade.to, Math.min(1, worldFade.t)); if (worldFade.t >= 1) { look.cur = WORLDS[worldFade.to]; worldFade = null; } }

  if (state === 'menu') {
    const portrait = camera.aspect < .8;
    for (const g of menuGirls) {
      g.mixer?.update(dt);
      if (g.slot) g.holder.position.lerp(g.slot, Math.min(1, dt * 6));
      g.holder.rotation.y = Math.PI + (g === menuGirls[sel] ? Math.sin(t * .5) * .25 : Math.sin(t * .4 + g.holder.position.x) * .15);
      if (g.cheerT > 0 && (g.cheerT -= dt) <= 0) playAct(g, 'idle', .3, 1);
    }
    const ring = menuStage.getObjectByName('ring'); if (ring && menuGirls[sel]) { ring.position.x = menuGirls[sel].holder.position.x; ring.position.z = menuGirls[sel].holder.position.z; ring.material.opacity = .55 + Math.sin(t * 4) * .25; }
    camera.position.set(0, 1.35, camera.aspect < .55 ? 5.9 : portrait ? 4.9 : 4.0); camera.lookAt(0, .95, -.2);
    sun.position.set(-3, 7, -8); sun.target.position.set(0, 0, 0);
    fill.position.set(0, 3, 6); fill.target.position.set(0, 1, 0);
    sea.position.set(0, -.45, 0); sky.position.copy(camera.position); chaser.visible = false;
    return;
  }
  menuStage.visible = false; chaser.visible = true;
  if (state === 'pause') return;

  const running = state === 'run';
  if (running) {
    speed = Math.min(30, speed + dt * .2);
    const dz = speed * dt; s += dz; dist += dz;
    // chorus multiplier
    const ct = songs[songIdx].currentTime; const inCh = SONGS[songIdx].chorus.some(([a, b]) => ct >= a && ct < b);
    if (inCh !== (mult === 2)) { mult = inCh ? 2 : 1; $('mult').classList.toggle('hide', mult === 1); if (inCh) { showMsg('NAKARAT x2', 1.2); flash('#ffcf4a', .25); } }
    score += dz * mult;
    // corner
    if (s >= seg.len) {
      if (turnQ) {
        const old = seg, oldLat = lat, over = s - old.len;
        segI++; seg = segs[segI];
        s = turnQ === 'R' ? oldLat : -oldLat; lat = 0; lane = 0; turnQ = null;
        while (segs.length - segI < 4) addSeg();
        if (segI > 1) { const dead = segs.shift(); root.remove(dead.group); disposeGroup(dead.group); segI--; }
        if (!seg.from && seg.world !== curWorld) setWorld(seg.world);
        s += 0 * over;
      } else if (s > seg.len + ROAD_W / 2 - .2) { s = seg.len + ROAD_W / 2 - .2; gameOver('Köşeyi dönemedin, duvara çarptın.'); }
    }
    if (seg.from) { const k = clamp((s - (seg.mid - 30)) / 60, 0, 1); worldFade = null; look.cur = WORLDS[seg.from]; applyWorld(seg.world, k * k * (3 - 2 * k)); if (k > .5 && farWorld !== seg.world) buildFar(seg.world); curWorld = k >= 1 ? seg.world : seg.from; if (k >= 1) look.cur = WORLDS[seg.world]; }
    // lateral + vertical
    lat += (lane * LANE - lat) * Math.min(1, dt * 13);
    vy -= GRAV * dt; py += vy * dt; if (py < 0) { py = 0; vy = 0; }
    const ja = player.actions.jump; if (ja && player.cur === ja) { if (py === 0) { ja.timeScale = 1.5; if (ja.time < .14) ja.time = .14; if (ja.time > .62) playAct(player, 'run', .18, 1.15); } }
    if (sliding) { slideT -= dt; if (slideT <= 0) { sliding = false; playAct(player, 'run', .15, 1.15); } }
    player.actions.run && (player.actions.run.timeScale = .95 + speed / 45);
    // timers
    if (stumbleT > 0) stumbleT -= dt; else gap = Math.min(1, gap + dt * .07);
    if (magnet > 0) magnet -= dt;
    if (sunT > 0) { sunT -= dt; gap = Math.min(1, gap + dt * .6); }
    // collisions
    collide(dt);
  } else if (state === 'down' || state === 'over') {
    downT += dt;
    const k = Math.max(0, 1 - downT / .45); s += speed * k * k * dt * .6; // short skid
    py = Math.max(0, py - dt * 6);
    gap = downT < 2.2 ? Math.max(.05, gap - dt * 1.2) : Math.min(2.5, gap + dt * 1.4);
    if (downT > 1.5 && player.cur === player.actions.fall) playAct(player, 'reach', .5, 1);
    if (downT > .35 && !friends.length) { spawnFriends(); showMsg(upTR(BAND[sel].name) + ' DÜŞTÜ…', 1.4); }
    if (downT > 2.3 && !downReasonShown) { downReasonShown = true; showMsg('OD BAND GELDİ!', 1.8); sfx(523, .25, 'triangle', .06); setTimeout(() => sfx(659, .25, 'triangle', .06), 140); setTimeout(() => sfx(784, .4, 'triangle', .06), 280); }
    if (downT > 3.0 && player.cur === player.actions.reach) { playAct(player, 'standup', .35, 2.4); }
    if (downT > 5.6 && player.cur !== player.actions.cheer) { playAct(player, 'cheer', .4, 1); showMsg('BURDAYIM!', 2); flash('#ffcf4a', .3); songs[songIdx].volume = .8; }
    for (const f of friends) {
      f.mixer?.update(dt);
      if (downT < .35 + f.delay) continue;
      if (!f.arrived) {
        const to = tmp2.copy(f.target).sub(f.holder.position); to.y = 0; const d = to.length();
        if (d < .15) { f.arrived = true; f.arriveT = downT; playAct(f, 'help', .3, f.role === 'help' ? 1.25 : 1.1); if (f.actions.help) f.actions.help.time = f.role === 'help' ? 1.2 : .6; }
        else { to.normalize(); f.holder.position.addScaledVector(to, Math.min(d, 7 * dt)); f.holder.rotation.y = angLerp(f.holder.rotation.y, Math.atan2(-to.x, -to.z), Math.min(1, dt * 10)); }
      } else {
        const p = player.holder.position; const face = Math.atan2(-(p.x - f.holder.position.x), -(p.z - f.holder.position.z));
        if (downT < 5.6) f.holder.rotation.y = angLerp(f.holder.rotation.y, face, Math.min(1, dt * 6));
        else { if (f.cur !== f.actions.cheer) playAct(f, 'cheer', .4, rand(.9, 1.1)); const toCam = Math.atan2(-(camera.position.x - f.holder.position.x), -(camera.position.z - f.holder.position.z)) + Math.PI; f.holder.rotation.y = angLerp(f.holder.rotation.y, toCam + Math.PI, Math.min(1, dt * 3)); }
      }
    }
    if (downT > 5.6) { const toCam = Math.atan2(-(camera.position.x - player.holder.position.x), -(camera.position.z - player.holder.position.z)); player.holder.rotation.y = angLerp(player.holder.rotation.y, toCam, Math.min(1, dt * 3)); }
    if (downT > 7.6 && state === 'down') { state = 'over'; showUI('over'); }
  }
  // place player
  segPoint(seg, s, lat, tmp); player.holder.position.set(tmp.x, py, tmp.z);
  const targetYaw = yawOf(seg.dir);
  if (state === 'run' || downT < 5.6) player.holder.rotation.y = angLerp(player.holder.rotation.y, targetYaw, Math.min(1, dt * 14));
  // lean while changing lanes
  player.inner.rotation.z = state === 'run' ? clamp((lat - lane * LANE) * .12, -.25, .25) : 0;
  if (!player.actions.slide) { // procedural slide pose
    const k = sliding && py < .3 ? 1 : 0; player.inner.rotation.x = state === 'run' ? lerp(player.inner.rotation.x, -k * 1.15, Math.min(1, dt * 16)) : player.inner.rotation.x; player.inner.position.y = lerp(player.inner.position.y, k * .25, Math.min(1, dt * 16));
  }
  if (!player.actions.jump && py > 0) player.inner.rotation.x = -.15;
  player.mixer?.update(dt);
  shield.visible = sunT > 0; shield.position.y = .9; shield.material.opacity = .18 + Math.sin(t * 10) * .06;
  // blink when stumbled
  player.holder.visible = !(state === 'run' && stumbleT > 2.6 && Math.floor(t * 14) % 2 === 0);

  // camera follow
  camYaw = angLerp(camYaw, targetYaw, Math.min(1, dt * 5));
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const portrait = camera.aspect < .8, camBack = portrait ? 5.6 : 6.4, camUp = portrait ? 3.3 : 3.4;
  if (state === 'run' || state === 'pause') {
    camPos.set(player.holder.position.x - fx * camBack, camUp + py * .35, player.holder.position.z - fz * camBack);
    camera.position.lerp(camPos, Math.min(1, dt * 10));
    camLook.set(player.holder.position.x + fx * 6, 1.1 + py * .3, player.holder.position.z + fz * 6);
  } else { // swing round to the front of the group
    const a = Math.min(1, Math.max(0, (downT - .6) / 4.5)); const ang = camYaw + Math.PI * .85 * (a * a * (3 - 2 * a)) + .25;
    const dist = lerp(camBack, 5.8, a), hgt = lerp(camUp, 2.1, a);
    camPos.set(player.holder.position.x - Math.sin(ang) * -dist * -1 + Math.sin(camYaw) * 0, hgt, 0);
    camPos.x = player.holder.position.x + Math.sin(ang) * dist; camPos.z = player.holder.position.z + Math.cos(ang) * dist;
    camera.position.lerp(camPos, Math.min(1, dt * 4));
    camLook.set(player.holder.position.x + fx * .3, .7, player.holder.position.z + fz * .3);
    if (downT < .3) camera.position.add(tmp2.set(rand(-.08, .08), rand(-.08, .08), 0));
  }
  camera.lookAt(camLook);
  sky.position.copy(camera.position);
  sea.position.set(Math.round(camera.position.x / 40) * 40, -.45, Math.round(camera.position.z / 40) * 40);
  sun.position.copy(player.holder.position).add(SUN_OFF); sun.target.position.copy(player.holder.position);
  fill.position.copy(camera.position).add(tmp2.set(0, 2, 0)); fill.target.position.copy(player.holder.position);
  skyU.sunDir.value.set(SUN_OFF.x, 5, SUN_OFF.z).normalize();

  // chaser
  const cd = 1.25 + Math.max(0, gap) * 1.2; // meters behind — always in view
  const cs = s - cd; segPoint(seg, cs, lat * .85, tmp);
  chaser.position.lerp(tmp.setY(-.3 * clamp(gap, 0, 1) - .05 + (state !== 'run' && downT < 2.2 ? Math.min(.35, downT * .5) : 0)), Math.min(1, dt * 8));
  const fade = state === 'run' ? 1 : clamp(1 - (downT - 2.2) / 1.4, 0, 1); chaser.visible = fade > .01; chaser.scale.setScalar(.52 * (.4 + .6 * fade));
  chaser.rotation.y = player.holder.rotation.y;
  const close = 1 - clamp(gap, 0, 1);
  for (const sp of smoke) { const u = sp.userData; u.h += dt * u.sp * .5; if (u.h > 1) { u.h = 0; u.a = Math.random() * 6.28; u.r = Math.random(); }
    const rr = (.4 + u.r * 1.0) * (1 + u.h * .6); sp.position.set(Math.cos(u.a + t) * rr, .2 + u.h * 2.8, Math.sin(u.a + t) * rr * .7 + u.h * 1.5);
    sp.scale.setScalar(.7 + u.h * 1.4); sp.material.opacity = (1 - u.h) * .8 * fade; }
  cBody.scale.set(.75 + Math.sin(t * 6) * .04, 1.1 + Math.sin(t * 5) * .06, .7);
  for (const a of arms) { a.rotation.x = -1.1 - close * .7 + Math.sin(t * 9 + a.userData.side) * .25; a.rotation.z = -a.userData.side * (.35 - close * .2); }
  const blink = Math.sin(t * 3.1) > .985 ? .1 : 1; eyes.forEach(e => e.scale.y = .06 * blink);
  chaserLight.intensity = 2 + close * 6;
  $('vign').style.opacity = clamp(close * 1.1 - .1, 0, .9) * fade;
  if (state === 'run' && close > .45) { hbT -= dt; if (hbT <= 0) { hbT = lerp(.75, .42, close); sfx(62, .16, 'sine', .22 * close, -20); setTimeout(() => sfx(55, .14, 'sine', .16 * close, -15), 150); } }
  $('chaseBar').style.width = (8 + close * 92) + '%';
  $('hudFace').classList.toggle('danger', stumbleT > 0);

  // animate world objects
  for (const sg of segs) for (const o of sg.objs) {
    const m = o.mesh; if (!m || !m.parent) continue;
    if (o.t === 'coin') m.rotation.y += dt * 4;
    else if (o.t === 'sun' || o.t === 'mic') { m.rotation.y += dt * 2; m.position.y = o.y + Math.sin(t * 3 + o.s) * .15; }
    else if (o.t === 'letter') m.position.y = o.y + Math.sin(t * 3 + o.s) * .12;
    else if (o.beam) { const u = m.userData; m.rotation.z = Math.sin(t * u.sp + u.ph) * .7; m.rotation.x = .35 + Math.sin(t * u.sp * .7 + u.ph) * .35; }
    else if (o.t === 'deco') m.position.y += Math.sin(t * 1.5 + m.userData.float) * .004;
    else if (o.t === 'low' && m.userData.shake) m.rotation.z = Math.sin(t * 40) * .04;
    else if (o.t === 'high' && m.userData.ball) m.userData.ball.position.y = 2.7 + Math.abs(Math.sin(t * 2.2 + o.s)) * .9;
    else if (o.t === 'high' && m.userData.sheet) { const sh = m.userData.sheet, p = sh.geometry.attributes.position, b = sh.userData.base;
      for (let i = 0; i < p.count; i++) { const y = b[i * 3 + 1]; p.array[i * 3 + 2] = Math.sin(t * 4 + b[i * 3] * 2 + y * 3) * .12 * (-y); } p.needsUpdate = true; }
  }
  updateHUD();
}
function angLerp(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }

function collide(dt) {
  for (const o of seg.objs) {
    if (o.done || o.t === 'deco') continue;
    const ds = o.s - s;
    if (o.t === 'coin' || o.t === 'letter' || o.t === 'sun' || o.t === 'mic') {
      if (magnet > 0 && o.t === 'coin' && ds < 16 && ds > -1) { // pull toward player
        o.mesh.position.x = lerp(o.mesh.position.x, lat, Math.min(1, dt * 9)); o.mesh.position.y = lerp(o.mesh.position.y, py + 1, Math.min(1, dt * 9)); o.s = lerp(o.s, s, Math.min(1, dt * 6)); o.mesh.position.z = -o.s; o.lane = o.mesh.position.x / LANE;
      }
      const ox = o.mesh.position.x, oy = o.mesh.position.y;
      if (Math.abs(o.s - s) < 1 && Math.abs(ox - lat) < 1.1 && Math.abs(oy - (py + .9)) < 1.5) collect(o);
      continue;
    }
    if (Math.abs(ds) > .55) continue;
    const dx = Math.abs(o.lane * LANE - lat); if (dx > 1.25) continue;
    let ok = false;
    if (o.t === 'low') ok = py > .85;
    if (o.t === 'high') ok = sliding && py < .5;
    if (ok) continue;
    o.done = true;
    if (sunT > 0) { smash(o); continue; }
    if (dx > .7) stumble(o); else gameOver({ low: 'Engele takılıp düştün.', high: 'Çarpıp düştün.', block: 'Kasalara çarpıp düştün.' }[o.t] || 'Düştün.');
  }
}
function collect(o) {
  o.done = true; o.mesh.parent?.remove(o.mesh);
  if (o.t === 'coin') { picks++; score += 10 * mult; sfx(1250 + (picks % 6) * 70, .06, 'square', .03); }
  else if (o.t === 'sun') { sunT = 6; gap = 1; flash('#ffd36b', .55); showMsg('BİR GÜNEŞ DOĞAR…', 1.8); sfx(523, .4, 'sine', .08, 520); setTimeout(() => sfx(784, .5, 'sine', .07, 300), 120); }
  else if (o.t === 'mic') { magnet = 9; showMsg('MİKROFON!', 1.2); sfx(880, .35, 'sawtooth', .04, 700); }
  else if (o.t === 'letter') {
    const word = [...SONGS[songIdx].word];
    if (o.ch === word[letterIdx]) { letterIdx++; sfx(990, .12, 'triangle', .06, 200); if (letterIdx >= word.length) { score += 1000; showMsg(SONGS[songIdx].title.toUpperCase() + ' +1000', 2); flash('#ffcf4a', .4); letterIdx = 0; } buildLetters(); }
  }
}
function smash(o) { o.mesh.parent?.remove(o.mesh); noise(.2, .2, 3000); score += 25; }
function stumble(o) {
  if (stumbleT > 0) { gameOver('İki kez tökezleyip düştün.'); return; }
  stumbleT = 4.5; gap = .2; noise(.25, .25, 1200); sfx(90, .3, 'sawtooth', .08, -40); showMsg('ANKSİYETE YAKLAŞIYOR!', 1.4);
  lane = clamp(Math.round(lat / LANE) + (lat > o.lane * LANE ? 1 : -1) * 0, -1, 1);
}
let lastHud = 0;
function updateHUD() {
  const sc = Math.floor(score); if (sc !== lastHud) { $('score').textContent = sc; lastHud = sc; }
  $('picks').textContent = picks;
  let p = ''; if (sunT > 0) p += `<div>☀️ Güneş ${Math.ceil(sunT)}</div>`; if (magnet > 0) p += `<div>🎤 Mikrofon ${Math.ceil(magnet)}</div>`;
  if ($('power').innerHTML !== p) $('power').innerHTML = p;
}

// ------------------------------------------------------------------ main loop
function frame() {
  const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
  if (state !== 'loading') update(dt, t);
  composer.render();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ boot
(async () => {
  setWorld('beach', true);
  requestAnimationFrame(frame);
  await document.fonts.ready;
  await loadGirls(p => { $('lbar').style.width = (p * 100) + '%'; $('ltxt').textContent = `karakterler yükleniyor… ${Math.round(p * 100)}%`; });
  // fonts may have arrived after textures were drawn: redraw text textures
  $('loading').classList.add('hide');
  if (params.has('sel')) sel = +params.get('sel');
  toMenu();
  if (params.has('run')) { if (params.get('run')) sel = +params.get('run'); startRun(); if (params.has('sim')) { const n = +params.get('sim'); for (let i = 0; i < n && state === 'run'; i++) { if (params.has('auto')) autopilot(); if (i === n - 12 && params.has('jump')) act('up'); if (i === n - 20 && params.has('slide')) act('down'); update(1 / 60, i / 60); } if (params.has('down')) { gameOver('Test'); for (let i = 0; i < +params.get('down'); i++) update(1 / 60, i / 60); } const d = document.createElement('div'); d.style.cssText = 'position:fixed;top:120px;left:10px;font:14px monospace;background:#000a;padding:6px;z-index:99'; d.textContent = `state=${state} segI=${segI} s=${s.toFixed(1)} len=${seg.len} turn=${seg.turn} turnQ=${turnQ} lane=${lane} lat=${lat.toFixed(2)} dist=${dist.toFixed(0)} reason=${$('overLine').textContent}`; document.body.appendChild(d); } }
})();

function autopilot() {
  if (s > seg.len - 6 && !turnQ) act(seg.turn === 'L' ? 'left' : 'right');
  for (const o of seg.objs) { if (o.done || !['low', 'high', 'block'].includes(o.t)) continue; const ds = o.s - s; if (ds < 0 || ds > 9 || o.lane !== lane) continue;
    if (o.t === 'low' && ds < 4.5 && py === 0) act('up'); else if (o.t === 'high' && ds < 4 && !sliding) act('down');
    else if (o.t === 'block') { const free = [-1, 0, 1].filter(l => l !== lane && !seg.objs.some(q => !q.done && q.lane === l && Math.abs(q.s - o.s) < 3 && q.t === 'block')); if (free.length) act(free[0] < lane ? 'left' : 'right'); } }
}
// debug hook for automated screenshots
window.__od = { act, get state() { return state; }, step(n) { for (let i = 0; i < n; i++) update(1 / 60, clock.elapsedTime + i / 60); } };
