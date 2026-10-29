import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAuthoritativeState,
  getPlayerBySession,
  getRoomByCode,
  saveAuthoritativeState,
} from '@/lib/server/store';
import { getSessionToken } from '@/lib/server/session';
import {
  callUnoAction,
  catchUnoAction,
  chooseColorAction,
  drawCardAction,
  passTurnAction,
  playCardAction,
  resolveDraw4ChallengeAction,
  startNewGame,
} from '@/lib/game/engine';

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('play_card'),
    cardId: z.string(),
    hasCalledUno: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('draw_card'),
  }),
  z.object({
    action: z.literal('pass_turn'),
  }),
  z.object({
    action: z.literal('choose_color'),
    color: z.enum(['red', 'yellow', 'green', 'blue']),
  }),
  z.object({
    action: z.literal('challenge_draw4'),
    challenge: z.boolean(),
  }),
  z.object({
    action: z.literal('call_uno'),
  }),
  z.object({
    action: z.literal('catch_uno'),
    targetPlayerId: z.string(),
  }),
  z.object({
    action: z.literal('restart_game'),
  }),
]);

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
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid action payload', details: parsed.error }, { status: 400 });
    }

    const payload = parsed.data;
    const authState = await getAuthoritativeState(room.id);
    if (!authState) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    let nextState = authState;

    switch (payload.action) {
      case 'play_card': {
        nextState = playCardAction(
          authState,
          player.id,
          payload.cardId,
          payload.hasCalledUno || false
        );
        break;
      }
      case 'draw_card': {
        nextState = drawCardAction(authState, player.id);
        break;
      }
      case 'pass_turn': {
        nextState = passTurnAction(authState, player.id);
        break;
      }
      case 'choose_color': {
        nextState = chooseColorAction(authState, player.id, payload.color);
        break;
      }
      case 'challenge_draw4': {
        nextState = resolveDraw4ChallengeAction(authState, player.id, payload.challenge);
        break;
      }
      case 'call_uno': {
        nextState = callUnoAction(authState, player.id);
        break;
      }
      case 'catch_uno': {
        nextState = catchUnoAction(authState, player.id, payload.targetPlayerId);
        break;
      }
      case 'restart_game': {
        if (!player.isHost) {
          return NextResponse.json({ error: 'Only host can restart the game' }, { status: 403 });
        }
        nextState = startNewGame(
          room.id,
          authState.gameState.players.map((p) => ({
            id: p.id,
            name: p.name,
            avatarColor: p.avatarColor,
            isHost: p.isHost,
          }))
        );
        break;
      }
    }

    // Save state atomically
    await saveAuthoritativeState(nextState);

    const myHand = nextState.playerHands[player.id] || [];

    return NextResponse.json({
      success: true,
      publicState: nextState.gameState,
      myHand,
      version: nextState.gameState.version,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 400 });
  }
}
