import {NextResponse} from 'next/server';
import {getSessionToken} from '@/lib/server/session';
import {restoreHumanControl} from '@/lib/server/store';
import {publicView} from '@/lib/game/presentation';
export async function POST(_request:Request,{params}:{params:Promise<{code:string}>}){
 const session=await getSessionToken();
 if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const {code}=await params,context=await restoreHumanControl(code,session);
  if(!context?.state)return NextResponse.json({error:'Player not in an active room'},{status:403});
  return NextResponse.json({publicState:publicView(context.state.gameState,context.playerId),myHand:context.state.playerHands[context.playerId]||[],myPlayerId:context.playerId,serverNow:Date.now()});
 }catch{return NextResponse.json({error:'Could not restore control. Reconnect to try again.'},{status:503});}
}
