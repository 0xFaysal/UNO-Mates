import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSessionToken} from '@/lib/server/session';
import {acknowledgeDeal} from '@/lib/server/store';
import {publicView} from '@/lib/game/presentation';
import {errorMessage} from '@/lib/errors';
const schema=z.object({roundId:z.string().uuid(),turnToken:z.string().uuid()});
export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){
 const session=await getSessionToken();
 if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=schema.safeParse(await request.json().catch(()=>null));
 if(!body.success)return NextResponse.json({error:'Invalid opening turn.'},{status:400});
 try{
  const {code}=await params;
  const context=await acknowledgeDeal(code,session,body.data.roundId,body.data.turnToken);
  if(!context?.state)return NextResponse.json({error:'Player not in room'},{status:403});
  return NextResponse.json({publicState:publicView(context.state.gameState,context.playerId),myHand:context.state.playerHands[context.playerId]||[],myPlayerId:context.playerId,serverNow:Date.now()});
 }catch(error){return NextResponse.json({error:errorMessage(error,'Could not start your turn. Try again.')},{status:409});}
}
