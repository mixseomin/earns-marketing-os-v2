// GET|POST /api/phu/postback/<token mạng>?… — token trên đường dẫn cho mạng bỏ query string (AWEmpire).
import { xuLyPostback } from '@/lib/phu-postback';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, ctx: { params: Promise<{ k: string }> }) { return xuLyPostback(req, (await ctx.params).k); }
export async function POST(req: Request, ctx: { params: Promise<{ k: string }> }) { return xuLyPostback(req, (await ctx.params).k); }
