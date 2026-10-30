import {getRoomByCode,getPlayerBySession,getPlayersInRoom,getSupabaseClient,joinRoom,type PlayerRecord} from './store';
export class ComputerLobbyError extends Error{constructor(message:string,readonly status:number){super(message);}}
const names=['Mango Bot','Panda Bot','Chilli Bot','Cookie Bot','Rocket Bot','Ninja Bot','Waffle Bot','Sleepy Bot','Chaos Bot'];
export async function addComputerPlayer(code:string,session:string):Promise<PlayerRecord>{
 const room=await getRoomByCode(code);if(!room)throw new ComputerLobbyError('Room not found',404);
 const actor=await getPlayerBySession(session,room.id);
 if(!actor||!actor.isHost||room.hostPlayerId!==actor.id)throw new ComputerLobbyError('Only the host can add bots',403);
 if(room.status!=='lobby')throw new ComputerLobbyError('Bots can only join before the game starts',409);
 const players=await getPlayersInRoom(room.id);if(players.length>=room.maxPlayers)throw new ComputerLobbyError('The table is full',409);
 const name=names.find(name=>!players.some(p=>p.name.toLowerCase()===name.toLowerCase()))||'Mango Bot';
 const db=getSupabaseClient();
 if(db){
  const {data:p,error}=await db.rpc('uno_add_computer_player',{p_code:code,p_session:session,p_name:name});
  if(error)throw new ComputerLobbyError(error.message,error.code==='42501'?403:409);
  return {id:p.id,roomId:p.room_id,name:p.name,avatarColor:p.avatar_color,sessionToken:p.session_token,seatIndex:p.seat_index,isHost:false,isReady:true,isOnline:false,isComputer:true,lastSeenAt:Date.parse(p.last_seen_at),createdAt:Date.parse(p.created_at)};
 }
 const {player}=await joinRoom(code,name,'#8b5cf6',crypto.randomUUID());
 return Object.assign(player,{isComputer:true,isReady:true,isOnline:false});
}
