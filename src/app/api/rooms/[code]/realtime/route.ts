import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionToken } from '@/lib/server/session';
import { getRoomByCode, getPlayerBySession, getSupabaseClient,restoreHumanControl } from '@/lib/server/store';

// Exchange the existing HttpOnly guest cookie for a member-scoped Realtime identity.
// No email is sent: the admin-generated one-time link is verified on this server.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
 try {
  const session = await getSessionToken();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { code } = await params;
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  const player = await getPlayerBySession(session, room.id);
  if (!player) return NextResponse.json({ error: 'Player not in room' }, { status: 403 });
  const admin = getSupabaseClient();
  if (!admin) throw new Error('Supabase is required for Realtime');
  const email = player.id + '@guest.uno.invalid';
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkError) throw linkError;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' });
  if (error || !data.session) throw error || new Error('Could not create realtime session');
  // A legacy tab makes this seat's compatibility mode sticky for the room lifetime.
  const { data:membership,error: memberError } = await admin.from('players').update({ auth_user_id: data.user!.id,...(req.headers.get('X-UNO-Realtime-Protocol')==='2'?{}:{realtime_legacy:true}) }).eq('id', player.id).select('realtime_legacy').single();
  if (memberError) throw memberError;
  // An authenticated return immediately restores human control, even off-turn.
  await restoreHumanControl(code,session);
  return NextResponse.json({ accessToken: data.session.access_token, expiresAt: data.session.expires_at,
   roomTopic: 'room:' + room.id, playerTopic: 'player:' + player.id, controlTopic: 'control:' + data.user!.id, playerId: player.id,protocol:2,legacySeat:membership!.realtime_legacy }, { headers: { 'Cache-Control': 'no-store' } });
 } catch {
  return NextResponse.json({ error: 'Could not connect to live updates. Please reconnect.' }, { status: 503 });
 }
}
