import { redirect } from 'next/navigation';
// Plan Cockpit (plans/plan_goals/plan_steps) đã GOM vào sổ tiến độ (tien_do_hang_muc, migration 0187) ngày 20/09/2026.
// Dữ liệu cũ nằm ở view 📈 Tiến độ của Plays; component plan-cockpit giữ lại trong repo nhưng không còn route.
export default async function PlanRedirect({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/p/${(await params).id}/plays?view=tiendo`);
}
