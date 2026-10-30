/*
 * Body Lab 3D model: a rigged MakeHuman-based body (CC0) shaped live by height, weight, sex and age,
 * with painted sportswear and fitted hair, animated by Mixamo clips retargeted onto its skeleton
 * (breathing idle, idle workout, free-throw stance).
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Dribbble, Dumbbell, Grid3x3, Pause, Play, RotateCcw, RotateCw, Scan, SkipForward, ZoomIn, ZoomOut } from 'lucide-react';
import { cls } from '../lib/utils';
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, bmiColor, bodyFatPct, defaultHairStyle, type BodyParams, type HairStyle, type Outfit } from '../lib/body';

const MODEL_URL = `${import.meta.env.BASE_URL}models/human.glb`;
const REAL_HEIGHT_M = 1.681; // height of the source body in metres
const X = new THREE.Vector3(1, 0, 0);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const gauss = (v: number, m: number, s: number) => Math.exp(-((v - m) ** 2) / (2 * s * s));
const smooth = (v: number, a: number, b: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const FAT_BY_BONE: Record<string, number> = {
  pelvis: 1, spine_01: 1, spine_02: 0.85, spine_03: 0.55, clavicle_l: 0.4, clavicle_r: 0.4, neck_01: 0.45, head: 0.12,
  thigh_l: 0.8, thigh_r: 0.8, calf_l: 0.38, calf_r: 0.38, foot_l: 0.05, foot_r: 0.05,
  upperarm_l: 0.62, upperarm_r: 0.62, lowerarm_l: 0.3, lowerarm_r: 0.3, hand_l: 0.05, hand_r: 0.05,
};

const HAIR_URL = `${import.meta.env.BASE_URL}models/hair/`;
const SRC_MIN = [-0.54871976, 0.00072479, -0.09763171], SRC_MAX = [0.54871976, 1.68104887, 0.36034235];
const SHELLS = 12;

type Garments = { top: number; bot: number; lo: number; hi: number; looseTop: number; looseBot: number };
const OUTFIT_KIT: Record<Outfit, (female: boolean) => Garments> = {
  compression: (f) => ({ top: f ? 1 : 0, bot: 1, lo: 0.405, hi: 0.588, looseTop: 0.0015, looseBot: 0.0015 }),
  tank: () => ({ top: 2, bot: 2, lo: 0.43, hi: 0.585, looseTop: 0.003, looseBot: 0.005 }),
  tee: () => ({ top: 3, bot: 3, lo: 0.045, hi: 0.585, looseTop: 0.006, looseBot: 0.007 }),
  leggings: (f) => ({ top: f ? 1 : 4, bot: 4, lo: 0.05, hi: 0.605, looseTop: 0.0015, looseBot: 0.0015 }),
  tracksuit: () => ({ top: 5, bot: 5, lo: 0.038, hi: 0.588, looseTop: 0.008, looseBot: 0.008 }),
};
const CLOTH_GLSL = `
  uniform float uTopKind; uniform float uBotLo; uniform float uBotHi;
  float bnd(float y, float a, float b, float e) { return smoothstep(a - e, a + e, y) * (1.0 - smoothstep(b - e, b + e, y)); }
  vec4 outfitCover(float y, float x, float z, vec4 cw, float armT, float e) {
    float ax = abs(x);
    float upper = smoothstep(0.5, 0.8, cw.x), lower = smoothstep(0.5, 0.8, cw.y);
    float arm = smoothstep(0.2, 0.45, cw.w), torso = upper * (1.0 - arm);
    float front = smoothstep(-0.02, 0.04, z);
    float k = uTopKind, top = 0.0;
    if (k > 0.5 && k < 1.5) {          // sports bra with a racer back
      top = torso * max(bnd(y, 0.662, 0.77, e), bnd(y, 0.76, 0.87, e) * bnd(ax, 0.05, mix(0.072, 0.085, front), e));
    } else if (k > 1.5 && k < 2.5) {   // tank: scoop neck, straps, open armholes
      float neck = mix(0.8, 0.772, front);
      top = torso * max(bnd(y, 0.545, neck, e), bnd(y, neck - 0.012, 0.87, e) * bnd(ax, 0.055, 0.095, e));
    } else if (k > 2.5) {              // tee, long sleeve, jacket: neckline cut only near the neck
      float neck = k > 4.5 ? 0.84 : mix(0.82, 0.806, front);
      float hem = k > 4.5 ? 0.53 : 0.545;
      float sleeve = k < 3.5 ? 0.3 : 0.9;
      float neckCut = smoothstep(-e, e, y - neck - 0.035 * pow(ax / 0.06, 2.0)) * (1.0 - smoothstep(0.055, 0.066, ax)); // rounded neckline
      top = torso * bnd(y, hem, 0.9, e) * (1.0 - neckCut);
      top += upper * arm * (1.0 - smoothstep(sleeve - 4.0 * e, sleeve + 4.0 * e, armT)); // torso + sleeve shares sum to 1; armT < 0 = shoulder
    }
    float legs = lower * (1.0 - arm);
    float bot = legs * bnd(y, uBotLo, uBotHi, e);
    float shoe = legs * (1.0 - smoothstep(0.052 - e, 0.052 + e, y));
    float sock = uBotLo > 0.3 ? legs * bnd(y, 0.05, 0.085, e) : 0.0;
    return vec4(clamp(top, 0.0, 1.0), bot, shoe, sock);
  }
`;
const ANIM_URL = (id: string) => `${import.meta.env.BASE_URL}models/anims/${id}.glb`;
const IDLE_CLIP = { id: 'idle', name: 'Idle' };
const FIST_CLIPS = new Set(['jog', 'stretch']);
const EXERCISES = [
  { id: 'jumping-jacks', name: 'Jumping jacks' }, { id: 'squat', name: 'Air squats' }, { id: 'jog', name: 'Jog in place' },
  { id: 'burpee', name: 'Burpees' }, { id: 'pushup', name: 'Push-ups' }, { id: 'stretch', name: 'Warm-up stretch' },
];
const MOTION_FPS = 30;
const mixamoName = (n: string) => n.replace(/^mixamorig\d*:?/, '');
type Motion = {
  fps: number; cols: number; rows: Float32Array; joints: string[]; rest: Record<string, number[]>;
  clips: { id: string; name: string; start: number; frames: number; restFrame: number; restScore: number }[];
};
const RETARGET: [string, string, string | null, string, string][] = [
  ['pelvis', 'Hips', 'spine_02', 'Hips', 'Spine1'],
  ['spine_01', 'Spine', 'spine_02', 'Spine', 'Spine1'],
  ['spine_02', 'Spine1', 'spine_03', 'Spine1', 'Spine2'],
  ['spine_03', 'Spine2', 'neck_01', 'Spine2', 'Neck'],
  ['neck_01', 'Neck', 'head', 'Neck', 'Head'],
  ['head', 'Head', null, 'Head', 'HeadTop_End'],
  ['clavicle_L', 'LeftShoulder', 'upperarm_L', 'LeftShoulder', 'LeftArm'],
  ['upperarm_L', 'LeftArm', 'lowerarm_L', 'LeftArm', 'LeftForeArm'],
  ['lowerarm_L', 'LeftForeArm', 'hand_L', 'LeftForeArm', 'LeftHand'],
  ['hand_L', 'LeftHand', 'middle_01_L', 'LeftHand', 'LeftHandMiddle1'],
  ['thigh_L', 'LeftUpLeg', 'calf_L', 'LeftUpLeg', 'LeftLeg'],
  ['calf_L', 'LeftLeg', 'foot_L', 'LeftLeg', 'LeftFoot'],
  ['foot_L', 'LeftFoot', 'ball_L', 'LeftFoot', 'LeftToeBase'],
];
const FINGERS: [string, string][] = ['index', 'middle', 'ring', 'pinky', 'thumb'].flatMap((f) =>
  [1, 2, 3].map((k): [string, string] => [`${f}_0${k}_L`, `LeftHand${f[0].toUpperCase()}${f.slice(1)}${k}`]));
const MOTION_JOINTS = [...new Set([...RETARGET, ...FINGERS].flatMap(([, pj]) => (pj.startsWith('Left') ? [pj, pj.replace('Left', 'Right')] : [pj])))];
const REST_JOINTS = [...new Set(RETARGET.flatMap(([, , , pa, pb]) => (pa.startsWith('Left') ? [pa, pb, pa.replace('Left', 'Right'), pb.replace('Left', 'Right')] : [pa, pb])))];

// Samples a Mixamo clip into rows: hip/ankle offsets (leg lengths), joint rotations from the T-pose, torso direction, hand gap, feet height.
function sampleClip(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }) {
  const root = gltf.scene, clip = gltf.animations[0];
  const nodes: Record<string, THREE.Object3D> = {};
  root.traverse((o) => { nodes[mixamoName(o.name)] = o; });
  root.updateMatrixWorld(true);
  const wp = (n: string) => nodes[n]?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
  const hips0 = wp('Hips');
  const rest: Record<string, number[]> = {};
  for (const j of REST_JOINTS) rest[j] = wp(j).sub(hips0).toArray();
  const restInv = MOTION_JOINTS.map((j) => (nodes[j] ? nodes[j].getWorldQuaternion(new THREE.Quaternion()).invert() : new THREE.Quaternion()));
  const floor = Math.min(wp('LeftFoot').y, wp('RightFoot').y), leg = wp('LeftUpLeg').y - floor, hipOff = hips0.y - wp('LeftUpLeg').y;
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  const n = Math.max(2, Math.round(clip.duration * MOTION_FPS)), torsoCol = 9 + MOTION_JOINTS.length * 4, cols = torsoCol + 5;
  const shoulders = wp('LeftArm').distanceTo(wp('RightArm'));
  const rows = new Float32Array(n * cols);
  const q = new THREE.Quaternion();
  let cx = 0, cz = 0;
  let restFrame = 0, restScore = Infinity;
  const footMin = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    mixer.setTime((f / n) * clip.duration);
    root.updateMatrixWorld(true);
    const o = f * cols, hips = wp('Hips');
    rows[o] = hips.x; rows[o + 1] = (hips.y - hipOff - floor) / leg; rows[o + 2] = hips.z;
    cx += hips.x / n; cz += hips.z / n;
    wp('LeftFoot').sub(wp('LeftUpLeg')).divideScalar(leg).toArray(rows, o + 3);
    wp('RightFoot').sub(wp('RightUpLeg')).divideScalar(leg).toArray(rows, o + 6);
    wp('Neck').sub(hips).normalize().toArray(rows, o + torsoCol);
    rows[o + torsoCol + 3] = (wp('LeftHand').x - wp('RightHand').x) / shoulders;
    footMin[f] = Math.min(wp('LeftFoot').y, wp('RightFoot').y, wp('LeftToeBase').y, wp('RightToeBase').y);
    const handsUp = Math.max(0, (Math.max(wp('LeftHand').y, wp('RightHand').y) - hips.y) / leg);
    const score = Math.abs(rows[o + 1] - 1) * 2 + (1 - rows[o + torsoCol + 1]) * 3 + handsUp
      + Math.abs(rows[o + 3]) + Math.abs(rows[o + 6]) + Math.abs(rows[o + 5]) + Math.abs(rows[o + 8]);
    if (score < restScore) { restScore = score; restFrame = f; }
    MOTION_JOINTS.forEach((j, k) => {
      if (nodes[j]) nodes[j].getWorldQuaternion(q).multiply(restInv[k]); else q.identity();
      q.toArray(rows, o + 9 + k * 4);
    });
  }
  const footFloor = Math.min(...footMin);
  for (let f = 0; f < n; f++) rows[f * cols + torsoCol + 4] = (footMin[f] - footFloor) / leg;
  for (let f = 0; f < n; f++) { rows[f * cols] = (rows[f * cols] - cx) / leg; rows[f * cols + 2] = (rows[f * cols + 2] - cz) / leg; }
  mixer.stopAllAction();
  return { rows, frames: n, rest, cols, restFrame, restScore };
}
const EX_LEN = 9;   // seconds per exercise (rounded to whole repetitions)
const EX_BLEND = 1.0;  // seconds to ease from standing into an exercise and back
const BRIDGE_FADE = 0.5; // a floor exercise: from the burpee's plank into its own (and back)
const EX_BREATHER = 0.8; // standing between exercises
type Bridge = { clip: number; stand: number; plank: number; down: number; up: number };
const IDLE_S = 4;
const SHOW_POSE_BUTTON = false; // free-throw stance button (hidden; the stance still works)

const HASH_GLSL = `
  float ipHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
`;

export default function BodyModel({ params, skinTone = SKIN_TONES[1], hairStyle, hairColor = HAIR_COLORS[1].value,
  outfit = 'compression', outfitColor = OUTFIT_COLORS[0].value, demo }: {
  params: BodyParams; skinTone?: string; hairStyle?: HairStyle; hairColor?: string;
  outfit?: Outfit; outfitColor?: string;
  /** play only this animation on a loop (exercise pages), in a compact viewer without the toolbar */
  demo?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const target = useRef(params);
  const demoRef = useRef(demo);
  demoRef.current = demo;
  target.current = params;
  const toneRef = useRef(skinTone);
  toneRef.current = skinTone;
  const hairRef = useRef({ style: hairStyle, color: hairColor });
  hairRef.current = { style: hairStyle, color: hairColor };
  const lookRef = useRef({ outfit, outfitColor });
  lookRef.current = { outfit, outfitColor };
  const api = useRef<{
    spin: (rad: number) => void; reset: () => void; setAuto: (on: boolean) => void; setWire: (on: boolean) => void;
    setFocus: (on: boolean) => void; setWorkout: (on: boolean) => void; nextExercise: () => void; setPose: (on: boolean) => void;
  } | null>(null);
  const [workout, setWorkout] = useState(true);
  const [posing, setPosing] = useState(false);
  const [exercise, setExercise] = useState('');
  const [focus, setFocus] = useState(false);
  const [auto, setAuto] = useState(true);
  const [wire, setWire] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = mountRef.current!;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.45;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    camera.position.set(0.55, 1.15, 4.1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.55;
    controls.maxDistance = 7;
    controls.minPolarAngle = 0.75;
    controls.maxPolarAngle = 1.8;
    controls.target.set(0, 0.9, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    let autoOn = true;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let lastInput = performance.now() / 1000; // any interaction pauses the idle workout
    const poke = () => { lastInput = performance.now() / 1000; };
    controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idle); poke(); });
    controls.addEventListener('end', () => { idle = setTimeout(() => { controls.autoRotate = autoOn; }, 3500); });

    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x1a1c22, 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff4ea, 2.4);
    key.position.set(1.8, 3.6, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 9;
    key.shadow.camera.left = -1.2; key.shadow.camera.right = 1.2; key.shadow.camera.top = 2.4; key.shadow.camera.bottom = -0.3;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 4;
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.6);
    fill.position.set(-2.5, 1.6, 1.5);
    const rimA = new THREE.PointLight(0xff5e1a, 9, 10);
    rimA.position.set(-1.9, 1.7, -1.6);
    const rimB = new THREE.PointLight(0x29d8ff, 7, 10);
    rimB.position.set(1.9, 1.3, -1.8);
    scene.add(key, fill, rimA, rimB);

    const discMat = new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.9 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.86, 72), discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.receiveShadow = true;
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5e1a, transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.84, 0.89, 128), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.003;
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xff5e1a, transparent: true, opacity: 0.3 });
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.93, 128), pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = 0.002;
    const grid = new THREE.PolarGridHelper(0.82, 12, 4, 72, 0x2c3039, 0x2c3039);
    grid.position.y = 0.004;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.6;
    scene.add(disc, ring, pulse, grid);
    const ballTex = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256;
      const g = c.getContext('2d')!;
      g.fillStyle = '#c4581f'; g.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,170,110' : '90,30,8'},0.18)`; g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); }
      g.strokeStyle = '#1c120c'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();             // the equator
      for (const x of [128, 384]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } // the meridian
      for (const x0 of [0, 256]) {                                                  // the two curved seams
        g.beginPath();
        for (let y = 0; y <= 256; y += 4) { const x = x0 + 128 + Math.sin((y / 256) * Math.PI) * 70 * (x0 ? -1 : 1); if (y) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    })();
    const BALL_R = 0.12; // metres, a size-7 ball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.72 }));
    ball.castShadow = true;
    ball.visible = false;
    scene.add(ball);

    const rulerMat = new THREE.LineBasicMaterial({ color: 0x5e6573, transparent: true, opacity: 0.8 });
    const topMat = new THREE.LineDashedMaterial({ color: 0xff5e1a, dashSize: 0.05, gapSize: 0.035 });
    let ruler: THREE.LineSegments | null = null;
    let topLine: THREE.Line | null = null;
    let rulerH = 0;
    const RX = 0.62;
    const buildRuler = (H: number) => {
      if (ruler) { scene.remove(ruler); ruler.geometry.dispose(); }
      if (topLine) { scene.remove(topLine); topLine.geometry.dispose(); }
      const pts: number[] = [RX, 0, 0, RX, H, 0];
      for (let cm = 0; cm <= H * 100 + 0.1; cm += 10) {
        const y = cm / 100, w = cm % 50 === 0 ? 0.07 : 0.035;
        pts.push(RX, y, 0, RX - w, y, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      ruler = new THREE.LineSegments(g, rulerMat);
      topLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, H, 0), new THREE.Vector3(RX + 0.05, H, 0)]), topMat);
      topLine.computeLineDistances();
      if (!demoRef.current) scene.add(ruler, topLine); // exercise demos show just the body
      rulerH = H;
    };

    const skin = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(toneRef.current), roughness: 0.58, metalness: 0,
      sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffd6c4'), clearcoat: 0.06, clearcoatRoughness: 0.6,
    });
    const u = {
      uInflate: { value: 0 }, uBelly: { value: 0 }, uGlute: { value: 0 },
      uHip: { value: 0 }, uWaist: { value: 0 }, uBust: { value: 0 },
      uFront: { value: 1 }, // sign of the body's forward direction in bind space
      uUnit: { value: 1 },  // attribute units per metre
      uGroin: { value: 0 },
    };
    // Body shaping runs in the vertex shader (bind space, before skinning) so it follows every pose.
    const shaped = <M extends THREE.Material>(mat: M, key: string, lift: { value: number }, extra?: (sh: THREE.WebGLProgramParametersWithUniforms) => void) => {
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u, { uLift: lift });
        sh.vertexShader = `
          attribute float aFat; attribute float aBelly; attribute float aGlute; attribute float aGroin;
          attribute float aHip; attribute float aWaist; attribute float aBust; attribute float aHairBack;
          uniform float uInflate; uniform float uBelly; uniform float uGlute; uniform float uGroin;
          uniform float uHip; uniform float uWaist; uniform float uBust; uniform float uFront; uniform float uUnit; uniform float uLift;
        ` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 shape = normalize(normal) * (uInflate * aFat + uLift * (1.0 + 1.6 * aHairBack));
          shape.z += uFront * (uBelly * aBelly - uGlute * aGlute + uBust * aBust - uGroin * aGroin);
          shape.y -= uBelly * aBelly * 0.15;
          shape.x += uHip * aHip - uWaist * aWaist;
          transformed += shape * uUnit;
        `);
        extra?.(sh);
      };
      mat.customProgramCacheKey = () => key;
      return mat;
    };

    const cloth = {
      uMinY: { value: 0 }, uZc: { value: 0 }, uTopKind: { value: 0 }, uBotLo: { value: 0.405 }, uBotHi: { value: 0.588 },
      uLooseTop: { value: 0 }, uLooseBot: { value: 0 },
      uTopCol: { value: new THREE.Color(0x2a2d35) }, uBotCol: { value: new THREE.Color(0x22252c) }, uShoeCol: { value: new THREE.Color(0xe9e9ea) },
      uAccent: { value: new THREE.Color(0xff5e1a) }, uStripe: { value: new THREE.Color(0xf1f1ee) },
    };
    shaped(skin, 'ip-skin', { value: 0 }, (sh) => {
      Object.assign(sh.uniforms, cloth, { uHairCol: hairU.uHairCol });
      sh.vertexShader = `attribute vec4 aCW; attribute float aArmT; attribute vec3 aHairInfo; uniform float uMinY; uniform float uZc;
        uniform float uLooseTop; uniform float uLooseBot;
        varying float vBodyY; varying float vScalp; varying vec4 vCW; varying float vArmT; varying vec3 vBP; varying vec3 vBN;
        ${CLOTH_GLSL}\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vBodyY = (position.y - uMinY) / uUnit / ${REAL_HEIGHT_M.toFixed(3)}; vScalp = aHairInfo.z;
        vCW = aCW; vArmT = aArmT; vBN = normalize(normal);
        vBP = vec3(position.x / uUnit, vBodyY, uFront * (position.z / uUnit - uZc));
        vec4 cvv = outfitCover(vBP.y, vBP.x, vBP.z, aCW, aArmT, 0.012);
        transformed += normalize(normal) * (cvv.x * uLooseTop + cvv.y * uLooseBot + cvv.z * 0.009 + cvv.w * 0.0015) * uUnit;`);
      sh.fragmentShader = `uniform vec3 uTopCol; uniform vec3 uBotCol; uniform vec3 uShoeCol; uniform vec3 uAccent; uniform vec3 uStripe; uniform vec3 uHairCol;
        varying float vBodyY; varying float vScalp; varying vec4 vCW; varying float vArmT; varying vec3 vBP; varying vec3 vBN;
        ${CLOTH_GLSL}
        ${HASH_GLSL}
        float clothAmt;\n` + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float e = 0.0022, y = vBP.y, ax = abs(vBP.x);
            vec4 cv = outfitCover(y, vBP.x, vBP.z, vCW, vArmT, e);
            float knit = 0.93 + 0.07 * ipHash(floor(vec3(vBP.x, y * 1.681, vBP.z) * 2600.0)); // fabric grain
            float outer = smoothstep(0.84, 0.93, vBN.x * sign(vBP.x));                     // outside of leg / arm
            float front = smoothstep(0.0, 0.03, vBP.z);
            vec3 bot = uBotCol * knit;
            bot = mix(bot, bot * 0.75, bnd(y, uBotHi - 0.02, uBotHi, e));
            bot = mix(bot, uAccent, bnd(y, uBotHi - 0.014, uBotHi - 0.009, e));
            if (uTopKind > 4.5 || (uBotLo > 0.42 && uBotLo < 0.44)) bot = mix(bot, uStripe, outer * step(y, uBotHi - 0.02));
            if (uBotLo < 0.06) bot = mix(bot, bot * 0.7, bnd(y, uBotLo, uBotLo + 0.022, e) * (0.75 + 0.25 * sin(atan(vBP.z, vBP.x) * 90.0)));
            vec3 top = uTopCol * knit;
            float k = uTopKind;
            if (k > 0.5 && k < 1.5) top = mix(top, uAccent, bnd(y, 0.662, 0.674, e));
            if (k > 1.5) top = mix(top, uAccent, front * bnd(y, 0.733, 0.75, e) * bnd(vBP.x, 0.04, 0.072, e));
            if (k > 2.5 && k < 4.5) top = mix(top, top * 0.72, bnd(vArmT, (k < 3.5 ? 0.3 : 0.9) - 0.035, 2.0, e * 4.0));
            if (k > 4.5) {
              top = mix(top, vec3(0.08), front * (1.0 - smoothstep(0.0025, 0.0045, ax)));                   // zip
              top = mix(top, uStripe, step(-0.5, vArmT) * smoothstep(0.8, 0.9, vBN.y));                    // sleeve stripe
              top = mix(top, top * 0.7, bnd(y, 0.53, 0.55, e));                                             // hem band
            }
            vec3 shoe = mix(uShoeCol, vec3(0.86, 0.83, 0.78), 1.0 - smoothstep(0.015, 0.018, y));
            shoe = mix(shoe, shoe * 0.55, bnd(y, 0.018, 0.021, e));                                  // midsole line
            shoe = mix(shoe, uAccent, smoothstep(0.6, 0.8, abs(vBN.x)) * bnd(y, 0.02, 0.034, e));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.9, 0.88) * knit, cv.w);
            diffuseColor.rgb = mix(diffuseColor.rgb, shoe, cv.z);
            diffuseColor.rgb = mix(diffuseColor.rgb, bot, cv.y);
            diffuseColor.rgb = mix(diffuseColor.rgb, top, cv.x);
            clothAmt = max(max(cv.x, cv.y), max(cv.z, cv.w));
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, uHairCol * 0.6, 0.85 * smoothstep(-0.6, 0.45, vScalp));`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.86, clothAmt);`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
          material.sheenColor *= 1.0 - clothAmt;   // fabric has no skin sheen or oil
          material.clearcoat *= 1.0 - clothAmt;`);
    });

    const hairU = {
      uHairCol: { value: new THREE.Color(hairColor) },
      uMaxLen: { value: 0.022 }, uTopLen: { value: 0.17 }, uSideLen: { value: 0.13 }, uComb: { value: 0 },
    };
    const hairMats: THREE.MeshStandardMaterial[] = [];
    const shellLayers: THREE.SkinnedMesh[] = [];
    let wireOn = false;
    for (let k = 0; k < SHELLS; k++) {
      const shell = { value: k / (SHELLS - 1) };
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
      shaped(mat, 'ip-hair-shell', { value: 0.0012 }, (sh) => {
        Object.assign(sh.uniforms, hairU, { uShell: shell });
        sh.vertexShader = `attribute vec3 aHairInfo; attribute vec3 aFlow;
          uniform float uShell; uniform float uMaxLen; uniform float uTopLen; uniform float uSideLen; uniform float uComb;
          varying vec3 vHairP; varying vec3 vHairInfo; varying float vLen;\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float hairLen = mix(uSideLen, uTopLen, smoothstep(0.5, 0.86, aHairInfo.x)) * mix(0.3, 1.0, clamp(aHairInfo.z, 0.0, 1.0));
          vLen = hairLen; vHairInfo = aHairInfo; vHairP = position / uUnit;
          transformed += (normalize(normal) * (uShell * uMaxLen * hairLen) + aFlow * (uComb * uShell * uShell * hairLen)) * uUnit;`);
        sh.fragmentShader = `uniform float uShell; uniform vec3 uHairCol; varying vec3 vHairP; varying vec3 vHairInfo; varying float vLen;
          ${HASH_GLSL}\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          const mat3 rot = mat3(0.36, 0.48, -0.8, -0.8, 0.6, 0.0, 0.48, 0.64, 0.6);
          vec3 g = rot * vHairP * 900.0;
          vec3 id = floor(g);
          float h = ipHash(id);
          float strand = vLen * (0.55 + 0.45 * h);  // this strand's length
          if (uShell < 0.001) { if (vHairInfo.z < 0.3) discard; }
          else {
            if (ipHash(id + 23.0) > smoothstep(-0.4, 0.45, vHairInfo.z)) discard;
            if (uShell > strand) discard;
            vec3 jitter = vec3(ipHash(id + 3.0), ipHash(id + 11.0), ipHash(id + 19.0)) - 0.5;
            float r = length(fract(g) - 0.5 - jitter * 0.5); // strands sit at random spots in their cell
            if (r > 0.5 * (1.0 - uShell / max(strand, 0.001)) + 0.08) discard; // strands taper to the tip
          }
          float lift = uShell / max(vLen, 0.05);
          diffuseColor.rgb = uHairCol * mix(0.4, 1.2, clamp(lift, 0.0, 1.0)) * (0.82 + 0.36 * ipHash(id + 7.0));`);
      });
      hairMats.push(mat);
    }

    const cardU = {
      uKeyDir: { value: new THREE.Vector3(0, 1, 0) }, uTime: { value: 0 }, uSwayY: { value: 0 },
      uHairPad: { value: 0.008 }, // gap between hair resting on the body and the skin
    };
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const a2c = (gl.getParameter(gl.SAMPLES) as number) > 0;
    const cardMat = (map: THREE.Texture, lum: number) => {
      const mat = new THREE.MeshStandardMaterial({
        map, side: THREE.DoubleSide, roughness: 0.82, metalness: 0,
        alphaTest: a2c ? 0.12 : 0.42, alphaToCoverage: a2c,
      });
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, cardU, { uHairCol: hairU.uHairCol, uLum: { value: lum } },
          { uInflate: u.uInflate, uBust: u.uBust, uFront: u.uFront, uUnit: u.uUnit });
        sh.vertexShader = `attribute vec3 aStrand; attribute vec3 aSkinN; attribute float aFatH; attribute float aBustH; attribute float aOnBody;
          uniform float uTime; uniform float uSwayY; uniform float uHairPad; uniform float uInflate; uniform float uBust; uniform float uFront; uniform float uUnit;
          varying vec3 vStrand;
` + sh.vertexShader
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            transformed += (aSkinN * (uInflate * aFatH + uHairPad * aOnBody) + vec3(0.0, 0.0, uFront * uBust * aBustH)) * uUnit;
            float drop = max(0.0, (uSwayY - position.y) / uUnit);
            transformed.x += sin(uTime * 1.3) * 0.03 * drop * drop * uUnit;`)
          .replace('#include <skinnormal_vertex>', `#include <skinnormal_vertex>
            vec3 strandDir = aStrand;
            #ifdef USE_SKINNING
              strandDir = (skinMatrix * vec4(strandDir, 0.0)).xyz;
            #endif
            vStrand = normalize(normalMatrix * strandDir);`);
        sh.fragmentShader = `uniform vec3 uHairCol; uniform float uLum; uniform vec3 uKeyDir; varying vec3 vStrand;
