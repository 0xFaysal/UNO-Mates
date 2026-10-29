import { NextRequest, NextResponse } from 'next/server';
import { getAuthoritativeState, getPlayerBySession, getRoomByCode } from '@/lib/server/store';
import { getSessionToken } from '@/lib/server/session';

export async function GET(
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

    const authState = await getAuthoritativeState(room.id);
    if (!authState) {
      return NextResponse.json({ error: 'Game not initialized yet' }, { status: 404 });
    }

    // CONFIDENTIALITY RULE:
    // Only return the private hand belonging to THIS authenticated player!
    const myHand = authState.playerHands[player.id] || [];

    return NextResponse.json({
      publicState: { ...authState.gameState, drawnCardPlayableId: authState.gameState.players[authState.gameState.turnIndex].id === player.id ? authState.gameState.drawnCardPlayableId : null },
      myHand,
      myPlayerId: player.id,
      roomCode: room.code,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || 'Error fetching game state' }, { status: 500 });
  }
}
