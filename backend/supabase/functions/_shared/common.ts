import { createClient } from 'npm:@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
export const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
export const SITE_URL = Deno.env.get('SITE_URL') || 'https://evsey67018.github.io/evsa-shop/';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function anon() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Отправка в Telegram. Тестовые пользователи (отрицательный telegram_id) — только лог. */
export async function tgSend(chatId: number | string, text: string, replyMarkup?: unknown) {
  if (Number(chatId) < 0) {
    console.log('TEST: would send to', chatId, JSON.stringify({ text, replyMarkup }));
    return { test: true };
  }
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) { console.log('no bot token'); return { ok: false }; }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup, disable_web_page_preview: true }),
  });
  const ok = r.ok;
  if (!ok) console.log('telegram sendMessage failed, status', r.status);
  await r.body?.cancel();
  return { ok };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
