'use client';
// Hòm góp ý 💬 của cty.on.tc (admin) — nút nổi góc phải dưới, mở drawer hai tab. "Gửi": loại · mô tả · ảnh (Ctrl+V / chọn file,
// thu nhỏ ≤1600px rồi lên R2 ngay) · trang + ngữ cảnh tự gom lúc gửi. Nháp chữ + URL ảnh giữ qua F5 (localStorage).
// "Của tôi": trạng thái từng góp ý, bấm mở đúng card trên mos2 (trả lời / duyệt nằm ở đó). Card → mos2.on.tc/p/cty/plays.
import { useEffect, useState } from 'react';
import { Drawer } from './drawer';
import { dsGopYCuaToi, guiGopY, taiAnhGopY, type GopYCuaToi } from '@/lib/gop-y';

const KHOA = 'cty.gop-y.nhap';
type Nhap = { loai: string; noiDung: string; anh: string[] };
const TRONG: Nhap = { loai: 'loi', noiDung: '', anh: [] };
const docNhap = (): Nhap => { try { const v = JSON.parse(localStorage.getItem(KHOA) ?? ''); return { loai: v.loai === 'cau_hoi' ? 'cau_hoi' : 'loi', noiDung: String(v.noiDung ?? ''), anh: Array.isArray(v.anh) ? v.anh.filter((u: unknown) => typeof u === 'string') : [] }; } catch { return TRONG; } };
const ghiNhap = (n: Nhap) => { try { localStorage.setItem(KHOA, JSON.stringify(n)); } catch { /* trình duyệt chặn lưu: nháp chỉ sống tới F5 */ } };
const TT: Record<string, string> = { pending: 'Chờ xử', claimed: 'Đang làm', submitted: 'Đang làm', review: 'Chờ duyệt', broken: 'Kẹt', completed: 'Xong', verified: 'Xong', dropped: 'Bỏ qua' };

async function thuNho(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

export function GopY() {
  const [mo, setMo] = useState(false);
  const [tab, setTab] = useState<'gui' | 'cua-toi'>('gui');
  const [n, setN] = useState<Nhap>(TRONG);
  const [dangTai, setDangTai] = useState(0);
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState('');
  const [daGui, setDaGui] = useState<number | null>(null);
  const [ds, setDs] = useState<GopYCuaToi[] | null>(null);
  useEffect(() => setN(docNhap()), []);
  const doi = (v: Partial<Nhap>) => setN((cu) => { const moi = { ...cu, ...v }; ghiNhap(moi); return moi; });
  useEffect(() => { if (mo && tab === 'cua-toi') { setDs(null); dsGopYCuaToi().then(setDs); } }, [mo, tab]);

  const themAnh = async (files: File[]) => {
    setLoi('');
    for (const f of files.filter((x) => x.type.startsWith('image/')).slice(0, 6)) {
      setDangTai((x) => x + 1);
      try { const r = await taiAnhGopY(await thuNho(f)); if (r.ok && r.url) setN((cu) => { const moi = { ...cu, anh: [...cu.anh, r.url!].slice(0, 6) }; ghiNhap(moi); return moi; }); else setLoi(`Ảnh không lên được: ${r.error}`); }
      catch (e) { setLoi(`Ảnh không lên được: ${(e as Error).message}`); }
      finally { setDangTai((x) => x - 1); }
    }
  };
  const gui = async (e: React.FormEvent) => {
    e.preventDefault(); setLoi(''); setDangGui(true);
    const nguCanh = [document.title, `${innerWidth}×${innerHeight}`, /Mobi/.test(navigator.userAgent) ? 'điện thoại' : 'máy tính'].join(' · ');
    try {
      const r = await guiGopY({ loai: n.loai, noiDung: n.noiDung, trang: location.href, anhUrls: n.anh, nguCanh });
      if (r.ok) { setDaGui(r.id ?? null); doi(TRONG); } else setLoi(r.error ?? 'Gửi hỏng.');
    } catch (e2) { setLoi(`Gửi hỏng: ${(e2 as Error).message}`); }
    finally { setDangGui(false); }
  };

  return (<>
    <button type="button" className="cty-gopy-nut" onClick={() => { setMo(true); setDaGui(null); }} aria-label="Góp ý">💬</button>
    {mo && (
      <Drawer title="Góp ý · cty" onClose={() => setMo(false)}>
        <div className="cty-gopy">
          <div className="cty-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'gui'} onClick={() => setTab('gui')}>Gửi góp ý</button>
            <button type="button" role="tab" aria-selected={tab === 'cua-toi'} onClick={() => setTab('cua-toi')}>Của tôi</button>
          </div>
          {tab === 'gui' ? (
            <form onSubmit={gui} onPaste={(e) => { const f = [...e.clipboardData.files]; if (f.length) { e.preventDefault(); themAnh(f); } }}>
              <select value={n.loai} onChange={(e) => doi({ loai: e.target.value })}><option value="loi">Lỗi / cần sửa</option><option value="cau_hoi">Câu hỏi</option></select>
              <textarea rows={6} value={n.noiDung} onChange={(e) => doi({ noiDung: e.target.value })} placeholder="Mô tả… (dán ảnh bằng Ctrl+V)" required />
              <div className="cty-gopy-anh">
                {n.anh.map((u) => <span key={u}><img src={u} alt="" /><button type="button" onClick={() => doi({ anh: n.anh.filter((x) => x !== u) })} aria-label="Bỏ ảnh">×</button></span>)}
              </div>
              <label className="cty-mono cty-muted">📎 thêm ảnh <input type="file" accept="image/*" multiple onChange={(e) => { themAnh([...(e.target.files ?? [])]); e.target.value = ''; }} /></label>
              {dangTai > 0 && <span className="cty-mono cty-muted">đang tải {dangTai} ảnh…</span>}
              <span className="cty-mono cty-muted">kèm: trang đang đứng + tiêu đề + khổ màn</span>
              {loi && <div className="cty-gopy-loi">{loi}</div>}
              {daGui && <div className="cty-gopy-ok">Đã gửi #{daGui} → <a href={`https://mos2.on.tc/plays?proj=cty&task=${daGui}`} target="_blank" rel="noreferrer">mở card</a></div>}
              <button className="cty-nut" type="submit" disabled={dangGui || dangTai > 0 || !n.noiDung.trim()}>{dangGui ? 'đang gửi…' : 'Gửi'}</button>
            </form>
          ) : ds === null ? <p className="cty-muted">đang tải…</p> : !ds.length ? <p className="cty-muted">Chưa có góp ý nào trong 7 ngày.</p> : (
            <ul>{ds.map((g) => (
              <li key={g.id}><a href={`https://mos2.on.tc/plays?proj=cty&task=${g.id}`} target="_blank" rel="noreferrer">
                <span className={`cty-pill ${g.trangThai === 'broken' || g.trangThai === 'review' ? 'cty-pill-off' : ''}`}>{TT[g.trangThai] ?? g.trangThai}</span>{' '}
                <span className="cty-mono cty-muted">#{g.id} · {g.loai === 'cau_hoi' ? 'hỏi' : 'lỗi'} · {g.capNhat.slice(5, 16).replace('T', ' ')}{g.soTin ? ` · ${g.soTin} tin` : ''}</span>
                <div>{g.noiDung.slice(0, 160)}</div>
                {g.tinCuoi && <div className="cty-muted">↳ {g.tinCuoi.slice(0, 160)}</div>}
              </a></li>
            ))}</ul>
          )}
        </div>
      </Drawer>
    )}
  </>);
}
