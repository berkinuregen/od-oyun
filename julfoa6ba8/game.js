// OD Band — Burdayım  (three.js endless runner)
import * as THREE from 'three';
let baseFov = 62, fovKick = 0;
const BEND = new URLSearchParams(location.hash.slice(1)).has('flat') ? 0 : .00085, BEND_MAX = 120;
if (BEND) {
  const bendGLSL = `if (projectionMatrix[2][3] != 0.0) { float bz = clamp(-mvPosition.z, 0.0, ${BEND_MAX.toFixed(1)}); mvPosition.y -= ${BEND} * bz * bz; }\n  gl_Position = projectionMatrix * mvPosition;`;
  THREE.ShaderChunk.project_vertex = THREE.ShaderChunk.project_vertex.replace('gl_Position = projectionMatrix * mvPosition;', bendGLSL);
  THREE.ShaderLib.sprite.vertexShader = THREE.ShaderLib.sprite.vertexShader.replace('gl_Position = projectionMatrix * mvPosition;', bendGLSL);
}
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const params = new URLSearchParams(location.hash.slice(1));
const tut = { done: localStorage.getItem('od3_tut') === '1' };
const buzz = ms => { try { navigator.vibrate?.(ms); } catch (e) { } };
let fakeT = 0; // debug: simulated song clock when audio can't play (#fake)
function songTime() { return params.has('fake') ? fakeT : (songs[songIdx]?.currentTime || 0); }
const MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]); // never let a slow asset block the game
try { await withTimeout(Promise.all([document.fonts.load('64px Anton'), document.fonts.load('24px Manrope')]), 3000); } catch (e) { }
// OD Band logos from the press kit (assets/logo_*.png)
const LOGO = {};
await withTimeout(Promise.all(['red', 'pink', 'neon', 'black'].map(k => new Promise(res => { const im = new Image(); im.onload = () => { LOGO[k] = im; res(); }; im.onerror = () => res(); im.src = `assets/logo_${k}.png`; }))), 4000);
await withTimeout(Promise.all([document.fonts.load('62px Anton'), document.fonts.load('120px Anton')]).catch(() => { }), 3000); // canvas text must not fall back to a wider font
function drawLogo(g, k, cx, cy, maxW, maxH) { const im = LOGO[k]; if (!im) return false; const sc = Math.min(maxW / im.width, maxH / im.height); g.drawImage(im, cx - im.width * sc / 2, cy - im.height * sc / 2, im.width * sc, im.height * sc); return true; }

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
];
const WORLDS = {
  green: { fog: 0xd6e2cf, fogNear: 50, fogFar: 240, skyTop: 0x3a6fc0, skyMid: 0x9cc4e4, skyBot: 0xf6e7c4, sun: 0xfff0d2, sunI: 2.9, hemiSky: 0xdcefff, hemiGround: 0x56703a, hemiI: 1.15, sea: 0x5f8a3e, bloom: .35, stars: 0, fill: .45, spec: 0x000000 },
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
import('three/addons/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => { const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); for (const m of [M.pick, M.stick, M.metal, GM?.chrome, GM?.cymbal].filter(Boolean)) { m.envMap = env; m.envMapIntensity = .8; m.needsUpdate = true; } /* reflections only on metals/picks: a scene-wide env map washed everything out */ }).catch(() => { });
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 1200);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: MOBILE ? 0 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .55, .45, 1.15);
// guard: a single NaN/Inf pixel (bad normal, 0/0 in a shader) gets smeared by the bloom blur into big flickering black squares
const nanGuard = new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(min(c.rgb, vec3(64.0)), c.a); }' });
if (!location.hash.includes('noguard')) composer.addPass(nanGuard);
composer.addPass(bloom); if (location.hash.includes('nobloom')) bloom.enabled = false;
composer.addPass(new OutputPass());
const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, con: { value: 1.05 }, vig: { value: .22 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con, vig; varying vec2 vUv;
  void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(.299,.587,.114)); c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = (c.rgb - .5) * con + .5;
    vec2 d = vUv - .5; c.rgb *= 1.0 - vig * smoothstep(.35, .85, length(d * vec2(1.0, 1.2))); gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a); }` });
composer.addPass(grade);
const fxaa = new ShaderPass(FXAAShader); fxaa.enabled = MOBILE; composer.addPass(fxaa);

function resize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = baseFov = camera.aspect < .8 ? 70 : 58;
  if (typeof fxaa !== 'undefined') { const pr = renderer.getPixelRatio(); fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr)); }
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
const skyU = { cl1: { value: new THREE.Color(0xffffff) }, cl2: { value: new THREE.Color(0xb8c8dc) }, clA: { value: .5 }, top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(.3, .05, -1).normalize() }, sunCol: { value: new THREE.Color(0xfff0c8) }, stars: { value: 0 }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top,mid,bot,sunDir,sunCol,cl1,cl2; uniform float stars,time,clA; varying vec3 vP;
    float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
    float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n2(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return v;}
    void main(){ float y=vP.y; vec3 c = y>0.18 ? mix(mid,top,smoothstep(.18,.75,y)) : mix(bot,mid,smoothstep(-.02,.18,y));
      float d=max(dot(vP,sunDir),0.); c += sunCol*(pow(d,900.)*3.0 + pow(d,24.)*.35 + pow(d,4.)*.12)*(1.-stars*.7);
      if(stars>0.){ vec3 q=floor(vP*260.); float s=step(.9975,h(q)); c+=vec3(s)*stars*smoothstep(0.05,.3,y)*(.6+.4*sin(time*3.+h(q)*40.)); }
      if(clA>0.01 && y>0.015){ vec2 uv=vP.xz/(y+.09)*.9 + vec2(time*.006,time*.002);
        float d=fbm(uv*1.3); d=smoothstep(1.-clA, 1.-clA+.28, d);
        float edge=fbm(uv*1.3+vec2(.06,.04)); float lit=clamp((d-smoothstep(1.-clA,1.-clA+.28,edge))*3.+.5,0.,1.);
        float sunGlow=pow(max(dot(vP,sunDir),0.),6.);
        vec3 cc=mix(cl2,cl1,lit)+sunCol*sunGlow*.35;
        float fade=smoothstep(.015,.14,y)*(1.-smoothstep(.7,.98,y)*.6);
        c=mix(c,cc,d*fade*.92); }
      gl_FragColor=vec4(c,1.); }`
}));
sky.renderOrder = -1; scene.add(sky);

// clouds: a ring of soft billboard sprites around the camera
const cloudTex = canvasTex(256, 128, (g, w, h) => { for (let i = 0; i < 14; i++) { const x = rand(40, w - 40), y = rand(50, 90), r = rand(22, 46); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
const clouds = new THREE.Group(); scene.add(clouds);
for (let i = 0; i < 18; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: .85 })); const a = i / 18 * Math.PI * 2 + rand(-.1, .1), r = rand(380, 520); sp.position.set(Math.cos(a) * r, rand(35, 95), Math.sin(a) * r); sp.scale.set(rand(170, 280), rand(60, 95), 1); sp.userData.a = a; sp.userData.r = r; clouds.add(sp); }
sky.renderOrder = -2; clouds.renderOrder = -1;
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
T.od = canvasTex(512, 160, (g, w, h) => { g.fillStyle = '#16121a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8433b'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); if (!drawLogo(g, 'red', 120, h / 2, 190, 140)) { g.fillStyle = '#fff'; g.font = '90px Anton, Impact'; g.fillText('OD', 40, 110); } g.fillStyle = '#fff'; g.font = '62px Anton, Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BURDAYIM', 355, h / 2 + 4, 280); });
T.burdayim = canvasTex(512, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff8a3d'); gr.addColorStop(1, '#ffcf4a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#2a1030'; g.font = '96px Anton, Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BURDAYIM', w / 2, h / 2 + 6); });
T.case = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#26252b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b9bdc6'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = '#b9bdc6'; for (const [x, y] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) { g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); } if (!drawLogo(g, 'red', w / 2, h * .42, 170, 140)) { g.fillStyle = '#f1f1f1'; g.font = '44px Anton, Impact'; g.textAlign = 'center'; g.fillText('OD BAND', w / 2, h * .42); } g.font = '22px Anton, Impact'; g.fillStyle = '#e8e2d6'; g.textAlign = 'center'; g.fillText('FRAGILE • TOUR 2026', w / 2, h * .86); });
T.amp = canvasTex(256, 192, (g, w, h) => { g.fillStyle = '#1a1a1d'; g.fillRect(0, 0, w, h); g.fillStyle = '#2c2c31'; g.fillRect(12, 12, w - 24, h - 24); for (let y = 16; y < h - 16; y += 6) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(14, y, w - 28, 2); } g.fillStyle = '#d8c9a0'; g.font = 'italic 28px Anton, Impact'; g.fillText('OD', 20, 40); });
T.checklist = canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8433b'; g.fillRect(0, 0, w, 56); g.fillStyle = '#fff'; g.font = '34px Anton, Impact'; g.textAlign = 'center'; g.fillText('CHECKLIST', w / 2, 40); g.textAlign = 'left'; g.font = '22px Manrope, sans-serif'; g.fillStyle = '#222';
  ['prova', 'mail at', 'uyu (?)', 'su iç', 'stüdyo', 'faturalar', 'nefes al', '...'].forEach((s, i) => { g.strokeStyle = '#222'; g.lineWidth = 3; g.strokeRect(18, 74 + i * 30, 18, 18); g.fillText(s, 46, 90 + i * 30); if (i === 0) { g.beginPath(); g.moveTo(20, 82); g.lineTo(27, 90); g.lineTo(38, 72); g.stroke(); } }); });
function tabTex(label) { return canvasTex(512, 300, (g, w, h) => { g.fillStyle = '#2a2140'; rr(g, 0, 30, w, h - 30, 18); g.fill(); g.fillStyle = '#3a2f58'; rr(g, 16, 0, 230, 54, 14); g.fill(); g.fillStyle = '#e8e2ff'; g.font = '26px Manrope, sans-serif'; g.fillText(label.tab, 40, 36); g.fillStyle = '#ff5f8a'; g.font = '30px Anton, Impact'; g.fillText('✕', 210, 38); g.fillStyle = '#fff'; g.font = '58px Anton, Impact'; g.textAlign = 'center'; g.fillText(label.big, w / 2, 170); g.font = '26px Manrope, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(label.small, w / 2, 230); }); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const TABS = [{ tab: 'od band', big: 'BURDAYIM', small: 'şimdi dinle' }, { tab: 'konser', big: 'OD BAND', small: 'bu akşam sahnede' }, { tab: 'playlist', big: 'KANADA', small: 'OD Band' }, { tab: 'playlist', big: 'EMİNÖNÜ', small: 'OD Band' }].map(tabTex);
T.notif = canvasTex(512, 128, (g, w, h) => { g.fillStyle = 'rgba(30,24,48,.95)'; rr(g, 0, 0, w, h, 30); g.fill(); g.fillStyle = '#ff3b6b'; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '46px Anton, Impact'; g.textAlign = 'center'; g.fillText('!', 64, 80); g.textAlign = 'left'; g.font = '40px Anton, Impact'; g.fillText('99+ BİLDİRİM', 120, 62); g.font = '24px Manrope, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('OD Band yeni şarkı paylaştı', 120, 98); });
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
T.logoRed = (() => { const t = new THREE.Texture(LOGO.red || document.createElement('canvas')); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; })();
T.logoPink = (() => { const t = new THREE.Texture(LOGO.pink || document.createElement('canvas')); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; })();
T.stage = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#1c1a20'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } speckle(g, w, h, 900, ['rgba(255,255,255,.04)', 'rgba(0,0,0,.3)'], [1, 3]); g.fillStyle = 'rgba(255,207,74,.5)'; g.fillRect(w / 2 - 3, 0, 6, h * .5); }, true);
T.screen = canvasTex(1024, 384, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a0f4a'); gr.addColorStop(.5, '#7a0f2c'); gr.addColorStop(1, '#c4562d'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1); if (!drawLogo(g, 'neon', w * .3, h / 2, 380, 330)) { g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '190px Anton, Impact'; g.fillText('OD BAND', w / 2, h * .56); } g.textAlign = 'center'; g.font = '120px Anton, Impact'; g.fillStyle = '#ffe3a0'; g.fillText('BURDAYIM', w * .7, h * .62, w * .55); });
T.nightGround = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#120d1c'; g.fillRect(0, 0, w, h); speckle(g, w, h, 200, ['#1b1528', '#0c0814'], [1, 3]); }, true);
T.net = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(30,30,30,.85)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, w, 14); });
T.awning = canvasTex(128, 64, (g, w, h) => { for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? '#f4efe4' : '#e8433b'; g.fillRect(x, 0, 16, h); } });
T.hut = canvasTex(128, 128, (g, w, h) => { for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? '#f4efe4' : '#3a8fc4'; g.fillRect(x, 0, 16, h); } });

// ------------------------------------------------------------------ shared geometries/materials
const M = {
  wood: new THREE.MeshStandardMaterial({ map: T.wood, roughness: .85 }),
  post: new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: .9 }),
  bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd08a).multiplyScalar(2.2), toneMapped: false }),
  asphalt: new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: .6, metalness: .1, emissiveMap: T.asphalt, emissive: 0xffffff, emissiveIntensity: .35 }),
  sheet: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .9, side: THREE.DoubleSide, map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(196,20,44,.55)'; for (let x = 6; x < w; x += 22) g.fillRect(x, 0, 5, h); g.fillStyle = 'rgba(58,143,196,.35)'; g.fillRect(0, h - 14, w, 6); }) }),
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
  boxLong: new THREE.BoxGeometry(1, 1, 1, 1, 1, 48), // long thin strips along the road (bend with the world)
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
  hay: new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#d6ad55'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.strokeStyle = pick(['#e8c46a', '#b88d3c', '#f0d488', '#a87e34']); g.lineWidth = 1; const x = rand(0, w), y = rand(0, h); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-6, 6), y + rand(-2, 2)); g.stroke(); } g.fillStyle = 'rgba(120,80,30,.5)'; g.fillRect(0, h * .3, w, 4); g.fillRect(0, h * .7, w, 4); }) }),
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
  beamGeo: (() => { const g = new THREE.ConeGeometry(1.5, 16, 18, 1, true); g.translate(0, -8, 0); g.userData.keep = true; return g; })(),
  water: new THREE.MeshPhongMaterial({ color: 0x6b4a7a, specular: 0xffd0a0, shininess: 90, normalMap: (() => { const t = seaTex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.needsUpdate = true; return t; })(), normalScale: new THREE.Vector2(.6, .6) }),
  foam: new THREE.MeshBasicMaterial({ color: 0xfff4e6, transparent: true, opacity: .55, depthWrite: false }),
};
// photo-scanned ground textures (Poly Haven, CC0), 512 px colour + normal; the canvas-painted ones stay as a fallback
const GROUND_TEX = { grass: ['grass', 1.6, 0xc4e88e], dirt: ['dirt', 2], cobble: ['cobble', 1.2], paving: ['paving', 1.3], sand: ['sand', 1.5], sandRoad: ['sandroad', 2] };
async function loadGroundTex() {
  const tl = new THREE.TextureLoader(); const ld = u => new Promise(res => tl.load(u, res, undefined, () => res(null)));
  await Promise.all(Object.entries(GROUND_TEX).map(async ([k, [f, rep, tint]]) => {
    const [c, n] = await Promise.all([ld(`assets/tex/${f}_c.jpg`), ld(`assets/tex/${f}_n.jpg`)]); if (!c) return;
    for (const t of [c, n]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; }
    c.colorSpace = THREE.SRGBColorSpace; const m = M2[k]; m.map = c; if (n) { m.normalMap = n; m.normalScale = new THREE.Vector2(.8, .8); } m.color.set(tint ?? 0xffffff); m.needsUpdate = true;
    try { for (const cl of _layerMats.values()) if (cl.userData.src === m) { cl.map = m.map; cl.normalMap = m.normalMap; cl.normalScale = m.normalScale; cl.color.copy(m.color); cl.needsUpdate = true; } } catch (e) { } // layer clones made before this finished
  }));
}
await withTimeout(loadGroundTex(), 5000);

const crowdTime = { value: 0 };
M2.crowd.onBeforeCompile = sh => { sh.uniforms.uTime = crowdTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.y += abs(sin(uTime * 6.5 + float(gl_InstanceID) * 1.37)) * 0.3;'); };
const G2 = { ico: new THREE.IcosahedronGeometry(1, 0), cone: new THREE.ConeGeometry(1, 1, 7), dodec: new THREE.DodecahedronGeometry(1, 0) };
Object.values(G2).forEach(g => g.userData.keep = true); Object.values(G).forEach(g => { if (g?.userData) g.userData.keep = true; });

// ------------------------------------------------------------------ track
let segs = [];           // {sx,sz,dir,len,turn,group,objs,world}
let genWorld = 'green';
let curWorld = 'green';
let segCount = 0;
const root = new THREE.Group(); scene.add(root);

const CORNER_R = 7;
// where the runner is drawn: on straights = segPoint; within CORNER_R of a corner = on a quarter circle (lanes merge to the middle)
function runnerPose(out) {
  let A = null, B = null, u = 0, L = lat;
  if (s > seg.len - CORNER_R && segs[segI + 1]) { A = seg; B = segs[segI + 1]; u = s - seg.len; }
  else if (s < CORNER_R && segI > 0) { A = segs[segI - 1]; B = seg; u = s; }
  if (!A || A.turn === undefined) { segPoint(seg, s, lat, out); return yawOf(seg.dir); }
  const R = CORNER_R, t = Math.min(1, Math.max(0, (u + R) / (2 * R))), th = t * Math.PI / 2, c = Math.cos(th), sn = Math.sin(th);
  const dA = DIRS[A.dir], dB = DIRS[B.dir], rA = DIRS[(A.dir + 1) % 4], rB = DIRS[(B.dir + 1) % 4];
  const cx = A.sx + dA[0] * A.len, cz = A.sz + dA[1] * A.len, sg = (B.dir === (A.dir + 1) % 4) ? 1 : -1; // +1 right turn
  const ox = cx - dA[0] * R + sg * rA[0] * R, oz = cz - dA[1] * R + sg * rA[1] * R;
  const px = ox + R * (-sg * rA[0] * c + dA[0] * sn), pz = oz + R * (-sg * rA[1] * c + dA[1] * sn);
  const k = u < 0 ? Math.max(0, 1 - t * 2) : 0; L = (u < 0 ? lat : lat) * (u < 0 ? k : 1); // lanes fade into the bend
  const rx = rA[0] * c + rB[0] * sn, rz = rA[1] * c + rB[1] * sn;
  out.set(px + rx * L, 0, pz + rz * L);
  const fx = dA[0] * c + dB[0] * sn, fz = dA[1] * c + dB[1] * sn; return Math.atan2(-fx, -fz);
}
// a quarter-ring of road on the inside of each corner so the track itself looks rounded
function cornerFillet(seg) {
  const nextDir = (seg.dir + (seg.turn === 'R' ? 1 : 3)) % 4, sg = seg.turn === 'R' ? 1 : -1, R = CORNER_R, H = ROAD_W / 2;
  const mat = { green: M2.dirt, stone: M2.cobble, beach: M2.sandRoad, concert: M2.stage, night: M2.asphalt }[seg.world]; if (!mat) return;
  // local frame of seg.group: forward = -Z, right = +X ; ring centre O = corner - fwd*R + right*sg*R
  const g = new THREE.RingGeometry(Math.max(.01, R - H - .2), R + H + .2, 28, 2, 0, Math.PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv, tile = { green: ROAD_W, stone: 3, beach: ROAD_W, concert: 4, night: ROAD_W }[seg.world];
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getY(i) / tile);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.rotation.x = -Math.PI / 2;
  // ring's local quadrant spans +x..+y (before laying flat: +y becomes -z, i.e. forward). Turn it so the quadrant faces the corner.
  const holder = new THREE.Group(); holder.add(m); holder.rotation.y = sg > 0 ? Math.PI / 2 : 0; holder.position.set(sg * R, .006, -(seg.len - R));
  if (sg < 0) { holder.rotation.y = 0; holder.scale.x = 1; m.rotation.z = 0; }
  seg.group.add(holder); seg.fillet = holder;
}
function segPoint(seg, s, lat, out = new THREE.Vector3()) {
  const d = DIRS[seg.dir], r = DIRS[(seg.dir + 1) % 4];
  return out.set(seg.sx + d[0] * s + r[0] * lat, 0, seg.sz + d[1] * s + r[1] * lat);
}
function yawOf(dir) { const d = DIRS[dir]; return Math.atan2(-d[0], -d[1]); }

function worldForNextSeg() {
  if (SONGS[songIdx].world !== 'beach') return SONGS[songIdx].world;
  // estimate when the player will reach this new segment and pick the biome for that moment of the song
  let ahead = 0; for (let i = segI ?? 0; i < segs.length; i++) ahead += segs[i].len; ahead -= (s || 0);
  const eta = songTime() + Math.max(0, ahead) / Math.max(10, speed || 13);
  return params.get('biome2') || params.get('biome') || biomeAt(eta);
}
const segHist = [];
function segRect(sx, sz, dir, len, m) { const d = DIRS[dir], r = DIRS[(dir + 1) % 4]; const xs = [], zs = []; for (const [l, q] of [[-m, -12], [m, -12], [-m, len + 12], [m, len + 12]]) { xs.push(sx + d[0] * q + r[0] * l); zs.push(sz + d[1] * q + r[1] * l); } return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; }
const rectHit = (A, B) => A[0] < B[1] && B[0] < A[1] && A[2] < B[3] && B[2] < A[3];
function turnClashes(sx, sz, dir, len, turn) { // would the NEXT segment (after this one turns) run into older track or its scenery?
  const d = DIRS[dir], ex = sx + d[0] * len, ez = sz + d[1] * len, nd = (dir + (turn === 'R' ? 1 : 3)) % 4;
  const wide = segRect(ex, ez, nd, 150, ROAD_W / 2 + 74), road = segRect(ex, ez, nd, 150, ROAD_W / 2 + 1);
  return segHist.slice(0, -1).some(h => rectHit(wide, h.road) || rectHit(road, h.wide));
}
function addSeg(first) {
  const prev = segs[segs.length - 1];
  let sx = 0, sz = 0, dir = 0;
  if (prev) { const d = DIRS[prev.dir]; sx = prev.sx + d[0] * prev.len; sz = prev.sz + d[1] * prev.len; dir = (prev.dir + (prev.turn === 'R' ? 1 : 3)) % 4; }
  let len = first ? 150 : Math.round(rand(85, 150));
  let turn = Math.random() < .5 ? 'L' : 'R';
  if (prev && prev.turn === turn && Math.random() < .7) turn = turn === 'L' ? 'R' : 'L';
  const world = first ? genWorld : worldForNextSeg();
  const from = prev && prev.world !== world ? prev.world : null; // worlds blend into each other inside one segment
  if (from) len = Math.max(len, 130);
  if (world === 'beach' || from === 'beach') turn = 'R'; // keep the sea on the left
  if (first) segHist.length = 0;
  segHist.push({ road: segRect(sx, sz, dir, len, ROAD_W / 2 + 1), wide: segRect(sx, sz, dir, len, ROAD_W / 2 + 74) }); if (segHist.length > 12) segHist.shift();
  if (turnClashes(sx, sz, dir, len, turn)) { const o = turn === 'L' ? 'R' : 'L'; if (!turnClashes(sx, sz, dir, len, o)) turn = o; }
  const seg = { sx, sz, dir, len, turn, objs: [], world, from, group: new THREE.Group(), n: segCount++ };
  seg.group.position.set(sx, 0, sz); seg.group.rotation.y = yawOf(dir);
  root.add(seg.group);
  buildSegment(seg, first);
  segs.push(seg);
}
// local coords inside seg.group: forward = -Z, right = +X
function put(seg, obj, s, lat, y = 0) { obj.position.set(lat, y, -s); seg.group.add(obj); return obj; }
// flat textured strip from s0..s1, lat x0..x1 ; texture tiles every `tile` meters
function strip(seg, mat, s0, s1, x0, x1, y, tile = 6, tileV) {
  const w = x1 - x0, l = s1 - s0; const geo = new THREE.PlaneGeometry(w, l, Math.min(40, Math.ceil(w / 8)), Math.min(60, Math.ceil(l / 3)));
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
  cornerWall(seg); cornerFillet(seg);
  const arrow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: arrowTex(seg.turn), transparent: true, depthWrite: false }));
  arrow.rotation.x = -Math.PI / 2; put(seg, arrow, seg.len - 9, 0, .02);
  spawnContent(seg, first ? 30 : 36); // leave a clear run-out after every corner
}
function worldAt(seg, s) { return seg.from && s < seg.mid ? seg.from : seg.world; }

