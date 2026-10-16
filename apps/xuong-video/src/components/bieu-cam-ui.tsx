'use client';
// KẾ HOẠCH BIỂU CẢM của một shot QC (qc-cam-xuc.ts) — trên thẻ shot: mỗi nhân vật trong shot chọn nét ĐẦU → CUỐI (+ cú lật), cờ nối liền shot
// trước, và trạng thái SOÁT (keyframe / clip) Claude ghi bằng scripts/soat-cam-xuc.mts. Lưu ngay khi đổi (↶ hoàn tác được).
import { useState } from 'react';
import { suaBieuCam } from '@/lib/actions-cam-xuc';
import { BIEU_CAM, camThuc, soatKeyframe, soatClip, mayClip, KY_MAY, type BieuCamNv, type MaBieuCam } from '@/lib/xuong-video/qc-cam-xuc';
import type { Canh, NhanVat } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { mono, goiAction } from './ui';

const LUA = BIEU_CAM.map((b) => ({ value: b.key, label: b.ten, title: b.en }));

export function BieuCamShot({ c, nhanVat, onDoi }: { c: Canh; nhanVat: NhanVat[]; onDoi: () => Promise<void> }) {
  const [loi, setLoi] = useState('');
  const nguoi = nhanVat.filter((v) => v.loai === 'nhan_vat' && c.nhan_vat.includes(v.id));
  const ds = c.bieu_cam ?? [];
  const luu = async (moi: { bieu_cam?: BieuCamNv[]; noi_lien?: boolean }) => { setLoi((await goiAction(() => suaBieuCam(c.id, moi))).loi); await onDoi(); };
  const dat = (ten: string, p: Partial<BieuCamNv>) => {
    const cu = ds.find((b) => b.nv === ten) ?? { nv: ten, dau: 'binh_thuong' as MaBieuCam, cuoi: 'binh_thuong' as MaBieuCam };
    void luu({ bieu_cam: [...ds.filter((b) => b.nv !== ten && nguoi.some((v) => v.ten === b.nv)), { ...cu, ...p }] });
  };
  const k = soatKeyframe(c), v = soatClip(c), m = mayClip(c);
  const chip = (ten: string, s: ReturnType<typeof soatKeyframe>) => { const mat = !!s && !s.dat && s.loi.every((x) => x.startsWith('cần mắt')); return <span style={{ ...mono, color: !s ? 'var(--fg-4)' : s.dat ? '#4ade80' : mat ? '#fbbf24' : '#f87171' }} title={s ? `${s.nguoi} · ${s.luc}\n${s.loi.join('\n') || 'đạt'}${mat ? '\nMáy chưa chắc — người xem clip rồi ghi soát' : ''}` : 'chưa soát'}>{ten} {!s ? '—' : s.dat ? '✓' : mat ? '◐' : '✗'}</span>; };
  if (!nguoi.length && !c.noi_lien) return null;
  return (
    <div style={{ marginTop: 4, padding: '4px 8px', borderLeft: '2px solid var(--violet)', display: 'grid', gap: 3, fontSize: 11 }}>
      {nguoi.map((nv) => {
        const b = ds.find((x) => x.nv === nv.ten);
        return (
          <div key={nv.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} title={b ? `Cấm: ${camThuc(b).map((x) => BIEU_CAM.find((y) => y.key === x)?.ten).join(', ') || '—'}` : 'Chưa có kế hoạch biểu cảm — model sẽ tự chọn nét mặt'}>
            <span style={{ ...mono, minWidth: 60 }}>🎭 {nv.ten}</span>
            <Chon nho value={b?.dau ?? ''} onChange={(x) => dat(nv.ten, { dau: x as MaBieuCam })} options={LUA} placeholder="đầu…" minWidth={110} />
            <span style={mono}>→</span>
            <Chon nho value={b?.cuoi ?? ''} onChange={(x) => dat(nv.ten, { cuoi: x as MaBieuCam })} options={LUA} placeholder="cuối…" minWidth={110} />
            <label style={{ ...mono, display: 'flex', gap: 3, alignItems: 'center', cursor: 'pointer' }} title="Shot này là cú lật cảm xúc — được đổi nét so với cuối shot trước">
              <input type="checkbox" checked={!!b?.lat} disabled={!b} onChange={(e) => b && dat(nv.ten, { lat: e.target.checked })} />lật</label>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ ...mono, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }} title="Khung đầu = khung cuối clip shot trước (máy tự tách khi sinh video) — dùng khi hành động nối tiếp liền mạch">
          <input type="checkbox" checked={!!c.noi_lien} onChange={(e) => void luu({ noi_lien: e.target.checked })} />⛓ nối liền shot trước</label>
        {chip('soát keyframe', k)}{chip('soát clip', v)}
        <span style={{ ...mono, color: m ? KY_MAY[m.ket].mau : 'var(--fg-4)' }} title={m ? `Máy chấm clip (đo nét mặt từng khung so với kế hoạch) · ${m.luc}\n${m.loi.join('\n') || 'đạt'}${v && !v.nguoi.startsWith('máy') ? `\nNgười đã soát: ${v.dat ? 'đạt' : 'trượt'} — người thắng máy ở cổng xuất` : ''}` : 'Máy chưa chấm clip này — tự chấm khi clip sinh xong hoặc lúc xuất'}>🤖 máy {m ? `${KY_MAY[m.ket].ky} ${KY_MAY[m.ket].ten}` : '—'}</span>
      </div>
      {loi && <span style={{ fontSize: 10.5, color: 'var(--red)' }}>{loi}</span>}
    </div>
  );
}
