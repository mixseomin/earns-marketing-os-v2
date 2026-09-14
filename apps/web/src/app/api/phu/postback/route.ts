// GET|POST /api/phu/postback?k=<token mạng>&event=…&sid=…&amount=…&id=… — xem lib/phu-postback.ts
import { xuLyPostback } from '@/lib/phu-postback';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { return xuLyPostback(req); }
export async function POST(req: Request) { return xuLyPostback(req); }