` + sh.fragmentShader
          .replace('#include <map_fragment>', `#include <map_fragment>
            float texL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / uLum;
            diffuseColor.rgb = uHairCol * pow(clamp(texL, 0.15, 1.8), 0.75);`)
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
            {
              vec3 T = normalize(vStrand - normal * dot(vStrand, normal));
              vec3 V = normalize(vViewPosition);
              float nl = clamp(dot(normal, uKeyDir) * 0.6 + 0.4, 0.0, 1.0);
              float t1 = dot(normalize(T + normal * 0.08), normalize(uKeyDir + V));
              float t2 = dot(normalize(T - normal * 0.12), normalize(uKeyDir + V));
              float s1 = pow(sqrt(max(0.0, 1.0 - t1 * t1)), 120.0);
              float s2 = pow(sqrt(max(0.0, 1.0 - t2 * t2)), 28.0);
              float shade = clamp(texL, 0.0, 1.2);
              reflectedLight.directSpecular += nl * shade * (vec3(0.06) * s1 + uHairCol * 0.55 * s2);
            }`);
      };
      mat.customProgramCacheKey = () => 'ip-hair-card' + (a2c ? '-a2c' : '');
      return mat;
    };
    const cards = new Map<HairStyle, THREE.SkinnedMesh | null>(); // null while loading or if it failed

    let loadCard: ((id: HairStyle) => void) | null = null;
    const gray = new THREE.Color(0xc9c6c2), pickedHair = new THREE.Color(), hairTarget = new THREE.Color();

    const figure = new THREE.Group();
    scene.add(figure);
    const bones: Record<string, THREE.Bone> = {};
    const rest: Record<string, THREE.Quaternion> = {};
    let modelH = 1.68;
    let modelFloor = 0;
    let groundMesh: THREE.SkinnedMesh | null = null, groundIdx = new Int32Array(0);
    const gv = new THREE.Vector3(), gn = new THREE.Vector3();
    // Lowest posed skin point (CPU-skinned sample of vertices, including the shader's weight shaping).
    const lowestSkin = () => {
      const gm = groundMesh;
      if (!gm) return 0;
      const pos = gm.geometry.getAttribute('position'), nor = gm.geometry.getAttribute('normal');
      const fat = gm.geometry.getAttribute('aFat'), belly = gm.geometry.getAttribute('aBelly'), bust = gm.geometry.getAttribute('aBust');
      const un = u.uUnit.value;
      let lo = Infinity;
      for (let k = 0; k < groundIdx.length; k++) {
        const i = groundIdx[k];
        gv.fromBufferAttribute(pos, i);
        gn.fromBufferAttribute(nor, i).normalize();
        gv.addScaledVector(gn, u.uInflate.value * (fat ? fat.getX(i) : 0) * un);
        const bl = belly ? belly.getX(i) : 0;
        gv.z += u.uFront.value * (u.uBelly.value * bl + u.uBust.value * (bust ? bust.getX(i) : 0)) * un;
        gv.y -= u.uBelly.value * bl * 0.15 * un;
        gm.applyBoneTransform(i, gv);
        gv.applyMatrix4(gm.matrixWorld);
        if (gv.y < lo) lo = gv.y;
      }
      return lo;
    };
    let armSign = { l: 1, r: -1 };
    const legSign = { l: 1, r: -1 };
    const pelvisRest = new THREE.Vector3();
    const fingerNames = { l: [] as string[], r: [] as string[] };
    let ready = false;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(MODEL_URL, (gltf) => {
      if (disposed) return;
      const root = gltf.scene;
      let mesh: THREE.SkinnedMesh | null = null;
      root.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
        if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
      });
      if (!mesh) { setFailed(true); return; }
      const m = mesh as THREE.SkinnedMesh;
      m.material = skin;
      m.castShadow = true;
      m.frustumCulled = false;
      Object.entries(bones).forEach(([n, b]) => { rest[n] = b.quaternion.clone(); });

      const geo = m.geometry;
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const geoH = REAL_HEIGHT_M;
      const unit = (bb.max.y - bb.min.y) / REAL_HEIGHT_M;
      u.uUnit.value = unit;
      const pos = geo.getAttribute('position'), si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight');
      // The compressed mesh stores quantized positions; convert to metres above the floor.
      const PX = (i: number) => pos.getX(i) / unit, PY = (i: number) => (pos.getY(i) - bb.min.y) / unit, PZ = (i: number) => pos.getZ(i) / unit;
      const names = m.skeleton.bones.map((b) => b.name);
      const n = pos.count;
      const aFat = new Float32Array(n), aBelly = new Float32Array(n), aGlute = new Float32Array(n);
      const aHip = new Float32Array(n), aWaist = new Float32Array(n), aBust = new Float32Array(n);

      let zSum = 0, zN = 0;
      for (let i = 0; i < n; i++) {
        const y = PY(i) / geoH;
        if (Math.abs(y - 0.6) < 0.03 && Math.abs(PX(i)) < 0.15) { zSum += PZ(i); zN++; }
      }
      const zc = zN ? zSum / zN : 0;
      let footZ = 0, footN = 0, kneeZ = 0, kneeN = 0;
      for (let i = 0; i < n; i++) {
        const y = PY(i) / geoH;
        if (y < 0.02) { footZ += PZ(i); footN++; }
        else if (Math.abs(y - 0.28) < 0.02) { kneeZ += PZ(i); kneeN++; }
      }
      const F = Math.sign(footZ / (footN || 1) - kneeZ / (kneeN || 1)) || 1;
      u.uFront.value = F;
      const H = geoH;
      const aGroin = new Float32Array(n);
      const aCW = new Float32Array(n * 4), aArmT = new Float32Array(n).fill(-1);
      cloth.uMinY.value = bb.min.y;
      cloth.uZc.value = zc;
      let xShoulder = Infinity, xWrist = Infinity;
      for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k), name = names[si.getComponent(i, k)];
        if (w > 0.85 && name.startsWith('upperarm')) xShoulder = Math.min(xShoulder, Math.abs(PX(i)));
        if (w > 0.85 && name.startsWith('hand')) xWrist = Math.min(xWrist, Math.abs(PX(i)));
      }
      for (let i = 0; i < n; i++) {
        let fat = 0, torso = 0, hipsW = 0, legW = 0, chestW = 0, armW = 0, notUpper = 0, lowerW = 0;
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          if (!w) continue;
          const name = names[si.getComponent(i, k)];
          fat += w * (FAT_BY_BONE[name] ?? 0);
          if (name === 'pelvis' || name === 'spine_01' || name === 'spine_02') torso += w;
          if (name === 'pelvis' || name.startsWith('thigh')) hipsW += w;
          if (name === 'pelvis' || name === 'spine_01' || name.startsWith('thigh')) legW += w;
          if (name === 'spine_02' || name === 'spine_03' || name.startsWith('clavicle')) chestW += w;
          if (name.startsWith('upperarm') || name.startsWith('lowerarm') || name.startsWith('hand') || /^(index|middle|ring|pinky|thumb)/.test(name)) armW += w;
          const isLeg = /^(thigh|calf|foot|ball|toe)/.test(name);
          if (isLeg || name === 'head' || name.startsWith('hand') || /^(index|middle|ring|pinky|thumb)/.test(name)) notUpper += w;
          if (isLeg || name === 'pelvis' || name === 'spine_01') lowerW += w;
        }
        aCW[i * 4] = 1 - notUpper; aCW[i * 4 + 1] = lowerW; aCW[i * 4 + 3] = armW;
        if (armW > 0.15 && isFinite(xShoulder) && isFinite(xWrist)) aArmT[i] = (Math.abs(PX(i)) - xShoulder) / (xWrist - xShoulder);
        {
          const yy = PY(i) / H, zz = F * (PZ(i) - zc), xx = Math.abs(PX(i));
          aGroin[i] = gauss(yy, 0.475, 0.025) * gauss(xx, 0, 0.035) * smooth(zz, 0.02, 0.09);
        }
        const x = PX(i), y = PY(i) / H, z = F * (PZ(i) - zc), ax = Math.abs(x); // z > 0 = front
        aFat[i] = fat;
        aBelly[i] = torso * gauss(y, 0.575, 0.085) * smooth(z, -0.04, 0.09) * gauss(x, 0, 0.16);
        aGlute[i] = hipsW * gauss(y, 0.5, 0.045) * smooth(-z, 0.0, 0.08);
        const core = ax < 0.24 ? 1 : 0; // keep T-pose arms out of the hip/waist/chest masks
        aHip[i] = Math.sign(x) * core * gauss(y, 0.52, 0.05) * smooth(ax, 0.02, 0.12);
        aWaist[i] = Math.sign(x) * core * gauss(y, 0.615, 0.035) * smooth(ax, 0.03, 0.12);
        aBust[i] = core * gauss(y, 0.725, 0.03) * gauss(ax, 0.085, 0.04) * smooth(z, 0.03, 0.1);
      }
      geo.setAttribute('aFat', new THREE.BufferAttribute(aFat, 1));
      geo.setAttribute('aBelly', new THREE.BufferAttribute(aBelly, 1));
      geo.setAttribute('aGlute', new THREE.BufferAttribute(aGlute, 1));
      geo.setAttribute('aHip', new THREE.BufferAttribute(aHip, 1));
      geo.setAttribute('aWaist', new THREE.BufferAttribute(aWaist, 1));
      geo.setAttribute('aBust', new THREE.BufferAttribute(aBust, 1));
      geo.setAttribute('aGroin', new THREE.BufferAttribute(aGroin, 1));
      geo.setAttribute('aCW', new THREE.BufferAttribute(aCW, 4));
      geo.setAttribute('aArmT', new THREE.BufferAttribute(aArmT, 1));

      const headIdx = names.indexOf('head');
      const headW = new Float32Array(n);
      let hx = 0, hz = 0, hc = 0, yMin = Infinity, yTop = -Infinity, zF = -Infinity, zB = Infinity, xHalf = 0;
      for (let i = 0; i < n; i++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === headIdx) w += sw.getComponent(i, k);
        headW[i] = w;
        if (w > 0.9) {
          const x = PX(i), y = PY(i), z = F * PZ(i);
          hx += x; hz += z; hc++;
          yMin = Math.min(yMin, y); yTop = Math.max(yTop, y); zF = Math.max(zF, z); zB = Math.min(zB, z); xHalf = Math.max(xHalf, Math.abs(x));
        }
      }
      hx /= hc || 1; hz /= hc || 1;
      const isHair = new Uint8Array(n), aHairBack = new Float32Array(n);
      const aHairInfo = new Float32Array(n * 3), aFlow = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) aHairInfo[i * 3 + 2] = -1; // not scalp
      const nor = geo.getAttribute('normal');
      const flow = new THREE.Vector3(), nrm = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        if (headW[i] < 0.6) continue;
        const y = PY(i), z = F * PZ(i), x = PX(i);
        const hy = (y - yMin) / (yTop - yMin);                 // 0 chin … 1 crown
        const front = z > hz ? (z - hz) / (zF - hz) : -(hz - z) / (hz - zB); // -1 back … 1 face
        const side = Math.abs(x - hx) / xHalf;
        const fwd = Math.max(0, front);
        let line = 0.41 + 0.27 * smooth(front, -0.45, 0.05)
          + 0.17 * Math.pow(fwd, 1.2)
          - 0.045 * smooth(side, 0.35, 0.7) * fwd
          + 0.13 * gauss(front, -0.02, 0.2) * smooth(side, 0.62, 0.92);
        line += 0.6 * smooth(side, 0.84, 0.94) * gauss(hy, 0.6, 0.1) * gauss(front, 0.0, 0.35);
        line = Math.min(line, 1.2);
        const edge = (hy - line) / 0.1; // > 0 inside the hair, < 0 outside; the shader cuts at ~0 per pixel
        if (edge > -0.8) {
          isHair[i] = 1;
          aHairInfo[i * 3] = hy; aHairInfo[i * 3 + 1] = front; aHairInfo[i * 3 + 2] = clamp(edge, -1, 1);
          nrm.set(nor.getX(i), nor.getY(i), nor.getZ(i)).normalize();
          flow.set(0, -0.35, -F).addScaledVector(nrm, -flow.set(0, -0.35, -F).dot(nrm)).normalize();
          aFlow[i * 3] = flow.x; aFlow[i * 3 + 1] = flow.y; aFlow[i * 3 + 2] = flow.z;
        }
      }
      geo.setAttribute('aHairBack', new THREE.BufferAttribute(aHairBack, 1));
      geo.setAttribute('aHairInfo', new THREE.BufferAttribute(aHairInfo, 3));
      geo.setAttribute('aFlow', new THREE.BufferAttribute(aFlow, 3));

      const srcIndex = geo.getIndex();
      const layerGeo = (mask: Uint8Array) => {
        const tris: number[] = [];
        if (srcIndex) for (let t = 0; t < srcIndex.count; t += 3) {
          const a = srcIndex.getX(t), b = srcIndex.getX(t + 1), c = srcIndex.getX(t + 2);
          if (mask[a] && mask[b] && mask[c]) tris.push(a, b, c);
        }
        const lg = new THREE.BufferGeometry();
        for (const [name, attr] of Object.entries(geo.attributes)) lg.setAttribute(name, attr);
        lg.setIndex(tris);
        return lg;
      };
      const scalp = layerGeo(isHair);
      hairMats.forEach((mat, k) => {
        const layer = new THREE.SkinnedMesh(scalp, mat);
        layer.bind(m.skeleton, m.bindMatrix);
        layer.castShadow = k === 0;
        layer.frustumCulled = false;
        layer.renderOrder = 1 + k;
        m.parent!.add(layer);
        layer.position.copy(m.position); layer.quaternion.copy(m.quaternion); layer.scale.copy(m.scale);
        shellLayers.push(layer);
      });

      const k = [0, 1, 2].map((a) => (bb.max.getComponent(a) - bb.min.getComponent(a)) / (SRC_MAX[a] - SRC_MIN[a]));
      cardU.uSwayY.value = bb.min.y + (yMin + (yTop - yMin) * 0.3) * unit; // below the nape, long hair swings
      const crown = new THREE.Vector3(hx * unit, bb.min.y + yTop * unit, (hz * F) * unit);
      const texLoader = new THREE.TextureLoader();
      const cell = 0.025 * unit;
      const ck = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
      let skinGrid: Map<number, number[]> | null = null;
      const nearestSkin = (x: number, y: number, z: number) => {
        if (!skinGrid) {
          skinGrid = new Map();
          for (let i = 0; i < n; i++) {
            if (PY(i) < 0.9) continue;
            const key = ck(Math.floor(pos.getX(i) / cell), Math.floor(pos.getY(i) / cell), Math.floor(pos.getZ(i) / cell));
            const list = skinGrid.get(key);
            if (list) list.push(i); else skinGrid.set(key, [i]);
          }
        }
        const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
        let best = -1, bestD = Infinity;
        for (let r = 1; r <= 4 && best < 0; r++) {
          for (let a = -r; a <= r; a++) for (let b2 = -r; b2 <= r; b2++) for (let c = -r; c <= r; c++) {
            const list = skinGrid.get(ck(cx + a, cy + b2, cz + c));
            if (list) for (const i of list) {
              const dd = (pos.getX(i) - x) ** 2 + (pos.getY(i) - y) ** 2 + (pos.getZ(i) - z) ** 2;
              if (dd < bestD) { bestD = dd; best = i; }
            }
          }
        }
        return best;
      };
      loadCard = (id) => {
        if (cards.has(id)) return;
        cards.set(id, null);
        Promise.all([
          fetch(`${HAIR_URL}${id}.bin`).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.arrayBuffer(); }),
          texLoader.loadAsync(`${HAIR_URL}${id}.webp`),
        ]).then(([buf, map]) => {
          if (disposed) return;
          const hl = new DataView(buf).getUint32(0, true);
          const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as { v: number; i: number; big: boolean; lum: number };
          let o = 4 + hl;
          const src = new Float32Array(buf, o, hdr.v * 3); o += hdr.v * 12;
          const uv = new Uint16Array(buf, o, hdr.v * 2); o += hdr.v * 4;
          const index = hdr.big ? new Uint32Array(buf, o, hdr.i) : new Uint16Array(buf, o, hdr.i);
          const P = new Float32Array(hdr.v * 3);
          for (let i = 0; i < P.length; i++) { const a = i % 3; P[i] = bb.min.getComponent(a) + (src[i] - SRC_MIN[a]) * k[a]; }
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(P, 3));
          g.setAttribute('uv', new THREE.BufferAttribute(uv, 2, true));
          g.setIndex(new THREE.BufferAttribute(index, 1));
          g.computeVertexNormals();
          const nrmA = g.getAttribute('normal'), strand = new Float32Array(hdr.v * 3);
          const d = new THREE.Vector3(), nv = new THREE.Vector3();
          for (let i = 0; i < hdr.v; i++) {
            d.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).sub(crown);
            nv.fromBufferAttribute(nrmA, i);
            d.addScaledVector(nv, -d.dot(nv));
            if (d.lengthSq() < 1e-10) d.set(0, -1, 0);
            d.normalize();
            strand[i * 3] = d.x; strand[i * 3 + 1] = d.y; strand[i * 3 + 2] = d.z;
          }
          g.setAttribute('aStrand', new THREE.BufferAttribute(strand, 3));
          const skinN = new Float32Array(hdr.v * 3), fatH = new Float32Array(hdr.v), bustH = new Float32Array(hdr.v);
          for (let i = 0; i < hdr.v; i++) {
            const j = nearestSkin(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
            if (j < 0) continue;
            nv.fromBufferAttribute(nor, j).normalize();
            skinN[i * 3] = nv.x; skinN[i * 3 + 1] = nv.y; skinN[i * 3 + 2] = nv.z;
            fatH[i] = aFat[j]; bustH[i] = aBust[j];
          }
          g.setAttribute('aSkinN', new THREE.BufferAttribute(skinN, 3));
          g.setAttribute('aFatH', new THREE.BufferAttribute(fatH, 1));
          g.setAttribute('aBustH', new THREE.BufferAttribute(bustH, 1));
          const si4 = new Uint16Array(hdr.v * 4), sw4 = new Float32Array(hdr.v * 4);
          const neckIdx = names.indexOf('neck_01'), chestIdx = names.indexOf('spine_03');
          const tm = new THREE.Matrix4(), v4 = new THREE.Vector3(), onBody = new Float32Array(hdr.v);
          const bindY = (bi: number) => (bi < 0 ? 0 : v4.setFromMatrixPosition(tm.copy(m.skeleton.boneInverses[bi]).invert()).applyMatrix4(tm.copy(m.bindMatrix).invert()).y);
          const yNeck = bindY(neckIdx), yHead = bindY(headIdx);
          for (let i = 0; i < hdr.v; i++) {
            const y = P[i * 3 + 1];
            if (neckIdx < 0 || chestIdx < 0 || y >= yHead) { si4[i * 4] = headIdx; sw4[i * 4] = 1; continue; }
            const tH = smooth(y, yNeck, yHead);           // head ← neck between the neck and head joints
            const tN = smooth(y, yNeck - (yHead - yNeck), yNeck); // neck ← upper back below the neck joint
            si4[i * 4] = headIdx; sw4[i * 4] = tH; onBody[i] = 1 - tH;
            si4[i * 4 + 1] = neckIdx; sw4[i * 4 + 1] = (1 - tH) * tN;
            si4[i * 4 + 2] = chestIdx; sw4[i * 4 + 2] = (1 - tH) * (1 - tN);
          }
          g.setAttribute('skinIndex', new THREE.BufferAttribute(si4, 4));
          g.setAttribute('aOnBody', new THREE.BufferAttribute(onBody, 1));
          g.setAttribute('skinWeight', new THREE.BufferAttribute(sw4, 4));
          map.colorSpace = THREE.SRGBColorSpace;
          map.anisotropy = renderer.capabilities.getMaxAnisotropy();
          const card = new THREE.SkinnedMesh(g, cardMat(map, hdr.lum));
          card.bind(m.skeleton, m.bindMatrix);
          card.position.copy(m.position); card.quaternion.copy(m.quaternion); card.scale.copy(m.scale);
          card.castShadow = true;
          card.frustumCulled = false;
          card.renderOrder = 2;
          card.visible = false;
          (card.material as THREE.MeshStandardMaterial).wireframe = wireOn;
          m.parent!.add(card);
          cards.set(id, card);
        }).catch(() => { /* stays null: the buzz cut is shown instead */ });
      };

      root.updateMatrixWorld(true);

      const p = new THREE.Vector3(), q = new THREE.Vector3();
      if (bones.upperarm_l && bones.hand_l) armSign.l = Math.sign(bones.hand_l.getWorldPosition(p).x - bones.upperarm_l.getWorldPosition(q).x) || 1;
      if (bones.upperarm_r && bones.hand_r) armSign.r = Math.sign(bones.hand_r.getWorldPosition(p).x - bones.upperarm_r.getWorldPosition(q).x) || -1;
      if (bones.thigh_l && bones.pelvis) legSign.l = Math.sign(bones.thigh_l.getWorldPosition(p).x - bones.pelvis.getWorldPosition(q).x) || 1;
      legSign.r = -legSign.l;
      if (bones.pelvis) pelvisRest.copy(bones.pelvis.position);
      for (const nm of Object.keys(bones)) {
        const m2 = /^(index|middle|ring|pinky)_0[123]_([lr])$/.exec(nm);
        if (m2) fingerNames[m2[2] as 'l' | 'r'].push(nm);
      }

      {
        const pos = geo.getAttribute('position'), yMinB = new THREE.Box3().setFromBufferAttribute(pos as THREE.BufferAttribute);
        const low = yMinB.min.y + (yMinB.max.y - yMinB.min.y) * 0.06, idx: number[] = [];
        for (let i = 0; i < pos.count; i++) if (pos.getY(i) < low ? i % 2 === 0 : i % 14 === 0) idx.push(i);
        groundIdx = Int32Array.from(idx);
        groundMesh = m;
      }
      const box = new THREE.Box3().setFromObject(root, true);
      modelH = box.max.y - box.min.y;
      modelFloor = box.min.y;

      figure.add(root);
      Object.values(bones).forEach((b) => { ALL_BONES.push(b); standQ.push(new THREE.Quaternion()); bridgeQ.push(new THREE.Quaternion()); poseQ.push(new THREE.Quaternion()); });
      Promise.all([IDLE_CLIP, ...EXERCISES].map((c) => loader.loadAsync(ANIM_URL(c.id)).then((g) => ({ ...c, ...sampleClip(g) })).catch(() => null)))
        .then((got) => {
          if (disposed || !got[0]) return;
          const ok = got.filter((c): c is NonNullable<typeof c> => !!c);
          const rows = new Float32Array(ok.reduce((a, c) => a + c.rows.length, 0));
          let start = 0;
          const clips = ok.map((c) => { rows.set(c.rows, start * c.cols); const o = { id: c.id, name: c.name, start, frames: c.frames, restFrame: c.restFrame, restScore: c.restScore }; start += c.frames; return o; });
          motion = { fps: MOTION_FPS, cols: ok[0].cols, rows, joints: MOTION_JOINTS, rest: ok[0].rest, clips };
          const C = ok[0].cols, bi = clips.findIndex((c) => c.id === 'burpee');
          let bridge: Bridge | null = null;
          if (bi > 0) {
            const bc = clips[bi], n = bc.frames, row = (f: number) => (bc.start + (((f % n) + n) % n)) * C;
            let plank = 0, best = Infinity;
            for (let f = 0; f < n; f++) {
              const sc = Math.abs(rows[row(f) + C - 5 + 1]) + 0.5 * rows[row(f) + 1]; // torso level, hips low
              if (sc < best) { best = sc; plank = f; }
            }
            const span = (a: number, b: number) => ((((b - a) % n) + n) % n) / MOTION_FPS;
            bridge = { clip: bi, stand: bc.restFrame / MOTION_FPS, plank: plank / MOTION_FPS, down: span(bc.restFrame, plank), up: span(plank, bc.restFrame) };
          }
          let at = 0;
          plan = clips.slice(1).map((c, i) => {
            const dur = c.frames / MOTION_FPS, floor = c.restScore > 1.5 && !!bridge;
            const blend = floor ? BRIDGE_FADE : EX_BLEND;
            const lead = floor ? bridge!.down + blend : blend, tail = floor ? blend + bridge!.up + EX_BLEND : blend;
            const play = Math.max(1, Math.round((EX_LEN - lead - tail) / dur)) * dur;
            const slot = { clip: i + 1, start: at, blend, play, bridge: floor ? bridge : null, lead, len: lead + play + tail + EX_BREATHER };
            at += slot.len;
            return slot;
          });
          planLen = at;
        });
      ready = true;
      setProgress(1);
    }, (e) => { if (e.total) setProgress(e.loaded / e.total); }, () => setFailed(true));

    const pq = new THREE.Quaternion(), bq = new THREE.Quaternion(), rq = new THREE.Quaternion();
    const applyWorld = (b: THREE.Bone, r: THREE.Quaternion) => {
      b.parent!.getWorldQuaternion(pq);
      b.getWorldQuaternion(bq);
      rq.copy(r).multiply(bq);
      b.quaternion.copy(pq.invert().multiply(rq));
      b.updateMatrixWorld(true);
    };
    const aq = new THREE.Quaternion();
    const rotWorld = (b: THREE.Bone | undefined, axis: THREE.Vector3, angle: number) => {
      if (!b || !b.parent) return;
      applyWorld(b, aq.setFromAxisAngle(axis, angle));
    };
    const wa = new THREE.Vector3(), wb = new THREE.Vector3(), dir = new THREE.Vector3();
    const aimWorld = (b: THREE.Bone | undefined, child: THREE.Bone | undefined, want: THREE.Vector3) => {
      if (!b || !child || !b.parent) return;
      b.getWorldPosition(wa);
      child.getWorldPosition(wb);
      dir.subVectors(wb, wa).normalize();
      applyWorld(b, aq.setFromUnitVectors(dir, want));
    };
    const wantArm = new THREE.Vector3(), wantFore = new THREE.Vector3();
    const setWorldQuat = (b: THREE.Bone, q: THREE.Quaternion) => {
      b.parent!.getWorldQuaternion(pq);
      b.quaternion.copy(pq.invert().multiply(q));
      b.updateMatrixWorld(true);
    };
    const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
    const FINGER_CURL: [RegExp, number][] = [[/^(index|middle|ring|pinky)_01_/, 0.14], [/^(index|middle|ring|pinky)_02_/, 0.26], [/^(index|middle|ring|pinky)_03_/, 0.16]];
    const Zax = new THREE.Vector3(0, 0, 1);

    let motion: Motion | null = null;
    const poseRest = (curl = true) => {
      Object.entries(rest).forEach(([n, q]) => bones[n].quaternion.copy(q));
      if (bones.pelvis) bones.pelvis.position.copy(pelvisRest);
      figure.updateMatrixWorld(true);
      if (curl) for (const side of ['l', 'r'] as const) {
        const sg = armSign[side];
        for (const [re, ang] of FINGER_CURL) for (const nm of fingerNames[side]) if (re.test(nm)) rotWorld(bones[nm], Zax, -sg * ang);
      }
    };
    const L = (): 'l' | 'r' => (legSign.l > 0 ? 'l' : 'r'), Rr = (): 'l' | 'r' => (legSign.l > 0 ? 'r' : 'l'); // performer's left / right
    type Bind = {
      bone: THREE.Bone; col: number; C: THREE.Quaternion; restW: THREE.Quaternion;
      clav: { restLocal: THREE.Quaternion; arm: Bind | null } | null; // collarbones: driven by their arm
      aim: { child: THREE.Bone; dir: THREE.Vector3 } | null; // arm bones: follow the direction only
    };
    let binds: Bind[] | null = null;
    const torsoAlign = new THREE.Quaternion();
    const restFwd = new THREE.Vector3(0, 0, 1); // the way the hips face at rest
    let shoulderSpan = 0.35;
    type FingerBind = {
      bone: THREE.Bone; col: number; prevCol: number; restW: THREE.Quaternion; hand: Bind; parent: FingerBind | null;
      axis: THREE.Vector3; perfAxis: THREE.Vector3; scale: number; bend: number;
      fistAxis: THREE.Vector3; fistJoint: number; fistBend: number; // the fist pose: this joint's curl
      gather: THREE.Quaternion | null; // fist: the knuckle closing towards the middle finger
      relaxJoint: number; relaxBend: number; // relaxed hanging hand
    };
    let fingerBinds: FingerBind[] = [];
    let fistHands: {
      hand: THREE.Bone; ours: 'l' | 'r'; palm: THREE.Vector3; restW: THREE.Quaternion; fore: THREE.Bone | null; foreRestW: THREE.Quaternion | null;
    }[] = [];
    const TWIST_SHARE = 0.65; // share of the wrist's roll taken by the forearm
    const restPelvisW = new THREE.Vector3(), restAnkle = { l: new THREE.Vector3(), r: new THREE.Vector3() };
    const mf = new Float32Array(128);
    const qW = new THREE.Quaternion(), qT = new THREE.Quaternion();
    const fqH = new THREE.Quaternion(), fqF = new THREE.Quaternion(), fqO = new THREE.Quaternion(), fqR = new THREE.Quaternion();
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
    // Retargeting: each bone copies the performer's rotation from the T-pose; arms follow direction only, legs are re-solved with IK.
    const buildBinds = (mo: Motion) => {
      const out: Bind[] = [];
      const rp = (j: string) => new THREE.Vector3(...(mo.rest[j] ?? [0, 0, 0]));
      for (const side of [null, 'L', 'R'] as const) for (const [ob, pj, oc, pa, pb] of RETARGET) {
        const isSide = ob.includes('_L');
        if ((side === null) === isSide) continue;
        const our = (n: string) => (side ? n.replace('_L', `_${side === 'L' ? L() : Rr()}`) : n);
        const perf = (n: string) => (side === 'R' ? n.replace('Left', 'Right') : n);
        const bone = bones[our(ob)];
        const col = mo.joints.indexOf(perf(pj));
        if (!bone || col < 0) continue;
        const dOur = oc && bones[our(oc)] ? v1.subVectors(bones[our(oc)].getWorldPosition(v2), bone.getWorldPosition(v3)).normalize().clone() : null;
        const dPerf = rp(perf(pb)).sub(rp(perf(pa))).normalize();
        const limb = /^(upperarm|lowerarm|hand|thigh|calf|foot)_/.test(ob);
        const C = limb && dOur ? new THREE.Quaternion().setFromUnitVectors(dOur, dPerf) : new THREE.Quaternion();
        const aimChild = /^(upperarm|lowerarm)_/.test(ob) && oc ? bones[our(oc)] : undefined;
        out.push({
          bone, col: 9 + col * 4, C, restW: bone.getWorldQuaternion(new THREE.Quaternion()),
          clav: ob.startsWith('clavicle') ? { restLocal: bone.quaternion.clone(), arm: null } : null,
          aim: aimChild ? { child: aimChild, dir: dPerf.clone() } : null,
        });
      }
      for (const b of out) if (b.clav) b.clav.arm = out.find((x) => x.bone === b.bone.children.find((c) => (c as THREE.Bone).isBone)) ?? null;
      restFwd.subVectors(bones[`thigh_${L()}`].getWorldPosition(new THREE.Vector3()), bones[`thigh_${Rr()}`].getWorldPosition(new THREE.Vector3())).cross(Y).normalize();
      shoulderSpan = bones[`upperarm_${L()}`].getWorldPosition(new THREE.Vector3()).distanceTo(bones[`upperarm_${Rr()}`].getWorldPosition(new THREE.Vector3()));
      const ourTorso = bones.neck_01.getWorldPosition(new THREE.Vector3()).sub(bones.pelvis.getWorldPosition(new THREE.Vector3())).normalize();
      torsoAlign.setFromUnitVectors(rp('Neck').sub(rp('Hips')).normalize(), ourTorso);
      fingerBinds = []; fistHands = [];
      for (const side of ['L', 'R'] as const) {
        const ours = side === 'L' ? L() : Rr();
        const hand = out.find((b) => b.bone === bones[`hand_${ours}`]);
        if (!hand) continue;
        const wpos = (n: string) => bones[`${n}_${ours}`].getWorldPosition(new THREE.Vector3());
        const fingerDir = wpos('middle_02').sub(wpos('middle_01')).normalize();
        const across = wpos('index_01').sub(wpos('pinky_01')).normalize(); // towards the thumb side
        const palm = new THREE.Vector3().crossVectors(fingerDir, across).normalize();
        if (wpos('thumb_03').sub(wpos('middle_01')).dot(palm) < 0) palm.negate();
        const axis = new THREE.Vector3().crossVectors(fingerDir, palm).normalize();
        const perfAxis = new THREE.Vector3(0, 0, side === 'L' ? -1 : 1);
        const fore = out.find((b) => b.bone === bones[`lowerarm_${ours}`]);
        fistHands.push({ hand: hand.bone, ours, palm: palm.clone(), restW: hand.restW, fore: fore?.bone ?? null, foreRestW: fore?.restW ?? null });
        let parent: FingerBind | null = null;
        for (const [ob, pj] of FINGERS) {
          const bone = bones[ob.replace('_L', `_${ours}`)];
          const col = mo.joints.indexOf(side === 'R' ? pj.replace('Left', 'Right') : pj);
          const knuckle = ob.includes('_01_');
          if (knuckle) parent = null;
          if (!bone || col < 0) { parent = null; continue; }
          const fname = ob.split('_')[0];
          const fAxis = fname === 'thumb' ? axis : new THREE.Vector3().crossVectors(wpos(`${fname}_02`).sub(wpos(`${fname}_01`)).normalize(), palm).normalize();
          let gather: THREE.Quaternion | null = null;
          if (knuckle && fname !== 'thumb' && fname !== 'middle') {
            const own = wpos(`${fname}_02`).sub(wpos(`${fname}_01`)).normalize();
            gather = new THREE.Quaternion().setFromUnitVectors(own, own.clone().lerp(fingerDir, 0.7).normalize());
          }
          const fb: FingerBind = {
            bone, col: 9 + col * 4, prevCol: parent ? parent.col : hand.col, restW: bone.getWorldQuaternion(new THREE.Quaternion()), hand, parent,
            axis: fAxis, perfAxis, gather,
            scale: ob.startsWith('thumb') ? (knuckle ? 0.1 : 0.3) : 1, bend: 0, // the thumb bends across the palm
            relaxJoint: fname === 'thumb' ? 0 : ({ index: [0.12, 0.22, 0.1], middle: [0.16, 0.26, 0.12], ring: [0.2, 0.3, 0.14], pinky: [0.24, 0.34, 0.16] } as Record<string, number[]>)[fname][+ob[ob.length - 3] - 1],
            relaxBend: 0,
            fistAxis: fAxis, fistBend: 0, fistJoint: ob.startsWith('thumb') ? 0 : [1.35, 1.4, 0.75][+ob[ob.length - 3] - 1],
          };
          fingerBinds.push(fb);
          parent = fb;
        }
      }
      return out;
    };
    const solveLeg = (side: 'l' | 'r', ankle: THREE.Vector3, kneeTo?: THREE.Vector3) => {
      const th = bones[`thigh_${side}`], ca = bones[`calf_${side}`], fo = bones[`foot_${side}`];
      if (!th || !ca || !fo) return;
      fo.getWorldQuaternion(qT);
      const hipP = th.getWorldPosition(v1).clone(), kneeP = ca.getWorldPosition(v2).clone(), ankP = fo.getWorldPosition(v3).clone();
      const L1 = hipP.distanceTo(kneeP), L2 = kneeP.distanceTo(ankP);
      const toA = ankle.clone().sub(hipP);
      const d = clamp(toA.length(), 0.05, (L1 + L2) * 0.9995);
      toA.normalize();
      const pole = (kneeTo ? kneeTo.clone() : kneeP.clone().sub(hipP)); pole.addScaledVector(toA, -pole.dot(toA));
      if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1).addScaledVector(toA, -toA.z);
      pole.normalize();
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const knee = hipP.clone().addScaledVector(toA, a).addScaledVector(pole, h);
      aimWorld(th, ca, knee.clone().sub(hipP).normalize());
      ca.getWorldPosition(v2);
      aimWorld(ca, fo, ankle.clone().sub(v2).normalize());
      setWorldQuat(fo, qT);
    };
    const solveArm = (side: 'l' | 'r', target: THREE.Vector3, pole: THREE.Vector3) => {
      const ua = bones[`upperarm_${side}`], fa = bones[`lowerarm_${side}`], hd = bones[`hand_${side}`];
      if (!ua || !fa || !hd) return;
      const sh = ua.getWorldPosition(new THREE.Vector3()), el = fa.getWorldPosition(new THREE.Vector3()), wr = hd.getWorldPosition(new THREE.Vector3());
      const L1 = sh.distanceTo(el), L2 = el.distanceTo(wr);
      const to = target.clone().sub(sh), d = clamp(to.length(), 0.05, (L1 + L2) * 0.999);
      to.normalize();
      const pl = pole.clone().addScaledVector(to, -pole.dot(to)).normalize();
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const elbow = sh.clone().addScaledVector(to, a).addScaledVector(pl, h);
      aimWorld(ua, fa, elbow.clone().sub(sh).normalize());
      aimWorld(fa, hd, sh.addScaledVector(to, d).sub(fa.getWorldPosition(v2)).normalize());
    };
    // Free-throw stance built on the standing pose with leg and arm IK.
    const freeThrow = (H: number) => {
      const sc = H / 1.7, up = Y;
      const fwd = restFwd.clone(), lat = bones[`thigh_${L()}`].getWorldPosition(new THREE.Vector3()).sub(bones[`thigh_${Rr()}`].getWorldPosition(new THREE.Vector3())).setY(0).normalize();
      const ank = (side: 'l' | 'r') => bones[`foot_${side}`].getWorldPosition(new THREE.Vector3());
      const aL = ank(L()).addScaledVector(lat, 0.05 * sc).addScaledVector(fwd, -0.02 * sc);
      const aR = ank(Rr()).addScaledVector(lat, -0.05 * sc).addScaledVector(fwd, 0.07 * sc); // shooting foot ahead
      const pel = bones.pelvis, par = pel.parent!;
      const from = pel.getWorldPosition(new THREE.Vector3()), to = from.clone().addScaledVector(up, -0.1 * sc).addScaledVector(fwd, -0.05 * sc);
      par.worldToLocal(from); par.worldToLocal(to);
      pel.position.add(to.sub(from));
      pel.updateMatrixWorld(true);
      solveLeg(L(), aL, fwd.clone().addScaledVector(lat, 0.3));
      solveLeg(Rr(), aR, fwd.clone().addScaledVector(lat, -0.3));
      applyWorld(bones.spine_01, qT.setFromUnitVectors(up, up.clone().addScaledVector(fwd, 0.2).normalize()));
      const pitch = v1.crossVectors(fwd, up).normalize().clone();
      rotWorld(bones.neck_01, pitch, 0.12);
      rotWorld(bones.head, pitch, 0.36);
      const hipW = bones.pelvis.getWorldPosition(new THREE.Vector3());
      ballAt.copy(hipW).addScaledVector(fwd, 0.32 * sc).addScaledVector(up, 0.17 * sc).addScaledVector(lat, -0.05 * sc);
      const r = BALL_R * sc;
      const wL = ballAt.clone().addScaledVector(lat, r * 1.0).addScaledVector(fwd, -r * 0.55).addScaledVector(up, r * 0.15);
      const wR = ballAt.clone().addScaledVector(lat, -r * 0.75).addScaledVector(up, -r * 0.55).addScaledVector(fwd, -r * 0.6);
      solveArm(L(), wL, up.clone().multiplyScalar(-0.7).addScaledVector(fwd, -0.4).addScaledVector(lat, 0.6));
      solveArm(Rr(), wR, up.clone().multiplyScalar(-0.8).addScaledVector(fwd, -0.3).addScaledVector(lat, -0.5));
      for (const [side, wrist] of [[L(), wL], [Rr(), wR]] as const) {
        const hd = bones[`hand_${side}`], mid = bones[`middle_01_${side}`], fh = fistHands.find((x) => x.ours === side);
        if (!hd || !mid) continue;
        const toC = ballAt.clone().sub(wrist).normalize();
        const along = fwd.clone().addScaledVector(toC, -fwd.dot(toC)).normalize().lerp(toC, 0.35).normalize();
        aimWorld(hd, mid, along);
        if (!fh) continue;
        const fingerDir = mid.getWorldPosition(new THREE.Vector3()).sub(hd.getWorldPosition(v2)).normalize();
        const palmNow = fh.palm.clone().applyQuaternion(hd.getWorldQuaternion(fqO).multiply(fqR.copy(fh.restW).invert()));
        const want = ballAt.clone().sub(hd.getWorldPosition(v2));
        palmNow.addScaledVector(fingerDir, -palmNow.dot(fingerDir)); want.addScaledVector(fingerDir, -want.dot(fingerDir));
        if (palmNow.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) continue;
        palmNow.normalize(); want.normalize();
        rotWorld(hd, fingerDir, Math.atan2(v1.crossVectors(palmNow, want).dot(fingerDir), palmNow.dot(want)));
      }
    };
    const qI = new THREE.Quaternion(), headRest = new THREE.Quaternion();
    const qA = new THREE.Quaternion(), torsoUp = new THREE.Vector3(), clavOut = new THREE.Vector3();
    const fistQ = new THREE.Quaternion();
    let mocapAir = 0; // the last posed clip's feet height off the floor (metres)
    const applyMocap = (ci: number, time: number, stance = 1, inward = 0, fist = 0, relax = false) => {
      const mo = motion!, clip = mo.clips[ci], n = clip.frames, C = mo.cols;
      const ff = (time * mo.fps) % n, i0 = Math.floor(ff), i1 = (i0 + 1) % n, a = ff - i0;
      const r0 = (clip.start + i0) * C, r1 = (clip.start + i1) * C;
      for (let k = 0; k < 9; k++) mf[k] = mo.rows[r0 + k] + (mo.rows[r1 + k] - mo.rows[r0 + k]) * a;
      binds ??= buildBinds(mo);
      bones.pelvis.getWorldPosition(restPelvisW);
      for (const side of ['l', 'r'] as const) bones[`foot_${side}`]?.getWorldPosition(restAnkle[side]);
      const floorY = Math.min(restAnkle.l.y, restAnkle.r.y);
      const thighY = bones[`thigh_${L()}`].getWorldPosition(v3).y, leg = thighY - floorY, hipOff = restPelvisW.y - thighY;
      mocapAir = (mo.rows[r0 + C - 1] + (mo.rows[r1 + C - 1] - mo.rows[r0 + C - 1]) * a) * leg;
      for (const b of binds) {
        qW.set(mo.rows[r0 + b.col], mo.rows[r0 + b.col + 1], mo.rows[r0 + b.col + 2], mo.rows[r0 + b.col + 3]);
        qT.set(mo.rows[r1 + b.col], mo.rows[r1 + b.col + 1], mo.rows[r1 + b.col + 2], mo.rows[r1 + b.col + 3]);
        qW.normalize().slerp(qT.normalize(), a);
        if (b.clav) {
          b.bone.quaternion.copy(b.clav.restLocal);
          b.bone.updateMatrixWorld(true);
          const arm = b.clav.arm;
          if (!arm?.aim) continue;
          qA.fromArray(mo.rows, r0 + arm.col).normalize().slerp(qT.fromArray(mo.rows, r1 + arm.col).normalize(), a);
          const armDir = v3.copy(arm.aim.dir).applyQuaternion(qA);
          torsoUp.subVectors(bones.neck_01.getWorldPosition(v1), bones.spine_03.getWorldPosition(v2)).normalize();
          const elev = Math.asin(clamp(armDir.dot(torsoUp), -1, 1));
          const lift = 0.07 + clamp(elev < 0 ? 0.08 * elev : 0.33 * elev, -0.12, 0.42);
          clavOut.subVectors(arm.bone.getWorldPosition(v1), b.bone.getWorldPosition(v2));
          rotWorld(b.bone, v1.crossVectors(clavOut, torsoUp).normalize(), lift);
          continue;
        }
        if (b.aim) aimWorld(b.bone, b.aim.child, v3.copy(b.aim.dir).applyQuaternion(qW));
        else setWorldQuat(b.bone, qW.multiply(b.C).multiply(b.restW));
        if (b.bone === bones.spine_03) {
          const tc = C - 5;
          v3.set(mo.rows[r0 + tc], mo.rows[r0 + tc + 1], mo.rows[r0 + tc + 2])
            .lerp(v2.set(mo.rows[r1 + tc], mo.rows[r1 + tc + 1], mo.rows[r1 + tc + 2]), a).normalize().applyQuaternion(torsoAlign);
          bones.pelvis.getWorldPosition(v1);
          bones.neck_01.getWorldPosition(v2).sub(v1).normalize();
          applyWorld(bones.spine_01, qT.setFromUnitVectors(v2, v3));
        }
      }
      const headY = bones.head.getWorldPosition(v3).y;
      const fwd = bones.ball_l && bones.foot_l ? bones.ball_l.getWorldPosition(new THREE.Vector3()).sub(bones.foot_l.getWorldPosition(v1)).setY(0).normalize() : new THREE.Vector3(0, 0, 1);
      for (const side of ['l', 'r'] as const) {
        const ua = bones[`upperarm_${side}`], fa = bones[`lowerarm_${side}`], hd = bones[`hand_${side}`];
        if (!ua || !fa || !hd) continue;
        const up = fa.getWorldPosition(v2).sub(ua.getWorldPosition(v1)).normalize().clone();
        const fore = hd.getWorldPosition(v1).sub(fa.getWorldPosition(v2)).normalize().clone();
        const k = smooth(hd.getWorldPosition(v1).y - headY, -0.05, 0.15) * 0.4;
        if (k > 0) fore.lerp(up, k).normalize();
        const MIN_BEND = 0.22; // ~13°
        const bend = up.angleTo(fore);
        if (bend < MIN_BEND) {
          const n = v2.crossVectors(up, fore);
          if (n.lengthSq() < 1e-4) n.crossVectors(up, fwd);
          if (n.lengthSq() < 1e-6) continue;
          fore.copy(up).applyAxisAngle(n.normalize(), MIN_BEND);
        }
        aimWorld(fa, hd, fore);
      }
      const lh = bones[`hand_${L()}`], rh = bones[`hand_${Rr()}`], la = bones[`upperarm_${L()}`], ra = bones[`upperarm_${Rr()}`];
      if (lh && rh && la && ra) {
        const want = (mo.rows[r0 + C - 2] + (mo.rows[r1 + C - 2] - mo.rows[r0 + C - 2]) * a) * shoulderSpan;
        for (let it = 0; it < 3; it++) {
          const gap = lh.getWorldPosition(v1).x - rh.getWorldPosition(v2).x;
          if (gap >= want - 0.005) break;
          for (const [arm, hand, side] of [[la, lh, 1], [ra, rh, -1]] as const) {
            const sh = arm.getWorldPosition(v3), r = hand.getWorldPosition(v1).sub(sh);
            const axis = v2.crossVectors(r, X).multiplyScalar(side).normalize();
            if (axis.lengthSq() < 0.5) continue;
            applyWorld(arm, qT.setFromAxisAngle(axis, Math.min(0.4, (want - gap) / 2 / Math.max(0.2, r.length()))));
          }
        }
      }
      for (const fh of fistHands) {
        if (!fh.fore || !fh.foreRestW) continue;
        const axisF = fh.hand.getWorldPosition(v1).sub(fh.fore.getWorldPosition(v2)).normalize().clone();
        const sH = v2.copy(fh.palm).applyQuaternion(fh.hand.getWorldQuaternion(fqO).multiply(fqR.copy(fh.restW).invert()));
        const sF = v3.copy(fh.palm).applyQuaternion(fh.fore.getWorldQuaternion(fqO).multiply(fqR.copy(fh.foreRestW).invert()));
        sH.addScaledVector(axisF, -sH.dot(axisF)); sF.addScaledVector(axisF, -sF.dot(axisF));
        if (sH.lengthSq() < 1e-6 || sF.lengthSq() < 1e-6) continue;
        sH.normalize(); sF.normalize();
        const twist = Math.atan2(v1.crossVectors(sF, sH).dot(axisF), sF.dot(sH));
        if (Math.abs(twist) < 0.01) continue;
        const handW = fh.hand.getWorldQuaternion(new THREE.Quaternion());
        rotWorld(fh.fore, axisF, twist * TWIST_SHARE);
        setWorldQuat(fh.hand, handW);
      }
      const lerpRow = (col: number, out: THREE.Quaternion) => {
        out.fromArray(mo.rows, r0 + col).normalize();
        return out.slerp(qT.fromArray(mo.rows, r1 + col).normalize(), a);
      };
      for (const fb of fingerBinds) {
        lerpRow(fb.prevCol, fqH).invert().multiply(lerpRow(fb.col, fqF));
        const ang = 2 * Math.acos(clamp(Math.abs(fqH.w), 0, 1));
        const sgn = Math.sign((fqH.x * fb.perfAxis.x + fqH.y * fb.perfAxis.y + fqH.z * fb.perfAxis.z) * (fqH.w < 0 ? -1 : 1)) || 1;
        fb.bend = (fb.parent ? fb.parent.bend : 0) + clamp(sgn * ang * fb.scale, -0.15, 1.6);
        fb.fistBend = (fb.parent ? fb.parent.fistBend : 0) + fb.fistJoint;
        fb.hand.bone.getWorldQuaternion(fqO).multiply(fqR.copy(fb.hand.restW).invert());
        fb.relaxBend = (fb.parent ? fb.parent.relaxBend : 0) + fb.relaxJoint;
        fqF.setFromAxisAngle(fb.axis, relax && fb.relaxJoint ? fb.relaxBend : fb.bend);
        if (fist > 0) {
          fistQ.setFromAxisAngle(fb.fistAxis, fb.fistBend);
          const g = fb.gather ?? fb.parent?.gather ?? fb.parent?.parent?.gather;
          if (g) fistQ.multiply(g);
          fqF.slerp(fistQ, fist);
        }
        setWorldQuat(fb.bone, fqO.multiply(fqF).multiply(fb.restW));
      }
      if (fist > 0) for (const fh of fistHands) {
        const t1 = bones[`thumb_01_${fh.ours}`], t2 = bones[`thumb_02_${fh.ours}`], t3 = bones[`thumb_03_${fh.ours}`];
        const i2 = bones[`index_02_${fh.ours}`], m2 = bones[`middle_02_${fh.ours}`];
        if (!t1 || !t2 || !t3 || !i2 || !m2) continue;
        const palmNow = v3.copy(fh.palm).applyQuaternion(fh.hand.getWorldQuaternion(fqO).multiply(fqR.copy(fh.restW).invert()));
        const outside = 0.012; // just in front of the curled fingers, not inside them
        const aimAt = (b: THREE.Bone, child: THREE.Bone, target: THREE.Vector3) => {
          const want = target.sub(b.getWorldPosition(v1)).normalize();
          const cur = child.getWorldPosition(v2).sub(b.getWorldPosition(v1)).normalize();
          aimWorld(b, child, cur.lerp(want, fist).normalize());
        };
        aimAt(t1, t2, i2.getWorldPosition(new THREE.Vector3()).addScaledVector(palmNow, outside));
        aimAt(t2, t3, m2.getWorldPosition(new THREE.Vector3()).addScaledVector(palmNow, outside));
        const tipDir = t3.getWorldPosition(new THREE.Vector3()).sub(t2.getWorldPosition(v1)).normalize();
        const curlAx = v2.crossVectors(tipDir, palmNow);
        if (curlAx.lengthSq() > 1e-6) rotWorld(t3, curlAx.normalize(), -0.75 * fist);
      }
      if (stance !== 1 || inward) {
        const halfHip = Math.abs(bones.thigh_l.getWorldPosition(v1).x - bones.thigh_r.getWorldPosition(v2).x) / 2 / leg;
        let lift = 0;
        for (const [o, out] of [[3, 1], [6, -1]]) { // the performer's left is +x
          const x = mf[o], y = mf[o + 1];
          const nx = x * stance - out * inward * halfHip;
          const y2 = -Math.sqrt(Math.max(0.01, x * x + y * y - nx * nx));
          lift += (y - y2) / 2;
          mf[o] = nx; mf[o + 1] = y2;
        }
        mf[1] += lift;
      }
      const pel = bones.pelvis, par = pel.parent!;
      v1.copy(restPelvisW); v2.set(restPelvisW.x + mf[0] * leg, floorY + mf[1] * leg + hipOff, restPelvisW.z + mf[2] * leg);
      par.worldToLocal(v1); par.worldToLocal(v2);
      pel.position.add(v2.sub(v1));
      pel.updateMatrixWorld(true);
      const lft = L(), rgt = Rr();
      const pb = binds.find((b) => b.bone === bones.pelvis);
      const bodyFwd = restFwd.clone();
      if (pb) bodyFwd.applyQuaternion(bones.pelvis.getWorldQuaternion(qT).multiply(qW.copy(pb.restW).invert()));
      const kneeTo = (side: 'l' | 'r', out: number) => {
        const pole = bodyFwd.clone();
        const fo = bones[`foot_${side}`], ba = bones[`ball_${side}`];
        if (fo && ba) {
          const toes = ba.getWorldPosition(new THREE.Vector3()).sub(fo.getWorldPosition(v2)).normalize();
          pole.lerp(toes, smooth(toes.dot(bodyFwd), 0.15, 0.45));
        }
        if (inward) pole.normalize().add(v2.set(-out * 0.2, 0, 0));
        return pole;
      };
      const hipL = bones[`thigh_${lft}`].getWorldPosition(new THREE.Vector3()), hipR = bones[`thigh_${rgt}`].getWorldPosition(new THREE.Vector3());
      const ankL = hipL.clone().add(v1.set(mf[3], mf[4], mf[5]).multiplyScalar(leg)), ankR = hipR.clone().add(v1.set(mf[6], mf[7], mf[8]).multiplyScalar(leg));
      const mid = hipL.clone().add(hipR).multiplyScalar(0.5), lat = hipL.clone().sub(hipR), half = lat.length() / 2;
      lat.normalize();
      for (const [ank, sgn] of [[ankL, 1], [ankR, -1]] as const) {
        const sd = ank.clone().sub(mid).dot(lat) * sgn, minSd = 0.35 * half;
        if (sd < minSd) ank.addScaledVector(lat, (minSd - sd) * sgn);
      }
      solveLeg(lft, ankL, kneeTo(lft, 1));
      solveLeg(rgt, ankR, kneeTo(rgt, -1));
    };
    const ALL_BONES: THREE.Bone[] = [];
    const standQ: THREE.Quaternion[] = [];
    const standPelvis = new THREE.Vector3();
    const bridgeQ: THREE.Quaternion[] = [], bridgePelvis = new THREE.Vector3();

    const applyTheme = () => {
      const light = document.documentElement.dataset.theme === 'light';
      discMat.color.set(light ? 0xd8dee7 : 0x1d2027);
      rulerMat.color.set(light ? 0x8a93a3 : 0x5e6573);
    };
    applyTheme();
    const themeObs = new MutationObserver(applyTheme);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let spinLeft = 0;
    let workOn = true, workW = 0, exShown = '';
    let poseOn = false, poseW = 0, lastT = 0;
    const poseQ: THREE.Quaternion[] = [], posePelvis = new THREE.Vector3(), ballAt = new THREE.Vector3();
    let workStart: number | null = null; // clock time the workout started (null: not working out)
    let plan: { clip: number; start: number; blend: number; play: number; bridge: Bridge | null; lead: number; len: number }[] = [], planLen = 1;
    const ease = (x: number) => { const k = clamp(x, 0, 1); return k * k * k * (k * (k * 6 - 15) + 10); };
    // Workout timeline: blend in from standing, whole repetitions, blend out, breather (floor exercises get down/up via the burpee).
    const planAt = (el: number) => {
      const e = ((el % planLen) + planLen) % planLen;
      const sl = plan.find((x) => e < x.start + x.len) ?? plan[plan.length - 1];
      const loc = e - sl.start, rest = motion!.clips[sl.clip].restFrame / MOTION_FPS;
      const tt = rest + clamp(loc - sl.lead, 0, sl.play), afterPlay = loc - sl.lead - sl.play;
      const br = sl.bridge;
      if (!br) {
        const amp = ease(loc / sl.blend) * (1 - ease(afterPlay / sl.blend));
        return { sl, ex: sl.clip, tt, amp, breather: afterPlay > sl.blend, bridge: null };
      }
      const EB = EX_BLEND;
      if (loc < br.down + sl.blend) {
        const bt = br.stand + Math.min(loc, br.down);
        return { sl, ex: sl.clip, tt, amp: ease(loc / 0.4), breather: false, bridge: { clip: br.clip, tt: bt, mix: ease((loc - br.down) / sl.blend) } };
      }
      if (afterPlay <= 0) return { sl, ex: sl.clip, tt, amp: 1, breather: false, bridge: null };
      const up = afterPlay - sl.blend, bt = br.plank + clamp(up, 0, br.up);
      return {
        sl, ex: sl.clip, tt, amp: 1 - ease((up - br.up) / EB), breather: up > br.up + EB,
        bridge: { clip: br.clip, tt: bt, mix: 1 - ease(afterPlay / sl.blend) },
      };
    };
    let lastParams = target.current, lastLook = '';
    let focusOn = false;
    let distGoal: number | null = null;
    api.current = {
      spin: (rad) => { spinLeft += rad; controls.autoRotate = false; clearTimeout(idle); idle = setTimeout(() => { controls.autoRotate = autoOn; }, 3500); },
      reset: () => { spinLeft = -controls.getAzimuthalAngle(); },
      setFocus: (on) => { focusOn = on; distGoal = on ? 1.05 : 4.1; },
      setWorkout: (on) => { workOn = on; },
      setPose: (on) => { poseOn = on; poke(); },
      nextExercise: () => {
        if (workStart === null || !plan.length) { lastInput = -1e9; return; } // start right away
        const el2 = clock.getElapsedTime() - workStart, { sl } = planAt(el2);
        const e = ((el2 % planLen) + planLen) % planLen, target = sl.start + sl.blend + sl.play;
        if (e < target) workStart -= target - e;
      },
      setAuto: (on) => { autoOn = on; controls.autoRotate = on; },
      setWire: (on) => {
        wireOn = on;
        [skin, ...hairMats].forEach((mt) => { mt.wireframe = on; });
        cards.forEach((c) => { if (c) (c.material as THREE.MeshStandardMaterial).wireframe = on; });
      },
    };

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const cur = { h: target.current.heightCm, w: target.current.weightKg, age: target.current.age, f: target.current.sex === 'f' ? 1 : 0 };
    const toneColor = new THREE.Color(), tmpCol = new THREE.Color();
    const ringColor = new THREE.Color();
    const clock = new THREE.Clock();
    const labelPos = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime(), frameDt = Math.min(0.1, t - lastT);
      lastT = t;
      const tg = target.current;
      cur.h += (tg.heightCm - cur.h) * 0.14;
      cur.w += (tg.weightKg - cur.w) * 0.14;
      cur.age += (tg.age - cur.age) * 0.14;
      cur.f += ((tg.sex === 'f' ? 1 : 0) - cur.f) * 0.12;
      const H = cur.h / 100;
      const bmi = cur.w / (H * H);
      const bf = bodyFatPct(bmi, cur.age, cur.f > 0.5 ? 'f' : 'm') / 100;
      const ageK = clamp((cur.age - 35) / 45, 0, 1);
      const f = cur.f;

      u.uInflate.value = clamp((bmi - 22) * 0.0026, -0.008, 0.055);
      u.uBelly.value = clamp((bf - 0.2) * 0.2 + Math.max(0, bmi - 27) * 0.0018, 0, 0.085) * (1 - 0.35 * f);
      const hr = hairRef.current;
      const style = hr.style ?? defaultHairStyle(f > 0.5 ? 'f' : 'm');
      pickedHair.set(hr.color);
      hairTarget.copy(pickedHair).lerp(gray, clamp((cur.age - 40) / 30, 0, 0.85));
      hairU.uHairCol.value.lerp(hairTarget, 0.1);
      if (style !== 'buzz') loadCard?.(style);
      const card = style === 'buzz' ? null : cards.get(style) ?? null;
      cards.forEach((c) => { if (c) c.visible = c === card; });
      shellLayers.forEach((l) => { l.visible = !card; });
      cardU.uTime.value = t;
      u.uGroin.value = 0.022 * f;
      const look = lookRef.current;
      const kit = OUTFIT_KIT[look.outfit](f > 0.5);
      cloth.uTopKind.value = kit.top; cloth.uBotLo.value = kit.lo; cloth.uBotHi.value = kit.hi;
      cloth.uLooseTop.value = kit.looseTop; cloth.uLooseBot.value = kit.looseBot;
      cardU.uHairPad.value = 0.008 + kit.looseTop * 1.5;
      const white = look.outfitColor.toLowerCase() === '#e6e6e3', ember = look.outfitColor.toLowerCase() === '#ff5e1a';
      cloth.uTopCol.value.lerp(tmpCol.set(look.outfitColor), 0.15);
      const matched = look.outfit === 'compression' || look.outfit === 'leggings' || look.outfit === 'tracksuit';
      cloth.uBotCol.value.lerp(tmpCol.set(matched && !white ? look.outfitColor : look.outfit === 'tee' ? 0x3a3d45 : 0x1d2026), 0.15);
      cloth.uShoeCol.value.lerp(tmpCol.set(white ? 0x2a2d35 : 0xeaeaea), 0.15);
      cloth.uAccent.value.lerp(tmpCol.set(ember ? 0xf4f4f2 : 0xff5e1a), 0.15);

      const lookKey = `${toneRef.current}|${hr.style}|${hr.color}|${look.outfit}|${look.outfitColor}`;
      if (tg !== lastParams || lookKey !== lastLook) { lastParams = tg; lastLook = lookKey; poke(); }
      const nEx = plan.length;
      const wantWork = workOn && !poseOn && ready && !!motion && nEx > 0 && performance.now() / 1000 - lastInput > IDLE_S;
      workW += ((wantWork ? 1 : 0) - workW) * (wantWork ? 0.025 : 0.15);
      if (workW < 0.002) workStart = null; else if (workStart === null) workStart = t;
      let ex = -1, tt = 0, amp = 0, breather = false, bridgeNow: { clip: number; tt: number; mix: number } | null = null;
      if (workStart !== null && nEx > 0) ({ ex, tt, amp, breather, bridge: bridgeNow } = planAt(t - workStart));
      let ww = workW * amp;
      const forced = import.meta.env.DEV ? (window as unknown as { __bodyLabPose?: { ex: number; tt: number } }).__bodyLabPose : undefined;
      if (forced && motion && motion.clips[forced.ex + 1]) { ex = forced.ex + 1; tt = forced.tt; ww = 1; breather = false; bridgeNow = null; }
      const pinned = demoRef.current && motion ? motion.clips.findIndex((c) => c.id === demoRef.current) : -1;
      if (pinned > 0) { ex = pinned; tt = t; ww = 1; breather = false; bridgeNow = null; }
      const shownEx = breather && plan.length ? plan[(plan.findIndex((x) => x.clip === ex) + 1) % plan.length].clip : ex;
      const exName = pinned > 0 ? '' : poseOn ? 'Free-throw stance' : (workW > 0.3 || forced) && shownEx >= 1 && motion ? motion.clips[shownEx].name : '';
      if (exName !== exShown) { exShown = exName; setExercise(exName); }
      u.uGlute.value = clamp((bmi - 22) * 0.0012, 0, 0.03) + 0.014 * f;
      u.uHip.value = 0.024 * f + Math.max(0, bmi - 22) * 0.0009;
      u.uWaist.value = 0.016 * f - Math.max(0, bmi - 25) * 0.0012;
      u.uBust.value = 0.03 * f * (0.8 + 0.25 * clamp(bmi / 22, 0.7, 1.8));

      if (ready) {
        const s = H / modelH;
        figure.scale.setScalar(s);
        figure.position.y = -modelFloor * s;
        poseRest(!motion);
        let airNow = 0;
        if (motion) {
          bones.head.getWorldQuaternion(headRest).invert();
          applyMocap(0, t, 0.15, 0.35, 0, true);
          airNow = 0; // standing: feet flat
          bones.head.getWorldQuaternion(tmpQ2).multiply(headRest);
          v2.copy(Y).applyQuaternion(tmpQ2);
          applyWorld(bones.head, tmpQ.setFromUnitVectors(v2, Y).slerp(qI, 0.3));
        } else {
          const breathe = Math.sin(t * 1.8) * 0.012;
          rotWorld(bones.spine_03, X, breathe * 0.4);
          const out = THREE.MathUtils.degToRad(9) + breathe;
          for (const [side, sign] of [['l', armSign.l], ['r', armSign.r]] as const) {
            wantArm.set(sign * Math.sin(out), -Math.cos(out), 0.03).normalize();
            aimWorld(bones[`upperarm_${side}`], bones[`lowerarm_${side}`], wantArm);
            wantFore.set(sign * Math.sin(out * 0.7), -1, 0.2).normalize();
            aimWorld(bones[`lowerarm_${side}`], bones[`hand_${side}`], wantFore);
          }
        }
        if (motion && ww > 0.001 && ex >= 1) {
          ALL_BONES.forEach((b, i) => standQ[i].copy(b.quaternion));
          standPelvis.copy(bones.pelvis.position);
          poseRest(false);
          const fistOf = (c: number) => (FIST_CLIPS.has(motion!.clips[c].id) ? 1 : 0);
          let exAir = 0;
          if (bridgeNow && bridgeNow.mix < 0.999) {
            applyMocap(bridgeNow.clip, bridgeNow.tt, 1, 0, fistOf(bridgeNow.clip));
            const airB = mocapAir;
            exAir = airB;
            if (bridgeNow.mix > 0.001) {
              ALL_BONES.forEach((b, i) => bridgeQ[i].copy(b.quaternion));
              bridgePelvis.copy(bones.pelvis.position);
              poseRest(false);
              applyMocap(ex, tt, 1, 0, fistOf(ex));
              exAir = airB + (mocapAir - airB) * bridgeNow.mix;
              ALL_BONES.forEach((b, i) => { tmpQ.copy(b.quaternion); b.quaternion.copy(bridgeQ[i]).slerp(tmpQ, bridgeNow!.mix); });
              bones.pelvis.position.lerpVectors(bridgePelvis, bones.pelvis.position, bridgeNow.mix);
            }
          } else { applyMocap(ex, tt, 1, 0, fistOf(ex)); exAir = mocapAir; }
          airNow = exAir * ww;
          ALL_BONES.forEach((b, i) => { tmpQ.copy(b.quaternion); b.quaternion.copy(standQ[i]).slerp(tmpQ, ww); });
          bones.pelvis.position.lerpVectors(standPelvis, bones.pelvis.position, ww);
          figure.updateMatrixWorld(true);
        }
        poseW += ((poseOn && motion ? 1 : 0) - poseW) * (1 - Math.exp(-frameDt * 4)); // ~1 s, at any frame rate
        if (poseW > 0.001 && motion) {
          ALL_BONES.forEach((b, i) => poseQ[i].copy(b.quaternion));
          posePelvis.copy(bones.pelvis.position);
          freeThrow(H);
          const k = poseW * poseW * (3 - 2 * poseW);
          ALL_BONES.forEach((b, i) => { tmpQ.copy(b.quaternion); b.quaternion.copy(poseQ[i]).slerp(tmpQ, k); });
          bones.pelvis.position.lerpVectors(posePelvis, bones.pelvis.position, k);
          figure.updateMatrixWorld(true);
          airNow *= 1 - k;
        }
        const spread = THREE.MathUtils.degToRad(clamp((bmi - 24) * 0.75, 0, 14)) * (1 - ww) * (1 - poseW);
        rotWorld(bones.upperarm_l, Zax, armSign.l * spread);
        rotWorld(bones.upperarm_r, Zax, armSign.r * spread);
        rotWorld(bones.spine_03, X, 0.1 * ageK);
        rotWorld(bones.neck_01, X, 0.16 * ageK);
        rotWorld(bones.head, X, -0.1 * ageK);
        // Rest the lowest skin point on the platform, lifted only by the clip's jump height.
        figure.updateMatrixWorld(true);
        const lift = airNow + 0.002 - lowestSkin();
        figure.position.y += lift;
        figure.updateMatrixWorld(true);
        ball.visible = poseW > 0.6;
        if (ball.visible) {
          ball.position.copy(ballAt).setY(ballAt.y + lift);
          ball.scale.setScalar((H / 1.7) * smooth(poseW, 0.6, 1));
          ball.rotation.set(0.35, 0.6, 0.15);
        }
      }

      toneColor.set(toneRef.current);
      skin.color.lerp(toneColor, 0.1);
      ringColor.set(bmiColor(bmi));
      ringMat.color.lerp(ringColor, 0.1);
      pulseMat.color.copy(ringMat.color);

      if (Math.abs(H - rulerH) > 0.002) buildRuler(H);
      controls.target.y += ((focusOn ? H * 0.9 : H * 0.52) - controls.target.y) * 0.1;
      if (distGoal !== null) {
        offset.subVectors(camera.position, controls.target);
        const d = offset.length(), next = d + (distGoal - d) * 0.12;
        camera.position.copy(controls.target).add(offset.setLength(next));
        if (Math.abs(next - distGoal) < 0.01) distGoal = null;
      }
      if (Math.abs(spinLeft) > 0.001) {
        const step = spinLeft * 0.12;
        spinLeft -= step;
        offset.subVectors(camera.position, controls.target).applyAxisAngle(Y, step);
        camera.position.copy(controls.target).add(offset);
      }
      const ps = 1 + ((t * 0.6) % 1) * 0.25;
      pulse.scale.set(ps, ps, 1);
      pulseMat.opacity = 0.35 * (1 - ((t * 0.6) % 1));

      controls.update();
      camera.updateMatrixWorld();
      cardU.uKeyDir.value.copy(key.position).normalize().transformDirection(camera.matrixWorldInverse); // hair highlight
      renderer.render(scene, camera);

      const tag = labelRef.current;
      if (tag) {
        labelPos.set(RX + 0.05, H, 0).project(camera);
        const maxX = el.clientWidth - tag.offsetWidth - 66;
        const x = Math.max(12, Math.min(maxX, (labelPos.x * 0.5 + 0.5) * el.clientWidth + 8));
        const y = Math.max(44, (-labelPos.y * 0.5 + 0.5) * el.clientHeight - 14);
        tag.style.transform = `translate(${x}px, ${y}px)`;
        tag.textContent = `${Math.round(cur.h)} cm`;
      }
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      ro.disconnect();
      themeObs.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  return (
    <div className={cls('body-stage', demo && 'compact')} data-noswipe>
      <div ref={mountRef} className="body-canvas" />
      <div ref={labelRef} className="body-height-tag" />
      {progress < 1 && !failed && (
        <div className="body-loading">
          <div className="eyebrow">Loading body model</div>
          <div className="progress" style={{ width: 180 }}><div style={{ width: `${Math.max(6, progress * 100)}%` }} /></div>
        </div>
      )}
      {failed && <div className="body-loading small muted">Couldn't load the 3D model. Check your connection and reopen this page.</div>}
      <div className="body-hint xs muted bold"><Scan size={13} /> Drag to rotate · pinch or scroll to zoom</div>
      <div className="body-tools">
        <button className="icon-btn sm" aria-label="Rotate left" onClick={() => api.current?.spin(-Math.PI / 4)}><RotateCcw size={15} /></button>
        <button className="icon-btn sm" aria-label="Rotate right" onClick={() => api.current?.spin(Math.PI / 4)}><RotateCw size={15} /></button>
        <button className={cls('icon-btn sm', auto && 'active')} aria-label="Auto rotate" onClick={() => { api.current?.setAuto(!auto); setAuto(!auto); }}>{auto ? <Pause size={15} /> : <Play size={15} />}</button>
        <button className={cls('icon-btn sm', wire && 'active')} aria-label="Wireframe" onClick={() => { api.current?.setWire(!wire); setWire(!wire); }}><Grid3x3 size={15} /></button>
        <button className="icon-btn sm" aria-label="Face front" onClick={() => api.current?.reset()}><span className="xs heavy">F</span></button>
        <button className={cls('icon-btn sm', focus && 'active')} aria-label="Close-up" title="Close-up on the head"
          onClick={() => { api.current?.setFocus(!focus); setFocus(!focus); }}>{focus ? <ZoomOut size={15} /> : <ZoomIn size={15} />}</button>
        <button className={cls('icon-btn sm', workout && 'active')} aria-label="Idle workout" title="Work out when idle"
          onClick={() => { api.current?.setWorkout(!workout); setWorkout(!workout); }}><Dumbbell size={15} /></button>
        {SHOW_POSE_BUTTON && (
          <button className={cls('icon-btn sm', posing && 'active')} aria-label="Free-throw stance" title="Free-throw stance"
            onClick={() => { api.current?.setPose(!posing); setPosing(!posing); }}><Dribbble size={15} /></button>
        )}
      </div>
      {exercise && (
        <button className="body-exercise" title={posing ? 'Back to idle' : 'Next exercise'}
          onClick={() => { if (posing) { api.current?.setPose(false); setPosing(false); } else api.current?.nextExercise(); }}>
          <span className="dot pulse-dot" /> {exercise} {posing ? <span className="xs muted">✕</span> : <SkipForward size={13} />}
        </button>
      )}
    </div>
  );
}
