import { redirect } from 'next/navigation';
// /y-tuong (sáng 20/09) đã gom vào view 📈 Tiến độ của Plays.
export default function YTuongRedirect() { redirect('/plays?view=tiendo'); }
