
import { errorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addChatMessage, getChatMessages, getPlayerBySession, getRoomByCode } from '@/lib/server/store';
import { getSessionToken } from '@/lib/server/session';

const ChatSchema = z.object({
  message: z.string().min(1).max(150),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await getRoomByCode(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const session = await getSessionToken();
    if (!session || !await getPlayerBySession(session, room.id)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const messages = await getChatMessages(room.id);
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, 'Error fetching chat') }, { status: 500 });
  }
}

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
    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });

    const message = await addChatMessage(
      room.id,
      player.id,
      player.name,
      player.avatarColor,
      parsed.data.message
    );

    return NextResponse.json({ success: true, message });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, 'Error sending message') }, { status: 500 });
  }
}
