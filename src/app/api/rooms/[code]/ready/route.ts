import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlayerBySession, getRoomByCode, setPlayerReady } from '@/lib/server/store';
import { getSessionToken } from '@/lib/server/session';

const ReadySchema = z.object({
  isReady: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await getRoomByCode(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const sessionToken = await getSessionToken();
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const player = await getPlayerBySession(sessionToken, room.id);
    if (!player) return NextResponse.json({ error: 'Player not in room' }, { status: 403 });

    const body = await req.json();
    const parsed = ReadySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid ready state' }, { status: 400 });

    const updated = await setPlayerReady(player.id, parsed.data.isReady);
    return NextResponse.json({ success: true, isReady: updated.isReady });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || 'Error updating ready status' }, { status: 500 });
  }
}
