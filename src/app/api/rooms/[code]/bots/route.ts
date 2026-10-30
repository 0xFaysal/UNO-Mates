import {NextRequest,NextResponse} from 'next/server';
import {getSessionToken} from '@/lib/server/session';
import {addComputerPlayer,ComputerLobbyError} from '@/lib/server/computer-players';
export async function POST(_request:NextRequest,{params}:{params:Promise<{code:string}>}){
 const session=await getSessionToken();if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const {code}=await params,player=await addComputerPlayer(code,session);
  return NextResponse.json({player:{id:player.id,name:player.name,avatarColor:player.avatarColor,seatIndex:player.seatIndex,isComputer:true,isReady:true}},{status:201});
 }catch(error){return NextResponse.json({error:error instanceof ComputerLobbyError?error.message:'Could not add a bot. Try again.'},{status:error instanceof ComputerLobbyError?error.status:500});}
}
