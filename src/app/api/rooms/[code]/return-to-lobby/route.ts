import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionToken } from '@/lib/server/session';
import { returnRoomToLobby, lobbyErrorStatus } from '@/lib/server/store';
import { errorMessage } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSessionToken();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({ version: z.number().int().positive(), roundId: z.string().max(100).nullable() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Refresh the results and try again.' }, { status: 400 });
  try {
    const { code } = await params;
    await returnRoomToLobby(code,session,parsed.data.version,parsed.data.roundId);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: errorMessage(error,'Could not return to the lobby.') }, { status: lobbyErrorStatus(error) }); }
}