// builds road, ground and scenery of world `w` for the stretch a..b of a segment
const _layerMats = new Map(), seaClones = [];
function layered(mat, L) { const k = mat.uuid + ':' + L; let m = _layerMats.get(k); if (!m) { m = mat.clone(); m.userData.src = mat; m.polygonOffset = true; m.polygonOffsetFactor = 1 + L; m.polygonOffsetUnits = 6 * (1 + L); _layerMats.set(k, m); if (mat === M2.water) seaClones.push(m); } return m; }
function buildPart(seg, w, a, b, isStart, isEnd) {
  const L = (seg.n % 4) * 2 + (isStart ? 0 : 1), LM = m => layered(m, L);
  const H = ROAD_W / 2, gy = seg.gy - (isStart ? 0 : .003); if (!params.has('nofill')) fillLand(seg, w, a, b);
  const ga = isStart ? a - 4 : a, gb = isEnd ? b + 30 : b; // ground extends past the ends
  const inPart = s => s >= a + 1 && s <= b - 1 && s > 9 && s < seg.len - 9; // also keep corners clear
  const range = (start, step, fn) => { for (let s = a + start; s < b; s += step()) if (inPart(s)) fn(s); };
  if (w === 'green') {
    strip(seg, M2.dirt, a, b, -H, H, 0, ROAD_W, 7);
    strip(seg, LM(M2.grass), ga, gb, -160, 160, gy, 8);
    for (const side of [-1, 1]) {
      range(rand(2, 6), () => rand(3.5, 7), s => {
        tree(seg, s, side * rand(H + 3, H + 9));
        if (Math.random() < (MOBILE ? .3 : .55)) tree(seg, s + rand(-2, 2), side * rand(H + 10, H + 35));
        if (Math.random() < .5) bush(seg, s + rand(0, 3), side * rand(H + .9, H + 2.2));
        if (Math.random() < .35) flowers(seg, s + rand(0, 3), side * rand(H + 1.3, H + 3.5));
        if (ENV.bench && Math.random() < .12) { const m = envClone('bench', 1.9, 'x'); m.rotation.y = -side * Math.PI / 2; put(seg, m, s + rand(0, 2), side * (H + 1.6), 0); }
      });
      const fa = Math.max(a + 4, 10), fb = Math.min(b - 4, seg.len - 10); if (fb - fa > 12 && Math.random() < .5) fence(seg, side, fa, fb);
    }
  } else if (w === 'stone') {
    strip(seg, M2.cobble, a, b, -H, H, 0, 3);
    strip(seg, LM(M2.paving), ga, gb, -160, 160, gy, 4);
    for (const side of [-1, 1]) {
      const ca = Math.max(a, 9), cb = Math.min(b, seg.len - 9);
      if (cb > ca) { const curb = new THREE.Mesh(G.boxLong, M2.stoneEdge); curb.scale.set(1.4, .14, cb - ca); put(seg, curb, (ca + cb) / 2, side * (H + .7), .07); curb.receiveShadow = true; }
      for (let s = Math.max(a, 10); s < Math.min(b, seg.len - 12);) { const wdt = rand(5, 8); if (s + wdt < Math.min(b, seg.len - 10)) townHouse(seg, s + wdt / 2, side, wdt); s += wdt + rand(0, 1.5); }
      range(6, () => rand(14, 20), s => lamp(seg, s, side * (H + .9)));
    }
    range(rand(8, 20), () => rand(18, 30), s => overheadLine(seg, s));
  } else if (w === 'beach') {
    strip(seg, M2.sandRoad, a, b, -H, H, 0, ROAD_W, 7);
    strip(seg, LM(M2.sand), ga, gb, -16, 160, gy, 6);
    strip(seg, LM(M2.water), ga, gb, -230, -15, -.012, 14);
    strip(seg, LM(M2.foam), ga, gb, -16.6, -14.6, -.008, 2, 4);
    range(rand(2, 8), () => rand(7, 13), s => {
      const r = Math.random();
      if (r < .35) palm(seg, s, Math.random() < .5 ? rand(H + 5, H + 8) : -rand(H + 5, H + 8));
      else if (r < .6) { umbrella(seg, s, rand(H + 3, H + 9)); if (Math.random() < .7) lounger(seg, s + 1.3, rand(H + 3, H + 9), false); }
      else if (r < .75) hut(seg, s, rand(H + 10, H + 14));
      else rocks(seg, s, -rand(14, 18));
      if (Math.random() < .3) palm(seg, s + 3, rand(H + 14, H + 30));
    });
  } else if (w === 'concert') {
    strip(seg, M2.stage, a, b, -H, H, 0, ROAD_W, 4);
    strip(seg, LM(M2.grassDark), ga, gb, -160, 160, gy, 8);
    for (const side of [-1, 1]) {
      const led = new THREE.Mesh(G.boxLong, side < 0 ? M2.ledA : M2.ledB); led.scale.set(.06, .04, b - a); put(seg, led, (a + b) / 2, side * (H - .05), .03);
      const ca = Math.max(a, 9), cb = Math.min(b, seg.len - 9);
      if (cb - ca > 2) { barrier(seg, side, ca, cb); crowd(seg, side, ca, cb); }
      range(rand(4, 10), () => rand(20, 26), s => lightTower(seg, s, side * (H + 13.5)));
      if (ENV.ledpanel) range(rand(8, 14), () => rand(24, 34), s => { const m = envClone('ledpanel', .9); m.rotation.y = -side * Math.PI / 2; put(seg, m, s, side * (H + 1.3), 0); });
    }
  } else { // night
    strip(seg, M2.asphalt, a, b, -H, H, 0, ROAD_W, 12);
    strip(seg, LM(M2.nightGround), ga, gb, -160, 160, gy, 8);
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
  else if (to === 'concert') { pillar(M.metal, -H - .8, 5.2, .45); pillar(M.metal, H + .8, 5.2, .45); beam(M.metal, 5.3, .45); sign('OD BAND · BURDAYIM KONSERİ', '#c4142c', '#ffffff', 4.5, 6.6, 1.1); const lg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.0), new THREE.MeshBasicMaterial({ map: T.logoRed, transparent: true, side: THREE.DoubleSide, alphaTest: .05 , fog: false, toneMapped: false })); lg.position.set(0, 6.6, .4); g.add(lg);
    for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(G.sphere, M2.ledBulb); b.scale.setScalar(.09); b.position.set(-H - .8 + i * (ROAD_W + 1.6) / 8, 5.62, .25); g.add(b); } }
  else return;
  put(seg, g, s, 0, 0);
}

// ---------------- concert ground
function barrier(seg, side, a, b) {
  const lat = side * (ROAD_W / 2 + .6);
  if (ENV.crowdbar) { const L = 2.4; for (let s = a; s + L <= b; s += L) { const m = envClone('crowdbar', L, 'x'); m.rotation.y = Math.PI / 2; put(seg, m, s + L / 2, lat, 0); } return; }
  for (const y of [.35, .95]) { const r = new THREE.Mesh(G.box, M.metal); r.scale.set(.05, .05, b - a); put(seg, r, (a + b) / 2, lat, y); }
  for (let s = a; s <= b; s += 2.2) { const p = new THREE.Mesh(G.box, M.metal); p.scale.set(.05, 1, .05); put(seg, p, s, lat, .5); const f = new THREE.Mesh(G.box, M.metal); f.scale.set(.6, .04, .05); put(seg, f, s, lat + side * .25, .02); }
}
let crowdGeo = null;
function ensureCrowdGeo() {
  if (!crowdGeo) {
    const body = new THREE.CapsuleGeometry(.22, .8, 2, 6); body.translate(0, .62, 0);
    const head = new THREE.SphereGeometry(.15, 8, 6); head.translate(0, 1.33, 0);
    const armL = new THREE.BoxGeometry(.08, .55, .08); armL.translate(-.18, 1.55, 0); armL.rotateZ(.12);
    const armR = new THREE.BoxGeometry(.08, .55, .08); armR.translate(.18, 1.55, 0); armR.rotateZ(-.12);
    crowdGeo = mergeGeometries([body, head, armL, armR]); crowdGeo.userData.keep = true;
  }
  return crowdGeo;
}
// ---------------- crowd: real low-poly people (Quaternius "Man" / "Woman Casual", CC0) baked into static poses
// each person flips between two poses of a clip (clap in/out, jump crouch/air) → looks alive with zero skinning cost
const CROWD = { kinds: [], groups: [] };
const crowdSignTex = ['LOGO', 'LOGO2', 'BURDAYIM ♥', 'OD ♥', 'EYLÜL!', 'GÜNEŞ!', 'UMAY!', 'SUDE!', 'ÖYKÜ!'].map(t => canvasTex(256, 144, g => {
  if (t.startsWith('LOGO')) { g.fillStyle = t === 'LOGO' ? '#16121a' : '#ffffff'; g.fillRect(0, 0, 256, 144); drawLogo(g, t === 'LOGO' ? 'red' : 'pink', 128, 72, 230, 130); return; }
  g.fillStyle = pick(['#ffcf4a', '#ffffff', '#ff5f8a', '#4de1ff']); g.fillRect(0, 0, 256, 144); g.strokeStyle = '#140a16'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 132);
  g.fillStyle = t.startsWith('OD') ? '#c4142c' : '#140a16'; let fs = 70; g.font = `${fs}px Anton, Impact`; const w = g.measureText(t).width; if (w > 225) { fs = Math.floor(fs * 225 / w); g.font = `${fs}px Anton, Impact`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 128, 76); }));
