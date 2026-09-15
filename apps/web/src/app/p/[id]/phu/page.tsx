// /p/[id]/phu — PHỦ dọn về trang chủ (anh chốt 16/09/2026: gom về mos2.on.tc cho tập trung). Link cũ vẫn sống.
import { redirect } from 'next/navigation';

export default async function PhuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/?p=${encodeURIComponent(id)}`);
}
