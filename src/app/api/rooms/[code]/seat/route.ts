import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionToken } from '@/lib/server/session';
import { getRoomByCode, getPlayerBySession, movePlayerSeat } from '@/lib/server/store';
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
 const token = await getSessionToken();
 if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 try {
  const { code } = await params; const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  const player = await getPlayerBySession(token, room.id);
  if (!player) return NextResponse.json({ error: 'Player not in room' }, { status: 403 });
  const parsed = z.object({ seatIndex: z.number().int().min(0).max(9), expectedOccupantId: z.string().uuid().nullable().default(null) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Choose a seat from 1 to 10' }, { status: 400 });
  await movePlayerSeat(room.id, player.id, parsed.data.seatIndex, parsed.data.expectedOccupantId);
  return NextResponse.json({ success: true });
 } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not move seats' }, { status: 409 }); }
}
