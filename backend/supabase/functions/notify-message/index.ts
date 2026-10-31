// Уведомление о новом сообщении в чате. Вызывает отправитель сразу после вставки сообщения.
import { admin, anon, cors, json, tgSend, SITE_URL, UUID_RE } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = await anon().auth.getUser(jwt);
  if (!u?.user) return json({ error: 'auth' }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const id = String(body?.message_id || '');
  if (!UUID_RE.test(id)) return json({ error: 'bad id' }, 400);

  const db = admin();
  const { data: m } = await db.from('messages').select('id, chat_id, sender_id, text, created_at, notified_at').eq('id', id).maybeSingle();
  if (!m || m.sender_id !== u.user.id) return json({ error: 'not found' }, 404);
  if (m.notified_at || Date.now() - new Date(m.created_at).getTime() > 2 * 60 * 1000) return json({ skipped: 'old' });
  const now = new Date().toISOString();
  const { data: claimed } = await db.from('messages').update({ notified_at: now }).eq('id', id).is('notified_at', null).select('id');
  if (!claimed?.length) return json({ skipped: 'dup' });

  // анти-спам: не чаще одного уведомления в 20 секунд на чат
  const { count } = await db.from('messages').select('id', { count: 'exact', head: true })
    .eq('chat_id', m.chat_id).eq('sender_id', m.sender_id).neq('id', id)
    .gt('notified_at', new Date(Date.now() - 20 * 1000).toISOString());
  if ((count || 0) > 0) return json({ skipped: 'throttle' });

  const { data: chat } = await db.from('chats').select('buyer_id, seller_id').eq('id', m.chat_id).maybeSingle();
  if (!chat) return json({ skipped: 'no chat' });
  const to = chat.buyer_id === m.sender_id ? chat.seller_id : chat.buyer_id;
  const { data: st } = await db.from('user_settings').select('notify_messages').eq('user_id', to).maybeSingle();
  if (st && st.notify_messages === false) return json({ skipped: 'off' });
  const { data: people } = await db.from('profiles').select('id, telegram_id, username, name').in('id', [to, m.sender_id]);
  const rcpt = people?.find((p) => p.id === to);
  const snd = people?.find((p) => p.id === m.sender_id);
  if (!rcpt || !snd) return json({ skipped: 'no profile' });
  const who = snd.username ? '@' + snd.username : snd.name;
  const text = `💬 ${who} написал тебе: ${String(m.text).slice(0, 100)}`;
  const markup = { inline_keyboard: [[{ text: 'Открыть чат', url: SITE_URL + '#/chat/' + m.chat_id }]] };
  const r = await tgSend(rcpt.telegram_id, text, markup);
  return json({ sent: true, ...r });
});
