import { redirect } from 'next/navigation';
// /tien-do → /tiendo (anh gõ cả hai).
export default function TienDoDashRedirect() { redirect('/plays?view=tiendo'); }
