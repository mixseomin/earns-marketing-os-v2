import { redirect } from 'next/navigation';
// /tiendo/<project> = sổ tiến độ của một dự án (cùng URL ngắn như CLI `tiendo <dự án>`).
export default async function TienDoProjectRedirect({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  redirect(`/plays?view=tiendo&tdp=${encodeURIComponent(project)}`);
}
