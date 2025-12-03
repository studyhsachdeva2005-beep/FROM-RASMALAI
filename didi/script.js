// script.js (module)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js';

const threeContainer = document.getElementById('three-container');
const line1 = document.getElementById('line1');
const line2 = document.getElementById('line2');
const line3 = document.getElementById('line3');
const line4 = document.getElementById('line4');
const caption = document.getElementById('caption');
const card = document.getElementById('card');

let scene, camera, renderer, controls;
let cakeGroup = null;
let bgTexture = null;

// init Three scene
function initThree(){
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, threeContainer.clientWidth / threeContainer.clientHeight, 0.1, 1000);
  camera.position.set(0, 2.2, 7);

  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeContainer.appendChild(renderer.domElement);

  // lights
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enableZoom = false;

  // subtle ground plane
  const ggeom = new THREE.PlaneGeometry(40,40);
  const gmat = new THREE.MeshStandardMaterial({ color:0xffffff, metalness:0.0, roughness:1 });
  const ground = new THREE.Mesh(ggeom, gmat);
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -0.9;
  ground.receiveShadow = true;
  scene.add(ground);

  // initial background: pink/white check mock (we also overlay CSS)
  scene.background = null;

  window.addEventListener('resize', ()=> {
    renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
    camera.aspect = threeContainer.clientWidth / threeContainer.clientHeight;
    camera.updateProjectionMatrix();
  });
}

// create fake cake with cylinders if GLB missing
function buildCakeFallback(){
  const g = new THREE.Group();
  const layerMatPink = new THREE.MeshStandardMaterial({ color: 0xffc0d6, roughness:0.7 });
  const layerMatYellow = new THREE.MeshStandardMaterial({ color: 0xffe27a, roughness:0.7 });

  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,0.6,64), layerMatPink);
  c1.position.y = 0.2;
  g.add(c1);
  const c2 = new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,0.45,64), layerMatYellow);
  c2.position.y = 0.65;
  g.add(c2);
  const c3 = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.35,64), layerMatPink);
  c3.position.y = 1.0;
  g.add(c3);

  // plate
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,0.12,64), new THREE.MeshStandardMaterial({ color:0xf6f6f6 }));
  plate.position.y = -0.02;
  g.add(plate);

  // candles (small thin cylinders + tiny sphere flame)
  for(let i=0;i<6;i++){
    const ang = (i/6) * Math.PI * 2;
    const x = Math.cos(ang)*0.7;
    const z = Math.sin(ang)*0.7;
    const cand = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.45,16), new THREE.MeshStandardMaterial({ color:0xffffff }));
    cand.position.set(x, 1.28, z);
    g.add(cand);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07,16,8), new THREE.MeshStandardMaterial({ color:0xffa600, emissive:0xff8b00 }));
    flame.position.set(x, 1.52, z);
    g.add(flame);
  }

  return g;
}

// try load glb, fallback if not found
async function loadCake(){
  const loader = new GLTFLoader();
  const url = 'assets/cake.glb';
  try {
    const res = await new Promise((resolve,reject)=>{
      loader.load(url, resolve, undefined, reject);
    });
    const g = res.scene;
    g.traverse(n => {
      if(n.isMesh) n.castShadow = true;
    });
    g.scale.set(1.2,1.2,1.2);
    g.position.y = 0.1;
    return g;
  } catch(e){
    console.warn('cake.glb not found or failed to load — using fallback:', e);
    return buildCakeFallback();
  }
}

// change background to city image (Frame 6)
function setCityBackground(){
  const cityUrl = 'assets/city.jpg';
  const loader = new THREE.TextureLoader();
  loader.load(cityUrl, tex => {
    scene.background = tex;
    // also make ground reflective-ish by tinting
  }, undefined, ()=>{ console.warn('city background missing'); });
}

// spawn framed photos (Frame 6)
function spawnPhotos(){
  const photos = ['assets/photo1.jpg','assets/photo2.jpg','assets/photo3.jpg'];
  const planeGeom = new THREE.PlaneGeometry(0.9,0.6);
  photos.forEach((p,i)=>{
    const offX = -2 + i*2;
    const loader = new THREE.TextureLoader();
    loader.load(p, tex=>{
      const mat = new THREE.MeshBasicMaterial({ map:tex });
      const plane = new THREE.Mesh(planeGeom, mat);
      plane.position.set(offX, 0.1, -1.8 + (i%2)*0.2);
      plane.rotation.y = 0.05 * (i-1);
      scene.add(plane);
    }, undefined, ()=>{/* missing photo */});
  });
}

