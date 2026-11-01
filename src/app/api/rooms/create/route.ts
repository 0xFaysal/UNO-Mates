
import { errorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRoom } from '@/lib/server/store';
import { generateSessionToken, getSessionToken, setSessionToken } from '@/lib/server/session';
import {linkAnalyticsVisitor} from '@/lib/server/visitor';

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(20),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid name or avatar color' }, { status: 400 });
    }

    const sessionToken = await getSessionToken() || generateSessionToken();
    const { room, host } = await createRoom(parsed.data.name, parsed.data.avatarColor, sessionToken);
    await setSessionToken(sessionToken);
    await linkAnalyticsVisitor(host.id,sessionToken);

    return NextResponse.json({
      success: true,
      roomCode: room.code,
      roomId: room.id,
      player: {
        id: host.id,
        name: host.name,
        avatarColor: host.avatarColor,
        isHost: true,
        isReady: true,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, 'Failed to create room') }, { status: 500 });
  }
}
