// Sân khấu DR-3: nhà chứa tối, một đèn chính ấm đổ bóng xuống sàn, đèn viền lạnh phía sau tách bóng rồng khỏi nền,
// RoomEnvironment cho kim loại phản chiếu, vòng đo nét đứt trên sàn. frame(s, cam) đặt rồng từ state rồi vẽ một khung;
// cam có thể là hàm (worldOf) → góc máy, để góc máy bám đúng vị trí đầu / lõi sau khi đã đặt dáng.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildDragon, makeMats} from './rong.js';

export const BG = '#15171b';

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 200);

  scene.fog = new THREE.Fog(BG, 40, 95);
  scene.add(new THREE.HemisphereLight('#b9c6d8', '#2a2420', 0.55));
  const rim = new THREE.DirectionalLight('#7fb6ff', 1.6);
  rim.position.set(-14, 9, -12);
  scene.add(rim);
  const sun = new THREE.DirectionalLight('#ffe9d2', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -12;
  sun.shadow.camera.right = sun.shadow.camera.top = 12;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  // sàn: chỉ nhận bóng, hoà vào nền; vòng đo nét đứt
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({color: '#000000', opacity: 0.55}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const rings = new THREE.Group();
  for (const [r, col, op] of [[4, '#6d737c', 0.4], [7, '#ff6a2b', 0.5], [11, '#6d737c', 0.25]]) {
    const pts = [];
    for (let i = 0; i <= 160; i++) pts.push(new THREE.Vector3(Math.cos((i / 160) * Math.PI * 2) * r, 0.003, Math.sin((i / 160) * Math.PI * 2) * r));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({color: col, dashSize: 0.22, gapSize: 0.18, transparent: true, opacity: op}));
    l.computeLineDistances();
    rings.add(l);
  }
  for (const a of [0, Math.PI / 2]) {
    const l = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-12 * Math.cos(a), 0.003, -12 * Math.sin(a)), new THREE.Vector3(12 * Math.cos(a), 0.003, 12 * Math.sin(a))]),
      new THREE.LineDashedMaterial({color: '#6d737c', dashSize: 0.1, gapSize: 0.2, transparent: true, opacity: 0.25}),
    );
    l.computeLineDistances();
    rings.add(l);
  }
  scene.add(rings);

  const mats = makeMats();
  const bee = buildDragon(mats);
  scene.add(bee.root);

  let W = 1600;
  let H = 900;
  const resize = (w, h, pr) => {
    W = w;
    H = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    bee.fireU.uPx.value = (h * pr) / 2;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const v = new THREE.Vector3();
  /** điểm thế giới (hoặc Object3D) → px CSS trên khung 1600×900 */
  const project = (o) => {
    if (o.isObject3D) o.getWorldPosition(v);
    else v.set(...o);
    v.project(camera);
    if (v.z > 1) return null;
    return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
  };
  const target = new THREE.Vector3();
  const headW = new THREE.Vector3();

  /** cam = {tx, ty, tz, az, el, d} (độ) hoặc hàm (worldOf) → cam; s = state(t) kèm bodyY */
  function frame(s, camIn) {
    bee.root.position.set(0, s.bodyY, 0);
    bee.root.rotation.set((s.roll * Math.PI) / 180, s.turn, (s.pitch * Math.PI) / 180, 'YXZ');
    bee.pose(s);
    const cam = typeof camIn === 'function' ? camIn(worldOf) : camIn;
    const az = (cam.az * Math.PI) / 180;
    const el = (cam.el * Math.PI) / 180;
    target.set(cam.tx, cam.ty, cam.tz);
    camera.position.set(target.x + cam.d * Math.cos(el) * Math.cos(az), target.y + cam.d * Math.sin(el), target.z + cam.d * Math.cos(el) * Math.sin(az));
    camera.lookAt(target);
    // dịch khung ngắm để tâm rồng nằm giữa khoảng trống giữa hai cột bảng
    camera.setViewOffset(W, H, cam.sx ?? 0, cam.sy ?? 0, W, H);
    camera.updateProjectionMatrix();
    sun.position.set(target.x - 8, target.y + 20, target.z + 12);
    sun.target.position.copy(target);
    rings.position.set(0, 0, 0);
    renderer.render(scene, camera);
  }
  const worldOf = (key) => {
    bee.anchors[key].getWorldPosition(headW);
    return headW.clone();
  };
  return {renderer, scene, camera, bee, mats, resize, frame, project, worldOf};
}