const crowdSignGeo = (() => { const board = new THREE.BoxGeometry(.78, .44, .02); board.translate(0, 2.25, .12); const stick = new THREE.BoxGeometry(.03, .7, .03); stick.translate(0, 1.85, .12); board.userData.keep = stick.userData.keep = true; return { board, stick }; })();
function addBounce(mat, amp, speed = 6.5) {
  mat.onBeforeCompile = sh => { sh.uniforms.uTime = crowdTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed.y += abs(sin(uTime * ${speed.toFixed(1)} + float(gl_InstanceID) * 1.37)) * ${amp.toFixed(3)};`); };
  mat.customProgramCacheKey = () => 'bounce' + amp + speed; return mat;
}
function loadCrowdModels() {
  const files = [1, 2, 3, 4, 5, 6].map(i => `models/fans/fan${i}.glb`);
  return Promise.all(files.map(f => new Promise(res => loader.load(f, g => {
    g.scene.traverse(o => { if (o.isMesh && o.material) { o.material.metalness = 0; o.material.roughness = Math.max(.7, o.material.roughness ?? 1); } });
    (CROWD.raw ||= []).push(g); FANS.push(g); try { CROWD.kinds.push(bakeKind(g)); } catch (e) { console.warn('crowd bake', e); } res(); }, undefined, () => res()))));
}
function bakeKind(gltf) {
  const root = gltf.scene, mixer = new THREE.AnimationMixer(root);
  const clip = n => gltf.animations.find(c => c.name.toLowerCase().includes(n));
  const pairs = gltf.animations.some(c => /wave/i.test(c.name)) ? [[['wave', .22], ['wave', .55]], [['wave', .4], ['wave', .8]]] : [[['clapping', .12], ['clapping', .42]], [['jump', .18], ['jump', .48]]];
  const crowdMat = CROWD.mat || (CROWD.mat = addBounce(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }), .12, 3.3));
  const mats = new Map(); const mat = m => { if (!mats.has(m)) mats.set(m, addBounce(new THREE.MeshStandardMaterial({ color: m.color, roughness: .85, flatShading: true }), .12, 3.3)); return mats.get(m); };
  let norm = null;
  const bake = (name, frac) => {
    const c = clip(name) || gltf.animations[0]; mixer.stopAllAction(); const a = mixer.clipAction(c); a.reset().play(); mixer.setTime(frac * c.duration); root.updateMatrixWorld(true);
    const parts = [];
    root.traverse(o => { if (!o.isSkinnedMesh) return; o.skeleton.update();
      const pos = o.geometry.attributes.position, arr = new Float32Array(pos.count * 3), v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); if (o.geometry.index) g.setIndex(o.geometry.index.clone()); g.userData.keep = true;
      const col = o.material.color || new THREE.Color(1, 1, 1); const ca = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      parts.push({ geo: g, mat: mat(o.material) }); });
    if (!norm) { const b = new THREE.Box3(); parts.forEach(p => { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); }); const k = 1.68 / (b.max.y - b.min.y); norm = { k, cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2, y0: b.min.y }; }
    parts.forEach(p => { p.geo.translate(-norm.cx, -norm.y0, -norm.cz); p.geo.scale(norm.k, norm.k, norm.k); p.geo.computeVertexNormals(); });
    // one draw per pose: merge all body parts, material colours baked into vertex colours
    const merged = mergeGeometries(parts.map(p => p.geo.index ? p.geo.toNonIndexed() : p.geo)); merged.userData.keep = true;
    return [{ geo: merged, mat: crowdMat }];
  };
  return { pairs: pairs.map(([A, B]) => [bake(...A), bake(...B)]) };
}
// spots: [{x, z, yaw}] in the parent's local space. Returns a Group (add it to the parent yourself).
function buildCrowd(spots, signShare = .14) {
  const group = new THREE.Group(); group.userData.toggles = [];
  if (!CROWD.kinds.length) { // models not loaded yet: simple capsules
    const im = new THREE.InstancedMesh(ensureCrowdGeo(), M2.crowd, spots.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    spots.forEach((p, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw); m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, rand(.9, 1.1), 1)); im.setMatrixAt(i, m); im.setColorAt(i, c.setHSL(rand(0, 1), rand(.15, .5), rand(.1, .3))); });
    im.frustumCulled = false; group.add(im); return group;
  }
  const buckets = new Map(); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const signs = crowdSignTex.map(() => []);
  for (const p of spots) {
    const kind = (Math.random() * CROWD.kinds.length) | 0, pair = (Math.random() * CROWD.kinds[kind].pairs.length) | 0, ph = Math.random() < .5 ? 0 : 1;
    const key = kind + ':' + pair + ':' + ph; if (!buckets.has(key)) buckets.set(key, { kind, pair, ph, list: [] });
    q.setFromAxisAngle(up, p.yaw + rand(-.25, .25)); const k = rand(.92, 1.08); m.compose(new THREE.Vector3(p.x, 0, p.z), q, sc.set(k, k * rand(.95, 1.05), k));
    buckets.get(key).list.push({ mat: m.clone(), col: c.setHSL(rand(0, 1), rand(.15, .55), rand(.62, .95)).clone() });
    if (Math.random() < signShare) signs[(Math.random() * signs.length) | 0].push(m.clone());
  }
  for (const b of buckets.values()) {
    const poses = CROWD.kinds[b.kind].pairs[b.pair].map(parts => { const meshes = parts.map(pt => { const im = new THREE.InstancedMesh(pt.geo, pt.mat, b.list.length); b.list.forEach((e, i) => { im.setMatrixAt(i, e.mat); im.setColorAt(i, e.col); }); im.computeBoundingSphere(); im.boundingSphere.radius += 1.5; im.frustumCulled = true; group.add(im); return im; }); return meshes; });
    group.userData.toggles.push({ poses, ph: b.ph, rate: b.pair === 1 ? 2.6 : 3.4 });
  }
  signs.forEach((list, ti) => { if (!list.length) return; const mb = addBounce(new THREE.MeshStandardMaterial({ map: crowdSignTex[ti], roughness: .8 }), .14, 3.3), ms = new THREE.MeshStandardMaterial({ color: 0x8a6a48 });
    const bi = new THREE.InstancedMesh(crowdSignGeo.board, mb, list.length), si = new THREE.InstancedMesh(crowdSignGeo.stick, addBounce(ms, .14, 3.3), list.length);
    list.forEach((mm, i) => { bi.setMatrixAt(i, mm); si.setMatrixAt(i, mm); }); bi.computeBoundingSphere(); si.computeBoundingSphere(); bi.boundingSphere.radius += 1; si.boundingSphere.radius += 1; group.add(bi, si); });
  CROWD.groups.push(group); return group;
}
function crowdTick(t) {
  CROWD.groups = CROWD.groups.filter(g => g.parent && (g.parent.parent || g.parent === scene));
  for (const g of CROWD.groups) for (const tg of g.userData.toggles) { const on = (Math.floor(t * tg.rate) + tg.ph) % 2; tg.poses[0].forEach(im => im.visible = on === 0); tg.poses[1].forEach(im => im.visible = on === 1); }
}
function crowd(seg, side, a, b) {
  const near = MOBILE ? 2 : 3, rows = MOBILE ? 4 : 6, spots = [], far = [];
  const yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2; // face the road
  for (let r = 0; r < rows; r++) for (let s = a + rand(0, .6); s < b; s += rand(1.0, 1.5)) {
    const p = { x: side * (ROAD_W / 2 + 1.5 + r * 1.8 + rand(-.3, .3)), z: -s, yaw };
    (r < near ? spots : far).push(p);
  }
  seg.group.add(buildCrowd(spots, .12));
  if (far.length) { // back rows stay as cheap silhouettes
    ensureCrowdGeo(); const im = new THREE.InstancedMesh(crowdGeo, M2.crowd, far.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    far.forEach((p, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw); m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, rand(.9, 1.12), 1)); im.setMatrixAt(i, m); im.setColorAt(i, c.setHSL(rand(0, 1), rand(.15, .5), rand(.08, .28))); });
    im.frustumCulled = false; seg.group.add(im);
  }
  const pts = []; for (let k = 0; k < (spots.length + far.length) / 6; k++) pts.push(side * (ROAD_W / 2 + 1.5 + rand(0, 8)), rand(1.7, 2.0), -rand(a, b));
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  seg.group.add(new THREE.Points(pg, M2.phones));
}
function lightTower(seg, s, lat) {
  const g = new THREE.Group(); const h = 9;
  for (const x of [-.35, .35]) for (const z of [-.35, .35]) { const p = new THREE.Mesh(G.box, M.metal); p.scale.set(.08, h, .08); p.position.set(x, h / 2, z); g.add(p); }
  for (let y = 1; y < h; y += 1.2) { const r = new THREE.Mesh(G.box, M.metal); r.scale.set(.8, .05, .8); r.position.y = y; g.add(r); }
  const sp = envClone('speaker', 2.2) || (() => { const b = new THREE.Mesh(G.box, M.ampSide); b.scale.set(1.2, 2.2, 1); b.position.y = 1.1; return b; })(); sp.rotation.y = lat > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(sp);
  const heads = new THREE.Group(); heads.position.y = h + .2; g.add(heads);
  for (let k = 0; k < 3; k++) {
    const col = pick([0xff3d9a, 0x4de1ff, 0xffcf4a, 0x9a6bff, 0xffffff]);
    const lampG = new THREE.Group(); lampG.position.x = (k - 1) * .5; heads.add(lampG); if (ENV.parcan) { const pc = envClone('parcan', .55); pc.rotation.x = Math.PI; pc.position.y = .3; heads.add(pc); pc.position.x = lampG.position.x; }
    const bulb = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(3), toneMapped: false })); bulb.scale.setScalar(.16); lampG.add(bulb);
    const beam = new THREE.Mesh(M2.beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    lampG.add(beam); lampG.userData = { ph: rand(0, 6), sp: rand(.5, 1.2) }; seg.objs.push({ t: 'deco', mesh: lampG, s, beam: true });
  }
  put(seg, g, s, lat, 0);
}
function stageAt(seg, s) { // the big stage that closes every concert corner
  const g = new THREE.Group(); const W = ROAD_W + 9;
  const deck = new THREE.Mesh(G.box, M.caseSide); deck.scale.set(W, 1.3, 6); deck.position.set(0, .65, -2.2); g.add(deck);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W - 3, 4.2), new THREE.MeshBasicMaterial({ map: T.screen, toneMapped: false, fog: false, color: 0xcccccc })); screen.position.set(0, 4.2, -4.6); g.add(screen);
  for (const x of [-W / 2 + .8, W / 2 - .8]) { const sp = new THREE.Mesh(G.box, M.ampSide); sp.scale.set(1.4, 5.5, 1.2); sp.position.set(x, 4, -1); g.add(sp); const tw = new THREE.Mesh(G.box, M.metal); tw.scale.set(.3, 8, .3); tw.position.set(x, 4, -4.8); g.add(tw); }
  const roof = new THREE.Mesh(G.box, M.metal); roof.scale.set(W, .35, .35); roof.position.set(0, 7.9, -1.5); g.add(roof);
  const lg = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.26), new THREE.MeshBasicMaterial({ map: T.logoRed, transparent: true, alphaTest: .05, side: THREE.DoubleSide , fog: false, toneMapped: false })); lg.position.set(0, 9.8, -1.5); g.add(lg);
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
    if (w === 'green' && ENV.hedge) { m = new THREE.Group(); const n = Math.ceil(Math.max(sx, sz) / 1.8); for (let i = 0; i < n; i++) { const h = envClone('hedge', 1.9); const along = -Math.max(sx, sz) / 2 + .9 + i * 1.8; h.scale.x *= 1.0; if (sx > sz) h.position.set(along, 0, 0); else h.position.set(0, 0, along); m.add(h); } }
    else if (w === 'green') { m = new THREE.Mesh(G.box, M2.hedge); m.scale.set(sx, 1.9, sz); m.position.y = .95; }
    else if (w === 'stone' && ENV.house1) { m = new THREE.Group(); const L = Math.max(sx, sz), along = sx > sz, sg = Math.sign(lat) || 1;
      for (let q = -L / 2 - 1; q < L / 2 + 1;) { const k = pickEnv('house1', 'house2', 'house3', 'house4'), z = ENV[k].userData.size, h = rand(8.5, 11), wd = z.x * h / z.y, dp = z.z * h / z.y, o = envClone(k, h);
        if (along) { o.position.set(q + wd / 2, 0, -dp / 2 + .7); } else { o.rotation.y = -sg * Math.PI / 2; o.position.set(sg * (dp / 2 - .7), 0, -(q + wd / 2)); } m.add(o); q += wd; } }
    else if (w === 'stone') { m = new THREE.Group(); const b = new THREE.Mesh(G.box, pick(M2.walls)); b.scale.set(sx, 5.5, sz); b.position.y = 2.75; m.add(b); const roof = new THREE.Mesh(G.box, M2.tile); roof.scale.set(sx + .4, .35, sz + .4); roof.position.y = 5.6; m.add(roof); }
    else if (w === 'beach' && ENV.rock2) { m = new THREE.Group(); for (let i = 0; i < Math.max(sx, sz) / 1.6; i++) { const r = envClone(pick(['rock1', 'rock2']), rand(1.3, 1.7), 'x'); r.rotation.y = rand(0, 6); const along = -Math.max(sx, sz) / 2 + .8 + i * 1.6; r.position.y = 0; if (sx > sz) r.position.set(along, 0, 0); else r.position.set(0, 0, along); m.add(r); } }
    else if (w === 'beach') { m = new THREE.Group(); for (let i = 0; i < Math.max(sx, sz) / 1.3; i++) { const r = new THREE.Mesh(G2.dodec, M2.rock); r.scale.set(rand(.7, 1.2), rand(.6, 1.1), rand(.7, 1.1)); const along = -Math.max(sx, sz) / 2 + i * 1.3; if (sx > sz) r.position.set(along, .45, 0); else r.position.set(0, .45, along); m.add(r); } }
    else { m = new THREE.Mesh(G.box, M.building); m.scale.set(sx, 14, sz); m.position.y = 7; }
    const holder = new THREE.Group(); holder.add(m); holder.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    put(seg, holder, s, lat, 0);
  };
  if (w === 'concert') { stageAt(seg, sW + .2); const sp = new THREE.Mesh(G.box, M.ampSide); sp.scale.set(1.4, 4, ROAD_W + 2); sp.castShadow = true; put(seg, sp, seg.len, outer * (ROAD_W / 2 + 1), 2); return; }
  const push = w === 'beach' ? .9 : 0; // rocks are lumpy: keep them a bit further from the corner
  wall(sW + push, 0, ROAD_W + 4, 1.4);
  wall(seg.len, outer * (H + .9 + push), 1.4, ROAD_W + 2);
}

// ---------------- free CC0 environment models (Quaternius via poly.pizza) — procedural fallbacks if missing
const ENV = {};
const ENV_FILES = { tree1: 'tree1', tree2: 'tree2', tree3: 'tree3', tree4: 'tree4', pines: 'pines', palm: 'palm', rock1: 'rock1', rock2: 'rock2', hedge: 'hedge', flowers: 'flowers', fence: 'fence', lamp: 'lamp', barrel: 'barrel', speaker: 'speaker' };
function loadEnv() {
  return Promise.all(Object.entries(ENV_FILES).map(([k, f]) => new Promise(res => loader.load(`models/env/${f}.glb`, g => {
    const fx = fixNormals(g.scene); if (fx && params.has('pickc')) console.log('FIXN ' + k + ' ' + fx); const sc = g.scene; sc.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.metalness = 0; o.material.roughness = Math.max(.75, o.material.roughness ?? 1); } } }); // no env map: metal-ish exports looked blown out
    const b = new THREE.Box3().setFromObject(sc), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const w = new THREE.Group(); sc.position.set(-c.x, -b.min.y, -c.z); w.add(sc); w.userData.size = sz; sc.traverse(o => { if (o.geometry) o.geometry.userData.keep = true; }); ENV[k] = w; res();
  }, undefined, () => res()))));
}
// bad normals (zero/NaN) give NaN pixels, which the bloom pass smears into flickering black squares
function fixNormals(root) { let n = 0; root.traverse(o => { const g = o.geometry; if (!g?.attributes?.position) return; const nr = g.attributes.normal;
  let bad = !nr; if (nr) for (let i = 0; i < nr.count && !bad; i++) { const x = nr.getX(i), y = nr.getY(i), z = nr.getZ(i), l = x * x + y * y + z * z; if (!(l > 1e-8) || !isFinite(l)) bad = true; }
  if (!bad) return; n++; g.computeVertexNormals(); const a = g.attributes.normal; for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i), z = a.getZ(i), l = x * x + y * y + z * z; if (!(l > 1e-8) || !isFinite(l)) a.setXYZ(i, 0, 1, 0); } a.needsUpdate = true; });
  return n; }
const ENV_EXTRA = ['house1', 'house2', 'house3', 'house4', 'umb1', 'umb2', 'umb3', 'lounger1', 'lounger2', 'lifeguard', 'beachhut', 'beachball', 'lifebuoy', 'crate1', 'crate2', 'crate3', 'planter', 'sandcastle', 'barricade', 'sawhorse', 'crowdbar', 'jersey', 'mic', 'drumstick', 'guitarpick', 'amp', 'amp2', 'parcan', 'ledpanel', 'bench', 'volleyball', 'sail1', 'sail2', 'rowboat', 'grass', 'grass2', 'drygrass', 'drygrass2', 'bush2', 'rosebush', 'flowerbush', 'stone', 'desertrocks', 'tent', 'ferris', 'pier', 'tree6', 'foodtruck'];
// bake all meshes of a model into one geometry (world transforms applied); with colours=true, material colours go to vertex colours
function bakeGeo(root, colours) {
  root.updateMatrixWorld(true); const parts = [];
  root.traverse(o => { if (!o.isMesh || !o.geometry?.attributes.position) return; let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals();
    if (colours) { const c = (Array.isArray(o.material) ? o.material[0] : o.material)?.color || new THREE.Color(1, 1, 1); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    g.clearGroups(); parts.push(g); });
  return parts.length ? mergeGeometries(parts) : null;
}
function flatten(scene) { // one mesh, one material — unless the model is textured
  let tex = false, n = 0; scene.traverse(o => { if (o.isMesh) { n++; const m = Array.isArray(o.material) ? o.material : [o.material]; if (m.some(x => x?.map)) tex = true; } });
  if (tex || n < 2) return scene; const g = bakeGeo(scene, true); if (!g) return scene;
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0 })); m.castShadow = m.receiveShadow = true; const out = new THREE.Group(); out.add(m); return out;
}
function loadEnvExtra() {
  return Promise.all(ENV_EXTRA.map(k => new Promise(res => loader.load(`models/env/${k}.glb`, g => {
    const fx = fixNormals(g.scene); if (fx && params.has('pickc')) console.log('FIXN ' + k + ' ' + fx); const sc = flatten(g.scene); sc.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && !o.material.vertexColors) { o.material.metalness = 0; o.material.roughness = Math.max(.6, o.material.roughness ?? 1); } } });
    const b = new THREE.Box3().setFromObject(sc), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const w = new THREE.Group(); sc.position.set(-c.x, -b.min.y, -c.z); w.add(sc); w.userData.size = sz; sc.traverse(o => { if (o.geometry) o.geometry.userData.keep = true; }); ENV[k] = w;
    if (k === 'drumstick') { const geo = bakeGeo(g.scene); geo.center(); const bb = new THREE.Box3().setFromBufferAttribute(geo.attributes.position).getSize(new THREE.Vector3()); geo.scale(1.15 / bb.y, 1.15 / bb.y, 1.15 / bb.y); G.sticks = mergeGeometries([geo.clone().rotateZ(.5), geo.clone().rotateZ(-.5)]); }
    if (k === 'guitarpick') { const geo = bakeGeo(g.scene); geo.center(); const bb = new THREE.Box3().setFromBufferAttribute(geo.attributes.position).getSize(new THREE.Vector3()); const f = .84 / bb.y; geo.scale(f, f, Math.max(f, .12 / bb.z)); G.pick = geo; }
    res(); }, undefined, () => res()))));
}
const pickEnv = (...ks) => { const ok = ks.filter(k => ENV[k]); return ok.length ? pick(ok) : null; };
// clone a model scaled so its height (or width when axis='x') is `size` metres
function envClone(k, size, axis = 'y') { const t = ENV[k]; if (!t) return null; const m = t.clone(true); m.userData.k = k; m.scale.setScalar(size / t.userData.size[axis]); return m; }
const _im = new THREE.Matrix4(), _iq = new THREE.Quaternion(), _is = new THREE.Vector3(), _ip = new THREE.Vector3(), _iy = new THREE.Vector3(0, 1, 0), _iinv = new THREE.Matrix4();
function scatter(seg, k, items, shadow = false) { // items: [s, lat, height, yaw, y]
  const t = ENV[k]; if (!t || !items.length) return; if (params.get('only') && params.get('only') !== k) return; t.updateMatrixWorld(true); _iinv.copy(t.matrixWorld).invert();
  const meshes = []; t.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) { const rel = new THREE.Matrix4().multiplyMatrices(_iinv, o.matrixWorld); const im = new THREE.InstancedMesh(o.geometry, o.material, items.length);
    items.forEach((it, i) => { _iq.setFromAxisAngle(_iy, it[3] ?? rand(0, 6.28)); _im.compose(_ip.set(it[1], it[4] || 0, -it[0]), _iq, _is.setScalar(it[2] / t.userData.size.y)); _im.multiply(rel); im.setMatrixAt(i, _im); });
    im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true; o.geometry.userData.keep = true; seg.group.add(im); }
}
// scatter `n` of the given models over s∈[a,b], |lat|∈[l0,l1] on one side
function sprinkle(seg, a, b, side, l0, l1, n, keys, h0, h1, shadow) {
  a = Math.max(a, 11); b = Math.min(b, seg.len - 11); if (b <= a) return; n = Math.round(n * (b - a) * (MOBILE ? .55 : 1)); const by = {};
  for (let i = 0; i < n; i++) { const k = pick(keys.filter(x => ENV[x])); if (!k) return; (by[k] ||= []).push([rand(a, b), side * rand(l0, l1), rand(h0, h1)]); }
  for (const k in by) scatter(seg, k, by[k], shadow);
}
// roadside billboard with the IF Performance Hall gig poster (OD Band, 29 Kasım)
let adTex = null; const AD_ASPECT = 734 / 865;
function adMat() { if (!adTex) { adTex = new THREE.TextureLoader().load('assets/if_afis.jpg'); adTex.colorSpace = THREE.SRGBColorSpace; adTex.anisotropy = 8; }
  return adMat.m ||= new THREE.MeshStandardMaterial({ map: adTex, emissive: 0xffffff, emissiveMap: adTex, emissiveIntensity: .55, roughness: .6 }); }
function billboard(seg, s, side, w) {
  const H = ROAD_W / 2, g = new THREE.Group(); const big = w === 'concert', ph = big ? 5.6 : 4.0, pw = ph * AD_ASPECT;
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), adMat());
  if (w === 'stone') { // pasted on a facade
    poster.position.y = 2.6; g.add(poster); const fr = new THREE.Mesh(G.box, M.metal); fr.scale.set(pw + .16, ph + .16, .05); fr.position.set(0, 2.6, -.04); g.add(fr);
    g.rotation.y = -side * Math.PI / 2; put(seg, g, s, side * (H + 1.42), 0); return; }
  const legH = big ? 4.2 : 2.6; poster.position.y = legH + ph / 2; g.add(poster);
  const back = new THREE.Mesh(G.box, M.ampSide); back.scale.set(pw + .3, ph + .3, .18); back.position.set(0, legH + ph / 2, -.12); g.add(back);
  for (const x of [-pw * .3, pw * .3]) { const l = new THREE.Mesh(G.box, M.metal); l.scale.set(.16, legH, .16); l.position.set(x, legH / 2, -.2); g.add(l); }
  for (const x of [-pw * .3, pw * .3]) { const lamp = new THREE.Mesh(G.box, M.metal); lamp.scale.set(.5, .08, .35); lamp.position.set(x, legH + ph + .35, .3); g.add(lamp);
    const bulb = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .95, .8).multiplyScalar(2.5), toneMapped: false })); bulb.scale.setScalar(.09); bulb.position.set(x, legH + ph + .28, .45); g.add(bulb); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.rotation.y = -side * .45; put(seg, g, s, side * (H + (big ? 12.5 : 3.6) + pw * .25), 0);
}
function fillLand(seg, w, a, b) {
  if (Math.random() < (params.has('ad') ? 1 : .45)) { const lo = Math.max(a, 16), hi = Math.min(b, seg.len - 16); if (hi > lo) billboard(seg, rand(lo, hi), w === 'beach' ? 1 : (Math.random() < .5 ? -1 : 1), w); }
  const H = ROAD_W / 2;
  if (w === 'green') for (const side of [-1, 1]) {
    sprinkle(seg, a, b, side, H + 1.2, H + 30, 1.1, ['grass', 'grass2'], .45, .85);
    sprinkle(seg, a, b, side, H + 2.5, H + 26, .22, ['bush2', 'rosebush', 'flowerbush'], .7, 1.3);
    sprinkle(seg, a, b, side, H + 3, H + 40, .08, ['stone'], .35, .9);
    sprinkle(seg, a, b, side, H + 12, H + 55, .35, ['tree1', 'tree2', 'tree3', 'tree4', 'tree6'], 4, 7.5);
    sprinkle(seg, a, b, side, H + 46, H + 72, .16, ['pines'], 4, 5.5);
    if (Math.random() < .35) { const s0 = rand(a + 15, b - 15), l = rand(H + 16, H + 30); scatter(seg, 'tent', Array.from({ length: 3 + Math.floor(rand(0, 3)) }, () => [s0 + rand(-7, 7), side * (l + rand(-4, 4)), rand(1.2, 1.5)])); }
  } else if (w === 'stone') for (const side of [-1, 1]) {
    for (const [l, h0, h1] of [[H + 14, 10, 13], [H + 26, 13, 17]]) { // rooftops behind the street
      const keys = ['house1', 'house2', 'house4'].filter(k => ENV[k]); if (!keys.length) break; const by = {};
      for (let q = Math.max(a, 11); q < Math.min(b, seg.len - 14);) { const k = pick(keys), sz = ENV[k].userData.size, h = rand(h0, h1), wd = sz.x * h / sz.y; (by[k] ||= []).push([q + wd / 2, side * (l + sz.z * h / sz.y / 2), h, -side * Math.PI / 2]); q += wd + rand(.2, 1.2); }
      for (const k in by) scatter(seg, k, by[k]);
    }
    sprinkle(seg, a, b, side, H + 48, H + 70, .12, ['tree6', 'tree3'], 6, 10);
  } else if (w === 'beach') {
    sprinkle(seg, a, b, 1, H + 1.5, H + 40, .9, ['drygrass', 'drygrass2'], .5, .9);
    sprinkle(seg, a, b, 1, H + 7, H + 60, .36, ['palm'], 5.5, 8.5);
    sprinkle(seg, a, b, 1, H + 6, H + 45, .05, ['desertrocks'], .8, 1.5);
    sprinkle(seg, a, b, 1, H + 6, H + 30, .1, ['umb1', 'umb2', 'umb3'], 2.5, 2.8);
    sprinkle(seg, a, b, 1, H + 6, H + 30, .08, ['lounger1', 'lounger2'], .5, .6);
    sprinkle(seg, a, b, -1, H + 2, H + 11, .25, ['drygrass', 'drygrass2'], .4, .7);
    sprinkle(seg, a, b, -1, 40, 160, .035, ['sail1', 'sail2'], 7, 12);
    if (ENV.pier && Math.random() < .45) { const q = rand(Math.max(a, 22), Math.min(b, seg.len - 22)); if (q > a) { const sz = ENV.pier.userData.size, h = 18 / sz.z * sz.y; scatter(seg, 'pier', [[q, -25, h, Math.PI / 2, -h * .45]]); if (ENV.rowboat) scatter(seg, 'rowboat', [[q + 5, -27, .55, rand(0, 6), -.12]]); } }
  } else if (w === 'concert') for (const side of [-1, 1]) {
    sprinkle(seg, a, b, side, H + 19, H + 48, .3, ['tent'], 1.3, 1.7);
    sprinkle(seg, a, b, side, H + 16, H + 60, .25, ['grass', 'grass2'], .4, .7);
    if (ENV.foodtruck) { const items = []; for (let q = Math.max(a, 14) + rand(0, 10); q < Math.min(b, seg.len - 14); q += rand(26, 40)) items.push([q, side * (H + 16.5), 3.6, -side * Math.PI / 2 + Math.PI]); scatter(seg, 'foodtruck', items); }
    if (ENV.ferris && Math.random() < .35) scatter(seg, 'ferris', [[rand(Math.max(a, 30), Math.max(a + 1, Math.min(b, seg.len - 30))), side * rand(55, 70), 24, side * Math.PI / 2]]);
  }
}
// ---------------- green
function tree(seg, s, lat) {
  const far = Math.abs(lat) > ROAD_W / 2 + 14;
  const em = far && Math.random() < .5 ? envClone('pines', rand(7, 10), 'x') : envClone(pick(['tree1', 'tree2', 'tree3', 'tree4']), rand(4.2, 6.5));
  if (em) { em.rotation.y = rand(0, 6); put(seg, em, s, lat, 0); return; }
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
function bush(seg, s, lat) { const em = envClone('hedge', rand(.7, 1.1)); if (em) { em.scale.y *= rand(.6, .9); em.rotation.y = rand(0, 6); put(seg, em, s, lat, 0); return; } const b = new THREE.Mesh(G2.ico, pick(M2.leaves)); b.scale.set(rand(.5, .9), rand(.4, .7), rand(.5, .9)); b.castShadow = true; put(seg, b, s, lat, .3); }
function flowers(seg, s, lat) { const em = envClone('flowers', rand(.35, .5)); if (em) { em.rotation.y = rand(0, 6); put(seg, em, s, lat, 0); return; } const g = new THREE.Group(); const mat = pick(M2.flower); for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(G.sphere, mat); f.scale.setScalar(.09); f.position.set(rand(-.6, .6), rand(.12, .3), rand(-.6, .6)); g.add(f); } put(seg, g, s, lat, 0); }
function fence(seg, side, a, b) {
  const lat = side * (ROAD_W / 2 + .5);
  if (ENV.fence) { const len = 2.6; for (let s = a; s + len <= b; s += len) { const f = envClone('fence', len, 'x'); f.rotation.y = Math.PI / 2; put(seg, f, s + len / 2, lat, 0); } return; }
  for (let s = a; s < b; s += 2.4) { const p = new THREE.Mesh(G.box, M2.fence); p.scale.set(.1, .9, .1); put(seg, p, s, lat, .45); }
  for (const y of [.4, .75]) { const r = new THREE.Mesh(G.box, M2.fence); r.scale.set(.05, .08, b - a); put(seg, r, (a + b) / 2, lat, y); }
}
// ---------------- stone
function townHouse(seg, s, side, wdt) {
  const hk = pickEnv('house1', 'house2', 'house3', 'house4');
  if (hk) { const t = ENV[hk], sz = t.userData.size; const k = Math.min(wdt / sz.x, rand(8, 10.5) / sz.y); const m = t.clone(true); m.scale.setScalar(k); m.rotation.y = -side * Math.PI / 2;
    put(seg, m, s, side * (ROAD_W / 2 + 1.5 + sz.z * k / 2), 0); return; }
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
  const em = envClone('lamp', 3.8); if (em) { em.rotation.y = lat > 0 ? -Math.PI / 2 : Math.PI / 2; const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffb060, transparent: true, opacity: .4, depthWrite: false })); halo.scale.setScalar(1.3); halo.position.set(0, 3.7, 0); const g = new THREE.Group(); g.add(em, halo); put(seg, g, s, lat, 0); return; }
  const g = new THREE.Group(); const p = new THREE.Mesh(G.cyl, M2.iron); p.scale.set(.06, 3.4, .06); p.position.y = 1.7; g.add(p);
  const b = new THREE.Mesh(G.sphere, M.bulb); b.scale.setScalar(.18); b.position.y = 3.45; g.add(b);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffb060, transparent: true, opacity: .45, depthWrite: false })); halo.scale.setScalar(1.4); halo.position.y = 3.45; g.add(halo);
  put(seg, g, s, lat, 0);
}
function overheadLine(seg, s) { // decorative laundry high above the street (out of reach)
  const rope = new THREE.Mesh(G.cyl, M.rope); rope.scale.set(.015, ROAD_W + 3, .015); rope.rotation.z = Math.PI / 2; put(seg, rope, s, 0, 6.6); rope.userData.overhead = s;
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(.8, rand(.6, 1)), new THREE.MeshStandardMaterial({ color: pick([0xf4f1ea, 0xe8433b, 0x3a8fc4, 0xf6d24a]), side: THREE.DoubleSide })); c.position.set(-2.4 + i * 1.6 + rand(-.3, .3), 6.2, -s); c.userData.overhead = s; seg.group.add(c); }
}
// ---------------- beach
function palm(seg, s, lat) {
  const em = envClone('palm', rand(5.5, 7.5)); if (em) { em.rotation.y = rand(0, 6); put(seg, em, s, lat, 0); return; }
  const g = new THREE.Group(); const n = 7, lean = rand(.04, .1) * (Math.random() < .5 ? -1 : 1); let x = 0, y = 0;
  for (let i = 0; i < n; i++) { const c = new THREE.Mesh(G.cyl, M2.palm); c.scale.set(.16 - i * .01, .75, .16 - i * .01); c.position.set(x, y + .37, 0); c.rotation.z = -lean * i; g.add(c); x += Math.sin(lean * i) * .75; y += .72; }
  for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(G.sphere, M2.frond); f.scale.set(1.5, .06, .3); const a = k / 7 * Math.PI * 2; f.position.set(x + Math.cos(a) * 1.2, y - .25, Math.sin(a) * 1.2); f.rotation.set(0, -a, -.45); f.rotation.order = 'YZX'; g.add(f); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scale.setScalar(rand(.9, 1.25));
  put(seg, g, s, lat, 0);
}
function umbrella(seg, s, lat) {
  { const k = pickEnv('umb1', 'umb2', 'umb3'); if (k) { const m = envClone(k, 2.7); m.rotation.set(rand(-.08, .08), rand(0, 6), rand(-.08, .08)); put(seg, m, s, lat, 0); if (ENV.beachball && Math.random() < .25) { const b = envClone('beachball', .45); put(seg, b, s + rand(-1.5, 1.5), lat + rand(1, 2), 0); } return; } }
  const g = new THREE.Group(); const pole = new THREE.Mesh(G.cyl, M.post); pole.scale.set(.05, 2.4, .05); pole.position.y = 1.2; g.add(pole);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.4, .6, 8), new THREE.MeshStandardMaterial({ color: pick([0xe8433b, 0xffcf4a, 0xf2efe6, 0x3a8fc4]) })); top.position.y = 2.5; top.castShadow = true; g.add(top);
  put(seg, g, s, lat, 0);
}
function lounger(seg, s, lat, asObstacle) {
  { const k = pickEnv('lounger1', 'lounger2'); if (k) { const m = envClone(k, asObstacle ? 1.9 : 1.8, 'x'); if (asObstacle) return m; m.rotation.y = Math.PI / 2 + rand(-.3, .3); put(seg, m, s, lat, 0); return m; } }
  const g = new THREE.Group(); const bed = new THREE.Mesh(G.box, M2.lounger); bed.scale.set(.7, .08, 1.8); bed.position.y = .38; g.add(bed);
  const back = new THREE.Mesh(G.box, M2.lounger); back.scale.set(.7, .08, .8); back.position.set(0, .62, .85); back.rotation.x = .9; g.add(back);
  for (const x of [-.3, .3]) for (const z of [-.8, .8]) { const l = new THREE.Mesh(G.box, M2.palm); l.scale.set(.06, .38, .06); l.position.set(x, .19, z); g.add(l); }
  if (asObstacle) g.rotation.y = Math.PI / 2;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  if (!asObstacle) put(seg, g, s, lat, 0);
  return g;
}
function hut(seg, s, lat) { { const k = pickEnv('lifeguard', 'beachhut'); if (k) { const m = envClone(k, k === 'lifeguard' ? 4.2 : 3.6); m.rotation.y = -Math.PI / 2 + rand(-.3, .3); put(seg, m, s, lat, 0); if (ENV.lifebuoy && Math.random() < .5) { const b = envClone('lifebuoy', .75, 'x'); b.rotation.x = Math.PI / 2; b.rotation.z = rand(-.3, .3); put(seg, b, s + 2, lat - 1.5, .9); } return; } } const g = new THREE.Group(); const b = new THREE.Mesh(G.box, M2.hut); b.scale.set(2.2, 2.4, 2.2); b.position.y = 1.2; g.add(b); const r = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 1, 4), M2.tile); r.rotation.y = Math.PI / 4; r.scale.set(2, 1, 2); r.position.y = 2.9; g.add(r); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); put(seg, g, s, lat, 0); }
function rocks(seg, s, lat) { if (ENV.rock1) { for (let i = 0; i < 2; i++) { const em = envClone(pick(['rock1', 'rock2']), rand(1.2, 2.4), 'x'); em.rotation.y = rand(0, 6); put(seg, em, s + rand(-1.5, 1.5), lat + rand(-1, 1), 0); } return; } for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(G2.dodec, M2.rock); r.scale.set(rand(.5, 1.2), rand(.4, .9), rand(.5, 1.1)); r.castShadow = true; put(seg, r, s + rand(-1.5, 1.5), lat + rand(-1, 1), .2); } }

// ------------------------------------------------------------------ obstacles
function spawnContent(seg, startS) {
  for (let s = startS; s < seg.len - 18;) {
    const diff = clamp((speed - 13) / 14, 0, 1);
    const lanes = [-1, 0, 1].sort(() => Math.random() - .5);
    if (Math.random() < .22) coinLine(seg, s, lanes[0], 7);
    else {
      const n = Math.random() < .25 + diff * .45 ? 2 : 1;
      for (let i = 0; i < n; i++) obstacle(seg, s, lanes[i]);
      const free = lanes[n];
      if (Math.random() < .75) coinLine(seg, s - 4, free, 5);
      else if (Math.random() < .5) { const lo = seg.objs.find(o => o.s === s && o.t === 'low'); if (lo) coinArc(seg, s, lo.lane); }
    }
    if (Math.random() < .07) { const r = Math.random(); powerup(seg, s + 6, lanes[2] ?? 0, r < .4 ? 'sun' : r < .72 ? 'mic' : 'mod'); }
    if (Math.random() < .2 && letterOnTrack() < 2) letter(seg, s + 8, lanes[1] ?? 0);
    s += lerp(21, 14, diff) + rand(0, 6);
  }
}
function sheetLine(g) { // clothesline with a white sheet (from the Burdayım video idea) — slide under
  for (const x of [-1.05, 1.05]) { const p = new THREE.Mesh(G.cyl, M.post); p.scale.set(.06, 2.9, .06); p.position.set(x, 1.45, 0); g.add(p); }
  const rope = new THREE.Mesh(G.cyl, M.rope); rope.scale.set(.02, 2.1, .02); rope.rotation.z = Math.PI / 2; rope.position.y = 2.75; g.add(rope);
  const sheetG = new THREE.PlaneGeometry(2.0, 1.4, 10, 6); sheetG.translate(0, -.7, 0);
  const sh = new THREE.Mesh(sheetG, M.sheet); sh.position.y = 2.75; g.add(sh); g.userData.sheet = sh; sh.userData.base = sheetG.attributes.position.array.slice();
}
function caseStack(g) {
  if (ENV.crate1) { for (const x of [-.48, .48]) { const c = envClone(pickEnv('crate1', 'crate2', 'crate3'), 1.05); c.position.x = x; c.rotation.y = rand(-.15, .15); g.add(c); } const top = envClone(pickEnv('crate1', 'crate2', 'crate3'), .95); top.position.set(rand(-.2, .2), 1.05, 0); top.rotation.y = rand(-.4, .4); g.add(top); return; }
  const mats = [M.caseSide, M.caseSide, M.caseSide, M.caseSide, M.case, M.caseSide];
  const a = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.2), mats); a.position.y = .6; g.add(a);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.1), mats); b.position.set(.05, 1.7, 0); b.rotation.y = .12; g.add(b);
}
function monitor(g) { if (ENV.amp) { for (const x of [-.45, .45]) { const a = envClone(pickEnv('amp', 'amp2'), .85); a.position.x = x; a.rotation.y = Math.PI + rand(-.15, .15); g.add(a); } return; } const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, .8, .9), [M.ampSide, M.ampSide, M.ampSide, M.ampSide, M.amp, M.ampSide]); b.position.y = .4; b.rotation.x = -.25; g.add(b); }
function obstacle(seg, s, lane) {
  const w = worldAt(seg, s), k = Math.random(); let t;
  if (k < .36) t = 'low'; else if (k < .68) t = 'high'; else t = 'block';
  const g = new THREE.Group();
  if (w === 'concert') {
    if (t === 'low') { if (Math.random() < .5) monitor(g); else if (ENV.crowdbar) { g.add(envClone('crowdbar', 2.0, 'x')); } else { for (const y of [.35, .85]) { const r = new THREE.Mesh(G.box, M.metal); r.scale.set(1.8, .06, .06); r.position.y = y; g.add(r); } for (const x of [-.85, .85]) { const p = new THREE.Mesh(G.box, M.metal); p.scale.set(.06, .9, .06); p.position.set(x, .45, 0); g.add(p); const f = new THREE.Mesh(G.box, M.metal); f.scale.set(.06, .04, .7); f.position.set(x, .02, 0); g.add(f); } } }
    else if (t === 'high') { for (const x of [-1.1, 1.1]) { const p = new THREE.Mesh(G.box, M.metal); p.scale.set(.12, 2.9, .12); p.position.set(x, 1.45, 0); g.add(p); } const tr = new THREE.Mesh(G.box, M.metal); tr.scale.set(2.4, .3, .3); tr.position.y = 2.0; g.add(tr); const tr2 = tr.clone(); tr2.position.y = 2.6; g.add(tr2);
      for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(G.sphere, i % 2 ? M2.ledA : M2.ledB); b.scale.setScalar(.12); b.position.set(-.8 + i * .53, 1.78, 0); g.add(b); } }
    else if (ENV.speaker) { for (const [x, y] of [[-.45, 0], [.45, 0], [0, 1.2]]) { const sp = envClone('speaker', 1.2); sp.position.set(x, y, 0); g.add(sp); } }
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
    else if (r < .45 && ENV.barrel && w !== 'beach') { for (const x of [-.45, .45]) { const b = envClone('barrel', .85); b.position.x = x; b.rotation.y = rand(0, 6); g.add(b); } }
    else if (w === 'green' && ENV.sawhorse) { g.add(envClone(pickEnv('sawhorse', 'jersey'), 1.9, 'x')); }
    else if (w === 'stone' && ENV.planter) { g.add(envClone('planter', 1.9, 'x')); }
    else if (w === 'beach' && ENV.sandcastle && Math.random() < .5) { const c = envClone('sandcastle', .95); c.rotation.y = rand(0, 6); g.add(c); }
    else if (w === 'green') { const hay = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, 1.7, 16), M2.hay); hay.rotation.z = Math.PI / 2; hay.position.y = .48; g.add(hay); }
    else if (w === 'stone') { const p = new THREE.Mesh(G.box, M2.stoneEdge); p.scale.set(1.7, .6, .7); p.position.y = .3; g.add(p); for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(G2.ico, i % 2 ? M2.bougain : pick(M2.leaves)); f.scale.setScalar(.22); f.position.set(-.65 + i * .26, .72, rand(-.15, .15)); g.add(f); } }
    else { if (Math.random() < .5) g.add(lounger(null, 0, 0, true)); else { const c = new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, .6, 8), M2.sand); c.position.y = .3; g.add(c); const t2 = new THREE.Mesh(new THREE.CylinderGeometry(.25, .35, .4, 8), M2.sand); t2.position.y = .8; g.add(t2); } }
  } else if (t === 'high') {
    if (w === 'beach' && Math.random() < .6) { // volleyball net
      for (const x of [-1.15, 1.15]) { const p = new THREE.Mesh(G.cyl, M.post); p.scale.set(.06, 2.6, .06); p.position.set(x, 1.3, 0); g.add(p); }
      const n = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.0), M2.net); n.position.y = 1.95; g.add(n);
      const ball = ENV.volleyball ? envClone('volleyball', .26) : new THREE.Mesh(G.sphere, M2.ball); if (!ENV.volleyball) ball.scale.setScalar(.12); ball.position.set(rand(-.6, .6), 2.9, 0); g.add(ball); g.userData.ball = ball;
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
  if (kind === 'mod') { const d = modDisc(.55); d.rotation.y = params.has('poff') ? +params.get('poff') : Math.PI / 2; const w = new THREE.Group(); w.rotation.x = Math.PI / 2; w.add(d); g.add(w); }
  else if (kind === 'sun') {
    const core = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xffd36b })); core.scale.setScalar(.38); g.add(core);
    for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(new THREE.ConeGeometry(.08, .35, 6), new THREE.MeshBasicMaterial({ color: 0xffa83a })); const a = i / 10 * Math.PI * 2; r.position.set(Math.cos(a) * .55, Math.sin(a) * .55, 0); r.rotation.z = a - Math.PI / 2; g.add(r); }
  } else {
    if (ENV.mic) { const m = envClone('mic', .85); m.position.y = -.42; m.rotation.z = .25; g.add(m); } else {
    const head = new THREE.Mesh(G.sphere, new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: .9, roughness: .3 })); head.scale.setScalar(.22); head.position.y = .2; g.add(head);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.09, .06, .55, 12), new THREE.MeshStandardMaterial({ color: 0x1c1c1c })); body.position.y = -.15; g.add(body); }
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: kind === 'sun' ? 0xffb040 : kind === 'mod' ? 0xffd23a : 0x9ad5ff, transparent: true, depthWrite: false, opacity: .8 })); halo.scale.setScalar(2.2); g.add(halo);
  put(seg, g, s, lane * LANE, 1.3); seg.objs.push({ t: kind, lane, s, y: 1.3, mesh: g });
}
let letterGot = new Set(), lastLetter = -1;
function letterOnTrack() { let n = 0; for (const sg of segs) for (const o of sg.objs) if (o.t === 'letter' && !o.done) n++; return n; }
function letter(seg, s, lane) {
  const word = [...SONGS[songIdx].word];
  let left = word.map((_, i) => i).filter(i => !letterGot.has(i)); if (!left.length) return;
  if (left.length > 1) left = left.filter(i => i !== lastLetter);
  const idx = pick(left); lastLetter = idx; const ch = word[idx];
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTex(ch), transparent: true })); sp.scale.setScalar(1.1);
  put(seg, sp, s, lane * LANE, 1.3); seg.objs.push({ t: 'letter', ch, idx, lane, s, y: 1.3, mesh: sp });
}

// ------------------------------------------------------------------ characters
const loader = new GLTFLoader();
// two wardrobes: look 1 (Burdayım video) and look 2 (styled by AGITÉ) — models/girlN.glb and models/look2/girlN.glb
let LOOK = (new URLSearchParams(location.hash.slice(1)).get('look') || localStorage.getItem('od3_look')) === '2' ? 2 : 1;
const LOOK_TPL = { 1: [], 2: [] };
let girlTemplates = LOOK_TPL[LOOK];
const faceSrc = i => LOOK === 2 ? `assets/f2_${i + 1}.jpg` : `assets/f${i + 1}.jpg`;
async function loadGirls(onProgress, look = LOOK) {
  const girlTemplates = LOOK_TPL[look]; const dir = look === 2 ? 'models/look2/' : 'models/';
  const frac = new Array(NGIRLS).fill(0);
  await Promise.all([...Array(NGIRLS)].map((_, i) => new Promise(res => {
    loader.load(`${dir}girl${i + 1}.glb`, gltf => { girlTemplates[i] = prepGirl(gltf); frac[i] = 1; onProgress(frac.reduce((a, b) => a + b, 0) / NGIRLS); res(); },
      x => { if (x.total) { frac[i] = Math.min(.99, x.loaded / x.total); onProgress(frac.reduce((a, b) => a + b, 0) / NGIRLS); } }, () => { girlTemplates[i] = null; frac[i] = 1; res(); });
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
  const tpl = i === -1 ? PHOTOG : girlTemplates[i];
  const holder = new THREE.Group(); const inner = new THREE.Group(); holder.add(inner);
  let mixer = null, actions = {};
  if (tpl) {
    const m = SkeletonUtils.clone(tpl.scene); m.scale.setScalar(tpl.scale); m.position.set(-tpl.cx * tpl.scale, -tpl.minY * tpl.scale, -tpl.cz * tpl.scale); inner.add(m);
    inner.rotation.y = Math.PI; // models face +Z, we run toward -Z
    mixer = new THREE.AnimationMixer(m);
    const run = findClip(tpl.animations, ['runfast', 'run']) || tpl.animations[0];
    const map = { run };
    for (const k of ['idle', 'jump', 'slide', 'fall', 'reach', 'standup', 'help', 'cheer', 'groove', 'singdance', 'sit']) map[k] = findClip(tpl.animations, [k]);
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

// ------------------------------------------------------------------ the chaser: a shadow
const chaser = new THREE.Group(); scene.add(chaser); chaser.scale.setScalar(.66);
const smokeMat = new THREE.SpriteMaterial({ map: T.smoke, color: 0x07020c, transparent: true, depthWrite: false, opacity: .85 });
const smoke = [];
for (let i = 0; i < 40; i++) { const sp = new THREE.Sprite(smokeMat.clone()); sp.userData = { a: Math.random() * 6.28, r: Math.random(), h: Math.random(), sp: rand(.6, 1.6) }; chaser.add(sp); smoke.push(sp); }
const chaserU = { uTime: { value: 0 } };
const cBody = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.ShaderMaterial({ // living shadow: wobbling dark body with a violet rim
  transparent: false, uniforms: chaserU,
  vertexShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vW;
    void main(){ vec3 p = position; float w = sin(p.y * 5. + uTime * 4.) * .06 + sin(p.x * 7. - uTime * 3.) * .04 + sin(atan(p.z, p.x) * 6. + uTime * 5.) * .05 * (1. - p.y);
      p += normal * w; vW = w; vec4 mv = modelViewMatrix * vec4(p, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vN; varying vec3 vV; varying float vW;
    void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.2); vec3 c = mix(vec3(.006, .002, .01), vec3(.11, .025, .19), pow(f, 3.)) + vW * .06; gl_FragColor = vec4(c, 1.); }` }));
