'use client';
// ẢNH 3D THAY ẢNH THẬT (QUY TRÌNH CHUẨN — anh 17/10/2026: "khi chưa có ảnh thật thì dùng góc 3D… hiện cả đi, khi nào có thì tự lấp đầy vào, đừng
// để nhắc lại"): MỌI thẻ anchor chưa có ảnh mẫu thì hiện ảnh 3D của chính nó — bối cảnh có bộ set → góc chéo bộ set; nhân vật / đạo cụ / sản phẩm
// có khoi_3d → khối đó (người = ma-nơ-canh). Có ảnh thật thì thẻ dùng ảnh thật (bên gọi quyết). Dựng trong trình duyệt bằng cùng bộ dựng của
// trình xem 🧊 (bo-set-three.ts), 0đ, không lưu tệp, sửa dữ liệu là ảnh đổi theo. Mỗi ảnh một WebGL renderer rồi huỷ ngay (trình duyệt giới
// hạn số ngữ cảnh); kết quả nhớ trong phiên theo khoá dữ liệu.
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { boSet3dSet } from '@/lib/actions';
import { catLop, dungCanhShot, huyCanh, nhanVat as khoiNhanVat, type KhoiNv } from '@/lib/xuong-video/bo-set-three';
import type { NhanVat } from '@/lib/xuong-video/kieu';

const nho = new Map<string, Promise<string | null>>();

function chupCanh(canh: THREE.Scene, co: number, huong: THREE.Vector3, xa: number): string | null {
  const hop = new THREE.Box3().setFromObject(canh); if (hop.isEmpty()) return null;
  const tam = hop.getCenter(new THREE.Vector3()); const cao = hop.max.y - hop.min.y;
  const coVat = Math.max(hop.max.x - hop.min.x, cao, hop.max.z - hop.min.z);
  const may = new THREE.PerspectiveCamera(40, 1, 0.01, 100000);
  may.position.copy(tam.clone().add(huong.clone().normalize().multiplyScalar(coVat * xa))); may.lookAt(tam);
  const rd = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); rd.setSize(co, co);
  catLop(canh, may); rd.render(canh, may); const url = rd.domElement.toDataURL('image/jpeg', 0.85);
  rd.dispose(); rd.forceContextLoss(); return url;
}

async function chupSet(setId: number, co: number): Promise<string | null> {
  const r = await boSet3dSet(setId).catch(() => null);
  if (!r?.ok || !r.data.sets[0]) return null;
  const canh = dungCanhShot(r.data.sets[0], (t) => r.data.khoi[t] as KhoiNv | undefined, null);
  const hop = new THREE.Box3().setFromObject(canh); const c = hop.getCenter(new THREE.Vector3());
  // góc chéo từ mép trước, hơi cao (máy đặt ở cửa nhìn vào phòng), nhắm thấp xuống sàn — cùng góc tự do của trình xem 🧊
  canh.position.y -= Math.min(60, (hop.max.y - hop.min.y) / 3) - (c.y - hop.min.y);
  const url = chupCanh(canh, co, new THREE.Vector3(0.35, 0.5, 0.8), 0.7); huyCanh(canh); return url;
}

function chupKhoi(k: KhoiNv, co: number): string | null {
  const canh = new THREE.Scene(); canh.background = new THREE.Color('#3a3b44');
  canh.add(new THREE.HemisphereLight('#ffffff', '#5a4a3a', 1.6));
  const den = new THREE.DirectionalLight('#ffffff', 1.4); den.position.set(60, 120, 80); canh.add(den);
  canh.add(khoiNhanVat(k, { tam: [0, 0, 0] }));
  // mặt trước của khối nhìn −y dữ liệu = +z three → máy đặt chéo 3/4 phía trước, ngang tầm hơi cao
  const url = chupCanh(canh, co, new THREE.Vector3(0.55, 0.3, 1), 1.35); huyCanh(canh); return url;
}

export function Anh3d({ v, co = 72, onClick }: { v: Pick<NhanVat, 'loai' | 'bo_set_id' | 'khoi_3d'>; co?: number; onClick?: () => void }) {
  const khoa = v.loai === 'boi_canh' && v.bo_set_id ? `set:${v.bo_set_id}` : v.khoi_3d ? `khoi:${JSON.stringify(v.khoi_3d)}` : '';
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!khoa) return; let huy = false;
    if (!nho.has(khoa)) nho.set(khoa, khoa.startsWith('set:') ? chupSet(v.bo_set_id!, co * 2) : Promise.resolve(chupKhoi(v.khoi_3d as KhoiNv, co * 2)));
    void nho.get(khoa)!.then((u) => { if (!huy) setUrl(u); });
    return () => { huy = true; };
  }, [khoa, co, v.bo_set_id, v.khoi_3d]);
  const o = { width: co, height: co, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--fg-4)', fontSize: 9.5, textAlign: 'center' as const, lineHeight: 1.2, padding: 4, boxSizing: 'border-box' as const };
  if (!khoa) return <div style={o} title="Chưa có ảnh thật và chưa khai khối 3D (khoi_3d) — khai khối là thẻ có ảnh 3D ngay, sinh ảnh mẫu là ảnh thật thay vào">chưa khai khối 3D</div>;
  if (!url) return <div style={o}>🧊…</div>;
  return <img src={url} alt="" title={`Ảnh 3D (chưa có ảnh thật — sinh ảnh mẫu là tự thay)${onClick ? ' — bấm để xem 3D' : ''}`} onClick={onClick} style={{ width: co, height: co, objectFit: 'cover', display: 'block', cursor: onClick ? 'pointer' : 'default' }} />;
}
