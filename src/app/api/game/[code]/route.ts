
import { errorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { getGameContext } from '@/lib/server/store';
import { publicView } from '@/lib/game/presentation';
import { getSessionToken } from '@/lib/server/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionToken = await getSessionToken();
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const context = await getGameContext(code,sessionToken);
    if (!context) return NextResponse.json({ error: 'Player not in room' }, { status: 403 });
    const player = { id: context.playerId };
    const authState = context.state;
    if (!authState) {
      return NextResponse.json({ error: 'Game not initialized yet' }, { status: 404 });
    }

    // CONFIDENTIALITY RULE:
    // Only return the private hand belonging to THIS authenticated player!
    const myHand = authState.playerHands[player.id] || [];

    return NextResponse.json({
      publicState: publicView(authState.gameState, player.id),
      myHand,
      myPlayerId: player.id,
      roomCode: code,
      serverNow: Date.now(),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, 'Error fetching game state') }, { status: 500 });
  }
}
