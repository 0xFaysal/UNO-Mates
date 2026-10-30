
import { errorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { getPlayerBySession, getPlayersInRoom, getRoomByCode } from '@/lib/server/store';
import { getSessionToken } from '@/lib/server/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await getRoomByCode(code);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const sessionToken = await getSessionToken();
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let currentPlayer = null;
    if (sessionToken) {
      currentPlayer = await getPlayerBySession(sessionToken, room.id);
    }

    if (!currentPlayer) return NextResponse.json({ error: 'Player not in room' }, { status: 403 });
    const players = await getPlayersInRoom(room.id);

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        hostPlayerId: room.hostPlayerId,
        maxPlayers: room.maxPlayers,
      },
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        seatIndex: p.seatIndex,
        avatarColor: p.avatarColor,
        isHost: p.isHost,
        isReady: p.isReady,
        isOnline: p.isOnline,
        isComputer: Boolean(p.isComputer),
      })),
      me: currentPlayer
        ? {
            id: currentPlayer.id,
            name: currentPlayer.name,
            avatarColor: currentPlayer.avatarColor,
            isHost: currentPlayer.isHost,
            isReady: currentPlayer.isReady,
          }
        : null,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, 'Error fetching room') }, { status: 500 });
  }
}