cBody.scale.set(.75, 1.1, .7); cBody.position.y = 1.6; chaser.add(cBody);
const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .03, .02).multiplyScalar(2.6), toneMapped: false });
const eyes = [];
for (const x of [-.32, .32]) { const e = new THREE.Mesh(G.sphere, eyeMat); e.scale.set(.15, .06, .05); e.position.set(x, 2.15, -.72); e.rotation.z = x > 0 ? -.3 : .3; chaser.add(e); eyes.push(e); }
const arms = [];
for (const side of [-1, 1]) {
  const arm = new THREE.Group(); arm.position.set(side * .75, 1.9, -.2); chaser.add(arm);
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(.09, .16, 1.5, 8), new THREE.MeshBasicMaterial({ color: 0x050008 })); seg1.position.y = .7; arm.add(seg1);
  for (let k = -1; k <= 1; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.04, .45, 6), new THREE.MeshBasicMaterial({ color: 0x050008 })); f.position.set(k * .09, 1.62, 0); f.rotation.z = k * .3; arm.add(f); }
  arm.userData.side = side; arms.push(arm);
}
const chaserLight = new THREE.PointLight(0xff1838, 1, 3.5); chaserLight.position.set(0, 2.2, -1); chaser.add(chaserLight);

// shield bubble
let modTex = null;
function modLogoTex() { return modTex ||= canvasTex(512, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h); const R = 236;
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w / 2 + 10, h / 2 + 8, R - 6, 0, 7); g.fill();
  g.fillStyle = '#f7c41f'; g.beginPath(); g.arc(w / 2, h / 2, R - 8, 0, 7); g.fill();
  g.strokeStyle = '#fff7dc'; g.lineCap = 'round'; g.lineWidth = 9;
  for (let r = 62, k = 0; r < 212; r += 30, k++) { g.setLineDash([r * .5, 18 + k * 3]); for (const [a0, a1] of [[Math.PI + .42, 2 * Math.PI - .42], [.42, Math.PI - .42]]) { g.beginPath(); g.arc(w / 2, h / 2, r, a0, a1); g.stroke(); } }
  g.setLineDash([]); g.save(); g.translate(w / 2, h / 2 + 4); g.transform(1, 0, -.22, 1, 0, 0);
  g.font = '900 88px Anton, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1c2140';
  let fs = 88; while (g.measureText('MODUNDAYIZ').width > 420 && fs > 40) { fs -= 4; g.font = `900 ${fs}px Anton, Impact, sans-serif`; }
  g.fillText('MODUNDAYIZ', 0, 0); g.restore();
}); }
function modDisc(r = .55) { const t = modLogoTex(); const face = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .45, metalness: .1, emissive: 0x332400, emissiveMap: t });
  const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .07, 48), [new THREE.MeshStandardMaterial({ color: 0xe0a800, roughness: .4 }), face, face]); return d; }
