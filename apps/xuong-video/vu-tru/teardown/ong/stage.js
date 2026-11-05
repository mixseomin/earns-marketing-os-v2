// Sân khấu HB-7: phòng chụp sáng màu kem, một đèn chính đổ bóng mềm xuống sàn, môi trường RoomEnvironment cho nhựa bóng,
// vòng tròn nét đứt trên sàn như bàn thí nghiệm. frame(s, cam) đặt con ong từ state và vẽ một khung.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildBee, makeMats} from './ong.js';

export const BG = '#f2eee8';

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 200);

  scene.add(new THREE.HemisphereLight('#ffffff', '#d9cfc2', 0.9));
  const sun = new THREE.DirectionalLight('#fffaf2', 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
  sun.shadow.camera.right = sun.shadow.camera.top = 6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  // sàn: chỉ nhận bóng, hoà vào nền; vòng đo nét đứt
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({color: '#4a3a2c', opacity: 0.2}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const rings = new THREE.Group();
  for (const [r, col, op] of [[2.6, '#8f877d', 0.35], [4.4, '#ea5523', 0.45], [7, '#8f877d', 0.22]]) {
    const pts = [];
    for (let i = 0; i <= 160; i++) pts.push(new THREE.Vector3(Math.cos((i / 160) * Math.PI * 2) * r, 0.003, Math.sin((i / 160) * Math.PI * 2) * r));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({color: col, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: op}));
    l.computeLineDistances();
    rings.add(l);
  }
  for (const a of [0, Math.PI / 2]) {
    const l = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-7.5 * Math.cos(a), 0.003, -7.5 * Math.sin(a)), new THREE.Vector3(7.5 * Math.cos(a), 0.003, 7.5 * Math.sin(a))]),
      new THREE.LineDashedMaterial({color: '#8f877d', dashSize: 0.06, gapSize: 0.12, transparent: true, opacity: 0.25}),
    );
    l.computeLineDistances();
    rings.add(l);
  }
  scene.add(rings);

  const bee = buildBee(makeMats());
  scene.add(bee.root);

  let W = 1600;
  let H = 900;
  const resize = (w, h, pr) => {
    W = w;
    H = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
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

  /** cam = {tx, ty, tz, az, el, d} (độ); s = state(t) kèm bodyY */
  function frame(s, cam) {
    bee.root.position.set(0, s.bodyY, 0);
    bee.root.rotation.set((s.roll * Math.PI) / 180, s.turn, (s.pitch * Math.PI) / 180, 'YXZ');
    bee.pose(s);
    const az = (cam.az * Math.PI) / 180;
    const el = (cam.el * Math.PI) / 180;
    target.set(cam.tx, cam.ty, cam.tz);
    camera.position.set(target.x + cam.d * Math.cos(el) * Math.cos(az), target.y + cam.d * Math.sin(el), target.z + cam.d * Math.cos(el) * Math.sin(az));
    camera.lookAt(target);
    // dịch khung ngắm để tâm con ong nằm giữa khoảng trống giữa hai cột bảng
    camera.setViewOffset(W, H, cam.sx ?? 0, cam.sy ?? 0, W, H);
    camera.updateProjectionMatrix();
    sun.position.set(target.x - 4, target.y + 11, target.z + 6);
    sun.target.position.copy(target);
    rings.position.set(0, 0, 0);
    renderer.render(scene, camera);
  }
  const worldOf = (key) => {
    bee.anchors[key].getWorldPosition(headW);
    return headW.clone();
  };
  return {renderer, scene, camera, bee, resize, frame, project, worldOf};
}
