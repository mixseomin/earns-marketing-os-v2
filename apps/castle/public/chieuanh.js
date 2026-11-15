// CHIẾU ẢNH CHỤP LÊN MÔ HÌNH (projective texture mapping) — dùng chung mọi lâu đài: ảnh so đã KHỚP CAMERA (scripts/khop-camera.mjs)
// chiếu ngược lên các lưới được chọn (mái, tháp…), chỉ tô chỗ ảnh thật sự nhìn thấy:
//   1. dựng camera chụp (vị trí, hướng, ống kính, tỉ lệ ảnh) → vẽ độ sâu của các lưới che (toàn mô hình) từ đó một lần (DepthTexture);
//   2. mỗi lưới nhận ảnh có một BẢN PHỦ dùng ShaderMaterial: điểm chiếu vào khung ảnh, không bị che (so độ sâu), mặt quay về phía camera → lấy màu ảnh, còn lại bỏ.
// taoChieuAnh({ THREE, renderer, anh: { url, w, h }, cam: { pos: Vector3, quat: Quaternion, fov }, che: [Object3D], nhan: [Mesh] }) → Promise<[Mesh phủ]>
// tra-repo-ok: kỹ thuật chiếu ảnh chuẩn (three.js không có sẵn bản có che khuất cho lưới tuỳ ý); mã nhỏ, riêng cảnh.
export async function taoChieuAnh({ THREE, renderer, anh, cam, che, nhan, kichThuocSau = 2048, thu = 0, chuThe = 60 }) { // chuThe: chỉ chiếu tới mặt cách mặt gần nhất ≤ chuThe m // thu: thứ tự lớp (ảnh sau đè ảnh trước)
  const tx = await new THREE.TextureLoader().loadAsync(anh.url); tx.colorSpace = THREE.SRGBColorSpace;
  const pc = new THREE.PerspectiveCamera(cam.fov, anh.w / anh.h, 1, 3000); pc.position.copy(cam.pos); pc.quaternion.copy(cam.quat); pc.updateMatrixWorld(true); pc.updateProjectionMatrix();
  // độ sâu từ camera chụp (chỉ các lưới che)
  const sau = new THREE.WebGLRenderTarget(kichThuocSau, Math.round(kichThuocSau * anh.h / anh.w)); sau.depthTexture = new THREE.DepthTexture(sau.width, sau.height); sau.depthTexture.type = THREE.UnsignedIntType;
  const canh = new THREE.Scene(), cu = []; for (const o of che) { cu.push([o, o.parent]); canh.add(o); }
  const truoc = renderer.getRenderTarget(); renderer.setRenderTarget(sau); renderer.clear(); renderer.render(canh, pc); renderer.setRenderTarget(truoc);
  for (const [o, p] of cu) p ? p.add(o) : canh.remove(o);
  const vp = new THREE.Matrix4().multiplyMatrices(pc.projectionMatrix, pc.matrixWorldInverse);
  // CHỦ THỂ của ảnh: khoảng cách tới mặt gần nhất ảnh thấy (đỉnh lưới che trong khung ảnh) → chỉ chiếu trong ±sau m quanh đó;
  // xa hơn là cảnh nền trong ảnh (thung lũng, nhà khác) — tia chiếu xuyên qua chủ thể rơi xuống toà phía sau sẽ tô sai (anh 16/11/2026: cổng Torbau mang ảnh cây + đường)
  let gan = 1e9; const v4 = new THREE.Vector4();
  for (const o of che) { o.updateMatrixWorld(true); const p = o.geometry?.attributes?.position; if (!p) continue; for (let i = 0; i < p.count; i += 7) {
    v4.set(p.getX(i), p.getY(i), p.getZ(i), 1).applyMatrix4(o.matrixWorld); const w = v4.clone().applyMatrix4(vp); if (w.w <= 0 || Math.abs(w.x / w.w) > 1 || Math.abs(w.y / w.w) > 1) continue;
    gan = Math.min(gan, Math.hypot(v4.x - pc.position.x, v4.y - pc.position.y, v4.z - pc.position.z)); } }
  const vl = new THREE.ShaderMaterial({
    uniforms: { kiem: { value: 0 }, xaToiDa: { value: gan + chuThe }, anh: { value: tx }, sau: { value: sau.depthTexture }, vp: { value: vp }, viTri: { value: pc.position }, gan: { value: pc.near }, xa: { value: pc.far } },
    vertexShader: `varying vec4 vChieu; varying vec3 vPhap; varying vec3 vTg; uniform mat4 vp;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vTg = w.xyz; vChieu = vp * w; vPhap = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `#include <packing>
      varying vec4 vChieu; varying vec3 vPhap; varying vec3 vTg; uniform int kiem; uniform float xaToiDa; uniform sampler2D anh; uniform sampler2D sau; uniform vec3 viTri; uniform float gan; uniform float xa;
      void main() {
        vec3 n = vChieu.xyz / vChieu.w; vec2 uv = n.xy * 0.5 + 0.5; if (vChieu.w <= 0.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard; if (kiem == 1) { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
        if (distance(viTri, vTg) > xaToiDa) discard; vec3 toi = normalize(viTri - vTg); float hg = dot(normalize(gl_FrontFacing ? vPhap : -vPhap), toi); if (hg < 0.4) discard; // chỉ mặt QUAY VỀ chỗ chụp, lệch ≤ ~66°: mặt xiên / quay lưng thì ảnh bị kéo thành sọc (anh 16/11/2026), bỏ
        if (kiem == 2) { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); return; }
        float d = texture2D(sau, uv).x, zSau = perspectiveDepthToViewZ(d, gan, xa), zMinh = perspectiveDepthToViewZ(n.z * 0.5 + 0.5, gan, xa);
        if (zMinh < zSau - 0.6) discard; // bị vật khác che (sâu hơn 0,6 m so với mặt gần nhất camera chụp thấy)
        vec4 c = texture2D(anh, uv);
        // điểm ảnh là TRỜI (xanh dương / mây sáng nhạt) hoặc CÂY (xanh lá trội): trong ảnh thật chỗ đó không phải tường / mái (bị rừng che, hoặc khối mô hình lấn ra ngoài viền thật) → không chiếu
        if (c.b > c.r + 0.08 && c.b > 0.35) discard;
        if (c.g > c.r + 0.04 && c.g > c.b + 0.02) discard;
        gl_FragColor = c;
        #include <colorspace_fragment>
      }`,
    polygonOffset: true, polygonOffsetFactor: -2 - thu, polygonOffsetUnits: -2 - thu, side: THREE.DoubleSide,
  });
  taoChieuAnh.vl = vl; // gỡ lỗi: vl.uniforms.kiem = 1 (đỏ = trong khung), 2 (xanh = qua lọc hướng)
  return nhan.map((m) => { const p = new THREE.Mesh(m.geometry, vl); p.matrixAutoUpdate = false; m.updateMatrixWorld(true); p.matrix.copy(m.matrixWorld); p.matrixWorld.copy(m.matrixWorld); p.renderOrder = 2 + thu; return p; });
}