// prepare cake and add to scene but keep invisible
let cakeAdded = false;
async function prepareCakeInScene(){
  cakeGroup = await loadCake();
  cakeGroup.visible = false;
  scene.add(cakeGroup);
  cakeAdded = true;
}

// animations timeline (frame-by-frame logic)
const timeline = [
  { name:'frame1', fn: frame1, delay: 500 },
  { name:'frame2', fn: frame2, delay: 400 },
  { name:'frame3a', fn: frame3a, delay: 400 },
  { name:'frame3b', fn: frame3b, delay: 500 },
  { name:'frame4', fn: frame4, delay: 600 },
  { name:'frame5_show_cake', fn: frame5, delay: 700 },
  { name:'frame6_reveal', fn: frame6, delay: 1200 },
  { name:'frame7_card_zoom', fn: frame7, delay: 900 },
];

let tIndex = 0;

function runTimeline(){
  if(tIndex >= timeline.length) return;
  const item = timeline[tIndex];
  item.fn().then(()=>{
    setTimeout(()=>{
      tIndex++;
      runTimeline();
    }, item.delay);
  });
}

// helpers for typing effect
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function typeToElement(el, text, charDelay = 60){
  el.textContent = '';
  for(let i=0;i<text.length;i++){
    el.textContent += text.charAt(i);
    await sleep(charDelay);
  }
}

// Frame functions
async function frame1(){
  await typeToElement(line1, 'tina', 80);
}
async function frame2(){
  await typeToElement(line2, 'today is your birthday', 60);
}
async function frame3a(){
  // type partial then pause (typo)
  await typeToElement(line3, 'so i made you this c', 40);
  await sleep(300);
  // quick correction: replace with full
  line3.textContent = '';
  await typeToElement(line3, 'so i made you this computer program', 30);
}
async function frame3b(){
  // small pause; nothing else, reserved
  return Promise.resolve();
}
async function frame4(){
  await typeToElement(line4, '(0, 0), |__/(0, 0),|', 35);
}

// Frame 5: clear text and show cake
async function frame5(){
  // fade out text area
  document.getElementById('text-area').style.transition = 'opacity 0.6s';
  document.getElementById('text-area').style.opacity = '0';
  await sleep(650);

  // make cake visible
  if(cakeGroup && cakeAdded){
    cakeGroup.visible = true;
    // position cake near camera to feel like it's on screen
    cakeGroup.position.set(0, -0.15, 0);
  }
  // give small pop animation
  if(cakeGroup){
    cakeGroup.scale.set(0.6,0.6,0.6);
    new TWEEN.Tween(cakeGroup.scale).to({x:1, y:1, z:1}, 700).easing(TWEEN.Easing.Back.Out).start();
  }
}

// Frame 6: reveal full scene (background, photos, caption)
async function frame6(){
  // fade in city background
  setCityBackground();
  spawnPhotos();
  // show caption
  caption.classList.remove('hidden');
  caption.style.opacity = '0';
  caption.style.transition = 'opacity 0.8s';
  await sleep(80);
  caption.style.opacity = '1';
  // reposition camera slightly out to reveal scene
  new TWEEN.Tween(camera.position).to({x: 0, y: 3.2, z: 10}, 900).easing(TWEEN.Easing.Cubic.Out).start();
  await sleep(900);
}

// Frame 7: zoom card
async function frame7(){
  // find or show a card (we will animate UI card)
  card.classList.remove('hidden');
  card.style.transition = 'transform 0.9s, opacity 0.6s';
  card.style.opacity = '0';
  card.style.transform = 'translate(-50%,-50%) scale(0.7)';
  await sleep(50);
  card.style.opacity = '1';
  card.style.transform = 'translate(-50%,-50%) scale(1.12)';
  // reduce cake visibility a bit
  if(cakeGroup) new TWEEN.Tween(cakeGroup.position).to({y: -0.6}, 900).start();
  await sleep(1100);
}