const flyBoard = new THREE.Group(); { const d = modDisc(.75); flyBoard.add(d); flyBoard.visible = false; }
const shield = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 20), new THREE.ShaderMaterial({ // rim-only bubble: clear in the middle so it never fogs the runner
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { color: { value: new THREE.Color(0xffc04a) }, opacity: { value: .2 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 color; uniform float opacity; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - abs(dot(vN, vV)), 3.); gl_FragColor = vec4(color * f * 2.2, f * (.6 + opacity)); }` }));
shield.visible = false;

// ------------------------------------------------------------------ state
let state = 'loading', sel = +(localStorage.getItem('od3_sel') ?? 2) || 0;
let player = null, menuGirls = [], friends = [], downT = 0, downReason = '', fallen = { x: 0, z: 0, yaw: 0 };
let speed, seg, segI, s, lane, lat, py, vy, sliding, slideT, turnQ, stumbleT, gap, score, picks, dist, magnet, sunT, flyT = 0, letterIdx = 0, mult, deadT, fallY, camYaw;
let downReasonShown = false; let songIdx = 0, best = +localStorage.getItem('od3_best') || 0, muted = localStorage.getItem('od3_muted') === '1';
const clock = new THREE.Clock(); let hbT = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

// ------------------------------------------------------------------ audio
const songs = SONGS.map(sg => { const a = new Audio(sg.file); a.preload = 'auto'; a.volume = .8; return a; });
songs.forEach(a => { a.loop = true; }); // Burdayım plays on repeat
songs.forEach((a, i) => a.addEventListener('ended', () => { if (state === 'run' || state === 'gig') nextSong(); else if (state === 'pause') songEndedInPause = true; }));
let songEndedInPause = false;
let AC = null;
function ac() { if (!AC) try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } if (AC?.state === 'suspended') AC.resume(); return AC; }
function sfx(f, d = .08, type = 'square', v = .05, slide = 0) { const a = ac(); if (!a || muted) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f; if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), a.currentTime + d); g.gain.value = v; g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + d); }
function noise(d, v, lp = 2000) { const a = ac(); if (!a || muted) return; const b = a.createBuffer(1, a.sampleRate * d, a.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length); const src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; src.buffer = b; g.gain.value = v; src.connect(f).connect(g).connect(a.destination); src.start(); }
function crowdCheer(dur = 2.4, vol = .22) { // synthesized crowd roar + scattered claps
  const a = ac(); if (!a || muted) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < n; i++) { const t = i / n; ch[i] = (Math.random() * 2 - 1) * Math.min(1, t * 6) * (1 - t) ** 1.5; }
  for (let k = 0; k < 40; k++) { const st = Math.floor(rand(0, n * .85)), len = Math.floor(a.sampleRate * .02); for (let i = 0; i < len; i++) ch[st + i] += (Math.random() * 2 - 1) * (1 - i / len) * 1.4; }
  const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = .6; g.gain.value = vol;
  src.buffer = b; src.connect(bp).connect(g).connect(a.destination); src.start();
}
function setMuted(m) { muted = m; localStorage.setItem('od3_muted', m ? '1' : '0'); songs.forEach(a => a.muted = m); $('muteBtn').textContent = 'Ses: ' + (m ? 'kapalı' : 'açık'); }
setMuted(muted);
function playSong(i, from = 0) { songs.forEach(a => a.pause()); songIdx = i; const a = songs[i]; try { a.currentTime = from; } catch (e) { } a.play().catch(() => { }); $('songName').textContent = SONGS[i].title; $('songArtist').textContent = SONGS[i].artist; }
function nextSong() {
  const n = (songIdx + 1) % SONGS.length; playSong(n); letterIdx = 0; letterGot.clear(); buildLetters();
  showMsg('BURDAYIM', 2);
}

// ------------------------------------------------------------------ world look
const look = { cur: null };
const CLOUDS = { // lit colour, shade colour, coverage
  green: [0xffffff, 0xaebfd6, .58], stone: [0xfff3e2, 0xc89a80, .6], beach: [0xffd9b8, 0x9a5a86, .62], concert: [0x6c4f9e, 0x1c1234, .45], night: [0x3a2c60, 0x0c0818, .4] };
function applyWorld(name, k = 1) {
  const W = WORLDS[name];
  const c = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);
  const from = look.cur || W;
  scene.fog.color.copy(c(from.fog, W.fog)); scene.fog.near = lerp(from.fogNear, W.fogNear, k); scene.fog.far = lerp(from.fogFar, W.fogFar, k);
  skyU.top.value.copy(c(from.skyTop, W.skyTop)); skyU.mid.value.copy(c(from.skyMid, W.skyMid)); skyU.bot.value.copy(c(from.skyBot, W.skyBot)); skyU.stars.value = lerp(from.stars, W.stars, k);
  sun.color.copy(c(from.sun, W.sun)); sun.intensity = lerp(from.sunI, W.sunI, k);
  hemi.color.copy(c(from.hemiSky, W.hemiSky)); hemi.groundColor.copy(c(from.hemiGround, W.hemiGround)); hemi.intensity = lerp(from.hemiI, W.hemiI, k);
  seaMat.color.copy(c(from.sea, W.sea)); bloom.strength = lerp(from.bloom, W.bloom, k);
  const cl = { green: 1, stone: .9, beach: .75, concert: .25, night: 0 }; const ca = lerp(cl[look.cur === WORLDS.green ? 'green' : Object.keys(WORLDS).find(n => WORLDS[n] === from) || name] ?? 1, cl[name] ?? 1, k);
  const tint = c(name === 'beach' ? 0xffd2c0 : 0xffffff, name === 'concert' ? 0x8a6ab8 : name === 'beach' ? 0xffc2b0 : 0xffffff);
  clouds.visible = false; // replaced by shader clouds in the dome
  const CL = n => CLOUDS[n] || CLOUDS.green, fn = Object.keys(WORLDS).find(n => WORLDS[n] === from), a0 = from.cl ? from.cl : CL(fn || name), a1 = CL(name);
  skyU.cl1.value.copy(c(a0[0], a1[0])); skyU.cl2.value.copy(c(a0[1], a1[1])); skyU.clA.value = lerp(a0[2], a1[2], k);
  fill.intensity = lerp(from.fill ?? .5, W.fill, k); seaMat.specular.copy(c(from.spec ?? 0xffd0a0, W.spec));
  for (const m of seaClones) { m.color.copy(M2.water.color); m.specular.copy(M2.water.specular); }
}
let worldFade = null;
function setWorld(name, instant) {
  if (instant) { look.cur = null; applyWorld(name, 1); look.cur = WORLDS[name]; curWorld = name; buildFar(name); return; }
  worldFade = { from: snapshotLook(), to: name, t: 0 }; curWorld = name; buildFar(name);
}
function snapshotLook() { const W = { ...WORLDS[curWorld] }; W.cl = [skyU.cl1.value.getHex(), skyU.cl2.value.getHex(), skyU.clA.value]; W.fog = scene.fog.color.getHex(); W.fogNear = scene.fog.near; W.fogFar = scene.fog.far; W.skyTop = skyU.top.value.getHex(); W.skyMid = skyU.mid.value.getHex(); W.skyBot = skyU.bot.value.getHex(); W.stars = skyU.stars.value; W.sun = sun.color.getHex(); W.sunI = sun.intensity; W.hemiSky = hemi.color.getHex(); W.hemiGround = hemi.groundColor.getHex(); W.hemiI = hemi.intensity; W.sea = seaMat.color.getHex(); W.bloom = bloom.strength; W.fill = fill.intensity; W.spec = seaMat.specular.getHex(); return W; }

// ------------------------------------------------------------------ game flow
function clearTrack() { for (const sg of segs) { root.remove(sg.group); disposeGroup(sg.group); } segs = []; }
function disposeGroup(g) { g.traverse(o => { const geo = o.geometry; if (geo && !geo.userData.keep && !Object.values(G).includes(geo)) geo.dispose?.(); }); } // shared model geometry is flagged keep

function newRun() {
  clearTrack(); songIdx = +(params.get('song') || 0); segI = 0; s = 0; genWorld = SONGS[songIdx].world === 'night' ? 'night' : (params.get('biome') || 'green'); setWorld(genWorld, true); clearFriends();
  speed = 13; lane = 0; lat = 0; py = 0; vy = 0; sliding = false; slideT = 0; turnQ = null; stumbleT = 0; gap = 1; score = 0; picks = 0; dist = 0; magnet = 0; sunT = 0; flyT = 0; letterIdx = 0; letterGot.clear(); lastLetter = -1; gigPending = false; gig = null; mult = 1; deadT = 0; fallY = 0;
  for (let i = 0; i < 4; i++) addSeg(i === 0);
  segI = 0; seg = segs[0]; camYaw = yawOf(seg.dir);
  if (player) scene.remove(player.holder);
  player = makeGirl(sel); scene.add(player.holder); player.holder.add(shield);
  playAct(player, 'run', 0, 1.15);
  buildLetters(); $('hudFace').src = faceSrc(sel); $('hudName').textContent = BAND[sel].name; $('itemName').textContent = BAND[sel].item;
  songs.forEach(a => a.volume = .8); downT = 0;
}
function startRun() {
  ac(); newRun(); state = 'run'; showUI('hud'); playSong(songIdx, 0);
  hint(MOBILE ? 'sağa/sola kaydır: şerit · yukarı: zıpla · aşağı: kay ' : '← →  şerit · ↑ zıpla · ↓ kay ', 4); showMsg('KOŞ!', 1.2);
}
function gameOver(reason) { // she falls; the band comes back for her
  if (state !== 'run') return;
  buzz([60, 40, 160]); state = 'down'; downT = 0; downReason = reason; downReasonShown = false; noise(.5, .3, 900); sfx(80, .5, 'sawtooth', .1, -30);
  songs[songIdx].volume = .35;
  sliding = false; vy = 0;
  playAct(player, 'fall', .12, 1.15);
  for (const o of seg.objs) if (o.mesh && o.s > s - 4 && o.s < s + 6) o.mesh.visible = false; // clear the stage for the band
  const sc = Math.floor(score); const nb = sc > best; if (nb) { best = sc; localStorage.setItem('od3_best', best); }
  $('overScore').textContent = sc; $('overPicks').textContent = picks; $('overDist').textContent = Math.floor(dist); $('overBest').textContent = best;
  $('newBest').classList.toggle('hide', !nb); $('overFace').src = faceSrc(sel); lbPrepare(sc);
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
function buildLetters() { const w = [...SONGS[songIdx].word]; $('letters').innerHTML = w.map((c, i) => `<span class="${letterGot.has(i) ? 'on' : ''}">${c}</span>`).join(''); }
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
  if (a === 'down' && flyT > 0) return;
  if (a === 'down') { if (py > .05) vy = -22; sliding = true; slideT = .8; sfx(260, .12, 'triangle', .05, -140); if (player.actions.slide) { playAct(player, 'slide', .08, 1.7); player.actions.slide.time = .15; } }
}
addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') act('left');
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') act('right');
  else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { state === 'run' ? act('up') : state === 'menu' && act('go'); }
  else if (k === 'ArrowDown' || k === 's' || k === 'S') act('down');
  else if ((k === ' ' || k === 'Enter') && state === 'photo') shoot();
  else if (k === 'Enter') { if (state === 'menu') act('go'); else if (state === 'over' && downT > 7.6) startRun(); }
  else if (k === 'm' || k === 'M') setMuted(!muted);
  else if ((k === 'k' || k === 'K') && state === 'run') gigShortcut();
  else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
  if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
});
let touch = null;
addEventListener('pointerdown', e => { ac(); touch = { x: e.clientX, y: e.clientY, used: false }; if (state === 'photo' && !e.target.closest?.('button')) shoot(); });
addEventListener('pointermove', e => { if (!touch || touch.used) return; const dx = e.clientX - touch.x, dy = e.clientY - touch.y; if (Math.hypot(dx, dy) > 28) { touch.used = true; if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right'); else act(dy < 0 ? 'up' : 'down'); } });
addEventListener('pointerup', () => touch = null);
addEventListener('pointercancel', () => touch = null);
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'run') togglePause(); });
function togglePause() {
  if (state === 'run') { state = 'pause'; songs[songIdx].pause(); showUI('pause'); }
  else if (state === 'pause') { state = 'run'; if (songEndedInPause) { songEndedInPause = false; nextSong(); } else songs[songIdx].play().catch(() => { }); showUI('hud'); clock.getDelta(); }
}
$('pauseBtn').onclick = e => { e.stopPropagation(); togglePause(); };
$('resumeBtn').onclick = togglePause;
$('gigBtn').onclick = () => { togglePause(); gigShortcut(); };
function gigShortcut() { // jump straight to the OD Band concert (no letters needed)
  if (state !== 'run') return; letterGot.clear(); buildLetters();
  if (canStartGig()) startGig(); else { gigPending = true; showMsg('KONSER GELİYOR…', 1.4); }
}
$('quitBtn').onclick = () => { songs.forEach(a => a.pause()); toMenu(); };
$('goBtn').onclick = () => startRun();
$('againBtn').onclick = () => startRun();
$('menuBtn').onclick = () => toMenu();
$('shareBtn').onclick = async () => { // share score + link (Web Share on phones, clipboard elsewhere)
  const text = `OD Band – Burdayım oyununda ${BAND[sel].name} ile ${Math.floor(score)} puan yaptım! 🎸`, url = location.href.split('#')[0];
  try { if (navigator.share) { await navigator.share({ title: 'OD Band – Burdayım', text, url }); return; } await navigator.clipboard.writeText(text + ' ' + url); $('shareBtn').textContent = 'KOPYALANDI ✓'; setTimeout(() => $('shareBtn').textContent = 'PUANIMI PAYLAŞ', 2000); } catch (e) { }
};
$('prevBtn').onclick = () => selGirl(sel - 1);
$('nextBtn').onclick = () => selGirl(sel + 1);
$('bandBtn').onclick = () => $('band').classList.remove('hide'); if (params.has('band')) setTimeout(() => $('band').classList.remove('hide'), 500);
$('howBtn').onclick = () => $('how').classList.remove('hide');
$('muteBtn').onclick = () => setMuted(!muted);
// ------------------------------------------------------------------ leaderboard (Supabase REST; table public.scores, insert+select only via RLS)
const LB = { url: 'https://qmavlkuhxapntdgqikia.supabase.co', key: 'sb_publishable_CMbG9Qpc9A7xdGIxvAugyg_xmPdJp-A' }; // publishable key: read + insert only (RLS)
const lbOn = () => !!(LB.url && LB.key);
let lastRun = null;
async function lbFetch(limit = 20) {
  const r = await fetch(`${LB.url}/rest/v1/scores?select=name,score,member,created_at&order=score.desc,created_at.asc&limit=${limit}`, { headers: { apikey: LB.key } });
  if (!r.ok) throw new Error(r.status); return r.json();
}
function lbRender(el, rows, mine) {
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  el.innerHTML = rows.length ? rows.map(r => `<li class="${mine && r.name === mine.name && r.score === mine.score ? 'me' : ''}"><img src="${faceSrc(r.member)}" alt=""><span>${esc(r.name)}</span><b>${r.score}</b></li>`).join('') : '<li class="empty">Henüz skor yok. İlk sen ol!</li>';
}
async function lbShow() { $('lb').classList.remove('hide'); try { lbRender($('lbList'), await lbFetch(20), lastRun?.saved); } catch (e) { $('lbList').innerHTML = '<li class="empty">Skorlar şu an yüklenemedi.</li>'; } }
async function lbSave() {
  if (!lastRun || lastRun.saved) return; const name = $('lbName').value.replace(/\s+/g, ' ').trim().slice(0, 16);
  if (name.length < 2) { $('lbMsg').textContent = 'En az 2 harf yaz.'; return; }
  localStorage.setItem('od3_name', name); $('lbSaveBtn').disabled = true; $('lbMsg').textContent = 'Kaydediliyor…';
  try {
    const r = await fetch(`${LB.url}/rest/v1/scores`, { method: 'POST', headers: { apikey: LB.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ name, score: lastRun.score, member: lastRun.member }) });
    if (!r.ok) throw new Error(r.status);
    lastRun.saved = { name, score: lastRun.score }; $('lbMsg').textContent = 'Kaydedildi ✓'; $('lbSaveBtn').textContent = 'KAYDEDİLDİ ✓';
    const rows = await lbFetch(10); $('lbMini').classList.remove('hide'); lbRender($('lbMini'), rows, lastRun.saved);
  } catch (e) { $('lbMsg').textContent = 'Kaydedilemedi, tekrar dene.'; $('lbSaveBtn').disabled = false; }
}
function lbPrepare(sc) { // called when the game-over panel is filled in
  lastRun = { score: sc, member: sel, saved: null };
  $('lbSave').classList.toggle('hide', !lbOn() || sc <= 0); $('lbMini').classList.add('hide'); $('lbMsg').textContent = '';
  $('lbSaveBtn').disabled = false; $('lbSaveBtn').textContent = 'SKORU KAYDET'; $('lbName').value = localStorage.getItem('od3_name') || '';
}
$('lbSaveBtn').onclick = lbSave; $('lbName').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') lbSave(); });
$('lbBtn').onclick = lbShow; $('lbBtn').classList.toggle('hide', !lbOn());
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.panel').classList.add('hide'));
function buildFaces() { $('faces').innerHTML = [...Array(NGIRLS)].map((_, i) => `<button data-i="${i}" title="${BAND[i].name}"><img src="${faceSrc(i)}" alt="${BAND[i].name}"></button>`).join(''); $('faces').querySelectorAll('button').forEach(b => b.onclick = () => selGirl(+b.dataset.i)); }
buildFaces();
function updateLookBtn() { $('lookBtn').classList.toggle('on', LOOK === 2); $('lookTxt').textContent = ''; }
let lookBusy = false;
$('lookBtn').onclick = async () => { // AGITÉ button: switch the whole band to the other wardrobe
  if (lookBusy || state !== 'menu') return; const next = LOOK === 2 ? 1 : 2;
  if (!LOOK_TPL[next].length) { lookBusy = true; $('lookTxt').textContent = 'yükleniyor… 0%'; await loadGirls(p => $('lookTxt').textContent = `yükleniyor… ${Math.round(p * 100)}%`, next); lookBusy = false; }
  if (!LOOK_TPL[next].some(Boolean)) { updateLookBtn(); return; }
  LOOK = next; girlTemplates = LOOK_TPL[LOOK]; localStorage.setItem('od3_look', String(LOOK));
  flash('#ffffff', .5); sfx(880, .12, 'triangle', .05, 300); buildFaces(); updateLookBtn(); toMenu();
};
updateLookBtn();

// ------------------------------------------------------------------ menu scene: the whole band together
const menuStage = new THREE.Group(); scene.add(menuStage);
function toMenu() {
  state = 'menu'; showUI('menu'); clearTrack(); clearFriends(); if (player) { scene.remove(player.holder); player = null; }
  songs.forEach(a => { a.pause(); a.volume = .8; });
  genWorld = 'beach'; setWorld('beach', true);
  menuStage.clear(); menuStage.visible = true;
  const sm = M2.sand.clone(); sm.map = T.sand.clone(); sm.map.needsUpdate = true; sm.map.repeat.set(10, 10); const sand = new THREE.Mesh(new THREE.CircleGeometry(30, 48), sm); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; menuStage.add(sand);
  for (const x of [-3.2, 3.2]) { const a = envClone('speaker', 1.5) || new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, .7), [M.ampSide, M.ampSide, M.ampSide, M.ampSide, M.amp, M.ampSide]); a.position.set(x, a.isMesh ? .65 : 0, -2.6); a.rotation.y = -x * .12; a.traverse?.(o => { if (o.isMesh) o.castShadow = true; }); menuStage.add(a); }
  for (const [x, z, h] of [[-6.5, -7, 6.5], [6.8, -8, 7.2], [-10, -12, 7.8], [10.5, -13, 6.8]]) { const p = envClone('palm', h); if (p) { p.position.set(x, 0, z); p.rotation.y = rand(0, 6); menuStage.add(p); } }
  for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(G.sphere, M.bulb); b.scale.setScalar(.07); const u = i / 13; b.position.set(-4.5 + u * 9, 3.1 - Math.sin(u * Math.PI) * .6, -3.4); menuStage.add(b); }
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
function speedFeel(dt) {
  const run = state === 'run'; const want = run ? Math.min(9, Math.max(0, (speed - 14) * .7)) + (flyT > 0 ? 9 : 0) + (sunT > 0 ? 3 : 0) : 0;
  fovKick += (want - fovKick) * Math.min(1, dt * 2.5); const f = baseFov + fovKick; if (Math.abs(camera.fov - f) > .01 && state !== 'photo') { camera.fov = f; camera.updateProjectionMatrix(); }
  const sl = $('speedLines'); if (sl) { const o = run ? Math.min(.55, Math.max(0, (speed - 19) * .06) + (flyT > 0 ? .5 : 0)) : 0; sl.style.opacity = o.toFixed(2); }
}
function update(dt, t) {
  speedFeel(dt);
  if (msgTimer > 0 && (msgTimer -= dt) <= 0) $('msg').classList.remove('show');
  if (hintTimer > 0 && (hintTimer -= dt) <= 0) $('hint').style.opacity = 0;
  clouds.position.copy(camera.position); clouds.rotation.y = t * .004;
  farGroup.position.set(camera.position.x, 0, camera.position.z); // horizon silhouettes ride with the camera — they used to sit at the world origin and the road ran straight into them after ~600 m
  skyU.time.value = t; crowdTime.value = t; crowdTick(t); seaTex.offset.x = t * .01; seaTex.offset.y = t * .006; M2.water.normalMap.offset.set(t * .02, t * .012); M2.foam.opacity = .4 + Math.sin(t * 1.3) * .2;
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
  if (state === 'photo' && photo) { updatePhoto(dt, t); chaser.visible = false; $('vign').style.opacity = 0; sky.position.copy(camera.position); crowdTime.value = t; crowdTick(t); updateHUD(); updateLyrics(); return; }
  if (state === 'gig') { // concert: band on stage, camera in the crowd
    updateGig(dt, t);
    if (gig) {
      gigCamera(dt, t); const look2 = segPoint(seg, gig.s0 + 1.5, 0, tmp2);
      chaser.visible = false; $('vign').style.opacity = 0;
      sky.position.copy(camera.position); sun.position.copy(look2).add(SUN_OFF); sun.target.position.copy(look2);
      fill.position.copy(camera.position).add(tmp.set(0, 2, 0)); fill.target.position.copy(look2); crowdTime.value = t; crowdTick(t);
      updateHUD(); return;
    }
  }

  const running = state === 'run';
  if (running) {
    speed = Math.min(27, speed + dt * (speed < 18 ? .16 : .09));
    const dz = speed * dt; s += dz; dist += dz;
    // chorus multiplier
    if (params.has('fake')) fakeT += dt;
    const ct = songTime(); const inCh = SONGS[songIdx].chorus.some(([a, b]) => ct >= a && ct < b);
    if (inCh !== (mult === 2)) { mult = inCh ? 2 : 1; $('mult').classList.toggle('hide', mult === 1); if (inCh) { showMsg('NAKARAT x2', 1.2); flash('#ffcf4a', .25); } }
    score += dz * mult;
    // corner
    if (s >= seg.len) {
      if (!turnQ) turnQ = seg.turn; // corners turn by themselves
      if (turnQ) {
        const old = seg, oldLat = lat, over = s - old.len;
        segI++; seg = segs[segI];
        s = over; lat = 0; lane = 0; turnQ = null; // the bend already brought her to the middle (runnerPose)
        while (segs.length - segI < 4) addSeg();
        if (segI > 1) { const dead = segs.shift(); root.remove(dead.group); disposeGroup(dead.group); segI--; }
        if (!seg.from && seg.world !== curWorld) setWorld(seg.world);
        s += 0 * over;
      } else if (s > seg.len + ROAD_W / 2 - .2) { s = seg.len + ROAD_W / 2 - .2; gameOver('Köşeyi dönemedin, duvara çarptın.'); }
    }
    if (seg.from) { const k = clamp((s - (seg.mid - 30)) / 60, 0, 1); worldFade = null; look.cur = WORLDS[seg.from]; applyWorld(seg.world, k * k * (3 - 2 * k)); if (k > .5 && farWorld !== seg.world) buildFar(seg.world); curWorld = k >= 1 ? seg.world : seg.from; if (k >= 1) look.cur = WORLDS[seg.world]; }
    // lateral + vertical
    lat += (lane * LANE - lat) * Math.min(1, dt * 13);
    if (flyT > 0) { flyT -= dt; const top = flyT > .7 ? 4.3 : 4.3 * flyT / .7; py = lerp(py, top, Math.min(1, dt * (flyT > .7 ? 4 : 9))); vy = 0; sliding = false; if (flyT <= 0) { flyT = 0; vy = -2; } }
    else { vy -= GRAV * dt; py += vy * dt; if (py < 0) { py = 0; vy = 0; } }
    const ja = player.actions.jump; if (ja && player.cur === ja) { if (py === 0) { ja.timeScale = 1.5; if (ja.time < .14) ja.time = .14; if (ja.time > .62) playAct(player, 'run', .18, 1.15); } }
    if (sliding) { slideT -= dt; if (slideT <= 0) { sliding = false; playAct(player, 'run', .15, 1.15); } }
    player.actions.run && (player.actions.run.timeScale = .95 + speed / 45);
    // timers
    if (stumbleT > 0) stumbleT -= dt; else gap = Math.min(1, gap + dt * .07);
    if (magnet > 0) magnet -= dt;
    if (sunT > 0) { sunT -= dt; gap = Math.min(1, gap + dt * .6); }
    // first-run coaching: tell the player what to do the first time each obstacle type shows up
    if (!tut.done) {
      for (const o of seg.objs) { if (o.done || !o.mesh?.visible) continue; const ds = o.s - s; if (ds < 4 || ds > 13) continue;
        if (['low', 'high', 'block'].includes(o.t) && Math.abs(o.lane * LANE - lat) < 1 && !tut[o.t]) { tut[o.t] = 1; showMsg({ low: MOBILE ? '↑ YUKARI KAYDIR: ZIPLA' : '↑ ZIPLA', high: MOBILE ? '↓ AŞAĞI KAYDIR: KAY' : '↓ KAY', block: MOBILE ? '← → KAYDIR: ŞERİT DEĞİŞTİR' : '← → ŞERİT DEĞİŞTİR' }[o.t], 1.6); break; } }
      tut.turn = 1; if (false) { tut.turn = 1; showMsg(seg.turn === 'L' ? (MOBILE ? '← SOLA KAYDIR: DÖN' : '← DÖN') : (MOBILE ? 'SAĞA KAYDIR: DÖN →' : 'DÖN →'), 1.6); }
      if (tut.low && tut.high && tut.block && tut.turn) { tut.done = true; localStorage.setItem('od3_tut', '1'); }
    }
    // collisions
    collide(dt);
    if (gigPending && canStartGig()) startGig();
  } else if (state === 'down' || state === 'over') {
    downT += dt;
    const k = Math.max(0, 1 - downT / .45); s += speed * k * k * dt * .6; // short skid
    py = Math.max(0, py - dt * 6);
    gap = downT < 2.2 ? Math.max(.05, gap - dt * 1.2) : Math.min(2.5, gap + dt * 1.4);
    if (downT > 1.5 && player.cur === player.actions.fall) playAct(player, 'reach', .5, 1);
    if (downT > .35 && !friends.length) { spawnFriends(); showMsg(upTR(BAND[sel].name) + ' DÜŞTÜ…', 1.4); }
    if (downT > 2.3 && !downReasonShown) { downReasonShown = true; crowdCheer(2.2, .16); showMsg('OD BAND GELDİ!', 1.8); sfx(523, .25, 'triangle', .06); setTimeout(() => sfx(659, .25, 'triangle', .06), 140); setTimeout(() => sfx(784, .4, 'triangle', .06), 280); }
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
  const poseYaw = state === 'run' ? runnerPose(tmp) : (segPoint(seg, s, lat, tmp), yawOf(seg.dir)); player.holder.position.set(tmp.x, py, tmp.z);
  if (!flyBoard.parent) scene.add(flyBoard);
  flyBoard.visible = state === 'run' && flyT > 0; if (flyBoard.visible) { flyBoard.position.copy(player.holder.position); flyBoard.position.y = py - .05; flyBoard.rotation.y = player.holder.rotation.y + (params.has('boff') ? +params.get('boff') : Math.PI / 2) + Math.sin(t * 1.5) * .12; const tilt = Math.sin(t * 5) * .06; flyBoard.rotation.x = tilt; if (Math.random() < .6) emit(flyBoard.position, pick([0xf7c41f, 0xffffff, 0xffe27a]), rand(-1, 1), rand(-2, -.5), rand(-1, 1), rand(.3, .6)); }
  const targetYaw = state === 'run' ? poseYaw : yawOf(seg.dir);
  if (state === 'run' || downT < 5.6) player.holder.rotation.y = angLerp(player.holder.rotation.y, targetYaw, Math.min(1, dt * 14));
  // lean while changing lanes
  player.inner.rotation.z = state === 'run' ? clamp((lat - lane * LANE) * .12, -.25, .25) : 0;
  if (!player.actions.slide) { // procedural slide pose
    const k = sliding && py < .3 ? 1 : 0; player.inner.rotation.x = state === 'run' ? lerp(player.inner.rotation.x, -k * 1.15, Math.min(1, dt * 16)) : player.inner.rotation.x; player.inner.position.y = lerp(player.inner.position.y, k * .25, Math.min(1, dt * 16));
  }
  if (!player.actions.jump && py > 0) player.inner.rotation.x = -.15;
  player.mixer?.update(dt);
  shield.visible = sunT > 0; shield.position.y = .9; shield.material.uniforms.opacity.value = .2 + Math.sin(t * 10) * .1;
  // blink when stumbled
  player.holder.visible = !(state === 'run' && stumbleT > 2.6 && Math.floor(t * 14) % 2 === 0);

  // camera follow
  camYaw = angLerp(camYaw, targetYaw, Math.min(1, dt * 6.5));
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const portrait = camera.aspect < .8, camBack = portrait ? 5.6 : 6.4, camUp = portrait ? 3.3 : 3.4;
  if (state === 'run' || state === 'pause') {
    camPos.set(player.holder.position.x - fx * camBack, camUp + py * (flyT > 0 ? .85 : .35), player.holder.position.z - fz * camBack);
    camera.position.lerp(camPos, Math.min(1, dt * 10));
    camLook.set(player.holder.position.x + fx * 6, 1.1 + py * (flyT > 0 ? .8 : .3), player.holder.position.z + fz * 6);
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
    const rr = (.35 + u.r * .7) * (1 + u.h * .3); sp.position.set(Math.cos(u.a + t) * rr, .15 + u.h * 1.6, Math.sin(u.a + t) * rr * .6 - u.h * .3);
    sp.scale.setScalar(.55 + u.h * .7); sp.material.opacity = (1 - u.h) * .6 * fade; }
  cBody.scale.set(.75 + Math.sin(t * 6) * .04, 1.1 + Math.sin(t * 5) * .06, .7); chaserU.uTime.value = t;
  for (const a of arms) { a.rotation.x = -1.1 - close * .7 + Math.sin(t * 9 + a.userData.side) * .25; a.rotation.z = -a.userData.side * (.35 - close * .2); }
  const blink = Math.sin(t * 3.1) > .985 ? .1 : 1; eyes.forEach(e => e.scale.y = .06 * blink);
  chaserLight.intensity = .4 + close * 2.2;
  $('vign').style.opacity = clamp(close * 1.1 - .1, 0, .9) * fade;
  if (state === 'run' && close > .45) { hbT -= dt; if (hbT <= 0) { hbT = lerp(.75, .42, close); sfx(62, .16, 'sine', .22 * close, -20); setTimeout(() => sfx(55, .14, 'sine', .16 * close, -15), 150); } }
  $('hudFace').classList.toggle('danger', stumbleT > 0);

  // animate world objects
  for (const sg of segs) for (const o of sg.objs) {
    const m = o.mesh; if (!m || !m.parent) continue;
    if (o.t !== 'deco' && sg === seg && o.s < s - (o.t === 'high' || o.t === 'low' || o.t === 'block' ? .3 : 1.2) && m.visible) { m.visible = false; continue; } // passed: never let the camera clip through it
    if (o.t === 'coin') m.rotation.y += dt * 4;
    else if (o.t === 'mod') { m.rotation.y = Math.sin(t * 1.2 + o.s) * .25; m.position.y = o.y + Math.sin(t * 3 + o.s) * .15; }
    else if (o.t === 'sun' || o.t === 'mic') { m.rotation.y += dt * 2; m.position.y = o.y + Math.sin(t * 3 + o.s) * .15; }
    else if (o.t === 'letter') m.position.y = o.y + Math.sin(t * 3 + o.s) * .12;
    else if (o.beam) { const u = m.userData; m.rotation.z = Math.sin(t * u.sp + u.ph) * .45; m.rotation.x = Math.PI + Math.sin(t * u.sp * .7 + u.ph) * .3; }
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
    if (o.t === 'coin' || o.t === 'letter' || o.t === 'sun' || o.t === 'mic' || o.t === 'mod') {
      if ((magnet > 0 && o.t === 'coin' || o.t === 'letter') && ds < (o.t === 'letter' ? 9 : 16) && ds > -1) { // pull toward player
        o.mesh.position.x = lerp(o.mesh.position.x, lat, Math.min(1, dt * 9)); o.mesh.position.y = lerp(o.mesh.position.y, py + 1, Math.min(1, dt * 9)); o.s = lerp(o.s, s, Math.min(1, dt * 6)); o.mesh.position.z = -o.s; o.lane = o.mesh.position.x / LANE;
      }
      const ox = o.mesh.position.x, oy = o.mesh.position.y;
      if (Math.abs(o.s - s) < (o.t === 'letter' ? 1.4 : 1) && Math.abs(ox - lat) < (o.t === 'letter' ? 1.6 : 1.1) && Math.abs(oy - (py + .9)) < 1.7) collect(o);
      continue;
    }
    if (Math.abs(ds) > .55) continue;
    const dx = Math.abs(o.lane * LANE - lat); if (dx > 1.25) continue;
    let ok = false;
    if (flyT > 0 || py > 3.2) ok = true;
    if (o.t === 'low') ok = ok || py > .85;
    if (o.t === 'high') ok = ok || sliding && py < .5;
    if (ok) continue;
    o.done = true;
    if (sunT > 0) { smash(o); continue; }
    if (dx > .7) stumble(o); else gameOver({ low: 'Engele takılıp düştün.', high: 'Çarpıp düştün.', block: 'Kasalara çarpıp düştün.' }[o.t] || 'Düştün.');
  }
}
function collect(o) {
  o.done = true; o.mesh.getWorldPosition(tmp2); burst(tmp2, o.t === 'coin' ? 0xffd36b : o.t === 'letter' ? 0xffffff : 0xffb040, o.t === 'coin' ? 10 : 22); o.mesh.parent?.remove(o.mesh);
  if (o.t === 'coin') { picks++; score += 10 * mult; sfx(1250 + (picks % 6) * 70, .06, 'square', .03); }
  else if (o.t === 'sun') { sunT = 6; gap = 1; flash('#ffd36b', .55); showMsg('BİR GÜNEŞ DOĞAR…', 1.8); sfx(523, .4, 'sine', .08, 520); setTimeout(() => sfx(784, .5, 'sine', .07, 300), 120); }
  else if (o.t === 'mod') { flyT = 5; magnet = Math.max(magnet, 5); vy = 0; sliding = false; flash('#f7c41f', .5); showMsg('MODUNDASIN!', 1.8); buzz(60); sfx(392, .5, 'sawtooth', .05, 900); setTimeout(() => sfx(784, .4, 'triangle', .06, 400), 140); }
  else if (o.t === 'mic') { magnet = 9; showMsg('MİKROFON!', 1.2); sfx(880, .35, 'sawtooth', .04, 700); }
  else if (o.t === 'letter') {
    const word = [...SONGS[songIdx].word];
    if (!letterGot.has(o.idx)) { letterGot.add(o.idx); buzz(30); sfx(990, .12, 'triangle', .06, 200); buildLetters();
      if (letterGot.size >= word.length) { letterGot.clear(); setTimeout(buildLetters, 1500); sfx(523, .3, 'triangle', .07); setTimeout(() => sfx(784, .4, 'triangle', .07), 150); if (canStartGig()) startGig(); else { gigPending = true; showMsg(upTR(SONGS[songIdx].title) + '!', 1.6); } } }
  }
}
function smash(o) { o.mesh.parent?.remove(o.mesh); noise(.2, .2, 3000); score += 25; }
function stumble(o) {
  if (stumbleT > 0) { gameOver('İki kez tökezleyip düştün.'); return; }
  buzz(120); stumbleT = 4.5; gap = .2; noise(.25, .25, 1200); sfx(90, .3, 'sawtooth', .08, -40); showMsg('GÖLGE YAKLAŞIYOR!', 1.4);
  lane = clamp(Math.round(lat / LANE) + (lat > o.lane * LANE ? 1 : -1) * 0, -1, 1);
}
let lastHud = 0;
function updateHUD() {
  const sc = Math.floor(score); if (sc !== lastHud) { $('score').textContent = sc; lastHud = sc; }
  $('picks').textContent = picks;
  let p = ''; if (flyT > 0) p += `<div>💿 Modundayız ${Math.ceil(flyT)}</div>`; if (sunT > 0) p += `<div>☀️ Güneş ${Math.ceil(sunT)}</div>`; if (magnet > 0) p += `<div>🎤 Mikrofon ${Math.ceil(magnet)}</div>`;
  if ($('power').innerHTML !== p) $('power').innerHTML = p;
}

// ------------------------------------------------------------------ BURDAYIM complete → 10 s OD Band gig on a pop-up stage
const GIG_LEN = 15;
const GIG_VIDEO = 'video/klip.mp4'; // şu an: OD Band – Kanada (Official Video). Burdayım klibi çıkınca bu dosyayı değiştir.
const gigVideo = Object.assign(document.createElement('video'), { src: GIG_VIDEO, muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
gigVideo.setAttribute('playsinline', ''); gigVideo.setAttribute('muted', '');
const gigVideoTex = new THREE.VideoTexture(gigVideo); gigVideoTex.colorSpace = THREE.SRGBColorSpace;
// stage spots (lat, s-offset from stage front) — index = band member
const GIG_SPOTS = [[1.9, 3.2, 'drums'], [-.3, .9, 'vocal'], [3.9, 1.4, 'bass'], [-2.4, 1.3, 'guitar'], [-4.4, 1.7, 'guitar']];
let gig = null;
const GM = {
  wood: new THREE.MeshStandardMaterial({ color: 0x2a2224, roughness: .7 }),
  gtrBody: [0xc4142c, 0x111111, 0xf2efe6, 0x2a4fa8, 0xd8a24a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .35, metalness: .1 })),
  neck: new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: .6 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdadde2, metalness: .9, roughness: .25 }),
  drum: new THREE.MeshStandardMaterial({ color: 0xc4142c, roughness: .4 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: .8 }),
  cymbal: new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: .85, roughness: .3 }),
};
const PROPS = {};
function loadProps() {
  const norm = (scene, size, axis) => { // scale so the given axis spans `size` m, centre on x/z, feet at y=0
    const w = new THREE.Group(); w.add(scene); scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.geometry.userData.keep = true; if (o.material) o.material.side = THREE.DoubleSide; } });
    const b = new THREE.Box3().setFromObject(scene), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const k = size / sz[axis]; scene.scale.setScalar(k); scene.position.set(-c.x * k, -b.min.y * k, -c.z * k); return w;
  };
  const one = (file, size, axis) => new Promise(res => loader.load(file, g => res(norm(g.scene, size, axis)), undefined, () => res(null)));
  return Promise.all([one('models/props/gitar.glb', 1.0, 'y'), one('models/props/bas.glb', 1.15, 'y'), one('models/props/davul.glb', 1.9, 'x')])
    .then(([g, b, d]) => { PROPS.guitar = g; PROPS.bass = b; PROPS.drums = d; });
}
// the guitar model is one texture atlas: recolour its green body pixels on a canvas (cached per colour)
const _gtCache = {};
function tintedGuitarTex(map, tint) {
  if (_gtCache[tint]) return _gtCache[tint]; const img = map.image; if (!img?.width) return map;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data, tc = new THREE.Color(tint);
  for (let k = 0; k < px.length; k += 4) { const r = px[k], gg = px[k + 1], b = px[k + 2]; if (gg > r * 1.15 && gg > b * 1.05 && gg > 40) { const l = gg / 255 * 1.25; px[k] = Math.min(255, tc.r * 255 * l); px[k + 1] = Math.min(255, tc.g * 255 * l); px[k + 2] = Math.min(255, tc.b * 255 * l); } }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = map.flipY; t.colorSpace = map.colorSpace; t.wrapS = map.wrapS; t.wrapT = map.wrapT; return (_gtCache[tint] = t);
}
function guitarProp(i, bass) {
  const tpl = bass ? PROPS.bass : PROPS.guitar;
  if (!tpl) { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(.19, .21, .06, 20), GM.gtrBody[i % GM.gtrBody.length]); body.rotation.x = Math.PI / 2; g.add(body); return g; }
  const g = tpl.clone(true);
  // hang it so the body sits at the origin (≈ a quarter up from the bottom)
  const h = bass ? 1.15 : 1.0; g.children[0].position.y -= h * .24;
  // body colour per member and wardrobe (look 2 = the AGITÉ video: Sude black, Öykü blush pink, Umay pink bass)
  const tint = bass ? (LOOK === 2 ? 0xf4b6c8 : null) : i === 4 ? (LOOK === 2 ? 0xe9b9ad : 0xc4142c) : (LOOK === 2 ? 0x161616 : null);
  if (tint !== null) g.traverse(o => { if (!o.isMesh || !o.material) return;
    if (bass) { if (o.material.name === 'Wood2Bass1') { o.material = o.material.clone(); o.material.color.set(tint); } }
    else if (o.material.map) { o.material = o.material.clone(); o.material.map = tintedGuitarTex(o.material.map, tint); } });
  return g;
}
function drumKit() {
  if (PROPS.drums) return PROPS.drums.clone(true);
  const g = new THREE.Group(); const kick = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .38, 20), GM.drum); kick.rotation.x = Math.PI / 2; kick.position.set(0, .32, 0); g.add(kick); return g;
}
function micStand() { const g = new THREE.Group(); const p = new THREE.Mesh(G.cyl, GM.chrome); p.scale.set(.012, 1.45, .012); p.position.y = .72; g.add(p); const b = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .02, 14), GM.chrome); g.add(b); const m = new THREE.Mesh(G.sphere, new THREE.MeshStandardMaterial({ color: 0x333333, metalness: .6, roughness: .4 })); m.scale.setScalar(.04); m.position.set(0, 1.47, .05); g.add(m); return g; }
// attach a prop to a bone so it moves with the body (prop sizes are in metres)
function attachToBone(girl, boneName, prop, pos, rot) {
  let bone = null; girl.holder.traverse(o => { if (!bone && o.isBone && o.name === boneName) bone = o; });
  if (!bone) { girl.inner.add(prop); prop.position.set(pos[0], pos[1] + 1.1, pos[2]); return; }
  girl.holder.updateMatrixWorld(true);
  const ws = new THREE.Vector3(); bone.getWorldScale(ws);
  bone.add(prop); prop.scale.setScalar(1 / ws.x); prop.position.set(pos[0] / ws.x, pos[1] / ws.x, pos[2] / ws.x); prop.rotation.set(...rot);
}
function gigStage() {
  const g = new THREE.Group(), W = ROAD_W + 5, D = 5;
  const deck = new THREE.Mesh(G.box, GM.wood); deck.scale.set(W, .9, D); deck.position.set(0, .45, -D / 2); deck.receiveShadow = true; g.add(deck);
  const riser = new THREE.Mesh(G.box, GM.wood); riser.scale.set(2.2, .45, 1.8); riser.position.set(1.9, 1.12, -3.4); g.add(riser);
  const led = new THREE.Mesh(G.box, M2.ledA); led.scale.set(W, .06, .06); led.position.set(0, .92, .02); g.add(led);
  const led2 = new THREE.Mesh(G.box, M2.ledB); led2.scale.set(2.2, .05, .05); led2.position.set(1.9, 1.36, -2.48); g.add(led2);
  for (const [x, z] of [[-4.3, -3.9], [-3.2, -4.2], [5.3, -3.9]]) { const sp = envClone('speaker', 1.5); if (sp) { sp.position.set(x, .9, z); g.add(sp); } } // backline amps
  for (const x of [-W / 2 + .5, W / 2 - .5]) { const t = new THREE.Mesh(G.box, M.metal); t.scale.set(.35, .25, .35); t.position.set(x, 1.0, -.1); g.add(t); } // sparkler bases
  const frame = new THREE.Mesh(G.box, M.caseSide); frame.scale.set(9.4, 5.5, .2); frame.position.set(0, 3.75, -D - .25); g.add(frame);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 5.06), new THREE.MeshBasicMaterial({ map: gigVideo.readyState >= 2 ? gigVideoTex : T.screen, toneMapped: false })); screen.position.set(0, 3.75, -D - .1); g.add(screen); g.userData.screen = screen;
  for (const x of [-W / 2 - .2, W / 2 + .2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, 1), [M.ampSide, M.ampSide, M.ampSide, M.ampSide, M.amp, M.ampSide]); sp.position.set(x, 1.7, -1.2); sp.castShadow = true; g.add(sp); }
  const roof = new THREE.Mesh(G.box, M.metal); roof.scale.set(W + 1, .3, .3); roof.position.set(0, 6.9, -.6); g.add(roof);
  const lg = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.08), new THREE.MeshBasicMaterial({ map: T.logoRed, transparent: true, alphaTest: .05, side: THREE.DoubleSide , fog: false, toneMapped: false })); lg.position.set(0, 8.7, -.6); g.add(lg);
  const skTex = T.od.clone(); skTex.wrapS = THREE.RepeatWrapping; skTex.repeat.set(Math.max(1, Math.round(W / .9 / (512 / 160))), 1); skTex.needsUpdate = true; // tile the banner instead of stretching it
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(W, .9), new THREE.MeshStandardMaterial({ map: skTex })); skirt.position.set(0, .45, .01); g.add(skirt);
  for (const x of [-W / 2 - .2, W / 2 + .2]) { const p = new THREE.Mesh(G.box, M.metal); p.scale.set(.25, 6.9, .25); p.position.set(x, 3.45, -.6); g.add(p); }
  g.userData.beams = [];
  for (let i = 0; i < 6; i++) { const col = [0xff3d9a, 0x4de1ff, 0xffcf4a][i % 3]; const lg = new THREE.Group(); lg.position.set(-W / 2 + 1 + i * (W - 2) / 5, 6.7, -.6); g.add(lg);
    const bulb = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(3), toneMapped: false })); bulb.scale.setScalar(.13); lg.add(bulb);
    const beam = new THREE.Mesh(M2.beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.scale.set(.5, .35, .5); lg.add(beam); lg.userData.ph = i; g.userData.beams.push(lg); }
  return g;
}
function gigAudience(s0) {
  const g = new THREE.Group(); const rows = MOBILE ? 6 : 10, spots = [];
  for (let r = 0; r < rows; r++) for (let x = -9.2 + (r % 2) * .45; x <= 9.2; x += rand(.85, 1.1)) if (Math.abs(x) > 1.5) // keep a camera aisle down the middle
    spots.push({ x: x + rand(-.15, .15), z: -(s0 - 1.7 - r * 1.15 + rand(-.2, .2)), yaw: Math.PI }); // facing the stage
  g.add(buildCrowd(spots, .14));
  const pts = []; for (let k = 0; k < spots.length / 9; k++) pts.push(rand(-7.5, 7.5), rand(1.9, 2.2), -(s0 - 3.5 - rand(0, rows * 1.15)));
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.add(new THREE.Points(pg, M2.phones));
  seg.group.add(g); return g;
}
// cinematic camera: shots relative to the stage front (s offset, lat, height) → look target
const GIG_SHOTS = [
  { t: 0, from: [-16, 0, 4.4], to: [-10, 0, 3.4], look: [1.5, 0, 2.2] },          // wide, dolly in over the crowd
  { t: 3, from: [-7, -.4, 2.6], to: [-4.6, -.2, 2.3], look: [1, 0, 2.1] },        // push in toward the stage
  { t: 5.5, from: [-2.4, -2.0, 2.3], to: [-1.9, -1.4, 2.2], look: [.9, -.3, 2.35] }, // Güneş, three-quarter so the mic doesn't hide her
  { t: 7.5, from: [-2.2, 4.4, 2.7], to: [-1.4, 3.4, 2.5], look: [2.6, 1.9, 1.9] },  // Eylül on drums
  { t: 9.5, from: [-3.0, -5.2, 2.6], to: [-2.4, -3.4, 2.4], look: [1.3, -3.4, 2.0] }, // Öykü + Sude, tracking in front of the stage
  { t: 11.5, from: [-1.3, .8, 3.0], to: [-.9, 2.0, 2.8], look: [1.4, 3.9, 2.0] }, // Umay on bass, from the stage lip above the crowd (portrait wides cut her off)
  { t: 13.5, from: [-5, 0, 2.3], to: [-13, 0, 5.8], look: [1.5, 0, 2.6] },        // crane out
];
function gigCamera(dt, t) {
  const T0 = gig.t; let k = 0; while (k < GIG_SHOTS.length - 1 && T0 >= GIG_SHOTS[k + 1].t) k++;
  const sh = GIG_SHOTS[k], end = k < GIG_SHOTS.length - 1 ? GIG_SHOTS[k + 1].t : GIG_LEN + 1.2;
  const u = clamp((T0 - sh.t) / (end - sh.t), 0, 1), e = u * u * (3 - 2 * u);
  const so = lerp(sh.from[0], sh.to[0], e), la = lerp(sh.from[1], sh.to[1], e), hh = lerp(sh.from[2], sh.to[2], e);
  const wide = camera.aspect < .8 && k === 0 ? 1.25 : 1; // portrait: start a bit further back
  const p = segPoint(seg, gig.s0 + so * wide, la, tmp).setY(hh), lk = segPoint(seg, gig.s0 + sh.look[0], sh.look[1], tmp2).setY(sh.look[2]);
  p.x += Math.sin(t * 1.7) * .04; p.y += Math.sin(t * 2.3) * .03; // handheld feel
  const cut = gig.lastShot !== k; gig.lastShot = k;
  if (cut && k > 0 && k !== 1 && k !== 6) camera.position.copy(p); else camera.position.lerp(p, Math.min(1, dt * 4));
  gig.look = cut && k > 0 && k !== 1 && k !== 6 ? lk.clone() : (gig.look || lk.clone()).lerp(lk, Math.min(1, dt * 5));
  camera.lookAt(gig.look);
}
function canStartGig() { return seg.len - s > 46 && s > 6; }
function startGig() {
  state = 'gig'; gigPending = false;
  const s0 = s + 9; // stage front
  for (const o of seg.objs) if (o.mesh && o.s > s - 2 && o.s < s0 + 30) { o.mesh.visible = false; o.done = true; }
  for (const ch of seg.group.children) if (ch.userData.overhead !== undefined && ch.userData.overhead > s0 - 22 && ch.userData.overhead < s0 + 8) ch.visible = false; // laundry lines would hang in front of the stage
  const stage = gigStage(); put(seg, stage, s0, 0, 0);
  gig = { t: 0, s0, stage, band: [], props: [], savedSpeed: speed, startS: s, startLat: lat };
  gigVideo.play().then(() => { stage.userData.screen.material.map = gigVideoTex; stage.userData.screen.material.needsUpdate = true; }).catch(() => { });
  gig.props.push(gigAudience(s0));
  gig.pg = makePhotographer(); if (gig.pg) { gig.pg.holder.position.copy(segPoint(seg, s0 - 1.0, -4.3)); gig.pg.mixer?.update(0); faceTo(gig.pg, segPoint(seg, s0 + 1.5, -1.5)); }
  score += 1000; crowdCheer(3, .26); showMsg('OD BAND KONSERİ!', 2.2); flash('#ffcf4a', .45); $('mult').classList.add('hide');
  for (let i = 0; i < NGIRLS; i++) {
    const girl = i === sel ? player : makeGirl(i); if (i !== sel) scene.add(girl.holder);
    const [gl, gs, role] = GIG_SPOTS[i];
    const target = segPoint(seg, s0 + gs, gl); target.y = role === 'drums' ? 1.35 : .9;
    if (i !== sel) { const from = segPoint(seg, s0 + gs, gl < 0 ? -9 : 9); from.y = .9; girl.holder.position.copy(from); playAct(girl, 'run', .1, 1); }
    girl.gig = { target, role, from: girl.holder.position.clone(), arrived: false };
    gig.band.push(girl);
  }
  // instruments
  const kit = drumKit(); const kp = segPoint(seg, s0 + 3.2 - .55, 1.9); kit.position.copy(kp).setY(1.35); kit.rotation.y = yawOf(seg.dir) + (PROPS.drums ? Math.PI : 0); scene.add(kit); gig.props.push(kit);
  const mic = micStand(); const mp = segPoint(seg, s0 + .45, -.3); mic.position.copy(mp).setY(.9); scene.add(mic); gig.props.push(mic);
}
let gigPending = false; const _gv = new THREE.Vector3();
// two coloured wash lights live in the scene from the start (intensity 0) so the gig never triggers a shader recompile
const stageLights = [new THREE.PointLight(0xff3d9a, 0, 14, 1.2), new THREE.PointLight(0x4de1ff, 0, 14, 1.2)]; stageLights.forEach(l => scene.add(l));
function updateGig(dt, t) {
  gig.t += dt; const T0 = gig.t;
  const face = yawOf(seg.dir) + Math.PI; // band faces the audience (back toward where we came from)
  for (const g of gig.band) {
    const st = g.gig; g.mixer?.update(dt);
    if (!st.arrived) {
      const to = tmp2.copy(st.target).sub(g.holder.position); const d = to.length();
      if (d < .1 || T0 > 2.2) { g.holder.position.copy(st.target); st.arrived = true; startPlaying(g); }
      else { to.normalize(); g.holder.position.addScaledVector(to, Math.min(d, 6 * dt)); to.y = 0; if (to.lengthSq() > .001) g.holder.rotation.y = Math.atan2(-to.x, -to.z); }
    } else g.holder.rotation.y = angLerp(g.holder.rotation.y, face, Math.min(1, dt * 6));
    if (st.arrived && st.role === 'drums' && g.bones) { // procedural drumming on top of the sitting pose
      const k = Math.sin(t * 14), k2 = Math.sin(t * 14 + Math.PI);
      if (g.bones.r) g.bones.r.rotation.x += k * .35; if (g.bones.l) g.bones.l.rotation.x += k2 * .35;
    }
    if (st.arrived && (st.role === 'guitar' || st.role === 'bass') && g.bones?.r) g.bones.r.rotation.z += Math.sin(t * 16) * .18; // strumming
    if (g.guitar && g.spineBone) { g.holder.updateMatrixWorld(true); g.spineBone.getWorldPosition(_gv); g.holder.worldToLocal(_gv); g.guitar.position.set(_gv.x + .04, _gv.y - .24, _gv.z - .2); }
  }
  for (const b of gig.stage.userData.beams) { b.rotation.z = Math.sin(t * 1.3 + b.userData.ph) * .5; b.rotation.x = Math.PI + Math.sin(t * .9 + b.userData.ph) * .4; }
  const left = Math.ceil(GIG_LEN + 1.2 - T0); if (left >= 0 && left <= GIG_LEN) $('hint').textContent = `🎸 KONSER ${left}`, $('hint').style.opacity = 1;
  score += dt * 40;
  if (gig.pg) { gig.pg.mixer?.update(dt); if ((gig.pg.flashT -= dt) <= 0) { gig.pg.flashT = rand(.9, 2.2); photographerFlash(gig.pg); gig.pg.aim = segPoint(seg, gig.s0 + rand(.5, 3), rand(-4, 4)); } if (gig.pg.aim) faceTo(gig.pg, gig.pg.aim, Math.min(1, dt * 4)); holdCamera(gig.pg); }
  if (T0 > 1.2 && T0 < GIG_LEN + .8) { const W = ROAD_W + 5;
    for (const sx of [-W / 2 + .5, W / 2 - .5]) { const p = segPoint(seg, gig.s0 + .1, sx, tmp2); p.y = 1.15; for (let k = 0; k < 3; k++) emit(p, Math.random() < .5 ? 0xffd36b : 0xfff1c4, rand(-.5, .5), rand(6, 9), rand(-.5, .5), rand(.5, .9)); }
    for (let k = 0; k < 3; k++) { const p = segPoint(seg, gig.s0 + rand(-6, 3), rand(-W / 2, W / 2), tmp2); p.y = rand(6, 8); emit(p, pick([0xff3d9a, 0x4de1ff, 0xffcf4a, 0xffffff, 0xe8433b]), rand(-.6, .6), rand(.5, 1.5), rand(-.6, .6), rand(1, 1.6)); }
    const k = Math.min(1, (T0 - 1.2) * 2) * (T0 > GIG_LEN + .3 ? 0 : 1);
    stageLights[0].position.copy(segPoint(seg, gig.s0 + 1.5, -3.5 + Math.sin(t * 1.3) * 2, tmp2)).setY(4.5); stageLights[0].intensity = 18 * k;
    stageLights[1].position.copy(segPoint(seg, gig.s0 + 1.5, 3.5 + Math.sin(t * 1.1 + 2) * 2, tmp2)).setY(4.5); stageLights[1].intensity = 18 * k;
  }
  if (T0 > GIG_LEN + 1.2) startPhoto();
}
function startPlaying(g) {
  const role = g.gig.role; g.bones = {};
  g.holder.traverse(o => { if (o.isBone) { if (o.name === 'RightForeArm') g.bones.r = o; if (o.name === 'LeftForeArm') g.bones.l = o; } });
  if (role === 'drums') { playAct(g, g.actions.sit ? 'sit' : 'idle', .3, 1); const sl = new THREE.Mesh(G.cyl, M.stick), sr = sl.clone(); sl.scale.set(.012, .42, .012); sr.scale.copy(sl.scale);
    const wl = wrap(sl), wr = wrap(sr); attachToBone(g, 'LeftHand', wl, [0, .08, 0], [1.2, 0, 0]); attachToBone(g, 'RightHand', wr, [0, .08, 0], [1.2, 0, 0]); gig.props.push(wl, wr); }
  else if (role === 'vocal') playAct(g, g.actions.singdance ? 'singdance' : 'cheer', .3, 1);
  else { playAct(g, g.actions.groove ? 'groove' : 'idle', .3, rand(.9, 1.05)); const gt = guitarProp(gig.band.indexOf(g), role === 'bass'); g.holder.add(gt); gt.rotation.set(0, Math.PI, role === 'bass' ? -.95 : -.85); g.guitar = gt; g.holder.traverse(o => { if (o.isBone && o.name === 'Spine01') g.spineBone = o; }); gig.props.push(gt); } // held across the body: neck up to her left, front to the crowd
}
function wrap(m) { const g = new THREE.Group(); g.add(m); return g; }
function endGig() {
  // the others wave goodbye and vanish, the chosen girl jumps off the stage and keeps running
  for (const g of gig.band) if (g !== player) scene.remove(g.holder);
  for (const p of gig.props) p.parent?.remove(p);
  gigVideo.pause(); stageLights.forEach(l => l.intensity = 0);
  gig.stage.parent?.remove(gig.stage);
  flash('#ffffff', .5);
  s = gig.s0 + 1; lat = 0; lane = 0; py = 0; vy = 0;
  speed = Math.max(13, gig.savedSpeed * .85); gap = 1; stumbleT = 0;
  player.holder.rotation.y = yawOf(seg.dir); player.inner.rotation.set(0, Math.PI, 0);
  playAct(player, 'run', .2, 1.15); gig = null; state = 'run';
  $('hint').style.opacity = 0; showMsg('KOŞ!', 1);
}

// ------------------------------------------------------------------ after the gig: 5 fans line up for a photo with her (timing mini-game)
// a needle sweeps a bar; tap to take the shot — the closer to the centre, the more points. The photographer (our DoP) takes the pictures.
const PHOTO_N = 5;
let photo = null, PHOTOG = null, captureNext = null;
// fans for the photo session: Quaternius "Ultimate Animated Character" pack (CC0, poly.pizza), trimmed to Idle/Walk/Wave
const FANS = [];
function loadFans() { for (let i = 1; i <= 6; i++) loader.load(`models/fans/fan${i}.glb`, g => { g.scene.traverse(o => { if (o.isMesh && o.material) { o.material.metalness = 0; o.material.roughness = Math.max(.7, o.material.roughness ?? 1); } }); FANS.push(g); }); }
function loadPhotographer() { return new Promise(res => loader.load('models/fotografci.glb', g => { PHOTOG = prepGirl(g); res(); }, undefined, () => res())); }
function makePerson(gltf) { // animated Quaternius fan (CC0)
  const m = SkeletonUtils.clone(gltf.scene); const b = new THREE.Box3().setFromObject(gltf.scene); const k = 1.72 / (b.max.y - b.min.y);
  const holder = new THREE.Group(); m.scale.setScalar(k); m.position.y = -b.min.y * k; holder.add(m); m.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const mixer = new THREE.AnimationMixer(m), clip = n => gltf.animations.find(c => c.name.toLowerCase().includes(n));
  const act = {}; for (const n of ['walk', 'idle', 'clapping', 'standing', 'wave']) { const c = clip(n); if (c) act[n] = mixer.clipAction(c); }
  // ground the skinned model by its lowest foot bone after posing (the bind-pose bbox sits them in the floor)
  mixer.update(0); holder.updateMatrixWorld(true); let minY = Infinity; const v = new THREE.Vector3(); m.traverse(o => { if (o.isBone && /foot|toe/i.test(o.name)) { o.getWorldPosition(v); minY = Math.min(minY, v.y); } }); if (isFinite(minY)) m.position.y += .06 - minY;
  return { holder, mixer, act, cur: null, play(n, f = .2) { const a = this.act[n] || this.act.idle; if (!a || a === this.cur) return; a.reset().fadeIn(f).play(); this.cur?.fadeOut(f); this.cur = a; } };
}
// real facing of a rigged character, measured from its head bones (models were exported with different 'fronts')
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _faceT = new THREE.Vector3();
function bonesOf(g) { if (!g.bones2) { g.bones2 = {}; g.holder.traverse(o => { if (o.isBone) g.bones2[o.name] = o; }); } return g.bones2; }
function forwardOf(g, out = new THREE.Vector3()) {
  const b = bonesOf(g); g.holder.updateMatrixWorld(true);
  if (b.RightShoulder && b.LeftShoulder) { b.RightShoulder.getWorldPosition(_fa); b.LeftShoulder.getWorldPosition(_fb); _fa.sub(_fb); _fa.y = 0; out.crossVectors(_up, _fa); if (g.flipFwd) out.negate(); if (out.lengthSq() > 1e-8) return out.normalize(); } // forward = up × (right shoulder − left shoulder)
  return out.set(-Math.sin(g.holder.rotation.y), 0, -Math.cos(g.holder.rotation.y));
}
function faceTo(g, target, k = 1) { const tx = target.x, tz = target.z; const f = forwardOf(g, new THREE.Vector3()); const want = Math.atan2(tx - g.holder.position.x, tz - g.holder.position.z), have = Math.atan2(f.x, f.z); g.holder.rotation.y = angLerp(g.holder.rotation.y, g.holder.rotation.y + (want - have), k); }
// analytic two-bone IK: put the hand on `target`, elbow bending toward `poleDir`
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _S = new THREE.Vector3(), _E = new THREE.Vector3(), _H = new THREE.Vector3(), _T = new THREE.Vector3(), _P = new THREE.Vector3();
function aimBone(bone, from, to, want) { // rotate bone so the vector (to-from) points along (want-from)
  _v1.subVectors(to, from).normalize(); _v2.subVectors(want, from).normalize(); _q1.setFromUnitVectors(_v1, _v2);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q1); const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert(); bone.quaternion.copy(pq.multiply(_q2)); bone.updateMatrixWorld(true);
}
function armIK(arm, fore, hand, target, poleDir) {
  arm.getWorldPosition(_S); fore.getWorldPosition(_E); hand.getWorldPosition(_H); _T.copy(target);
  const a = _S.distanceTo(_E), b = _E.distanceTo(_H); const dir = _v1.subVectors(_T, _S); const d = Math.min(Math.max(dir.length(), .02), a + b - .002); dir.normalize();
  const x = (a * a - b * b + d * d) / (2 * d), y = Math.sqrt(Math.max(0, a * a - x * x));
  _P.copy(poleDir).addScaledVector(dir, -poleDir.dot(dir)).normalize();
  const elbow = new THREE.Vector3().copy(_S).addScaledVector(dir, x).addScaledVector(_P, y);
  aimBone(arm, _S.clone(), _E.clone(), elbow);
  fore.getWorldPosition(_E); hand.getWorldPosition(_H); aimBone(fore, _E.clone(), _H.clone(), _T);
}
const _up = new THREE.Vector3(0, 1, 0);
function holdCamera(pg) { // after the idle pose: hands on the camera in front of his eyes
  const b = bonesOf(pg); if (!b.Head || !b.RightArm || !b.LeftArm) return;
  const f = forwardOf(pg, new THREE.Vector3()), r = new THREE.Vector3().crossVectors(f, _up).normalize();
  const head = b.Head.getWorldPosition(new THREE.Vector3()); const cam = head.clone().addScaledVector(f, .2).addScaledVector(_up, -.02);
  pg.cam.position.copy(cam); pg.cam.lookAt(cam.clone().sub(f));
  const k = pg.flipFwd ? -1 : 1; // swapped rig: the bone called "Right" is his left arm
  armIK(b.RightArm, b.RightForeArm, b.RightHand, cam.clone().addScaledVector(r, .08 * k).addScaledVector(_up, -.03), r.clone().multiplyScalar(.3 * k).addScaledVector(_up, -1).addScaledVector(f, .25));
  armIK(b.LeftArm, b.LeftForeArm, b.LeftHand, cam.clone().addScaledVector(r, -.08 * k).addScaledVector(_up, -.05).addScaledVector(f, .04), r.clone().multiplyScalar(-.3 * k).addScaledVector(_up, -1).addScaledVector(f, .25));
}
function makePhotographer() { // our DoP with his camera (falls back to a crowd man if his model is missing)
  let pg = null;
  if (PHOTOG) { pg = makeGirl(-1); playAct(pg, 'idle', 0, 1); } else if (CROWD.raw?.[0]) { pg = makePerson(CROWD.raw[0]); pg.play('idle', 0); }
  if (!pg) return null; scene.add(pg.holder);
  const cam = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(.16, .11, .09), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .5 })); cam.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.04, .045, .12, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .3, metalness: .5 })); lens.rotation.x = Math.PI / 2; lens.position.z = -.09; cam.add(lens);
  scene.add(cam); pg.cam = cam; pg.flashT = 1; return pg;
}
function photographerFlash(pg) { const p = pg.cam.getWorldPosition(new THREE.Vector3()); for (let k = 0; k < 14; k++) emit(p, 0xffffff, rand(-1.5, 1.5), rand(-.5, 1.5), rand(-1.5, 1.5), .18); sfx(2600, .03, 'square', .015); }
function startPhoto() {
  // clear the stage, keep the chosen girl in front of it
  for (const g of gig.band) if (g !== player) scene.remove(g.holder);
  for (const p of gig.props) p.parent?.remove(p);
  gigVideo.pause(); stageLights.forEach(l => l.intensity = 0);
  const s0 = gig.s0; gig.stage.visible = true; // stage stays as the backdrop
  state = 'photo'; flash('#ffffff', .35);
  const spot = segPoint(seg, s0 - 2.2, -.45); player.holder.position.copy(spot); player.holder.position.y = 0;
  const face = yawOf(seg.dir) + Math.PI; player.holder.rotation.y = face; player.inner.rotation.set(0, Math.PI, 0); playAct(player, 'idle', .3, 1);
  const pg = gig.pg || makePhotographer(); gig.pg = null;
  if (pg) { pg.holder.position.copy(segPoint(seg, s0 - 7.2, .2)); pg.holder.parent || scene.add(pg.holder); pg.mixer?.update(0); faceTo(pg, segPoint(seg, s0 - 2.2, 0)); }
  $('hint').style.opacity = 0;
  photo = { s0, n: 0, phase: 'walk', t: 0, fan: null, pg, total: 0, needle: 0, dir: 1, speed: 1.1, shots: [] };
  nextFan(); $('photoUi').classList.remove('hide'); showMsg('HAYRANLAR FOTOĞRAF İSTİYOR!', 2);
}
function nextFan() {
  if (photo.fan) scene.remove(photo.fan.holder);
  if (photo.n >= PHOTO_N) return endPhoto();
  const pool = FANS.length ? FANS : CROWD.raw || []; if (!photo.order) photo.order = [...pool.keys()].sort(() => Math.random() - .5);
  const raw = pool[photo.order[photo.n % pool.length]];
  const fan = raw ? makePerson(raw) : { holder: new THREE.Mesh(new THREE.CapsuleGeometry(.25, 1, 4, 8), new THREE.MeshStandardMaterial({ color: 0x5577aa })), mixer: null, play() { } };
  if (!raw) fan.holder.position.y = .75;
  const side = photo.n % 2 ? 1 : -1; fan.from = segPoint(seg, photo.s0 - 2.4, side * 5.2); fan.to = segPoint(seg, photo.s0 - 2.25, .45);
  fan.holder.position.copy(fan.from); fan.holder.position.y = raw ? 0 : .75; scene.add(fan.holder); fan.play('walk', 0);
  photo.fan = fan; photo.phase = 'walk'; photo.t = 0; photo.speed = .5 + photo.n * .1; photo.needle = Math.random(); photo.dir = 1;
  $('photoBar').classList.add('dim'); $('photoCount').textContent = `${photo.n + 1} / ${PHOTO_N}`; $('photoRes').textContent = '';
}
function updatePhoto(dt, t) {
  const P = photo, fan = P.fan; P.t += dt; fan.mixer?.update(dt); player.mixer?.update(dt); P.pg?.mixer?.update(dt);
  if (P.pg) { faceTo(P.pg, segPoint(seg, P.s0 - 2.2, 0, _faceT), Math.min(1, dt * 6)); holdCamera(P.pg); faceTo(player, _faceT.copy(P.pg.holder.position), Math.min(1, dt * 6)); }
  const face = yawOf(seg.dir) + Math.PI;
  if (P.phase === 'walk') {
    const to = tmp2.copy(fan.to).sub(fan.holder.position); to.y = 0; const d = to.length();
    if (d < .08) { P.phase = 'aim'; P.t = 0; fan.play('standing') || fan.play('idle'); fan.holder.rotation.y = yawOf(seg.dir); $('photoBar').classList.remove('dim'); hint(MOBILE ? 'ekrana dokun: ÇEK!' : 'boşluk / tıkla: ÇEK!', 2); }
    else { to.normalize(); fan.holder.position.addScaledVector(to, Math.min(d, 4.4 * dt)); if (fan.act?.walk) fan.act.walk.timeScale = 1.6; fan.holder.rotation.y = Math.atan2(to.x, to.z); }
  } else if (P.phase === 'aim') {
    P.needle += P.dir * P.speed * dt; if (P.needle > 1) { P.needle = 2 - P.needle; P.dir = -1; } if (P.needle < 0) { P.needle = -P.needle; P.dir = 1; }
    $('photoNeedle').style.left = (P.needle * 100) + '%';
    fan.holder.rotation.y = yawOf(seg.dir);
    if (P.t > 7) shoot(); // too slow: blurry shot
  } else if (P.phase === 'after') {
    if (P.t > .55 && P.t < .6) { fan.play('walk'); }
    if (P.t > .55) { const to = tmp2.copy(fan.from).sub(fan.holder.position); to.y = 0; const d = to.length(); if (d > .1) { to.normalize(); fan.holder.position.addScaledVector(to, Math.min(d, 5 * dt)); fan.holder.rotation.y = Math.atan2(to.x, to.z); } }
    if (P.t > 1.35) { P.n++; nextFan(); }
  }
  // camera over the photographer's shoulder, framing her + the fan
  const mid = segPoint(seg, P.s0 - 2.2, 0, tmp2).setY(1.3), back = segPoint(seg, P.s0 - 10.0, .45, tmp); back.y = 2.45; // right behind him, a little above his shoulder
  camera.position.lerp(back, Math.min(1, dt * 3)); camera.lookAt(mid);
}
function shoot() {
  const P = photo; if (!P || P.phase !== 'aim') return;
  const d = Math.abs(P.needle - .5); const [pts, label] = d < .05 ? [100, 'MÜKEMMEL!'] : d < .14 ? [60, 'SÜPER'] : d < .28 ? [30, 'İYİ'] : [10, 'BULANIK'];
  P.total += pts; score += pts; P.phase = 'after'; P.t = 0;
  flash('#ffffff', .9); sfx(2200, .05, 'square', .06); setTimeout(() => sfx(1400, .06, 'square', .05), 70); noise(.08, .12, 5000);
  P.fan.play(P.fan.act?.clapping ? 'clapping' : 'wave'); $('photoRes').textContent = `${label} +${pts}`; $('photoBar').classList.add('dim'); buzz(40);
  captureNext = { n: P.n + 1, pts, label };
}
function showPolaroid(url, info) {
  const el = document.createElement('div'); el.className = 'polaroid'; el.style.setProperty('--r', `${rand(-8, 8)}deg`);
  el.innerHTML = `<img src="${url}" alt=""><span>${BAND[sel].name} &amp; hayran #${info.n} · ${info.label} +${info.pts}</span>`; $('photoUi').appendChild(el);
  setTimeout(() => el.classList.add('out'), 1600); setTimeout(() => el.remove(), 2300);
}
function endPhoto() {
  const P = photo; if (P.pg) { scene.remove(P.pg.holder); P.pg.cam?.parent?.remove(P.pg.cam); } if (P.fan) scene.remove(P.fan.holder);
  $('photoUi').classList.add('hide'); showMsg(`FOTOĞRAFLAR +${P.total}`, 1.6); photo = null;
  endGig();
}

// ------------------------------------------------------------------ particles (sparkles + dust), one Points cloud
const PMAX = 900, pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pCloud = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .22, map: T.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pCloud.frustumCulled = false; scene.add(pCloud);
let pNext = 0; const _pc = new THREE.Color();
function emit(p, col, vx, vy, vz, life) { const i = pNext; pNext = (pNext + 1) % PMAX; pPos.set([p.x, p.y, p.z], i * 3); _pc.set(col); pCol.set([_pc.r, _pc.g, _pc.b], i * 3); pVel.set([vx, vy, vz], i * 3); pLife[i] = life; }
function burst(p, col, n) { for (let k = 0; k < n; k++) emit(p, col, rand(-3, 3), rand(1, 5), rand(-3, 3), rand(.35, .7)); }
let dustT = 0, stepPh = 0, stepFoot = 1;
const SMAX = 700, sPos = new Float32Array(SMAX * 3), sCol = new Float32Array(SMAX * 3), sVel = new Float32Array(SMAX * 3), sLife = new Float32Array(SMAX), sGrav = new Float32Array(SMAX); let sNext = 0;
const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
const dotTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.55, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const sCloud = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: .21, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, alphaTest: .04 })); sCloud.frustumCulled = false; scene.add(sCloud);
for (let i = 0; i < SMAX; i++) sPos[i * 3 + 1] = -99;
function sEmit(x, y, z, col, vx, vy, vz, life, grav) { const i = sNext; sNext = (sNext + 1) % SMAX; sPos.set([x, y, z], i * 3); _pc.set(col); sCol.set([_pc.r, _pc.g, _pc.b], i * 3); sVel.set([vx, vy, vz], i * 3); sLife[i] = life; sGrav[i] = grav; }
const STEP_FX = {
  green: { cols: [0x5d9a36, 0x7fbf4d, 0x3e7428, 0x9a7a52], extra: [0xffd6e8, 0xfff08a], n: 7, up: [1.2, 2.6], spread: .9, back: 1.4, grav: 7, life: [.35, .6] },   // grass bits, now and then a petal
  stone: { cols: [0xc9c2b8, 0xb3aba0, 0xd8d2c8], extra: [0x6e665e], n: 6, up: [.3, .9], spread: .6, back: .6, grav: 1.2, life: [.45, .8] },                 // dusty puff, a pebble
  beach: { cols: [0xead0a2, 0xdcbb84, 0xf3dcb4], extra: [0xffffff], n: 9, up: [1.4, 3.0], spread: 1.1, back: 2.2, grav: 9, life: [.3, .55] },              // sand spray
  concert: { cols: [0xff4fa3, 0x4de1ff, 0xffd23a, 0xa66bff], extra: [0xffffff], n: 6, up: [.8, 2.0], spread: 1.2, back: .8, grav: 4, life: [.4, .7], glow: true }, // glitter
  night: { cols: [0xff3d9a, 0x4de1ff], extra: [0xffffff], n: 5, up: [.6, 1.4], spread: .8, back: .6, grav: 3, life: [.35, .6], glow: true },
};
const _fp = new THREE.Vector3(), footSt = [{ min: .12, armed: true }, { min: .12, armed: true }];
// floating ambience around the runner: pollen, dust motes, sea spray, concert confetti
const AMB = {
  green: { cols: [0xfff6b0, 0xeaffb8, 0xffffff], y: [.4, 4], v: .35, vy: .2, grav: -.04 },
  stone: { cols: [0xfff0d8, 0xffe2c0], y: [.5, 5], v: .25, vy: .05, grav: -.01 },
  beach: { cols: [0xffffff, 0xffe9c8, 0xd8f4ff], y: [.2, 3], v: .9, vy: .3, grav: .15 },
  concert: { cols: [0xff4fa3, 0x4de1ff, 0xffd23a, 0xa66bff, 0xffffff], y: [4, 8], v: .8, vy: -.4, grav: .6 },
};
let ambT = 0;
function ambience(dt) {
  if (state !== 'run' || !player) return; ambT -= dt;
  while (ambT < 0) { ambT += MOBILE ? .07 : .035; const A = AMB[worldAt(seg, s)]; if (!A) return;
    const d = DIRS[seg.dir], r = DIRS[(seg.dir + 1) % 4], p = player.holder.position, ahead = rand(3, 32), sd = rand(-13, 13);
    sEmit(p.x + d[0] * ahead + r[0] * sd, rand(A.y[0], A.y[1]), p.z + d[1] * ahead + r[1] * sd, pick(A.cols), rand(-A.v, A.v), A.vy + rand(-.15, .15), rand(-A.v, A.v), rand(2.2, 3.6), A.grav); }
}
// soft contact shadow under the runner: grounds jumps and flights
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
blob.rotation.x = -Math.PI / 2; blob.renderOrder = 2; scene.add(blob);
function footstep(fp) { // particles come out right where the foot lands
  if (params.has('stepdbg')) { (window.__st ||= []).push([+fp.x.toFixed(2), +fp.y.toFixed(2), +fp.z.toFixed(2), +player.holder.position.x.toFixed(2), +player.holder.position.z.toFixed(2)]); }
  const w = worldAt(seg, s), fx = STEP_FX[w] || STEP_FX.stone, d = DIRS[seg.dir], r = DIRS[(seg.dir + 1) % 4];
  const x = fp.x, z = fp.z;
  for (let k = 0; k < Math.round(fx.n * 1.6); k++) { const col = Math.random() < .12 ? pick(fx.extra) : pick(fx.cols), sp = rand(-fx.spread, fx.spread), bk = rand(.2, 1) * fx.back;
    const vx = r[0] * sp - d[0] * bk, vz = r[1] * sp - d[1] * bk, vy = rand(fx.up[0], fx.up[1]);
    if (fx.glow) emit(tmp2.set(x, .1, z), col, vx, vy, vz, rand(fx.life[0], fx.life[1])); else sEmit(x + rand(-.05, .05), .05, z + rand(-.05, .05), col, vx, vy, vz, rand(fx.life[0], fx.life[1]), fx.grav); }
}
function updateParticles(dt) {
  if (state === 'run' && player && py === 0 && !sliding && flyT <= 0) { const b = bonesOf(player);
    ['Left', 'Right'].forEach((side, k) => { const bone = b[side + 'ToeBase'] || b[side + 'Foot']; if (!bone) return; bone.getWorldPosition(_fp); const st = footSt[k], y = _fp.y; st.min = Math.min(y, st.min + dt * .05);
      if (st.armed && y < st.min + .05) { st.armed = false; footstep(_fp); } // planted: puff right under that foot
      else if (!st.armed && y > st.min + .14) st.armed = true; }); }
  for (let i = 0; i < SMAX; i++) { if (sLife[i] <= 0) { if (sPos[i * 3 + 1] > -50) sPos[i * 3 + 1] = -99; continue; } sLife[i] -= dt; sVel[i * 3 + 1] -= sGrav[i] * dt; const drag = 1 - Math.min(1, dt * 1.8); sVel[i * 3] *= drag; sVel[i * 3 + 2] *= drag;
    sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] = Math.max(.02, sPos[i * 3 + 1] + sVel[i * 3 + 1] * dt); sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt; if (sLife[i] <= 0) sPos[i * 3 + 1] = -99; }
  ambience(dt);
  blob.visible = (state === 'run' || state === 'down') && !!player; if (blob.visible) { const p = player.holder.position; blob.position.set(p.x, .025, p.z); const k = 1 / (1 + py * .35); blob.scale.setScalar(k); blob.material.opacity = Math.max(.15, k); }
  sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true;
  for (let i = 0; i < PMAX; i++) { if (pLife[i] <= 0) { pPos[i * 3 + 1] = -99; continue; } pLife[i] -= dt; pVel[i * 3 + 1] -= 9 * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; const f = Math.max(0, pLife[i]) * 1.6; pCol[i * 3] *= .985; pCol[i * 3 + 1] *= .985; pCol[i * 3 + 2] *= .985; }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
