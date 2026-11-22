// Sprawl · mưa và mặt đường bóng: lúc KHÔ mặt đất + mặt đường vẫn hắt bóng mờ của cảnh ở góc nhìn xiên (nhựa, đá lát đều bóng lên khi nhìn sát mặt), lúc mưa thì ướt soi bóng cảnh thật (vẽ cảnh lật qua mặt phẳng đất, khuôn three addons Reflector), vũng nước có gợn, hạt mưa rơi quanh máy quay.
// tra-repo-ok: dán keo nội bộ quanh vật liệu sẵn có của Sprawl; phần soi bóng theo đúng cách tính của three/addons/objects/Reflector.js (không dùng thẳng được vì đất là lưới cao độ dùng vật liệu riêng).
import * as THREE from 'three';

export function taoMua({ renderer, scene, camera }) {
  const U = { uMua: { value: 0 }, uGioM: { value: 0 }, tPhan: { value: null }, uMatPhan: { value: new THREE.Matrix4() }, uY0: { value: 0 }, uDamPhan: { value: 1 }, uKho: { value: 0 } };
  const dich = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  U.tPhan.value = dich.texture;

  // ---------- vật liệu ướt: nối thêm vào vật liệu có sẵn (đất, đường), giữ nguyên phần tô màu của chúng ----------
  function uot(mat, hat) { // hat = thêm vân nhựa cả khi khô (đất chung vốn một màu phẳng)
    const cuKhoa = mat.customProgramCacheKey?.bind(mat), cuBien = mat.onBeforeCompile;
    mat.customProgramCacheKey = () => (cuKhoa ? cuKhoa() : '') + '-uot' + (hat ? 'h' : '');
    mat.onBeforeCompile = (sh, r) => { cuBien?.(sh, r); Object.assign(sh.uniforms, U);
      if (!sh.fragmentShader.includes('#include <opaque_fragment>') || !sh.vertexShader.includes('#include <worldpos_vertex>')) { console.warn('[sprawl] vật liệu không gắn được lớp ướt (three đổi khung shader)'); return; }
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWm;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWm = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWm; uniform float uMua, uGioM, uY0, uDamPhan, uKho; uniform sampler2D tPhan; uniform mat4 uMatPhan;
      float bamM(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float nhM(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(bamM(i), bamM(i + vec2(1.0, 0.0)), f.x), mix(bamM(i + vec2(0.0, 1.0)), bamM(i + 1.0), f.x), f.y); }
      vec2 gonM(vec2 p, float t) { vec2 o = floor(p), f = fract(p) - 0.5; float pha = fract(t + bamM(o));
        vec2 d = f - (vec2(bamM(o + 3.1), bamM(o + 7.7)) - 0.5) * 0.5; float r = length(d), R = pha * 0.42;
        return d / max(r, 1e-3) * sin((r - R) * 46.0) * smoothstep(0.07, 0.0, abs(r - R)) * (1.0 - pha); }`)
        .replace('#include <opaque_fragment>', `
      float kcM = length(cameraPosition - vWm);
      ${hat ? 'outgoingLight *= 0.8 + 0.34 * (nhM(vWm.xz * 0.9) * 0.4 + nhM(vWm.xz * 0.12) * 0.6) * smoothstep(900.0, 200.0, kcM) + 0.17 * smoothstep(200.0, 900.0, kcM);' : ''}
      if (uMua > 0.001) {
        float vung = smoothstep(0.45, 0.6, nhM(vWm.xz * 0.045) * 0.6 + nhM(vWm.xz * 0.19 + 9.0) * 0.4);
        float doUot = mix(0.5, 1.0, vung) * uMua;
        vec2 gon = (gonM(vWm.xz * 1.7, uGioM * 1.4) + gonM(vWm.xz * 1.1 + 5.3, uGioM * 1.1 + 0.37)) * smoothstep(70.0, 12.0, kcM);
        float hatM = nhM(vWm.xz * 2.3) - 0.5;
        vec4 q = uMatPhan * vec4(vWm.x, uY0, vWm.z, 1.0);
        vec2 uvp = q.xy / max(q.w, 1e-4) + gon * 0.012 + vec2(hatM * 0.004, hatM * 0.03) * (1.0 - vung); // nhựa ướt kéo vệt bóng theo chiều dọc, vũng nước soi phẳng
        vec3 phan = texture2D(tPhan, clamp(uvp, 0.002, 0.998), mix(2.5, 0.0, vung)).rgb;
        float cv = clamp(normalize(cameraPosition - vWm).y, 0.0, 1.0);
        float fr = 0.07 + 0.93 * pow(1.0 - cv, 4.0);
        outgoingLight = outgoingLight * mix(1.0, 0.5, doUot) + phan * fr * doUot * uDamPhan;
      } else if (uKho > 0.001) { // khô: không tối màu, không vũng; chỉ một lớp bóng nhoè, mạnh dần khi nhìn sát mặt đường, đứt quãng theo vân mặt
        vec4 q = uMatPhan * vec4(vWm.x, uY0, vWm.z, 1.0);
        float hatM = nhM(vWm.xz * 2.3) - 0.5, cv = clamp(normalize(cameraPosition - vWm).y, 0.0, 1.0);
        vec3 phan = texture2D(tPhan, clamp(q.xy / max(q.w, 1e-4) + vec2(hatM * 0.006, hatM * 0.05), 0.002, 0.998), 3.5).rgb;
        outgoingLight += phan * (0.03 + 0.97 * pow(1.0 - cv, 5.0)) * (0.75 + 0.5 * nhM(vWm.xz * 0.35)) * uKho * uDamPhan;
      }
      #include <opaque_fragment>`); };
    mat.needsUpdate = true;
  }

  // ---------- hạt mưa: vệt rơi trong một hộp 70 × 60 × 70 m bám theo máy quay ----------
  const N = 7000, g = new THREE.BufferGeometry(), aG = new Float32Array(N * 6), aD = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { const x = Math.random(), y = Math.random(), z = Math.random(); aG.set([x, y, z, x, y, z], i * 6); aD[i * 2 + 1] = 1; }
  g.setAttribute('position', new THREE.BufferAttribute(aG, 3)); g.setAttribute('aD', new THREE.BufferAttribute(aD, 1));
  const hat = new THREE.LineSegments(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uGio: U.uGioM, uMua: U.uMua, uCam: { value: new THREE.Vector3() } },
    vertexShader: `attribute float aD; uniform float uGio; uniform vec3 uCam; varying float vA;
      void main() { vec3 B = vec3(70.0, 60.0, 70.0), p = position * B; p.y -= uGio * (24.0 + position.x * 9.0); p.x += uGio * 2.5;
        p = mod(p - uCam, B) - B * 0.5;
        vec4 mv = viewMatrix * vec4(uCam + p + vec3(0.1, 1.0, 0.0) * aD * (0.9 + position.z * 1.3), 1.0);
        vA = (1.0 - smoothstep(18.0, 34.0, length(p))) * smoothstep(0.8, 3.5, -mv.z) * (0.35 + 0.65 * aD); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uMua; varying float vA;
      void main() { gl_FragColor = vec4(vec3(0.78, 0.85, 0.95), vA * 0.5 * uMua);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` }));
  hat.frustumCulled = false; hat.visible = false; hat.renderOrder = 5; scene.add(hat);

  // ---------- lượt vẽ soi bóng: máy quay lật qua mặt phẳng y = y0 (cách tính của three addons Reflector) ----------
  const may = new THREE.PerspectiveCamera(), _n = new THREE.Vector3(0, 1, 0), _P = new THREE.Vector3(), _v = new THREE.Vector3(), _t = new THREE.Vector3(), _cam = new THREE.Vector3(), _rot = new THREE.Matrix4();
  const _mp = new THREE.Plane(), _cp = new THREE.Vector4(), _q = new THREE.Vector4(), _co = new THREE.Vector2();
  function vePhan(y0, an, troi, chia = 1) { // chia: thu nhỏ thêm ảnh soi (bóng khô đằng nào cũng làm nhoè)
    _cam.setFromMatrixPosition(camera.matrixWorld); if (_cam.y <= y0 + 0.3) return;
    renderer.getDrawingBufferSize(_co); const w = Math.max(2, (_co.x >> 1) / chia | 0), h = Math.max(2, (_co.y >> 1) / chia | 0); if (dich.width !== w || dich.height !== h) dich.setSize(w, h);
    _P.set(0, y0, 0); _v.subVectors(_P, _cam).reflect(_n).negate().add(_P);
    _rot.extractRotation(camera.matrixWorld); _t.set(0, 0, -1).applyMatrix4(_rot).add(_cam); _t.subVectors(_P, _t).reflect(_n).negate().add(_P);
    may.position.copy(_v); may.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_n); may.lookAt(_t); may.near = camera.near; may.far = camera.far; may.updateMatrixWorld(); may.projectionMatrix.copy(camera.projectionMatrix);
    U.uMatPhan.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(may.projectionMatrix).multiply(may.matrixWorldInverse); U.uY0.value = y0;
    // mặt cắt gần xiên trùng mặt đất: thứ nằm dưới đất không lọt vào bóng
    _mp.setFromNormalAndCoplanarPoint(_n, _P).applyMatrix4(may.matrixWorldInverse); _cp.set(_mp.normal.x, _mp.normal.y, _mp.normal.z, _mp.constant);
    const pm = may.projectionMatrix.elements; _q.set((Math.sign(_cp.x) + pm[8]) / pm[0], (Math.sign(_cp.y) + pm[9]) / pm[5], -1, (1 + pm[10]) / pm[14]);
    _cp.multiplyScalar(2 / _cp.dot(_q)); pm[2] = _cp.x; pm[6] = _cp.y; pm[10] = _cp.z + 1 - 0.003; pm[14] = _cp.w;
    const hien = an.map((o) => o.visible), cu = renderer.getRenderTarget(), vtTroi = troi?.position.clone();
    an.forEach((o) => { o.visible = false; }); hat.visible = false; troi?.position.copy(may.position);
    renderer.setRenderTarget(dich); renderer.clear(); renderer.render(scene, may); renderer.setRenderTarget(cu);
    an.forEach((o, i) => { o.visible = hien[i]; }); hat.visible = bat; if (vtTroi) troi.position.copy(vtTroi);
  }

  let bat = false;
  // Bóng lúc khô: lượt soi vẽ lại CẢ thành phố, nên chỉ vẽ khi máy quay ở tầm phố (dưới 60 m, tắt dần từ 25 m), ảnh nhỏ bằng 1/4 và
  // 6 khung mới vẽ lại một lần (bóng nhoè nên không thấy trễ; uMatPhan đi cùng ảnh nên bóng vẫn nằm đúng chỗ). Vẽ mỗi khung = card đồ hoạ làm gấp đôi, quạt rú.
  const KHO = 0.55, CAO_KHO = [25, 60], NHIP_KHO = 6; let demKho = 0;
  return { uot, get bat() { return bat; },
    dat(b, dam = 1) { bat = !!b; U.uMua.value = bat ? 1 : 0; U.uDamPhan.value = dam; hat.visible = bat; },
    khung(dt, y0, an, troi) {
      if (bat) { U.uGioM.value = (U.uGioM.value + dt) % 3600; hat.material.uniforms.uCam.value.copy(camera.position); vePhan(y0, an, troi); return; }
      const cao = camera.position.y - y0; U.uKho.value = KHO * (1 - THREE.MathUtils.smoothstep(cao, CAO_KHO[0], CAO_KHO[1]));
      if (U.uKho.value > 0.001) { if (demKho++ % NHIP_KHO === 0) vePhan(y0, an, troi, 2); } else demKho = 0; } };
}
