
import { errorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { getPlayerBySession, getRoomByCode, startGameInRoom } from '@/lib/server/store';
import { getSessionToken } from '@/lib/server/session';

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
    if (!player || !player.isHost) {
      return NextResponse.json({ error: 'Only the host can start the game' }, { status: 403 });
    }

    const state = await startGameInRoom(code, player.id);

    return NextResponse.json({
      success: true,
      gameStarted: true,
      version: state.gameState.version,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, 'Error starting game') }, { status: 400 });
  }
}
