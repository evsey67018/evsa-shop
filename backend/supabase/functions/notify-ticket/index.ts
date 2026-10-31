// Мгновенное уведомление владельцу о новом обращении в поддержку (один раз на обращение).
import { admin, cors, json, tgSend, UUID_RE } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const id = String(body?.ticket_id || '');
  if (!UUID_RE.test(id)) return json({ error: 'bad id' }, 400);
  const owner = (Deno.env.get('OWNER_CHAT_ID') || '').trim();
  if (!/^-?\d+$/.test(owner)) { console.log('OWNER_CHAT_ID not set; ticket stored only', id); return json({ sent: false, reason: 'owner_not_set' }); }

  const db = admin();
  const { data: t } = await db.from('support_tickets').select('*').eq('id', id).maybeSingle();
  if (!t || t.kind !== 'user') return json({ error: 'not found' }, 404);
  if (t.notified_at || Date.now() - new Date(t.created_at).getTime() > 10 * 60 * 1000) return json({ skipped: 'old' });
  const { data: claimed } = await db.from('support_tickets').update({ notified_at: new Date().toISOString() })
    .eq('id', id).is('notified_at', null).select('id');
  if (!claimed?.length) return json({ skipped: 'dup' });

  const from = t.user_id ? `${t.name || ''}${t.username ? ' (@' + t.username + ')' : ''}` : `Гость: ${t.name || 'без имени'}`;
  const text = [
    '🆘 Новое обращение в поддержку EVSA SHOP',
    `Категория: ${t.category}`,
    `От: ${from}`,
    t.contact ? `Контакт: ${t.contact}` : '',
    '',
    String(t.text).slice(0, 1500),
    '',
    `ID: ${String(t.id).slice(0, 8)}`,
  ].filter((x, i) => x !== '' || i === 4 || i === 6).join('\n');
  // кнопка открывает переписку в /admin бота (callback обрабатывает только владелец)
  const key = t.user_id ? String(t.user_id) : 'g' + String(t.id);
  const r = await tgSend(owner, text, { inline_keyboard: [[{ text: 'Открыть', callback_data: 'adm:sc:' + key }]] });
  return json({ sent: true, ...r });
});
