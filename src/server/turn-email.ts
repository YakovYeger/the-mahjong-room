import { createSupabaseAdminClient } from '../lib/supabase/admin';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

export async function dispatchPendingTurnEmails(limit = 10) {
  const admin = createSupabaseAdminClient();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TURN_EMAIL_FROM;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!admin || !apiKey || !from || !siteUrl) return { configured: false, sent: 0, failed: 0 };
  const { data: pending } = await admin.from('player_notifications')
    .select('id,user_id,game_id,payload')
    .eq('email_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 50)));
  let sent = 0;
  let failed = 0;
  for (const notification of pending ?? []) {
    if (!notification.game_id) continue;
    const { data } = await admin.auth.admin.getUserById(notification.user_id);
    const email = data.user?.email;
    if (!email) {
      await admin.from('player_notifications').update({ email_status: 'failed', email_attempted_at: new Date().toISOString() }).eq('id', notification.id).eq('email_status', 'pending');
      failed += 1;
      continue;
    }
    const gameUrl = `${siteUrl.replace(/\/$/, '')}/games/${encodeURIComponent(notification.game_id)}`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'It’s your turn in The Mahjong Room',
        html: `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;color:#173630"><p style="color:#d96f57;text-transform:uppercase;letter-spacing:.12em;font:700 11px Arial,sans-serif">The Mahjong Room</p><h1 style="font-size:34px">Your table is waiting.</h1><p style="font-size:17px;line-height:1.55">A decision is ready in your time-based Mahjong game. Your position is securely autosaved.</p><p><a style="display:inline-block;padding:12px 18px;border-radius:999px;background:#173630;color:white;text-decoration:none;font:700 14px Arial,sans-serif" href="${escapeHtml(gameUrl)}">Return to the table</a></p></div>`,
      }),
    });
    await admin.from('player_notifications').update({ email_status: response.ok ? 'sent' : 'failed', email_attempted_at: new Date().toISOString() }).eq('id', notification.id).eq('email_status', 'pending');
    if (response.ok) sent += 1; else failed += 1;
  }
  return { configured: true, sent, failed };
}
