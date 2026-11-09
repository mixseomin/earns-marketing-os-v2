// Ô của bảng lá (ui.LaBang) — hàm style THUẦN, tách khỏi cay.tsx ('use client'): hàm export từ file client thành "client
// reference", component server gọi oLa() là sập cả trang (tab Tài sản, panel Kênh kéo khách, 05/10/2026 digest 4254021405).
import type { CSSProperties } from 'react';

/** Ô của bảng lá — căn theo cột, một dòng, tràn thì "…". */
export const oLa = (phai?: boolean): CSSProperties => ({ padding: '5px 10px', textAlign: phai ? 'right' : 'left', fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top' });