// render loop with basic rotation
function animate(time){
  requestAnimationFrame(animate);
  // rotate cake slowly if visible
  if(cakeGroup && cakeGroup.visible){
    cakeGroup.rotation.y += 0.006;
  }
  TWEEN.update(time);
  renderer.render(scene, camera);
}

// tiny TWEEN shim using @tweenjs (we include small copy here to avoid extra import)
const TWEEN = (function(){
  // Minimal tween impl (subset) for scale/position/rotation transitions
  const tweens = [];
  function Tween(obj){ this.obj = obj; this.toProps = null; this.duration = 1000; this.startTime = 0; this.easing = t=>t; }
  Tween.prototype.to = function(props, duration){ this.toProps = props; this.duration = duration || 1000; return this; };
  Tween.prototype.easing = function(fn){ this._easing = fn; return this; };
  Tween.prototype.start = function(){
    this.startTime = performance.now();
    this.startProps = {};
    for(const k in this.toProps){ this.startProps[k] = this.obj[k]; }
    tweens.push(this);
    return this;
  };
  Tween.prototype.updateOne = function(now){
    const t = Math.min(1, (now - this.startTime) / this.duration);
    const ease = this._easing ? this._easing(t) : t;
    for(const k in this.toProps){
      this.obj[k] = this.startProps[k] + (this.toProps[k] - this.startProps[k]) * ease;
    }
    return t>=1;
  };
  return {
    Tween: Tween,
    create: function(obj){ return new Tween(obj); },
    update: function(now){
      for(let i = tweens.length-1;i>=0;i--){
        const done = tweens[i].updateOne(now);
        if(done) tweens.splice(i,1);
      }
    },
    Easing: {
      Back: { Out: t => { const s=1.70158; return 1 + (--t)*t*((s+1)*t + s); } },
      Cubic: { Out: t => (--t)*t*t + 1 }
    }
  };
})();

// small helper for new tween syntax used above
TWEEN.Tween = function(obj){ return new TWEEN.TweenClass(obj); };
TWEEN.TweenClass = function(obj){ this.obj=obj; this.toProps={}; this.duration=1000; this.startTime=0; this._easing=null; this.startProps={}; };
TWEEN.TweenClass.prototype.to = function(props,dur){ this.toProps=props; this.duration=dur; return this; };
TWEEN.TweenClass.prototype.easing = function(fn){ this._easing = fn; return this; };
TWEEN.TweenClass.prototype.start = function(){ this.startTime=performance.now(); for(const k in this.toProps) this.startProps[k]=this.obj[k]; addTween(this); return this; };
function addTween(t){ if(!window._tlist) window._tlist=[]; window._tlist.push(t); }
function tweenUpdate(now){
  if(window._tlist){
    for(let i=window._tlist.length-1;i>=0;i--){
      const tw=window._tlist[i];
      const t = Math.min(1, (now - tw.startTime)/tw.duration);
      const ease = tw._easing ? tw._easing(t) : t;
      for(const k in tw.toProps) tw.obj[k] = tw.startProps[k] + (tw.toProps[k]-tw.startProps[k]) * ease;
      if(t>=1) window._tlist.splice(i,1);
    }
  }
}

// small shim to replace usage TWEEN.Tween(...) above with our addTween
TWEEN.Tween = function(obj){
  const tw = {
    obj, toProps:{}, duration:1000, startProps:{}, startTime:0, _easing:null,
    to(props,dur){ this.toProps=props; this.duration=dur||1000; return this;},
    easing(fn){ this._easing = fn; return this;},
    start(){ this.startTime=performance.now(); for(const k in this.toProps) this.startProps[k]=this.obj[k]; addTween(this); return this;}
  };
  return tw;
};
function TWEEN_update(now){ tweenUpdate(now); }

// init
initThree();
prepareCakeInScene().then(()=> {
  animate();
  runTimeline();
});
// override animate to call our tween update
function animate(){
  requestAnimationFrame(animate);
  if(cakeGroup && cakeGroup.visible) cakeGroup.rotation.y += 0.007;
  TWEEN_update(performance.now());
  renderer.render(scene, camera);
}
