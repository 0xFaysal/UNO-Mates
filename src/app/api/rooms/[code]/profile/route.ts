import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionToken } from '@/lib/server/session';
import { renameLobbyPlayer, lobbyErrorStatus } from '@/lib/server/store';
import { errorMessage } from '@/lib/errors';
const schema = z.object({ name: z.string().max(100) }).strict();
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSessionToken();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { code } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Enter your new name (1–20 characters)' }, { status: 400 });
    const name = await renameLobbyPlayer(code, session, parsed.data.name);
    return NextResponse.json({ name });
  } catch (error) { return NextResponse.json({ error: errorMessage(error,'Could not change your name') }, { status: lobbyErrorStatus(error) }); }
}
