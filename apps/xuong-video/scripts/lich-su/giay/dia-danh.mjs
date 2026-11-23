// Toạ độ địa danh THẬT cho ghim bản đồ — không tin toạ độ mô hình viết.
// Gốc (phim Thập tự chinh 23/11/2026): kịch bản cùng một tập trộn ba hệ: độ thật (35.2,31.8), số giả (0,0 / 1,1 / 2,2), phần trăm khung (0.58,0.33),
// và cả tâm bản đồ sai hẳn (Syria ở [52,55]). Nên mọi ghim tra tên trên Wikipedia (generator=search + prop=coordinates), lưu bộ đệm chung,
// trùng tên nhiều nơi thì giữ thứ hạng tìm kiếm, bỏ ứng viên ở châu lục khác. Không tra ra thì giữ toạ độ mô hình chỉ khi nó gần ghim đã tra của cùng cảnh, không thì bỏ ghim.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = { 'User-Agent': 'studio-lich-su/1.0 (studio.on.tc)' };
const xa = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const trungVi = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

async function ungVien(ten) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrlimit=6&prop=coordinates&colimit=max&gsrsearch=${encodeURIComponent(ten)}`;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const p = (await r.json()).query?.pages ?? [];
      return p.sort((a, b) => a.index - b.index).flatMap((x) => (x.coordinates ?? []).filter((c) => c.globe === 'earth' && c.primary !== false).slice(0, 1).map((c) => ({ o: [c.lon, c.lat], tua: x.title })));
    } catch (e) { if (i === 4) { console.log(`⚠ tra "${ten}" lỗi: ${e.message}`); return null; } await new Promise((r) => setTimeout(r, 3000 * (i + 1))); }
  }
}

/** Sửa tại chỗ s.c.ban_do của mọi cảnh: ghim → toạ độ thật, tâm lệch khỏi cụm ghim → tâm cụm, mũi tên trỏ ra ngoài cụm → bỏ. */
export async function suaBanDo(canh, kho) {
  const tep = join(kho, '_dia-danh.json'), dem = existsSync(tep) ? JSON.parse(readFileSync(tep, 'utf8')) : {};
  const bd = canh.map((s) => s.c.ban_do).filter(Boolean); if (!bd.length) return;
  const ten = [...new Set(bd.flatMap((m) => (m.ghim ?? []).map((g) => g.chu.trim())))];
  for (const t of ten) if (!(t in dem)) { const u = await ungVien(t); if (u) dem[t] = u; await new Promise((r) => setTimeout(r, 700)); } /* tuần tự + nghỉ: gọi dồn bị Wikipedia trả 429 */
  writeFileSync(tep, JSON.stringify(dem, null, 1));
  const dau = ten.map((t) => dem[t]?.[0]?.o).filter(Boolean), cum = [trungVi(dau.map((o) => o[0])), trungVi(dau.map((o) => o[1]))];
  const that = new Map(ten.map((t) => [t, (dem[t] ?? []).find((v) => xa(v.o, cum) < 45)]).filter(([, v]) => v)); /* giữ thứ hạng Wikipedia (Philippopolis → Plovdiv), chỉ bỏ ứng viên ở hẳn châu lục khác; chọn "gần cụm nhất" từng kéo Philippopolis sang Shahba, Syria */
  let doi = 0, bo = 0;
  for (const s of canh) {
    const m = s.c.ban_do; if (!m) continue;
    m.ghim = (m.ghim ?? []).flatMap((g) => {
      const v = that.get(g.chu.trim());
      if (v) { if (xa(v.o, g.o) > 0.3) doi++; return [{ ...g, o: v.o.map((x) => Math.round(x * 100) / 100) }]; }
      const goc = m.ghim.filter((x) => that.has(x.chu.trim())).map((x) => that.get(x.chu.trim()).o), mo = Math.abs(g.o[0]) < 5 && Math.abs(g.o[1]) < 5;
      if (!mo && (goc.length ? Math.min(...goc.map((o) => xa(o, g.o))) < 15 : xa(g.o, m.tam) < 15)) return [g];
      bo++; console.log(`⚠ ghim "${g.chu}" không tra ra toạ độ, toạ độ kịch bản ${g.o} không gần ghim nào đã tra → bỏ`); return [];
    });
    if (m.ghim.length) {
      const t = [m.ghim.reduce((a, g) => a + g.o[0], 0) / m.ghim.length, m.ghim.reduce((a, g) => a + g.o[1], 0) / m.ghim.length];
      const r = Math.max(...m.ghim.map((g) => xa(g.o, t)));
      if (xa(m.tam, t) > Math.max(6, r)) { console.log(`⚠ tâm bản đồ ${m.tam} xa cụm ghim → ${t.map((x) => x.toFixed(1))}`); m.tam = t; }
      const gan = (o) => Math.min(...m.ghim.map((g) => xa(g.o, o)));
      const n = (m.ten ?? []).length; m.ten = (m.ten ?? []).filter((a) => gan(a.tu) < 15 && gan(a.den) < 15);
      if (m.ten.length < n) console.log(`⚠ bỏ ${n - m.ten.length} mũi tên trỏ ra ngoài vùng ghim (tâm ${m.tam})`);
    }
  }
  console.log(`bản đồ: ${that.size}/${ten.length} địa danh tra ra toạ độ thật, sửa ${doi} ghim, bỏ ${bo} ghim (vùng tập ${cum.map((x) => x.toFixed(1))})`);
}