// adaptive resolution: if the phone can't hold ~45 fps, render fewer pixels
let fpsAcc = 0, fpsN = 0, prLevel = 0; const PR_STEPS = MOBILE ? [1.5, 1.2, 1.0, .85] : [1.75, 1.4, 1.1];
function adaptResolution(dt) {
  if (state !== 'run') return; fpsAcc += dt; fpsN++;
  if (fpsAcc > 2) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    const next = fps < 45 ? Math.min(prLevel + 1, PR_STEPS.length - 1) : fps > 58 ? Math.max(prLevel - 1, 0) : prLevel;
    if (next !== prLevel) { prLevel = next; const pr = Math.min(devicePixelRatio, PR_STEPS[prLevel]); renderer.setPixelRatio(pr); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); } }
}
// ------------------------------------------------------------------ lyrics (forced-aligned to the vocal stem, assets/burdayim_sozler.json)
let LYR = [], lyrKey = '';
function loadLyrics() { fetch('assets/burdayim_sozler.json').then(r => r.json()).then(j => LYR = j).catch(() => { }); }
function updateLyrics() {
  const el = $('lyric'); if (!el) return;
  if (!LYR.length || state === 'menu' || state === 'over' || songIdx !== 0) { if (lyrKey) { el.classList.remove('show'); lyrKey = ''; } return; }
  const ct = songTime(); const L = LYR.find(l => ct >= l.s - .25 && ct <= l.e + .9);
  if (!L) { if (lyrKey) { el.classList.remove('show'); lyrKey = ''; } return; }
  const k = L.w.filter(w => w.s <= ct).length, key = L.s + ':' + k; if (key === lyrKey) return; lyrKey = key;
  el.innerHTML = L.w.map((w, i) => `<span class="${i < k ? 'on' : ''}">${w.w}</span>`).join(' '); el.classList.add('show');
}
// ------------------------------------------------------------------ main loop
function frame() {
  const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
  if (state !== 'loading') { update(dt, t); updateParticles(dt); adaptResolution(dt); updateLyrics(); }
  if (state === 'run') { const f = (camera.aspect < .8 ? 70 : 58) + (speed - 13) * .45; if (Math.abs(camera.fov - f) > .05) { camera.fov += (f - camera.fov) * Math.min(1, dt * 2); camera.updateProjectionMatrix(); } }
  composer.render();
  if (captureNext) {
    try {
      const pg = photo?.pg; const saveP = camera.position.clone(), saveQ = camera.quaternion.clone(), saveF = camera.fov;
      if (pg?.cam) { pg.holder.visible = false; pg.cam.visible = false; camera.position.copy(pg.cam.position); camera.lookAt(segPoint(seg, photo.s0 - 2.2, 0, tmp2).setY(1.25)); camera.fov = 34; camera.updateProjectionMatrix(); $('photoUi').style.visibility = 'hidden'; composer.render(); }
      const url = renderer.domElement.toDataURL('image/jpeg', .72);
      if (pg?.cam) { pg.holder.visible = true; pg.cam.visible = true; camera.position.copy(saveP); camera.quaternion.copy(saveQ); camera.fov = saveF; camera.updateProjectionMatrix(); $('photoUi').style.visibility = ''; composer.render(); }
      showPolaroid(url, captureNext);
    } catch (e) { }
    captureNext = null;
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ boot
(async () => {
  setWorld('beach', true);
  requestAnimationFrame(frame);
  await withTimeout(document.fonts.ready, 3000);
  const propsP = loadProps(); loadCrowdModels(); loadPhotographer(); loadLyrics(); const envP = loadEnv().then(() => loadEnvExtra());
  await loadGirls(p => { $('lbar').style.width = (p * 100) + '%'; $('ltxt').textContent = `karakterler yükleniyor… ${Math.round(p * 100)}%`; });
  if (LOOK === 2 && !LOOK_TPL[2].some(Boolean)) { LOOK = 1; girlTemplates = LOOK_TPL[1]; localStorage.setItem('od3_look', '1'); buildFaces(); updateLookBtn(); await loadGirls(p => { $('lbar').style.width = (p * 100) + '%'; }); }
  await withTimeout(Promise.all([envP, propsP]), 8000);
  $('loading').classList.add('hide');
  if (params.has('sel')) sel = +params.get('sel');
  toMenu();
  if (params.has('wait')) await new Promise(r => setTimeout(r, +params.get('wait') || 6000)); // debug: let lazy assets arrive
  window.chkRoad = () => { // debug: which scenery pokes into a road
    const H = ROAD_W / 2, bad = {}; const box = new THREE.Box3(), inv = new THREE.Matrix4(), lb = new THREE.Box3();
    for (const sg of segs) { sg.group.updateMatrixWorld(true); const keep = new Set(sg.objs.map(o => o.mesh));
      for (const ch of sg.group.children) { if (keep.has(ch) || ch.isMesh && ch.geometry?.type === 'PlaneGeometry') continue; box.setFromObject(ch); if (box.isEmpty() || box.max.y < .05) continue;
        for (const r of segs) { inv.copy(r.group.matrixWorld).invert(); lb.copy(box).applyMatrix4(inv); const ov = Math.min(lb.max.x, H - .2) - Math.max(lb.min.x, -H + .2), ovz = Math.min(lb.max.z, H) - Math.max(lb.min.z, -r.len - H);
          if (ov > 0 && ovz > 0 && box.max.y > .1 && box.min.y < 3.5) { let k = ch.userData.k; ch.traverse(o => { k ||= o.userData.k; }); k ||= (ch.isMesh ? 'mesh:' + ch.geometry.type : 'group' + ch.children.length); k += ' w=' + r.world + (r === sg ? '' : ' OTHERSEG ' + sg.n + '>' + r.n + ' ' + [lb.min.x, lb.max.x, lb.min.z, lb.max.z].map(v => v.toFixed(0)).join(',') + ' len' + r.len); bad[k] = (bad[k] || 0) + 1; } } } }
    console.log('CHK ' + JSON.stringify(bad)); };
  if (params.has('run')) { if (params.get('run')) sel = +params.get('run'); startRun(); if (params.has('modpu')) powerup(seg, s + 9, 0, 'mod'); if (params.has('fly')) { flyT = 5; magnet = 5; } if (params.has('sim')) { const n = +params.get('sim'); for (let i = 0; i < n && state === 'run'; i++) { if (params.has('auto')) autopilot(); if (i === n - 12 && params.has('jump')) act('up'); if (i === n - 20 && params.has('slide')) act('down'); update(1 / 60, i / 60); if (params.has('stepdbg')) { player.holder.updateMatrixWorld(true); updateParticles(1 / 60); } } if (params.has('gig')) { startGig(); for (let i = 0; i < +params.get('gig'); i++) update(1 / 60, i / 60); if (params.has('pshoot') && photo) { photo.needle = .5; shoot(); } } if (params.has('chk')) chkRoad(); if (params.has('lbshow')) setTimeout(lbShow, 1500); if (params.has('stepdbg')) setTimeout(() => console.log('STEPS ' + JSON.stringify((window.__st || []).slice(-6)) + ' n=' + (window.__st || []).length + '' + ' state=' + state + ' py=' + py + ' cur=' + (player.cur && player.cur.getClip().name)), 3000); if (params.has('pickc')) { const rc = new THREE.Raycaster(); camera.updateMatrixWorld(); rc.setFromCamera(new THREE.Vector2(0, -.1), camera); const hs = rc.intersectObjects(scene.children, true).slice(0, 6); console.log('PICK ' + hs.map(h => { let k = '', o = h.object; for (let q = o; q; q = q.parent) k ||= q.userData.k; return (k || o.type + ':' + (o.geometry?.type || '') + ':' + (o.material?.type || '')) + ' d' + h.distance.toFixed(2) + ' cam' + camera.position.toArray().map(v => v.toFixed(1)) + ' near' + camera.near; }).join(' | ')); } if (params.has('down')) { gameOver('Test'); for (let i = 0; i < +params.get('down'); i++) update(1 / 60, i / 60); } const d = document.createElement('div'); d.style.cssText = 'position:fixed;top:120px;left:10px;font:14px monospace;background:#000a;padding:6px;z-index:99'; d.textContent = `state=${state} segI=${segI} s=${s.toFixed(1)} len=${seg.len} turn=${seg.turn} turnQ=${turnQ} lane=${lane} lat=${lat.toFixed(2)} dist=${dist.toFixed(0)} reason=${$('overLine').textContent}`; document.body.appendChild(d); } }
})();

function autopilot() {
  if (s > seg.len - 6 && !turnQ) act(seg.turn === 'L' ? 'left' : 'right');
  for (const o of seg.objs) { if (o.done || !['low', 'high', 'block'].includes(o.t)) continue; const ds = o.s - s; if (ds < 0 || ds > 9 || o.lane !== lane) continue;
    if (o.t === 'low' && ds < 4.5 && py === 0) act('up'); else if (o.t === 'high' && ds < 4 && !sliding) act('down');
    else if (o.t === 'block') { const free = [-1, 0, 1].filter(l => l !== lane && !seg.objs.some(q => !q.done && q.lane === l && Math.abs(q.s - o.s) < 3 && q.t === 'block')); if (free.length) act(free[0] < lane ? 'left' : 'right'); } }
}
// debug hook for automated screenshots
window.__od = { act, get state() { return state; }, step(n) { for (let i = 0; i < n; i++) update(1 / 60, clock.elapsedTime + i / 60); } };
