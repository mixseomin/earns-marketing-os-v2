'use client';
// Bài đăng kèm video (tab Xuất): văn bản chính · tiêu đề · mô tả · nút — Claude viết theo QC mẫu (nếu có), sửa tay, chép sang Meta/TikTok.
import { useEffect, useState } from 'react';
import { vietBaiDangTap, suaBaiDang } from '@/lib/actions';
import { gioVN, type BaiDang, type Tap } from '@/lib/xuong-video/kieu';
import { O, Nut, Loi, mono } from './ui';

export function BaiDangKem({ tap, coAnthropic, thieuSp, onChanged }: { tap: Tap; coAnthropic: boolean; thieuSp: string | false; onChanged: () => Promise<void> }) {
  const goc = tap.bai_dang;
  const [f, setF] = useState<Omit<BaiDang, 'luc'>>({ chu_bai: goc?.chu_bai ?? '', tieu_de: goc?.tieu_de ?? '', mo_ta: goc?.mo_ta ?? '', cta: goc?.cta ?? '' });
  useEffect(() => { if (goc) setF({ chu_bai: goc.chu_bai, tieu_de: goc.tieu_de, mo_ta: goc.mo_ta, cta: goc.cta }); }, [goc]);
  const [dang, setDang] = useState('');
  const [loi, setLoi] = useState('');
  const [chep, setChep] = useState('');
  const doi = goc && (f.chu_bai !== goc.chu_bai || f.tieu_de !== goc.tieu_de || f.mo_ta !== goc.mo_ta || f.cta !== goc.cta);
  const viet = async () => { setDang('viet'); setLoi(''); const r = await vietBaiDangTap(tap.id); setDang(''); if (!r.ok) { setLoi(r.loi); return; } await onChanged(); };
  const luu = async () => { setDang('luu'); setLoi(''); const r = await suaBaiDang(tap.id, f); setDang(''); if (!r.ok) { setLoi(r.loi); return; } await onChanged(); };
  const chepVao = async (k: string, v: string) => { try { await navigator.clipboard.writeText(v); setChep(k); setTimeout(() => setChep(''), 1500); } catch { setLoi('trình duyệt không cho chép — bôi đen rồi Ctrl+C'); } };
  const nutChep = (k: string, v: string) => <button type="button" className="xv-btn" disabled={!v.trim()} onClick={() => void chepVao(k, v)} style={{ padding: '0 6px', fontSize: 10.5, lineHeight: '16px', marginLeft: 6 }}>{chep === k ? '✓ đã chép' : '📋 Chép'}</button>;
  return (
    <div className="xv-panel" style={{ marginTop: 10 }}>
      <h3>Bài đăng kèm video<small>văn bản chính · tiêu đề · mô tả · nút — dán sang Meta/TikTok cùng bản MP4{goc ? ` · ${gioVN(goc.luc)}` : ''}</small></h3>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <Nut chinh={!goc} ly={(!coAnthropic && 'thiếu ANTHROPIC_API_KEY') || thieuSp} ban={!!dang} title="Claude viết theo bài đăng của QC mẫu (giữ cấu trúc, đổi sản phẩm); không có mẫu thì theo khuôn móc → 3 lợi ích → trấn an → ưu đãi" onClick={() => void viet()}>{dang === 'viet' ? '… Claude đang viết' : goc ? '↻ Viết lại theo mẫu' : '✍ Viết bài đăng theo mẫu'}</Nut>
        {doi && <Nut chinh ban={!!dang} onClick={() => void luu()}>{dang === 'luu' ? '…' : '💾 Lưu sửa tay'}</Nut>}
      </div>
      <Loi>{loi}</Loi>
      {(goc || f.chu_bai) && (
        <div className="xv-grid">
          <O span label={<>Văn bản chính{nutChep('chu_bai', f.chu_bai)}</>}><textarea className="xv-ta" rows={7} value={f.chu_bai} onChange={(e) => setF({ ...f, chu_bai: e.target.value })} /></O>
          <O label={<>Tiêu đề{nutChep('tieu_de', f.tieu_de)}</>}><input className="xv-in" value={f.tieu_de} onChange={(e) => setF({ ...f, tieu_de: e.target.value })} /></O>
          <O label={<>Mô tả{nutChep('mo_ta', f.mo_ta)}</>}><input className="xv-in" value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })} /></O>
          <O label="Nút"><input className="xv-in" value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} /></O>
          <div style={mono}>Chữ trên màn trong video và bài đăng không nên lặp y chang — Claude đã đọc chữ màn khi viết.</div>
        </div>
      )}
    </div>
  );
}
