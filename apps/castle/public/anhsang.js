// ÁNH SÁNG + TRỜI (anh 21/11/2026 "làm theo đề xuất 2-3-1", bước 3; "vẫn phải đảm bảo tốc độ, loading và tối ưu ko bị nóng trên mobile"):
//   vòm trời  cầu đỉnh-màu bám camera, một lệnh vẽ: chân trời = đúng màu sương (núi xa tan vào trời, không lộ vạch), lên đỉnh xanh đậm dần, quầng ấm phía mặt trời
//   môi trường  PMREM dựng MỘT lần từ chính vòm trời → mặt đá / ngói (MeshStandardMaterial) nhận ánh trời theo hướng, mái hướng bắc lạnh, hướng nam ấm; điện thoại bỏ (mỗi điểm ảnh thêm lượt đọc ảnh)
//   bóng nắng  hộp bóng ±200 m trước đây ghim ở tâm lâu đài → đi bộ ra rừng / làng là mất bóng; nay dời theo người đi bộ / điểm nhìn, chỉ dời khi lệch > 40 m (không nhấp nháy mỗi khung)
export function datAnhSang({ THREE, renderer, scene, nang, nhe, mauChanTroi = 0xa9c4dc }) {
  const chan = new THREE.Color(mauChanTroi), dinh = new THREE.Color(0x4f86c6), am = new THREE.Color(0xfff0d0);
  const huongNang = nang.position.clone().normalize();
  const g = nhe ? new THREE.SphereGeometry(1, 24, 12) : new THREE.SphereGeometry(1, 48, 24), p = g.attributes.position, mau = new Float32Array(p.count * 3), c = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const h = Math.max(0, v.y);
    c.copy(chan).lerp(dinh, Math.pow(h, 0.55)); // chân trời → đỉnh
    const s = Math.max(0, v.dot(huongNang)); c.lerp(am, 0.35 * Math.pow(s, 6) * (1 - h * 0.5)); // quầng mặt trời
    if (v.y < 0) c.copy(chan); // dưới chân trời: màu sương (không bao giờ thấy, trừ khe hở mép cảnh xa)
    mau.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(mau, 3));
  const vom = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  vom.renderOrder = -1; vom.frustumCulled = false; vom.userData.troi = true; scene.add(vom);
  if (!nhe) { // ánh trời theo hướng (một lần, ~10 ms GPU lúc mở trang)
    const pm = new THREE.PMREMGenerator(renderer), s2 = new THREE.Scene(), v2 = vom.clone(); v2.scale.setScalar(100); s2.add(v2);
    scene.environment = pm.fromScene(s2, 0.04).texture; scene.environmentIntensity = 0.45; pm.dispose();
  }
  const tam = new THREE.Vector3(1e9, 0, 0), lech = nang.position.clone(); scene.add(nang.target);
  return {
    vom,
    // gọi mỗi khung trước khi vẽ: p = chỗ người đứng (đi bộ) hoặc điểm nhìn (toàn cảnh)
    capNhat(camera, p) {
      const r = Math.min(camera.far * 0.9, 15000); vom.scale.setScalar(r); vom.position.copy(camera.position);
      if (p && Math.hypot(p.x - tam.x, p.z - tam.z) > 40) {
        tam.set(Math.round(p.x / 4) * 4, p.y ?? 0, Math.round(p.z / 4) * 4);
        nang.target.position.copy(tam); nang.position.copy(tam).add(lech); nang.target.updateMatrixWorld();
      }
    },
  };
}
