
import { errorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getGameContext,
  saveAuthoritativeState,
} from '@/lib/server/store';
import { publicView, recordMove } from '@/lib/game/presentation';
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
    color: z.enum(['red','yellow','green','blue']).optional(),
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
]).and(z.object({ requestId: z.string().uuid().optional() }));

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionToken = await getSessionToken();
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const context = await getGameContext(code,sessionToken);
    if (!context) return NextResponse.json({ error: 'Player not in room' }, { status: 403 });
    const player = { id: context.playerId, isHost: context.isHost };
    const room = { id: context.roomId };
    const body = await req.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid action payload', details: parsed.error }, { status: 400 });
    }

    const payload = parsed.data;
    const authState = context.state;
    if (!authState) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const expectedVersion = authState.gameState.version;
    const inputState = structuredClone(authState);
    let nextState = inputState;

    switch (payload.action) {
      case 'play_card': {
        nextState = playCardAction(
          inputState,
          player.id,
          payload.cardId,
          payload.hasCalledUno || false
        );
        if (payload.color && ['choose_color_wild','choose_color_draw4'].includes(nextState.gameState.pendingAction.type)) nextState = chooseColorAction(nextState,player.id,payload.color);
        break;
      }
      case 'draw_card': {
        nextState = drawCardAction(inputState, player.id);
        break;
      }
      case 'pass_turn': {
        nextState = passTurnAction(inputState, player.id);
        break;
      }
      case 'choose_color': {
        nextState = chooseColorAction(inputState, player.id, payload.color);
        break;
      }
      case 'challenge_draw4': {
        nextState = resolveDraw4ChallengeAction();
        break;
      }
      case 'call_uno': {
        nextState = callUnoAction(inputState, player.id);
        break;
      }
      case 'catch_uno': {
        nextState = catchUnoAction(inputState, player.id, payload.targetPlayerId);
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

    if (payload.action === 'restart_game') nextState.gameState.version = expectedVersion + 1;

    const moveType = payload.action === 'play_card' ? 'play' : payload.action === 'draw_card' ? 'draw' : payload.action === 'choose_color' ? 'color' : payload.action === 'restart_game' ? 'start' : 'other';
    nextState.gameState = recordMove(authState.gameState,nextState.gameState,player.id,moveType,payload.requestId || crypto.randomUUID());

    // Save state atomically
    await saveAuthoritativeState(nextState, expectedVersion);

    const myHand = nextState.playerHands[player.id] || [];

    return NextResponse.json({
      success: true,
      publicState: publicView(nextState.gameState, player.id),
      myHand,
      version: nextState.gameState.version,
      serverNow: Date.now(),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, 'Action failed') }, { status: 400 });
  }
}
