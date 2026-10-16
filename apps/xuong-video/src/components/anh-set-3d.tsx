'use client';
// ẢNH GÓC 3D của một bộ set (anh 17/10/2026: "khi chưa có ảnh thật thì dùng góc 3D cũng được"): thẻ bối cảnh chưa có ảnh mẫu thì hiện một
// góc nhìn chéo của chính bộ set 3D — dựng trong trình duyệt bằng cùng bộ dựng của trình xem 🧊 (bo-set-three.ts › dungCanhShot), 0đ, không
// lưu tệp, sửa bộ set là ảnh đổi theo. Mỗi ảnh dùng một WebGL renderer rồi huỷ ngay (trình duyệt giới hạn số ngữ cảnh WebGL); kết quả nhớ theo
// set trong phiên để cuộn danh sách không dựng lại.
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { boSet3dSet } from '@/lib/actions';
import { dungCanhShot, huyCanh, type KhoiNv } from '@/lib/xuong-video/bo-set-three';

const nho = new Map<number, Promise<string | null>>();

async function chup(setId: number, co: number): Promise<string | null> {
  const r = await boSet3dSet(setId).catch(() => null);
  if (!r?.ok || !r.data.sets[0]) return null;
  const set = r.data.sets[0]; const kh = (t: string) => r.data.khoi[t] as KhoiNv | undefined;
  const canh = dungCanhShot(set, kh, null);
  const hop = new THREE.Box3().setFromObject(canh); if (hop.isEmpty()) { huyCanh(canh); return null; }
  const tam = hop.getCenter(new THREE.Vector3()); const coSet = Math.max(hop.max.x - hop.min.x, hop.max.z - hop.min.z);
  tam.y = hop.min.y + Math.min(60, (hop.max.y - hop.min.y) / 3);
  const may = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
  // góc chéo từ mép trước, hơi cao (như máy đặt ở cửa nhìn vào phòng) — cùng hướng góc tự do của trình xem 🧊
  may.position.copy(tam.clone().add(new THREE.Vector3(0.35, 0.5, 0.8).multiplyScalar(coSet * 0.75))); may.lookAt(tam);
  const rd = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); rd.setSize(co, co);
  rd.render(canh, may); const url = rd.domElement.toDataURL('image/jpeg', 0.85);
  rd.dispose(); rd.forceContextLoss(); huyCanh(canh);
  return url;
}

export function AnhSet3d({ setId, co = 72, onClick }: { setId: number; co?: number; onClick?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let huy = false;
    if (!nho.has(setId)) nho.set(setId, chup(setId, co * 2));
    void nho.get(setId)!.then((u) => { if (!huy) setUrl(u); });
    return () => { huy = true; };
  }, [setId, co]);
  if (!url) return <div style={{ width: co, height: co, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--fg-4)', fontSize: 10 }}>🧊…</div>;
  return <img src={url} alt="" title="Góc 3D của bộ set (chưa có ảnh thật) — bấm để xem 3D" onClick={onClick} style={{ width: co, height: co, objectFit: 'cover', display: 'block', cursor: onClick ? 'pointer' : 'default' }} />;
}
