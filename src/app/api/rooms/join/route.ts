
import { errorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { joinRoom } from '@/lib/server/store';
import { generateSessionToken, getSessionToken, setSessionToken } from '@/lib/server/session';
import {linkAnalyticsVisitor} from '@/lib/server/visitor';

const JoinRoomSchema = z.object({
  code: z.string().min(4).max(8),
  name: z.string().min(1).max(20),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = JoinRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid room code, name, or avatar color' }, { status: 400 });
    }

    let sessionToken = await getSessionToken();
    if (!sessionToken) {
      sessionToken = generateSessionToken();
      await setSessionToken(sessionToken);
    }

    const { room, player } = await joinRoom(
      parsed.data.code,
      parsed.data.name,
      parsed.data.avatarColor,
      sessionToken
    );

    await linkAnalyticsVisitor(player.id,sessionToken);
    return NextResponse.json({
      success: true,
      roomCode: room.code,
      roomId: room.id,
      player: {
        id: player.id,
        name: player.name,
        avatarColor: player.avatarColor,
        isHost: player.isHost,
        isReady: player.isReady,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, 'Failed to join room') }, { status: 400 });
  }
}
