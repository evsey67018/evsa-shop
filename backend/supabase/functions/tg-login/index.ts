// Вход через Telegram-бота.
// action=start  {nonce}  — сайт регистрирует одноразовый nonce (живёт 5 минут).
// (бот после /start login_<nonce> записывает в login_nonces telegram_id — service role)
// action=poll   {nonce}  — сайт опрашивает; когда бот подтвердил, nonce гасится и выдаётся сессия Supabase.
import { admin, anon, cors, json } from '../_shared/common.ts';

const NONCE_RE = /^[A-Za-z0-9]{32}$/;
const TTL_MS = 5 * 60 * 1000;

function cleanName(first?: string | null, last?: string | null) {
  const n = [first, last].filter(Boolean).join(' ').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 64);
  return n || 'Пользователь';
}
function cleanUsername(u?: string | null) {
  return u && /^[A-Za-z0-9_]{3,32}$/.test(u) ? u : null;
}

async function sessionFor(row: Record<string, any>) {
  const db = admin();
  const tgId = Number(row.telegram_id);
  const email = `tg${tgId}@users.evsa-shop.app`;
  const name = cleanName(row.tg_first_name, row.tg_last_name);
  const username = cleanUsername(row.tg_username);

  const { data: prof } = await db.from('profiles').select('id, banned').eq('telegram_id', tgId).maybeSingle();
  let userId = prof?.id as string | undefined;
  if (prof?.banned) return { status: 'banned' };
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { telegram_id: tgId, name, username },
    });
    if (error || !data.user) { console.log('createUser failed', error?.message); return { status: 'error' }; }
    userId = data.user.id;
    const { error: pe } = await db.from('profiles').insert({ id: userId, telegram_id: tgId, name, username });
    if (pe) { console.log('profile insert failed', pe.message); return { status: 'error' }; }
    await db.from('user_settings').insert({ user_id: userId });
  } else {
    await db.from('profiles').update({ name, username }).eq('id', userId);
  }
  const { data: link, error: le } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (le || !link?.properties?.hashed_token) { console.log('generateLink failed', le?.message); return { status: 'error' }; }
  const { data: v, error: ve } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (ve || !v.session) { console.log('verifyOtp failed', ve?.message); return { status: 'error' }; }
  const s = v.session;
  return {
    status: 'ok',
    session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at, token_type: s.token_type },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const nonce = String(body?.nonce || '');
  if (!NONCE_RE.test(nonce)) return json({ error: 'bad nonce' }, 400);
  const db = admin();

  if (body.action === 'start') {
    // уборка старых записей
    await db.from('login_nonces').delete().lt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    const { error } = await db.from('login_nonces').insert({ nonce });
    if (error) return json({ error: 'exists' }, 409);
    return json({ ok: true, expires_in: TTL_MS / 1000 });
  }

  if (body.action === 'poll') {
    const { data: row } = await db.from('login_nonces').select('*').eq('nonce', nonce).maybeSingle();
    if (!row) return json({ status: 'unknown' });
    if (row.used_at) return json({ status: 'used' });
    if (Date.now() - new Date(row.created_at).getTime() > TTL_MS) return json({ status: 'expired' });
    if (!row.granted_at || !row.telegram_id) return json({ status: 'pending' });
    // гасим nonce атомарно — второй опрос уже ничего не получит
    const { data: claimed } = await db.from('login_nonces').update({ used_at: new Date().toISOString() })
      .eq('nonce', nonce).is('used_at', null).select('*');
    if (!claimed || !claimed.length) return json({ status: 'used' });
    return json(await sessionFor(claimed[0]));
  }
  return json({ error: 'bad action' }, 400);
});
