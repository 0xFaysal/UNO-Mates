import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionToken } from '@/lib/server/session';
import { removeLobbyPlayer, lobbyErrorStatus } from '@/lib/server/store';
import { errorMessage } from '@/lib/errors';
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string; playerId: string }> }) {
  const session = await getSessionToken();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { code, playerId } = await params;
    if (!z.string().uuid().safeParse(playerId).success) return NextResponse.json({ error: 'Choose a player in this lobby' }, { status: 400 });
    await removeLobbyPlayer(code, session, playerId);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: errorMessage(error,'Could not remove this player') }, { status: lobbyErrorStatus(error) }); }
}
