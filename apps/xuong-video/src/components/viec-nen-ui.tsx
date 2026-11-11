'use client';
// Theo dõi VIỆC NỀN (lib/viec-nen.ts) trên trang: bấm → máy chủ trả mã việc ngay → hỏi 2 s/lần → hiện bước + giây đã chạy + giây thường mất;
// xong thì gọi onXong (tải lại dữ liệu), lỗi (kể cả studio khởi động lại giữa chừng) thì khung đỏ đủ câu. Mở lại trang lúc việc còn chạy → tự nối lại.
import { useCallback, useEffect, useRef, useState } from 'react';
import { docViecNen } from '@/lib/doc';
import type { ViecNen } from '@/lib/viec-nen';
import { mono } from './ui';

type KqMa = { ok: true; data: number } | { ok: false; loi: string };

export function useViecNen(tapId: number, viecDau: string, onXong: () => Promise<void> | void) {
  const [v, setV] = useState<ViecNen | null>(null);
  const [loiGui, setLoiGui] = useState('');
  const xongRef = useRef(onXong); xongRef.current = onXong;
  const hoi = useCallback(async (q: { id: number } | { tapId: number; viec: string }) => {
    try { const r = await docViecNen(q); setV((cu) => { if (cu?.trang_thai === 'chay' && r && r.trang_thai === 'xong') void xongRef.current(); return r; }); }
    catch (e) { setLoiGui(`Không hỏi được máy chủ (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'})`); }
  }, []);
  useEffect(() => { void hoi({ tapId, viec: viecDau }); }, [tapId, viecDau, hoi]);   // việc gần nhất của tập — đang chạy thì nối lại
  useEffect(() => {
    if (v?.trang_thai !== 'chay') return;
    const t = setTimeout(() => void hoi({ id: v.id }), 2000); return () => clearTimeout(t);
  }, [v, hoi]);
  const bat = useCallback(async (gui: () => Promise<KqMa>) => {
    setLoiGui('');
    try { const r = await gui(); if (!r.ok) { setLoiGui(r.loi); return; } await hoi({ id: r.data }); }
    catch (e) { setLoiGui(`Không gọi được máy chủ (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'}) — studio vừa cập nhật thì bấm ↻ Tải lại.`); }
  }, [hoi]);
  return { v, dangChay: v?.trang_thai === 'chay', loiGui, bat };
}

/** Dòng tiến độ / khung lỗi của một việc nền. */
export function DongViecNen({ v, loiGui }: { v: ViecNen | null; loiGui: string }) {
  if (loiGui) return <div style={hop}>⚠ {loiGui}</div>;
  if (!v) return null;
  if (v.trang_thai === 'chay') {
    const qua = v.uoc_giay != null && v.giay > v.uoc_giay * 1.8;
    return <div style={{ ...mono, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--cyan)', marginTop: 6 }}>
      <span className="xv-quay">⏳</span><span>{v.buoc || 'đang chạy'} · <b>{v.giay}s</b>{v.uoc_giay != null ? ` / thường ~${v.uoc_giay}s` : ''}{qua ? ' — lâu hơn thường, máy vẫn đang chờ trả lời' : ''}</span>
    </div>;
  }
  if (v.trang_thai === 'loi') return <div style={hop}>⚠ {v.nhan} lỗi sau {v.giay}s: {v.loi}</div>;
  return null;
}
const hop = { border: '1px solid var(--red, #f85149)', borderRadius: 6, padding: '6px 9px', marginTop: 6, fontSize: 12.5, color: 'var(--red, #f85149)' } as const;
